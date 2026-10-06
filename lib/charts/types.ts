// Shared shapes for the Charts page. Used by both the server route and the browser.

/** One daily price bar. `time` is a plain date string like "2026-09-30". */
export type Bar = {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

/** What /api/prices sends back to the browser. */
export type PriceHistory = {
  symbol: string;
  name: string;
  bars: Bar[];
};

/** Daily or weekly bars. */
export type Interval = 'daily' | 'weekly';

/** Timeframe presets: how much history the chart shows when it opens. */
export type RangePreset = '6M' | '1Y' | '2Y' | '5Y';

/** Overlays Steve can turn on and off in the Indicators menu. */
export type IndicatorToggles = {
  movingAverages: boolean; // 50/200-day (daily) or 10/40-week (weekly)
  rsLine: boolean;
  ema10: boolean; // daily chart only
  ema21: boolean; // daily chart only
  high52: boolean;
  candles: boolean; // candlesticks instead of OHLC bars
};

/** Everything about the chart's look that the page remembers between visits. */
export type ChartSettings = {
  interval: Interval;
  range: RangePreset;
  logScale: boolean;
  indicators: IndicatorToggles;
};
