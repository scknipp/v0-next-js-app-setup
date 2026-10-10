'use client';

// The trade planner panel: set (or accept) a pivot, choose a stop %, and see the plan in numbers.
// The chart draws the same plan: shaded buy zone, pivot and stop lines, and a breakout-volume line.

import { useEffect, useState } from 'react';
import { Crosshair, Target } from 'lucide-react';
import {
  BREAKOUT_VOLUME_MULTIPLIER,
  BUY_ZONE_PCT,
  EMPTY_PLAN,
  planLevels,
  type TradePlan,
} from '@/lib/charts/drawings';
import { DropdownButton } from './toolbar-controls';

const money = (n: number) => `$${n.toFixed(2)}`;

function shares(v: number): string {
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
  return String(Math.round(v));
}

export function TradePlanner({
  plan,
  onChange,
  suggestedPivot,
  avgVolume50,
  lastClose,
  onPickOnChart,
}: {
  plan: TradePlan;
  onChange: (plan: TradePlan) => void;
  suggestedPivot: number | null;
  avgVolume50: number | null; // 50-day average daily volume
  lastClose: number | null;
  onPickOnChart: () => void;
}) {
  const [open, setOpen] = useState(false);
  // The pivot box holds text while typing (e.g. "12." is fine mid-typing). It only refreshes when
  // the pivot changes from elsewhere (Pick on chart, Use suggested, another ticker).
  const [pivotText, setPivotText] = useState(plan.pivot?.toFixed(2) ?? '');
  useEffect(() => {
    setPivotText((text) => (parseFloat(text) === plan.pivot ? text : (plan.pivot?.toFixed(2) ?? '')));
  }, [plan.pivot]);

  const levels = plan.pivot ? planLevels(plan.pivot, plan.stopPct) : null;

  // Where today's price sits compared with the plan.
  let status: { text: string; color: string } | null = null;
  if (plan.pivot && levels && lastClose) {
    const pct = ((lastClose - plan.pivot) / plan.pivot) * 100;
    if (lastClose < plan.pivot) status = { text: `${Math.abs(pct).toFixed(1)}% below pivot — not broken out`, color: 'text-gray-600' };
    else if (lastClose <= levels.zoneTop) status = { text: `+${pct.toFixed(1)}% — inside the buy zone`, color: 'text-green-700' };
    else status = { text: `+${pct.toFixed(1)}% — extended past the buy zone`, color: 'text-red-600' };
  }

  return (
    <DropdownButton label="Planner" icon={<Target className="w-3.5 h-3.5" />} open={open} onOpenChange={setOpen} width="w-80">
      <div className="p-3 space-y-3 text-xs">
        <div className="font-semibold text-[#0d2747] text-sm">Trade planner</div>

        {/* Pivot */}
        <div className="space-y-1.5">
          <label className="flex items-center gap-2">
            <span className="w-12 text-gray-600">Pivot</span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={pivotText}
              placeholder="e.g. 245.10"
              onChange={(e) => {
                setPivotText(e.target.value);
                const value = parseFloat(e.target.value);
                if (value > 0) onChange({ ...plan, pivot: value, visible: true });
              }}
              className="w-24 h-7 px-2 rounded border border-gray-300 font-mono focus:outline-none focus:border-[#c9a227]"
            />
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onPickOnChart();
              }}
              className="h-7 px-2 flex items-center gap-1 rounded border border-gray-300 hover:bg-gray-50"
              title="Click a bar's high on the chart to use it (+10 cents) as the pivot"
            >
              <Crosshair className="w-3.5 h-3.5" />
              Pick on chart
            </button>
          </label>
          {suggestedPivot !== null && suggestedPivot !== plan.pivot && (
            <div className="pl-14 text-gray-500">
              Suggested {money(suggestedPivot)}{' '}
              <span className="text-gray-400">(3-month high + 10¢)</span>{' '}
              <button
                type="button"
                onClick={() => onChange({ ...plan, pivot: suggestedPivot, visible: true })}
                className="text-[#1f3f8f] font-medium hover:underline"
              >
                Use
              </button>
            </div>
          )}
        </div>

        {/* Stop % */}
        <label className="flex items-center gap-2">
          <span className="w-12 text-gray-600">Stop</span>
          <input
            type="number"
            step="0.5"
            min="1"
            max="20"
            value={plan.stopPct}
            onChange={(e) => {
              const value = parseFloat(e.target.value);
              if (value >= 1 && value <= 20) onChange({ ...plan, stopPct: value });
            }}
            className="w-16 h-7 px-2 rounded border border-gray-300 font-mono focus:outline-none focus:border-[#c9a227]"
          />
          <span className="text-gray-500">% below pivot (IBD rule: 7–8%)</span>
        </label>

        {/* The plan in numbers */}
        {plan.pivot && levels ? (
          <div className="rounded bg-gray-50 border border-gray-200 p-2 space-y-1 font-mono text-[11px]">
            <Row label="Buy zone" value={`${money(plan.pivot)} – ${money(levels.zoneTop)}`} note={`pivot to +${BUY_ZONE_PCT}%`} color="text-green-700" />
            <Row
              label="Stop"
              value={money(levels.stop)}
              note={`risk ${plan.stopPct.toFixed(1)}% = ${money(plan.pivot - levels.stop)}/share`}
              color="text-red-600"
            />
            {avgVolume50 !== null && (
              <Row
                label="Breakout vol"
                value={`≥ ${shares(avgVolume50 * BREAKOUT_VOLUME_MULTIPLIER)}`}
                note={`50-day avg ${shares(avgVolume50)} × ${BREAKOUT_VOLUME_MULTIPLIER}`}
              />
            )}
            {status && lastClose && <Row label="Now" value={money(lastClose)} note={status.text} color={status.color} />}
          </div>
        ) : (
          <p className="text-gray-500">
            Set a pivot to see the buy zone, stop, and breakout volume target. The pivot is usually the top of the
            base or handle, plus 10 cents.
          </p>
        )}

        {plan.pivot && (
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-1.5 text-gray-700">
              <input
                type="checkbox"
                checked={plan.visible}
                onChange={(e) => onChange({ ...plan, visible: e.target.checked })}
              />
              Show on chart
            </label>
            <button
              type="button"
              onClick={() => onChange({ ...EMPTY_PLAN, stopPct: plan.stopPct })}
              className="text-red-600 hover:underline"
            >
              Remove plan
            </button>
          </div>
        )}
      </div>
    </DropdownButton>
  );
}

function Row({ label, value, note, color = 'text-gray-800' }: { label: string; value: string; note: string; color?: string }) {
  return (
    <div className="flex gap-2">
      <span className="w-20 shrink-0 text-gray-500">{label}</span>
      <span className="min-w-0">
        <span className={color}>{value}</span> <span className="text-gray-400">{note}</span>
      </span>
    </div>
  );
}
