## Prompt for Code

Draft brief for Phase 2 (the Moments engine), following the same process as 1a/1b: premise-verify against current `main`, surface real open questions, send back for review before file-level specifics are finalized or any code is written. One question here is architectural, not a detail — read Section "The central question" before anything else in this brief.

---

## Date / Type / Source

2026-09-08. Implementation brief for Phase 2, per the design (`Output/handoff/2026-09-08_coach-concierge-design.md`, Sections 5 and 8) and Bob's decision during Phase 1b's review to hold both dismissal affordances and the `quiet` state for this phase, alongside the Moments they gate. Written against `main` at `53aed72` (Phase 1a + 1b both shipped).

Scope per the design's own Phase 2 description: "Moments engine with Arrival, Choice, Delivery on Career Paths and Put It to Work. One evaluator, one dedupe store, the significance column, three families... The Put It to Work routing question ships here as the Arrival moment." Plus, per Bob's Phase 1b decision: the `quiet` state and both dismissal affordances ("I'm good for now," "not on this screen").

## Pre-flight discovery (scope correction)

Two mechanisms already exist that do most of what the design's "one evaluator, one catalog" asks for — this changes what Phase 2 actually needs to build, not just confirm.

**1. `orientationCheckFields` is already a working content-reactive evaluator — this IS the design's "Delivery" and "Check" families, not something to build fresh.** `src/App.jsx` (~`:8850-8994`) holds an array of `{step, done, combined, text}` entries — nine orientation fields plus Brand richness (`combined: outputs.p3`). One shared effect compares each entry's `combined` against `qualityCheckedFields[step]` (the last-reacted-to value); a real change fires a silent server turn with a judged reaction, and updating `qualityCheckedFields[step]` is the entire dedupe — no separate flag needed, and a *rebuild* re-fires automatically because the new content is a new `combined` value. This is exactly the shape the design specifies for Delivery ("a judged read of what was just built... framed as an invitation") and is explicitly named as already fitting the Check family ("unchanged; they already fit the pattern"). Extending this array with new entries for Focus/Opportunity Playbook sections (keyed on `outputs[key]` or the equivalent door2 section content) is the natural way to ship Delivery — not a new mechanism alongside it.

**2. Arrival-shaped moments are already built individually as one-off `useEffect` + `seen*` flag + fired-ref triples** — the orientation-route question itself (`src/App.jsx:~9092-9112`, the exact mechanism this phase is meant to replace/generalize) is one instance of this pattern, as are the framing message and per-step narration. Each is: a `useState` flag, a `useRef` guard against the same-commit double-fire the flag's own state update can't prevent, a condition block, a `setChatMessages` push. Every one of these is individually threaded into the autosave blob (`stateForSave`, `:9476`) and both hydration paths by name — this is the "eighteen `seen*` flags" sprawl the design's diagnosis names directly.

**3. The `orientation-route` question is a real, small, well-isolated migration target, not a large one.** Its full logic: gated on `hasOnboardingConcierge` + `step==='twoDoors'` + a built brand, fires once ever, pushes a message with two quick replies whose `value`/`followUp` route to `addNewOpportunity()` or `advance('twoDoors','laneSelect')` — the exact same two actions the screen's own door buttons perform (`:7894-7898`, already documented as intentionally sharing the actions). Per the design's Section 12 decision, Arrival on Put It to Work should say this exact wording and retire it.

**4. The two-door screen's own pitch, to retire in the same PR:** the `<CoachingCallout>` on `twoDoors` (`src/App.jsx:14723`) — "If you have a current opportunity you're pursuing, start here... No specific opportunity in play yet? Start with Career Paths..." — duplicates what the new Arrival moment will say. The two door buttons themselves stay; only this static callout goes, so the two pitches never coexist (per the design's Section 12 decision #4).

**5. The dismissal affordances need no server round-trip and no capture-note/trailer mechanism.** Unlike the profile-field captures (Values, Skills, etc.), "I'm good for now" and "not on this screen" are pure client-side UI state — closer to the quick-reply pattern the orientation-route question already uses (a `checkinKey`, a tap, a local state change) than to a server-written fact. No new server-side capture-note pattern is needed for these two.

## The central question

The design's Section 5 describes a fully declarative system: a catalog table (one row per moment family), one evaluator function, one dedupe store, arbitration by priority — explicitly framed as *replacing* the one-off-effect pattern, not sitting alongside it. Building that now, exactly as designed, is real, valuable, substantial work: it would also let Phase 4 (folding the existing `seen*` flags into the same catalog) collapse into "migrate the remaining rows," rather than staying a separate future undertaking.

But Phase 2's own stated scope is narrow — three families, two surfaces. Two ways to read that scope against the fuller architecture:

- **(a) Build the general catalog + evaluator now, sized to Phase 2's three families.** The catalog, the evaluator, the `coachMoments` dedupe store, and the significance/arbitration logic all get built as the general mechanism the design describes, just populated with only Arrival/Choice/Delivery to start. Larger scope for this phase, but it is the architecture, not a placeholder for it — Phase 3 (Next move, Stall) and Phase 4 (migrating the remaining onboarding triggers) become additions to an existing table rather than a second build.
- **(b) Extend the two existing mechanisms pragmatically for the three families on the two new surfaces, and defer the general catalog to when there's more than three families to justify it.** Delivery on Focus/Opportunity Playbook sections becomes new entries in `orientationCheckFields`. Arrival on Put It to Work replaces the `orientation-route` effect with an equivalent one-off effect (same shape, new copy). Arrival/Choice on Career Paths are new one-off effects of the same shape. `coachMoments` still replaces the *dedupe flags specifically* (one dict instead of N booleans) without building the full catalog/evaluator layer around it. Smaller, faster, matches the size of what 1a and 1b actually turned out to need once real code was read rather than assumed — but it does mean Phase 3/4 face the same "generalize later" question again, not resolved by this phase.

Recommend **(a)**, with a caveat: the value of the general mechanism is specifically in *not* re-litigating this question every phase, and Phase 3 and Phase 4 both assume it exists. Building it small now (three families) costs more than (b) today, in exchange for costing nothing extra in Phase 3/4. Flagging as the one open question that actually changes Phase 2's shape, rather than deciding it here — this is closer to a Cowork-level architecture call than the kind of implementation-detail question 1a/1b's open items were.

## What's shared regardless of (a) or (b)

- **`coachMoments`**: a single dict in the profile blob (`{[momentKey]: {firedAt, sessionOnly: bool}}` or similar), replacing individual `seen*` booleans for every NEW moment built in this phase — one field in `stateForSave` and both hydration paths, not N. Existing `seen*` flags (orientation-route, brand-delivery, framing, narration) stay as-is in this phase regardless of (a)/(b) — migrating them is Phase 4's explicit job, not this one's.
- **Significance**: Arrival on a hub (Put It to Work, Career Paths) and Delivery are significant (open the panel from minimized, per Phase 1b's `coachPresence`); Arrival on an individual section is ordinary. This directly uses Phase 1b's `setCoachPresence('open')`.
- **The two dismissal affordances**: quick replies on any unprompted moment message, no server trailer. "I'm good for now" sets `quiet` (session-scoped, e.g. a ref/state that resets on reload — "a new session starts open" per the design). "Not on this screen" sets a per-screen quiet key. Both log through the existing prompt-engagement table (`logPromptEngagement`, already used by brand-richness and others) as `declined`, for free.
- **Put It to Work's Arrival moment** ships with the exact wording Bob confirmed in the design's Section 12: "Is anything already moving — an application in, a referral, an interview on the calendar? If so, let's work that first. If not, we'll pick a direction and build from your brand." / "Something's moving" / "Starting from scratch," replacing `orientation-route` and its `CoachingCallout`.

## Out of scope

Next move and Stall (Phase 3). Build offers, the `BUILD` tap (Phase 3, per the design's Section 6). Folding the *existing* `seen*` flags (framing, narration, brand-delivery) into `coachMoments` (Phase 4) — this phase's new moments use the new store; old ones are untouched. Everything already out of scope for 1a/1b.

## Next step

Once you've read the central question: say (a), (b), or something else, and whether you want this phase split further (e.g., 2a: dismissal/quiet + the orientation-route migration alone, since that's self-contained and low-risk; 2b: Career Paths Arrival/Choice/Delivery, the larger new-territory piece) the way Phase 1 split into 1a/1b. I'll finalize file-level specifics against your answer and send that back before any code, same as before.
