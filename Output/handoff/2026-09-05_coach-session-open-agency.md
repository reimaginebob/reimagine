## Prompt for Code

Apply the change in this brief to `api/coach.js`, premise-verify the anchors below against current `main`, run the static gates, add a source-level regression test following the pattern of its siblings, then follow the gh flow in section 9 of CLAUDE.md: push, open the PR, watch CI, squash-merge once green, and report the PR URL and merge SHA.

---

## Date / Type / Source

2026-09-05. Implementation brief, arising directly from Bob's own standing instruction about anticipation and delight, applied to a specific surface: the returning-session opener. Bob's framing, verbatim in substance: on a new session (not a new account — a returning person logging back in), Coach should lead with how the person is doing, then ask if there is something specific they want to work on today, or whether they would like Coach to suggest something based on what it can see in their search. Two choices, not a dead end, and mood comes before data because "people are emotional creatures, and they can't really think rationally until their emotions have been dealt with."

This supersedes rather than sits beside `Output/handoff/2026-09-05_coach-thin-signal-mood-check.md` (merged docs-only as PR #727, never implemented in code). That brief only asked for a mood-check on the narrow slice of sessions where nothing changed AND search-intake was thin. Bob's fuller framing applies to every returning session regardless of either condition — this brief implements the general case, and the thin-signal brief's scope is now fully contained inside it. No further action is needed on that older brief; it should not also be implemented separately.

## Pre-flight discovery (scope correction)

Verified against `main` at HEAD (post PR #729):

- **The exact surface this touches already exists and is well-isolated.** `sessionOpenNote` (`api/coach.js:726-738`) is the only place that decides what Coach says on the first turn of a returning session. It is gated on `sightOn && sessionOpenRequested` (`api/coach.js:726`) — both already re-verified server-side (`sessionOpenRequested`, `api/coach.js:1213`, re-checks `hasNextStep` itself rather than trusting the client). This brief changes the text this function returns; it does not touch the gate, the short-circuit for a first-ever session (`api/coach.js:1220-1227`), or `SESSION_OPEN_TURN_TEXT` (`api/coach.js:135`, the silent internal message that triggers this turn) — that string just says "say whatever WHAT CHANGED SINCE THEIR LAST SESSION tells you to," which stays true under the new text since the same heading is kept.
- **No new plumbing needed for the "suggest something" branch.** `nextStepNote` (`api/coach.js:705-716`) is already computed unconditionally for every `sightOn` turn (not just the opener) and already contains the real, screen-matched recommendation ("WHAT IS ON THE TABLE FOR THEM RIGHT NOW"). Today `sessionOpenNote` pre-empts it by telling Coach to lay out next-step options immediately, unprompted, whenever something material changed. This brief just changes sessionOpenNote to defer to `nextStepNote` only once the person actually asks for a suggestion, rather than reciting it upfront.
- **`si` (the search-intake row) is already in scope inside this function** (`api/coach.js:552`, used two statements before `sessionOpenNote` is defined) — no new data fetch or argument threading is needed to reference it.
- **A real, small conflict this brief has to resolve: `searchIntakeNote(si)` fires on every turn, including the session-open turn, whenever intake is incomplete** (`api/coach.js:513-524`, unconditional; appended at `api/coach.js:742`). Left alone, a returning session with thin intake would get TWO separate open questions stacked in one reply — the new agency question this brief adds, and search-intake's own "what's going well in your search" ask. That is exactly the "pile of questions" Bob has said he does not want. Since the new agency question ("is there something you want to work on today") already invites the same kind of answer intake would have captured, this brief suppresses `searchIntakeNote` specifically on the session-open turn and lets it resume on the very next ordinary turn if intake is still thin after the person replies.
- **No client-side change needed.** The person's answer to "what do you want to work on" or "please suggest something" is ordinary conversation — Coach responds in the same turn-by-turn way it always does. No new capture mechanism, no new trailer, no new one-tap offer. `src/App.jsx` and `src/components/Chat.jsx` are unaffected; `scripts/test-coach-session-open.mjs`'s existing assertions (the gate regex, the 204 short-circuit, the client's silent-send wiring) all still hold because none of that machinery changes — only the text `sessionOpenNote` builds.
- **The `hasMaterialChange` branch is not deleted, it's repurposed.** Today it decides whether Coach recites a status update or a "nothing changed" line. Under this brief it instead decides whether Coach has something concrete to weave into the how-are-you-doing check-in itself (naming the actual interview, the actual company) versus checking in plainly with nothing to reference — the material-change fact becomes color for the greeting, not the thing the reply is organized around.

## Files affected

| File | Change |
|---|---|
| `api/coach.js` | Rewrite `sessionOpenNote`'s instruction text (mood-first opener + agency question, deferring to `nextStepNote` only on request); suppress `searchIntakeNote(si)` specifically on the session-open turn |
| `scripts/test-coach-session-open-agency.mjs` | New source-level regression test |

## Specific changes

**1. `api/coach.js` — rewrite `sessionOpenNote`'s returned instruction text (`api/coach.js:726-738`).** Keep the gate, the delta computation, and the `factsBlock` construction exactly as they are — only the final returned string changes. Locate the current final line:

```
    return `\n\nWHAT CHANGED SINCE THEIR LAST SESSION (authoritative — the ONLY source for what happened; never invent or infer anything beyond it, and never turn it into a count, a fraction, or a percentage):\n${factsBlock}\n\nThis is the first turn of a new session — open with this yourself, in your own voice, before they ask anything. ${delta.hasMaterialChange ? 'Something real changed, so name it plainly and specifically using the actual names above (never a vague "some things happened"), then connect it to what is worth doing next. If more than one next step is genuinely reasonable from here, lay out the real options with why each one and what it is likely to get them, and let them choose which direction; if only one really makes sense, say so and say why.' : 'Nothing changed, and that is fine to say plainly — confirm what is already in motion and still on track. You may name one small adjacent thing worth doing if one genuinely fits, but never invent movement that did not happen, and never open cold or silent.'} Keep it to a few sentences before handing the conversation to them.`
```

Replace with:

```
    return `\n\nWHAT CHANGED SINCE THEIR LAST SESSION (authoritative — the ONLY source for what happened; never invent or infer anything beyond it, and never turn it into a count, a fraction, or a percentage):\n${factsBlock}\n\nThis is the first turn of a new session — open with this yourself, in your own voice, before they ask anything. Lead with them, not their pipeline: ask how they are doing, or how the week has treated them, before you get anywhere near their search — that comes first because it shapes whether anything you say next actually lands. ${delta.hasMaterialChange ? 'Something real happened, so weave it into that same check-in by name rather than reporting it separately afterward — ask about the actual interview, the actual company, the way someone who noticed would, instead of reciting "here is what changed."' : 'Nothing changed since last time, and that is fine to say plainly if it comes up — never invent movement that did not happen, and never open cold or silent.'} Once they have answered, hand them the wheel: ask, in your own words, whether there is something specific they would like to work on today, or whether they would rather you suggest something based on what you can see in their search. Treat both as equally real — if they name their own focus, follow it completely rather than steering back to your own read of what matters most; only when they ask you to suggest something do you reach for what is on the table for them below and make the case for it. Keep the whole opener to a few sentences and one flowing thought, never a checklist of questions stacked on top of each other.`
```

**2. `api/coach.js` — suppress `searchIntakeNote(si)` on the session-open turn.** Locate the return statement at the end of `buildCoachProfileSlice` (`api/coach.js:742`):

```
  return `THIS USER'S REIMAGINE PROFILE (you can reference and reason about it; you never change it yourself — the only writes are the one-tap offers described at the end of this block, which the person accepts or declines):\n\n${anchor1}\n\n${anchor2}\n\n${indexBlock}${offerBlock}${sparseNote}${preBrandNote}${myStatusData}${focusData}${activityData}${sessionOpenNote}${nextStepNote}${connectorNote}${INTERVIEW_TEAM_CAPTURE_NOTE}${pipelineNote}${activityNote}${VALUES_CAPTURE_NOTE}${ASSESSMENT_CAPTURE_NOTE}${searchIntakeNote(si)}`
```

Change the final interpolation from `${searchIntakeNote(si)}` to `${sessionOpenRequested ? '' : searchIntakeNote(si)}`, with a short comment above the return explaining why (the new agency question already invites the same kind of answer, and stacking a second, unrelated question in the same reply is the "pile of questions" problem this brief exists to avoid). Search-intake capture resumes on the very next ordinary turn if intake is still thin.

**3. Update the comment block above `sessionOpenNote`** (`api/coach.js:717-725`, currently titled "RETURNING-SESSION OPENING RECAP") to describe the new behavior — mood-first, agency-question opener, not a recap — so the next person reading this code understands why the text no longer just reports status. Keep the parts that are still true (next_step pilot only, only fires on the client-marked opener turn, no note on a true first-ever session).

## Voice rules on inserted text

This is Coach speaking, not shipped UI copy `check-voice.mjs` scans (`api/coach.js` is not in that gate's `FILES_TO_CHECK`), so there is no automated backstop — get it right by hand. No AI-coaching register ("sit with," "notice what comes up"), no logic-flip cadence, no comparative-standing ("most people"). "Lead with them, not their pipeline" is a plain instruction, not a banned construction — it does not follow the "X is not Y, it is Z" shape the gate targets. Keep the register consistent with every other instruction in this file: tell Coach what to do and why, in Coach's own words each time, never a script to recite verbatim.

## Static gates

- `npm run build` clean (full prebuild chain, tests, lint, vite build)
- `check-voice`: 0/0 (unaffected — `api/coach.js` is outside this gate's file list)
- `check-sys-equality`, `check-prompt-refs`: unaffected (no shared-constant or prompt-reference surface touched)
- `src/App.jsx` EOF integrity: unaffected (this brief does not touch `src/App.jsx`)
- Diff scope limited to `api/coach.js` and the new test

## Runtime gate (post-merge, optional)

Bob (or Cowork-Claude) can verify against a `next_step`-pilot test account: log out, wait past the session boundary, log back in, open Coach, and confirm it opens by asking how things are going (not reciting a status update), then asks whether there's something specific to focus on today or whether they'd like a suggestion. Reply "surprise me" and confirm Coach reaches for a real, screen-matched recommendation rather than a generic one. Reply naming your own focus and confirm Coach follows it rather than redirecting. Repeat with an account that has a real pipeline change since last login (a new interview, say) and confirm Coach references it by name inside the check-in itself rather than as a separate status line.

## Constraints

Single PR. No effort estimates. PR title: "Let Coach open a session by asking, not reporting."

## Out of scope

`Output/handoff/2026-09-05_coach-thin-signal-mood-check.md` (PR #727) is superseded by this brief and needs no separate implementation. The pipeline visualization work, the new stage vocabulary, and the interview-team follow-through brief (PR #729) are unrelated surfaces, not touched here. No change to `nextStepNote`'s own content or the door-recommendation logic in `src/step-position.js` — this brief only changes when and how Coach reaches for it.

## Commit message

```
Let Coach open a session by asking, not reporting

Coach's returning-session opener used to lead with a status report --
what changed, then what to do about it, decided by Coach before the
person said a word. It now leads with the person: how they're doing,
woven together with the real thing that happened if something did,
then a real choice -- work on something specific, or ask Coach to
suggest based on what it can see. The suggestion itself already existed
(the next-step door logic); this only changes it from something Coach
volunteers unprompted to something it offers and follows through on.
Search-intake's own question is suppressed on this one turn so a
thin-signal session doesn't get two open questions stacked in one
reply -- it resumes normally the turn after.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Qbsj3ds9Cfozte1ASdRrDx
```

## Push

Branch off current `main`, PR, CI, squash-merge per section 9. Vercel auto-deploys from `main` on merge.

## Implementer's checklist

1. Pull `main`, confirm HEAD, re-grep the anchors above for drift.
2. Rewrite `sessionOpenNote`'s returned text per change 1.
3. Suppress `searchIntakeNote(si)` on the session-open turn per change 2.
4. Update the comment block above `sessionOpenNote` per change 3.
5. Add the new test file, modeled on `scripts/test-coach-session-open.mjs`.
6. Run `npm run build` (full gate chain); confirm clean.
7. Commit, push, open PR, subscribe to activity, watch CI, squash-merge.
8. Report PR URL and merge SHA.
