# Prompt for Code

Save this file verbatim to `Output/handoff/2026-09-09_coach-engine-guardrails-brief.md` in this repo. Then do two things, in this order. First, apply the four engine rules below as one PR: `coach: distress and discouragement holds, snooze tightening, Situation placement`. Premise-verify against current `main` before touching anything (the pre-flight section says what I checked and where), run the standing gates, gh flow, report PR URL and merge SHA. Second, before any of Phase 3 reaches an account other than Bob's, extract every user-visible string and model template that Phase 3 added (build-offer button text, Next move, Stall, and anything else a person can read) into a file the way you did for Phase 2, and send it back. The Phase 3 flag stays on Bob's account only until Bob has signed off on that text and read the moments on production. No new user-visible copy ships in the engine PR.

---

**Date:** 2026-09-09
**Type:** Engine guardrails for Coach-as-Concierge (Phases 2 and 3 built; Phase 3 not yet past Bob's account)
**Source:** Bob and Cowork review of the four-phase summary with an outside read; Cowork verification against `src/text-strippers.js` and `api/coach.js` on 2026-09-09

## Pre-flight discovery

- `ensureDistressSupport` lives at `src/text-strippers.js:925-960`. It is a deterministic phrase match (`DISTRESS_TRIGGER_RE`) on explicit self-harm or not-wanting-to-be-alive language only, calibrated 2026-06-10 as a minimal floor, and by design does not fire on ordinary search fatigue. It runs in `api/coach.js` at line ~2693 on the user's typed message, after the output strippers, and appends one human-pointer sentence if the reply lacks one. It stores nothing.
- `DISCOURAGEMENT` is a prompt block in `SYSTEM_PROMPT_STABLE` (`api/coach.js:~1490`) that shapes one reply when the person reads as worn down. It is model-judged and stores nothing.
- Neither mechanism talks to the Moments engine. Silent moment turns carry no user text, so `ensureDistressSupport` cannot see them and does not run on them. That is the gap this brief closes.
- The design's significance list (design doc Section 5) is: significant = Delivery, Choice, Next move with a build offer, Return, Arrival on a hub; ordinary = Arrival on a section, Stall, Capture. "I'm good for now" quiets ordinary moments for the session; significant moments still open.
- Situation is built client-side and sent on every turn as the SITUATION block. Its placement relative to the cached system blocks (reordered in #807) is what this brief pins down; I did not verify the current placement, so confirm it.
- Phase 3 (build offers, Next move, Stall) is merged behind its flag. Its user-visible text has not been through Bob's sign-off gate.

## Files affected

| File | Change |
|---|---|
| `api/coach.js` | set a session distress flag where `ensureDistressSupport` trips; emit a silent `MOOD: low` trailer when the DISCOURAGEMENT response is used; Situation block placement; token logging |
| `src/coach-moments.js` (or wherever the evaluator lives) | distress hold as first check; discouragement soft hold; snooze tightening |
| `src/coach-routing.js` or the trailer parser | strip and parse `MOOD:` trailer like `SELFCHECK:` |
| `src/App.jsx` | second "I'm good for now" quiets everything for the session |
| `Output/handoff/2026-09-08_coach-concierge-design.md` | add the rules below to Section 5 and the presence model in Section 3a |
| user guide, `FEATURE_MAP` | only if any user-facing capability changes; none expected |

## Specific changes

### 1. Distress hold (hard, all families)

When `ensureDistressSupport` matches the user's message (whether or not it had to append the pointer), set a session-scoped flag, `coachDistressHold`, on the client. The evaluator checks this flag before it builds the candidate list. If set: no moment fires, in any family, at any significance, regardless of presence state, priority, or the per-visit cap. Nothing posts to the strip. Coach stays exactly where the person left it. Typed conversation is unaffected. The flag clears at the next session open (the Return recap already runs there and is a gentle opener). It does not clear on a calm later message in the same session. Coach never announces the hold.

### 2. Discouragement hold (soft, ordinary families)

Add one line to the DISCOURAGEMENT block instructing the model to end the reply with the silent trailer `MOOD: low` whenever it used the discouragement response, in the same wrapper form `SELFCHECK:` uses. Strip it from the visible reply the way `parseSelfcheck` strips `SELFCHECK:`. When the trailer is present, set `coachMoodHold` for the session. While set: Stall and every other ordinary moment stay off, and Next move drops to ordinary. Significant moments that respond to something the person just did (Delivery, Choice) still fire, because answering an action is not an interruption. Clears at next session open. Log the trailer as a product signal like SELFCHECK, no content.

### 3. Snooze tightening (presence model)

Two changes to "I'm good for now." (a) After it is tapped, Next move with a build offer is treated as ordinary for the rest of the session, so it no longer reopens the panel; Delivery, Choice, Return, and Arrival on a hub keep their significance. (b) A second "I'm good for now" in the same session quiets every family, significant included, until the next session open. Both taps keep logging `declined` through the existing endpoint. Significance stays a catalog column; this is a session-state adjustment on top of it, not a catalog edit.

### 4. Situation placement and cost

The SITUATION block changes every turn (idle time alone guarantees it), so it must be positioned after every cached system block, never ahead of one, or it defeats the #807 reorder. Confirm current placement and fix if needed. Add a sampled log line (one in twenty turns is enough) recording the SITUATION block's token count, so the per-turn cost of Phase 1a is a number on file rather than an estimate. No other cost change.

### 5. Phase 3 copy extraction (document, not code)

Same format as `20260909_coachvoiceextraction.md`: every string a person can read and every model instruction Phase 3 added, verbatim, with file and line, plus a note for each on whether it already references `PLAIN_ENGLISH`. Return the file. Do not rewrite anything in it.

## Voice rules on inserted text

No new user-visible text in the engine PR. The `MOOD:` trailer is stripped before display. The distress pointer sentence is unchanged.

## Static gates

`npm run build` clean; `check-voice` 0/0; `check-prompt-refs` 0; App.jsx line count and EOF verified before and after; diff limited to the files named. `api/coach.js` is touched, so the preview smoke applies.

## Runtime gate (Bob, on production, after merge)

Type a discouraged message to Coach ("I'm exhausted, I don't know if this is worth it"), then sit idle on a Career Paths section with nothing built for longer than the Stall threshold. Stall must not fire. Build a section in the same session; Delivery should still speak. Tap "I'm good for now" twice; nothing should open afterward. Confirm the SITUATION token count appears in the logs.

## Constraints

Single PR for changes 1 through 4. Change 5 is a returned document. No effort estimates. Phase 3 flag remains Bob-only until the copy sign-off and the production read are done. No copy edits, renames, or tidying beyond the named changes.

## Out of scope

The challenge mechanism (stalled or avoiding a step they know about, keyed on pipeline data) is a future Check moment, not this brief. Pre-Phase-2 Coach copy review is separate. The rubric eval from the plain-English PR is not extended here.

## Commit message

```
coach: distress and discouragement holds, snooze tightening, Situation placement

- Moments engine checks a session distress flag (set where ensureDistressSupport trips) before building candidates; when set, no moment fires in any family for the session
- DISCOURAGEMENT reply emits a silent MOOD: low trailer; while set, ordinary moments and Stall hold, Next move drops to ordinary, Delivery and Choice still respond to actions
- "I'm good for now": Next move with build offer becomes ordinary after the tap; a second tap quiets all families until next session
- SITUATION block confirmed after all cached system blocks; sampled token-count log added
- Design doc Sections 3a and 5 updated
```

## Implementer's checklist

1. Pull `main`. Save this brief to `Output/handoff/`.
2. Premise-verify: `ensureDistressSupport` at `src/text-strippers.js:925-960` and its call in `api/coach.js`; DISCOURAGEMENT block; the evaluator's candidate-building step; `parseSelfcheck`; SITUATION block placement relative to cached blocks. STOP and report if any has moved or differs from the pre-flight.
3. Apply changes 1 through 4.
4. Update the design doc.
5. Run gates; preview smoke on `api/coach.js`.
6. Open PR, watch CI, squash-merge, report PR URL and merge SHA.
7. Produce the Phase 3 extraction file (change 5) and return it. Do not open the Phase 3 flag to any other account.
