// Server-only: fetches daily price history from Tiingo and caches it on disk.
// The API key is read from .env.local here and never reaches the browser.
//
// Cache: one JSON file per ticker per day in `.cache/tiingo/`, so each ticker costs
// at most 2 Tiingo requests per day (free plan: 50/hour, 1,000/day, 500 tickers/month).

import { promises as fs } from 'fs';
import path from 'path';
import type { Bar, PriceHistory } from './types';

const CACHE_DIR = path.join(process.cwd(), '.cache', 'tiingo');
const YEARS_OF_HISTORY = 6; // 5 years to view, plus ~1 year so long moving averages start filled in

/** A problem we can explain to Steve in plain English. `status` is the HTTP code to return. */
export class PriceDataError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

/** Today's date in New York (the market's time zone), e.g. "2026-10-02". */
function marketDate(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

async function readCache(symbol: string, day: string): Promise<PriceHistory | null> {
  try {
    const text = await fs.readFile(path.join(CACHE_DIR, `${symbol}-${day}.json`), 'utf8');
    return JSON.parse(text) as PriceHistory;
  } catch {
    return null; // no cache yet for today
  }
}

async function writeCache(symbol: string, day: string, data: PriceHistory) {
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
    // Remove this ticker's older days so the cache folder doesn't grow forever.
    for (const file of await fs.readdir(CACHE_DIR)) {
      if (file.startsWith(`${symbol}-`)) await fs.unlink(path.join(CACHE_DIR, file));
    }
    await fs.writeFile(path.join(CACHE_DIR, `${symbol}-${day}.json`), JSON.stringify(data));
  } catch (err) {
    console.warn('Could not write price cache:', err); // not fatal: the chart still loads
  }
}

async function tiingoGet(url: string, apiKey: string): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Authorization: `Token ${apiKey}`, 'Content-Type': 'application/json' },
      cache: 'no-store',
    });
  } catch {
    throw new PriceDataError('Could not reach Tiingo. Check your internet connection.', 502);
  }

  const text = await res.text();
  if (res.status === 404) throw new PriceDataError('NOT_FOUND', 404);
  if (res.status === 401 || res.status === 403) {
    throw new PriceDataError('Tiingo rejected the API key. Double-check TIINGO_API_KEY in .env.local.', 401);
  }
  // Tiingo reports usage-limit problems as plain text, sometimes with status 200.
  const looksLikeJson = text.startsWith('[') || text.startsWith('{');
  if (res.status === 429 || (!looksLikeJson && /allocation|limit/i.test(text.slice(0, 300)))) {
    throw new PriceDataError('Tiingo free-plan limit reached. Wait a while (limits reset hourly) and try again.', 429);
  }
  if (!res.ok) throw new PriceDataError(`Tiingo returned an error (${res.status}).`, 502);

  try {
    return JSON.parse(text);
  } catch {
    throw new PriceDataError('Tiingo sent back something unexpected.', 502);
  }
}

type TiingoPrice = {
  date: string;
  adjOpen: number;
  adjHigh: number;
  adjLow: number;
  adjClose: number;
  adjVolume: number;
};

/** Daily bars for one US ticker, newest last. Uses split/dividend-adjusted prices. */
export async function getDailyHistory(symbol: string): Promise<PriceHistory> {
  const apiKey = process.env.TIINGO_API_KEY;
  if (!apiKey) {
    throw new PriceDataError('No Tiingo API key yet. Add TIINGO_API_KEY to .env.local, then restart npm run dev.', 500);
  }

  const day = marketDate();
  const cached = await readCache(symbol, day);
  if (cached) return cached;

  // Tiingo writes share classes with a dash (BRK-B), while many sites use a dot (BRK.B).
  const tiingoSymbol = symbol.replace('.', '-').toLowerCase();
  const start = new Date();
  start.setFullYear(start.getFullYear() - YEARS_OF_HISTORY);
  const startDate = start.toISOString().slice(0, 10);

  let meta: unknown;
  let prices: unknown;
  try {
    [meta, prices] = await Promise.all([
      tiingoGet(`https://api.tiingo.com/tiingo/daily/${tiingoSymbol}`, apiKey),
      tiingoGet(`https://api.tiingo.com/tiingo/daily/${tiingoSymbol}/prices?startDate=${startDate}`, apiKey),
    ]);
  } catch (err) {
    if (err instanceof PriceDataError && err.message === 'NOT_FOUND') {
      throw new PriceDataError(`Couldn't find a ticker called "${symbol}". Check the spelling.`, 404);
    }
    throw err;
  }

  if (!Array.isArray(prices) || prices.length === 0) {
    throw new PriceDataError(`No price history available for "${symbol}".`, 404);
  }

  const bars: Bar[] = (prices as TiingoPrice[]).map((p) => ({
    time: p.date.slice(0, 10),
    open: p.adjOpen,
    high: p.adjHigh,
    low: p.adjLow,
    close: p.adjClose,
    volume: Math.round(p.adjVolume),
  }));

  const name = (meta as { name?: string })?.name?.trim() || symbol;
  const result: PriceHistory = { symbol, name, bars };
  await writeCache(symbol, day, result);
  return result;
}
