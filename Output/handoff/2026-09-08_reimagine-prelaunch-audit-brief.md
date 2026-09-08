## Prompt for Code

Read this brief end to end before touching anything. It is a whole-application pre-launch audit, not an implementation brief: it ranks what will break, leak, or cost money as Reimagine goes from ~145 accounts to launch scale, and it separates ordinary bugs from the patches that have become load-bearing. Premise-verify every cited line against current `main` (HEAD `e2eabfe`, 2026-09-07). Then: (1) confirm or refute each finding and report which survive; (2) draft a ship plan that sequences Section 8 into PRs, one concern per PR, launch-blocking tier first; (3) stop and surface to Bob before starting anything in Section 7.2 (server-side generation orchestration), because that changes where prompts live and how spend is attributed, and he decides whether it goes before or after launch. Everything in the launch-blocking and before-launch tiers of 7.1 is yours to ship under the normal gh flow.

---

## Date / Type / Source

2026-09-08. Diagnostic audit brief. Source: Bob asked for an audit of the whole application ahead of a full-scale launch, covering scalability, user satisfaction, errors, and cost, with the twist-and-turn patches called out.

**Bob's answers to the scoping questions (2026-09-08), which govern everything below:**

- **Scale:** hundreds to low thousands of users over three to six months. The audit is sized for ~2,000 active accounts, which is the top of that range; nothing here needs to be built for more.
- **Cost line:** $3 per user per month, held over six months, is the starting target. The measured model (Section 6) is above it today and the two Coach levers bring it under; that sequencing matters for launch.
- **Retirements:** the retired five-phase demo goes. **Low usage of any feature is NOT evidence for retiring it.** Bob's read: people have not discovered rich features because there are so many, which is the reason the My Coach rewiring happened. No feature is proposed for removal on usage grounds anywhere in this brief, and Code should not propose one.
- **Infrastructure:** Vercel, Neon, Resend, and Apps Script stay. Recommendations on how to structure the Neon database are welcome (Section 7.1 gathers them); moving off any vendor is out of scope absent a very compelling reason, and none was found.

Method: three read-only audits ran in parallel (client, server/data/security, cost/ops), each citing file and line; I re-verified every finding in the launch-blocking tier and most of the before-launch tier against the source myself before it went in. `npm run build` ran clean and produced the bundle numbers in 5.3. Findings not independently re-verified are marked "plausible." The My Coach brief of 2026-09-07 and the fourteen PRs that closed it (#784 through #797) are treated as done; nothing here re-litigates them.

---

## 1. The short version

Reimagine's product logic is in good shape for launch; its plumbing is not. Three structural facts explain most of what follows.

**Generation is orchestrated in the browser.** All ~14 prompt builders, roughly 600 KB of prompt text, ride in the public JavaScript bundle (`src/App.jsx:3039-4532`, one blanket voice-allow region around the whole P object). The client builds the full prompt, sends the whole Anthropic request body to `/api/claude`, and the server forwards it after swapping the model and system prompt (`api/claude.js:528-536`). That one design choice is why the proxy can be called anonymously with web search at 16,000 tokens (2.1), why 14 call sites log unattributed spend (2.9), why nothing survives a reload (3.5), why the profile block is re-sent uncached on most calls (6.3), and why anyone curious can read Bob's methodology out of the bundle.

**User state is one JSON blob written whole.** `users.profile_state` is replaced on every 800 ms autosave (`api/profile/save.js:74-79`), gated only by "did the load call finish" rather than "did it succeed" (`src/App.jsx:8825`, `src/autosave-gate.js:9-12`), with no version precondition, no per-user history, and no backup story anywhere in the repo. Every silent-data-loss path in Section 3 comes from this, and the saved_playbooks migration that was meant to fix it is half-landed: the client stopped writing playbooks into the blob (`src/App.jsx:9410-9416`) but six dashboards and the abuse watchdog still read them from it (2.7).

**Trust boundaries are cosmetic.** An `Origin` header is the only gate on paid endpoints (`api/claude.js:461-464`), session tokens sit in plaintext as a primary key (`api/_lib/session.js:48-67`), the admin master token lives in the app-origin localStorage and is accepted in a query string (`src/AdminDashboard.jsx:47-62`, `api/admin/analytics.js:659-667`), and the magic-link sender will email attacker-supplied HTML to any address from Career Club's domain (`api/_lib/email.js:6-19`, `api/auth/request-link.js:43-45`).

The gain: none of this is hard to fix, most of it is additive, and the code already contains the right pattern for each (hashed tokens in `oauth.js`, session-plus-allowlist auth in `send-legal-update.js`, server-built profile blocks in `coach.js`, the dry-run-first design of `send-campaign.js`). The measured cost model lands at about $5.9 per monthly active user, with My Coach at 54% of it; two changes to Coach's cache layout and its silent turns bring that under $4 without touching anything users see.

---

## 2. Launch-blocking findings

Each of these is either an open cost exposure, a security hole a public launch will attract, or a silent data-loss path. All re-verified.

**2.1 `/api/claude` is an anonymous, uncapped Anthropic proxy with web search.** `getSessionUser` failure is swallowed (`api/claude.js:470-471`); the hourly cap runs only `if (sessionUser && sessionUser.id)` (`:480`) and exempts `@career.club`; the legacy branch spreads the caller's whole body so the caller controls `messages`, `tools`, `output_config`, and `max_tokens` up to 16,000 (`:531-536`); the 100,000-char prompt check exists only on the simplified branch (`:513`), which the client never uses (`src/App.jsx:378` always sends the legacy shape). The origin check accepts any `Origin: https://reimagine.career.club` header from curl and any `*.vercel.app` host containing "reimagine" (`:403`). Anonymous generations log `user_id = NULL` (`:60-71`), so abuse is invisible to the watchdog and per-user economics. A junk `effort` value 400s upstream, is classified `request`, and pages the operator (`api/_lib/anthropic-error.js:79-101`), so an anonymous caller can also trigger alert emails. Fix: require a session for every step except an enumerated early-orientation set; per-IP token bucket on the anonymous path; drop the legacy body spread and build the request server-side from named fields; forbid caller-supplied `tools`.

**2.2 My Coach has no rate limit at all.** `api/coach.js` checks only suspension (`:1756`); `kind='coach'` rows are excluded from the generation cap (`api/claude.js:485`) and from the watchdog (`api/admin/activity-watchdog.js:161`). Message length and history content are unbounded; a turn costs $0.06 warm and $0.42 cold (6.1). Fix: per-user turns-per-hour cap and a per-message byte cap, enforced before the profile read.

**2.3 Magic-link sending is abusable and injectable.** Rate limit keyed on recipient email only (`api/auth/request-link.js:91-120`), nothing per IP, so unlimited third-party addresses can each receive five emails per fifteen minutes from `career.club`, which is a spam-reputation risk on a young sending domain and a Resend bill. `firstName` is checked only for non-empty (`:43-45`) and interpolated raw into the HTML and text email (`api/_lib/email.js:6-19`). The link host comes from `x-forwarded-host` (`:20-24, 137-138`); Vercel probably normalizes it, but pin it to an allowlist rather than trust it. `check-email.js:10-13` is an unauthenticated account-enumeration oracle. Fix: per-IP limit, escape and cap the name (or drop the greeting for unverified addresses), pin the base URL, rate-limit or collapse check-email.

**2.4 Session tokens are stored in plaintext.** `createSession` inserts the raw 32-byte token as the `sessions` primary key (`api/_lib/session.js:48-51`) and `getSessionUser` looks it up raw (`:67`). Magic-link tokens (`request-link.js:123`) and OAuth tokens (`oauth.js:5-7`) are hashed with the helper in the same file. A DB read of any kind (backup, Neon console, a future SQL injection, a log line) yields working cookies for every signed-in user. Fix: hash on write and read; migrate existing rows in place.

**2.5 A failed profile load unlocks a stale overwrite.** The `/api/me` → `/api/profile/load` chain ends in `.catch(()=>{}).finally(()=>{serverLoadDone=true})` (`src/App.jsx:8825`); `canPushProfile` checks only that flag (`src/autosave-gate.js:9-12`); the autosave then PUTs whatever `pe_v4` held (`:9430`), and `profile/save.js:74-79` replaces the column with no `updatedAt` precondition. Scenario: a laptop with weeks-old local state signs in during a Neon hiccup and replaces the work the person did on their phone. Companion: two tabs or two devices are last-write-wins for everything except `savedPlaybooks` (`api/profile/save.js:5-27`), so dismissing a notice in tab B (every `seen*` flag is in the blob, `:9416`) overwrites a Personal Brand tab A just built. Fix: unlock the PUT only on a 2xx load; send `profile_updated_at` and reject the save when the server is newer; split generated `outputs` out of the autosave blob (see 7.2).

**2.6 No backup or version history for user work.** Nothing in `api/`, `migrations/`, `scripts/`, or `CLAUDE.md` mentions Neon PITR, restore drills, or per-user history. Combined with 2.5, one client bug that saves an empty state destroys a person's outputs with no way back. Fix before launch: confirm the Neon plan's PITR window and write it down; add a nightly `profile_state` snapshot table (the `stage-snapshot` cron already shows the pattern) or per-save history for the `outputs` subtree.

**2.7 The saved_playbooks migration is half-landed and has already broken the dashboards and the abuse watchdog.** Phase 3 is live on the client: the blob no longer carries `savedPlaybooks` (`src/App.jsx:9410-9416`). `profile/save.js` writes the incoming body whole, so the blob's copy is dropped on each account's first Phase-3 save. Still reading `profile_state->'savedPlaybooks'`: `api/admin/activity-watchdog.js:118-134` (the ≥15 playbooks/hour auto-pause is now blind), `analytics.js:117-127`, `growth.js:151-380`, `dormant.js:106-108`, `user-stages.js:92-97`, `stage-snapshot.js:81-103`. The Focus and Opportunity playbook counts Bob reads will decay toward zero account by account. Fix: point all six at `saved_playbooks`; then remove the dormant merge shim in `profile/save.js:44-53`, which still costs a SELECT per save for a field current clients never send.

**2.8 The admin master token is one static string kept in the app's own localStorage.** `ADMIN_TOKEN` gates suspension, flag grants, mass email, OAuth revocation, and billing edits (`api/_lib/admin-auth.js:23-39`, `suspend-user.js:24`, `send-campaign.js:100`, `economics.js:594`); the dashboard stores it in localStorage on the same origin as the user app and accepts it via `?t=` (`src/AdminDashboard.jsx:47-62, 194`; `api/admin/analytics.js:659-667`); comparisons are `===`. One XSS anywhere in the React app hands over the key. Fix: session plus `ADMIN_EMAILS` allowlist (the pattern `account/send-legal-update.js:26-29` already uses), constant-time compare, drop `?t=`, and note that the `CORS *` on these endpoints must go when auth moves to cookies.

**2.9 Spend attribution has a hole the budget cannot see through.** 14 `callClaude` sites pass no `step` (`src/App.jsx:1505, 1546, 1725, 1825, 1917, 2497, 2521, 9369, 10317, 11183, 11330, 11376, 12290, 13158`), most of them web-search calls, so `logGeneration` writes `kind = NULL`; the comment at `:716-720` records $78 of $133 unattributed in the last look. `logGeneration` itself swallows every error (`api/claude.js:60-71`), so a broken insert silently disables the hourly cap, the watchdog, and the budget alerts together. Fix: tag every site; alert once when `logGeneration` fails repeatedly.

---

## 3. Before-launch findings: errors and data integrity

**3.1 localStorage quota failure blocks the server save.** `localStorage.setItem('pe_v4', blob)` runs before the PUT inside the same try (`src/App.jsx:9417-9438`); a `QuotaExceededError` lands in the catch as `device_full` and the server PUT never runs. Plausible at launch: one account already hit 1,049,069 bytes (`api/profile/save.js:56-58`), `pe_saved_v1` holds every playbook again (`:9455`), the LinkedIn connections CSV can hold 30,000 rows in `reimagine_network` (`src/connections-match.mjs:611`), plus chat history, against a ~5 MB origin budget. Fix: PUT first, then localStorage, each in its own try.

**3.2 Dual-write to `saved_playbooks` advances its baseline on failure.** `.catch(()=>{})` on each PUT/DELETE, then `savedSyncBaselineRef.current = curSig` unconditionally (`src/App.jsx:9505-9509`); a 500 or an offline moment marks the record synced forever. `api/saved-playbooks.js:39-46` also silently no-ops writes whose `updatedAt` is older than stored while returning `{ok:true}`, and the GTM sweeps write `companyOpenings`/`companyContacts` without bumping `updatedAt` (`:12797, 12849`), so those writes can be dropped by design. Fix: advance the baseline only on 2xx; retry on the next tick; bump `updatedAt` on every record mutation.

**3.3 Focus-section results land in whichever playbook is current when the call returns.** `generateSection` (`src/App.jsx:10263`) has no request or slot guard; `afterSectionGenerate` (`:11015-11028`) reads `currentSavedSlotIdRef.current` at completion; `restoreFromSavedSlot` (`:13228`) is reachable from My Pipeline while a section is generating. Direction A's Interview Prep is written into direction B. (`generateOpSection` at `:11629` does guard, and discards the paid result.) Fix: capture the slot id at call start and write only if it still matches; block slot switches while generating.

**3.4 GTM sweeps run as a render side effect and cache failures as "no openings."** `ensureOpeningsSweep`/`ensureContactsSweep` are called inside render (`src/App.jsx:11917-11918, 14774-14775`); a 10-company list fires up to 20 web-search calls on first view; `findOpeningMatches` returns `{count:0}` on any error (`:1832`) and the sweep persists that as `status:'checked'` (`:12795-12797`), so an outage reads as "no open roles" permanently. Untagged spend (2.9). Fix: move to an effect keyed on the record id; persist an `error` status separately from `checked`; tag the step.

**3.5 Nothing survives navigation or reload.** Results exist only in the awaiting fetch; no server-side record of a generation in flight, no resume. The Personal Brand build is two calls of up to three minutes each; the opportunity auto-build is a four-call sequential chain (`:11714 → 12076 → 12134 → 11647`). The stale-bundle banner is correctly suppressed while loading (`:16933`), but the two-minute version poll (`src/version-check.js:38`) makes a reload during a long build more likely at launch cadence. Structural fix is 7.2; a stopgap is an AbortController plus a "still building, don't leave" affordance.

**3.6 Error UX.** The root `ErrorBoundary` offers Reload and Copy and says "Your work is saved" (`src/ErrorBoundary.jsx:87-92`); a throw from hydrated state re-crashes on reload with no "start without local data" path, and the saved claim can be false inside the 800 ms window. One shared `err` string is never cleared by `nav()` (`:9961`) and renders on about twelve screens, so a Personal Brand failure message follows the person to Bridge Story. No `unhandledrejection` handler. The "offline" notice promises "it will save on its own when the connection comes back" (`:17037`) but there is no `online` listener or `beforeunload` flush. Fix: a reset-this-device action in the boundary, clear `err` on nav, add the listener or change the copy.

**3.7 Test mode ships to production with a real resume.** `?test=true` derives `isTest` from a public URL param (`src/App.jsx:7059`), wipes `pe_v3`/`pe_v4`/`pe_saved_v1` for whoever lands on it (`:8797, 8804`), and `src/testData.js` embeds a real resume with a phone number in the public bundle. Fix: strip test mode and `testData.js` from the production build.

**3.8 PII leaves the Vercel/Neon boundary from the browser.** The corrections and voice-violation loggers POST email, name, the person's free-text correction, and 120-char excerpts of generated output to a public Apps Script URL (`src/App.jsx:5671, 9984-10030`); the signup POST sends first name, last name, and email to a second Apps Script URL before the auth request (`:10608`). Both are unauthenticated public endpoints anyone can also spam, and both fail silently. The signup sheet is now redundant with `users` + `signup_source`. Fix: drop the signup POST; route corrections through an API function that writes to Postgres, or drop the identity fields.

**3.9 `chat_messages` has no CREATE TABLE in `migrations/`.** The first `ALTER TABLE chat_messages` (`2026-06-10_coach-selfcheck.sql:16-23`) assumes it exists. A fresh database (staging, disaster recovery, a Neon branch) cannot bootstrap, and the table's index set is unknown from the repo; the only known index is a partial one that serves none of the coach-insights, growth, or dormant queries. Fix: add a `CREATE TABLE IF NOT EXISTS` migration mirroring production plus `(user_id)` and `(created_at)` indexes.

**3.10 No retention anywhere.** `sessions` (only per-logout delete, `api/_lib/session.js:88-90`), `magic_link_tokens`, `oauth_codes`, `oauth_tokens`, `oauth_clients` (open unauthenticated registration, `api/oauth/register.js:8-25`), `analytics_events`, `chat_messages` (full message and reply text, explicitly no TTL per `2026-06-12_coach-insight-foundation.sql:12-15`), `generation_events`, `email_events`. Bounces and complaints are recorded by `resend-webhook.js` but never consulted before sending again. Fix: one nightly cleanup cron for expired sessions, tokens, and codes; a retention decision on `chat_messages` and `analytics_events` that matches the privacy policy; a suppression check on the campaign path.

**3.11 Session write amplification.** Every authenticated request UPDATEs `sessions` and re-sets the cookie (`api/_lib/session.js:72-83`). A signed-in page load makes six to seven authed calls (`src/App.jsx:8627-8635, 8818, 9470`), and every autosave PUT adds another. `last_used_at` feeds the dashboards, so throttle (touch only when older than an hour) rather than remove.

**3.12 Migration pipeline edge.** `deploy-migrate.mjs` fails the build on error, which is correct, but each file runs in its own transaction (`scripts/migrate.mjs:76-93`), so a failure on file 3 of 5 leaves prod running old code on a partly new schema until the fix lands. Safe only while migrations stay additive; write that rule down. `migrations/README.md:53-60` still says not to wire migrate into deploy, contradicting `vercel.json`.

---

## 4. Before-launch findings: user experience at scale

**4.1 Render cost.** One component from `src/App.jsx:7044` to EOF with 233 `useState`, 64 `useEffect`, 0 `useMemo`, 0 `useCallback`, and no `memo()` anywhere. Every keystroke in any input re-renders the tree; `rStep()` re-parses `outputs.p7`/`p8` JSON per render (`:14759, 14771, 14823`), rebuilds `orientationCheckFields` (`:8892`), runs `stalePlaybookSections` (`:15469`), and triggers the sweep side effects in 3.4. `Chat` receives ~45 props including fresh lambdas each render (`:17017`). Fix: memoize the JSON parses and derived lists; `memo()` Chat and the section components.

**4.2 Bundle.** Main chunk 1,745 KB (522 KB gzip); `docx` and `mammoth` are the only lazy imports. The seven admin dashboards (~210 KB source), `legalDocs`, `demoData` (54 KB), `testData` (15 KB), and roughly 600 KB of prompt and copy text ship to every visitor. Fix: `React.lazy` the admin routes, legal pages, and demo; the prompts move server-side in 7.2.

**4.3 Every page load PUTs the profile back unchanged.** `serverLoadDone` is in the autosave dependency list (`src/App.jsx:9439`), so hydration schedules a save; one 0.3 to 1 MB PUT per visit for nothing.

**4.4 Sign-in mid-edit discards typed work.** The magic-link handshake reloads the original tab (`:8790`) and server-wins hydration replaces whatever was typed while signed out (`:8818`); the data sits in `pe_v4` unseen. Later, but worth a "we found unsaved work on this device" prompt.

**4.5 Silent Coach turns at full price.** Session-open, nine orientation checks, and post-capture follow-ups each send the full ~162K-token prompt to produce one or two sentences (6.2). Not a bug; a cost and latency choice that becomes visible at scale.

---

## 5. Structural debt: the patches that became load-bearing

These are the twist-and-turn leftovers. None is urgent alone; together they are why every change touches five places.

- **Prompt builders in the client** (`src/App.jsx:3039-4532`), the SYS prompt duplicated in `App.jsx:67` and `api/claude.js:102` with a byte-equality gate to hold them together, and `SYS_BASE` (30 KB) uploaded on every call only to be replaced server-side (`api/claude.js:530-536`). The cross-directory `.mjs` outage of 2026-05-27 is the reason the duplication exists; server-side orchestration (7.2) retires the reason.
- **The profile blob** (2.5, 2.6, 2.7, 3.1, 4.3) and the half-finished saved_playbooks migration with its merge shim.
- **Retired code still wired:** `p10` stub in the builder, `ROLE_SUBMODULES`, `IO`, `feedback`, `DEPENDENCY_ORDER`, and the render concat (`:3556, 5538, 7076, 7203, 9791, 15317`); `pe_v3` migration shim and modal (`:8797, 8831, 16872`); `pursuit-update` and `interview-team` legacy checkin keys (`:7805-7811, 7916, 8050`); `isDemo` referenced 233 times and `isTest` 65 times; the retired five-phase demo persona still served at `/demo` (`vercel.json`).
- **Voice-allow regions:** two, not "~12" as `CLAUDE.md` §3 says, and the second blankets the entire P object, so the build gate scans none of the prompts. Either narrow it or state plainly that prompts are exempt.
- **Nine feature-flag pilots** (`api/_lib/feature-flags.js`) all auto-granted to `@career.club`. The gated-feature rule in `CLAUDE.md` §8 is sound; the pile-up means Bob has never seen the GA product on his own account. Decide the launch GA set and retire or promote each flag.
- **Alerting and monitoring:** one `ADMIN_EMAILS` recipient; the survey digest hard-coded to Bob; no uptime monitor evidenced on `/api/health-db`; four of five crons fail silently (only `daily-digest` has a heartbeat); no circuit breaker on upstream 429/529 (`api/_lib/anthropic-error.js:102`); no automatic degrade when the monthly budget hits 100%, which is the 2026-08-15 incident shape.
- **Dashboards as full-table scans:** the `acts` CTE (UNION ALL of all sessions twice, all generation_events, all chat_messages, grouped by user, no window) is copy-pasted into `growth.js:351, 415, 444`, `dormant.js:82`, `user-stages.js:71`, `generation-attempts.js:69`, `send-campaign.js:118`; `economics.js` runs 16 queries per load including a percentile over every row ever; the watchdog scans every user's JSONB hourly. Fix: materialize `users.last_activity_at` (update it where the session touch is throttled), nightly rollups, bounded windows, and `(user_id, kind)` on `generation_events`.

---

## 6. Cost model (measured and estimated; arithmetic in the audit notes)

Prices from `api/_lib/usage-cost.js:22-43`: Sonnet 5 at $2 / $10 per million input / output, $2.50 cache write, $0.20 cache read, $0.01 per web search. Sizes measured: `SYS_BASE` 30,189 chars; `USER_GUIDE_CONTENT` 293,526; `MYOW_CONTENT` 225,570; a typical profile block 23,314 chars.

**6.1 Per journey.** Orientation plus Personal Brand ≈ $0.20; Career Paths ≈ $0.12; a nine-section Focus Playbook ≈ $1.31 (Go-to-Market alone ≈ $0.45 with continuations); an eight-card Opportunity Playbook ≈ $1.15 (company read ≈ $0.30). A complete first journey ≈ **$2.8** across ~30 calls, ~18 with web search. Ceiling case, everything at 16K output with cold prose caches, max voice retries, and three pause-turn continuations per web step: $10 to $14. A Coach turn is $0.056 warm and $0.42 cold; an eight-turn session with one six-minute gap ≈ $1.27.

**6.2 Monthly at 2,000 accounts** (40% MAU, 300 signups, 60% finish Focus, 1.5 Opportunity Playbooks per MAU, 2.5 Coach sessions per MAU): ≈ **$4,700, or $5.9 per MAU**, Coach ≈ 54%. Honest range $3.5 to $9 per MAU. If session-open and orientation-check turns go GA on the current prompt, add $700 to $2,000. Vercel compute is second order (~$50 to $150).

Against Bob's $3 per user per month line: the current build runs about twice that per active user. Levers 1 and 2 below (Coach cache layout and trimmed silent turns) bring the model to roughly $3.50; lever 3 (web-search bounds) takes it under $3. All three are server-side changes with no user-visible effect, so they belong before launch, not after. At the low end of Bob's range (say 500 active users) the absolute figure is about $3,000 a month today and about $1,500 after the three levers; at 2,000 active it is the $4,700 above against roughly $2,400. Per registered account the numbers are lower still, since only about 40% of accounts are active in a month.

**6.3 Levers, ranked by savings against that base.**

1. **Coach cache layout** (20 to 30% of total). The step-specific guide slice sits between HEAD and the book inside the one cached block (`api/coach.js:1624-1626`, `src/coach-guide-resolver.js:42-63`), so every `currentStep` change rewrites ~150K tokens at 1.25x on a five-minute TTL, and an unmapped step falls open to the full guide. Put HEAD + COMP_KNOWLEDGE + nav map + book first with its own breakpoint, the guide slice second, merge Go Independent and pilot knowledge into one block, and narrow the book the way the guide was narrowed. Cold turns drop from $0.42 to about $0.15.
2. **Silent Coach turns on a trimmed prompt** (up to 100% of that line). Session-open, orientation checks, and post-capture turns need the persona, the profile, and the check text, not the guide or the book; run them at `effort: 'low'`.
3. **Web search bounds** (8 to 12%). No `max_uses` on the tool anywhere (`api/claude.js:526`, `src/App.jsx:367`); pause-turn continuations resend the whole growing context up to three times (`:645-655`); Networking Groups and Job Search Resources verify every org with its own web-search call (`src/App.jsx:2085, 2208`), so one click is 8 to 11 calls. Set `max_uses` per step and batch the verifications.
4. **Voice-retry budgets** (5 to 10%). Worst cases are six full-price attempts for `p_res` and the company-read family (`src/App.jsx:873-933`) and eight for `p3` (`:946`), each resending the full uncached prompt. Cap attempts per dollar, retry at `effort: 'low'`, log the retry rate.
5. **`SYS_PROSE` (81K chars) on seven small steps** (3 to 5%): bridge story, cover letter, builder nudges, known-outreach each pay a $0.20 cold cache write for a 1 to 2K-token reply. Use `prose-lite` or a register excerpt.
6. **Server-built profile block** (3 to 5% now, more for burst users): `p8` sends the block and re-inlines resume, signals, and assessment; `p4` and `p9` send ~6K tokens of profile with no cache block; `p_res`, `p11`, `income`, and `op` re-inline the resume. The reusable share is 40 to 75% of uncached input per call. Falls out of 7.2.
7. **Ceilings and floors** (<2% expected, tail risk): keep, but alert on `claude_truncated` and `claude_empty_retry` rates.

---

## 7. Recommendations

### 7.1 Fix under the current architecture, one PR each

**Launch-blocking tier, in this order:** session hashing (2.4); `/api/claude` auth, per-IP limit, and no caller-supplied tools (2.1); Coach rate limit (2.2); magic-link per-IP limit, name escaping, base-URL pin, check-email throttle (2.3); load-success gate plus `updatedAt` precondition on profile save (2.5); admin auth to session plus allowlist (2.8); point the six blob readers at `saved_playbooks` and retire the merge shim (2.7); tag the 14 untagged call sites and alert on `logGeneration` failure (2.9); confirm PITR and add a nightly `profile_state` snapshot (2.6).

**Before-launch tier:** PUT-before-localStorage (3.1); dual-write baseline on 2xx (3.2); slot guard on `generateSection` (3.3); sweeps out of render, error status separate from checked (3.4); ErrorBoundary reset path, clear `err` on nav, fix the offline copy (3.6); strip test mode and `testData.js` (3.7); drop the signup Apps Script POST and proxy or de-identify corrections (3.8); `chat_messages` DDL and indexes (3.9); retention cron and bounce suppression (3.10); throttle the session touch and materialize `last_activity_at` (3.11, 5); web-search `max_uses` and batched verifications (6.3 item 3); voice-retry caps (item 4); Coach cache reorder and trimmed silent turns (items 1 and 2); `React.lazy` for admin, legal, demo (4.2); memoize the render hot spots (4.1); uptime monitor on `/api/health-db`, cron heartbeats, upstream circuit breaker (5).

**Neon database structure (Bob asked for these specifically; no vendor change):** add the missing `chat_messages` DDL with `(user_id)` and `(created_at)` indexes (3.9); add `(user_id, kind)` on `generation_events` and bound the percentile queries (5); materialize `users.last_activity_at` and stop the per-request session UPDATE from being the activity signal (3.11); one nightly cleanup cron for expired `sessions`, `magic_link_tokens`, `oauth_codes`, `oauth_tokens` and a retention window on `analytics_events` (3.10); a `profile_state_snapshots` table written nightly, plus confirming the Neon PITR window (2.6); hash `sessions.token` (2.4); finish the saved_playbooks migration by moving every reader to the table (2.7); and, as the structural step, split generated `outputs` out of the autosave blob into their own per-record rows so a Personal Brand is never rewritten by a notice being dismissed (2.5). Nightly rollup tables for the dashboards replace the full-table `acts` CTE (5).

**Later:** retired-code sweep including the five-phase demo persona and its `/demo` redirect (confirmed by Bob), `README.md` in migrations, the `voice-allow` scope statement, sign-in-mid-edit recovery (4.4), OAuth refresh-reuse detection and client-registration throttle, MCP `add_interviewers` array cap.

### 7.2 Architecture: move generation orchestration server-side

One change resolves the largest cluster: a `generations` table and a server endpoint per step that builds the prompt from `profile_state` and the request's named fields, calls Anthropic, persists the result to the record, and returns it. The client sends `{step, recordId, options}` and polls or subscribes. What it buys, all at once: the prompts leave the public bundle; the anonymous proxy problem disappears because there is no generic proxy; every generation is attributed by construction; the profile block is built once server-side and cached deterministically (the way `coach.js` already does it); a finished build survives a reload and a slot switch; max_tokens and effort floors live in one place instead of being patched server-side for stale bundles (`api/claude.js:583-601`); the voice gate, citation gate, and retries run where their cost can be capped; and the SYS duplication gate retires. Streaming can be added per step afterward without the browser owning the loop. This is the same move the My Coach brief made for capture: keep the model's judgment where it is, make the transport deterministic and owned by the server.

Sequencing suggestion: land 7.1's launch-blocking tier first, since it makes the current proxy safe enough to launch on, then migrate steps to the new endpoint one at a time starting with the four web-search-heavy ones (company read, GTM, salary read, groups/resources), where the cost and attribution gains are largest.

### 7.3 Strategic intent

- **Decide the GA feature set before launch.** Nine pilots, all on for Bob, none for the 145. Each is either in the launch (guide chapter lands, flag comes off) or out (flag stays, comms say so). A launch with Bob's product and the users' product still different is the QA problem from the Coach brief at full scale.
- **Accept that Coach is the cost center and price accordingly.** At 54% of spend and $1.27 per session, Coach is the feature the donor model has to carry. The two cache changes in 6.3 are the difference between $5.9 and roughly $3.5 per MAU; decide whether Coach's session-open and orientation checks are worth their price at GA before flipping those flags.
- **Write the retention and backup policy down.** `chat_messages` keeps every question and reply with no TTL; the privacy page should say so or the table should age out. The backup answer should be one sentence Bob can say to a user who asks.
- **Retire what was retired, and only that.** The five-phase demo persona (Bob confirmed), `p10`, the `pe_v3` era, test mode, the legacy checkin keys, and the `savedPlaybooks` blob readers are all shipped weight from decisions already reversed. One sweep PR per group, after the launch-blocking tier. Features with low usage stay: Bob reads low usage as a discovery problem, not a value signal, and the My Coach rewiring exists to fix discovery. Do not propose feature removal on usage grounds.
- **Apply the batch rule to the whole app, not just Coach.** 132 PRs in the first week of September is the cadence that produced 2.7 (a migration whose second half never landed) and 2.9 (a cost-attribution fix that shipped without the sites it was meant to cover). A launch freeze window with one named SHA under QA, then batches, is the operational form of the rule already in `CLAUDE.md` §8.

---

## 8. Sequencing

1. Launch-blocking tier of 7.1, nine PRs, in the order listed. Nothing else merges until these are on `main` and smoked.
2. The three cost levers (Coach cache layout, trimmed silent turns, web-search bounds) as their own batch, since they are what bring the model under Bob's $3 line and none is user-visible.
3. Before-launch tier of 7.1 in batches of four to five PRs, QA against a named SHA between batches.
4. Bob's go/no-go on 7.2 timing; if before launch, the four web-search steps first.
5. Launch freeze: one SHA, one QA pass, GA flag decisions applied, retention and backup policy published.
6. Later tier and the retired-code sweep after launch, in batches.

---

## 9. Out of scope and not verified

- No production data was read; every number in Section 6 is an estimate from prompt sizes and price tables. The Economics dashboard's per-step medians are the instrument to replace them once every call site is tagged (2.9).
- Plausible, not independently re-verified: the Vercel edge normalizing `x-forwarded-host` (2.3), the exact index set on the live `chat_messages` table (3.9), Neon's PITR window on the current plan (2.6), and the bundle composition beyond what `vite build` printed (4.2).
- The generation prompts' content and voice were not reviewed; this brief is about plumbing, cost, and safety.
- User-guide and Coach-knowledge currency for the launch GA set is a separate workstream already logged in open commitments.

## Static gates for the PRs that follow

`npm run build` clean; `check-voice` 0/0; `check-prompt-refs` 0; `check-coach-nav-map` clean; App.jsx line count and EOF verified before and after any edit; every `api/*` PR smoked on the `reimagine2` preview; every new behavioral test added to `npm test`; migrations forward-only and idempotent; no effort estimates anywhere. Follow §9's PR flow.
