## Prompt for Code

Apply the changes in this brief to `api/coach.js` and `src/App.jsx` (both decisions below are already settled by Bob — no need to check back before building), premise-verify the anchors below against current `main`, run the static gates, add a source-level regression test following the pattern of its siblings, then follow the gh flow in section 9 of CLAUDE.md: push, open the PR, watch CI, squash-merge once green, and report the PR URL and merge SHA.

---

## Date / Type / Source

2026-09-05. Implementation brief, arising directly from a live design conversation with Bob about the pipeline visualization work. Not part of the earlier best-practices audit — a new idea Bob raised once the visual mockup made him think about what Coach should actually DO when someone reports movement, rather than just how the pipeline should be drawn.

## Pre-flight discovery (scope correction)

Verified against `main` at HEAD (post PR #728):

- **Three capture mechanisms already exist and already work**, each via the same one-tap contract (model ends its reply with a hidden trailer, server turns it into a response header, client shows exactly what will be saved, the person taps, the tap is the only thing that writes): stage movement (`STAGE_MENTION_RE` / `PURSUIT_STAGE_QUICK_REPLIES`, `src/App.jsx:4736-4744,4768-4769`), a scheduled meeting date (`PIPELINE_CAPTURE_NOTE`, `api/coach.js:102`, client handling `src/components/Chat.jsx:601-627`), and a named interviewer with role (`INTERVIEW_TEAM_CAPTURE_NOTE`, `api/coach.js:80`). None of this brief's value is in inventing new plumbing — it's in making Coach use what already exists more actively and more carefully.
- **Coach already has full visibility into the existing interview team roster for an opportunity** — confirmed at `api/coach.js:363-374`: every turn, for every open opportunity, Coach's context includes `interview team they have already told you about:` followed by each person's name, title, role, and the note the person wrote about them. This was verified directly after an initial (incorrect) claim that this data wasn't visible to Coach — it is. The actual gap is narrower: `INTERVIEW_TEAM_CAPTURE_NOTE` (`api/coach.js:80`) never instructs Coach to check that already-visible roster before offering to add someone, so nothing today stops it from re-offering a person already logged.
- **Today's `INTERVIEW_TEAM_CAPTURE_NOTE` explicitly instructs the opposite of what this brief wants** for a missing role: "If they did not say how the person fits, omit role" — a deliberate stay-passive instruction. This brief reverses that specific clause to an active ask, which is a real, considered behavior change, not a bug fix.
- **The missing piece can be either the name or the role, not always the role.** "Sarah Johnson, she's the hiring manager" gives both; "the VP of Engineering, but I didn't get his name" gives a role/title with no name at all. A capture record has nothing to file under without a name, so the two cases genuinely differ: name-known/role-missing can capture immediately and ask for role as a follow-up (per the open decision below); role-known/name-missing has to ask for the name first and cannot emit a capture line yet.
- **The "what would help us prep" note has a real, precedented, but currently missing write path.** The interview-team data model and UI already fully support a per-person note (`learned_note`, `src/App.jsx:15018` — "This is what most shapes this person's Interview Prep"), and one write path already threads a captured note through correctly: the connector-suggestion flow at `src/App.jsx:9942` sets `learned_note:sug.notes||''`. But the chat-capture write path — the one this brief's proactive flow uses — hardcodes it empty regardless of input: `src/App.jsx:7573`, `...learned_note:''`. So asking Coach to ask for this is not just a prompt change; `INTERVIEW_TEAM_CAPTURE_NOTE`'s JSON schema needs a new optional `note` key, and `src/App.jsx:7573` needs the same one-line fix already proven at line 9942 — thread the captured note through instead of hardcoding empty.
- **Coach's replies today are reactive, not proactive, across all three mechanisms.** Each one only fires if the person happens to mention that specific fact unprompted. There is no existing instruction telling Coach to treat a stage-move mention as an opening to also ask for the date and who's involved in the same breath.
- **No proactive "has anything moved?" opener exists today** on the My Pipeline screen or anywhere else. The closest existing pattern is `searchIntakeOpener` (`src/App.jsx:4731`) and the returning-session recap (`sessionOpenNote`, `api/coach.js:726-738`) — both are the right model to follow (a scripted, capped, Coach-initiated chat message), but neither does this job.
- **No dependency on the not-yet-built stage-vocabulary work** (Phone Screen / Interviewing / Final Round, agreed but not yet implemented). "Interviewing" is already a valid stage in today's flat `PURSUIT_STAGES` list, so this brief's example (moving to Interviewing, naming the hiring manager) works against the current vocabulary and does not need to wait on that other brief.
- **No dependency on the new pipeline visual either** (still a design mockup only, not built into the app). This brief attaches the proactive opener to the existing "My Pipeline" screen (`case 'pipeline'` — Code should re-confirm the exact step id at implementation time), so it ships independently and will simply carry over once the redesigned visual replaces that screen's rendering.

## Decisions (settled by Bob, 2026-09-05)

1. **How often does the proactive "has anything moved?" opener fire?** Once per login session — same restraint used everywhere else Coach checks in proactively (the employment prompt, the search-intake opener).
2. **Does identifying the interviewer, filling in whichever of name/role is missing, and asking what would help shape prep all happen as one natural exchange, without blocking the one-tap add?** Yes. When a name is already in hand (with or without role), the capture line for the name fires immediately — a one-tap add is never held up waiting on anything else — and Coach asks for whichever of role or "anything else that would help us prep" is still missing, in the same natural reply. When only a role/title is known with no name yet, Coach asks for the name first, since there is nothing to file a record under otherwise.

## Files affected

| File | Change |
|---|---|
| `api/coach.js` | `INTERVIEW_TEAM_CAPTURE_NOTE`: add the existing-roster check before offering to add someone; branch the missing-detail ask on whether it's the name or the role/title that's missing (ask for the name first if that's what's absent; otherwise capture the name immediately and ask for role and/or prep-relevant detail in the same reply); add a new optional `note` key to the capture JSON so a "what would help us prep" answer has somewhere to go. New "STAGE MOVE FOLLOW-THROUGH" guidance tying stage-move, date, and interviewer capture into one natural conversation. New proactive "has anything moved" instruction for the pipeline check-in opener. |
| `src/App.jsx` | New proactive opener (mirrors `searchIntakeOpener`/`employmentPromptMessage`), fired once per session on arrival at My Pipeline, capped the same way its siblings are. Fix at `src/App.jsx:7573`: thread the captured interviewer note through as `learned_note` instead of hardcoding it empty, matching the working precedent at `src/App.jsx:9942`. |
| `scripts/test-coach-pipeline-checkin.mjs` | New source-level regression test |

## Specific changes

**1. `api/coach.js` — `INTERVIEW_TEAM_CAPTURE_NOTE` (`api/coach.js:80`).** Add, before the existing "Only emit it when they clearly named interviewers" sentence:

> Before offering to add anyone, check the interview team roster already shown to you above for this opportunity. If the name they just gave matches someone already listed, do not re-offer to add them — acknowledge that you already have them logged instead, and only emit the capture line if there is something genuinely new to add (a role you did not have, a detail they just shared). If the person is new to the roster, offer to add them as usual.

Replace the existing "If they did not say how the person fits, omit role" clause with instructions that branch on which detail is actually missing, rather than always assuming it's the role:

> A name is what a capture record needs to exist at all. If they gave you a role or title but no name yet — "the VP of Engineering, but I didn't get his name" — do not emit a capture line; ask for the name first, naturally, before there is anything to offer to add.
>
> If you have a name — with or without a role — emit the capture line for that name right away; a one-tap add should never wait on anything else. Then, in the same reply, ask like a person would (never a checklist, never a form) for whatever is still missing: their role if you don't have it, and always something like "anything else you've picked up about them that would help me prep you for this one?" — since that detail is what actually shapes the interview prep this person gets. If they already gave you both in the same breath, don't ask again for what you already have.

And extend the capture JSON schema itself with a new optional `note` key so an answer to that prep question has somewhere to land:

> `{"opportunity":"...","people":[{"name":"...","title":"...","role":"hiring_manager|skip_level|peer|cross_functional|recruiter_screen","note":"..."}]}` — `note` is optional and only present when they told you something substantive about the person (how they found them, a shared connection, a detail about their style or focus); never invent one to fill the field.

**2. `api/coach.js` — new "STAGE MOVE FOLLOW-THROUGH" guidance**, placed near the existing pursuit-stage / pipeline capture instructions. Sketch (Code to place and word precisely, matching the file's established voice — exemplar, not script, per the file's own convention throughout):

> When someone reports that something moved on one of their opportunities — a new stage, an interview, an offer — treat it as an opening to learn more, not just a fact to log. Naturally ask what you don't already have: when the next conversation is, and who they are meeting with, if either is missing. Ask like a person would, not a checklist — skip anything they already told you in the same breath, and never ask for something you can already see in their saved work.

**3. `src/App.jsx` — new proactive opener.** Following the exact shape of `searchIntakeOpener` (`src/App.jsx:4731`): a Coach-initiated chat message fired once per login session on first arrival at the My Pipeline screen (mirroring the once-per-session cap `sessionOpenNote` already uses via `sessionStorage`, not the once-ever caps used for one-time value captures), asking whether anything has moved since they last checked. Exact copy and trigger wiring left to implementation, following the established pattern precisely.

**4. `src/App.jsx:7573` — thread the captured note through instead of hardcoding it empty.** Inside `handleEmploymentQuickReply`'s `checkinKey==='interview-team'` branch, change:

```
...learned_note:''
```

to the same pattern already proven correct at `src/App.jsx:9942` (the connector-suggestion flow):

```
...learned_note:String(pe.note||'')
```

(matching whatever the parsed capture-JSON field is actually named in the parsed object at that call site — `pe` here stands in for however that branch currently names each parsed person; Code should use the existing local name, not introduce a new one). Without this fix, the new `note` field added to the capture schema in change 1 would parse correctly, display correctly in Coach's confirmation, and then silently vanish on save — the exact kind of gap this brief exists to close, not repeat.

## Voice rules on inserted text

All new prose is Coach speaking to the user — run it through the same voice-rule stack as every other instruction in this file (no AI-coaching register, no logic-flip cadence, vary the wording rather than reciting a script). The proactive opener specifically must not read as a form question; match the register of `searchIntakeOpener`'s existing line.

## Static gates

- `npm run build` clean (full prebuild chain, tests, lint, vite build)
- `check-voice`: 0/0
- `check-sys-equality`, `check-prompt-refs`: re-verify unaffected
- `src/App.jsx` EOF integrity preserved before and after
- Diff scope limited to the files named above

## Runtime gate (post-merge, optional)

Bob (or Cowork-Claude) can verify in production: log in fresh, visit My Pipeline, confirm Coach asks once whether anything's moved (and doesn't ask again on a second visit the same session); reply naming a stage move, a date, and an interviewer already on the team, and confirm Coach doesn't re-offer to add that person; repeat with a genuinely new interviewer named with no role given, and confirm Coach captures the name immediately, asks for the role and for anything that would help with prep in the same reply, and — once answered — that the note actually shows up on that person's card (`learned_note`), not just in the chat transcript; separately, name only a role/title with no name yet and confirm Coach asks for the name before offering anything to add.

## Constraints

Single PR. No effort estimates. PR title: "Let Coach ask what it doesn't know when something moves on your pipeline."

## Out of scope

The new stage vocabulary (Phone Screen / Interviewing / Final Round) and the redesigned pipeline visual are both separate, already-sequenced pieces of work — not touched here. The one-tap contract itself (model emits a trailer, server headers it, client shows exactly what will save, the tap is the only write) is unchanged — this brief only extends what `INTERVIEW_TEAM_CAPTURE_NOTE`'s JSON carries (the new `note` key) and fixes one write path that was silently dropping a field the UI already supports, rather than inventing new plumbing.

## Commit message

```
Let Coach check the roster, ask what it doesn't know, and keep the prep note

Coach already sees a person's full interview-team roster every turn but
never used it before offering to add someone again. INTERVIEW_TEAM_CAPTURE_NOTE
now checks first, and asks for whichever of name/role/prep-context is
actually missing instead of silently omitting role. A new optional `note`
key on the capture JSON carries a "what would help us prep" answer through
to the person's card (learned_note) -- a write path that already existed
for connector suggestions but was hardcoded empty for chat capture. A new
once-per-session opener on My Pipeline invites the person to say what's
moved, rather than waiting for them to bring it up unprompted.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Qbsj3ds9Cfozte1ASdRrDx
```

## Push

Branch off current `main`, PR, CI, squash-merge per section 9. Vercel auto-deploys from `main` on merge.

## Implementer's checklist

1. Pull `main`, confirm HEAD, re-grep the anchors above for drift.
2. Apply the `INTERVIEW_TEAM_CAPTURE_NOTE` roster-check, name/role branching, and `note` schema key to `api/coach.js`.
3. Apply the new "STAGE MOVE FOLLOW-THROUGH" guidance to `api/coach.js`.
4. Add the new proactive opener to `src/App.jsx`, matching `searchIntakeOpener`'s exact wiring pattern.
5. Fix `src/App.jsx:7573` to thread `learned_note` through, matching the precedent at `src/App.jsx:9942`.
6. Add the new test file.
7. Run `npm run build` (full gate chain); confirm clean.
8. Verify `App.jsx` EOF (line count + closing tag) before and after.
9. Commit, push, open PR, subscribe to activity, watch CI, squash-merge.
10. Report PR URL and merge SHA.
