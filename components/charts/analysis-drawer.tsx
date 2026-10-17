'use client';

// The right-hand drawer opened by the Analyze button. Stage 4 shows the analysis engine's raw facts
// as a debug view, so we can sanity-check the numbers against the chart before the AI coach uses them.

import { useState, type ReactNode } from 'react';
import { Check, Copy, X } from 'lucide-react';
import type { ChartFacts, Confidence } from '@/lib/charts/analyze';

const money = (n: number | null | undefined) => (n == null ? '—' : `$${n.toFixed(2)}`);
const signedPct = (n: number | null | undefined) => (n == null ? '—' : `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`);
const yesNo = (b: boolean | null | undefined) => (b == null ? '—' : b ? 'yes' : 'no');

function shares(v: number): string {
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
  return String(v);
}

export function AnalysisDrawer({
  facts,
  showMarks,
  onShowMarksChange,
  onUsePivot,
  onClose,
}: {
  facts: ChartFacts | null;
  showMarks: boolean;
  onShowMarksChange: (show: boolean) => void;
  onUsePivot: (price: number) => void;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(facts, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard blocked — nothing else to do
    }
  };

  return (
    <aside className="absolute top-0 right-0 bottom-0 z-20 w-[360px] max-w-full flex flex-col bg-white border-l border-gray-200 text-gray-800">
      {/* Header */}
      <div className="shrink-0 flex items-start gap-2 px-3 py-2 border-b border-gray-200 bg-[#0d2747] text-white">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold">
            Chart facts {facts && <span className="font-mono text-[#FFD43B]">{facts.symbol}</span>}
          </div>
          <div className="text-[11px] text-gray-300">
            Debug view · measured by code, no AI yet{facts && ` · as of ${facts.asOf}`}
          </div>
        </div>
        <button
          type="button"
          onClick={copy}
          disabled={!facts}
          title="Copy the raw facts as JSON"
          className="h-7 px-2 flex items-center gap-1 rounded text-xs text-gray-200 hover:bg-white/10"
        >
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? 'Copied' : 'JSON'}
        </button>
        <button type="button" onClick={onClose} title="Close" className="h-7 w-7 flex items-center justify-center rounded hover:bg-white/10">
          <X className="w-4 h-4" />
        </button>
      </div>

      {!facts ? (
        <p className="p-4 text-sm text-gray-500">Not enough price history to analyze this chart.</p>
      ) : (
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3 text-xs">
          <label className="flex items-center gap-1.5 text-gray-600">
            <input type="checkbox" checked={showMarks} onChange={(e) => onShowMarksChange(e.target.checked)} />
            Mark base, handle, and prior low on the chart
          </label>

          {facts.dataNotes.length > 0 && (
            <div className="rounded border border-amber-200 bg-amber-50 p-2 text-amber-800 space-y-1">
              {facts.dataNotes.map((n) => (
                <p key={n}>{n}</p>
              ))}
            </div>
          )}

          <Section title="Price position">
            <Row label="Last price" value={money(facts.price.last)} />
            <Row label="52-week high" value={`${money(facts.price.high52w.price)} on ${facts.price.high52w.date}`} />
            <Row label="52-week low" value={`${money(facts.price.low52w.price)} on ${facts.price.low52w.date}`} />
            <Row label="Off 52-week high" value={signedPct(facts.price.pctOffHigh52w)} />
            <Row label="Above 52-week low" value={signedPct(facts.price.pctAboveLow52w)} />
          </Section>

          <Section title="Moving averages">
            <Row label="50-day" value={`${money(facts.movingAverages.sma50)} · price ${signedPct(facts.movingAverages.priceVsSma50Pct)}`} />
            <Row label="50-day slope (20d)" value={`${signedPct(facts.movingAverages.sma50Slope20dPct)} · ${facts.movingAverages.sma50Trend ?? '—'}`} />
            <Row label="200-day" value={`${money(facts.movingAverages.sma200)} · price ${signedPct(facts.movingAverages.priceVsSma200Pct)}`} />
            <Row label="200-day slope (20d)" value={`${signedPct(facts.movingAverages.sma200Slope20dPct)} · ${facts.movingAverages.sma200Trend ?? '—'}`} />
            <Row label="50-day above 200-day" value={yesNo(facts.movingAverages.sma50AboveSma200)} />
            <Row label="10-day EMA" value={`${money(facts.movingAverages.ema10)} · price ${signedPct(facts.movingAverages.priceVsEma10Pct)}`} />
            <Row label="21-day EMA" value={`${money(facts.movingAverages.ema21)} · price ${signedPct(facts.movingAverages.priceVsEma21Pct)}`} />
          </Section>

          <Section title="Prior uptrend" confidence={facts.priorUptrend?.confidence}>
            {facts.priorUptrend ? (
              <>
                <Row label="From low" value={`${money(facts.priorUptrend.low.price)} on ${facts.priorUptrend.low.date}`} />
                <Row label="To base start" value={`${money(facts.priorUptrend.high.price)} on ${facts.priorUptrend.high.date}`} />
                <Row label="Gain" value={signedPct(facts.priorUptrend.gainPct)} />
              </>
            ) : (
              <Empty>No base found, so no prior uptrend to measure.</Empty>
            )}
          </Section>

          <Section title="Base" confidence={facts.base?.confidence}>
            {facts.base ? (
              <>
                <Row label="Status" value={facts.base.status} />
                <Row label="Start (high)" value={`${money(facts.base.start.price)} on ${facts.base.start.date}`} />
                <Row label="Low" value={`${money(facts.base.low.price)} on ${facts.base.low.date}`} />
                <Row label="Depth" value={`${facts.base.depthPct.toFixed(1)}%`} />
                <Row label="Length" value={`${facts.base.lengthWeeks} weeks`} />
                <Row label="Left side / right side" value={`${facts.base.weeksStartToLow} wks down · ${facts.base.weeksLowToEnd} wks up`} />
                <Row label="Right-side recovery" value={`${facts.base.rightSideRecoveryPct.toFixed(0)}% of the way back`} />
                <Row label="Pattern hints" value={facts.base.patternHints.length ? facts.base.patternHints.join('; ') : 'none'} />
              </>
            ) : (
              <Empty>No correction of 8%+ lasting 3+ weeks in the last 65 weeks.</Empty>
            )}
          </Section>

          <Section title="Handle" confidence={facts.handle?.confidence}>
            {facts.handle ? (
              <>
                <Row label="Start (high)" value={`${money(facts.handle.start.price)} on ${facts.handle.start.date}`} />
                <Row label="Low" value={`${money(facts.handle.low.price)} on ${facts.handle.low.date}`} />
                <Row label="Depth" value={`${facts.handle.depthPct.toFixed(1)}%`} />
                <Row label="Length" value={`${facts.handle.lengthDays} days (${facts.handle.lengthWeeks} wks)`} />
                <Row label="In upper half of base" value={yesNo(facts.handle.inUpperHalfOfBase)} />
                <Row label="Low above 50-day" value={yesNo(facts.handle.aboveSma50AtLow)} />
                <Row label="Drift" value={`${facts.handle.drift} · low on day ${facts.handle.daysToLow} of ${facts.handle.lengthDays}`} />
                <Row label="Volume vs. average" value={signedPct(facts.handle.volumeVsAvgPct)} />
              </>
            ) : (
              <Empty>No handle detected.</Empty>
            )}
          </Section>

          {facts.doubleBottom && (
            <Section title="Double bottom" confidence={facts.doubleBottom.confidence}>
              <Row label="First low" value={`${money(facts.doubleBottom.firstLow.price)} on ${facts.doubleBottom.firstLow.date}`} />
              <Row label="Middle peak" value={`${money(facts.doubleBottom.middlePeak.price)} on ${facts.doubleBottom.middlePeak.date}`} />
              <Row label="Second low" value={`${money(facts.doubleBottom.secondLow.price)} on ${facts.doubleBottom.secondLow.date}`} />
              <Row label="Undercut" value={`${facts.doubleBottom.undercutPct.toFixed(1)}%`} />
            </Section>
          )}

          <Section title="Pivot & buy zone" confidence={facts.pivot?.confidence}>
            {facts.pivot ? (
              <>
                <Row label="Pivot" value={`${money(facts.pivot.price)} (${facts.pivot.source} + 10¢)`} />
                <Row label="Price vs. pivot" value={`${signedPct(facts.pivot.distancePct)} · ${facts.pivot.position}`} />
                <Row
                  label="Breakout"
                  value={
                    facts.pivot.breakout
                      ? `${facts.pivot.breakout.date} (${facts.pivot.breakout.daysAgo} days ago) · volume ${signedPct(facts.pivot.breakout.volumeVsAvgPct)} vs. avg`
                      : 'not yet'
                  }
                />
                <button
                  type="button"
                  onClick={() => onUsePivot(facts.pivot!.price)}
                  className="mt-1 h-7 px-2 rounded border border-gray-300 hover:bg-gray-50 text-[#1f3f8f] font-medium"
                >
                  Use this pivot in the trade planner
                </button>
              </>
            ) : (
              <Empty>No pivot without a base.</Empty>
            )}
          </Section>

          <Section title="Volume">
            <Row label="50-day average" value={shares(facts.volume.avg50)} />
            <Row label="Last day" value={`${shares(facts.volume.last)} · ${signedPct(facts.volume.lastVsAvgPct)} vs. avg`} />
            <Row label="Last 10 days vs. avg" value={signedPct(facts.volume.last10VsAvg50Pct)} />
            <Row label="Up/down volume (50d)" value={facts.volume.upDownVolumeRatio50?.toFixed(2) ?? '—'} />
            <Row label="Breakout target" value={`≥ ${shares(facts.volume.breakoutTarget)} (avg × 1.4)`} />
            {facts.volume.inBase && (
              <>
                <Row label="Accumulation days in base" value={String(facts.volume.inBase.accumulationDays)} />
                <Row label="Distribution days in base" value={String(facts.volume.inBase.distributionDays)} />
                <Row label="Volume near base low" value={`${signedPct(facts.volume.inBase.dryUpNearLowPct)} vs. avg`} />
              </>
            )}
          </Section>

          <Section title="Tightness (weekly closes)">
            <Row label="Tight closes" value={`${facts.tightness.tightWeeklyCloses} of last ${facts.tightness.weeksChecked} weeks (within 1.5%)`} />
            <Row label="Longest tight run" value={facts.tightness.longestTightRunWeeks ? `${facts.tightness.longestTightRunWeeks} weeks tight` : 'none'} />
          </Section>

          <Section title="RS line (vs. SPY)">
            {facts.rs ? (
              <>
                <Row label="At new 52-week high" value={yesNo(facts.rs.atNewHigh)} />
                <Row label="From its 52-week high" value={signedPct(facts.rs.pctFrom52wHigh)} />
                <Row label="13-week change" value={signedPct(facts.rs.change13wPct)} />
                <Row label="vs. price" value={facts.rs.vsPrice} />
              </>
            ) : (
              <Empty>Unavailable (SPY data missing).</Empty>
            )}
          </Section>

          <Section title="Market (SPY)">
            {facts.market ? (
              <>
                <Row label="SPY" value={`${money(facts.market.spyLast)} · ${signedPct(facts.market.pctOffHigh52w)} off high`} />
                <Row label="Above 50-day / 200-day" value={`${yesNo(facts.market.aboveSma50)} / ${yesNo(facts.market.aboveSma200)}`} />
                <Row label="50-day / 200-day trend" value={`${facts.market.sma50Trend ?? '—'} / ${facts.market.sma200Trend ?? '—'}`} />
              </>
            ) : (
              <Empty>Unavailable (SPY data missing).</Empty>
            )}
          </Section>

          <Section title="Base count" confidence={facts.baseCount?.confidence}>
            {facts.baseCount ? (
              <>
                <Row label="Estimate" value={facts.baseCount.label} />
                <p className="text-gray-500">{facts.baseCount.method}</p>
              </>
            ) : (
              <Empty>No base to count.</Empty>
            )}
          </Section>
        </div>
      )}
    </aside>
  );
}

const CONFIDENCE_STYLE: Record<Confidence, string> = {
  high: 'bg-green-100 text-green-800',
  medium: 'bg-amber-100 text-amber-800',
  low: 'bg-gray-100 text-gray-600',
};

function Section({ title, confidence, children }: { title: string; confidence?: Confidence; children: ReactNode }) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-1">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-[#0d2747]">{title}</h3>
        {confidence && <span className={`rounded px-1.5 text-[10px] ${CONFIDENCE_STYLE[confidence]}`}>{confidence} confidence</span>}
      </div>
      <div className="space-y-0.5">{children}</div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="w-36 shrink-0 text-gray-500">{label}</span>
      <span className="min-w-0 font-mono text-[11px]">{value}</span>
    </div>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="text-gray-400">{children}</p>;
}
