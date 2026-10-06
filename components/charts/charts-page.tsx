'use client';

// The full-screen Charts page: thin navy frame, slim toolbar, and the chart filling the rest.
// Later stages add the Daily/Weekly toggle, presets, drawing tools, indicators and Analyze.

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Home, Loader2 } from 'lucide-react';
import { PriceChart } from './price-chart';
import type { PriceHistory } from '@/lib/charts/types';

const DEFAULT_SYMBOL = 'NVDA';
const STORAGE_KEY = 'tgi-charts-settings';

function loadSavedSymbol(): string | null {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}').symbol ?? null;
  } catch {
    return null; // storage blocked or corrupted — just use the default
  }
}

function saveSymbol(symbol: string) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ symbol }));
  } catch {
    // ignore: remembering the ticker is a convenience, not essential
  }
}

export function ChartsPage({ initialSymbol }: { initialSymbol?: string }) {
  const [input, setInput] = useState('');
  const [data, setData] = useState<PriceHistory | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSymbol = useCallback(async (raw: string) => {
    const symbol = raw.trim().toUpperCase();
    if (!symbol) return;
    setInput(symbol);
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/prices?symbol=${encodeURIComponent(symbol)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Could not load prices.');
      setData(json as PriceHistory);
      saveSymbol(symbol);
      // Keep the address bar in sync (e.g. /charts?symbol=NVDA) without reloading the page.
      window.history.replaceState(null, '', `/charts?symbol=${encodeURIComponent(symbol)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load prices.');
    } finally {
      setLoading(false);
    }
  }, []);

  // On first open: a ?symbol= link wins, then the last ticker you viewed, then NVDA.
  useEffect(() => {
    loadSymbol(initialSymbol || loadSavedSymbol() || DEFAULT_SYMBOL);
  }, [initialSymbol, loadSymbol]);

  // Last price and the change from the prior day's close.
  const bars = data?.bars ?? [];
  const last = bars[bars.length - 1];
  const prev = bars[bars.length - 2];
  const change = last && prev ? last.close - prev.close : 0;
  const changePct = last && prev ? (change / prev.close) * 100 : 0;

  return (
    <div className="h-screen w-screen bg-[#0d2747] p-[7px] flex flex-col overflow-hidden">
      {/* Slim toolbar */}
      <div className="h-9 shrink-0 flex items-center gap-3 pb-[7px] text-white">
        <Link
          href="/"
          className="h-7 px-3 flex items-center gap-1.5 rounded bg-[#6b3410] text-[#FFD43B] text-sm font-semibold hover:bg-[#7d3e14] transition-colors"
        >
          <Home className="w-4 h-4" />
          Home
        </Link>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            loadSymbol(input);
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value.toUpperCase())}
            placeholder="Ticker"
            aria-label="Ticker symbol"
            spellCheck={false}
            maxLength={10}
            className="h-7 w-28 px-2 rounded bg-[#061528] border border-[#1e4060] font-mono text-sm uppercase tracking-wider text-white placeholder:text-gray-500 focus:outline-none focus:border-[#c9a227]"
          />
        </form>

        {data && last && (
          <div className="flex items-baseline gap-2 text-xs min-w-0">
            <span className="text-gray-300 truncate">{data.name}</span>
            <span className="font-mono text-white">{last.close.toFixed(2)}</span>
            <span className={`font-mono ${change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {change >= 0 ? '+' : ''}
              {change.toFixed(2)} ({changePct >= 0 ? '+' : ''}
              {changePct.toFixed(2)}%)
            </span>
          </div>
        )}

        {loading && <Loader2 className="w-4 h-4 animate-spin text-[#c9a227]" />}
      </div>

      {/* Chart area */}
      <div className="relative flex-1 min-h-0 bg-white">
        {data && <PriceChart bars={data.bars} />}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/90 z-10">
            <p className="max-w-md text-center text-sm text-gray-700 px-4">{error}</p>
          </div>
        )}
        {!data && !error && loading && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-gray-400">
            Loading chart…
          </div>
        )}
      </div>
    </div>
  );
}
