## Prompt for Code

Draft brief for Phase 3 (build offers, Next move, Stall), following the same process as every prior phase: premise-verify against current `main`, surface real open questions, send back for review before file-level specifics are finalized or any code is written. This phase is a bigger jump than 2a/2b/2c — it gives Coach its first ability to trigger an action beyond writing a profile field, not just react to one. Read "The central question" and "Open questions" before anything else in this brief.

---

## Date / Type / Source

2026-09-09. Implementation brief for Phase 3, per the design (`Output/handoff/2026-09-08_coach-concierge-design.md`, Sections 6 and 8). Written against `main` at `04d8503` (Phase 2c shipped: Delivery on all 9 Career Paths sections).

Design's own scope for this phase: "The `BUILD` tap, the milestone logic extended to directions, the idle nudge. Stall thresholds are starting numbers; log fire and dismiss rates."

## Pre-flight discovery (scope correction)

1. **The BUILD tap is a new class of capability for Coach, not an extension of an existing one.** Every write mechanism shipped so far (Values capture, Notes, Section rework, all the way through Phase 2c's Delivery) either writes a profile field or reworks an already-built section with a correction. None of them start a section that has never been built. The read-only rule in `SYSTEM_PROMPT_STABLE` (`api/coach.js:1521`, "You are read-only... you cannot change anything") explicitly forbids exactly this today. The design calls for amending that rule ("you can offer to start a build; the person's tap starts it") — the first loosening of that boundary since the product shipped. Worth being deliberate about, not just implementing.

2. **The section-rework tap (the closest existing precedent) doesn't transfer directly.** `checkinKey==='section-rework'` routes through `submitCorrection`, whose whole job is conflict-detection on a correction *against already-built content* (`src/App.jsx:10230`). A BUILD tap has no existing content and no correction text to conflict-check — it needs a simpler path, not `submitCorrection`'s wrapper.

3. **The actual generation call BUILD needs to invoke isn't reachable from where a tap handler lives.** The 'focus' screen's own Build button calls `genSec=(id)=>id==='p6'?generateP6():generateSection(id,gp(id),go(id))` (`:14858-14859`) — but `gp`, `go`, and `genSec` are declared *inside* the `case'focus':` render block, not at component scope. `handleEmploymentQuickReply` (where every other checkinKey branch lives, including section-rework's) is a separate top-level function that cannot see them. Wiring BUILD means lifting the section→generator mapping out of the render closure into a shared, component-level function both the screen's own button and the new tap handler call — a real refactor, not just a new branch.

4. **Next move's design-doc description doesn't map onto Career Paths as literally written.** "The existing milestone logic, extended from opportunities to directions" points at `MILESTONE_PROMPT_NOTE` (`api/coach.js:200`) — but that mechanism is a conversational heuristic embedded in the system prompt, fired only when the model is *already mid-reply* to a real question about a door2 (Opportunity Playbook) record, keyed on that record's pipeline *stage* (applied, interviewing, offer). Career Paths (door1) directions have no stage field — there is nothing to "extend" the stage-based triggers onto. A literal extension doesn't have a target.
   Proposed alternative, not in the design doc: Career Paths already has an explicit build *sequence* — `FOCUS_ORDER` (`:14879-14889`). Next move fires as its own catalog entry, deterministically, right after a Delivery moment resolves: find the first unbuilt section after the one just built, in `FOCUS_ORDER`'s own order, and offer it. No model judgment call needed for *which* section — only for the one line of "why it follows from this one," which can ride the same silent-turn shape Choice/Delivery already use. This is a real architecture deviation from the design doc's wording, flagged under "The central question" below rather than assumed.

5. **No idle-time or visit-count tracking exists anywhere in the codebase today.** Stall's two trigger conditions (`idleSeconds` past a threshold, `visitCount >= 3` with nothing built) both need new client-side state from scratch — this is not a matter of reusing or generalizing something that already exists, unlike every prior phase's moments.

## The central question

Two design decisions this brief cannot make alone:

**A. Next move's trigger logic: deterministic FOCUS_ORDER sequencing (pre-flight #4's proposal), or a genuine extension of `MILESTONE_PROMPT_NOTE`'s conversational heuristic to door1?** The heuristic approach would need new stage-equivalent signals for a direction (there are none today — a direction has no pipeline stage) invented specifically to drive this, which is a bigger and less-grounded lift than it sounds. Recommend the deterministic FOCUS_ORDER approach: it reuses data that already encodes intent (the order Reimagine itself presents sections in), needs no new "readiness" signal invented from nothing, and is trivially testable (given a record's built sections, the next one is a pure function). The tradeoff: it's a straight sequence, not a judgment about what's actually *warranted* next the way the milestone logic's stage-based triggers are for opportunities — Career Paths doesn't have the equivalent signal to make that call yet.

**B. Should BUILD and Next move ship together, or does BUILD need its own phase first?** Next move's only offer is "Build [next]" — without the BUILD tap, it can only ever be text ("Bridge Story would be a natural next step"), no actual action, which is a materially smaller and less "concierge" result than the design calls for. Recommend shipping them together (call it Phase 3a) specifically because Next move is BUILD's first and clearest real use — proving the tap on a low-stakes, well-understood trigger (a natural next section, not a stall-driven nudge) before Stall (higher nagging risk per the design's own Section 10) gets anywhere near it. Stall becomes Phase 3b, genuinely independent, needing its own idle/visit-tracking build and Bob's own numbers for the two thresholds (the design explicitly leaves these as "starting numbers" for Bob to set, not something to guess at).

## What Phase 3a (BUILD + Next move) needs, regardless of A's answer

- **The `genSec`/`gp`/`go` refactor** (pre-flight #3): lift the section→generator mapping to component scope so both the Build button and the new tap handler call the same function. Scoped to Career Paths (door1) `FOCUS_ORDER` sections only, matching every phase's "Career Paths first" precedent — the Opportunity Playbook (door2) has its own separate generation wiring (`generateOpSection`) and its own separate premise-verification if BUILD ever extends there.
- **A `BUILD: {section}` silent trailer**, parsed server-side the same way `SECTIONREWORK`/`MILESTONEMENTIONED` already are, validated against the actually-pinned record's real build state (via the existing `situation`/`buildPlaybookExpansion` plumbing — not trusting the model's own claim about what's built) before it's ever rendered as a tap.
- **The `SYSTEM_PROMPT_STABLE` read-only-rule amendment**, worded carefully: Coach may *offer* a build by name; the tap is what starts it; Coach never implies the build already started or will start without the tap.
- **A new Chat.jsx → App.jsx callback** (e.g. `onBuildSection`) threaded through however many `<Chat>` mounts currently need it, following the same threading pattern every prior capture prop already uses.
- **Next move as a `MOMENT_CATALOG` entry**, `family: 'next_move'`, firing via `fireMoment` (the existing Phase 2b/2c mechanism) right after a Delivery moment's dedupe write, eligible only when `FOCUS_ORDER`'s next unbuilt section exists for the current record.

## What Phase 3b (Stall) needs, once scoped separately

- New client state: last-interaction timestamp per screen (for `idleSeconds`) and a visit counter per screen (for `visitCount`), neither of which exists today.
- Bob's own numbers for both thresholds — the design deliberately does not propose starting values.
- The one-question framing the design specifies ("what would make this worth their time, or would they rather look at something else") is itself new user-facing copy needing the same voice-rule pass every prior phase's new copy got.

## Phase 3b (Stall), drafted 2026-09-09 against main at 4840dc2 (Phase 3a shipped)

Premise re-verified: `grep` for `idleSeconds`/`visitCount`/`lastInteraction` in `src/App.jsx` still returns nothing -- pre-flight #5's finding holds, no idle-time or visit-count tracking exists anywhere in the codebase. Thresholds confirmed by Bob: **90 seconds idle**, **3 visits**.

**Scope: `focus` only, same as Delivery and Next move.** The design's trigger condition ("a screen with an unbuilt primary action") maps cleanest onto the Focus Playbook, where an unbuilt section has a literal Generate button -- `laneSelect` and `p4` are choice screens (pick a lane, pick a role), not build screens, so "unbuilt primary action" does not describe them the same way. Keeping Stall to `focus` also reuses `FOCUS_ORDER`/`done`/`focusOrderFor` directly, no new signal needed for "what's unbuilt here."

**Central question: does Stall fire on ANY unbuilt section, or only when NOTHING has been built yet for this record?** The design's `visitCount >= 3 with nothing built` phrasing reads as the latter to me -- someone who has built 5 of 9 sections and paused before a 6th is already engaged; Next move already covers that moment ("here's what's next"). Someone who has visited Focus Playbook three separate times and never built even the first section is a materially different, more genuine stall. Recommend: **Stall is eligible only when `FOCUS_ORDER.every(s=>!done.includes(s.id))`** -- nothing built at all for the current record. This also means Stall and Next move can never compete for the same moment (Next move requires a Delivery to have already fired, which requires something built).

**The idle timer is new plumbing, not a reuse of the evaluator's existing effect-on-state-change pattern.** Every other Moments entry fires because some piece of React state changed (a build completed, a lane got picked). Idle time passing is not a state change -- nothing re-runs the evaluator just because 90 seconds elapsed with nothing else happening. Needs: a `setTimeout` armed on arrival at `focus` with nothing built (matching the "nothing built at all" eligibility above), cleared and re-armed on the interactions that should count as "not idle," firing a check when it elapses. Recommend resetting the timer only on Reimagine's own tracked actions already available at that screen -- navigating within `focus`, tapping a Generate button, sending a Coach chat message -- not a raw global mousemove/keypress listener, which is new surface area (event listener lifecycle, passive-listener perf) for a screen-scoped signal that doesn't need page-wide precision.

**Visit counting:** increment a per-record counter (keyed the same way Delivery/Next move dedupe -- `${selectedLane}::${chosen}`) each time `step` becomes `'focus'` for that identity, in a `useEffect` on `[step, selectedLane, chosen]`. Session-scoped is enough to start (matches every other Moments entry's session-vs-durable split); whether it should persist across sessions is a tuning question for after real fire/dismiss data exists, not something to guess now.

**The one question itself -- no `onTap` action needed, unlike Next move.** Static entry (`ptw-arrival`'s shape), not generated: the design calls it "one question, not a nudge," a single line rather than a judged read of specific content, and Stall firing at all is already the signal-carrying part -- it does not need to reference what's on the screen the way Delivery or Next move do. Draft copy, written with `PLAIN_ENGLISH` from the start:

> "You've come back to this a few times without building anything yet. What would make it worth doing right now — or would you rather look at something else?"

Quick replies: **"Take me to Career Paths"** (`value: 'stall-redirect'`, routes to `laneSelect` the same way `ptw-arrival`'s `fresh` branch already does) alongside the two standard dismissal taps. No "build it now" action tap -- if they want to build, typing that is the natural reply and Coach can point them to the Generate button same as any ordinary conversation; adding a second action mechanism here would be scope creep this phase does not need. Recommend against a hard-coded "stay building" alternative tap since Career Paths is the only real "something else" destination that exists at this point in the flow (the two-doors screen's other branch, Add an Opportunity, is a much bigger pivot than a quiet-question tap should invite silently).

**Not resolved yet, need your call before I lock this in and build:**
1. Nothing-built-at-all vs. any-unbuilt-section (recommend the former, above).
2. The draft question + redirect copy (above) -- sign-off per the standing gate.
3. Whether visit count should reset if they DO build something later and then stall again on a *different* record (recommend yes, implicitly, since the counter is keyed per-identity like everything else here -- flagging so it's a deliberate choice, not an accident of reusing the existing key shape).

## Out of scope

Everything in Phase 4 (folding the pre-2a `seen*` flags into the catalog). BUILD on the Opportunity Playbook (door2) — Career Paths only, this phase. Any change to `MILESTONE_PROMPT_NOTE` itself — it stays exactly as-is for door2; Next move on Career Paths is a new, separate mechanism per the central question's recommendation, not a modification of the existing one.

## Resolved 2026-09-09

Bob: "I accept your recommendations." A = deterministic FOCUS_ORDER sequencing. B = BUILD + Next move ship together as Phase 3a; Stall becomes Phase 3b.

## A scope reduction found while designing 3a's specifics

Digging into exactly how Next move's tap needs to work turned up something that narrows Phase 3a from what "What Phase 3a needs" above assumed — worth flagging before finalizing specifics, since it changes what ships now versus later, not just how.

Because Next move's target section is resolved **deterministically, client-side, before the model is ever called** (pre-flight #4's own design: the next unbuilt item in `FOCUS_ORDER`), the model never has to *name* which section to build — App.jsx already knows. That means Next move's tap needs none of the general BUILD-tap machinery this brief originally scoped: no `BUILD: {section}` trailer, no server-side validation of a model-claimed section against `situation.notBuilt`, no new response header, and no `SYSTEM_PROMPT_STABLE` amendment. It only needs a new `MOMENT_CATALOG` entry whose `onTap` calls the (still-necessary) refactored `genSec(section)` directly — the exact same shape `ptw-arrival`'s `onTap` already uses today (Phase 2a), just calling a generation function instead of `advance`/`addNewOpportunity`.

The general capability — Coach naming a build opportunity **during an ordinary typed conversation**, not just inside a scripted moment — is real Section 6 scope, but Next move doesn't need it to work. It is also a materially different and larger piece: Coach deciding *on its own judgment* that a build is warranted mid-conversation, versus a scripted moment that always offers the one deterministic next section. That is exactly the kind of model-initiated judgment call the read-only rule exists to bound carefully.

**Recommend narrowing Phase 3a to Next move only** (the refactored `genSec`, the new catalog entry, its `onTap`) — self-contained, low-risk, reuses an established pattern end to end. Defer the general opportunistic BUILD tap (the trailer, the header, the `SYSTEM_PROMPT_STABLE` amendment) to its own phase, sized and reviewed on its own terms rather than swept in as "what Next move needs," which it turns out not to be.

## Next step

Confirm the narrower 3a (Next move only), or say the general BUILD tap should ship alongside it after all. I'll finalize file-level specifics for whichever scope you confirm and send that back for one more review pass before any code, same as every prior phase.

## Resolved 2026-09-09 (second pass)

Bob confirmed the narrower scope: Next move only, general BUILD tap deferred to its own future phase.

## Finalized specifics for Next move, pending copy sign-off

Working out the exact shape surfaced one thing the brief's "same shape as ptw-arrival's onTap" line understates: Next move needs BOTH a model-generated reaction (pre-flight #4's "why it follows from this one," which needs a real model call to say something specific rather than restate the section order the Focus Playbook screen already shows via its own inline "Next: {label} → Go" cue) AND a real action tap that starts a build. Every existing generated entry (Choice, Delivery) is reflection-only — no `onTap`, no entry-specific quick reply, just the two dismissal taps `fireMoment` already appends. Next move is the first entry that needs both at once. That is a real, if small, extension to two places, not just a new catalog row:

1. **`fireMoment`** (`src/App.jsx:9107-9123`): the `quickReplies` it builds for a fired reply are currently always just the two dismissal taps for a `dismissible` entry. Next move's entry needs to contribute one more, entry-specific, action reply (`Build {label}`) ahead of those two — a new optional field, e.g. `actionReply: (ctx) => ({label, value})`, that `fireMoment` includes when present.
2. **The moment tap handler** (`src/App.jsx:7901-7908`): `entry.onTap(value, ctx)` is currently called with a small fixed object, `{markDone, addNewOpportunity, advance}` — Next move's `onTap` needs a way to call the refactored `genSec` for the *specific record* the moment fired on, so that object gains one more function.

Everything else matches the brief as written: the refactored `genSec`/`gp`/`go` at component scope (currently closed over inside the `case 'focus':` render block, `src/App.jsx:14905-14919`), eligibility keyed on "a Delivery moment already fired for the most recently built section, and `FOCUS_ORDER` has an unbuilt section after it," no `BUILD` trailer, no server-side `situation.notBuilt` validation, no `SYSTEM_PROMPT_STABLE` change — the model never names the section, `App.jsx` already knows it.

**Draft copy, for sign-off before any of this is built** (written with `PLAIN_ENGLISH` applied from the start rather than needing a second pass):

Server-side reaction prompt (`buildNextMoveReactionText`, same `[bracketed instruction]` shape as the other reaction builders in `api/coach.js`):

> `[They just finished ${justBuiltLabel}. The next section Reimagine builds, in order, is ${nextLabel}. Write one sentence saying why ${nextLabel} follows well from ${justBuiltLabel} -- name one specific thing ${justBuiltLabel} gave them that ${nextLabel} will use. Do not explain what ${nextLabel} is in general terms. End by asking if they want you to build it now. ${PLAIN_ENGLISH} Do not mention that this is an automated check.]`

The action quick-reply label: **"Build {nextLabel}"** (e.g. "Build Bridge Story"), `value: 'build_next'`. Dismissal pair unchanged ("I'm good for now" / "Stay quiet on this screen").

**Open call for Bob:** generated reasoning (above, costs one model call per fire, says something specific each time) versus a fully static, ptw-arrival-shaped template with no model call and no extension to `fireMoment`/the tap handler (faster to ship, but says less than the Focus Playbook's own "Next: {label}" cue already shows on the page). Recommend generated — the whole point of Next move over the page's existing cue is Coach naming the actual connection, and that is the one thing a template can't do.
