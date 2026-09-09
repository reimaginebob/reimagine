# Coach-as-Concierge Phase 3 copy extraction — everything a person can read

Per the engine guardrails brief (`Output/handoff/2026-09-09_coach-engine-guardrails-brief.md`, change 5): every user-visible string and model instruction Phase 3 (Next move, Stall) added, verbatim, with file and line, plus a note on whether it already references `PLAIN_ENGLISH`. **Nothing in this document has been edited or rewritten — it is pulled verbatim from source**, same discipline as the Phase 2 extraction (`Output/handoff/2026-09-09_coach-voice-extraction.md`).

The Phase 3 flag (`onboarding_concierge`, same flag Phase 2 shipped under) stays scoped to Bob's account only until this document gets a sign-off pass and Bob has read these moments live on production, per the brief's own instruction — that gate is not resolved by producing this document, only by what happens after Bob reviews it.

Both families shipped as their own PRs: Next move (#831), Stall (#833).

---

## Family: Next move

Generated (a real model call), same silent-turn shape as Choice/Delivery (`fireMoment` → `/api/coach` → `buildMomentTurnText`). The bracketed text below is the *instruction* the model receives, never shown to the person; the person sees only the model's reply to it, plus a static action-tap label rendered client-side.

### `buildNextMoveReactionText(justBuiltLabel, nextLabel)` — the reaction the model writes
**File:** `api/coach.js:693-695`

> [They just finished {justBuiltLabel}. The next section Reimagine builds, in order, is {nextLabel}. Write one sentence saying why {nextLabel} follows well from {justBuiltLabel} -- name one specific thing {justBuiltLabel} gave them that {nextLabel} will use. Do not explain what {nextLabel} is in general terms. End by asking if they want you to build it now. {PLAIN_ENGLISH} Do not mention that this is an automated check.]

**References `PLAIN_ENGLISH`: yes** — the shared plain-language instruction (`api/coach.js`, defined near `buildBrandRichnessCheckText`) is interpolated directly into this template, same as every other Phase 2 reaction template rewritten in the 2026-09-09 voice review.

### Action-tap label — static, client-rendered
**File:** `src/coach-moments.js:289`, the `next-move` entry's `actionReply`

> Build {nextLabel}

(e.g. "Build Bridge Story," "Build Interview Prep" — `nextLabel` is the real screen-facing section name via `focusLabelFor`, independent-track-aware.) Tap value routes to `ctx.genSec`, which starts the build directly — no confirmation copy, the build's own completion is the confirmation (matching the `#784` discipline already used elsewhere in Coach's write mechanisms).

**Not its own reviewed string** — this is a fixed template (`Build ${nextLabel}`), not free text the model writes, so there's no PLAIN_ENGLISH question for it the way there is for prose; flagging it here because it's still something a person reads and taps.

---

## Family: Stall

Static — no model call. The design calls this "one question, not a nudge," and the copy was drafted with `PLAIN_ENGLISH` applied from the start (this session's own standard, established after the Phase 2 voice review) rather than needing a rewrite pass, but it has not yet had the same Bob-and-Cowork review round the Phase 2 templates got.

### `stall` — the one question
**File:** `src/coach-moments.js:318`

> You've come back to this a few times without building anything yet. What would make it worth doing right now — or would you rather look at something else?

Quick reply:
- "Take me to Career Paths" (`src/coach-moments.js:320`) → routes to `laneSelect` via `ctx.advance('focus', 'laneSelect')`, no follow-up text.

**Fires when:** nothing at all has been built yet for the current record, and either 3 separate visits to the Focus Playbook have happened or 90 seconds have passed idle (`stallEligible`, `src/App.jsx`) — confirmed thresholds, Bob's call, 2026-09-09.

**Written with PLAIN_ENGLISH in mind: yes, by intent** — drafted and sent for sign-off in the same message as the mechanism itself (`Output/handoff/2026-09-09_coach-concierge-phase-3-build-nextmove-stall.md`, "Phase 3b (Stall)" section) rather than written first and reviewed after, unlike Phase 2's templates. It has not been read against a live reply the way the voice review's rubric eval or a real production read would test it.

---

## User guide additions (Phase 3a)

Not Coach chat copy, but genuinely new user-visible text Phase 3 added — the guide chapter documenting Coach's first ability to trigger an action beyond writing a profile field.

**File:** `src/data/user-guide/my-coach.md:19` (new paragraph, "What it can do")

> On your Focus Playbook, once you build one section, it often follows with a quick word on what naturally comes next and a one-tap offer to build that section too — the same build the screen's own button would start, just offered where you are.

**File:** `src/data/user-guide/my-coach.md:25` (revised sentence, "What it won't do, and why that helps")

> It won't change your work on its own. The only things it writes or builds are the ones you tap to accept — a profile update it offers to save, or the next Focus Playbook section it offers to build — and everything else it points you to the step for.

**Not gated by PLAIN_ENGLISH** — that instruction governs Coach's own model-generated prose; this is hand-written guide copy in the doc's own established voice, unchanged mechanism from how the rest of the guide is written.

---

## What this document does NOT cover (flagging so the gap is visible)

- **Stall's redirect and dismissal taps carry no follow-up text** (unlike `ptw-arrival`'s two branches in the Phase 2 extraction) — confirmed, not an omission. There is nothing to extract there.
- **The general opportunistic BUILD tap** — never implemented. Phase 3's central-question resolution (`Output/handoff/2026-09-09_coach-concierge-phase-3-build-nextmove-stall.md`, "A scope reduction found while designing 3a's specifics") narrowed 3a to Next move only; the general tap (Coach naming a build mid-conversation, not just via a scripted moment) is deferred to its own future phase. No copy exists for it.
- **No real production samples.** Same gap as the Phase 2 extraction and for the same reason — this session has no database, admin-dashboard, or live-model-call access. Both families have shipped and are running on Bob's account behind the flag; the real test is Bob reading the actual replies, which this document cannot substitute for.
