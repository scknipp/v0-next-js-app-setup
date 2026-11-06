# Library Section: Build Prompt for Claude Code
**Project:** Texas Global Investments dashboard
**Written for:** Steve, by Claude (planning chat), October 2026

---

## How to use this file (for Steve)

1. Save this file in your project folder, next to `CLAUDE.md` and `CHARTS-BUILD-PROMPT.md`.
2. Make sure any Charts adjustments you're working on are finished and committed first, so only one section is in progress at a time.
3. In Claude Code (Local, folder `texas-global-investments`), say: **"Read LIBRARY-BUILD-PROMPT.md and CLAUDE.md, then do Stage 1 only."**
4. When a stage works in your browser, commit and push it, then say **"Library Stage 2"**, and so on.

---

# Instructions for Claude Code

## 1. Who you're working with

- Steve is building his first software project. He is the visionary; you are the builder.
- **Explain in plain English** what you're about to do and why. Define any jargon you use.
- **Work one stage at a time** (see Section 13). At the end of each stage, stop and tell Steve:
  - what to open (localhost:3000/library)
  - what "working" looks like
  - then wait for him.
- **Ask before** anything that costs money or needs a new account. Walk him through any sign-up step by step.
- **Read `CLAUDE.md` first**, and follow the existing conventions:
  - Next.js App Router, TypeScript, Tailwind, shadcn/ui
  - the palette: navy `#0d2747`, gold `#FFD43B`, brown `#6b3410`
- **Don't break anything that already works:** the dashboard, Stocks, and Charts.
- **Reuse what exists.** The Charts section already has:
  - the Tiingo data layer
  - the chart components
  - the indicators in `lib/charts/indicators.ts`
  - the analysis engine in `lib/charts/analyze.ts`

  The Strategies examples (Section 8) should reuse these rather than rebuild them.

## 2. The vision (Steve's goal)

The Library is Steve's **personal learning library for investing and economics**. He is learning CAN SLIM and swing trading, and wants one place to read, watch, study, take notes, and ask questions. It has eight sections:

| # | Section | In one line |
|---|---|---|
| 1 | **Books** | A bookshelf of the best investing, CAN SLIM, options, economics, economist and real estate books, with long Cliffs Notes–style summaries |
| 2 | **Videos** | A screening room of saved YouTube videos, with timestamped notes |
| 3 | **Investment Glossary** | ~300 plain-English terms, searchable, with study mode and hover definitions across the Library |
| 4 | **Strategies** | Stock and options strategies, with evidence, examples, and Steve's own rules |
| 5 | **Asset Classes** | The 7 major asset classes and their subcategories, and how to invest in each |
| 6 | **Economics** | A 6-chapter textbook, from the basics to economics for investors |
| 7 | **Economists** | A portrait gallery of ~25 economists with in-depth profiles |
| 8 | **Post-it Notes** | A corkboard wall where every note from every section lands |

**Features shared by every section:**
- **Post-it notes:** a Note button on every item. The note opens with the item's title already filled in. When closed, it is saved to the Post-it wall, and it also shows on that item's page.
- **Ask AI:** a question box on every item page.

The whole Library is **for reading and learning**. It has **no live market data**; that belongs in the dashboard's Markets section later.

## 3. Navigation and layout

- **Routes:** `/library` (the home page) and one route per section: `/library/books`, `/library/videos`, `/library/glossary`, `/library/strategies`, `/library/asset-classes`, `/library/economics`, `/library/economists`, `/library/notes`. Item pages are nested inside them, e.g. `/library/books/[slug]`.
- **Entry point:** the **Library** button in the dashboard's left menu goes to `/library`.
- **Full-screen pages** with **no dashboard sidebars**, the same as the Charts page:
  - a thin navy frame around the page
  - a slim top bar
- **Buttons:**
  - The Library home page has a **Home** button (brown background, gold text) that returns to `/`.
  - Each section page has a **Library** button that returns to `/library`.
  - Item pages have a back button to their section.
- **Readable typography** for long text:
  - a comfortable line length (about 70 characters)
  - a serif font for summaries and chapters
  - sans-serif for the interface
- **Screens:** it must look good on a 1080p Dell laptop and on a Chromebook, and resize cleanly.

## 4. Library home page: the reading room

- **The room:** a classic wood-paneled library in warm browns, with navy and gold accents.
- **The eight sections** stand as **tall leather-bound volumes on a shelf**, with the section name in gold lettering on each spine.
  - When you hover over one, it **slides out slightly**, like a book pulled from a shelf.
  - Clicking it opens that section.
- **Search:** a **search box** across the top searches the whole Library. It covers book titles and authors, video titles, glossary terms, strategies, asset classes, chapters, economists, and note text. Results are grouped by section.
- **No Word of the Day.** Steve declined it.
- Keep the room elegant and uncluttered. It should be beautiful, not busy.

## 5. Data and storage (important)

Keep two kinds of data separate:

**1. Library content:** the summaries, terms, profiles, and so on that you write.
- Store it as files in the project, e.g. `content/library/books/*.json` or `.md`.
- It gets committed with the code.

**2. Steve's own data:** his notes and note positions, pins, book status and ratings, video list, timestamps and transcripts, "My Rules", glossary edits and added terms, starred terms, and added strategies.
- It must survive browser resets, so **do not use localStorage** as the only copy.
- Save it as JSON files under `data/library/`, written through Next.js API routes. This works because the app runs only on Steve's laptop.
- Write each file safely: write to a temporary file, then rename it, so a crash never leaves a half-written file.
- Keep it **separate from the content files**, so improving content never overwrites Steve's notes or edits.
- Steve's edits to existing content, such as a glossary definition, are stored as **overrides** in his data, not by changing the content file.

**Privacy check, before the first commit that includes `data/library/`:**
- Confirm whether the GitHub repository (`scknipp/v0-next-js-app-setup`) is **private**.
- **If it is public,** stop and explain the choice to Steve: make the repo private (walk him through it), or add `data/library/` to `.gitignore` and set up a different backup. **Wait for his decision.**

## 6. Post-it Notes (the hub; build it early, because every section uses it)

**Reusable note pieces** (build once, use everywhere):
- A `<NoteButton source={...} />` component plus a note editor.
- **The note's title** is filled in automatically, e.g. "Book: How to Make Money in Stocks" or "Strategy: CAN SLIM".
- **Saving:** the note saves when the editor closes. An empty note is discarded.
- **What each note records:** the source type, the source ID, the source title, the date created and date edited, and, for videos, the timestamp in seconds.

**The wall (`/library/notes`):**
- A warm **corkboard** background, with notes pinned like real Post-its, slightly tilted, each showing its **title**.
- **Colors by source:**

| Source | Color |
|---|---|
| Books | yellow |
| Videos | blue |
| Strategies | green |
| Economics | pink |
| Economists | lavender |
| Asset Classes | orange |
| Glossary | mint |
| Standalone | white |

  Include a small legend explaining the colors.
- **Clicking a note** opens it large in the center. From there Steve can **read, edit, or delete** it (deleting asks for confirmation).
- **Link back to the source:** each note has a link such as "Open book", "Open strategy", or "Open video at 12:34". The video link opens the video at that moment.
- **Search and filters:** a **search** box covers all note text, and **filters** narrow by source.
- **Arranging the wall:**
  - Steve can **drag notes** anywhere on the wall, and their positions are saved.
  - New notes appear in an open spot.
- **Pushpin:** pinning a note keeps it in a **"Pinned" strip** across the top.
- **Add Note:** a button for standalone notes that aren't tied to any item.

## 7. Books (`/library/books`)

**The bookshelf**
- One **wooden shelf per subject**:
  1. Stock Market Investing (the top 15–25 books)
  2. CAN SLIM and O'Neil (**all books by William J. O'Neil**, plus the best books on CAN SLIM)
  3. Options
  4. Economics
  5. Economists (books by and about great economists)
  6. Real Estate
- **Books are drawn as spines**, with no cover images, because cover art belongs to the publishers.
  - Spines vary in color, height, and width so the shelf looks real.
  - The title and author appear on each spine in a style that fits the room.
- **Book status:** a small ribbon or marker on the spine shows the status.
- **Filters:** a filter row offers All, Want to Read, Reading, Finished, and Unread.

**Each book's page**
- Title, author, and **year first published**.
- **Why it's considered a classic**, and who it's best for.
- **A long summary** in Cliffs Notes style:
  - organized by the book's **main ideas and lessons**, not as a chapter-by-chapter retelling
  - usually 1,500–3,000 words for major books, shorter where less is needed
  - a closing "Key takeaways for investors" section
- **Status:** Want to Read, Reading, or Finished. **Rating:** 1–5 stars.
- **Steve's notes** for this book, plus the Note button and Ask AI.

**Accuracy and originality rules**
- **Verify facts.** Check the title, author, and first-publication year against **Open Library** (free, no key). Record the Open Library ID. **Do not guess the list of O'Neil's books**; confirm it there.
- **Write summaries in your own words.** Never copy text from the book or from websites. Quotations should be rare, under 15 words, and attributed.
- **Be honest about uncertainty.** If you are unsure of a book's specific contents, write a shorter summary limited to what you're confident about. Mark it **"Partial summary"**, and never invent chapters, examples, or quotes.
- **Label every summary.** Each one shows a small note: *"AI-written summary — may contain errors."*

**Build order:** first the shelf with every book's verified metadata, then the summaries one shelf at a time, starting with **CAN SLIM**. These batches can span several sessions. Stop at a clean point between batches, commit, and tell Steve where you stopped.

## 8. Videos (`/library/videos`)

**The screening room**
- One **row of thumbnails per topic**: CAN SLIM, Swing Trading, Options, Markets, Economics, Real Estate.
- Each thumbnail card shows the title, the channel, and a status badge (Want to Watch or Watched).
- A **filter row** works the same way as on the bookshelf.

**Adding videos**
1. **By link:** Steve pastes a YouTube link and picks a topic.
   - Get the title, channel, and thumbnail from YouTube's **oEmbed** endpoint (no key needed).
   - Reject links that oEmbed can't resolve, with a friendly message.
2. **By search:** a search box inside Videos, using the **YouTube Data API v3**.
   - Steve needs a free Google API key. **Walk him through getting it.**
   - Store it as `YOUTUBE_API_KEY` in `.env.local`, used **server-side only**.
   - Each result has an **Add** button.
   - Mention the free daily quota. Each search costs quota, so search only when Steve presses Enter.

**Each video's page**
- **The player:** YouTube's official embedded player, loaded with the **IFrame Player API** so the app can read the current time and jump to a time.
- **Status:** Want to Watch or Watched. **Rating:** 1–5 stars. **Topic:** editable.
- **Timestamped notes**
  - Pressing **Note** while the video plays records the current time.
  - The note shows a clickable time like "12:34", which jumps the player to that moment.
  - These notes also go to the Post-it wall, with an "Open video at 12:34" link.
- **A transcript box**
  - Steve can paste the video's transcript, using YouTube's "Show transcript" button under the description.
  - Explain this on the page in one line.
  - Once a transcript is saved, Ask AI uses it, and a **"Summarize this video"** button appears.
  - Without a transcript, say plainly that AI only knows the title, description, and Steve's notes.

**Starter collection**
- Add a starter set of well-known, educational investing videos and channels across the topics, favoring official and reputable sources.
- **Find real videos with web search. Never invent video IDs or links.**
- Verify every link with oEmbed before adding it. Drop any that fail.

## 9. Strategies (`/library/strategies`)

**Two groups**

*Stock strategies:*
- CAN SLIM (O'Neil)
- Swing trading
- Value investing (Graham)
- Growth investing (Fisher and Lynch)
- The Darvas Box
- Minervini's SEPA / VCP
- Trend following (the Turtle Traders)
- Momentum
- Dividend growth
- Index buy-and-hold

*Options strategies:*
- Covered call
- Cash-secured put
- Protective put
- Vertical spreads (bull call, bear put)
- Iron condor
- Straddle and strangle
- Collar
- The wheel

**Each strategy's page**
- **Creator and year**, or **"Origin"** for strategies with no single inventor (most options strategies).
- **A thorough summary**, and **the rules**: entry, exit, risk management.
- **Evidence and track record:** presented honestly, *not* as one success number.
  - the creator's own claims
  - independent studies or research where they exist
  - the known criticisms and weak spots
  - a reminder that results depend on the time period and on discipline

  Cite sources where possible. Mark the section *"Educational — not financial advice."*
- **"My Rules":** Steve's own editable checklist for his version of the strategy. It is stored separately from the official summary.
- **Example button**
  - *Stock strategies:* a **real historical chart**, drawn with Tiingo data and the existing chart components.
    - Label the key moments: base, pivot, breakout, buy point, stop.
    - Choose examples carefully, and **verify each against the actual data**. The Stage 4 analysis engine can help confirm a base.
    - Add an **"Open in Charts"** button that opens `/charts?symbol=XXX`.
  - *Options strategies:* an **interactive profit-and-loss diagram at expiration.**
    - It shows the profit or loss across stock prices, computed from the strategy's legs.
    - It marks the breakeven points and the maximum gain and loss.
    - A **slider** moves a hypothetical stock price, showing the profit or loss at that price.
    - Use clear example numbers: a stock at $100 and sample option prices.
- Post-it notes and Ask AI.

**Adding strategies**
- **Add Strategy form:** name, creator, year, summary, rules, and group.
- **AI draft shortcut:** Steve types a strategy's name, and AI drafts the page. Steve then reviews and edits it before saving.
  - This uses the Ask AI setup from Stage 10, so build the form now and the AI draft in Stage 10.

## 10. Asset Classes (`/library/asset-classes`)

**The main page** lists the 7 major asset classes. Each gets a summary and a list of its clickable subcategories.

| Asset class | Subcategories |
|---|---|
| **Stocks (Equities)** | large-cap, mid-cap, small-cap, growth vs. value, the 11 sectors, dividend stocks, international, emerging markets |
| **Bonds (Fixed Income)** | U.S. Treasuries, TIPS, corporate (investment-grade), high-yield, municipal, international |
| **Cash and Cash Equivalents** | high-yield savings, money market funds, Treasury bills, CDs |
| **Real Estate** | REITs, rental property, real estate funds |
| **Commodities** | shown under three headings: **Metals** (gold, silver, platinum and palladium, copper); **Energy** (crude oil, natural gas); **Agriculture** (grains, softs, livestock) |
| **Currencies (Forex)** | major pairs, minor pairs, emerging-market currencies, the U.S. Dollar Index |
| **Crypto (Digital Assets)** | Bitcoin, Ethereum, stablecoins, other coins |

**Each subcategory page:**
- What it is.
- What moves its price.
- **How to invest in it.** Cover each method that applies, with its pros and cons:
  - physical ownership
  - ETFs and mutual funds
  - related stocks
  - futures
  - options
- The main risks.
- Post-it notes and Ask AI.

**No live data or charts here.** Steve wants this section clean, for reading only.

**Room to grow:**
- Build it so new subcategories, and later an **Alternatives** class, can be added easily.
- Any numbers that change over time carry an "as of" date.

## 11. Economics (`/library/economics`)

**A textbook with six chapters,** with clear navigation between them and Steve's progress remembered:

1. **Start Here: What Is Economics?**
   - Micro vs. macro.
   - Supply and demand, scarcity, incentives, opportunity cost.
2. **History of Economic Thought**
   - A **clickable timeline** from early trade theories (mercantilism) through Smith, Ricardo, Marx, the marginalists, Keynes, Hayek and the Austrians, Friedman and monetarism, rational expectations, and behavioral economics, up to today.
   - Each name links to their Economists profile.
3. **Economic Systems and Schools of Thought**
   - **Systems:** market capitalism, mixed economies, socialism, centrally planned economies.
   - **Schools:** Classical, Keynesian, Austrian, Monetarist, Behavioral, Modern Monetary Theory.
   - **Each has a balanced "track record" section:**
     - what supporters point to
     - what critics point to
     - where the evidence is broadly agreed
     - where it is still disputed

     Present views fairly. Do not editorialize.
4. **Economics for Investors**
   - Interest rates and the Fed, inflation, the business cycle, GDP, jobs reports, the yield curve.
   - **How each tends to affect stocks and bonds**, and which reports move the market.
   - Connect this explicitly to the "M" in CAN SLIM.
5. **Economies of the World**
   - Profiles of the **largest 10–15 economies**, with room to add more.
   - Each covers: size, main industries, economic system, strengths and challenges, currency, main stock exchange.
   - All figures carry an **"as of" date**. Use web search to get current figures, and cite the sources.
6. **Famous Economic Events**
   - The Great Depression, 1970s stagflation, Japan's "lost decades", hyperinflations (Weimar Germany, Zimbabwe), the 2008 financial crisis, the 2020 pandemic shock.
   - For each: what happened, why, and **the lessons for investors**.

**On every chapter:**
- Post-it notes and Ask AI.
- **Glossary hover definitions.**
- An **optional end-of-chapter quiz:** 5–10 multiple-choice questions you write in advance, each with an explanation. No AI cost.

## 12. Economists (`/library/economists`)

**The portrait gallery**
- Laid out like a museum hall: **framed portraits** with name, years, school, and a 2–3 sentence summary of their big ideas.
- **Filters** by **era** (Classical, 1900s, Modern) and by **school**.

**Starter gallery of about 25, balanced across schools:**

| Era | Economists |
|---|---|
| **Classical** | Adam Smith, David Ricardo, Thomas Malthus, John Stuart Mill, Karl Marx, Alfred Marshall |
| **1900s** | Irving Fisher, John Maynard Keynes, Ludwig von Mises, Friedrich Hayek, Joseph Schumpeter, John Kenneth Galbraith, Paul Samuelson |
| **Modern** | Milton Friedman, Hyman Minsky, Thomas Sowell, Joseph Stiglitz, Eugene Fama, Robert Shiller, Daniel Kahneman, Ben Bernanke, and a few more to keep the balance |

Include living economists.

**Portraits**
- **Never generate an AI drawing or likeness of a real person.**
- Use **public-domain or freely licensed portraits from Wikimedia Commons**:
  - Download them into `public/library/economists/`.
  - Record each image's **license and source URL**, and show a small credit line on the profile.
  - Use **only** public-domain or CC-licensed images that allow reuse.
- Apply a consistent **sepia tone and frame** with CSS, so the gallery looks uniform.
- **If there is no suitable free image,** show a **monogram medallion** instead: gold initials on navy.
- Let Steve **swap in a portrait** later.

**Each profile page**
- Life and times.
- Big ideas, explained simply.
- Influence on the world.
- **The main criticisms**, presented fairly.
- **Why they matter to investors.**
- **Links:** their key books link to the Books shelf if they are on it, and their school links to its Economics chapter.
- Post-it notes and Ask AI.

## 13. Investment Glossary (`/library/glossary`)

**The page**
- A **search box** that filters as Steve types.
- An **A–Z letter bar.**
- **Category filters:** CAN SLIM and chart terms, Options, Stocks and fundamentals, Bonds, Economics, Trading basics, Crypto, Real Estate.

**Each term**
- A plain-English definition.
- **An example.** For instance: *"Pivot: the price a stock must break through to escape its base. If a cup with handle tops out at $50, the pivot is $50.10."*
- **Why it matters** to an investor.
- **Related terms**, as clickable links.
- **"Where it lives in your dashboard"** where it applies. For instance: *"RS line: see it on your chart in Charts."*
- Post-it notes and Ask AI. Ask AI suggests prompts like "Explain it more simply" and "Give me another example".

**The starter set:** about **300 terms**, with **CAN SLIM and chart terms first.**

**Adding and editing:** Steve can **add terms** and **edit any definition** in his own words. His edits are stored as overrides. Offer a small "restore original" link.

**Hover definitions across the Library:** a reusable `<GlossaryText>` component, used in all long text (summaries, chapters, profiles, strategies).
- Glossary terms in the text get a subtle dotted underline.
- **Hovering** over one shows a small definition box with a link to the full term.
- **Underline only the first occurrence** of each term per page, so it isn't cluttered.
- **Match whole words, ignoring capitalization.** Prefer the longest term ("cup with handle" over "cup").

**Study mode**
- Steve **stars terms** he wants to learn.
- He reviews them as **flashcards**: flip to reveal the definition, mark "Got it" or "Still learning".
- Or as a **quiz**: multiple choice, with the wrong answers drawn from other terms.

**No Word of the Day.**

## 14. Ask AI (shared across sections)

**How it works**
- One server route, e.g. `/api/library/ask`, uses **`ANTHROPIC_API_KEY`** in `.env.local`, server-side only.
  - Reuse the key if Charts Stage 5 already set it up.
  - If not, walk Steve through getting it at console.anthropic.com.
- **Before setting anything up, explain the expected cost per question in plain numbers.**

**What the AI receives with each question**
- The item's content: its summary, chapter, or profile.
- Steve's notes on that item.
- The transcript, for videos.

**How the AI answers**
- **Clearly, for a learner.**
- **Honest about what it doesn't know.** It must not invent book contents, quotes, or video contents.
- **"Educational — not financial advice"** where relevant.

**Model:** use a current Claude model. A Sonnet model (e.g. `claude-sonnet-5-5`) is a good default. Consider a cheaper Haiku model (e.g. `claude-haiku-5-5`) for quick questions, and let Steve choose. **Verify model names in Anthropic's docs.**

**Cost control:** call the AI only when Steve asks. Show a short history of past questions and answers per item, saved in Steve's data.

## 15. Build stages (stop after each one)

Content-heavy stages may span several Claude Code sessions. Work in batches, commit after each batch, and tell Steve exactly where you stopped and what's next.

**Stage 1: Library shell**
- The routes, the reading room home page with the 8 leather volumes, and the navigation (Home and Library buttons).
- Placeholder pages for each section.
- The storage layer for Steve's data (Section 5).
- **The repository privacy check.**
- ✅ *Done when:* the dashboard's Library button opens the reading room, every volume opens its section, and Home returns to the dashboard.

**Stage 2: Post-it Notes**
- The reusable NoteButton and editor, and the full corkboard wall.
- Test with standalone notes.

**Stage 3: Glossary**
- *3a:* the term page, search, A–Z, filters, add and edit, study mode, the `<GlossaryText>` hover component, and the first ~100 CAN SLIM and chart terms.
- *3b:* the remaining ~200 terms, in batches.

**Stage 4: Books**
- *4a:* the shelf, every book's verified metadata, status and rating, notes, and filters.
- *4b:* summaries for the CAN SLIM and O'Neil shelf.
- *4c and onward:* summaries for the remaining shelves, one shelf per batch.

**Stage 5: Videos**
- *5a:* the screening room, add-by-link, the player, timestamped notes, status and rating, the transcript box, and the verified starter collection.
- *5b:* YouTube search, after Steve gets his Google key.

**Stage 6: Strategies**
- All strategy pages, evidence sections, My Rules, the options profit-and-loss diagrams, the stock chart examples, and the Add Strategy form.

**Stage 7: Asset Classes**

**Stage 8: Economics**
- The chapters, the timeline, and the quizzes.

**Stage 9: Economists**
- The gallery, portraits and licenses, and the profiles.

**Stage 10: Library-wide search and Ask AI**
- Library-wide search on the home page.
- **Ask AI** on every section, including video summaries and the AI draft for new strategies.
- **Explain the cost before setup.**

**At the end of every stage:**
1. Summarize what you built, in plain English.
2. List exactly what Steve should test.
3. **Update `CLAUDE.md`.**
4. Give the git commit commands. Remind Steve to `git push` after committing.

## 16. Quality bar

**Code**
- No console errors, and TypeScript compiles cleanly.
- Friendly loading, empty, and error states, such as "No notes yet — click Note on any book to start."
- Sensible file organization:
  - `app/library/...`
  - `components/library/...`
  - `lib/library/...`
  - `content/library/...`
  - `data/library/...`

**Content**
- **All writing is original.** Never copy text from books or websites.
- **Facts are checked.** Book data comes from Open Library, and current figures come from web search with sources.
- **Contested topics are balanced.**
- **Uncertainty is labeled honestly.**

**Feel:** it should feel like a beautiful, quiet library: easy to read, with nothing competing for attention.
