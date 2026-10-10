// Swing-trading drawings and the trade planner: what they are, their math, and saving them.
// Drawings are stored by date + price (not screen pixels), so they stay put when you zoom,
// scroll, or switch between Daily and Weekly.

import type { Bar } from './types';

/** A point on the chart: a bar's date and a price. */
export type Anchor = { time: string; price: number };

export type Drawing =
  | { id: string; kind: 'trend'; a: Anchor; b: Anchor } // trend line between two points
  | { id: string; kind: 'hline'; price: number } // horizontal line (support, resistance, pivot)
  | { id: string; kind: 'measure'; a: Anchor; b: Anchor }; // % change and length between two points

/** The trade planner for one ticker. `pivot` is null until Steve sets one. */
export type TradePlan = {
  pivot: number | null;
  stopPct: number; // how far below the pivot the stop sits, e.g. 7 = 7%
  visible: boolean;
};

/** Which tool the mouse is using. 'select' = normal: click a drawing to select it. */
export type ChartTool = 'select' | 'trend' | 'hline' | 'measure' | 'pivot';

export type TickerDrawings = { drawings: Drawing[]; plan: TradePlan };

// IBD conventions used by the planner.
export const BUY_ZONE_PCT = 5; // buy only up to 5% above the pivot
export const DEFAULT_STOP_PCT = 7; // cut losses 7–8% below your buy
export const BREAKOUT_VOLUME_MULTIPLIER = 1.4; // breakout volume at least 40% above average
export const PIVOT_ADD = 0.1; // IBD adds 10 cents to the high to get the pivot

export const EMPTY_PLAN: TradePlan = { pivot: null, stopPct: DEFAULT_STOP_PCT, visible: true };

/** The prices the planner draws: top of the buy zone and the stop. */
export function planLevels(pivot: number, stopPct: number) {
  return {
    zoneTop: pivot * (1 + BUY_ZONE_PCT / 100),
    stop: pivot * (1 - stopPct / 100),
  };
}

/**
 * A starting pivot to accept or adjust: the highest high of the last ~3 months plus 10 cents.
 * Simple on purpose — the Stage 4 analysis engine will propose a smarter pivot from the base.
 */
export function suggestedPivot(dailyBars: Bar[]): number | null {
  if (dailyBars.length === 0) return null;
  const high = Math.max(...dailyBars.slice(-63).map((b) => b.high));
  return Math.round((high + PIVOT_ADD) * 100) / 100;
}

/**
 * Index of the first bar dated on or after `time`. A daily date therefore maps to the weekly
 * bar of the week it falls in (weekly bars are dated by the week's last trading day).
 */
export function indexAtOrAfter(bars: Bar[], time: string): number {
  let lo = 0;
  let hi = bars.length - 1;
  if (hi < 0) return 0;
  if (time > bars[hi].time) return hi;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (bars[mid].time < time) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

export const newDrawingId = () => Math.random().toString(36).slice(2, 10);

// ----- Saving per ticker in localStorage (wrapped in try/catch: storage can be blocked) -----

const storageKey = (symbol: string) => `tgi-charts-drawings:${symbol}`;

export function loadDrawings(symbol: string): TickerDrawings {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey(symbol)) ?? 'null') as Partial<TickerDrawings> | null;
    return {
      drawings: Array.isArray(saved?.drawings) ? saved.drawings : [],
      plan: { ...EMPTY_PLAN, ...saved?.plan },
    };
  } catch {
    return { drawings: [], plan: EMPTY_PLAN };
  }
}

export function saveDrawings(symbol: string, data: TickerDrawings) {
  try {
    if (data.drawings.length === 0 && data.plan.pivot === null) {
      localStorage.removeItem(storageKey(symbol)); // nothing to remember for this ticker
    } else {
      localStorage.setItem(storageKey(symbol), JSON.stringify(data));
    }
  } catch {
    // ignore: drawings just won't be remembered this time
  }
}
