# Charts Section — Build Prompt for Claude Code
**Project:** Texas Global Investments dashboard
**Written for:** Steve, by Claude (planning chat), September 2026

---

## How to use this file (for Steve)

1. Save this file in your project folder, next to `CLAUDE.md`.
2. Open Claude Code and say: **"Read CHARTS-BUILD-PROMPT.md and CLAUDE.md, then do Stage 1 only."**
3. When a stage works in your browser, say **"Stage 2"** (then 3, 4...). One stage at a time.

---

# Instructions for Claude Code

## 1. Who you're working with

- Steve is building his first software project. He is the visionary; you are the builder.
- Before each significant step, explain **in plain English** what you're about to do and why. Avoid jargon, or define it when you use it.
- Work **one stage at a time** (see Section 9). At the end of each stage, stop. Tell Steve exactly what to open (localhost:3000) and what "working" looks like, then wait for him.
- **Ask before** installing anything that costs money or needs a new account. When he needs to sign up for something, walk him through it step by step.
- Budget: stay within the monthly budget in `CLAUDE.md`. Target $0 for market data and pennies per AI analysis.
- **Read `CLAUDE.md` first.** Follow the existing conventions: Next.js App Router, TypeScript, Tailwind, shadcn/ui, and the project color palette.
- **Do not break the existing Stocks section** or the main dashboard.

## 2. The vision (Steve's goal)

This is a charting page built for **learning and practicing CAN SLIM and swing trading**. Its job is to help Steve find stocks forming **healthy bases** that are about to **break out**.

- **Look:** Clean charts that resemble investors.com / IBD MarketSmith. It shows the chart, the volume, a ticker box, and the right swing-trading tools, and nothing else. There is very little noise.
- **AI coach:** An AI can analyze the chart and explain whether the base and the volume are healthy by CAN SLIM and swing-trading rules. It teaches Steve *why* as it goes, so he learns to read charts himself.
- **Layout:** The entire page is dedicated to the chart, with very thin borders. A Home button returns to the main dashboard (with its navy/gold sidebars).

## 3. Key architectural decision (important)

Do **not** use the TradingView embedded widget for this page. It is an iframe. Our code cannot read its price data or draw AI annotations on it, and the AI cannot analyze it. Instead:

1. **Fetch the data ourselves.** Get raw daily price history (open, high, low, close, volume) server-side.
2. **Draw the chart ourselves.** Render it with **TradingView Lightweight Charts** (npm `lightweight-charts`, open-source, Apache-2.0). Keep its attribution as the license requires, small and unobtrusive.
3. **Compute everything in our own code.** This covers indicators and base metrics.
4. **Send the results to the Claude API** through a server-side route.

If the Stocks section uses the TradingView widget, leave it alone. This change applies only to the Charts page.

## 4. Data

- **Check the existing source first.** See what data source the Stocks section already uses. Determine whether it provides **free daily historical price and volume data going back at least 2 years (ideally 5)** for US stocks **and for SPY**.
- **If it doesn't,** research current free options. Present Steve with 2–3 choices, including limits and cost, recommend one, and **wait for his choice**.
- **Keep API keys secret.** They go in `.env.local` and are used server-side only, never in browser code. Confirm `.env.local` is in `.gitignore` before any commit.
- **Cache responses** per ticker per day, so the app stays within free rate limits. End-of-day data is fine; intraday data is not needed.
- **Weekly bars:** Build them by aggregating the daily bars (weeks ending Friday).

## 5. Page layout

**Route and navigation**
- Create a dedicated full-screen route, e.g. `/charts`.
- The **Charts** button in the left MENU navigates there.
- Accept `?symbol=XXXX` in the URL so other sections can link in later (e.g., a "View chart" button in Stocks).

**Frame**
- No sidebars and no banner on this page.
- A **thin navy frame** (`#0d2747`, about 6–8px) surrounds the viewport. The chart fills everything inside it.

**Slim top toolbar** (40px tall at most), from left to right:
1. **Home button:** brown `#6b3410` background with gold `#FFD43B` text. It returns to `/`, the main dashboard.
2. **Ticker input:** monospace and auto-uppercase; Enter loads the chart. After loading, show the company name, last price, and change beside it in small text.
3. **Daily / Weekly toggle.**
4. **Timeframe presets:** 6M, 1Y, 2Y, 5Y.
5. **Drawing tools** (see Section 7).
6. **Indicators menu:** a small dropdown with toggles.
7. **Analyze button:** gold accent, on the right.

**Chart area**
- White background with very faint gridlines or none. Price scale on the right, dates along the bottom.
- The **price pane** takes about 75% of the height. The **volume pane** takes about 25% beneath it, sharing the same time axis.
- The **crosshair legend** sits small in the top-left and shows date, O/H/L/C, volume, and % change for the hovered bar.
- The page must look good full-screen on a 1080p Dell laptop and on a Chromebook, and resize with the window.
- Remember the last ticker and toggle settings in localStorage. Wrap this in try/catch.

## 6. Chart content (IBD-inspired, not a copy)

**On by default:**
- **Price:** OHLC bars in IBD style, with up days in a dark blue and down days in red. Offer a toggle to candlesticks.
- **Moving averages:**
  - Daily chart: **50-day and 200-day** simple moving averages.
  - Weekly chart: **10-week and 40-week** simple moving averages.
  - Use distinct, subtle colors, labeled in the legend.
- **Volume:** bars colored by up/down day, plus a **50-day average volume line** (10-week on the weekly chart).
- **Relative Strength (RS) line:** stock close ÷ SPY close.
  - Plot it in the lower portion of the price pane on its own hidden scale, avoiding overlap with price where possible.
  - Mark a small dot whenever the RS line hits a **new 52-week high**.
- **Log price scale** by default, with an option for linear.

**Off by default** (in the Indicators menu): 10-day EMA, 21-day EMA, and a 52-week-high line.

Keep it quiet. Add no other indicators unless Steve asks later.

## 7. Swing-trading tools

Lightweight Charts has no built-in drawing tools. Implement these with its plugin/primitives API, following the official plugin examples.

- **Trend line:** click two points.
- **Horizontal line:** one click. Used for the pivot and for support/resistance.
- **Measure tool:** click and drag. It shows % change and the number of days or weeks, for measuring base depth and length.
- **Delete selected** and **clear all**.
- **Trade planner:** Steve sets or accepts a pivot price. The chart then shows:
  - A shaded **buy zone** from the pivot to pivot +5%.
  - A **stop line** 7–8% below the pivot (configurable), with the % risk displayed.
  - A **breakout volume target** label: 50-day average volume × 1.4.
- **Saved drawings:** store them per ticker in localStorage.

## 8. AI chart coach (the heart of the page)

**Purpose:** analyze **and teach**. The coach is educational, not financial advice, and honest about uncertainty.

**User flow**
- Clicking **Analyze** slides open a **drawer on the right**, about 360px wide, overlaying the chart.
- It closes to give the chart full width again.
- The chart stays interactive while the drawer is open.

### Step A — Compute the facts in code (don't make the AI do math)

Create an `analyzeChart(daily, weekly, spy)` function that returns JSON with the following. Keep the detection rules simple and well-commented. Imperfect is acceptable, because the AI reviews the result.

**Price position**
- Last price, 52-week high/low, and % off the 52-week high.
- 50-day and 200-day values, whether price is above or below each, the slope of each over the last 20 days, and whether the 50-day is above the 200-day.

**Prior uptrend**
- % gain from the prior low up to the high where the current base started.

**Base detection**
- Base start (the high), base low, **depth %**, and **length in weeks**.
- How far up the right side price has recovered.

**Handle detection**
- If one exists: start, low, depth %, and length.
- Whether it is in the upper half of the base, and whether it drifts down or wedges up.

**Pivot and buy zone**
- Proposed **pivot**: the handle high, or the base high if there is no handle, plus $0.10 (IBD convention).
- % distance from the pivot, and whether price is extended more than 5% past it.

**Volume**
- 50-day average volume, and the last 10 days' volume vs. that average.
- **Up/down volume ratio** over the last 50 days.
- Within the base, count:
  - down days on above-average volume (distribution);
  - up days on above-average volume (accumulation).
- Volume dry-up near the base low and in the handle, compared with the average.

**Tightness and strength**
- Number of **tight weekly closes** (within about 1.5% of each other).
- **RS line:** whether it is at or near a new high, and whether it is leading or lagging price.

**Market check (the "M" in CAN SLIM)**
- SPY above/below its 50-day and 200-day, and the slopes of both.

**Base count**
- An estimate of the base stage (1st, 2nd, 3rd+), marked **low confidence**.

**Confidence**
- Every detected pattern element gets a confidence label: high, medium, or low.

### Step B — Send it to Claude

**The server route:** `/api/analyze-chart`.

**Model**
- Use the current Claude Sonnet model (`claude-sonnet-5` as of this writing). **Verify the model string in Anthropic's docs.**
- The key lives in `ANTHROPIC_API_KEY` in `.env.local`. Walk Steve through getting it at console.anthropic.com. It is pay-as-you-go.

**What gets sent**
- The facts JSON.
- About 12 months of daily bars and 2–3 years of weekly bars, in compact form.
- A **screenshot of the current chart** (`chart.takeScreenshot()` as base64 PNG), so the model can also see the shape.

**Cost control**
- Run the analysis only when Steve clicks Analyze.
- Cache the result per ticker per day, and show a **Re-analyze** button.

### Step C — The coach's system prompt

Encode these IBD / CAN SLIM technical guidelines:

**Before any base**
- A prior uptrend of about 30% or more.

**Cup with handle**
- 7 weeks or more in total.
- Typical depth 12–33% (deeper can be acceptable during severe market corrections).
- A rounded U, not a sharp V.
- The handle:
  - lasts 1 week or more and forms in the upper half of the base, ideally above the 10-week line;
  - drifts down on light, drying-up volume;
  - is usually no more than 10–12% deep.
- A wedging (rising) handle is a flaw.

**Double bottom**
- A W shape of 7 weeks or more.
- The second low undercuts the first.
- The pivot is the middle peak of the W.

**Flat base**
- 5 weeks or more, no more than about 15% deep.
- Often forms after a prior breakout.

**Other patterns**
- Also recognize base-on-base and ascending bases when present.

**Healthy volume**
- Volume dries up near the lows and in the handle.
- Accumulation outweighs distribution inside the base, and the up/down volume ratio is above 1.
- A proper breakout comes on volume at least **40–50% above average**.

**Red flags**
- Wide-and-loose price action, or heavy-volume selling on the right side.
- A late-stage (3rd/4th+) base.
- A handle in the lower half of the base, or a V-shaped cup without enough time.
- Price below the 50-day or 200-day line, or a lagging RS line.
- Price extended more than 5% past the pivot.

**Swing-trading context**
- Price relative to the 10/21-day EMAs and the 50-day line.
- A light-volume pullback to a rising 10-week/50-day line can be a potential add point.

**Market direction**
- Comment on SPY's trend. The overall market matters.

**Limits and honesty**
- The chart **cannot** judge the fundamentals (C, A, N, I). Say so briefly instead of guessing.
- Say **"no clear base"** when there isn't one. Never guarantee outcomes.
- Frame everything as education, not financial advice.

**Output format:** return **only JSON** in this shape:

```json
{
  "verdict": "No base | Base forming — not ready | Near pivot — watch for breakout | Breaking out | Extended — past buy zone | Faulty or risky base",
  "pattern": "cup with handle | double bottom | flat base | ... | none",
  "confidence": "high | medium | low",
  "pivot": 0.00,
  "buy_zone": [0.00, 0.00],
  "suggested_stop": 0.00,
  "checklist": [
    { "item": "Prior uptrend", "status": "pass | caution | fail",
      "explanation": "1–3 plain-English teaching sentences" }
  ],
  "volume_summary": "plain English",
  "market_check": "plain English",
  "what_to_watch_next": "plain English",
  "lesson": "one short teaching paragraph on the key concept this chart illustrates",
  "annotations": [
    { "type": "base_start | base_low | handle_start | handle_low | pivot_line | buy_zone",
      "date": "YYYY-MM-DD", "price": 0.00, "label": "short text" }
  ]
}
```

### Step D — Display in the drawer

- A **verdict badge** at the top.
- The **checklist**, with green/amber/red dots and expandable explanations.
- Volume summary, market check, what to watch next, and the lesson.
- **Chart annotations** drawn on the chart: base markers, pivot line, and buy-zone shading. They can be toggled off.
- A small footer: *"Educational analysis by AI — it can be wrong. Not financial advice."*

## 9. Build stages (stop after each one)

**Stage 1 — Full-page chart shell**
- Build the `/charts` route, the navy frame, the toolbar, the Home button, and the ticker input.
- Set up the data source with caching, and draw daily bars with the volume pane.
- ✅ *Done when:* typing NVDA shows a clean price + volume chart filling the screen, and Home returns to the dashboard.

**Stage 2 — IBD overlays**
- Add the moving averages, the average volume line, the RS line with new-high dots, the Daily/Weekly toggle, the log scale, the crosshair legend, and the timeframe presets.

**Stage 3 — Swing tools**
- Add the trend line, horizontal line, measure tool, trade planner, and saved drawings.

**Stage 4 — Analysis engine (code only, no AI yet)**
- Build `analyzeChart()` and show its raw facts in the drawer as a debug view.
- Test on several tickers with Steve and sanity-check the numbers against the chart.

**Stage 5 — AI coach**
- Walk Steve through getting the Anthropic API key.
- Build the API route, the system prompt, the drawer UI, the annotations, and the caching.

**Stage 6 (optional) — Follow-up questions and polish**
- Add a small question box in the drawer (e.g., "Why is this handle faulty?"). It sends the prior analysis as context.

**At the end of every stage:**
1. Summarize what you built, in plain English.
2. List exactly what Steve should test.
3. **Update `CLAUDE.md`** with what was built and the decisions made.
4. Walk Steve through a git commit, with a suggested commit message.

## 10. Quality bar

- No console errors. TypeScript compiles cleanly.
- Friendly messages for a bad ticker, a rate-limit hit, a missing API key, and loading states.
- Code is organized in sensible files, e.g. `components/charts/`, `lib/charts/analyze.ts`, `app/api/analyze-chart/route.ts`.
- Nothing on the page competes with the chart. When in doubt, leave it out.
