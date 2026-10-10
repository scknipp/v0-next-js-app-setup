// Paints the swing-trading drawings and the trade planner onto the price pane.
// Lightweight Charts has no drawing tools built in; instead it lets us attach a "primitive" —
// our own painting code that it calls every time the chart redraws (zoom, scroll, resize).
// Pattern follows the official plugin examples: https://tradingview.github.io/lightweight-charts/plugin-examples/

import type {
  AutoscaleInfo,
  IChartApiBase,
  IPrimitivePaneRenderer,
  IPrimitivePaneView,
  ISeriesApi,
  ISeriesPrimitive,
  ISeriesPrimitiveAxisView,
  Logical,
  SeriesAttachedParameter,
  SeriesType,
  Time,
} from 'lightweight-charts';
import { BUY_ZONE_PCT, EMPTY_PLAN, indexAtOrAfter, planLevels, type Anchor, type Drawing, type TradePlan } from '@/lib/charts/drawings';
import type { Bar } from '@/lib/charts/types';

type Target = Parameters<IPrimitivePaneRenderer['draw']>[0];
type Ctx = CanvasRenderingContext2D;
type XY = { x: number; y: number };

export type DrawingsState = {
  bars: Bar[]; // the bars currently shown (daily or weekly)
  weekly: boolean;
  drawings: Drawing[];
  selectedId: string | null;
  draft: Drawing | null; // a drawing still being made (shown faded)
  plan: TradePlan;
};

const COLORS = {
  trend: '#0d2747', // navy
  hline: '#6b3410', // brown
  up: '#1f3f8f',
  down: '#d0312d',
  pivot: '#2f9e44',
  zone: 'rgba(47, 158, 68, 0.10)',
  stop: '#d0312d',
};
const HIT_DISTANCE = 5; // how close (in pixels) a click must be to select a drawing
const FONT = '11px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

const fmt = (n: number) => n.toFixed(2);
const signed = (n: number, digits = 1) => `${n >= 0 ? '+' : '−'}${Math.abs(n).toFixed(digits)}`;

/** Text for a measurement: % change and length, e.g. "−18.4% · 35 days (~7 wks)". */
export function measureLabel(a: Anchor, b: Anchor, bars: Bar[], weekly: boolean): string {
  const pct = ((b.price - a.price) / a.price) * 100;
  const n = Math.abs(indexAtOrAfter(bars, b.time) - indexAtOrAfter(bars, a.time));
  const length = weekly ? `${n} week${n === 1 ? '' : 's'}` : `${n} day${n === 1 ? '' : 's'} (~${(n / 5).toFixed(1)} wks)`;
  return `${signed(pct)}% · ${length}`;
}

function distanceToSegment(p: XY, a: XY, b: XY): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;
  const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSq));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** A small white label box with colored text. `align` says which side of x the box sits on. */
function label(ctx: Ctx, text: string, x: number, y: number, color: string, align: 'left' | 'right' = 'left') {
  const width = ctx.measureText(text).width + 8;
  const left = align === 'left' ? x : x - width;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.fillRect(left, y - 8, width, 16);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.setLineDash([]);
  ctx.strokeRect(left + 0.5, y - 7.5, width - 1, 15);
  ctx.fillStyle = color;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText(text, left + 4, y);
}

function line(ctx: Ctx, a: XY, b: XY, color: string, width: number, dash: number[] = []) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.setLineDash(dash);
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  ctx.setLineDash([]);
}

function handle(ctx: Ctx, p: XY, color: string) {
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

export class DrawingsPrimitive implements ISeriesPrimitive<Time> {
  private chart: IChartApiBase<Time> | null = null;
  private series: ISeriesApi<SeriesType, Time> | null = null;
  private requestUpdate: (() => void) | null = null;
  private state: DrawingsState = { bars: [], weekly: false, drawings: [], selectedId: null, draft: null, plan: EMPTY_PLAN };
  private readonly view: IPrimitivePaneView = { renderer: () => ({ draw: (target) => this.draw(target) }) };

  attached({ chart, series, requestUpdate }: SeriesAttachedParameter<Time>) {
    this.chart = chart;
    this.series = series;
    this.requestUpdate = requestUpdate;
  }

  detached() {
    this.chart = null;
    this.series = null;
    this.requestUpdate = null;
  }

  /** Change what's drawn, then ask the chart to repaint. */
  update(patch: Partial<DrawingsState>) {
    this.state = { ...this.state, ...patch };
    this.requestUpdate?.();
  }

  paneViews() {
    return [this.view];
  }

  // Price tags on the right-hand axis for horizontal lines and the planner's pivot and stop.
  priceAxisViews(): ISeriesPrimitiveAxisView[] {
    const tags: { price: number; color: string }[] = [];
    for (const d of this.state.drawings) if (d.kind === 'hline') tags.push({ price: d.price, color: COLORS.hline });
    const { plan } = this.state;
    if (plan.visible && plan.pivot) {
      tags.push({ price: plan.pivot, color: COLORS.pivot });
      tags.push({ price: planLevels(plan.pivot, plan.stopPct).stop, color: COLORS.stop });
    }
    return tags.map(({ price, color }) => ({
      coordinate: () => this.y(price) ?? -100,
      text: () => fmt(price),
      textColor: () => '#ffffff',
      backColor: () => color,
    }));
  }

  // Make sure the whole trade plan (stop to top of buy zone) fits on screen.
  autoscaleInfo(): AutoscaleInfo | null {
    const { plan } = this.state;
    if (!plan.visible || !plan.pivot) return null;
    const { zoneTop, stop } = planLevels(plan.pivot, plan.stopPct);
    return { priceRange: { minValue: stop, maxValue: zoneTop } };
  }

  // ----- Converting between date/price and pixels -----

  private y(price: number): number | null {
    return this.series?.priceToCoordinate(price) ?? null;
  }

  private point(anchor: Anchor): XY | null {
    if (!this.chart) return null;
    const index = indexAtOrAfter(this.state.bars, anchor.time);
    const x = this.chart.timeScale().logicalToCoordinate(index as Logical);
    const y = this.y(anchor.price);
    return x === null || y === null ? null : { x, y };
  }

  /** Which drawing (if any) is under the mouse at pixel (x, y). Topmost wins. */
  findDrawingAt(x: number, y: number): string | null {
    const p = { x, y };
    const { drawings } = this.state;
    for (let i = drawings.length - 1; i >= 0; i--) {
      const d = drawings[i];
      if (d.kind === 'hline') {
        const ly = this.y(d.price);
        if (ly !== null && Math.abs(ly - y) <= HIT_DISTANCE) return d.id;
        continue;
      }
      const a = this.point(d.a);
      const b = this.point(d.b);
      if (!a || !b) continue;
      if (d.kind === 'trend' && distanceToSegment(p, a, b) <= HIT_DISTANCE) return d.id;
      if (
        d.kind === 'measure' &&
        x >= Math.min(a.x, b.x) - HIT_DISTANCE &&
        x <= Math.max(a.x, b.x) + HIT_DISTANCE &&
        y >= Math.min(a.y, b.y) - HIT_DISTANCE &&
        y <= Math.max(a.y, b.y) + HIT_DISTANCE
      ) {
        return d.id;
      }
    }
    return null;
  }

  // ----- Painting (in CSS pixels) -----

  private draw(target: Target) {
    target.useMediaCoordinateSpace(({ context: ctx, mediaSize }) => {
      ctx.save();
      ctx.font = FONT;
      const { drawings, selectedId, draft, plan } = this.state;
      if (plan.visible && plan.pivot) this.drawPlan(ctx, plan.pivot, plan.stopPct, mediaSize.width);
      for (const d of drawings) this.drawOne(ctx, d, d.id === selectedId, mediaSize.width);
      if (draft) {
        ctx.globalAlpha = 0.65;
        this.drawOne(ctx, draft, false, mediaSize.width);
        ctx.globalAlpha = 1;
      }
      ctx.restore();
    });
  }

  private drawPlan(ctx: Ctx, pivot: number, stopPct: number, width: number) {
    const { zoneTop, stop } = planLevels(pivot, stopPct);
    const yPivot = this.y(pivot);
    const yTop = this.y(zoneTop);
    const yStop = this.y(stop);
    if (yPivot === null || yTop === null || yStop === null) return;

    // Shaded buy zone: pivot up to pivot + 5%.
    ctx.fillStyle = COLORS.zone;
    ctx.fillRect(0, yTop, width, yPivot - yTop);
    line(ctx, { x: 0, y: yTop }, { x: width, y: yTop }, COLORS.pivot, 1, [2, 3]);
    line(ctx, { x: 0, y: yPivot }, { x: width, y: yPivot }, COLORS.pivot, 1.5);
    line(ctx, { x: 0, y: yStop }, { x: width, y: yStop }, COLORS.stop, 1.5, [6, 4]);

    const right = width - 6;
    label(ctx, `Pivot ${fmt(pivot)} · buy zone to ${fmt(zoneTop)} (+${BUY_ZONE_PCT}%)`, right, yPivot - 10, COLORS.pivot, 'right');
    label(ctx, `Stop ${fmt(stop)} (−${stopPct.toFixed(1)}% risk from pivot)`, right, yStop + 10, COLORS.stop, 'right');
  }

  private drawOne(ctx: Ctx, d: Drawing, selected: boolean, width: number) {
    if (d.kind === 'hline') {
      const y = this.y(d.price);
      if (y !== null) line(ctx, { x: 0, y }, { x: width, y }, COLORS.hline, selected ? 2.5 : 1.25);
      return;
    }

    const a = this.point(d.a);
    const b = this.point(d.b);
    if (!a || !b) return;

    if (d.kind === 'trend') {
      line(ctx, a, b, COLORS.trend, selected ? 2.5 : 1.5);
      if (selected) {
        handle(ctx, a, COLORS.trend);
        handle(ctx, b, COLORS.trend);
      }
      return;
    }

    // Measure: a shaded box from start to end, a diagonal line, and the result label.
    const color = d.b.price >= d.a.price ? COLORS.up : COLORS.down;
    ctx.fillStyle = d.b.price >= d.a.price ? 'rgba(31, 63, 143, 0.08)' : 'rgba(208, 49, 45, 0.08)';
    ctx.fillRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y));
    ctx.strokeStyle = color;
    ctx.lineWidth = selected ? 2 : 1;
    ctx.setLineDash([3, 3]);
    ctx.strokeRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y));
    line(ctx, a, b, color, 1);

    const text = measureLabel(d.a, d.b, this.state.bars, this.state.weekly);
    const textWidth = ctx.measureText(text).width + 8;
    const goLeft = b.x + 8 + textWidth > width; // flip to the left if it would run off the edge
    label(ctx, text, goLeft ? b.x - 8 : b.x + 8, b.y, color, goLeft ? 'right' : 'left');
  }
}
