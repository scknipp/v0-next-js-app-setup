// Server-only: asks Claude (the AI coach) to review one chart, and works out what that cost.
// The Anthropic key is read from .env.local here and never reaches the browser.
//
// The browser sends only the ticker and a chart screenshot. The facts and bars are rebuilt
// here from the same cached Tiingo data the chart uses, so they always match each other.
//
// Cache: one JSON file per ticker per day in `.cache/coach/`, so re-opening a ticker the same
// day is free. Only Re-analyze (`fresh`) pays for a new answer, which replaces the saved one.

import Anthropic from '@anthropic-ai/sdk';
import { promises as fs } from 'fs';
import path from 'path';
import { analyzeChart } from './analyze';
import { COACH_SYSTEM_PROMPT } from './coach-prompt';
import { COACH_ANNOTATION_TYPES, COACH_MODEL, VERDICTS, type CoachAnalysis, type CoachResponse } from './coach-types';
import { toWeekly } from './indicators';
import { getDailyHistory, marketDate } from './tiingo';
import type { Bar } from './types';

const CACHE_DIR = path.join(process.cwd(), '.cache', 'coach');

/** Dollars per million tokens for Claude Sonnet 5.5 (Anthropic pricing page, Oct 2026).
 *  The backup model, Claude Sonnet 5, charges the same for input and output. */
const PRICE_PER_MTOK = { input: 2, output: 10, cacheWrite: 2.5, cacheRead: 0.1 };

const DAILY_BARS_SENT = 252; // ~12 months
const WEEKLY_BARS_SENT = 156; // ~3 years
const MAX_TOKENS = 16000; // room for the model's thinking plus the JSON answer
const MAX_SCREENSHOT_CHARS = 5_000_000; // ~3.7 MB image; a downscaled chart is far smaller

/** A problem we can explain to Steve in plain English. `status` is the HTTP code to return. */
export class CoachError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

type ImageType = 'image/png' | 'image/jpeg' | 'image/webp';

/** Accepts a data URL ("data:image/png;base64,...") from chart.takeScreenshot(). */
function parseScreenshot(dataUrl: unknown): { mediaType: ImageType; data: string } | null {
  if (typeof dataUrl !== 'string' || dataUrl === '') return null;
  const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) throw new CoachError('The chart screenshot was in an unexpected format.', 400);
  if (match[2].length > MAX_SCREENSHOT_CHARS) throw new CoachError('The chart screenshot was too large.', 400);
  return { mediaType: match[1] as ImageType, data: match[2] };
}

/** Prices to 2 decimals (4 under $1), so bars stay compact. */
const fmt = (n: number) => (Math.abs(n) >= 1 ? n.toFixed(2) : n.toFixed(4));

function barsToCsv(bars: Bar[]): string {
  return bars.map((b) => `${b.time},${fmt(b.open)},${fmt(b.high)},${fmt(b.low)},${fmt(b.close)},${b.volume}`).join('\n');
}

// The JSON shape Claude must return (structured outputs). Every object lists all its fields
// as required and allows no extras; "nullable" fields use anyOf with null.
const nullable = (schema: object) => ({ anyOf: [schema, { type: 'null' }] });
const ANALYSIS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'verdict', 'pattern', 'confidence', 'pivot', 'buy_zone', 'suggested_stop', 'checklist',
    'volume_summary', 'market_check', 'what_to_watch_next', 'lesson', 'annotations',
  ],
  properties: {
    verdict: { type: 'string', enum: [...VERDICTS] },
    pattern: { type: 'string' },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
    pivot: nullable({ type: 'number' }),
    buy_zone: nullable({ type: 'array', items: { type: 'number' } }),
    suggested_stop: nullable({ type: 'number' }),
    checklist: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['item', 'status', 'explanation'],
        properties: {
          item: { type: 'string' },
          status: { type: 'string', enum: ['pass', 'caution', 'fail'] },
          explanation: { type: 'string' },
        },
      },
    },
    volume_summary: { type: 'string' },
    market_check: { type: 'string' },
    what_to_watch_next: { type: 'string' },
    lesson: { type: 'string' },
    annotations: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['type', 'date', 'price', 'label'],
        properties: {
          type: { type: 'string', enum: [...COACH_ANNOTATION_TYPES] },
          date: { type: 'string', format: 'date' },
          price: { type: 'number' },
          label: { type: 'string' },
        },
      },
    },
  },
};

async function readCache(symbol: string, day: string): Promise<CoachResponse | null> {
  try {
    const saved = JSON.parse(await fs.readFile(path.join(CACHE_DIR, `${symbol}-${day}.json`), 'utf8'));
    return { ...saved, fromCache: true } as CoachResponse;
  } catch {
    return null; // not analyzed yet today
  }
}

async function writeCache(symbol: string, day: string, data: CoachResponse) {
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
    // Remove this ticker's older days so the cache folder doesn't grow forever.
    for (const file of await fs.readdir(CACHE_DIR)) {
      if (file.startsWith(`${symbol}-`)) await fs.unlink(path.join(CACHE_DIR, file));
    }
    await fs.writeFile(path.join(CACHE_DIR, `${symbol}-${day}.json`), JSON.stringify(data));
  } catch (err) {
    console.warn('Could not save the coach answer:', err); // not fatal: Steve still sees it
  }
}

/** Today's saved analysis for `symbol`, or null. Never calls Claude, so it's always free. */
export function getSavedCoach(symbol: string): Promise<CoachResponse | null> {
  return readCache(symbol, marketDate());
}

/** Anthropic's own explanation from an error response, falling back to the SDK's message. */
function anthropicMessage(err: InstanceType<typeof Anthropic.APIError>): string {
  const body = err.error as { error?: { message?: string } } | undefined;
  return body?.error?.message ?? err.message;
}

async function askClaude(content: Anthropic.Beta.BetaContentBlockParam[]) {
  const client = new Anthropic(); // reads ANTHROPIC_API_KEY from the environment
  try {
    return await client.beta.messages.create({
      model: COACH_MODEL,
      max_tokens: MAX_TOKENS,
      // If Sonnet 5.5's safety check wrongly declines, Anthropic retries on its recommended
      // backup model inside the same request. Costs nothing unless it actually happens.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'high', format: { type: 'json_schema', schema: ANALYSIS_SCHEMA } },
      system: COACH_SYSTEM_PROMPT,
      messages: [{ role: 'user', content }],
    });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      throw new CoachError('Anthropic rejected the API key. Double-check ANTHROPIC_API_KEY in .env.local, then restart npm run dev.', 401);
    }
    if (err instanceof Anthropic.RateLimitError) {
      throw new CoachError('Anthropic says too many requests right now. Wait a minute and try again.', 429);
    }
    if (err instanceof Anthropic.APIConnectionError) {
      throw new CoachError('Could not reach Anthropic. Check your internet connection.', 502);
    }
    if (err instanceof Anthropic.APIError) {
      // e.g. "Your credit balance is too low…" or a reached spend limit; Anthropic's wording is clear.
      throw new CoachError(`Anthropic couldn't run the analysis: ${anthropicMessage(err)}`, err.status ?? 502);
    }
    throw err;
  }
}

/** The AI analysis for `symbol`: today's saved one if there is one, unless `fresh` (Re-analyze).
 *  `screenshot` is an optional data URL of the chart. */
export async function runCoach(symbol: string, screenshot: unknown, fresh = false): Promise<CoachResponse> {
  const day = marketDate();
  if (!fresh) {
    const saved = await readCache(symbol, day);
    if (saved) return saved;
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    throw new CoachError('No Anthropic API key yet. Add ANTHROPIC_API_KEY to .env.local, then restart npm run dev.', 500);
  }
  const shot = parseScreenshot(screenshot);

  // Same cached data the chart uses; SPY is optional, as on the page.
  const { bars: daily } = await getDailyHistory(symbol);
  const spy = await getDailyHistory('SPY').then((h) => h.bars, () => null);
  const weekly = toWeekly(daily);
  const facts = analyzeChart(symbol, daily, weekly, spy);
  if (!facts) throw new CoachError(`Not enough price history for "${symbol}" to analyze.`, 422);

  const text = [
    `Ticker: ${symbol}. Latest bar: ${facts.asOf}.`,
    shot ? 'The attached image is a screenshot of the chart as currently displayed.' : 'No chart screenshot was attached.',
    '',
    '## Facts from our analysis engine (computed in code from the bars below)',
    JSON.stringify(facts),
    '',
    `## Daily bars, last ${Math.min(DAILY_BARS_SENT, daily.length)} trading days (date,open,high,low,close,volume)`,
    barsToCsv(daily.slice(-DAILY_BARS_SENT)),
    '',
    `## Weekly bars, last ${Math.min(WEEKLY_BARS_SENT, weekly.length)} weeks (week-ending date,open,high,low,close,volume; the last week may be partial)`,
    barsToCsv(weekly.slice(-WEEKLY_BARS_SENT)),
  ].join('\n');

  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  if (shot) content.push({ type: 'image', source: { type: 'base64', media_type: shot.mediaType, data: shot.data } });
  content.push({ type: 'text', text });

  const response = await askClaude(content);

  if (response.stop_reason === 'refusal') {
    throw new CoachError('The AI declined to review this chart. Try Re-analyze, or a different ticker.', 502);
  }
  if (response.stop_reason === 'max_tokens') {
    throw new CoachError('The AI ran out of room before finishing its answer. Try Re-analyze.', 502);
  }

  const answer = response.content.map((block) => (block.type === 'text' ? block.text : '')).join('');
  let analysis: CoachAnalysis;
  try {
    analysis = JSON.parse(answer) as CoachAnalysis;
  } catch {
    throw new CoachError('The AI sent back an answer we could not read. Try Re-analyze.', 502);
  }
  // The schema can't require exactly two numbers, so tidy the buy zone here.
  if (analysis.buy_zone && analysis.buy_zone.length !== 2) analysis.buy_zone = null;

  const u = response.usage;
  const usage = {
    inputTokens: u.input_tokens,
    outputTokens: u.output_tokens,
    cacheWriteTokens: u.cache_creation_input_tokens ?? 0,
    cacheReadTokens: u.cache_read_input_tokens ?? 0,
  };
  const costUsd =
    (usage.inputTokens * PRICE_PER_MTOK.input +
      usage.outputTokens * PRICE_PER_MTOK.output +
      usage.cacheWriteTokens * PRICE_PER_MTOK.cacheWrite +
      usage.cacheReadTokens * PRICE_PER_MTOK.cacheRead) /
    1_000_000;

  const result: CoachResponse = {
    symbol,
    asOf: facts.asOf,
    analyzedAt: new Date().toISOString(),
    model: response.model,
    analysis,
    usage,
    costUsd,
    fromCache: false,
  };
  await writeCache(symbol, day, result);
  return result;
}
