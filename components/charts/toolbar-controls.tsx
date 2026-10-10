'use client';

// Small building blocks for the Charts toolbar: button groups, toggle buttons, drop-down panels,
// and the Indicators menu.

import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import type { IndicatorToggles } from '@/lib/charts/types';

export function ButtonGroup({ children }: { children: ReactNode }) {
  return <div className="flex h-7 rounded border border-[#1e4060] overflow-hidden">{children}</div>;
}

export function ToolbarButton({
  active = false,
  disabled = false,
  onClick,
  title,
  children,
}: {
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  title?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      aria-pressed={active}
      disabled={disabled}
      className={`px-2.5 flex items-center text-xs font-medium transition-colors disabled:opacity-40 disabled:pointer-events-none ${
        active ? 'bg-[#c9a227] text-[#0d2747]' : 'bg-[#061528] text-gray-300 hover:text-white hover:bg-[#123056]'
      }`}
    >
      {children}
    </button>
  );
}

/** Close a drop-down when clicking anywhere outside it, or pressing Escape. */
export function useDismiss(ref: RefObject<HTMLElement | null>, open: boolean, close: () => void) {
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [ref, open, close]);
}

/** A toolbar button that opens a white panel underneath it. */
export function DropdownButton({
  label,
  icon,
  open,
  onOpenChange,
  width = 'w-64',
  children,
}: {
  label: string;
  icon?: ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  width?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(ref, open, () => onOpenChange(false));

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        aria-expanded={open}
        className={`h-7 px-2.5 flex items-center gap-1 rounded border border-[#1e4060] text-xs font-medium ${
          open ? 'bg-[#123056] text-white' : 'bg-[#061528] text-gray-300 hover:text-white hover:bg-[#123056]'
        }`}
      >
        {icon}
        {label}
        <ChevronDown className="w-3.5 h-3.5" />
      </button>

      {open && (
        <div className={`absolute right-0 top-8 z-30 ${width} rounded border border-gray-200 bg-white shadow-lg text-gray-800`}>
          {children}
        </div>
      )}
    </div>
  );
}

const INDICATOR_ITEMS: { key: keyof IndicatorToggles; label: string; weeklyLabel?: string; dailyOnly?: boolean }[] = [
  { key: 'movingAverages', label: '50 & 200-day moving averages', weeklyLabel: '10 & 40-week moving averages' },
  { key: 'rsLine', label: 'RS line (vs. SPY)' },
  { key: 'ema10', label: '10-day EMA', dailyOnly: true },
  { key: 'ema21', label: '21-day EMA', dailyOnly: true },
  { key: 'high52', label: '52-week-high line' },
  { key: 'candles', label: 'Candlesticks instead of bars' },
];

export function IndicatorsMenu({
  indicators,
  weekly,
  onToggle,
}: {
  indicators: IndicatorToggles;
  weekly: boolean;
  onToggle: (key: keyof IndicatorToggles) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <DropdownButton label="Indicators" open={open} onOpenChange={setOpen}>
      <div className="py-1">
        {INDICATOR_ITEMS.map((item) => {
          const disabled = item.dailyOnly && weekly;
          return (
            <button
              key={item.key}
              type="button"
              disabled={disabled}
              onClick={() => onToggle(item.key)}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-gray-50 disabled:text-gray-400 disabled:hover:bg-transparent"
            >
              <span
                className={`w-3.5 h-3.5 shrink-0 rounded-sm border flex items-center justify-center ${
                  indicators[item.key] ? 'bg-[#0d2747] border-[#0d2747]' : 'border-gray-300'
                }`}
              >
                {indicators[item.key] && <Check className="w-3 h-3 text-white" />}
              </span>
              {weekly && item.weeklyLabel ? item.weeklyLabel : item.label}
              {disabled && <span className="ml-auto text-[10px]">daily only</span>}
            </button>
          );
        })}
      </div>
    </DropdownButton>
  );
}
