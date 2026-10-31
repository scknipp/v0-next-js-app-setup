'use client';

// Keeps the AI coach's review for the ticker on screen (Charts Stage 5).
// Looking up today's saved review is free and happens whenever a ticker loads; asking Claude
// (which costs money) only happens through run(), i.e. when Steve clicks a button.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { CoachResponse } from '@/lib/charts/coach-types';

export type CoachState = {
  result: CoachResponse | null; // the review being shown (today's saved one, or a fresh one)
  status: 'checking' | 'ready' | 'running';
  error: string | null;
  startedAt: number | null; // when the running review began, for the elapsed-time counter
};

const EMPTY: CoachState = { result: null, status: 'ready', error: null, startedAt: null };

export function useCoach(symbol: string | null) {
  const [state, setState] = useState<CoachState>(EMPTY);
  const shownSymbol = useRef(symbol); // which ticker the state belongs to right now
  const inFlight = useRef(new Map<string, number>()); // ticker → start time of a review still running

  // New ticker: show "running" if its review is still on the way; otherwise look for today's saved one.
  useEffect(() => {
    shownSymbol.current = symbol;
    if (!symbol) return;
    const startedAt = inFlight.current.get(symbol);
    if (startedAt) {
      setState({ ...EMPTY, status: 'running', startedAt });
      return;
    }
    let cancelled = false;
    setState({ ...EMPTY, status: 'checking' });
    fetch(`/api/analyze-chart?symbol=${encodeURIComponent(symbol)}`)
      .then((res) => res.json())
      .then((json: { saved?: CoachResponse | null }) => !cancelled && setState({ ...EMPTY, result: json.saved ?? null }))
      .catch(() => !cancelled && setState(EMPTY)); // no saved review shown; the Ask button still works
    return () => {
      cancelled = true;
    };
  }, [symbol]);

  /** Ask Claude for a review. `reanalyze` skips today's saved one and pays for a fresh one. */
  const run = useCallback(
    async (screenshot: string | null, reanalyze: boolean) => {
      if (!symbol || inFlight.current.has(symbol)) return; // never pay twice for the same click
      const startedAt = Date.now();
      inFlight.current.set(symbol, startedAt);
      setState((s) => ({ ...s, status: 'running', error: null, startedAt }));

      let next: Partial<CoachState>;
      try {
        const res = await fetch('/api/analyze-chart', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ symbol, screenshot, reanalyze }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error ?? 'The analysis failed. Try again.');
        next = { result: json as CoachResponse };
      } catch (err) {
        next = {
          error:
            err instanceof TypeError // fetch itself failed
              ? 'Could not reach the dashboard server. Is npm run dev still running?'
              : err instanceof Error
                ? err.message
                : 'The analysis failed. Try again.',
        };
      } finally {
        inFlight.current.delete(symbol);
      }
      // Only update the drawer if Steve is still looking at this ticker (the answer is saved either way).
      if (shownSymbol.current === symbol) setState((s) => ({ ...s, ...next, status: 'ready', startedAt: null }));
    },
    [symbol],
  );

  return { ...state, run };
}
