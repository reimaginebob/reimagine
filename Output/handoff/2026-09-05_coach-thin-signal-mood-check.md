## Prompt for Code

This brief has one open decision for Bob (flagged below) before it's buildable as written — read the "Open decision for Bob" section first. Once that's answered, apply the change to `api/coach.js`, premise-verify the anchors below against current `main`, run the static gates, add a source-level regression test following the pattern of its siblings, then follow the gh flow in section 9 of CLAUDE.md: push, open the PR, watch CI, squash-merge once green, and report the PR URL and merge SHA.

---

## Date / Type / Source

2026-09-05. Implementation brief, arising directly out of Bob's own response to Finding 1 of the "closing the dual-confusion gap" consult. Bob's framing, verbatim in substance: if a returning user has given little or no signal about how their search is going, the welcome-back moment on a new session should ask something like "how's your week been going?" — inviting their current state rather than assuming it.

## Pre-flight discovery (scope correction — read before building anything)

**Finding 1 of the consult already turned out to be substantially built**, and this brief corrects the scope down to what's genuinely missing rather than proposing a new mechanism from scratch:

- The "what's going well / what would you like to improve" capture already exists (`src/App.jsx:13106-13119`, comment-dated "consult 2026-08-20"), lives on the second screen of orientation (right after Welcome), is optional, and is also offered conversationally by Coach if skipped (`searchIntakeOpener`, `src/App.jsx:4731`). It writes to `users.search_going_well` / `users.search_focus` and is read into Coach's context on every turn (`api/coach.js:554-555`, via `searchIntakeLine`).
- **What does NOT exist yet, and is this brief's actual scope:** the returning-session opener (`sessionOpenNote`, `api/coach.js:726-738`, gated to the `next_step` pilot / `hasNextStep` accounts, same population as everything else in this pilot) never looks at whether that search-intake signal is thin. Today it only ever talks about product state — pipeline movement, new opportunities, saved directions, logged activity — and falls back to a flat "Nothing changed... a quiet stretch, not a stalled one" line when there's nothing to report. It has no path that asks how the person is actually doing.
- **No new capture mechanism is needed for the response.** `src/components/Chat.jsx:670-677` already offers a one-tap "keep it" save any time Coach's reply carries an `X-Coach-Search-Intake` trailer (`siHeader`) — this fires from ordinary conversation, not just the dedicated intake screen. So if Coach asks "how's your week going" and the person answers with anything substantive about their search, the existing capture pipe already saves it the same way a values or assessment mention gets saved. This brief only changes what Coach is told to ask on this one turn; the save path is untouched and already correct.
- Confirmed exact current shape of the branch this brief changes, `api/coach.js:737`:
  ```
  return `\n\nWHAT CHANGED SINCE THEIR LAST SESSION (authoritative — the ONLY source for what happened; never invent or infer anything beyond it, and never turn it into a count, a fraction, or a percentage):\n${factsBlock}\n\nThis is the first turn of a new session — open with this yourself, in your own voice, before they ask anything. ${delta.hasMaterialChange ? 'Something real changed, so name it plainly and specifically using the actual names above (never a vague "some things happened"), then connect it to what is worth doing next. If more than one next step is genuinely reasonable from here, lay out the real options with why each one and what it is likely to get them, and let them choose which direction; if only one really makes sense, say so and say why.' : 'Nothing changed, and that is fine to say plainly — confirm what is already in motion and still on track. You may name one small adjacent thing worth doing if one genuinely fits, but never invent movement that did not happen, and never open cold or silent.'} Keep it to a few sentences before handing the conversation to them.`
  ```
  The `!delta.hasMaterialChange` branch (the false side of that ternary) is exactly where this brief's new instruction lands.
- **Not a literal script.** Every exemplar elsewhere in this file (DISCOURAGEMENT's seven angles, TEACH THE FRAMEWORKS) is explicitly "the register and the idea, not a script to recite" — Coach is told what to do and shown the voice, never handed the exact sentence to repeat. This brief follows that same convention rather than hard-coding "Hey Bob, good to see you today" as a literal line Coach would say verbatim every time, which would read as a canned greeting on the second use.

## Open decision for Bob

The `!hasMaterialChange` branch and "search-intake is thin" are two independent facts that can combine four ways. This brief needs to know which of these Bob actually wants before it's buildable:

1. **Nothing changed AND intake is thin** — clear case for the mood-check. Not really an open question.
2. **Something changed AND intake is thin** — does Coach still lead with the concrete pipeline update (current behavior), just with a warmer, more personal close inviting how things are going generally? Or does the mood-check take priority over the update?
3. **Nothing changed AND intake already has real signal (not thin)** — stays as today's "quiet stretch" line, unless Bob wants the warmer tone applied universally regardless of intake state. This brief assumes NOT, based on his framing ("if none or very thin input was given") — the mood-check is specifically for the thin-signal case, not a general tone change.
4. Should this fire **every** returning session while intake stays thin, or only the **first** one (so it doesn't start to feel like a repeated, ignored question if the person keeps not answering)?

This brief is written to answer (1) and assumes (3) as stated. It needs Bob's call on (2) and (4) before Code builds it — flagging rather than guessing, per standing practice.

## Files affected

| File | Change |
|---|---|
| `api/coach.js` | New branch in `sessionOpenNote`'s instruction text, used when search-intake is thin |
| `scripts/test-coach-thin-signal-mood-check.mjs` | New source-level regression test |

## Specific changes

Pending Bob's answer to the open decision above. Sketch of the shape assuming answer (2) is "concrete update still leads, mood-check only when nothing changed at all" and answer (4) is "every returning session while thin" (both are the more conservative reads of Bob's framing, easiest to loosen later if he wants it broader):

Locate (exact current text, `api/coach.js:726-738`):
```
  const sessionOpenNote = (sightOn && sessionOpenRequested) ? (() => {
    let delta = null
    try { delta = computeSessionDelta(state, pursuitRows, activityFacts, priorSessionAt) } catch { return '' }
    if (!delta) return ''
    const lines = []
    if (delta.addedOpportunities.length) lines.push(`Added since last time: ${delta.addedOpportunities.join('; ')}.`)
    if (delta.interviewsHappened.length) lines.push(`Interview(s) that happened: ${delta.interviewsHappened.map(x => x.title).join('; ')}.`)
    if (delta.otherMovement.length) lines.push(`Other movement logged on an existing opportunity: ${delta.otherMovement.join('; ')}.`)
    if (delta.addedDirections.length) lines.push(`New direction(s) saved: ${delta.addedDirections.join('; ')}.`)
    if (delta.newActivity.length) lines.push(`Search activity noted: ${delta.newActivity.map(a => a.activity).join('; ')}.`)
    const factsBlock = lines.length ? lines.join('\n') : 'Nothing changed in their pipeline or activity since their last session — a quiet stretch, not a stalled one.'
    return `\n\nWHAT CHANGED SINCE THEIR LAST SESSION (authoritative — the ONLY source for what happened; never invent or infer anything beyond it, and never turn it into a count, a fraction, or a percentage):\n${factsBlock}\n\nThis is the first turn of a new session — open with this yourself, in your own voice, before they ask anything. ${delta.hasMaterialChange ? 'Something real changed, so name it plainly and specifically using the actual names above (never a vague "some things happened"), then connect it to what is worth doing next. If more than one next step is genuinely reasonable from here, lay out the real options with why each one and what it is likely to get them, and let them choose which direction; if only one really makes sense, say so and say why.' : 'Nothing changed, and that is fine to say plainly — confirm what is already in motion and still on track. You may name one small adjacent thing worth doing if one genuinely fits, but never invent movement that did not happen, and never open cold or silent.'} Keep it to a few sentences before handing the conversation to them.`
  })() : ''
```

The one clause that changes is the false side of the `hasMaterialChange` ternary — replacing "Nothing changed, and that is fine to say plainly..." with a version that branches again on whether `si.goingWell`/`si.focus` are both empty, so a quiet-and-thin session gets a warm, varied invitation to say how things are going instead of the flat status confirmation, while a quiet-but-already-answered session keeps today's behavior untouched. `si` (the search-intake row) is already available in this function's scope (it feeds `searchIntakeNote(si)` two lines below at `api/coach.js:742`) so no new data plumbing is needed — just reading it one function earlier than it's currently used.

## Voice rules on inserted text

The new instruction must stay in the same register as every other instruction in this file — tell Coach what to do and why, in Coach's own words each time, never a literal script. It must not read as a form question ("please rate how your search is going") — it should read the way a person would actually ask, varying each time. Confirm against `check-voice`'s `HARD_PATTERNS` (AI-coaching register, meta-narration) since this is new prose Coach will speak.

## Static gates

- `npm run build` clean (full prebuild chain, tests, lint, vite build)
- `check-voice`: 0/0
- `check-sys-equality`, `check-prompt-refs`: unaffected (no shared-constant or prompt-reference surface touched)
- Diff scope limited to `api/coach.js` and the new test

## Runtime gate (post-merge, optional)

Bob (or Cowork-Claude) can verify against a `next_step`-pilot test account with search-intake left blank: log out, wait past the session boundary, log back in, open Coach, and confirm the opener asks how things are going rather than reciting "nothing changed."

## Constraints

Single PR. No effort estimates. PR title: "Ask how things are going when a returning session has nothing else to go on."

## Out of scope

No change to the search-intake screen itself, the dedicated `searchIntakeOpener` chat prompt, or the one-tap capture mechanism that saves the answer — all three are already correct and untouched. No change to the `!sightOn` (non-pilot) population; this feature inherits the existing `next_step` pilot gate as-is.

## Commit message

Not yet finalized — depends on Bob's answer to the open decision above.

## Push

Branch off current `main`, PR, CI, squash-merge per section 9. Vercel auto-deploys from `main` on merge.

## Implementer's checklist

1. Get Bob's answer on the open decision (points 2 and 4 above) before writing code.
2. Pull `main`, confirm HEAD, re-grep the anchors above for drift.
3. Apply the change to `sessionOpenNote`.
4. Add the new test file.
5. Run `npm run build` (full gate chain); confirm clean.
6. Commit, push, open PR, subscribe to activity, watch CI, squash-merge.
7. Report PR URL and merge SHA.
