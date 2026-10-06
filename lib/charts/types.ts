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
