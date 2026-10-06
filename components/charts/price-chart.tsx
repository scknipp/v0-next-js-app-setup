'use client';

// The chart drawing itself, using TradingView Lightweight Charts (open-source, Apache-2.0).
// Price bars sit in the top pane (~75%), volume in the bottom pane (~25%), sharing one date axis.
// The small TradingView logo in the corner is the attribution the license asks for — keep it.

import { useEffect, useRef } from 'react';
import { BarSeries, ColorType, createChart, HistogramSeries, type IChartApi, type ISeriesApi } from 'lightweight-charts';
import type { Bar } from '@/lib/charts/types';

// IBD-style colors: dark blue for up days, red for down days.
const UP_COLOR = '#1f3f8f';
const DOWN_COLOR = '#d0312d';
const BARS_SHOWN_AT_START = 252; // about one year of trading days

export function PriceChart({ bars }: { bars: Bar[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const priceRef = useRef<ISeriesApi<'Bar'> | null>(null);
  const volumeRef = useRef<ISeriesApi<'Histogram'> | null>(null);

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

    priceRef.current = chart.addSeries(BarSeries, {
      upColor: UP_COLOR,
      downColor: DOWN_COLOR,
      thinBars: false,
      priceLineVisible: false,
    }, 0);

    volumeRef.current = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceLineVisible: false,
      lastValueVisible: false,
    }, 1);

    // Split the height roughly 3-to-1 between the price and volume panes.
    const [pricePane, volumePane] = chart.panes();
    pricePane.setStretchFactor(3);
    volumePane.setStretchFactor(1);

    chartRef.current = chart;
    return () => {
      chart.remove();
      chartRef.current = null;
    };
  }, []);

  // Whenever new bars arrive (a new ticker), redraw and zoom to the last year.
  useEffect(() => {
    if (!chartRef.current || !priceRef.current || !volumeRef.current) return;

    priceRef.current.setData(bars);
    volumeRef.current.setData(
      bars.map((b, i) => ({
        time: b.time,
        value: b.volume,
        // Color volume by whether the day closed up or down vs. the prior close.
        color: i > 0 && b.close < bars[i - 1].close ? `${DOWN_COLOR}99` : `${UP_COLOR}99`,
      })),
    );

    const last = bars.length - 1;
    chartRef.current.timeScale().setVisibleLogicalRange({
      from: Math.max(0, last - BARS_SHOWN_AT_START),
      to: last + 5,
    });
  }, [bars]);

  return <div ref={containerRef} className="absolute inset-0" />;
}
