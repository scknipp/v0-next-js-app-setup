// The AI coach's review of a chart. Runs on the server, so the Anthropic API key stays private.
//
// GET  /api/analyze-chart?symbol=NVDA  → today's saved review, or { saved: null }. Always free.
// POST /api/analyze-chart  { symbol, screenshot?, reanalyze? } → today's saved review if there is
//      one; otherwise (or with reanalyze: true) asks Claude for a new one. Only sent on a click.

import { NextResponse } from 'next/server';
import { CoachError, getSavedCoach, runCoach } from '@/lib/charts/coach';
import { PriceDataError } from '@/lib/charts/tiingo';

/** Same rule as /api/prices: letters, digits, dot or dash only (e.g. NVDA, BRK.B). */
function cleanSymbol(raw: unknown): string | null {
  const symbol = (typeof raw === 'string' ? raw : '').trim().toUpperCase();
  return /^[A-Z0-9.\-]{1,10}$/.test(symbol) ? symbol : null;
}

const badSymbol = () => NextResponse.json({ error: 'Please enter a valid ticker symbol, like NVDA.' }, { status: 400 });

export async function GET(request: Request) {
  const symbol = cleanSymbol(new URL(request.url).searchParams.get('symbol'));
  if (!symbol) return badSymbol();
  return NextResponse.json({ saved: await getSavedCoach(symbol) });
}

export async function POST(request: Request) {
  let body: { symbol?: unknown; screenshot?: unknown; reanalyze?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'The analysis request was malformed.' }, { status: 400 });
  }

  const symbol = cleanSymbol(body.symbol);
  if (!symbol) return badSymbol();

  try {
    return NextResponse.json(await runCoach(symbol, body.screenshot, body.reanalyze === true));
  } catch (err) {
    if (err instanceof CoachError || err instanceof PriceDataError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('Unexpected error running the AI coach:', err);
    return NextResponse.json({ error: 'Something went wrong running the analysis.' }, { status: 500 });
  }
}
