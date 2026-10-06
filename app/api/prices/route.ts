// GET /api/prices?symbol=NVDA → daily price history from Tiingo (cached per ticker per day).
// Runs on the server, so the Tiingo API key stays private.

import { NextResponse } from 'next/server';
import { getDailyHistory, PriceDataError } from '@/lib/charts/tiingo';

export async function GET(request: Request) {
  const symbol = (new URL(request.url).searchParams.get('symbol') ?? '').trim().toUpperCase();

  // Letters, digits, dot or dash only (e.g. NVDA, BRK.B). Blocks anything odd before it reaches Tiingo.
  if (!/^[A-Z0-9.\-]{1,10}$/.test(symbol)) {
    return NextResponse.json({ error: 'Please enter a valid ticker symbol, like NVDA.' }, { status: 400 });
  }

  try {
    return NextResponse.json(await getDailyHistory(symbol));
  } catch (err) {
    if (err instanceof PriceDataError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('Unexpected error loading prices:', err);
    return NextResponse.json({ error: 'Something went wrong loading prices.' }, { status: 500 });
  }
}
