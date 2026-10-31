// Shapes for the AI coach (Charts Stage 5). Shared by the server route and the drawer.

import type { Confidence } from './analyze';

/** Current Claude Sonnet, checked in Anthropic's models docs on Oct 28, 2026. */
export const COACH_MODEL = 'claude-sonnet-5-5';

export const VERDICTS = [
  'No base',
  'Base forming — not ready',
  'Near pivot — watch for breakout',
  'Breaking out',
  'Extended — past buy zone',
  'Faulty or risky base',
] as const;
export type Verdict = (typeof VERDICTS)[number];

export type CheckStatus = 'pass' | 'caution' | 'fail';

export const COACH_ANNOTATION_TYPES = [
  'base_start',
  'base_low',
  'handle_start',
  'handle_low',
  'pivot_line',
  'buy_zone',
] as const;
export type CoachAnnotationType = (typeof COACH_ANNOTATION_TYPES)[number];

/** The coach's review, exactly as Claude returns it (field names match the build prompt). */
export type CoachAnalysis = {
  verdict: Verdict;
  pattern: string;
  confidence: Confidence;
  pivot: number | null; // null when there is no clear base
  buy_zone: [number, number] | null; // pivot → pivot + 5%
  suggested_stop: number | null;
  checklist: { item: string; status: CheckStatus; explanation: string }[];
  volume_summary: string;
  market_check: string;
  what_to_watch_next: string;
  lesson: string;
  annotations: { type: CoachAnnotationType; date: string; price: number; label: string }[];
};

/** Tokens used by one analysis, as reported by Anthropic. Output includes the model's thinking. */
export type CoachUsage = {
  inputTokens: number;
  outputTokens: number;
  cacheWriteTokens: number;
  cacheReadTokens: number;
};

/** What /api/analyze-chart sends back to the browser. */
export type CoachResponse = {
  symbol: string;
  asOf: string; // date of the latest bar the coach looked at
  analyzedAt: string; // when the analysis ran (ISO time)
  model: string; // the model that actually answered (a backup model may step in)
  analysis: CoachAnalysis;
  usage: CoachUsage;
  costUsd: number; // what this analysis cost when it ran
  fromCache: boolean; // true = today's saved answer, shown again at no charge
};
