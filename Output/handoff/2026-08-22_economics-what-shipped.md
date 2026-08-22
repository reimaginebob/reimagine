# NextPlacement economics — what shipped, and why it is shaped this way

**Date:** 2026-08-22
**Type:** Reverse handoff (Code → Cowork). Not a brief to implement; a briefing on what now exists.
**Shipped:** PR #481, merge `49192db`, production-verified on the SHA.
**Author's note:** written for a Cowork sibling picking this up cold. Everything here is checkable against the repo — file paths are given so nothing has to be taken on trust.

---

## 1. What was asked for, and the one thing that was not true

Bob's brief asked for an automated economics dashboard: a daily cron writing snapshots into an `economics_snapshots` table, a React frontend on Vercel, unit economics at $450/customer against $1,260/month fixed costs, and a breakeven projection. It named `generation_events` as the source of "token usage per user".

**That last part was false, and it changed the whole shape of the work.**

`generation_events` had exactly four columns: `id`, `user_id`, `kind`, `created_at`. It was built for the rogue-activity watchdog, not for cost. The Anthropic `usage` object came back on every generation and went into a `console.log` line in `api/claude.js` and nowhere else. No query could answer "what does a user cost", at any price, because the data had never been stored.

So the first half of the work was creating the data. The dashboard was the second half and the easier one.

**Pattern worth carrying:** the brief was written against a reasonable assumption about a table nobody had re-read. Premise-verify before drafting — this is the case that justifies the rule.

---

## 2. What now exists

### Cost capture

`migrations/2026-08-24_generation-cost.sql` added to `generation_events`: `model`, `input_tokens`, `output_tokens`, `cache_write_tokens`, `cache_read_tokens`, `web_searches`, `cost_usd`.

`api/_lib/usage-cost.js` prices one call. `api/claude.js` and `api/coach.js` both call it and store the result.

Three decisions inside that are load-bearing:

**Cost is priced at write time and stored in dollars.** Not derived later from token counts. Published model prices change; a July row repriced in December would misstate July. The row holds its own dollars permanently.

**Four token categories, not one number.** Cached reads cost a tenth of fresh input; cache writes cost a quarter more. Reimagine puts a large stable system prefix behind a cache breakpoint on every call, so cached reads dominate the token count. Multiplying total tokens by the headline input rate would overstate the bill several times over. The split also makes a caching regression visible — it is the first place that would show.

**My Coach logs to the same table** (`kind = 'coach'`). It is a real line on the cost side; a dashboard counting only playbook generations would understate cost per user.

### ⚠️ The invariant most likely to be broken by accident

Adding Coach turns to `generation_events` put them in front of the rogue-activity safeguard, which auto-pauses an account at `GENERATION_CAP_HR = 80` generations per hour. A talkative Coach user would have locked themselves out of their own account.

**Three queries now filter `COALESCE(kind, '') <> 'coach'`:**

- the real-time cap in `api/claude.js`
- both volume queries in `api/admin/activity-watchdog.js` (`PER_USER_GENERATIONS_HR`, `TOTAL_GENERATIONS_HR`)

Anyone adding a fourth reader of that table for safeguard purposes must add the same filter. Anyone removing one re-introduces the auto-lockout. This is the single highest-risk thing in the change set, because it fails silently and it fails *on a user*.

### The two things no query can derive

**`economics_inputs`** — price per customer and fixed monthly cost. One dated row per change; a report for a given month reads the latest row on or before that month. Seeded at `2026-01-01` with $450 / $1,260 from the brief. Changing a figure writes a **new** row, so last month's report keeps last month's assumptions. Editable from the tab.

**`users.paying_since`** — who is actually a customer. The active-user count is a login count. Without this the revenue line silently bills pilots, admins, and free accounts. NULL is where every row starts, and the tab reports how many accounts have no billing date rather than assuming in either direction.

### The dashboard

`api/admin/economics.js` (GET payload, POST for the two operator writes) and `src/EconomicsDashboard.jsx`, rendered as the **Economics** tab of `/admin/dashboard` alongside Analytics, Feedback, and Growth. Same `ADMIN_TOKEN` bearer auth as the other admin endpoints.

Panels: month-to-date P&L, breakeven, daily API cost, token mix, P&L by month, cost per account, and the two operator controls (mark a paying customer; change the assumptions).

---

## 3. Where the brief was deliberately not followed

Three departures. All were judgment calls and all are reversible, so they should be re-argued if the reasoning stops holding.

### No snapshot table, no cron

The brief specified a daily job writing into `economics_snapshots`. That was rejected.

At this scale the entire P&L is a handful of indexed aggregates computed per request in well under a second. A scheduled snapshot would be a cache nobody needs, and it buys two new failure modes: the job silently fails and the history grows holes, and anything backdated never makes it in.

The only stored state is what no query can reconstruct — the assumptions and the billing dates. That is a different reason for storage than the brief had, and it is the durable one.

**When to revisit:** if `generation_events` is ever pruned (its own migration comment suggests pruning past ~30 days), the cost history disappears with it. Either never prune, or write a monthly rollup *before* pruning. At current volume, never prune.

### No second app

The brief floated a separate React frontend, possibly a separate repo, possibly a lightweight framework with an embedded SQLite cache.

Reimagine already is a Vercel + Neon app with four cron jobs, an admin dashboard pattern, bearer-token admin endpoints, and migrations that auto-apply on deploy. Adding a tab was one API route and one component. A separate deployment would have meant a second set of secrets and a second thing to fix whenever the schema moves.

The SQLite suggestion was rejected outright on different grounds: Vercel functions have no persistent disk, so the file would vanish between invocations.

### No unauthenticated share link

The brief asked for URL-only access so the page could be shared with the team. The page shows revenue, burn, and customer count, and a URL ends up in a Slack thread. It uses the same `ADMIN_TOKEN` the other admin tabs use. This was less work than the unauthenticated version, not more.

### Charts

The recommendation in conversation was Recharts. On reading `src/AdminDashboard.jsx`, whose header comment says "no new dependencies", that was reversed: the charts are hand-drawn inline SVG and CSS bars. Two shapes (bars, tables) did not justify ~100KB landing in a bundle every *user* downloads for a page only admins open.

---

## 4. What the numbers do and do not mean

Anyone reading this dashboard, or writing about it, should carry these four caveats.

**Nothing backfills.** Cost history starts 2026-08-21. Token counts for earlier generations were never stored and cannot be recovered. Rows before that hold `cost_usd NULL` and the tab states where the history begins rather than letting early months read as cheap.

**Internal testing is separated out.** `@career.club` generations stay in the total cost — it is real money — but appear on their own line. At beta scale internal testing can be most of the API bill, and folding it into cost-per-customer would make every unit number look worse than it is.

**Signed-out generations have their own bucket.** Early-orientation generations log a NULL `user_id`. Real spend, nobody to attribute it to. Neither dropped nor silently charged to customers.

**There is no churn model.** Clearing a billing date is a correction, not a cancellation record. If someone cancels, this system currently has no way to say so, and the revenue line would keep counting them.

**No CAC and no LTV.** There is no marketing spend and no billing history in this database. Either card would be a number typed in by hand and dressed as measured. They were left off deliberately, not overlooked.

---

## 5. How this relates to the Growth tab

Same dashboard, adjacent question, built in the same stretch of work but a separate thread.

- **Economics** answers *what does this cost and when does it break even*.
- **Growth** (`api/admin/growth.js`, `src/GrowthDashboard.jsx`) answers *are people getting value* — activation, cohorts, progression, outcomes.

They share the `ADMIN_TOKEN`, the visual language, and the "no new dependencies" rule, and nothing else. Notably they use **different denominators on purpose**: Economics counts paying customers, Growth counts everyone. A number that appears on both pages is not necessarily the same number, and that is intentional rather than a bug.

The Growth tab has its own briefing needs — the finite-journey framing, the two-door structure, the activation definition change of 2026-08-21 — which are recorded in its own PRs (#484, #486, #488) and are not repeated here.

---

## 6. If you are asked to change something

- **Migrations auto-apply on production deploy** (`scripts/deploy-migrate.mjs` runs before the build). Shipping the file in the PR is the whole deployment step. Never tell Bob to run a migration by hand.
- **Changing a price rate** in `api/_lib/usage-cost.js`: add a row, never edit an existing rate. Historical rows already hold their dollars; editing a rate only affects new ones, and editing it *looks* like it fixes history when it does not.
- **Changing $450 or $1,260**: do it from the tab, not in code. It writes a new dated row and leaves past months alone.
- **Any PR touching `api/*`** gets a preview smoke test before merge (`npm run smoke:preview -- <url>`). The `.mjs` cross-directory import trap is real and cost a 45-minute outage in May; use `.js` extensions for anything shared across `api/` and `src/`.
- Full gates: `npm run build` runs the whole prebuild chain (voice, font floor, prompt refs, coach nav map, orphans, tests, lint).

---

## 7. Open, and honest about it

**The Economics tab's queries have not been observed returning data.** Running them needs the `ADMIN_TOKEN`, which Code does not hold. What *is* verified: production is on the merge SHA, the migration applied (it runs before the build, so a failure would have blocked the deploy), the endpoint loads and returns 403 without a token, and the dashboard page renders with no console errors. Whether the eight aggregates return numbers rather than an error banner needs one look from Bob. As of this writing he has confirmed the Growth tab renders; Economics has not been confirmed either way.

**The GA trigger problem is unsolved and adjacent.** Feature flags flip in the database, not in a commit, so no prebuild gate or reminder fires when something goes generally available. `paying_since` inherits the same weakness: it is operator-entered state with nothing watching it. If accounts start paying and nobody sets the date, the revenue line reads zero and looks like a product failure rather than a data-entry gap.

**One decision Bob has not made:** whether to widen the `my_search` pilot flag. It is not an economics question directly, but outcome coverage is gated behind it, and outcomes are what make the unit economics mean something to an outside reader.
