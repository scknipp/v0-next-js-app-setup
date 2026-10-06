// Chart math: weekly bars, moving averages, and the Relative Strength (RS) line.
// Pure functions with no drawing code, so the analysis engine (Stage 4) can reuse them.

import type { Bar } from './types';

/** A value at a date. Dates with not enough history yet are simply left out. */
export type Point = { time: string; value: number };

/** Bars per year: about 252 trading days, or 52 weeks. */
export const BARS_PER_YEAR = { daily: 252, weekly: 52 } as const;

/** Monday of the week a date falls in, e.g. "2026-10-02" (a Friday) → "2026-09-28". */
function weekKey(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

/**
 * Combine daily bars into weekly bars (Monday–Friday). Each week is dated by its last
 * trading day (usually Friday; Thursday in a holiday week). The current week is partial.
 */
export function toWeekly(daily: Bar[]): Bar[] {
  const weeks: Bar[] = [];
  let currentKey = '';
  for (const b of daily) {
    const key = weekKey(b.time);
    const w = weeks[weeks.length - 1];
    if (key !== currentKey || !w) {
      weeks.push({ ...b });
      currentKey = key;
    } else {
      w.time = b.time;
      w.high = Math.max(w.high, b.high);
      w.low = Math.min(w.low, b.low);
      w.close = b.close;
      w.volume += b.volume;
    }
  }
  return weeks;
}

/** Simple moving average: the plain average of the last `period` values. */
export function sma(points: Point[], period: number): Point[] {
  const out: Point[] = [];
  let sum = 0;
  points.forEach((p, i) => {
    sum += p.value;
    if (i >= period) sum -= points[i - period].value;
    if (i >= period - 1) out.push({ time: p.time, value: sum / period });
  });
  return out;
}

/** Exponential moving average: like an SMA but recent days count more. Seeded with an SMA. */
export function ema(points: Point[], period: number): Point[] {
  const out: Point[] = [];
  const k = 2 / (period + 1);
  let prev = 0;
  points.forEach((p, i) => {
    if (i < period - 1) {
      prev += p.value;
    } else if (i === period - 1) {
      prev = (prev + p.value) / period;
      out.push({ time: p.time, value: prev });
    } else {
      prev = p.value * k + prev * (1 - k);
      out.push({ time: p.time, value: prev });
    }
  });
  return out;
}

export const closes = (bars: Bar[]): Point[] => bars.map((b) => ({ time: b.time, value: b.close }));
export const volumes = (bars: Bar[]): Point[] => bars.map((b) => ({ time: b.time, value: b.volume }));

/**
 * RS line: the stock's close divided by SPY's close on the same date. A rising line means
 * the stock is beating the market. Only the trend matters, not the actual number.
 */
export function rsLine(stock: Bar[], spy: Bar[]): Point[] {
  const spyClose = new Map(spy.map((b) => [b.time, b.close]));
  const out: Point[] = [];
  for (const b of stock) {
    const s = spyClose.get(b.time);
    if (s) out.push({ time: b.time, value: b.close / s });
  }
  return out;
}

/**
 * Points where the RS line closes above every value of the prior `lookback` bars
 * (a new 52-week high). Skips the first year, when there isn't enough history to judge.
 */
export function newHighs(points: Point[], lookback: number): Point[] {
  const out: Point[] = [];
  for (let i = lookback; i < points.length; i++) {
    let max = -Infinity;
    for (let j = i - lookback; j < i; j++) max = Math.max(max, points[j].value);
    if (points[i].value > max) out.push(points[i]);
  }
  return out;
}

/** Highest high over the last `lookback` bars (for the 52-week-high line). */
export function highestHigh(bars: Bar[], lookback: number): number | null {
  if (bars.length === 0) return null;
  return Math.max(...bars.slice(-lookback).map((b) => b.high));
}
