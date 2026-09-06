# Coach as an active partner across the Opportunity Playbook — proactive, sequenced, tap-gated signals

## Prompt for Code

This is a design brief, not a ready-to-implement diff — read it in full before touching code. It proposes a three-category architecture (Context, Rework, Milestone) for Coach to proactively surface things worth adding to an opportunity, always tap-gated, never stacked, never automatic. Phase 1 (Card Rework) is scoped tightly enough to become its own implementation brief next; Phases 2 and 3 need the open questions below answered first. Do not implement anything from this document directly — write the Phase 1 implementation brief once Bob confirms the flag and wording decisions, then follow the normal premise-verification and gh flow.

## Date / Type / Source

2026-09-06. Product design brief. Grew out of three connected exchanges during Bob's live Coach testing today: (1) a verified-accurate FAQ answer about Notes not feeding generation, (2) Bob's question about whether Coach already exercises judgment to surface material new information, and (3) Bob's explicit direction to generalize this into one holistic principle across the whole Opportunity Playbook rather than patching Interview Prep and Resume Refresh separately — his examples: an unbuilt Cover Letter or Resume Refresh when the user hasn't applied yet, and an anticipated offer letter as a cue to start Offer & Negotiation prep.

## The principle

While Coach is in conversation about a saved opportunity, it should notice when something the person says is materially relevant to that opportunity's playbook — not just the pipeline facts (stage, next move, meeting, interviewer) already captured today — and bring it up. Three different things can be "materially relevant," and they call for three different mechanics:

1. **Something worth remembering that should shape future generation**, not tied to a specific interviewer (company context, culture signal, what the role is really testing for).
2. **Something that should change what a specific card says right now** (a recruiter's steering note — "push the supply chain angle harder" — that should rework Resume Refresh).
3. **A milestone in the process that suggests a next card to build**, with no content to capture at all — just a nudge toward a screen that would help right now (haven't applied yet → Cover Letter or Resume Refresh; an offer sounds imminent → Offer & Negotiation).

The cross-cutting discipline, which is the part that makes this a principle rather than three features: **one surfaced item per reply, at most**, plainly worded, always the user's call, never a second one stacked on top because Coach happened to notice two things in the same breath. This is explicit in Bob's own framing ("sequentially... not all in one push") and it is already the pattern every existing capture note in `api/coach.js` follows individually ("At most once per reply; otherwise omit it entirely") — the new ground to cover is arbitration *across* categories when more than one is live in the same turn, which nothing today handles because today there's only ever been one candidate at a time.

## Pre-flight discovery — what's already there to build on

Verified against current code before drafting any of the below, so this brief proposes gaps, not duplicates:

- **The tap-is-the-only-write contract already exists and is mature.** Every capture note in `api/coach.js` (pipeline/opportunity-update, activity, values, notes-agency, assessment, brand rework, section rework) follows the same shape: the model ends a reply with a hidden trailer, the server turns it into a header, the client renders an exact-preview one-tap offer, and the model is instructed never to claim it already wrote anything. Nothing new needs inventing here — categories 1 and 2 below are new *triggers* on the existing mechanism, not a new mechanism.

- **Category 1's landing spot already exists and already feeds generation.** `panel.opportunity_context` (`getOpPanel`/`updateOpPanel`, `src/App.jsx:10109`) is a free-text field on the Interview Team card, already wired into Interview Prep generation via `buildP11PanelBlock` (`src/App.jsx:1465`, folded into both `P.p11` and `P.p11Team`). Its own placeholder text — "Anything you know about this opportunity: how you came across it, any insider intel, what the team has said" — is a near-exact description of Category 1's content. This means Category 1 needs no new field, no new schema, no new prompt wiring for the read side — only a capture note (mirroring `ASSESSMENT_CAPTURE_NOTE`'s append-don't-overwrite pattern) and a client write path calling `updateOpPanel`.

- **Category 2's mechanism already exists, generalized further than I expected.** `generateOpSection(key, laneOverride, correctionText)` (`src/App.jsx:10828`) accepts a `correctionText` that gets appended as a `NEW CORRECTION FROM THIS SECTION` tail to *any* op card's prompt — not just `p5`, all of them, including `p11` and `p_res` — and immediately regenerates that card. This is the same mechanism the existing per-card RefineBox already uses for manual corrections (PR-A op-card-refinebox, 2026-05-30). Category 2 is "drive this same call from a chat-originated note," not new generation infrastructure.

- **Section rework exists but doesn't reach here, and its trigger condition doesn't fit.** `sectionReworkTarget` (`src/App.jsx:8146`) is hard-gated to `coachReturn.step==='focus'` and only `['p6','p_res','p9','income']` — it never fires on an Opportunity Playbook card, including that same-named `p_res`. Its capture note (`SECTION_REWORK_CAPTURE_NOTE`, `api/coach.js:139`) is also scoped to "something specifically WRONG or OFF" — an error-correction frame. Bob's supply-chain example isn't an error; it's steering input the user never had a chance to be wrong about. Category 2 needs its own trigger condition, not a reuse of section rework's wording, even though it reuses `generateOpSection`'s mechanism underneath.

- **Category 3 needs no new data plumbing.** Coach already receives, per in-focus opportunity: which door2 cards exist and have content (`FOCUS_SECTIONS.door2`, `api/coach.js:833`), the Interview Panel contents (`api/coach.js:876`), and the pursuit's `stage`, `next_move`, `next_step_at`, `situation_note` from `pursuit_status` (`api/coach.js:1359`). Everything a milestone judgment needs to reason about ("stage is applied, no Cover Letter built yet") is already in the prompt today. Category 3 is a system-prompt instruction change, full stop — no trailer, no header, no client write path, because there's no content to write. The only genuinely new piece it needs is a way to not repeat a declined or ignored nudge every turn (see open questions).

- **Notes and Notes-agency are confirmed wrong homes for all three categories.** Already established with Bob today: Notes explicitly does not feed any generation, and Notes-agency is deliberately request-only by design ("never a judgment call about which reply earns an unprompted offer" — `api/coach.js:111`). None of the three categories should route through either.

## Category 1 — Opportunity Context

**Trigger:** the person shares something about the opportunity itself — company context, a culture signal, what the interview loop is really testing for, how the role came about — that isn't attached to a specific named interviewer (person-attached intel already belongs to the existing `people[].note` field in `OPPORTUNITY_UPDATE_CAPTURE_NOTE`, which already works today and needs no change).

**Mechanism:** new capture note, modeled on `ASSESSMENT_CAPTURE_NOTE`'s append pattern. Tap offer shows the exact text to be added; write path calls `updateOpPanel(slotId, p => ({...p, opportunity_context: (p.opportunity_context ? p.opportunity_context + '\n\n' : '') + newText}))`, appending rather than overwriting so nothing already there is lost.

**What it changes:** nothing immediately. It becomes part of the durable record and shapes the *next* Interview Prep build or rebuild, exactly like manually typing it into that field today would.

## Category 2 — Card Rework

**Trigger:** the person shares something that should change what a *named* card says now — steering input ("push the supply chain angle harder"), not necessarily a correction of an error. Generalizes past section rework's "something WRONG" frame to "something that should change the emphasis or content."

**Mechanism:** new capture note (sibling to, not a reuse of, `SECTION_REWORK_CAPTURE_NOTE`), naming the eligible cards and their user-facing labels (`OP_CARD_LABELS`, `src/App.jsx:12493` — About This Company, Where you fit, Bridge Story, Resume Refresh, Cover Letter, Interview Prep). Tap offer names the card and the note in plain language ("update Resume Refresh to push the supply chain angle harder?"); write path calls `generateOpSection(key, undefined, note)` — the same call the card's own RefineBox makes.

**Open scoping question:** does this apply only when the conversation started from that specific card's "Ask My Coach about this" (mirroring how section rework requires `coachReturn.section` to match), or should Coach be able to propose reworking a card from a general opportunity conversation not anchored to that screen? Recommend the latter — Bob's own supply-chain example is exactly this: the user is telling Coach about a call, not sitting on the Resume Refresh screen. This means, unlike section rework, Category 2 cannot rely on `returnSection` to know *which* card — the model itself has to name the target card in its own JSON payload, the same way `OPPORTUNITY_UPDATE_CAPTURE_NOTE` names a stage or a person rather than relying on screen context.

## Category 3 — Milestone Prompt

**Trigger:** a recognizable point in the process where a not-yet-built (or now-stale) card would help, inferred from what the person says plus the opportunity's own state (stage, which cards are already built) already in Coach's prompt context.

**Mechanism:** none needed beyond a system-prompt instruction — there is no content to capture, so no trailer, no header, no tap. Coach mentions the relevant card by its real user-facing name and lets the person decide, the same way it already talks about any other part of the product in prose. If the person says yes, Coach either walks them toward it in conversation or names where to go — My Coach stays prose-only with no NAVIGATE mechanism (CLAUDE.md §6), and nothing here proposes changing that.

**Needs a bounded list, not an open-ended instruction.** Every existing capture note is deliberately narrow and enumerable (a fixed stage vocabulary, a fixed activity catalog) rather than "notice anything interesting" — that boundedness is what keeps them testable and keeps the model from inventing signals. Recommend starting with a short, concrete list rather than a general instruction to "watch for milestones":

- Stage is `applied` or later and Cover Letter is not built.
- Stage is `applied` or later and Resume Refresh is not built (or is stale against a resume update).
- An interview is confirmed (stage `interviewing`/`final_round`, or a person just got added to the Interview Team) and Interview Prep is not built.
- The person describes an offer as imminent or already in hand, in conversation, regardless of whether the stage has been moved to `offer` yet, and Offer & Negotiation has no content.

**Needs a "don't repeat" memory.** Without one, Coach would re-suggest the same unbuilt Cover Letter every single turn on that opportunity, which reads as nagging, not partnership. This is new, small state — recommend a per-opportunity, per-milestone dismissal flag (declined or ignored-and-moved-on), most likely alongside the existing `savedPlaybooks` record rather than reusing the onboarding one-time-seen pattern (which is per-user, not per-opportunity).

## Cross-cutting: arbitration when more than one signal is live in one turn

Today this can't happen — each existing capture note is independently the only thing that could fire in a given reply. Once Categories 1–3 exist alongside pipeline/opportunity-update capture, a single message plausibly triggers two at once (the user mentions a new interviewer's data-driven style *and* says they haven't sent a resume yet). Recommend an explicit priority order in the shared instruction preamble, concrete facts before soft suggestions:

1. Pipeline mechanics (stage/move/meeting/interviewer) — already shipped, unchanged.
2. Card Rework — a specific, actionable correction to something already built.
3. Opportunity Context — durable intel, no immediate visible change.
4. Milestone Prompt — a suggestion, the softest of the four.

Hold whichever doesn't win for a later, more natural point in the same or a future conversation rather than dropping it — though there's a real design question here: does "hold for later" need explicit state (a small queue), or is it enough to trust that if the underlying fact is still true, Coach will notice it again next time it comes up in conversation? Recommend the latter for Categories 1 and 2 (the underlying fact persists, so there's no information loss in waiting), and the "don't repeat" memory above already covers Category 3.

## Voice check

Ran the concrete phrasings above against the banned-construction list before proposing them: no logic-flip cadence, no comparative standing, no AI-coaching register, no typology labels. "Since the recruiter mentioned pushing the supply chain angle, want to update Resume Refresh with that?" and "Sounds like an offer might be close — want to start on Offer & Negotiation?" both read as one plain, partnership-framed ask, matching the standard every existing capture note already meets. Because the model generates this phrasing live rather than from an authored template, the capture-note instructions themselves need to carry the same voice constraints the existing notes carry implicitly through the base system prompt, and the new instruction text will go through `check-voice.mjs` like everything else.

## Recommended sequence

No effort estimates, per house rules — scope only, in the order that de-risks the open questions fastest:

1. **Card Rework (Category 2).** Fully scoped mechanically (reuses `generateOpSection`'s existing `correctionText` path); the only real decision is the flag question below.
2. **Opportunity Context (Category 1).** Fully scoped mechanically (reuses `panel.opportunity_context` and the append pattern); no open questions beyond wording.
3. **Milestone Prompt (Category 3).** Needs the bounded milestone list and the dismissal-memory design settled first — the riskiest of the three to get right on the first pass because it's pure model judgment with no data write to verify against.
4. **Cross-category arbitration**, once at least two of the above are live simultaneously — verify with a live eval in the style of `eval-interview-capture-live.mjs`, since this is exactly the kind of prompt-compliance-under-bulk question that script was built to catch.

## Open questions, with a recommendation on each

- **Flag strategy for Category 2.** Reuse `SECTION_REWORK_FLAG`, or a new flag? Recommend reuse — it's the same underlying idea (a chat correction reworks a specific card) applied to a second surface, and during the pilot period both are staff-only anyway (`isInternalAccount` auto-grants either way). A new flag only earns its keep once Bob wants to toggle the two independently for outside testers, which isn't yet a live need.
- **Whether Category 2 requires screen-anchoring.** Recommend no, per the Category 2 section above — the trigger should fire from anywhere in an opportunity conversation, with the model naming the target card itself.
- **Milestone list for Category 3.** Recommend the four-item starter list above over an open-ended instruction, consistent with how every other capture note stays enumerable.
- **Dismissal memory's storage shape for Category 3.** Recommend a field on the `savedPlaybooks` record rather than new schema — needs one more look at the record shape before the implementation brief locks it in.

## Out of scope

- Focus Playbook rework (already shipped, unchanged).
- Notes and Notes-agency (confirmed non-generative; staying that way).
- Any Coach-triggered navigation or "build this for me" button — My Coach remains prose-only (CLAUDE.md §6); Category 3's "tap" is the person acting on what Coach said, not a mechanism Coach operates.

## Docs

Per CLAUDE.md §8, whichever phase ships first that changes what Coach can do updates the user guide and `FEATURE_MAP`/`coach-nav-map` in the same PR — likely a small addition to the My Coach chapter describing that Coach may point out related steps in conversation, not a new top-level feature entry, since nothing here adds a new screen.
