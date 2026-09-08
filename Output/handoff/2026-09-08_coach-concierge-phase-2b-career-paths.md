## Prompt for Code

Draft brief for Phase 2b (Arrival, Choice, and Delivery on Career Paths), following the same process as every prior phase: premise-verify against current `main`, surface real open questions, send back for review before file-level specifics are finalized or any code is written. Three real open questions are named below under "Open questions" — read those before anything else in this brief.

---

## Date / Type / Source

2026-09-08. Implementation brief for Phase 2b, per the design (`Output/handoff/2026-09-08_coach-concierge-design.md`, Sections 5 and 8) and the Phase 2 umbrella brief's split (`Output/handoff/2026-09-08_coach-concierge-phase-2-moments.md`). Written against `main` at `743abaf` (Phase 2a shipped: the `MOMENT_CATALOG`/evaluator core, `coachMoments`, dismissal/quiet, the Put It to Work Arrival moment).

Scope per the split: Arrival, Choice, and Delivery on Career Paths (`laneSelect`/`p4`/`focus`), plus Delivery on the Focus Playbook sections Phase 2a didn't touch. This is where Choice and Delivery need an actual model-generated reaction for the first time — Phase 2a's one moment (Arrival on Put It to Work) was fixed copy.

## Pre-flight discovery (scope correction)

1. **The three `justHappened` triggers map to three existing, unambiguous code paths.** `pickLane(lane)` (`:13866`) sets `selectedLane` and advances `laneSelect`→`p4` — this is `chose_lane`. `switchToRole(title,lane)` (`:13758`) calls `applyRoleSwitchDoor1` and advances `p4`→`focus`, generating `p5` — this is `chose_role`. Both are single, already-centralized call sites; no new event-tracking plumbing is needed to know a choice just happened, only to notice the screen arrived at.

2. **No stable record id exists at the moment Choice fires.** `applyRoleSwitchDoor1` (`:13659`) explicitly sets `currentSavedSlotIdRef.current=null`; a door1 record isn't minted until the first non-`p5` section builds (`afterSectionGenerate`'s `saveCurrentDoor1` call, `:11127`, gated on `key!=='p5'`). The design's literal dedupe key `(family, screen, record.id, section)` doesn't work for Choice, and doesn't work for Delivery on `p5` specifically (the very first section, built automatically by `switchToRole` itself, before any record exists). Fix: key durable dedupe on `${selectedLane}::${chosen}` (the role identity) instead of `record.id` for these two cases — the same natural key `applyRoleSwitchDoor1`'s own existing-record lookup already uses (`activePlaybooks.find(r=>r.source==='door1'&&r.title===chosen&&r.lane===selectedLane)`, `:13664`). Once a record exists, later Delivery entries can key on `record.id` as the design describes.

3. **The server-side reaction-text dispatch is already general — Choice/Delivery extend it, they don't replace it.** `buildOrientationCheckTurnText(step, text)` (`api/coach.js:629`) is a step-keyed switch to a `buildXReactionText(text)` function; `buildBrandRichnessCheckText` (`:626`) is this exact mechanism already doing Delivery's job for Personal Brand ("a judged read of what was just built... framed as an invitation," verbatim the design's Delivery description). Phase 1a's Situation already pins the in-view record (`situationRecordId`) and section (`situationSection`) on every turn, which feeds `buildPlaybookExpansion`'s built/not-built rendering and the `contextNote` line — so the model already knows what's on the table without any new context plumbing. What Phase 2b actually adds server-side is: more `buildXReactionText`-style functions (one per Focus section, following `buildBrandRichnessCheckText`'s template) and a new turn-kind branch analogous to `orientationCheckRequested`, not a new architecture.

4. **Client-side, this now genuinely needs the general catalog Bob approved building in 2a.** Unlike 2a's one static moment, 2b has three families that can all be eligible on the same screen at once (e.g., arriving at `focus` right after a role pick, with `p5` about to auto-build, could make Choice, Delivery-on-p5, and even a hub Arrival all true within moments of each other). This is exactly what `MOMENT_CATALOG`'s priority arbitration is for — Phase 2a's evaluator fires the first eligible entry and stops, which was correct with one entry and needs to become explicit priority ordering now (design: Delivery > Choice > Arrival, for the three families in scope here).

5. **Which Focus sections generate content, for Delivery's scope.** `FOCUS_ORDER`'s non-independent list (`:14827-14837`) is 11 entries; `groups` and `recruiters` are static resource lookups with no generation step (no `gp`/`go` entry) and nothing is ever "built" there — Delivery doesn't apply. The 9 that do generate: `p5, p6, p9, salaryRead, p11, p_res, p8, p7, income`.

## Open questions

**A. Arrival on Career Paths — fixed copy or model-generated?** The design's Section 5 table describes Arrival generally as personalized, model-authored copy ("says... what this screen is for in this person's terms, names the one move that fits their state") — unlike Put It to Work's Arrival, which you wrote yourself as fixed copy (Section 12). Doing that for every Arrival instance means a genuinely new server dispatch (a third reaction-text family beyond Choice/Delivery) for what might be a one-sentence orientation. Recommend: fixed copy for the single Career Paths hub-level instance (first arrival at `laneSelect`, mirroring `ptw-arrival`'s proven pattern — one sentence on what a lane's wide view is for), and defer any Focus-section-level Arrival (the "ordinary" significance, per-section empty-state instances) to Phase 3, where Next move and Stall already cover similar "what's missing here" territory and could subsume it rather than duplicating it.

**B. How many Focus sections get Delivery in 2b?** All 9 generating sections at once (uniform mechanism once one is proven, per pre-flight #3's template pattern), or a smaller first slice — `p5` and `p6`, the two sections a newly-chosen role hits first — with the remaining 7 following in a fast-follow brief once the mechanism is validated live? Recommend the smaller slice: it's genuinely new territory (the first Delivery instance outside Personal Brand), and validating tone/pacing on two sections before writing seven more reaction-text templates avoids redoing work if the first ones need adjustment.

**C. Does Choice carry an actual build tap, or is it reflection-only?** The design's "offer, if any" column names a concrete action ("Build Where You Fit" tap) — meaning Choice's message would need to compute which section is "first" for the current lane and wire a real build trigger, not just the two dismissal quick-replies every moment already gets. Recommend shipping Choice as reflection-only text (model-generated, no build tap) for 2b — the person lands directly on `focus` where the real build buttons already are, so the tap is a convenience, not a capability gap. Wiring the dynamic "which section is first" build-offer is more scope for a value that's already one click away.

## What's shared regardless of these answers

- **Dedupe key correction** (pre-flight #2) applies no matter how A/B/C resolve.
- **Server dispatch extension** (pre-flight #3) is the mechanism for whichever Delivery sections ship, at whatever count B settles on.
- **Priority ordering** in the evaluator (pre-flight #4): Delivery > Choice > Arrival, added as an explicit sort/priority field on each catalog entry rather than relying on array order (which Phase 2a's single-entry catalog didn't need to make explicit).
- **Significance**: per the design, Delivery and Choice are both significant (open the panel); the Career Paths hub Arrival (question A) is also significant, matching Put It to Work's.

## Out of scope

Next move and Stall (Phase 3, and per question A, possibly absorbing what would otherwise be per-section Arrival). Build offers / the `BUILD` tap generally (Phase 3, per the design's Section 6) beyond whatever question C resolves. Folding the *existing* `seen*` flags (framing, narration, brand-delivery) into `coachMoments` (Phase 4). Anything not on Career Paths or the Focus sections named in question B.

## Next step

Answer A, B, and C (or redirect any of them). I'll finalize file-level specifics — the new catalog entries, the priority field, the corrected dedupe key, the server-side reaction-text functions for whichever sections B settles on — and send that back for one more review pass before any code, same as every prior phase.
