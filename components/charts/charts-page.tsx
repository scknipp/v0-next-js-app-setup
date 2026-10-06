'use client';

// The full-screen Charts page: thin navy frame, slim toolbar, and the chart filling the rest.
// Toolbar (left to right): Home, ticker, Daily/Weekly, timeframe presets, Log, Indicators.
// Later stages add drawing tools and the Analyze button.

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { Check, ChevronDown, Home, Loader2 } from 'lucide-react';
import { PriceChart } from './price-chart';
import type { Bar, ChartSettings, IndicatorToggles, PriceHistory, RangePreset } from '@/lib/charts/types';

const DEFAULT_SYMBOL = 'NVDA';
const STORAGE_KEY = 'tgi-charts-settings';
const RANGES: RangePreset[] = ['6M', '1Y', '2Y', '5Y'];

const DEFAULT_SETTINGS: ChartSettings = {
  interval: 'daily',
  range: '1Y',
  logScale: true,
  indicators: {
    movingAverages: true,
    rsLine: true,
    ema10: false,
    ema21: false,
    high52: false,
    candles: false,
  },
};

/** What localStorage holds: the last ticker plus the chart settings. */
type Saved = { symbol?: string } & Partial<ChartSettings>;

function loadSaved(): Saved {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Saved;
  } catch {
    return {}; // storage blocked or corrupted — just use the defaults
  }
}

function save(patch: Saved) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...loadSaved(), ...patch }));
  } catch {
    // ignore: remembering settings is a convenience, not essential
  }
}

async function fetchHistory(symbol: string): Promise<PriceHistory> {
  const res = await fetch(`/api/prices?symbol=${encodeURIComponent(symbol)}`);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? 'Could not load prices.');
  return json as PriceHistory;
}

export function ChartsPage({ initialSymbol }: { initialSymbol?: string }) {
  const [input, setInput] = useState('');
  const [data, setData] = useState<PriceHistory | null>(null);
  const [spyBars, setSpyBars] = useState<Bar[] | null>(null);
  const [settings, setSettings] = useState<ChartSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSymbol = useCallback(async (raw: string) => {
    const symbol = raw.trim().toUpperCase();
    if (!symbol) return;
    setInput(symbol);
    setLoading(true);
    setError(null);
    try {
      setData(await fetchHistory(symbol));
      save({ symbol });
      // Keep the address bar in sync (e.g. /charts?symbol=NVDA) without reloading the page.
      window.history.replaceState(null, '', `/charts?symbol=${encodeURIComponent(symbol)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load prices.');
    } finally {
      setLoading(false);
    }
  }, []);

  // On first open: restore saved settings; load SPY once (for the RS line); then load the
  // ticker — a ?symbol= link wins, then the last ticker you viewed, then NVDA.
  useEffect(() => {
    const saved = loadSaved();
    setSettings({
      ...DEFAULT_SETTINGS,
      ...saved,
      indicators: { ...DEFAULT_SETTINGS.indicators, ...saved.indicators },
    });
    fetchHistory('SPY')
      .then((spy) => setSpyBars(spy.bars))
      .catch(() => setSpyBars(null)); // the chart still works; the legend notes the RS line is missing
    loadSymbol(initialSymbol || saved.symbol || DEFAULT_SYMBOL);
  }, [initialSymbol, loadSymbol]);

  // Changes are worked out from the latest settings (`prev`), so quick clicks never undo each other.
  const updateSettings = (change: (prev: ChartSettings) => Partial<ChartSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...change(prev) };
      save({ interval: next.interval, range: next.range, logScale: next.logScale, indicators: next.indicators });
      return next;
    });
  };
  const toggleIndicator = (key: keyof IndicatorToggles) =>
    updateSettings((prev) => ({ indicators: { ...prev.indicators, [key]: !prev.indicators[key] } }));

  // Last price and the change from the prior day's close.
  const bars = data?.bars ?? [];
  const last = bars[bars.length - 1];
  const prev = bars[bars.length - 2];
  const change = last && prev ? last.close - prev.close : 0;
  const changePct = last && prev ? (change / prev.close) * 100 : 0;
  const weekly = settings.interval === 'weekly';

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
            <span className="text-gray-300 truncate max-w-[16rem]">{data.name}</span>
            <span className="font-mono text-white">{last.close.toFixed(2)}</span>
            <span className={`font-mono whitespace-nowrap ${change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {change >= 0 ? '+' : ''}
              {change.toFixed(2)} ({changePct >= 0 ? '+' : ''}
              {changePct.toFixed(2)}%)
            </span>
          </div>
        )}

        {loading && <Loader2 className="w-4 h-4 shrink-0 animate-spin text-[#c9a227]" />}

        <div className="ml-auto flex items-center gap-3 shrink-0">
          <ButtonGroup>
            <ToolbarButton active={!weekly} onClick={() => updateSettings(() => ({ interval: 'daily' }))}>
              Daily
            </ToolbarButton>
            <ToolbarButton active={weekly} onClick={() => updateSettings(() => ({ interval: 'weekly' }))}>
              Weekly
            </ToolbarButton>
          </ButtonGroup>

          <ButtonGroup>
            {RANGES.map((r) => (
              <ToolbarButton key={r} active={settings.range === r} onClick={() => updateSettings(() => ({ range: r }))}>
                {r}
              </ToolbarButton>
            ))}
          </ButtonGroup>

          <ButtonGroup>
            <ToolbarButton
              active={settings.logScale}
              onClick={() => updateSettings((prev) => ({ logScale: !prev.logScale }))}
              title="Log scale: equal % moves look the same size. Turn off for a linear scale."
            >
              Log
            </ToolbarButton>
          </ButtonGroup>

          <IndicatorsMenu indicators={settings.indicators} weekly={weekly} onToggle={toggleIndicator} />
        </div>
      </div>

      {/* Chart area */}
      <div className="relative flex-1 min-h-0 bg-white">
        {data && <PriceChart bars={data.bars} spyBars={spyBars} settings={settings} />}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/90 z-20">
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

// ----- Small toolbar pieces -----

function ButtonGroup({ children }: { children: ReactNode }) {
  return <div className="flex h-7 rounded border border-[#1e4060] overflow-hidden">{children}</div>;
}

function ToolbarButton({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  title?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={active}
      className={`px-2.5 text-xs font-medium transition-colors ${
        active ? 'bg-[#c9a227] text-[#0d2747]' : 'bg-[#061528] text-gray-300 hover:text-white hover:bg-[#123056]'
      }`}
    >
      {children}
    </button>
  );
}

const INDICATOR_ITEMS: { key: keyof IndicatorToggles; label: string; weeklyLabel?: string; dailyOnly?: boolean }[] = [
  { key: 'movingAverages', label: '50 & 200-day moving averages', weeklyLabel: '10 & 40-week moving averages' },
  { key: 'rsLine', label: 'RS line (vs. SPY)' },
  { key: 'ema10', label: '10-day EMA', dailyOnly: true },
  { key: 'ema21', label: '21-day EMA', dailyOnly: true },
  { key: 'high52', label: '52-week-high line' },
  { key: 'candles', label: 'Candlesticks instead of bars' },
];

function IndicatorsMenu({
  indicators,
  weekly,
  onToggle,
}: {
  indicators: IndicatorToggles;
  weekly: boolean;
  onToggle: (key: keyof IndicatorToggles) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close the menu when clicking anywhere outside it, or pressing Escape.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="h-7 px-2.5 flex items-center gap-1 rounded border border-[#1e4060] bg-[#061528] text-xs font-medium text-gray-300 hover:text-white hover:bg-[#123056]"
      >
        Indicators
        <ChevronDown className="w-3.5 h-3.5" />
      </button>

      {open && (
        <div className="absolute right-0 top-8 z-30 w-64 rounded border border-gray-200 bg-white py-1 shadow-lg text-gray-800">
          {INDICATOR_ITEMS.map((item) => {
            const disabled = item.dailyOnly && weekly;
            return (
              <button
                key={item.key}
                type="button"
                disabled={disabled}
                onClick={() => onToggle(item.key)}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-gray-50 disabled:text-gray-400 disabled:hover:bg-transparent"
              >
                <span
                  className={`w-3.5 h-3.5 shrink-0 rounded-sm border flex items-center justify-center ${
                    indicators[item.key] ? 'bg-[#0d2747] border-[#0d2747]' : 'border-gray-300'
                  }`}
                >
                  {indicators[item.key] && <Check className="w-3 h-3 text-white" />}
                </span>
                {weekly && item.weeklyLabel ? item.weeklyLabel : item.label}
                {disabled && <span className="ml-auto text-[10px]">daily only</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
