// The analysis engine: turns price history into plain facts about the chart, the way an IBD /
// CAN SLIM reader would measure it. The AI coach (Stage 5) receives these facts, so the AI never
// has to do arithmetic. Detection rules are deliberately simple and commented; they will sometimes
// be wrong, which is why every pattern gets a confidence label and the AI double-checks the shape.
//
// Conventions: bars are daily unless a name says weekly. "Weeks" of a base = trading days ÷ 5.

import { rsLine } from './indicators';
import type { Bar } from './types';

export type Confidence = 'high' | 'medium' | 'low';
export type Trend = 'rising' | 'flat' | 'falling';
export type DatedPrice = { date: string; price: number };

export type ChartFacts = {
  symbol: string;
  asOf: string; // date of the latest bar
  dataNotes: string[]; // anything that limits the analysis (short history, SPY missing…)

  price: {
    last: number;
    high52w: DatedPrice;
    low52w: DatedPrice;
    pctOffHigh52w: number; // negative = below the high
    pctAboveLow52w: number;
  };

  movingAverages: {
    sma50: number | null;
    sma200: number | null;
    ema10: number | null;
    ema21: number | null;
    priceVsSma50Pct: number | null; // + = price above the line
    priceVsSma200Pct: number | null;
    priceVsEma10Pct: number | null;
    priceVsEma21Pct: number | null;
    sma50Slope20dPct: number | null; // how much the line moved over the last 20 days
    sma50Trend: Trend | null;
    sma200Slope20dPct: number | null;
    sma200Trend: Trend | null;
    sma50AboveSma200: boolean | null;
  };

  priorUptrend: { low: DatedPrice; high: DatedPrice; gainPct: number; confidence: Confidence } | null;

  base: {
    start: DatedPrice; // the high where the base began
    low: DatedPrice;
    depthPct: number;
    lengthWeeks: number; // start → breakout, or start → today if still forming
    weeksStartToLow: number; // left side
    weeksLowToEnd: number; // right side
    rightSideRecoveryPct: number; // how far price has climbed back from the low toward the start (100 = fully)
    status: 'forming' | 'broken out';
    patternHints: string[];
    confidence: Confidence;
  } | null;

  handle: {
    start: DatedPrice; // the right-side high where the handle began
    low: DatedPrice;
    depthPct: number;
    lengthDays: number;
    lengthWeeks: number;
    daysToLow: number; // how far into the handle its low came (late = drifted down; early then rising lows = wedging)
    inUpperHalfOfBase: boolean;
    aboveSma50AtLow: boolean | null; // the 50-day ≈ the 10-week line
    drift: 'drifting down' | 'sideways' | 'wedging up';
    volumeVsAvgPct: number | null; // average handle volume vs. the 50-day average (− = drying up)
    confidence: Confidence;
  } | null;

  doubleBottom: {
    firstLow: DatedPrice;
    middlePeak: DatedPrice;
    secondLow: DatedPrice;
    undercutPct: number; // how far the second low dips below the first
    confidence: Confidence;
  } | null;

  pivot: {
    price: number;
    source: 'handle high' | 'double-bottom middle peak' | 'base high';
    distancePct: number; // last price vs. pivot (+ = above)
    position: 'below pivot' | 'in buy zone' | 'extended past buy zone';
    breakout: { date: string; daysAgo: number; volumeVsAvgPct: number | null } | null;
    confidence: Confidence;
  } | null;

  volume: {
    avg50: number;
    last: number;
    lastVsAvgPct: number;
    last10VsAvg50Pct: number;
    upDownVolumeRatio50: number | null; // > 1 = more volume on up days (accumulation)
    breakoutTarget: number; // 50-day average × 1.4
    inBase: {
      accumulationDays: number; // up days on above-average volume
      distributionDays: number; // down days on above-average volume
      dryUpNearLowPct: number | null; // volume around the base low vs. average (− = drying up)
    } | null;
  };

  tightness: {
    weeksChecked: number;
    tightWeeklyCloses: number; // weekly closes within 1.5% of the prior week's close
    longestTightRunWeeks: number; // e.g. 3 = "3 weeks tight"
  };

  rs: {
    last: number;
    atNewHigh: boolean;
    pctFrom52wHigh: number;
    nearNewHigh: boolean; // within 3% of its 52-week high
    change13wPct: number | null;
    vsPrice: 'leading' | 'in line' | 'lagging';
  } | null;

  market: {
    spyLast: number;
    aboveSma50: boolean | null;
    aboveSma200: boolean | null;
    sma50Trend: Trend | null;
    sma200Trend: Trend | null;
    pctOffHigh52w: number;
  } | null;

  baseCount: { estimate: number; label: string; confidence: 'low'; method: string } | null;
};

// ----- Tunable rules -----
const YEAR = 252; // trading days in a year
const BASE_LOOKBACK = 325; // 65 weeks: the longest base we look for
const MIN_BASE_DEPTH = 8; // % — shallower dips are pullbacks, not bases
const MIN_BASE_DAYS = 15; // 3 weeks — shorter dips are pullbacks, not bases
const PRIOR_UPTREND_LOOKBACK = 150; // ~7 months before the base
const STAGE_RESET_DEPTH = 40; // a correction deeper than this starts a new base count
const TIGHT_PCT = 1.5;
const PIVOT_ADD = 0.1;

// ----- Small helpers -----
const r1 = (n: number) => Math.round(n * 10) / 10;
const r2 = (n: number) => Math.round(n * 100) / 100;
const pct = (now: number, then: number) => ((now - then) / then) * 100;
const weeks = (days: number) => r1(days / 5);
const highAt = (bars: Bar[], i: number): DatedPrice => ({ date: bars[i].time, price: r2(bars[i].high) });
const lowAt = (bars: Bar[], i: number): DatedPrice => ({ date: bars[i].time, price: r2(bars[i].low) });

/** Moving average aligned to the bars: out[i] is the average ending at bar i (null until enough bars). */
function rollingMean(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = [];
  let sum = 0;
  values.forEach((v, i) => {
    sum += v;
    if (i >= period) sum -= values[i - period];
    out.push(i >= period - 1 ? sum / period : null);
  });
  return out;
}

function emaLast(values: number[], period: number): number | null {
  if (values.length < period) return null;
  let e = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  const k = 2 / (period + 1);
  for (let i = period; i < values.length; i++) e = values[i] * k + e * (1 - k);
  return e;
}

/** Index of the min low / max high in bars[from..to] (inclusive). */
function argMinLow(bars: Bar[], from: number, to: number): number {
  let best = -1;
  for (let i = Math.max(0, from); i <= to; i++) if (best < 0 || bars[i].low < bars[best].low) best = i;
  return best;
}
function argMaxHigh(bars: Bar[], from: number, to: number): number {
  let best = -1;
  for (let i = Math.max(0, from); i <= to; i++) if (best < 0 || bars[i].high > bars[best].high) best = i;
  return best;
}

/** Slope of a line over its last 20 days, as a % change, plus a plain label. */
function slope20(line: (number | null)[]): { pct: number | null; trend: Trend | null } {
  const last = line[line.length - 1];
  const before = line[line.length - 21];
  if (last == null || before == null) return { pct: null, trend: null };
  const p = pct(last, before);
  return { pct: r2(p), trend: p > 0.3 ? 'rising' : p < -0.3 ? 'falling' : 'flat' };
}

/** Least-squares slope of values, as % of their average per bar. */
function slopePctPerBar(values: number[]): number {
  const n = values.length;
  if (n < 2) return 0;
  const meanX = (n - 1) / 2;
  const meanY = values.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  values.forEach((y, x) => {
    num += (x - meanX) * (y - meanY);
    den += (x - meanX) ** 2;
  });
  return (num / den / meanY) * 100;
}

// ----- Base detection -----
//
// A base starts at a high (the "start") followed by a correction. It ends when price trades above
// that high again (a breakout), or is still forming today. For every bar we find `nextHigher[i]`:
// the first later bar whose high beats bar i's high. Between the two lies bar i's correction.

type Span = { start: number; end: number; lowIdx: number; depthPct: number; lengthDays: number };

/** For each bar, the index of the next bar with a higher high (bars.length if none yet). */
function nextHigherHighs(bars: Bar[]): number[] {
  const out = new Array<number>(bars.length).fill(bars.length);
  const stack: number[] = [];
  bars.forEach((b, j) => {
    while (stack.length && b.high > bars[stack[stack.length - 1]].high) out[stack.pop()!] = j;
    stack.push(j);
  });
  return out;
}

function spanFrom(bars: Bar[], next: number[], i: number): Span | null {
  const end = next[i]; // breakout bar, or bars.length if still forming
  const lastInside = Math.min(end, bars.length) - 1;
  if (lastInside <= i) return null;
  const lowIdx = argMinLow(bars, i + 1, lastInside);
  return {
    start: i,
    end,
    lowIdx,
    depthPct: -pct(bars[lowIdx].low, bars[i].high),
    lengthDays: (end < bars.length ? end : bars.length - 1) - i,
  };
}

const qualifies = (s: Span | null): s is Span => !!s && s.depthPct >= MIN_BASE_DEPTH && s.lengthDays >= MIN_BASE_DAYS;

/**
 * The most recent base whose start lies in [from, to) and which ended by `maxEnd`.
 * 1) Take the most recent high that began a qualifying correction.
 * 2) If that high sits inside a bigger, earlier correction (e.g. it's a handle or a bounce
 *    within the cup), widen out to the earlier, higher start.
 */
function findBase(bars: Bar[], next: number[], from: number, to: number, maxEnd: number): Span | null {
  let best: Span | null = null;
  for (let i = to - 1; i >= from && !best; i--) {
    const s = spanFrom(bars, next, i);
    if (qualifies(s) && s.end <= maxEnd) best = s;
  }
  if (!best) return null;
  for (let j = best.start - 1; j >= from; j--) {
    if (next[j] > best.start && next[j] <= maxEnd) {
      const s = spanFrom(bars, next, j);
      if (qualifies(s)) best = s;
    }
  }
  return best;
}

/** Count earlier bases in this run-up. Resets at a very deep correction or when a base undercuts the one before. */
function estimateBaseCount(bars: Bar[], next: number[], current: Span): ChartFacts['baseCount'] {
  let count = 1;
  if (current.depthPct <= STAGE_RESET_DEPTH) {
    let later = current;
    while (count < 6) {
      const prior = findBase(bars, next, 0, later.start, later.start);
      if (!prior || prior.depthPct > STAGE_RESET_DEPTH) break;
      if (bars[later.lowIdx].low < bars[prior.lowIdx].low) break; // the later base undercut this one: count resets
      count++;
      later = prior;
    }
  }
  const label = count === 1 ? '1st stage' : count === 2 ? '2nd stage' : count === 3 ? '3rd stage' : `${count}th stage (late)`;
  return {
    estimate: count,
    label,
    confidence: 'low',
    method: `Counted bases back to the last correction deeper than ${STAGE_RESET_DEPTH}% or the last undercut of a prior base low.`,
  };
}

// ----- The main function -----

export function analyzeChart(symbol: string, daily: Bar[], weekly: Bar[], spy: Bar[] | null): ChartFacts | null {
  const n = daily.length;
  if (n < 30) return null; // not enough history to say anything useful

  const dataNotes: string[] = [];
  if (n < YEAR) dataNotes.push(`Only ${n} trading days of history (less than a year) — long-term measures are limited.`);
  if (!spy) dataNotes.push('SPY data missing — RS line and market check are unavailable.');

  const last = daily[n - 1];
  const closeArr = daily.map((b) => b.close);
  const volArr = daily.map((b) => b.volume);
  const sma50 = rollingMean(closeArr, 50);
  const sma200 = rollingMean(closeArr, 200);
  const avgVol50 = rollingMean(volArr, 50);

  // ----- Price position -----
  const yearStart = Math.max(0, n - YEAR);
  const hi52 = argMaxHigh(daily, yearStart, n - 1);
  const lo52 = argMinLow(daily, yearStart, n - 1);
  const price: ChartFacts['price'] = {
    last: r2(last.close),
    high52w: highAt(daily, hi52),
    low52w: lowAt(daily, lo52),
    pctOffHigh52w: r1(pct(last.close, daily[hi52].high)),
    pctAboveLow52w: r1(pct(last.close, daily[lo52].low)),
  };

  // ----- Moving averages -----
  const s50 = sma50[n - 1];
  const s200 = sma200[n - 1];
  const e10 = emaLast(closeArr, 10);
  const e21 = emaLast(closeArr, 21);
  const vs = (line: number | null) => (line == null ? null : r1(pct(last.close, line)));
  const slope50 = slope20(sma50);
  const slope200 = slope20(sma200);
  const movingAverages: ChartFacts['movingAverages'] = {
    sma50: s50 == null ? null : r2(s50),
    sma200: s200 == null ? null : r2(s200),
    ema10: e10 == null ? null : r2(e10),
    ema21: e21 == null ? null : r2(e21),
    priceVsSma50Pct: vs(s50),
    priceVsSma200Pct: vs(s200),
    priceVsEma10Pct: vs(e10),
    priceVsEma21Pct: vs(e21),
    sma50Slope20dPct: slope50.pct,
    sma50Trend: slope50.trend,
    sma200Slope20dPct: slope200.pct,
    sma200Trend: slope200.trend,
    sma50AboveSma200: s50 != null && s200 != null ? s50 > s200 : null,
  };

  // ----- Base -----
  const next = nextHigherHighs(daily);
  const span = findBase(daily, next, Math.max(0, n - 1 - BASE_LOOKBACK), n, n);
  if (span && span.start <= n - 1 - BASE_LOOKBACK + 5) {
    dataNotes.push('The correction began near the 65-week search limit — this may be a long downtrend rather than a base.');
  }

  // ----- Prior uptrend: from the lowest low in the ~7 months before the base up to the base start -----
  let priorUptrend: ChartFacts['priorUptrend'] = null;
  if (span && span.start > 10) {
    const lowIdx = argMinLow(daily, span.start - PRIOR_UPTREND_LOOKBACK, span.start - 1);
    const gain = pct(daily[span.start].high, daily[lowIdx].low);
    priorUptrend = {
      low: lowAt(daily, lowIdx),
      high: highAt(daily, span.start),
      gainPct: r1(gain),
      confidence: span.start >= PRIOR_UPTREND_LOOKBACK ? 'medium' : 'low',
    };
  }

  let base: ChartFacts['base'] = null;
  let handle: ChartFacts['handle'] = null;
  let doubleBottom: ChartFacts['doubleBottom'] = null;
  let pivot: ChartFacts['pivot'] = null;
  let inBase: ChartFacts['volume']['inBase'] = null;
  let baseCount: ChartFacts['baseCount'] = null;

  if (span) {
    const s = span.start;
    const lastInside = Math.min(span.end, n) - 1; // last bar inside the base
    const baseHigh = daily[s].high;
    const baseLow = daily[span.lowIdx].low;
    const lengthWeeks = weeks(span.lengthDays);

    // ----- Handle: a pullback from the highest point on the right side, in the last part of the base -----
    const rightHigh = argMaxHigh(daily, span.lowIdx + 1, lastInside);
    let handleHighIdx = -1;
    if (rightHigh >= 0 && lastInside - rightHigh >= 5) {
      const hLow = argMinLow(daily, rightHigh + 1, lastInside);
      const depth = -pct(daily[hLow].low, daily[rightHigh].high);
      const midpoint = baseLow + (baseHigh - baseLow) / 2;
      // Only call it a handle if the right side climbed into the upper half first; otherwise it's a bounce mid-base.
      if (depth >= 1.5 && depth <= 20 && daily[rightHigh].high >= midpoint) {
        const lengthDays = lastInside - rightHigh;
        const lowsSlope = slopePctPerBar(daily.slice(rightHigh, lastInside + 1).map((b) => b.low));
        const handleVol = volArr.slice(rightHigh + 1, lastInside + 1);
        const avgAtStart = avgVol50[rightHigh];
        const inUpperHalf = daily[hLow].low >= midpoint;
        const sma50AtLow = sma50[hLow];
        const aboveSma50AtLow = sma50AtLow == null ? null : daily[hLow].low >= sma50AtLow;
        const ideal = lengthDays >= 5 && lengthDays <= 25 && depth <= 12 && inUpperHalf && aboveSma50AtLow !== false;
        handle = {
          start: highAt(daily, rightHigh),
          low: lowAt(daily, hLow),
          depthPct: r1(depth),
          lengthDays,
          lengthWeeks: weeks(lengthDays),
          daysToLow: hLow - rightHigh,
          inUpperHalfOfBase: inUpperHalf,
          aboveSma50AtLow,
          drift: lowsSlope > 0.1 ? 'wedging up' : lowsSlope < -0.1 ? 'drifting down' : 'sideways',
          volumeVsAvgPct:
            avgAtStart && handleVol.length
              ? r1(pct(handleVol.reduce((a, b) => a + b, 0) / handleVol.length, avgAtStart))
              : null,
          // A handle in the lower half of the base is a known flaw, so it can't rate above "low".
          confidence: ideal ? 'high' : depth <= 15 && lengthDays <= 40 && inUpperHalf ? 'medium' : 'low',
        };
        handleHighIdx = rightHigh;
      }
    }

    // ----- Double bottom: first low, a middle peak, then a second low that undercuts the first -----
    const firstLow = argMinLow(daily, s + 1, span.lowIdx - 10); // at least 2 weeks before the second low
    if (firstLow > s) {
      const middle = argMaxHigh(daily, firstLow + 1, span.lowIdx - 1);
      const undercut = -pct(baseLow, daily[firstLow].low);
      const rally = pct(daily[middle].high, daily[firstLow].low);
      if (middle > firstLow + 4 && span.lowIdx > middle + 4 && undercut > 0 && undercut <= 10 && rally >= 8) {
        doubleBottom = {
          firstLow: lowAt(daily, firstLow),
          middlePeak: highAt(daily, middle),
          secondLow: lowAt(daily, span.lowIdx),
          undercutPct: r1(undercut),
          confidence: lengthWeeks >= 7 && undercut <= 5 ? 'medium' : 'low',
        };
      }
    }

    // ----- Pattern hints (the AI makes the final call) -----
    const hints: string[] = [];
    if (span.depthPct <= 15 && lengthWeeks >= 5) {
      hints.push(handle && span.depthPct >= 12 && lengthWeeks >= 7 ? 'shallow cup with handle' : 'flat base (≤15% deep, 5+ weeks)');
    } else if (span.depthPct <= 35 && lengthWeeks >= 7) {
      hints.push(handle ? 'cup with handle' : 'cup (no handle yet)');
    }
    if (doubleBottom) hints.push('double bottom');
    const weeksDown = weeks(span.lowIdx - s);
    const weeksUp = weeks(lastInside - span.lowIdx);
    if (span.depthPct >= 12 && weeksDown < 3 && weeksUp < 3) hints.push('possible V shape (fast drop and fast recovery)');
    if (span.depthPct > 50) hints.push('too deep for a sound base — may be a downtrend');
    else if (span.depthPct > 35) hints.push('deeper than the usual 12–33% — only acceptable after a severe market correction');
    if (lengthWeeks < 5) hints.push('short — under 5 weeks, more of a pullback than a base');

    const okDepth = span.depthPct <= 35;
    const okLength = lengthWeeks >= 5 && lengthWeeks <= 65;
    const okPrior = (priorUptrend?.gainPct ?? 0) >= 25;
    base = {
      start: highAt(daily, s),
      low: lowAt(daily, span.lowIdx),
      depthPct: r1(span.depthPct),
      lengthWeeks,
      weeksStartToLow: weeksDown,
      weeksLowToEnd: weeksUp,
      rightSideRecoveryPct: r1(
        span.end < n ? 100 : ((last.close - baseLow) / (baseHigh - baseLow)) * 100,
      ),
      status: span.end < n ? 'broken out' : 'forming',
      patternHints: hints,
      confidence: okDepth && okLength && okPrior ? 'high' : span.depthPct <= 50 && lengthWeeks >= 3 ? 'medium' : 'low',
    };

    // ----- Pivot: handle high, else double-bottom middle peak, else base high — plus 10 cents -----
    let pivotFrom = s;
    let source: NonNullable<ChartFacts['pivot']>['source'] = 'base high';
    let pivotPrice = baseHigh + PIVOT_ADD;
    let pivotConfidence: Confidence = base.confidence === 'high' ? 'medium' : 'low';
    if (handle) {
      pivotFrom = handleHighIdx;
      source = 'handle high';
      pivotPrice = daily[pivotFrom].high + PIVOT_ADD;
      pivotConfidence = handle.confidence;
    } else if (doubleBottom) {
      pivotFrom = span.lowIdx;
      source = 'double-bottom middle peak';
      pivotPrice = doubleBottom.middlePeak.price + PIVOT_ADD;
      pivotConfidence = doubleBottom.confidence;
    }
    // Breakout = the first bar after the pivot point (and after the base low) trading above the pivot.
    let breakoutIdx = -1;
    for (let k = Math.max(pivotFrom, span.lowIdx) + 1; k < n; k++) {
      if (daily[k].high > pivotPrice) {
        breakoutIdx = k;
        break;
      }
    }
    const distance = pct(last.close, pivotPrice);
    pivot = {
      price: r2(pivotPrice),
      source,
      distancePct: r1(distance),
      position: distance < 0 ? 'below pivot' : distance <= 5 ? 'in buy zone' : 'extended past buy zone',
      breakout:
        breakoutIdx < 0
          ? null
          : {
              date: daily[breakoutIdx].time,
              daysAgo: n - 1 - breakoutIdx,
              volumeVsAvgPct: avgVol50[breakoutIdx] ? r1(pct(volArr[breakoutIdx], avgVol50[breakoutIdx]!)) : null,
            },
      confidence: pivotConfidence,
    };

    // ----- Volume inside the base -----
    let acc = 0;
    let dist = 0;
    for (let k = s + 1; k <= lastInside; k++) {
      const avg = avgVol50[k - 1];
      if (avg == null || volArr[k] <= avg) continue;
      if (daily[k].close > daily[k - 1].close) acc++;
      else if (daily[k].close < daily[k - 1].close) dist++;
    }
    const nearLow = volArr.slice(Math.max(0, span.lowIdx - 2), span.lowIdx + 3);
    const avgAtLow = avgVol50[span.lowIdx];
    inBase = {
      accumulationDays: acc,
      distributionDays: dist,
      dryUpNearLowPct: avgAtLow ? r1(pct(nearLow.reduce((a, b) => a + b, 0) / nearLow.length, avgAtLow)) : null,
    };

    baseCount = estimateBaseCount(daily, next, span);
  }

  // ----- Volume overall -----
  const avg50 = avgVol50[n - 1] ?? volArr.reduce((a, b) => a + b, 0) / n;
  const last10 = volArr.slice(-10);
  let upVol = 0;
  let downVol = 0;
  for (let k = Math.max(1, n - 50); k < n; k++) {
    if (daily[k].close > daily[k - 1].close) upVol += volArr[k];
    else if (daily[k].close < daily[k - 1].close) downVol += volArr[k];
  }
  const volume: ChartFacts['volume'] = {
    avg50: Math.round(avg50),
    last: last.volume,
    lastVsAvgPct: r1(pct(last.volume, avg50)),
    last10VsAvg50Pct: r1(pct(last10.reduce((a, b) => a + b, 0) / last10.length, avg50)),
    upDownVolumeRatio50: downVol > 0 ? r2(upVol / downVol) : null,
    breakoutTarget: Math.round(avg50 * 1.4),
    inBase,
  };

  // ----- Tight weekly closes (last 10 complete weeks) -----
  const lastDay = new Date(`${last.time}T00:00:00Z`).getUTCDay(); // 5 = Friday
  const complete = lastDay === 5 ? weekly : weekly.slice(0, -1); // skip the unfinished current week
  const recentWeeks = complete.slice(-11);
  let tight = 0;
  let run = 0;
  let bestRun = 0;
  for (let k = 1; k < recentWeeks.length; k++) {
    const isTight = Math.abs(pct(recentWeeks[k].close, recentWeeks[k - 1].close)) <= TIGHT_PCT;
    if (isTight) {
      tight++;
      run++;
      bestRun = Math.max(bestRun, run);
    } else {
      run = 0;
    }
  }
  const tightness: ChartFacts['tightness'] = {
    weeksChecked: Math.max(0, recentWeeks.length - 1),
    tightWeeklyCloses: tight,
    longestTightRunWeeks: bestRun > 0 ? bestRun + 1 : 0, // 2 tight comparisons = 3 weeks tight
  };

  // ----- RS line -----
  let rs: ChartFacts['rs'] = null;
  if (spy) {
    const line = rsLine(daily, spy).map((p) => p.value);
    if (line.length > 20) {
      const rsLast = line[line.length - 1];
      const rsHigh = Math.max(...line.slice(-YEAR));
      const fromHigh = pct(rsLast, rsHigh);
      const priceNearHigh = price.pctOffHigh52w >= -3;
      rs = {
        last: Math.round(rsLast * 10000) / 10000,
        atNewHigh: rsLast >= rsHigh,
        pctFrom52wHigh: r1(fromHigh),
        nearNewHigh: fromHigh >= -3,
        change13wPct: line.length > 65 ? r1(pct(rsLast, line[line.length - 66])) : null,
        // Leading: RS at/near a new high before price gets there. Lagging: price near highs, RS well off its high.
        vsPrice: fromHigh >= -1 && !priceNearHigh ? 'leading' : priceNearHigh && fromHigh < -5 ? 'lagging' : 'in line',
      };
    }
  }

  // ----- Market check (SPY) -----
  let market: ChartFacts['market'] = null;
  if (spy && spy.length > 30) {
    const spyCloses = spy.map((b) => b.close);
    const spy50 = rollingMean(spyCloses, 50);
    const spy200 = rollingMean(spyCloses, 200);
    const spyLast = spyCloses[spyCloses.length - 1];
    const spyHigh = Math.max(...spy.slice(-YEAR).map((b) => b.high));
    const l50 = spy50[spy50.length - 1];
    const l200 = spy200[spy200.length - 1];
    market = {
      spyLast: r2(spyLast),
      aboveSma50: l50 == null ? null : spyLast > l50,
      aboveSma200: l200 == null ? null : spyLast > l200,
      sma50Trend: slope20(spy50).trend,
      sma200Trend: slope20(spy200).trend,
      pctOffHigh52w: r1(pct(spyLast, spyHigh)),
    };
  }

  return {
    symbol,
    asOf: last.time,
    dataNotes,
    price,
    movingAverages,
    priorUptrend,
    base,
    handle,
    doubleBottom,
    pivot,
    volume,
    tightness,
    rs,
    market,
    baseCount,
  };
}

/** Points worth marking on the chart so the facts can be checked by eye. */
export type ChartAnnotation = { time: string; price: number; position: 'above' | 'below'; text: string };

export function factsToAnnotations(facts: ChartFacts): ChartAnnotation[] {
  const out: ChartAnnotation[] = [];
  if (facts.priorUptrend) out.push({ ...pt(facts.priorUptrend.low), position: 'below', text: 'Prior low' });
  if (facts.base) {
    out.push({ ...pt(facts.base.start), position: 'above', text: 'Base start' });
    out.push({ ...pt(facts.base.low), position: 'below', text: `Base low (−${facts.base.depthPct}%)` });
  }
  if (facts.handle) {
    out.push({ ...pt(facts.handle.start), position: 'above', text: 'Handle' });
    out.push({ ...pt(facts.handle.low), position: 'below', text: `Handle low (−${facts.handle.depthPct}%)` });
  }
  if (facts.doubleBottom && !facts.handle) {
    out.push({ ...pt(facts.doubleBottom.firstLow), position: 'below', text: 'DB 1st low' });
    out.push({ ...pt(facts.doubleBottom.middlePeak), position: 'above', text: 'DB middle peak' });
  }
  return out;
}

const pt = (d: DatedPrice) => ({ time: d.date, price: d.price });
