'use client';

// The chart drawing itself, using TradingView Lightweight Charts (open-source, Apache-2.0).
// Price bars sit in the top pane (~75%), volume in the bottom pane (~25%), sharing one date axis.
// The small TradingView logo in the corner is the attribution the license asks for — keep it.
//
// Stage 2 overlays (IBD-inspired): moving averages, average-volume line, RS line with new-high
// dots, optional EMAs and 52-week-high line, log scale, and a crosshair legend.

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
import type { Bar, ChartSettings, RangePreset } from '@/lib/charts/types';

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
};

export function PriceChart({ bars: dailyBars, spyBars, settings }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<Series | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

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
    };

    // Split the height roughly 3-to-1 between the price and volume panes.
    const [pricePane, volumePane] = chart.panes();
    pricePane.setStretchFactor(3);
    volumePane.setStretchFactor(1);

    // Hover legend: remember which bar the mouse is over (null = mouse left the chart).
    // Every series shares the same dates, so the crosshair's position number is the bar's index.
    chart.subscribeCrosshairMove((param) => {
      setHoverIndex(param.point && param.logical !== undefined ? Math.round(param.logical) : null);
    });

    chartRef.current = chart;
    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

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
      <div ref={containerRef} className="absolute inset-0" />

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
