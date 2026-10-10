'use client';

// The full-screen Charts page: thin navy frame, slim toolbar, and the chart filling the rest.
// Toolbar (left to right): Home, ticker, Daily/Weekly, timeframe presets, Log, drawing tools,
// trade planner, Indicators. A later stage adds the Analyze button.

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Eraser, Home, Loader2, Minus, MousePointer2, Ruler, Trash2, TrendingUp } from 'lucide-react';
import { PriceChart } from './price-chart';
import { TradePlanner } from './trade-planner';
import { ButtonGroup, IndicatorsMenu, ToolbarButton } from './toolbar-controls';
import {
  EMPTY_PLAN,
  loadDrawings,
  saveDrawings,
  suggestedPivot,
  type ChartTool,
  type Drawing,
  type TradePlan,
} from '@/lib/charts/drawings';
import { sma, volumes } from '@/lib/charts/indicators';
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

const DRAWING_TOOLS: { tool: ChartTool; label: string; icon: typeof TrendingUp }[] = [
  { tool: 'select', label: 'Select (click a drawing, then Delete to remove it)', icon: MousePointer2 },
  { tool: 'trend', label: 'Trend line: click two points', icon: TrendingUp },
  { tool: 'hline', label: 'Horizontal line: click once (support, resistance, pivot)', icon: Minus },
  { tool: 'measure', label: 'Measure: click and drag to see % change and length', icon: Ruler },
];

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

/** The drawings and trade plan for one ticker, kept together so they're always saved under the right symbol. */
type Marks = { symbol: string | null; drawings: Drawing[]; plan: TradePlan };

export function ChartsPage({ initialSymbol }: { initialSymbol?: string }) {
  const [input, setInput] = useState('');
  const [data, setData] = useState<PriceHistory | null>(null);
  const [spyBars, setSpyBars] = useState<Bar[] | null>(null);
  const [settings, setSettings] = useState<ChartSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Swing tools
  const [marks, setMarks] = useState<Marks>({ symbol: null, drawings: [], plan: EMPTY_PLAN });
  const [tool, setTool] = useState<ChartTool>('select');
  const [selectedId, setSelectedId] = useState<string | null>(null);

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

  // When a new ticker loads, bring back its saved drawings and trade plan.
  const symbol = data?.symbol ?? null;
  useEffect(() => {
    if (!symbol) return;
    setMarks({ symbol, ...loadDrawings(symbol) });
    setSelectedId(null);
    setTool('select');
  }, [symbol]);

  // Save drawings whenever they change (under the ticker they belong to).
  useEffect(() => {
    if (marks.symbol) saveDrawings(marks.symbol, { drawings: marks.drawings, plan: marks.plan });
  }, [marks]);

  const addDrawing = useCallback((d: Drawing) => {
    setMarks((m) => ({ ...m, drawings: [...m.drawings, d] }));
    setTool('select'); // one drawing per click of a tool, like most charting apps
  }, []);
  const setPlan = useCallback((plan: TradePlan) => setMarks((m) => ({ ...m, plan })), []);
  const setPivot = useCallback((pivot: number) => {
    setMarks((m) => ({ ...m, plan: { ...m.plan, pivot, visible: true } }));
    setTool('select');
  }, []);
  const deleteSelected = useCallback(() => {
    if (!selectedId) return;
    setMarks((m) => ({ ...m, drawings: m.drawings.filter((d) => d.id !== selectedId) }));
    setSelectedId(null);
  }, [selectedId]);
  const clearAll = () => {
    if (marks.drawings.length === 0) return;
    if (!window.confirm(`Remove all ${marks.drawings.length} drawing(s) from ${marks.symbol}? (The trade plan stays.)`)) return;
    setMarks((m) => ({ ...m, drawings: [] }));
    setSelectedId(null);
  };

  // Keyboard: Escape cancels the current tool; Delete/Backspace removes the selected drawing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') return; // typing, not a shortcut
      if (e.key === 'Escape') {
        setTool('select');
        setSelectedId(null);
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        deleteSelected();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [deleteSelected]);

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
  const bars = useMemo(() => data?.bars ?? [], [data]);
  const last = bars[bars.length - 1];
  const prev = bars[bars.length - 2];
  const change = last && prev ? last.close - prev.close : 0;
  const changePct = last && prev ? (change / prev.close) * 100 : 0;
  const weekly = settings.interval === 'weekly';

  // Numbers the trade planner needs (always from daily bars).
  const plannerInputs = useMemo(() => {
    const avg = sma(volumes(bars), 50);
    return { suggested: suggestedPivot(bars), avgVolume50: avg[avg.length - 1]?.value ?? null };
  }, [bars]);

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
            <span className="text-gray-300 truncate max-w-[14rem]">{data.name}</span>
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

          {/* Drawing tools */}
          <ButtonGroup>
            {DRAWING_TOOLS.map(({ tool: t, label, icon: Icon }) => (
              <ToolbarButton key={t} active={tool === t} onClick={() => setTool(t)} title={label}>
                <Icon className="w-3.5 h-3.5" />
              </ToolbarButton>
            ))}
          </ButtonGroup>
          <ButtonGroup>
            <ToolbarButton disabled={!selectedId} onClick={deleteSelected} title="Delete the selected drawing (Delete key)">
              <Trash2 className="w-3.5 h-3.5" />
            </ToolbarButton>
            <ToolbarButton disabled={marks.drawings.length === 0} onClick={clearAll} title="Clear all drawings for this ticker">
              <Eraser className="w-3.5 h-3.5" />
            </ToolbarButton>
          </ButtonGroup>

          <TradePlanner
            plan={marks.plan}
            onChange={setPlan}
            suggestedPivot={plannerInputs.suggested}
            avgVolume50={plannerInputs.avgVolume50}
            lastClose={last?.close ?? null}
            onPickOnChart={() => setTool('pivot')}
          />

          <IndicatorsMenu indicators={settings.indicators} weekly={weekly} onToggle={toggleIndicator} />
        </div>
      </div>

      {/* Chart area */}
      <div className="relative flex-1 min-h-0 bg-white">
        {data && (
          <PriceChart
            bars={data.bars}
            spyBars={spyBars}
            settings={settings}
            drawings={marks.drawings}
            plan={marks.plan}
            tool={tool}
            selectedId={selectedId}
            onAddDrawing={addDrawing}
            onSelect={setSelectedId}
            onSetPivot={setPivot}
          />
        )}

        {/* A one-line hint while a tool is waiting for clicks */}
        {tool !== 'select' && (
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 pointer-events-none rounded bg-[#0d2747]/90 px-3 py-1 text-xs text-white">
            {tool === 'trend' && 'Click the first point, then the second point.'}
            {tool === 'hline' && 'Click the price level for the line.'}
            {tool === 'measure' && 'Click and drag from one point to another.'}
            {tool === 'pivot' && "Click the pivot. Clicking near a bar's high uses that high + 10¢."}
            <span className="text-gray-400"> · Esc to cancel</span>
          </div>
        )}

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
