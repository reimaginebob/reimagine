# Session continuity note — Coach chat capture/deletion work + decline tracking

**What this file is.** Not a Cowork implementation brief (see `Output/handoff/` for that format —
this doesn't follow its shape on purpose). This is one Claude Code session briefing whoever
picks this thread up next — same session later, or a fresh one — after this conversation had
already been through a couple of auto-compactions. Bob asked whether that was safe; the honest
answer was "mostly, but write it down while it's still fresh," so here it is. Read this before
trusting any earlier auto-generated summary of this thread.

**How to use it.** Everything below is a claim about what shipped or was decided. Verify against
the actual files before building on top of it — line numbers and exact strings drift as the
codebase moves, same as any brief.

---

## 1. What shipped this session (PRs #762–#767, all merged to `main`)

In order:

1. **#762 — Reputation + Skills capture, Go-to-Market/LinkedIn Remix rework parity, assessType fix.**
   Added `REPUTATION_CAPTURE_NOTE` (replace semantics) and `SKILLS_CAPTURE_NOTE` (append) to
   `api/coach.js`. Extended `SECTION_REWORK_LABELS` to cover p7/p8. Added an `assessType` enum
   field to the Assessment capture trailer.
2. **#763 — Values/Reputation merge-not-overwrite bugfix.** Bob caught that `VALUESCAPTURE`'s tap
   replaces the whole field with exactly what the model just wrote — so someone adding a third
   value months after the first two would silently lose them. Fixed via prompt instruction only
   (reconstruct the complete list from history unless clearly replacing, default to merge when
   ambiguous). No prior test coverage existed for this path; added
   `scripts/test-coach-values-capture.mjs`.
3. **#765 — Priorities & Life Story capture.** Triggered by Bob asking directly whether
   dealBreakers/Life Story were covered by the earlier capture work — they weren't, and my
   original scoping had also mischaracterized which Priorities fields were sliders vs free text
   (compFloor/workReq are plain text; benefitsWeight/riskTolerance are the actual segToggle
   fields). Added `PRIORITIES_CAPTURE_NOTE` and `LIFE_STORY_CAPTURE_NOTE`.
4. **#766 — Tier 1 deletion/retraction.** List-item removal from Values/Reputation/Priorities
   (write-the-complete-list-without-it), a new `SKILLSREMOVE` trailer (Skills' add path is
   append-only so removal needed its own mechanism), `removePeople` added to the existing
   `OPPORTUNITY_UPDATE_CAPTURE_NOTE`, and a new `OPPORTUNITY_ARCHIVE_CAPTURE_NOTE` that routes
   through the existing `deleteFromSavedSet` (same reversible 90-day archive the "Remove from
   pipeline" button already uses — deliberately not a new delete path).
5. **#767 — Close Reason Capture.** New `pursuit_close_reasons` table, new dedicated
   `CLOSE_REASON_CAPTURE_FLAG`/`hasCloseReasonCapture` flag, new `api/pursuit-close-reason.js`
   endpoint, new `src/pursuit-close-reasons.js` canonical taxonomy module. See §3 for why this one
   got its own flag when most of the above reused `hasPipelineCapture`.

Test files added, one per PR: `test-coach-orientation-capture.mjs`, `test-coach-values-capture.mjs`,
`test-coach-priorities-lifestory-capture.mjs`, `test-coach-interview-team-removal.mjs`,
`test-coach-list-removal.mjs`, `test-coach-opportunity-archive.mjs`, `test-coach-close-reason.mjs`.
Several existing tests needed updates because new insertions broke exact-adjacency assertions
(`test-coach-milestone-prompts.mjs`, `test-section-rework.mjs`, `test-assessment-capture.mjs`,
`test-coach-pipeline-checkin.mjs`, `test-coach-milestone-durable-memory.mjs`,
`test-coach-notes-agency.mjs`).

## 2. Patterns established (apply these to future capture/deletion work)

- **Tap-is-the-only-write.** Every capture note ends with a hidden trailer; the server
  strips/validates/headers it; the client renders a one-tap offer; the model never claims to have
  written anything before the tap lands. Every mechanism above follows this.
- **Three field-shape-appropriate write semantics** — pick based on verified field type, not
  assumption (this session's own mis-scoping of Priorities fields is the cautionary example):
  - **Replace**: single-fact fields (Reputation's memory/emergency/twoWords, compFloor, workReq,
    benefitsWeight/riskTolerance via enum match).
  - **Merge** (write the complete reconstructed list, never just today's addition): Values,
    Passions, Reputation's `other`, dealBreakers.
  - **Append** (client-side string concatenation with a separator): Assessment, Life Story.
- **Deletion Tier 1 rules** (cross-cutting, agreed explicitly): every removal is request-only
  (never inferred, never volunteered — stricter than adds), the tap-preview always shows exactly
  what's being removed, and whole-record deletions prefer existing reversible/archive mechanisms
  over new hard deletes.
- **Flag-reuse vs dedicated-flag.** Reuse an existing flag (e.g. `hasPipelineCapture`) when a new
  capture is "the same underlying idea, different surface." Mint a new dedicated flag when the
  risk profile is materially different — Close Reason Capture got its own flag specifically
  because it's the first mechanism designed so its bounded category could be looked at in
  aggregate across every account on a later date. That's a different privacy posture than
  per-account coaching content, even though the write path looks similar.

## 3. Known, deliberately-deferred issue: first-match opportunity resolution

All five opportunity-resolution mechanisms (`opportunity-archive`, `opportunity-update`,
`opportunity-context`, `op-card-rework`, `interview-team`) use the identical pattern
`activePlaybooks.find(r=>r&&r.source==='door2'&&String(r.title||'').toLowerCase().includes(oppName))`
— silently picks the FIRST match on an ambiguous/duplicate title, never asks to disambiguate.
Confirmed systemic across all five by direct investigation. Not fixed. Flagged as its own future
brief (a shared resolver returning unique/ambiguous/absent), not scheduled.

Also confirmed in passing: renaming an opportunity already exists in the product
(`renameSavedPlaybook`, `src/App.jsx` ~12601–12608; click-to-edit title on My Pipeline ~12858–12864)
— so Coach can honestly reference this capability if a brief ever wants it to.

## 4. Close-reason taxonomy (`src/pursuit-close-reasons.js`)

27 bounded codes + an `initiated_by` field (`employer|candidate|external|mutual|unknown`). Built
through several rounds with Bob directly and one round via a document Bob sourced from external
research (referred to in this thread as "Cowork" / "sibling"). Design principles, in case a future
edit needs to preserve them:

- Every category is a bounded key, never free text — `detail` (free text) is separate and always
  per-account; the bounded `reason_code` is the only thing meant to be aggregated across accounts
  later. This split is what makes future cross-account analysis possible without retrofitting.
- `outcome` (existing `pursuit_status` field) answers WHAT happened; `reason_code` answers WHY, in
  more detail. Some overlap in spirit is fine — different questions.
- Near-duplicate pairs were deliberately KEPT distinct after Bob's coaching-practice experience
  confirmed candidates report all of them specifically: `hiring_freeze` vs. general role pause;
  `internal_candidate_preferred` vs. `role_filled_internally` (before vs. after the fact);
  `ghosted` vs. `employer_non_responsive`.
- The original single `declined_no_reason_given` was direction-ambiguous (also collided with
  `outcome`'s own established meaning of "declined" = candidate declined an offer). Resolved into
  two self-disambiguating codes: `not_selected_no_reason_given` (employer-side) and
  `withdrew_no_reason_given` (candidate-side) — matching how every other code names its own
  direction from the name alone.

## 5. Notes privacy — resolved, not touched further

Confirmed via investigation: Coach does NOT read Notes content at all, ever — only a bare count is
surfaced. The Save-to-Notes disclosure makes no privacy claim, only a retrieval promise. This is
why Close Reason Capture became an entirely new, separately-disclosed mechanism rather than
extending what Notes means — no compromise needed once the actual current behavior was verified
instead of assumed.

## 6. Cowork consult: better-timed proactive prompts (in progress, not yet built)

Bob asked for candor specifically because "we just right-sized the Coach's prompt" — the concern
being prompt-size/reliability cost, not correctness. `api/coach.js` (~lines 60–89) already has a
comment warning that narrow, competing capture instructions degrade reliability as the prompt
grows; that's the concrete grounding for pushing back on any new *mandatory per-turn model
judgment*.

The consult proposed asking for missing profile info (e.g. thin Life Events) at better psychological
moments than cold hub-arrival — reciprocity + progressive profiling, evidence-based (the real
"doorknob phenomenon" from clinical medicine, not the negotiation-literature "Columbo technique,"
which is a different and not-recommended thing). My pushback: the "topic just wrapped" trigger's
*detection mechanism* was unspecified, and every way to detect it costs either a new mandatory
per-turn model judgment or a fragile heuristic — the one part of the proposal that actually carried
a real, unstated cost.

Cowork's reply proposed a genuine third path — two **zero-prompt-cost** signals, no new model
judgment at all:
1. A completed tap-confirm event that already fires client-side (accepting any capture/note/status
   change) — a real instrumented event.
2. A closing-language regex on the user's last message ("thanks," "that helps," "got it," combined
   with it being shorter than Coach's preceding reply) — modeled on the exact same shape as the
   existing `EMPLOYMENT_MENTION_RE`/`STAGE_MENTION_RE` belt-and-suspenders client regexes.

**Bob approved this direction** ("Yeah, let's go ahead and build this") but added a new requirement
in the same message before any code gets written — see §7.

Still deferred, not part of this build: **Values thinness detection** has no existing
`THIN_MIN.values` or equivalent — would need new infrastructure, unlike Life Events which extends
something that already exists.

## 7. OPEN ITEM — decline tracking (design proposed, awaiting Bob's go-ahead on 3 sub-decisions)

Bob's exact ask: track how often people decline these prompts, and whether some prompt/question
*types* get declined more than others — and think it through before building.

**Investigation done:** confirmed zero decline/accept tracking exists anywhere today — every
"Not now" (`value==='dismiss'`) in `src/App.jsx`/`src/components/Chat.jsx` is a pure no-op, nothing
written or counted. Also confirmed a real wrinkle: **not every prompt has a decline button** —
`EMPLOYMENT_QUICK_REPLIES` (`src/App.jsx` ~4719) offers three status buttons and no "Not now" at
all, so for that prompt "decline" can only ever mean silent non-response, never an explicit tap.
`pb-checkin` is free-text reaction via `/api/pb-checkin`, not a quick-reply at all — doesn't fit an
accept/decline binary and should be excluded from this tracking's initial scope.

**Design proposed to Bob (not yet built):**
- New table `coach_prompt_engagement` (same append-only shape as `generation_events`): `user_id`,
  `prompt_code` (bounded enum, new list mirroring `CLOSE_REASON_CODES`'s pattern), `outcome`
  (`shown|accepted|declined`), `created_at`. Indexes on `(prompt_code, outcome, created_at)` and
  `(user_id, created_at)`.
- Write `shown` the instant a prompt fires (fire-and-forget POST, never blocks the UI). Write
  `accepted`/`declined` on tap, based on whether the tapped value was a real answer or an explicit
  dismiss.
- This gives three numbers per prompt type for free without a separate write path: accept rate,
  explicit-decline rate, and "shown but never tapped anything" (the silent-ignore rate) — which for
  a button-less prompt like employment-status *is* the real decline number.
- No new privacy flag needed (unlike Close Reason Capture) — this stores zero content, same risk
  class as `generation_events`, which already ships unflagged.

**Three sub-decisions still waiting on Bob**, stated in my last message before this note was
written:
1. Wire the new instrumentation into just the two brand-new topic-close signals, or also retrofit
   the ~1-line addition onto the existing employment-status/search-intake/opportunity-archive
   branches for a same-day comparative baseline?
2. Confirm this data stays aggregate-only and never feeds back into live Coach behavior for that
   account (that would be a separate "adaptive backoff" feature needing its own design pass).
3. Should there be a per-account fire cap on the repeatable topic-close trigger specifically (it
   isn't one-shot like the profile prompts, so nothing currently stops it firing indefinitely on
   the same account) — independent of whatever the aggregate decline numbers eventually show?

**Do not start building this until Bob answers those three.** That was his explicit condition.

## 8. Other parked work (not touched this session, still valid as of the PRs above)

- **Tier 2 deletion** (clearing a single-value field to nothing — Reputation's
  memory/emergency/twoWords, assessType): parked pending a mechanism decision — today's parser
  can't distinguish "explicitly cleared" from "omitted/unchanged."
- **Tier 3 deletion** (free-text surgery on Assessment/Opportunity Context/Coach Notes): parked,
  needs its own design pass, possibly its own Cowork consult on the matching-precision question.
- **Onboarding Concierge plan** (`/root/.claude/plans/hashed-swimming-balloon.md`, referenced in
  the current plan-mode file at session start): four-piece build (opening explanation, per-step
  narration, Personal Brand delivery moment, "what's already in motion" routing question), gated
  on a new `onboarding_concierge` flag, internal-only. Per the task list carried into this session,
  all four slices plus quality-aware orientation nudging show as completed — verify against
  `api/_lib/feature-flags.js` and the four `useEffect` narration blocks in `src/App.jsx` before
  assuming this is fully done; the task list is a signal, not a substitute for checking the diff.

## 9. Files most likely to matter for whoever picks this up

- `api/coach.js` — every capture note, the trailer parsing, `buildCoachRequest`, the profile-slice
  splice order at the very end of the function.
- `src/App.jsx` — client-side flag mirrors, both `<Chat>` mount sites (embedded + floating, must be
  kept in sync), all `checkinKey==='...'` write branches in the quick-reply handler, the one-time
  disclosure wiring pattern (state+ref pair, both hydration paths, autosave blob + dep array).
- `src/components/Chat.jsx` — quick-reply rendering, `tapQuickReply`, the belt-and-suspenders
  regexes (`EMPLOYMENT_MENTION_RE`, `STAGE_MENTION_RE`).
- `src/pursuit-close-reasons.js`, `api/pursuit-close-reason.js`,
  `migrations/2026-09-07_pursuit-close-reasons.sql` — the close-reason mechanism end to end.
- `api/_lib/feature-flags.js` — every flag, `GRANTABLE_FLAGS`, `isInternalAccount`.
