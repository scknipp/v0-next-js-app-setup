'use client';

// The "AI coach" tab of the analysis drawer (Charts Stage 5): Claude's review of the chart —
// verdict, key levels, checklist, notes, and the lesson — plus what that review cost.

import { useEffect, useState, type ReactNode } from 'react';
import { ChevronRight, Loader2, RefreshCw, Sparkles } from 'lucide-react';
import type { Confidence } from '@/lib/charts/analyze';
import { COACH_MODEL, type CheckStatus, type CoachResponse, type Verdict } from '@/lib/charts/coach-types';
import type { CoachState } from './use-coach';

const money = (n: number | null) => (n == null ? '—' : `$${n.toFixed(2)}`);
const cents = (usd: number) => `${(usd * 100).toFixed(1)}¢`;
const time = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

const VERDICT_STYLE: Record<Verdict, string> = {
  'No base': 'bg-gray-100 text-gray-700 border-gray-300',
  'Base forming — not ready': 'bg-sky-50 text-sky-800 border-sky-200',
  'Near pivot — watch for breakout': 'bg-amber-50 text-amber-800 border-amber-300',
  'Breaking out': 'bg-green-50 text-green-800 border-green-300',
  'Extended — past buy zone': 'bg-orange-50 text-orange-800 border-orange-300',
  'Faulty or risky base': 'bg-red-50 text-red-800 border-red-200',
};

const DOT: Record<CheckStatus, string> = { pass: 'bg-green-500', caution: 'bg-amber-400', fail: 'bg-red-500' };

const CONFIDENCE_STYLE: Record<Confidence, string> = {
  high: 'bg-green-100 text-green-800',
  medium: 'bg-amber-100 text-amber-800',
  low: 'bg-gray-100 text-gray-600',
};

export function CoachPanel({
  coach,
  onRun,
  onUsePivot,
  showMarks,
  onShowMarksChange,
}: {
  coach: CoachState;
  onRun: (reanalyze: boolean) => void;
  onUsePivot: (price: number) => void;
  showMarks: boolean;
  onShowMarksChange: (show: boolean) => void;
}) {
  const { status, result, error, startedAt } = coach;

  if (status === 'checking') {
    return <p className="p-4 text-xs text-gray-400">Checking for today&apos;s review…</p>;
  }

  return (
    <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3 text-xs">
      {status === 'running' && <Running startedAt={startedAt} />}
      {error && <div className="rounded border border-red-200 bg-red-50 p-2 text-red-800">{error}</div>}

      {!result && status !== 'running' && (
        <div className="space-y-2 text-gray-600">
          <p>
            The AI coach (Claude Sonnet 5.5) reviews this chart against IBD base-pattern guidelines and explains what it
            sees, in plain English.
          </p>
          <p className="text-gray-500">Takes about 30–60 seconds. Costs about 7–10¢; viewing it again today is free.</p>
          <button
            type="button"
            onClick={() => onRun(false)}
            className="h-8 px-3 flex items-center gap-1.5 rounded bg-[#c9a227] text-[#0d2747] font-semibold hover:bg-[#FFD43B]"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Ask the coach
          </button>
        </div>
      )}

      {result && (
        <div className={status === 'running' ? 'opacity-50 pointer-events-none' : undefined}>
          <label className="mb-2 flex items-center gap-1.5 text-gray-600">
            <input type="checkbox" checked={showMarks} onChange={(e) => onShowMarksChange(e.target.checked)} />
            Show the coach&apos;s marks on the chart <span className="text-[#a16207]">(gold)</span>
          </label>
          <Review result={result} onUsePivot={onUsePivot} />
          <CostFooter result={result} running={status === 'running'} onReanalyze={() => onRun(true)} />
        </div>
      )}

      <p className="pt-1 border-t border-gray-100 text-[11px] text-gray-400">
        Educational analysis by AI — it can be wrong. Not financial advice.
      </p>
    </div>
  );
}

/** "Coach is reviewing the chart…" with a seconds counter, since a review takes a while. */
function Running({ startedAt }: { startedAt: number | null }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const seconds = startedAt ? Math.max(0, Math.round((now - startedAt) / 1000)) : 0;
  return (
    <div className="flex items-center gap-2 rounded border border-[#c9a227]/40 bg-[#fffbea] p-2 text-[#6b3410]">
      <Loader2 className="w-4 h-4 shrink-0 animate-spin" />
      <span>
        Coach is reviewing the chart… <span className="font-mono">{seconds}s</span>
        <span className="block text-[11px] text-[#6b3410]/70">Usually 30–60 seconds. You can keep using the chart.</span>
      </span>
    </div>
  );
}

function Review({ result, onUsePivot }: { result: CoachResponse; onUsePivot: (price: number) => void }) {
  const a = result.analysis;
  return (
    <div className="space-y-3">
      {/* Verdict */}
      <div>
        <div className={`rounded border px-2 py-1.5 text-sm font-semibold ${VERDICT_STYLE[a.verdict] ?? VERDICT_STYLE['No base']}`}>
          {a.verdict}
        </div>
        <div className="mt-1 flex items-center gap-2 text-gray-600">
          <span className="min-w-0">Pattern: {a.pattern}</span>
          <span className={`shrink-0 rounded px-1.5 text-[10px] ${CONFIDENCE_STYLE[a.confidence]}`}>{a.confidence} confidence</span>
        </div>
      </div>

      {/* Key levels */}
      {a.pivot != null && (
        <div className="rounded border border-gray-200 p-2 space-y-0.5">
          <Level label="Pivot (buy point)" value={money(a.pivot)} />
          <Level label="Buy zone" value={a.buy_zone ? `${money(a.buy_zone[0])} – ${money(a.buy_zone[1])}` : '—'} />
          <Level label="Suggested stop" value={money(a.suggested_stop)} />
          <button
            type="button"
            onClick={() => onUsePivot(a.pivot!)}
            className="mt-1 h-7 px-2 rounded border border-gray-300 hover:bg-gray-50 text-[#1f3f8f] font-medium"
          >
            Use this pivot in the trade planner
          </button>
        </div>
      )}

      {/* Checklist: click a line to read why */}
      <Section title="Checklist">
        <ul className="space-y-0.5">
          {a.checklist.map((c) => (
            <li key={c.item}>
              <details className="group">
                <summary className="flex items-center gap-2 cursor-pointer list-none rounded px-1 py-0.5 hover:bg-gray-50">
                  <span className={`w-2.5 h-2.5 shrink-0 rounded-full ${DOT[c.status] ?? 'bg-gray-300'}`} title={c.status} />
                  <span className="flex-1">{c.item}</span>
                  <ChevronRight className="w-3.5 h-3.5 text-gray-400 transition-transform group-open:rotate-90" />
                </summary>
                <p className="ml-5 mr-1 mb-1 text-gray-600 leading-relaxed">{c.explanation}</p>
              </details>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Volume">
        <Prose>{a.volume_summary}</Prose>
      </Section>
      <Section title="Market check">
        <Prose>{a.market_check}</Prose>
      </Section>
      <Section title="What to watch next">
        <Prose>{a.what_to_watch_next}</Prose>
      </Section>

      <div className="rounded border border-[#c9a227]/50 bg-[#fffbea] p-2">
        <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[#6b3410]">Lesson</h3>
        <Prose>{a.lesson}</Prose>
      </div>
    </div>
  );
}

/** What this review cost, when it ran, and the Re-analyze button. */
function CostFooter({ result, running, onReanalyze }: { result: CoachResponse; running: boolean; onReanalyze: () => void }) {
  const u = result.usage;
  return (
    <div className="mt-3 rounded bg-gray-50 p-2 space-y-1 text-[11px] text-gray-500">
      {result.fromCache ? (
        <p>
          <span className="font-medium text-gray-700">Saved from earlier today ({time(result.analyzedAt)}) — no charge to view.</span>{' '}
          It cost <span className="font-mono">{cents(result.costUsd)}</span> when it ran.
        </p>
      ) : (
        <p>
          <span className="font-medium text-gray-700">
            This review cost <span className="font-mono">{cents(result.costUsd)}</span>
          </span>{' '}
          · {time(result.analyzedAt)}
        </p>
      )}
      <p className="font-mono">
        {u.inputTokens.toLocaleString()} tokens in · {u.outputTokens.toLocaleString()} out (incl. thinking) · data to {result.asOf}
      </p>
      {result.model !== COACH_MODEL && <p>Answered by backup model {result.model}.</p>}
      <button
        type="button"
        onClick={onReanalyze}
        disabled={running}
        className="h-7 px-2 flex items-center gap-1.5 rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-100 disabled:opacity-50"
        title="Ask the coach for a fresh review (replaces today's saved one)"
      >
        <RefreshCw className="w-3.5 h-3.5" />
        Re-analyze (~7–10¢)
      </button>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[#0d2747]">{title}</h3>
      {children}
    </section>
  );
}

function Level({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="w-32 shrink-0 text-gray-500">{label}</span>
      <span className="font-mono text-[11px]">{value}</span>
    </div>
  );
}

const Prose = ({ children }: { children: ReactNode }) => <p className="text-gray-700 leading-relaxed">{children}</p>;
