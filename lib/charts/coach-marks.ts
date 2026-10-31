// Turns the AI coach's review into marks on the chart (Charts Stage 5): labelled gold points
// for the base and handle, and the pivot + buy zone that drawings-primitive.ts paints in gold.

import type { ChartAnnotation } from './analyze';
import type { CoachAnalysis } from './coach-types';

/** Gold, so the coach's marks stand apart from the engine's brown arrows and the planner's green. */
export const COACH_COLOR = '#a16207';

/** The coach's pivot and buy zone. `from` is the date the pivot was set (lines start there); null = full width. */
export type CoachLevels = { pivot: number; zoneTop: number; from: string | null };

const POINT_POSITION = {
  base_start: 'above',
  handle_start: 'above',
  base_low: 'below',
  handle_low: 'below',
} as const;

/** Base start, base low, handle start and handle low as chart markers. */
export function coachPoints(a: CoachAnalysis): ChartAnnotation[] {
  return a.annotations.flatMap((m) =>
    m.type in POINT_POSITION
      ? [{ time: m.date, price: m.price, position: POINT_POSITION[m.type as keyof typeof POINT_POSITION], text: m.label, color: COACH_COLOR }]
      : [],
  );
}

/** The pivot line and buy zone, or null when the coach found no pivot. */
export function coachLevels(a: CoachAnalysis): CoachLevels | null {
  if (a.pivot == null) return null;
  const from = a.annotations.find((m) => m.type === 'pivot_line')?.date ?? a.annotations.find((m) => m.type === 'base_start')?.date ?? null;
  return { pivot: a.pivot, zoneTop: a.buy_zone?.[1] ?? Math.round(a.pivot * 105) / 100, from };
}
