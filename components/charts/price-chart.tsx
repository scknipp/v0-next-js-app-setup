'use client';

// The chart drawing itself, using TradingView Lightweight Charts (open-source, Apache-2.0).
// Price bars sit in the top pane (~75%), volume in the bottom pane (~25%), sharing one date axis.
// The small TradingView logo in the corner is the attribution the license asks for — keep it.
//
// Stage 2 overlays (IBD-inspired): moving averages, average-volume line, RS line with new-high
// dots, optional EMAs and 52-week-high line, log scale, and a crosshair legend.
//
// Stage 3 swing tools: trend line, horizontal line, measure, and the trade planner. The painting
// lives in drawings-primitive.ts; this file turns mouse clicks/drags into drawings.

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BarSeries,
  CandlestickSeries,
  ColorType,
  createChart,
  createSeriesMarkers,
  HistogramSeries,
  LineSeries,
  LineStyle,
  PriceScaleMode,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type Time,
} from 'lightweight-charts';
import {
  BARS_PER_YEAR,
  closes,
  ema,
  highestHigh,
  newHighs,
  rsLine,
  sma,
  toWeekly,
  volumes,
  type Point,
} from '@/lib/charts/indicators';
import {
  BREAKOUT_VOLUME_MULTIPLIER,
  indexAtOrAfter,
  newDrawingId,
  PIVOT_ADD,
  type Anchor,
  type ChartTool,
  type Drawing,
  type TradePlan,
} from '@/lib/charts/drawings';
import type { Bar, ChartSettings, RangePreset } from '@/lib/charts/types';
import { DrawingsPrimitive } from './drawings-primitive';

// IBD-style colors: dark blue for up days, red for down days.
const UP_COLOR = '#1f3f8f';
const DOWN_COLOR = '#d0312d';

// Overlay colors: distinct but quiet, so nothing competes with the price bars.
const COLORS = {
  maFast: '#2f9e44', // 50-day / 10-week
  maSlow: '#c2410c', // 200-day / 40-week
  ema10: '#0891b2',
  ema21: '#db2777',
  high52: '#9ca3af',
  rs: '#7c3aed',
  volAvg: '#374151',
};

const RANGE_MONTHS: Record<RangePreset, number> = { '6M': 6, '1Y': 12, '2Y': 24, '5Y': 60 };

type Series = {
  bars: ISeriesApi<'Bar'>;
  candles: ISeriesApi<'Candlestick'>;
  maFast: ISeriesApi<'Line'>;
  maSlow: ISeriesApi<'Line'>;
  ema10: ISeriesApi<'Line'>;
  ema21: ISeriesApi<'Line'>;
  high52: ISeriesApi<'Line'>;
  rs: ISeriesApi<'Line'>;
  rsDots: ISeriesMarkersPluginApi<Time>;
  volume: ISeriesApi<'Histogram'>;
  volAvg: ISeriesApi<'Line'>;
  anchor: ISeriesApi<'Line'>; // invisible; the drawing tools attach to it
  drawings: DrawingsPrimitive;
};

// Quiet line style shared by every overlay: no price tag on the axis, no hover dot.
const QUIET_LINE = {
  lineWidth: 1,
  priceLineVisible: false,
  lastValueVisible: false,
  crosshairMarkerVisible: false,
} as const;

/** Index of the first bar on or after a date N months before the last bar. */
function rangeStartIndex(bars: Bar[], preset: RangePreset): number {
  if (bars.length === 0) return 0;
  const cutoff = new Date(`${bars[bars.length - 1].time}T00:00:00Z`);
  cutoff.setUTCMonth(cutoff.getUTCMonth() - RANGE_MONTHS[preset]);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  const idx = bars.findIndex((b) => b.time >= cutoffStr);
  return idx === -1 ? 0 : idx;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const PIVOT_SNAP_PX = 8; // when picking a pivot, a click this close to a bar's high snaps to it

const toMap = (points: Point[]) => new Map(points.map((p) => [p.time, p.value]));

function formatVolume(v: number): string {
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
  return String(v);
}

type Props = {
  bars: Bar[]; // daily bars for the stock
  spyBars: Bar[] | null; // daily bars for SPY (null if they couldn't load)
  settings: ChartSettings;
  // Swing tools (Stage 3). The page owns these; the chart reports clicks back through the callbacks.
  drawings: Drawing[];
  plan: TradePlan;
  tool: ChartTool;
  selectedId: string | null;
  onAddDrawing: (drawing: Drawing) => void;
  onSelect: (id: string | null) => void;
  onSetPivot: (price: number) => void;
};

export function PriceChart({
  bars: dailyBars,
  spyBars,
  settings,
  drawings,
  plan,
  tool,
  selectedId,
  onAddDrawing,
  onSelect,
  onSetPivot,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<Series | null>(null);
  const volumeTargetRef = useRef<IPriceLine | null>(null);
  const pendingTrendRef = useRef<Anchor | null>(null); // first click of a trend line
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  // The latest tool, bars and callbacks, for the chart's mouse handlers (which are set up once).
  const live = useRef({ tool, bars: [] as Bar[], onAddDrawing, onSelect, onSetPivot });

  const { interval, range, logScale, indicators } = settings;
  const weekly = interval === 'weekly';

  // All the numbers the chart needs, recalculated only when the data or Daily/Weekly changes.
  const derived = useMemo(() => {
    const bars = weekly ? toWeekly(dailyBars) : dailyBars;
    const spy = spyBars ? (weekly ? toWeekly(spyBars) : spyBars) : null;
    const year = BARS_PER_YEAR[interval];
    const c = closes(bars);

    const maFast = sma(c, weekly ? 10 : 50);
    const maSlow = sma(c, weekly ? 40 : 200);
    const ema10 = weekly ? [] : ema(c, 10);
    const ema21 = weekly ? [] : ema(c, 21);
    const volAvg = sma(volumes(bars), weekly ? 10 : 50);
    const rs = spy ? rsLine(bars, spy) : [];
    const rsHighs = newHighs(rs, year);

    // 52-week-high line: drawn flat across the last year, at the highest high in that year.
    const high = highestHigh(bars, year);
    const high52: Point[] = high === null ? [] : bars.slice(-year).map((b) => ({ time: b.time, value: high }));

    return {
      bars,
      maFast,
      maSlow,
      ema10,
      ema21,
      volAvg,
      rs,
      rsHighs,
      high52,
      // Lookups by date, for the hover legend.
      maFastAt: toMap(maFast),
      maSlowAt: toMap(maSlow),
      ema10At: toMap(ema10),
      ema21At: toMap(ema21),
      volAvgAt: toMap(volAvg),
    };
  }, [dailyBars, spyBars, interval, weekly]);

  // Create the chart once when the component appears; remove it when it goes away.
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      autoSize: true, // follows the window size automatically
      layout: {
        background: { type: ColorType.Solid, color: '#ffffff' },
        textColor: '#4a5568',
        fontSize: 11,
        attributionLogo: true,
        panes: { separatorColor: '#e5e7eb', enableResize: false },
      },
      grid: {
        vertLines: { color: '#f5f5f5' },
        horzLines: { color: '#f5f5f5' },
      },
      rightPriceScale: { borderColor: '#e5e7eb' },
      timeScale: { borderColor: '#e5e7eb', rightOffset: 5 },
    });

    const priceStyle = { upColor: UP_COLOR, downColor: DOWN_COLOR, priceLineVisible: false };
    const bars = chart.addSeries(BarSeries, { ...priceStyle, thinBars: false }, 0);
    const candles = chart.addSeries(
      CandlestickSeries,
      { ...priceStyle, borderUpColor: UP_COLOR, borderDownColor: DOWN_COLOR, wickUpColor: UP_COLOR, wickDownColor: DOWN_COLOR },
      0,
    );

    // The RS line gets its own hidden scale, squeezed into the bottom ~18% of the price pane,
    // so it sits under the price bars instead of on top of them.
    const rs = chart.addSeries(LineSeries, { ...QUIET_LINE, color: COLORS.rs, priceScaleId: 'rs' }, 0);
    rs.priceScale().applyOptions({ scaleMargins: { top: 0.8, bottom: 0.03 } });

    // An invisible line that follows the closes. The drawings attach to it, so they work the
    // same whether bars or candlesticks are showing.
    const anchor = chart.addSeries(LineSeries, { ...QUIET_LINE, lineVisible: false }, 0);
    const drawingsPrimitive = new DrawingsPrimitive();
    anchor.attachPrimitive(drawingsPrimitive);

    const volume = chart.addSeries(
      HistogramSeries,
      { priceFormat: { type: 'volume' }, priceLineVisible: false, lastValueVisible: false },
      1,
    );

    seriesRef.current = {
      bars,
      candles,
      maFast: chart.addSeries(LineSeries, { ...QUIET_LINE, color: COLORS.maFast, lineWidth: 2 }, 0),
      maSlow: chart.addSeries(LineSeries, { ...QUIET_LINE, color: COLORS.maSlow, lineWidth: 2 }, 0),
      ema10: chart.addSeries(LineSeries, { ...QUIET_LINE, color: COLORS.ema10 }, 0),
      ema21: chart.addSeries(LineSeries, { ...QUIET_LINE, color: COLORS.ema21 }, 0),
      high52: chart.addSeries(LineSeries, { ...QUIET_LINE, color: COLORS.high52, lineStyle: LineStyle.Dashed }, 0),
      rs,
      rsDots: createSeriesMarkers(rs, []),
      volume,
      volAvg: chart.addSeries(LineSeries, { ...QUIET_LINE, color: COLORS.volAvg, priceFormat: { type: 'volume' } }, 1),
      anchor,
      drawings: drawingsPrimitive,
    };

    // Split the height roughly 3-to-1 between the price and volume panes.
    const [pricePane, volumePane] = chart.panes();
    pricePane.setStretchFactor(3);
    volumePane.setStretchFactor(1);

    // Hover legend: remember which bar the mouse is over (null = mouse left the chart).
    // Every series shares the same dates, so the crosshair's position number is the bar's index.
    chart.subscribeCrosshairMove((param) => {
      setHoverIndex(param.point && param.logical !== undefined ? Math.round(param.logical) : null);

      // While drawing a trend line, stretch the faded preview from the first click to the mouse.
      const start = pendingTrendRef.current;
      if (start && param.point && param.paneIndex === 0) {
        const end = toAnchor(param.point.x, param.point.y);
        if (end) drawingsPrimitive.update({ draft: { id: 'draft', kind: 'trend', a: start, b: end } });
      }
    });

    // Pixel position in the price pane → the nearest bar's date and the price at that height.
    const toAnchor = (x: number, y: number): Anchor | null => {
      const { bars } = live.current;
      const logical = chart.timeScale().coordinateToLogical(x);
      const price = anchor.coordinateToPrice(y);
      if (logical === null || price === null || bars.length === 0) return null;
      const index = Math.max(0, Math.min(bars.length - 1, Math.round(logical)));
      return { time: bars[index].time, price };
    };

    // Clicks: select a drawing, place a horizontal line, set the pivot, or place trend-line points.
    chart.subscribeClick((param) => {
      if (!param.point || param.paneIndex !== 0) return;
      const { x, y } = param.point;
      const { tool, bars } = live.current;

      if (tool === 'select') {
        live.current.onSelect(drawingsPrimitive.findDrawingAt(x, y));
        return;
      }
      const point = toAnchor(x, y);
      if (!point) return;

      if (tool === 'hline') {
        live.current.onAddDrawing({ id: newDrawingId(), kind: 'hline', price: round2(point.price) });
      } else if (tool === 'pivot') {
        // Snap to the bar's high (+10 cents, IBD style) when the click is close to it.
        const bar = bars[indexAtOrAfter(bars, point.time)];
        const highY = anchor.priceToCoordinate(bar.high);
        const nearHigh = highY !== null && Math.abs(highY - y) <= PIVOT_SNAP_PX;
        live.current.onSetPivot(round2(nearHigh ? bar.high + PIVOT_ADD : point.price));
      } else if (tool === 'trend') {
        const start = pendingTrendRef.current;
        if (!start) {
          pendingTrendRef.current = point;
          drawingsPrimitive.update({ draft: { id: 'draft', kind: 'trend', a: point, b: point } });
        } else {
          pendingTrendRef.current = null;
          drawingsPrimitive.update({ draft: null });
          live.current.onAddDrawing({ id: newDrawingId(), kind: 'trend', a: start, b: point });
        }
      }
    });

    // Measure tool: press, drag, release. (Chart panning is switched off while it's selected.)
    const container = containerRef.current;
    const onPointerDown = (e: PointerEvent) => {
      if (live.current.tool !== 'measure' || e.button !== 0) return;
      const rect = container.getBoundingClientRect();
      const local = (ev: PointerEvent) => ({ x: ev.clientX - rect.left, y: ev.clientY - rect.top });
      const { x, y } = local(e);
      if (y > chart.panes()[0].getHeight() || x > chart.timeScale().width()) return; // price pane only
      const start = toAnchor(x, y);
      if (!start) return;

      let end = start;
      drawingsPrimitive.update({ draft: { id: 'draft', kind: 'measure', a: start, b: end } });
      const onMove = (ev: PointerEvent) => {
        const p = local(ev);
        const next = toAnchor(p.x, p.y);
        if (!next) return;
        end = next;
        drawingsPrimitive.update({ draft: { id: 'draft', kind: 'measure', a: start, b: end } });
      };
      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        drawingsPrimitive.update({ draft: null });
        if (end.time !== start.time || end.price !== start.price) {
          live.current.onAddDrawing({ id: newDrawingId(), kind: 'measure', a: start, b: end });
        }
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    };
    container.addEventListener('pointerdown', onPointerDown, true);

    chartRef.current = chart;
    return () => {
      container.removeEventListener('pointerdown', onPointerDown, true);
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      volumeTargetRef.current = null;
    };
  }, []);

  useEffect(() => {
    live.current = { tool, bars: derived.bars, onAddDrawing, onSelect, onSetPivot };
  });

  // Draw the data whenever a new ticker loads or Daily/Weekly changes, then zoom to the preset.
  useEffect(() => {
    const s = seriesRef.current;
    const chart = chartRef.current;
    if (!s || !chart) return;
    const { bars } = derived;

    s.bars.setData(bars);
    s.candles.setData(bars);
    s.maFast.setData(derived.maFast);
    s.maSlow.setData(derived.maSlow);
    s.ema10.setData(derived.ema10);
    s.ema21.setData(derived.ema21);
    s.high52.setData(derived.high52);
    s.rs.setData(derived.rs);
    s.rsDots.setMarkers(
      derived.rsHighs.map((p) => ({
        time: p.time,
        position: 'atPriceMiddle' as const,
        price: p.value,
        shape: 'circle' as const,
        color: COLORS.rs,
        size: 0.4,
      })),
    );
    s.volume.setData(
      bars.map((b, i) => ({
        time: b.time,
        value: b.volume,
        // Color volume by whether the bar closed up or down vs. the prior close.
        color: i > 0 && b.close < bars[i - 1].close ? `${DOWN_COLOR}99` : `${UP_COLOR}99`,
      })),
    );
    s.volAvg.setData(derived.volAvg);
    s.anchor.setData(closes(bars));

    const last = bars.length - 1;
    chart.timeScale().setVisibleLogicalRange({ from: rangeStartIndex(bars, range), to: last + 5 });
  }, [derived, range]);

  // Show/hide overlays and switch log/linear without redrawing the data or losing your zoom.
  useEffect(() => {
    const s = seriesRef.current;
    const chart = chartRef.current;
    if (!s || !chart) return;

    s.bars.applyOptions({ visible: !indicators.candles });
    s.candles.applyOptions({ visible: indicators.candles });
    s.maFast.applyOptions({ visible: indicators.movingAverages });
    s.maSlow.applyOptions({ visible: indicators.movingAverages });
    s.ema10.applyOptions({ visible: indicators.ema10 && !weekly });
    s.ema21.applyOptions({ visible: indicators.ema21 && !weekly });
    s.high52.applyOptions({ visible: indicators.high52 });
    s.rs.applyOptions({ visible: indicators.rsLine });

    chart.priceScale('right', 0).applyOptions({
      mode: logScale ? PriceScaleMode.Logarithmic : PriceScaleMode.Normal,
      // Leave room at the bottom of the price pane for the RS line when it's showing.
      scaleMargins: { top: 0.08, bottom: indicators.rsLine ? 0.22 : 0.05 },
    });
  }, [indicators, logScale, weekly]);

  // Hand the drawings to the painter whenever they (or the bars underneath) change.
  useEffect(() => {
    seriesRef.current?.drawings.update({ bars: derived.bars, weekly, drawings, selectedId, plan });
  }, [derived, weekly, drawings, selectedId, plan]);

  // Switching tools cancels any half-finished drawing. The measure tool needs click-and-drag,
  // so dragging stops panning the chart while it's selected.
  useEffect(() => {
    pendingTrendRef.current = null;
    seriesRef.current?.drawings.update({ draft: null });
    chartRef.current?.applyOptions({ handleScroll: { pressedMouseMove: tool !== 'measure' } });
  }, [tool]);

  // Trade planner: a dashed "Breakout vol" line in the volume pane at average volume × 1.4.
  useEffect(() => {
    const s = seriesRef.current;
    if (!s) return;
    if (volumeTargetRef.current) {
      s.volume.removePriceLine(volumeTargetRef.current);
      volumeTargetRef.current = null;
    }
    const avg = derived.volAvg[derived.volAvg.length - 1]?.value;
    if (plan.visible && plan.pivot && avg) {
      volumeTargetRef.current = s.volume.createPriceLine({
        price: avg * BREAKOUT_VOLUME_MULTIPLIER,
        color: '#2f9e44',
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: 'Breakout vol',
      });
    }
  }, [plan, derived]);

  // ----- Crosshair legend (top-left): the hovered bar, or the latest bar when not hovering -----
  const { bars } = derived;
  const i = hoverIndex !== null && hoverIndex >= 0 && hoverIndex < bars.length ? hoverIndex : bars.length - 1;
  const bar = bars[i];
  const prevClose = i > 0 ? bars[i - 1].close : null;
  const pct = bar && prevClose ? ((bar.close - prevClose) / prevClose) * 100 : null;

  const lines: { label: string; color: string; value: number | undefined; on: boolean }[] = bar
    ? [
        { label: weekly ? '10-wk' : '50-day', color: COLORS.maFast, value: derived.maFastAt.get(bar.time), on: indicators.movingAverages },
        { label: weekly ? '40-wk' : '200-day', color: COLORS.maSlow, value: derived.maSlowAt.get(bar.time), on: indicators.movingAverages },
        { label: '10 EMA', color: COLORS.ema10, value: derived.ema10At.get(bar.time), on: indicators.ema10 && !weekly },
        { label: '21 EMA', color: COLORS.ema21, value: derived.ema21At.get(bar.time), on: indicators.ema21 && !weekly },
        { label: '52-wk high', color: COLORS.high52, value: derived.high52[0]?.value, on: indicators.high52 },
      ]
    : [];
  const volAvg = bar ? derived.volAvgAt.get(bar.time) : undefined;
  const volVsAvg = bar && volAvg ? Math.round((bar.volume / volAvg - 1) * 100) : null;

  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className={`absolute inset-0 ${tool === 'select' ? '' : 'cursor-crosshair'}`} />

      {bar && (
        <div className="absolute top-1.5 left-2 z-10 pointer-events-none font-mono text-[11px] leading-4 text-gray-700 bg-white/80 rounded px-1">
          <div className="flex flex-wrap gap-x-2.5">
            <span className="text-gray-500">{bar.time}</span>
            <span>O {bar.open.toFixed(2)}</span>
            <span>H {bar.high.toFixed(2)}</span>
            <span>L {bar.low.toFixed(2)}</span>
            <span>C {bar.close.toFixed(2)}</span>
            {pct !== null && (
              <span className={pct >= 0 ? 'text-[#1f3f8f]' : 'text-[#d0312d]'}>
                {pct >= 0 ? '+' : ''}
                {pct.toFixed(2)}%
              </span>
            )}
            <span>
              Vol {formatVolume(bar.volume)}
              {volAvg !== undefined && volVsAvg !== null && (
                <span className="text-gray-500">
                  {' '}
                  (avg {formatVolume(volAvg)}, {volVsAvg >= 0 ? '+' : ''}
                  {volVsAvg}%)
                </span>
              )}
            </span>
          </div>
          <div className="flex flex-wrap gap-x-2.5">
            {lines
              .filter((l) => l.on && l.value !== undefined)
              .map((l) => (
                <span key={l.label} style={{ color: l.color }}>
                  {l.label} {l.value!.toFixed(2)}
                </span>
              ))}
            {indicators.rsLine && derived.rs.length > 0 && (
              <span style={{ color: COLORS.rs }}>RS line ● = new 52-wk high</span>
            )}
            {indicators.rsLine && !spyBars && <span className="text-gray-400">RS line unavailable (SPY didn&apos;t load)</span>}
          </div>
        </div>
      )}
    </div>
  );
}
