# Concierge Moment Engine — Map

**Status (PR 2, 2026-09-12): done.** Section 4's finding — 7 hand-typed
`if(!hydrationStable)return` guards, all reading the one shared value — has
been acted on: those 7 sites now call a single `useHydrationGatedEffect`
wrapper (declared immediately after `hydrationStable` itself, `src/App.jsx`)
instead of hand-writing the guard and remembering to add `hydrationStable`
to their own dependency array. Section 4 below is left as the audit found
it (the historical "why" and the site-by-site reasoning still apply); it is
not rewritten line-number-by-line-number for the new shape. The three
non-effect sites it named as untouched — the evaluator's ctx pass-through,
`showMoveAnnounce`, and the one inline JSX condition — are still untouched,
as planned.

Architecture audit, F2 (2026-09-12). This is documentation only — it changes
no behavior. It exists because two nights running produced two different
explanations for the same live symptom (Delivery/Next move silent on a fresh
opportunity — F1 items 1 and 3, 2026-09-11), and because `hydrationStable`
turned out to be checked at enough independent call sites that nobody could
say from memory how many there were or whether they all meant the same
thing. Section 4 below settles that count from the actual source, not from
memory.

**Source of truth.** Every fact below was read directly from `src/coach-
moments.js` (the catalog) and `src/App.jsx` (the evaluator + the state each
entry's `eligible()` reads) on 2026-09-12, at commit `6f2bd1b` (PR #899,
"Opportunity Playbook arrival: ask where a stage-less record stands").
Re-verify against current line numbers before trusting them on a future
read — `scripts/check-concierge-moment-map.mjs` (added by this same PR)
only guarantees the **key list** below still matches `MOMENT_CATALOG`
exactly; it does not check that eligibility descriptions or line numbers
are still accurate after a later edit. Treat drift in those as expected
and re-derive them, the same way this document was built.

---

## 1. How the evaluator works (cross-cutting, applies to every entry)

One `useEffect` (`src/App.jsx`, the block starting `// Coach-as-Concierge
Phase 2a/2b: the Moments evaluator`, currently lines 10086-10443) runs on
every render where any of its dependencies change. Each pass:

1. Bails out entirely if `isDemo||isTest`, no `signedInUser`, or
   `coachDistressHold` is set (line 10093) — a hard hold that beats every
   entry, including a significant one that would otherwise reopen a
   minimized panel. `coachDistressHold`/`coachMoodHold` are declared at
   lines 7969-7970.
2. Computes a set of **derived targets** used by more than one catalog
   entry, so entries stay declarative and never re-derive them:
   `nextMoveTarget` (10115), `stallEligible`/`stallTarget` (10147/10153),
   `opNearestRecord`/`opPipelineArrivalCopy` (10164/10170), `opRecord`
   (10220), `opNextMoveTarget` (10279), `opInterviewCloseTarget` (10307),
   `opResumeJumpTarget` (10335), `viewedSection` (10351, reads
   `activeSectionRef.current`), `opArrivalFired` (10357), `opAutoBuildActive`
   (10372), `opStageQuickReplies` (10379).
3. Builds `ctx` (line 10380-10381) — the single object every catalog
   entry's `eligible`/`dedupeKey`/`dedupeValue`/`message`/`quickReplies`/
   `onTap`/`momentContext`/`selfOpenReason` functions receive. Section 3's
   per-entry tables cross-reference every field this object carries.
4. Loops `MOMENT_CATALOG` in file order (line 10383). Per entry: screen
   match (`entry.screen` string or array, line 10384), the discouragement
   hold (`coachMoodHold`, held families are everything except
   `delivery`/`choice`, line 10390), a legacy one-off guard for
   `ptw-arrival` (10395), then `entry.eligible(ctx)` (10400) — **in that
   order**, deliberately: some entries' `dedupeValue` assumes the same
   non-null value `eligible()` already checked for, and will throw if
   evaluated first (comment at 10396-10399).
5. Eligible entries become candidates, each carrying its resolved
   `dedupeKey`/`dedupeValue` (10401-10412), with a legacy-shape fallback
   for `coachMoments` records written before per-sub-key dedupe existed
   (10403-10408).
6. Candidates sort by `priority` descending (10414); the top one fires,
   unless a generated moment's fetch is already in flight
   (`momentInFlightRef`, 10426) — in which case nothing fires this pass and
   the same candidate is re-considered the instant that fetch settles
   (`momentReevalTick`).
7. The dedupe record is written optimistically (10429) before firing, then
   `fireMoment` (generated entries, POSTs to `/api/coach`) or
   `fireStaticEntryMessage` (static entries) actually pushes the message.

`fireMoment` itself (line 9954) is a separate function, not part of the
evaluator effect — it owns the `/api/coach` POST, the offer-detection regex
(`DELIVERY_OFFER_RE`), the shared Remind-me-later/Minimize quick-reply pair
(gated by the new-this-audit-cycle `remindLater` field, see F1 item 2), and
the Row C self-open explanation hookup.

A **second, independent ctx** exists for taps: the generic `moment:`
checkin-key tap handler (line 8536) builds its own object —
`{markDone,addNewOpportunity,advance,genSec,isIndependent,savePursuit,
openOpRecord,generateOpSectionFor,opNextMoveOnTap,opInterviewCloseOnTap,
opResumeJumpOnTap}` — passed to `entry.onTap`. This is **not** the same
object as the evaluator's `ctx`; it carries only what a tap handler needs,
each function re-deriving fresh state at tap time rather than closing over
the evaluator's now-stale locals (comment at 8531-8535). A future entry
that tries to read an evaluator-only field (say, `ctx.opRecord`) from
inside its own `onTap` will get `undefined` — this split is why.

---

## 2. MOMENT_CATALOG entries

31 entries, in file order. `screen` is the step id the evaluator must be on
(or, for `op-interview-close`, one of an array of steps). `dedupeKey`
`'(none)'` means the default subkey `'_'` applies (fire once per account,
ever). All `eligible` expressions below are the literal source from
`src/coach-moments.js` as of this audit.

| # | key | screen | family / significance | priority | generated? | dedupeKey |
|---|-----|--------|------------------------|----------|------------|-----------|
| 1 | `coach-intro` | welcome | arrival / ordinary | 1 | no | (none) |
| 2 | `coach-minimize-intro` | *(null — fired directly, not evaluator-scoped)* | panel / ordinary | 1 | no | (none) |
| 3 | `coach-self-open-explained` | *(null — fired directly)* | panel / ordinary | 1 | no | (none) |
| 4 | `ptw-arrival` | twoDoors | arrival / ordinary | 1 | no | (none) |
| 5 | `career-paths-arrival` | laneSelect | arrival / ordinary | 1 | no | (none) |
| 6 | `ecosystem-suggest` | laneSelect | arrival / **open** | 1 | no | (none) |
| 7 | `choice-lane` | p4 | choice / open | 2 | **yes** | `ctx.selectedLane` |
| 8 | `choice-role` | focus | choice / open | 2 | **yes** | `` `${selectedLane}::${chosen}` `` |
| 9 | `delivery-p5` | focus | delivery / open | 3 | **yes** | `` `${selectedLane}::${chosen}` `` |
| 10 | `delivery-p6` | focus | delivery / open | 3 | **yes** | `` `${selectedLane}::${chosen}` `` |
| 11 | `delivery-p9` | focus | delivery / open | 3 | **yes** | `` `${selectedLane}::${chosen}` `` |
| 12 | `delivery-salaryRead` | focus | delivery / open | 3 | **yes** | `` `${selectedLane}::${chosen}` `` |
| 13 | `delivery-p11` | focus | delivery / open | 3 | **yes** | `` `${selectedLane}::${chosen}` `` |
| 14 | `delivery-p_res` | focus | delivery / open | 3 | **yes** | `` `${selectedLane}::${chosen}` `` |
| 15 | `delivery-p8` | focus | delivery / open | 3 | **yes** | `` `${selectedLane}::${chosen}` `` |
| 16 | `delivery-p7` | focus | delivery / open | 3 | **yes** | `` `${selectedLane}::${chosen}` `` |
| 17 | `delivery-income` | focus | delivery / open | 3 | **yes** | `` `${selectedLane}::${chosen}` `` |
| 18 | `next-move` | focus | next_move / ordinary | 2 | **yes** | `` `${selectedLane}::${chosen}` `` |
| 19 | `stall` | focus | stall / ordinary | 1 | no | `` `${selectedLane}::${chosen}` `` |
| 20 | `op-pipeline-arrival` | pipeline | arrival / ordinary | 1 | no | (none) |
| 21 | `op-playbook-arrival` | op | arrival / ordinary | 1 | no | `ctx.opRecord.id` |
| 22 | `delivery-op-companyRead` | op | delivery / open | 3 | **yes** | `ctx.opRecord.id` |
| 23 | `delivery-op-salaryRead` | op | delivery / open | 3 | **yes** | `ctx.opRecord.id` |
| 24 | `delivery-op-p5` | op | delivery / open | 3 | **yes** | `ctx.opRecord.id` |
| 25 | `delivery-op-p_res` | op | delivery / open | 3 | **yes** | `ctx.opRecord.id` |
| 26 | `delivery-op-p_cover` | op | delivery / open | 3 | **yes** | `ctx.opRecord.id` |
| 27 | `delivery-op-p11` | op | delivery / open | 3 | **yes** | `ctx.opRecord.id` |
| 28 | `delivery-op-offerNegotiation` | op | delivery / open | 3 | **yes** | `ctx.opRecord.id` |
| 29 | `op-next-move` | op | next_move / ordinary | 2 | **yes** | `ctx.opNextMoveTarget.recordId` |
| 30 | `op-interview-close` | [pipeline, op] | check / open | 2 | no | `ctx.opInterviewCloseTarget.recordId` |
| 31 | `op-resume-jump` | op | next_move / ordinary | 2 | no | `ctx.opResumeJumpTarget.lane` |

(Numbered 1-31 for reference in this doc, matching `MOMENT_CATALOG`'s own
31 array entries exactly. `scripts/check-concierge-moment-map.mjs` checks
the machine-readable key list below against the live array, not this
table's row numbering — a future entry added or removed here should keep
that list in sync; the numbering above is free-standing prose, not
re-checked by the script.)

<!-- moment-catalog-keys:START -->
```json
["coach-intro","coach-minimize-intro","coach-self-open-explained","ptw-arrival","career-paths-arrival","ecosystem-suggest","choice-lane","choice-role","delivery-p5","delivery-p6","delivery-p9","delivery-salaryRead","delivery-p11","delivery-p_res","delivery-p8","delivery-p7","delivery-income","next-move","stall","op-pipeline-arrival","op-playbook-arrival","delivery-op-companyRead","delivery-op-salaryRead","delivery-op-p5","delivery-op-p_res","delivery-op-p_cover","delivery-op-p11","delivery-op-offerNegotiation","op-next-move","op-interview-close","op-resume-jump"]
```
<!-- moment-catalog-keys:END -->

### 2.1 Eligibility, in plain English and as written

**`coach-intro`** — First-ever visit to Welcome, once the app is sure this
isn't a returning account whose real state just hasn't loaded yet.
`eligible: (ctx) => !!ctx.hasOnboardingConcierge && !!ctx.hydrationStable && ctx.done.length === 0 && !(ctx.outputs && ctx.outputs.p3)`

**`coach-minimize-intro`** / **`coach-self-open-explained`** — Not reached
through the evaluator loop at all (`screen: null` never matches a real
step). Fired directly by two small effects near `beginCoachMinimize`/
`beginCoachRestore` (panel open→closed and closed→open transitions) and by
`maybeFireSelfOpenExplanation` respectively. Their own `eligible` functions
(`!!ctx.hasOnboardingConcierge` and `() => false`) are formalities, not live
gates — noted in the source's own comments.

**`ptw-arrival`** — Arriving at the two-doors screen with a built Personal
Brand. `eligible: (ctx) => !!ctx.hasOnboardingConcierge && !!(ctx.outputs && ctx.outputs.p3)`

**`career-paths-arrival`** — Any arrival at Career Paths.
`eligible: (ctx) => !!ctx.hasOnboardingConcierge`

**`ecosystem-suggest`** — Career Paths arrival, Industry Insider pilot flag
on, and the account hasn't opened Industry Insider yet.
`eligible: (ctx) => !!ctx.hasIndustryEcosystemView && !(ctx.outputs && ctx.outputs.p4 && ctx.outputs.p4.insider)`
Note this is the one entry gated on a **different** flag
(`hasIndustryEcosystemView`) than every other entry's `hasOnboardingConcierge`
— a deliberate, independently-toggled pilot, not an oversight (source
comment, lines 236-240).

**`choice-lane`** — A lane has just been picked on Career Paths.
`eligible: (ctx) => !!ctx.hasOnboardingConcierge && !!ctx.selectedLane`

**`choice-role`** — A role has just been picked within a lane.
`eligible: (ctx) => !!ctx.hasOnboardingConcierge && !!ctx.chosen && !!ctx.selectedLane`

**`delivery-p5`/`p6`/`p9`/`salaryRead`/`p11`/`p_res`/`p8`/`p7`/`income`** —
Nine near-identical entries, one per Focus Playbook card. Each requires the
card's own `outputs.<key>` to be non-empty, a role chosen, AND
`ctx.viewedSection === '<key>'` (the person is actually looking at that
card, not just that it built somewhere off-screen). Example
(`delivery-p5`): `eligible: (ctx) => !!ctx.hasOnboardingConcierge && !!(ctx.outputs && ctx.outputs.p5) && !!ctx.chosen && ctx.viewedSection === 'p5'`.
`delivery-p6` additionally routes both its dedupe comparison and its
model-visible text through `ctx.bridgeStoryToProse` rather than the raw
`outputs.p6`, because that field can be a pre-2026-05-31 wrapped object
(comment at 317-323) — the one Focus-side Delivery entry with an extra
normalization step.

**`next-move`** — There is a resolved next section to suggest.
`eligible: (ctx) => !!ctx.hasOnboardingConcierge && !!ctx.nextMoveTarget`
`nextMoveTarget` (computed once, App.jsx 10115-10128) is non-null only once
at least one Focus-side Delivery has fired for the current identity (it
anchors on the delivery-* entry with the latest `firedAt`) — so Stall and
Next move can never both be eligible for the same identity in the same
pass (comment at 10129-10136 spells out why they're mutually exclusive by
construction).

**`stall`** — Nothing built past the free first section, for 3+ visits or
90s idle. `eligible: (ctx) => !!ctx.hasOnboardingConcierge && !!ctx.stallEligible`

**`op-pipeline-arrival`** — Any arrival at My Pipeline.
`eligible: (ctx) => !!ctx.hasOnboardingConcierge`

**`op-playbook-arrival`** — Arriving at (or returning to) a specific
Opportunity Playbook record, once two independent async things have
settled: the pursuit-status fetch (`pursuitStatusLoaded`) AND the top-down
auto-build cascade for a freshly-added record (`opAutoBuildActive`).
`eligible: (ctx) => !!ctx.hasOnboardingConcierge && !!ctx.opRecord && !!ctx.pursuitStatusLoaded && !ctx.opAutoBuildActive`
This is the entry both F1 items 2 and 3 (2026-09-11 evening) and the
production Imerys/Lindsey fix (2026-09-10) all touched — see its own
in-source comment block (lines 558-580) for the two races it now guards
against, and Section 5 below for the pattern this leaves behind.

**`delivery-op-companyRead`/`salaryRead`/`p5`/`p_res`/`p_cover`/`p11`/
`offerNegotiation`** — Seven near-identical entries, one per Opportunity
Playbook card, requiring the card built, in view, AND
`ctx.opArrivalFired` — the arrival must have already rendered for this
record before any op-side Delivery can. Example (`delivery-op-p_cover`):
`eligible: (ctx) => !!ctx.hasOnboardingConcierge && !!ctx.opRecord && ctx.opRecord.cardBuilt('p_cover') && ctx.viewedSection === 'p_cover' && ctx.opArrivalFired`

**`op-next-move`** — A stage-fitting next card exists that differs from
whatever Delivery just reacted to. `eligible: (ctx) => !!ctx.hasOnboardingConcierge && !!ctx.opNextMoveTarget`
`opNextMoveTarget` (App.jsx 10279-10300) is `null` whenever
`opPickByStage` (10191-10205) returns `null` — which it does for an unset
stage, `'researching'`, or `'phone_screen'` (only `applied`/
`interviewing`/`final_round`/`offer` map to a pick). **This is the literal
mechanism behind F1 item 1's "Next move never fires" finding**: a fresh
record has no stage, so this is never eligible until a stage is set — by
design after F1 item 3, not a bug in itself, but see Section 5's note on
PR 3's job.

**`op-interview-close`** — An interview inside 3 days on any active
opportunity. `eligible: (ctx) => !!ctx.hasOnboardingConcierge && !!ctx.opInterviewCloseTarget`.
The one entry whose `screen` is an array (`['pipeline','op']`) rather than
a single step — the evaluator's screen match (line 10384) was extended for
this row specifically.

**`op-resume-jump`** — A door2 record's lane has a matching door1 Focus
Playbook with no Resume Refresh built yet.
`eligible: (ctx) => !!ctx.hasOnboardingConcierge && !!ctx.opResumeJumpTarget`

---

## 3. External flags/refs every `eligible()` reads, cross-referenced

Every field below is read from `ctx`, which is assembled once per
evaluator pass at App.jsx line 10380-10381. "Set at" gives where the
*value* is actually computed or the state hook that backs it, not the
line of the `ctx={...}` literal itself.

| ctx field | set at (src/App.jsx) | what it is |
|---|---|---|
| `hasOnboardingConcierge` | 8140 | `@career.club` email OR the `onboarding_concierge` feature flag |
| `hasIndustryEcosystemView` | 8175 (added to ctx separately, `Object.assign` at 10381 — **not** in the main ctx literal) | `@career.club` OR the `industry_ecosystem_view` flag |
| `hydrationStable` | 7653 (`localHydrationDone&&serverLoadDone`); components at 7645/7646 | see Section 4 — single shared value |
| `pursuitStatusLoaded` | useState declared 8195; set true at 9330 (demo/test) and 9346 (`.finally` on the real `/api/pursuit-status` fetch) | whether the async pursuit-status list has settled |
| `outputs`, `done`, `chosen`, `selectedLane`, `step`, `signedInUser`, `savedPlaybooks` | 7551, 7560, 7562, 7563, 7549, 7875, 7579 | core app state, `useState` |
| `isIndependent` | 8181 | practice-track detection (`signedInUser.track===TRACK_INDEPENDENT` or a URL param pre-signin) |
| `laneLabelFor` | 5982 | `LANE_LABELS[ln]` lookup |
| `focusLabelFor` | 6630 | `NAV_LABELS`/`INDEPENDENT_SECTION_LABELS` lookup |
| `bridgeStoryToProse` | 1453 | normalizes p6's pre/post-2026-05-31 wrapped-object shape |
| `markDone` | 11209 | `setDone` + `section_completed` tracking |
| `addNewOpportunity` | 15361 | starts the Add-an-Opportunity flow |
| `advance` | 11345 | screen-to-screen navigation |
| `genSec` | 14209 | starts a Focus-side section generation |
| `nextMoveTarget` | computed 10115-10128 | Focus-side "what's next" (reads `coachMoments`, `focusOrderFor`, `done`) |
| `stallEligible` / `stallTarget` | computed 10147-10153 | "nothing built past the free first section" + which section Stall offers |
| `opHasRecords` | inline in the ctx literal (`!!opActiveRecords.length`) | whether any door2 record is active |
| `opNearestRecord` / `opPipelineArrivalCopy` | computed 10164-10172 | My Pipeline arrival's nearest-record pick + its copy |
| `opRecord` | computed 10220-10272 | the currently-open Opportunity Playbook record, or `null`; carries `cardBuilt`/`cardText`/`cardLabel`/`arrivalTarget`/`arrivalPick`/`arrivalCopy`/`stage` |
| `opNextMoveTarget` | computed 10279-10300 | stage-fitting next pick for the open record (uses `opPickByStage`, 10191-10205) |
| `opInterviewCloseTarget` | computed 10307-10328 | soonest qualifying interview within 3 days across all active records |
| `opResumeJumpTarget` | computed 10335-10341 | matching door1 record with no Resume Refresh built |
| `viewedSection` | 10351 | `activeSectionRef.current` — the section actually in view, read live per the "Situation is a projection of app state" principle (CLAUDE.md §8) |
| `opArrivalFired` | computed 10357 | whether `op-playbook-arrival` has already fired for this record (reads `coachMoments['op-playbook-arrival']`) |
| `opAutoBuildActive` | computed 10372 (reads `_pendingAutoBuildRef` 13391, `opBuildingSlot` 12770, `opSectionBuilding` 12748) | true from auto-build queue start through The Role's build completion |
| `opStageQuickReplies` | computed 10379 (calls `pursuitStageQuickReplies`, 5138, gated on `!opRecord.stage`) | the one-tap stage picker offered when a record has no stage yet |
| `setSelectedLane` | 7563 (the setter half of the `selectedLane` useState) | added via the same `Object.assign` as `hasIndustryEcosystemView` |

Tap-only fields (available inside `onTap`, not inside `eligible`/
`message`/`quickReplies` — see Section 1's note on the two separate ctx
objects): `savePursuit` (8215), `openOpRecord`/`generateOpSectionFor`/
`opNextMoveOnTap`/`opInterviewCloseOnTap`/`opResumeJumpOnTap` (8537-8564,
each re-deriving state fresh at tap time).

---

## 4. `hydrationStable` check sites

**The actual count in `src/App.jsx` is 10 decision sites, not 24.** This
matters: the premise going into this audit was that `hydrationStable` is
"checked independently in 24 places... rather than owned by one thing."
What's actually true, read from the source: `hydrationStable` is declared
**exactly once** (line 7653, `const hydrationStable=localHydrationDone&&
serverLoadDone`), and every one of the 10 sites below reads that same
JS binding by name — none of them re-derive the value with their own
formula. There is one shared source today; there is no divergent
computation to unify. (The literal token `hydrationStable` appears 28
times in the file; the other 18 are the declaration itself, 9 explanatory
comments, and 8 `useEffect` dependency-array entries that must name it so
React re-runs the effect once it flips — none of those are independent
checks.)

| # | line | guards | shared or local? |
|---|------|--------|-------------------|
| 1 | 9373 | orphan-reconcile effect (`api/pursuit-status.js` POST) — the F1 item 3 fix from the prior session | shared (`if(!hydrationStable)return`) |
| 2 | 10380 (passed into evaluator `ctx`) → read at `coach-moments.js:113` | `coach-intro`'s own `eligible()` | shared, one hop through `ctx` |
| 3 | 10608 | one-time search-intake prompt effect | shared |
| 4 | 10957 | orientation-check catch-up effect (8 screen-tied fields) | shared |
| 5 | 10970 | `showMoveAnnounce` (a plain `const`, not an effect — read directly in the JSX modal condition) | shared, combined with `tableHydrateDone` (see below) |
| 6 | 10979 | p3-inputs baseline snapshot effect | shared |
| 7 | 10993 | returning-user landing-decision effect | shared |
| 8 | 11024 | `currentSavedSlotIdRef` re-link-after-hydration effect | shared |
| 9 | 11051 | archived-playbook 90-day auto-purge effect | shared |
| 10 | 18701 | support-announce modal, inline JSX condition | shared |

**So what does PR 2 actually refactor, if the value isn't duplicated?**
The repetition that exists is the **guard clause shape** — 7 of the 10
sites hand-write `if(!hydrationStable)return` (or a compound version) as
the first line of a `useEffect`, and separately remember to add
`hydrationStable` to that effect's own dependency array. Nothing stops a
new effect from being added without either line — which is exactly what
happened (see Section 5's first finding). PR 2's job is to make *adding
the guard* automatic rather than a hand-typed convention, not to collapse
a duplicated boolean that turns out not to exist.

**Two related-but-deliberately-distinct signals, not folded in:**
- `serverLoadOk`/`serverLoadOkRef` (7669-7670) — distinct from
  `serverLoadDone`: true only when `/api/profile/load` succeeded, not
  merely completed. Used by the autosave push gate (`canPushProfile`,
  10833) so a failed load can't get overwritten by default local state.
  This answers a different question than "has hydration settled" and
  should stay separate.
- `tableHydrateDone` (10881) — waits on `serverLoadDone` alone (10886), not
  full `hydrationStable`, because it only depends on the server round
  trip, not `localStorage`. `showMoveAnnounce` (site #5 above) legitimately
  needs *both* `hydrationStable` and `tableHydrateDone` together (comment
  at 10966-10969) since `savedPlaybooks` arrives from the per-record table
  after the profile load settles.

---

## 5. Other scattered-logic patterns worth a later pass

Named per this audit's instructions, not fixed here.

1. **A real, live hydration-timing bug, same shape as the one already
   fixed five times over.** The one-tap **employment-status** prompt
   effect (App.jsx, `useEffect` at line 10554) has **no `hydrationStable`
   guard at all** — `employmentStatus`/`seenEmploymentPrompt` both start at
   their empty/false defaults on every mount, the identical race the
   **search-intake** effect immediately below it (line 10595) was
   given this exact guard for. That fix's own comment (lines 10601-10608)
   even says "same reasoning as the employment prompt above" while
   describing a gate the employment prompt itself does not have. A
   returning account whose real `employmentStatus` hasn't loaded yet can
   still be asked a question it already answered. Worth its own ticket,
   not rolled into PR 2 (PR 2 is a no-behavior-change refactor; adding a
   guard here is a behavior change).
2. **The Focus-side identity key `` `${selectedLane}::${chosen}` `` is a
   hand-typed literal in 10 separate places** in `coach-moments.js`
   (`choice-role`, `delivery-p5/p6/p9/salaryRead/p11/p_res/p8/p7/income`,
   `next-move`, `stall` — see the dedupeKey column in Section 2's table).
   A typo in any one of them (e.g. `${chosen}::${selectedLane}`, reversed)
   would silently create a second, never-reconciled dedupe identity for
   that one entry. A shared `focusIdentityKey(ctx)` helper would remove
   the duplication; not proposed here since nothing found so far shows it
   has actually drifted.
3. **The seven `delivery-op-*` entries are near-identical, parameterized
   only by card key**, and the file's own header comment (lines 634-641)
   calls this "the same literal, un-factored shape" on purpose, to keep a
   build on one card from ever being able to suppress or be confused with
   another. That reasoning is sound for `eligible`/`dedupeKey`, but the
   nine Focus-side `delivery-*` entries and the op-side entries duplicate
   nearly the same five-line shape independently on each side rather than
   through one parameterized factory — worth a future look now that F1's
   two-nights-of-fixes shows how much surface a genuine per-entry-type bug
   can have (`opAutoBuildActive`, `pursuitStatusLoaded`, and the
   schema-version fix all had to be threaded through every op- entry
   individually). Not proposed as a refactor here — it would touch
   `eligible()` bodies, which is real behavior surface, not the
   docs-and-guard-clause scope of this three-PR pass.

---

## 6. Keeping this file honest

`scripts/check-concierge-moment-map.mjs` (prebuild) reads the JSON block in
Section 2 and asserts it is exactly `MOMENT_CATALOG.map(e => e.key)`, in
the same order, straight from `src/coach-moments.js`. It fails the build
the moment a key is added, removed, or renamed here without this document
being updated to match — the same "cannot silently drift" guarantee
`check-coach-nav-map.mjs` already gives `src/coach-nav-map.js`. It does
**not** check that the eligibility prose, line numbers, or the Section 4/5
narrative are still accurate; those require a human re-read the next time
this file is touched.
