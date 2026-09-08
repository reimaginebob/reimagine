# Prelaunch audit batch — what shipped, and why it is shaped this way

**Date:** 2026-09-08
**Type:** Reverse handoff (Code → Cowork). Not a brief to implement; a briefing on what now exists.
**Source brief:** `Output/handoff/2026-09-08_reimagine-prelaunch-audit-brief.md`, Section 7.1 "launch-blocking tier" (9 findings) plus the three cost levers in Section 6.3.
**Shipped:** 13 PRs, `main` at freeze SHA `83a2ff9` for the batch, plus one same-day follow-up (`5e6e476`, see §6). All merged, CI-green, smoke-tested where they touched `api/*`.
**Author's note:** written for a Cowork sibling picking this up cold, same convention as `2026-08-22_economics-what-shipped.md`. File paths and PR numbers are given so nothing has to be taken on trust.

---

## 1. What was asked for, and what premise verification changed

The audit's launch-blocking tier named 9 findings in a specific order and its cost-lever section named 3 more. The instruction going in was: premise-verify every finding against current code before touching it, since briefs (this one included) run on a snapshot and the codebase moves.

**Every finding held up as real.** Nothing in the launch-blocking tier turned out to be already-fixed or non-existent the way some audit findings do. What *did* move, repeatedly, was the audit's own line-number citations — the brief was written against an earlier commit, and by the time each PR landed the file had already shifted from the PRs ahead of it in the same batch. Two research agents were used mid-batch specifically to re-map exact current code before editing (finding #2.6's snapshot mechanics, and 6.3's web-search bounds), because line numbers alone were not trustworthy by PR 9 of 12.

**Pattern worth carrying, same lesson as the economics handoff:** a brief's line citations are a pointer into a snapshot, not a fact about current code. Grep for the substance before trusting the number.

---

## 2. What now exists — the 9 launch-blocking findings

| # | Finding | PR | Merge SHA |
|---|---|---|---|
| 2.4 | Hash `sessions.token` | #798 | `c423d1a` |
| 2.1 | `/api/claude` auth + no caller-supplied tools | #799 | `15eaa72` |
| 2.2 | My Coach turns-per-hour cap | #800 | `0f69611` |
| 2.3 | Magic-link abuse hardening | #801 | `ce1879b` |
| 2.5 | Autosave load-success gate + staleness precondition | #802 | `34996d7` |
| 2.8 | Admin auth: token → session + allowlist | #803 | `dd7fee3` |
| 2.7 | Point dashboards/watchdog/cron at `saved_playbooks` | #804 | `7efb1c9` |
| 2.9 | Tag untagged `callClaude` sites + `logGeneration` failure alert | #805 | `4de0d73` |
| 2.6 | Neon PITR doc + nightly `profile_state` snapshot | #806 | `902438b` |

**2.4 — session hashing.** `hashToken` (SHA-256) now sits between the cookie and every `sessions.token` read/write (`createSession`/`getSessionUser`/`deleteSession` in `api/_lib/session.js`). The cookie itself still carries the raw token — only the DB column changed. A migration rehashes existing rows in place, idempotently.

**2.1 — `/api/claude` hardening.** Two real changes, not one: a session is now required (an `EARLY_ORIENTATION_STEPS` allowlist exists for a future genuine pre-signup generation but is empty today — pre-flight found no current designed anonymous flow, only a client bug that could hit the endpoint with no session), and `buildLegacyMessagesAndTools` replaced a `...reqBody` spread that let a caller control `tools`/`output_config`/`max_tokens` directly. A caller-supplied `tools` array is now only a boolean "wants web search" signal; its contents are discarded and replaced server-side.

**2.2 — Coach rate limit.** `COACH_TURN_CAP_HR = 60`, counted from `generation_events` (`kind='coach'`), checked before the profile even loads so a throttled turn costs nothing. Throttles with a 429 ("You have reached the hourly limit…"), not the shared generation cap's account-suspend treatment — Coach is meant to be leaned on continuously, and locking someone out of their own coach for using it as intended would be the wrong failure mode. `@career.club` exempt, fails open on a DB hiccup. 60 is explicitly an unmeasured starting point (comment says so in `api/coach.js`), not a number derived from real Coach traffic.

**2.3 — magic-link hardening.** Per-IP rate limit (fails open on a DB hiccup, same posture as the Coach cap), a name-length cap, host-pinning on the base URL used in the email link, and a fix to a two-greeting escaping bug in the email template.

**2.5 — autosave.** Two coupled changes: the client only unlocks its PUT once `/api/profile/load` has actually returned 200 (`serverLoadOk`, not just "the request completed"), and the server gates the UPDATE atomically on a staleness precondition (`profile_updated_at` sent by the client, checked against the row's own value; 409 + the row's real `updatedAt` on a mismatch). Together these close the window where a stale device could silently clobber newer work saved from another device. A 409 shows the user a Reload path rather than retrying into a loop.

**2.8 — admin auth.** 13 browser-facing admin endpoints moved from a static `ADMIN_TOKEN` (in `localStorage`, one leak = permanent access) to session cookie + an `ADMIN_LOGIN_EMAILS`/`ANALYST_LOGIN_EMAILS` allowlist (new, in `api/_lib/feature-flags.js` — deliberately not colliding with the pre-existing `ADMIN_EMAILS`, which already means something else in 8+ files: analytics-exclusion + ops-alert-recipient list). Two curl-only endpoints with no dashboard UI (`stage-snapshot.js`'s manual escape hatch, `oauth/revoke.js`) deliberately kept `ADMIN_TOKEN` — they were never exposed to the actual vulnerability (a token sitting in browser `localStorage`) — but their compare is now constant-time (`api/_lib/timing-safe.js`).

**2.7 — `saved_playbooks` migration, finishing it.** The table existed and was backfilled (an earlier phase), and the client had already stopped writing `savedPlaybooks` into the `profile_state` JSONB blob — but 6 server-side readers (dashboards, watchdog, two cron jobs) were still reading that now-permanently-stale blob copy. All 6 repointed at the table, straight swap with no new filters introduced (confirmed no reader had ever filtered on `archived_at`, so none was added). The dead merge-on-save shim in `api/profile/save.js` was removed in the same PR.

**2.9 — cost attribution + alerting.** 14 `callClaude` sites in `src/App.jsx` were untagged (`kind = NULL` in `generation_events`), which the audit brief characterized as invisible to the cap/watchdog/budget totals — pre-flight found that overstated: none of those three systems filter on `kind` except excluding `'coach'`, so the actual loss was per-feature attribution, not raw spend visibility. Tagged all 14 anyway (real diagnostic value during an incident). Separately, `logGeneration` swallowed every insert failure silently; it now alerts (via the existing `alertOnce` dedupe pattern) after 5 consecutive failures, itself wrapped in a try/catch so alerting can never surface to the caller.

**2.6 — Neon PITR + nightly snapshot.** Two parts. The snapshot: `api/admin/profile-snapshot.js`, a new cron (`vercel.json`, 05:00 UTC) that does one unconditional `INSERT ... SELECT` of every account's `profile_state` into a new `profile_state_snapshots` table, nightly. This is the actual per-user restore path — PITR restores the whole database to one moment, not one person's save. The PITR number itself could not be confirmed from the sandbox that built this PR (no Neon console access there); it was documented as unconfirmed in `CLAUDE.md` rather than guessed, and **Bob confirmed it directly the same day: 7 days.** `CLAUDE.md` was updated with the real number in a same-day follow-up PR (#810, `5e6e476`) — see §6.

---

## 3. What now exists — the 3 cost levers

| # | Lever | PR | Merge SHA |
|---|---|---|---|
| 6.3.1 | Coach cache layout reorder | #807 | `5d55e3a` |
| 6.3.2 | Trimmed silent Coach turns | #808 | `cf2bded` |
| 6.3.3 | Web-search `max_uses` + batched verification | #809 | `83a2ff9` |

**6.3.1 — Coach cache reorder.** Before this PR, the step-specific user-guide slice was spliced *inside* the same cached block as the stable persona/posture-rules prefix and the book (`MYOW_CONTENT`, ~228KB) — so every `currentStep` change forced a full rewrite of that whole ~260KB prefix. Split into two breakpoints: `buildSystemPromptStable()` (persona + book, genuinely stable across every step and turn) and `buildGuideBlock(currentStep)` (just the guide slice, the only part that actually varies with the step). Go Independent's framing block and the two pilot-knowledge blocks, which used to be up to two separate optional cache entries, were merged into one (`knowledgeBlock`) to stay inside the Claude API's 4-breakpoint cap now that the guide slice needs its own entry.

**6.3.2 — trimmed silent turns.** Session-open, orientation-check, and post-capture turns are scripted internal instructions the client fires with nobody typing anything — not open-ended coaching questions. They now get `SYSTEM_PROMPT_HEAD` alone (no book, no guide slice) plus the same profile block a real turn gets, and run at `effort: 'low'` instead of `'medium'` (a real user question still gets `'medium'` — the existing in-code reasoning for why Coach avoids `'low'` generally was about open-ended reasoning, which doesn't apply to a turn that's just reacting to a fixed instruction).

**6.3.3 — web-search bounds.** Two changes. First: `max_uses` on the `web_search` tool, which had no cap anywhere in the codebase — a `STEP_MAX_SEARCH_USES` map in `api/claude.js` (mirroring an existing `STEP_MIN_TOKENS` pattern already in that file) sets it per step, evidence-based against every real `webSearch:true` call site rather than guessed (single-fact lookups cap at 2, genuine multi-source research at 6-8, the newly-batched verification steps at 12, anything unlisted falls back to 4 rather than staying unbounded). Premise verification found the audit brief's own citation of *one* tool-declaration site in `api/claude.js` actually missed a second one entirely (a "simplified format" branch kept for callers other than the real client) — both are now covered. Second: Networking Groups and Job Search Resources used to verify every discovered organization with its own separate web-search call (the audit's own "one click is 8 to 11 upstream requests"); both now route through a new `verifyResourceRows` that batches up to 6 organizations into one call — a 14-organization pass drops from 14 calls to 3.

---

## 4. Where the brief was deliberately not followed, or scoped narrower

All judgment calls, all documented in the relevant PR body, all reversible.

**The pause-turn continuation mechanism (mentioned inside 6.3.3's own paragraph) was left alone.** The brief cited it as part of why web-search turns get expensive. It turned out to already be bounded (`MAX_PAUSE_CONTINUATIONS = 3` plus a 200s wall-clock deadline, `api/claude.js`) — not a discrete bug, so treated as context for the fix rather than a fix of its own.

**Narrowing the book (`MYOW_CONTENT`) by step, mentioned alongside 6.3.1, was not done.** `src/coach-guide-resolver.js`'s own header comment says this is deliberately deferred — an editorial call on which book chapters map to which screens is a judgment call on content, not a fact discoverable from the code, and this batch's standing instruction was not to invent values or judgment calls that belong to a human.

**`src/App.jsx`'s own `tools` declaration (Site C, cost lever 6.3.3) got a `max_uses` set to a flat 4, not the step-aware map.** `api/claude.js`'s own comment confirms this array's *contents* are discarded and replaced server-side (the client-sent tools array is only a boolean signal, per the 2.1 hardening) — so the value there never actually reaches Anthropic. Set anyway, with that inertness documented in the code, purely so no `web_search` declaration in the source reads as un-bounded.

**Every PR added its own genuine test**, not just a re-run of the existing suite. Where the underlying code is DB-dependent and can't be imported standalone (most of `api/coach.js`, most of `api/claude.js`'s live-request path), the test is a documented, deliberate combination of a directly-imported/exercised pure function where one exists (e.g. `computeTurnKind`, `maxSearchUsesFor`, `buildLegacyMessagesAndTools` — all already exported or exported in this batch specifically to be testable that way) plus rigorous source-presence regex checks for everything else. `src/App.jsx` can't be imported at all (JSX, no bundler in the test runner), so its logic is guarded by pure re-derivation of the same algorithm plus source-presence on the wiring.

---

## 5. What's confirmed vs. still open

**Confirmed:** every PR passed `npm run test` and `npm run build` (full prebuild gate chain: voice gate, `check-sys-equality`, prompt-refs, coach-nav-map, scope-lenses, orphans, fontsize/btn-prominence ratchets, guide-refs, user-guide-pdf) before merge, and every PR touching `api/*` got the automated smoke check against a Vercel preview (`/api/health`, `/api/claude` both 200) before merge. `src/App.jsx`'s line count and EOF were checked before and after every edit that touched it.

**Not yet confirmed:** none of the cost-lever savings have been measured against real production traffic yet — the audit's own estimates ($0.42 → ~$0.15 per cold Coach turn for 6.3.1, roughly $5.9 → $3.5 per MAU combined for 6.3.1+6.3.2) are the audit's projections, not something this batch measured post-ship. Worth a look at the Economics tab's daily API cost and token-mix panels over the next week or two once these have real traffic behind them.

**The nightly `profile_state_snapshots` table has no restore tooling yet.** It exists and is being written every night (confirmed by the migration applying before build and the cron being registered in `vercel.json`), but nothing reads it back — if someone's save does get corrupted, restoring from it today means a manual query against Neon, not a button anywhere. Out of scope for #806 on purpose; worth a follow-up brief if the risk is real enough to warrant tooling before it's actually needed.

**Snapshot pruning is deliberately deferred** (the audit's own finding #3.10, before-launch tier) — the table has no retention policy yet. Fine at 145 accounts; worth tracking as one of the before-launch-tier items rather than forgetting it.

---

## 6. Same-day follow-up: the PITR number itself

Bob checked the Neon console directly and confirmed the point-in-time recovery window: **7 days**. `CLAUDE.md`'s finding #2.6 bullet and `scripts/test-profile-snapshot.mjs` (which had guarded the "documented as unconfirmed" state) were both updated to match — PR #810, merge SHA `5e6e476`. Small, doc-only change, its own PR since it's outside the 12-PR batch's own scope.

---

## 7. Where things live

| What | Where |
|---|---|
| The source audit | `Output/handoff/2026-09-08_reimagine-prelaunch-audit-brief.md` |
| This document | `Output/handoff/2026-09-08_prelaunch-audit-batch-what-shipped.md` |
| Session hashing | `api/_lib/session.js` |
| `/api/claude` hardening | `api/claude.js` (`buildLegacyMessagesAndTools`, `STEP_MAX_SEARCH_USES`/`maxSearchUsesFor`) |
| Coach rate limit + silent-turn trim | `api/coach.js` (`COACH_TURN_CAP_HR`, `computeTurnKind`, `buildSystemPromptStable`/`buildGuideBlock`) |
| Magic-link hardening | `api/auth/request-link.js`, `check-email.js`, `_lib/email.js`, `_lib/allowed-hosts.js` |
| Autosave staleness | `api/profile/save.js` (`parseIncomingUpdatedAt`), `src/App.jsx` autosave effect |
| Admin auth | `api/_lib/admin-auth.js`, `api/_lib/feature-flags.js` (`ADMIN_LOGIN_EMAILS`/`ANALYST_LOGIN_EMAILS`) |
| `saved_playbooks` readers | `api/admin/{activity-watchdog,analytics,growth,dormant,user-stages,stage-snapshot}.js` |
| Generation attribution + alerting | `src/App.jsx` (`step:` tags), `api/claude.js` (`logGeneration`) |
| Nightly profile snapshot | `api/admin/profile-snapshot.js`, `migrations/2026-09-08_profile-state-snapshots.sql` |
| Networking Groups / Job Search Resources batching | `src/App.jsx` (`verifyResourceRows`, `mergeLivenessResult`, `findJobResources`, `findPathGroups`) |
| PITR window (confirmed) | `CLAUDE.md` §8, "Backup and recovery" bullet |

---

## 8. If you are asked to change something in this area

- **Migrations auto-apply on production deploy.** Shipping the file in the PR is the whole deployment step for `profile_state_snapshots` — never a manual step.
- **`STEP_MAX_SEARCH_USES` and `STEP_MIN_TOKENS`** (`api/claude.js`) are both plain step-name lookup maps with a default fallback — the established pattern for any future per-step numeric tuning in that file. Follow it rather than inventing a new mechanism.
- **`ADMIN_LOGIN_EMAILS`/`ANALYST_LOGIN_EMAILS` are distinct from `ADMIN_EMAILS`.** Don't conflate them — `ADMIN_EMAILS` already means "analytics-exclusion + ops-alert recipient list" in 8+ other files.
- **The 60/hour Coach cap and the per-step `max_uses` values are both starting numbers, not measured ones.** If Coach usage patterns or search-heavy features start hitting either ceiling in practice, that's expected — the fix is to look at real data (Economics tab, or `claude_step_floor`/`claude_truncated`-style event logs) and adjust the map, not to assume the number was wrong on day one.
- **Full gates:** `npm run build` runs the whole prebuild chain. Any PR touching `api/*` needs the smoke check (`npm run smoke:preview -- <url>`, or let the automated CI smoke workflow run) before merge.
