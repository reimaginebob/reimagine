## Prompt for Code

Apply the changes in this brief to `api/coach.js` (and the small client-side proactive opener in `src/App.jsx`/`src/components/Chat.jsx`), premise-verify the anchors below against current `main`, run the static gates, add source-level regression tests following the pattern of their siblings, then follow the gh flow in section 9 of CLAUDE.md: push, open the PR, watch CI, squash-merge once green, and report the PR URL and merge SHA. Two open decisions are flagged below — read those first.

---

## Date / Type / Source

2026-09-05. Implementation brief, arising directly from a live design conversation with Bob about the pipeline visualization work. Not part of the earlier best-practices audit — a new idea Bob raised once the visual mockup made him think about what Coach should actually DO when someone reports movement, rather than just how the pipeline should be drawn.

## Pre-flight discovery (scope correction)

Verified against `main` at HEAD (post PR #727):

- **Three capture mechanisms already exist and already work**, each via the same one-tap contract (model ends its reply with a hidden trailer, server turns it into a response header, client shows exactly what will be saved, the person taps, the tap is the only thing that writes): stage movement (`STAGE_MENTION_RE` / `PURSUIT_STAGE_QUICK_REPLIES`, `src/App.jsx:4736-4744,4768-4769`), a scheduled meeting date (`PIPELINE_CAPTURE_NOTE`, `api/coach.js:102`, client handling `src/components/Chat.jsx:601-627`), and a named interviewer with role (`INTERVIEW_TEAM_CAPTURE_NOTE`, `api/coach.js:80`). None of this brief's value is in inventing new plumbing — it's in making Coach use what already exists more actively and more carefully.
- **Coach already has full visibility into the existing interview team roster for an opportunity** — confirmed at `api/coach.js:363-374`: every turn, for every open opportunity, Coach's context includes `interview team they have already told you about:` followed by each person's name, title, role, and the note the person wrote about them. This was verified directly after an initial (incorrect) claim that this data wasn't visible to Coach — it is. The actual gap is narrower: `INTERVIEW_TEAM_CAPTURE_NOTE` (`api/coach.js:80`) never instructs Coach to check that already-visible roster before offering to add someone, so nothing today stops it from re-offering a person already logged.
- **Today's `INTERVIEW_TEAM_CAPTURE_NOTE` explicitly instructs the opposite of what this brief wants** for a missing role: "If they did not say how the person fits, omit role" — a deliberate stay-passive instruction. This brief reverses that specific clause to an active ask, which is a real, considered behavior change, not a bug fix.
- **Coach's replies today are reactive, not proactive, across all three mechanisms.** Each one only fires if the person happens to mention that specific fact unprompted. There is no existing instruction telling Coach to treat a stage-move mention as an opening to also ask for the date and who's involved in the same breath.
- **No proactive "has anything moved?" opener exists today** on the My Pipeline screen or anywhere else. The closest existing pattern is `searchIntakeOpener` (`src/App.jsx:4731`) and the returning-session recap (`sessionOpenNote`, `api/coach.js:726-738`) — both are the right model to follow (a scripted, capped, Coach-initiated chat message), but neither does this job.
- **No dependency on the not-yet-built stage-vocabulary work** (Phone Screen / Interviewing / Final Round, agreed but not yet implemented). "Interviewing" is already a valid stage in today's flat `PURSUIT_STAGES` list, so this brief's example (moving to Interviewing, naming the hiring manager) works against the current vocabulary and does not need to wait on that other brief.
- **No dependency on the new pipeline visual either** (still a design mockup only, not built into the app). This brief attaches the proactive opener to the existing "My Pipeline" screen (`case 'pipeline'` — Code should re-confirm the exact step id at implementation time), so it ships independently and will simply carry over once the redesigned visual replaces that screen's rendering.

## Open decisions for Bob

1. **How often does the proactive "has anything moved?" opener fire?** Every visit to My Pipeline would wear out fast. This brief assumes the same restraint used everywhere else Coach checks in proactively (the employment prompt, the search-intake opener): once per login session, not every time the screen renders. Confirm, or say how you'd rather bound it.
2. **Does the one-tap "add to your Interview Team" offer wait for the role, or fire immediately and let role arrive as a follow-up?** This brief's default: offer the name immediately (so a person can be added in one tap even if role is still unknown), and have Coach ask for the role in the same reply's prose so a natural answer can enrich the same record afterward — rather than holding up the whole offer until role is known. Confirm this is the right trade, since it means the first tap can add someone with no role, filled in a beat later.

## Files affected

| File | Change |
|---|---|
| `api/coach.js` | `INTERVIEW_TEAM_CAPTURE_NOTE`: add the existing-roster check before offering to add someone, and reverse the omit-role instruction to an active ask. New "STAGE MOVE FOLLOW-THROUGH" guidance tying stage-move, date, and interviewer capture into one natural conversation. New proactive "has anything moved" instruction for the pipeline check-in opener. |
| `src/App.jsx` | New proactive opener (mirrors `searchIntakeOpener`/`employmentPromptMessage`), fired once per session on arrival at My Pipeline, capped the same way its siblings are. |
| `scripts/test-coach-pipeline-checkin.mjs` | New source-level regression test |

## Specific changes

**1. `api/coach.js` — `INTERVIEW_TEAM_CAPTURE_NOTE` (`api/coach.js:80`).** Add, before the existing "Only emit it when they clearly named interviewers" sentence:

> Before offering to add anyone, check the interview team roster already shown to you above for this opportunity. If the name they just gave matches someone already listed, do not re-offer to add them — acknowledge that you already have them logged instead, and only emit the capture line if there is something genuinely new to add (a role you did not have, a detail they just shared). If the person is new to the roster, offer to add them as usual.

And change the existing "If they did not say how the person fits, omit role" clause to:

> If they did not say how the person fits, ask in the same reply — a natural, varied question like "what's her role in this?" — rather than staying silent about it; still emit the capture line for the name itself so a one-tap add is not held up waiting on the answer.

**2. `api/coach.js` — new "STAGE MOVE FOLLOW-THROUGH" guidance**, placed near the existing pursuit-stage / pipeline capture instructions. Sketch (Code to place and word precisely, matching the file's established voice — exemplar, not script, per the file's own convention throughout):

> When someone reports that something moved on one of their opportunities — a new stage, an interview, an offer — treat it as an opening to learn more, not just a fact to log. Naturally ask what you don't already have: when the next conversation is, and who they are meeting with, if either is missing. Ask like a person would, not a checklist — skip anything they already told you in the same breath, and never ask for something you can already see in their saved work.

**3. `src/App.jsx` — new proactive opener.** Following the exact shape of `searchIntakeOpener` (`src/App.jsx:4731`): a Coach-initiated chat message fired once per login session on first arrival at the My Pipeline screen (mirroring the once-per-session cap `sessionOpenNote` already uses via `sessionStorage`, not the once-ever caps used for one-time value captures), asking whether anything has moved since they last checked. Exact copy and trigger wiring left to implementation, following the established pattern precisely.

## Voice rules on inserted text

All new prose is Coach speaking to the user — run it through the same voice-rule stack as every other instruction in this file (no AI-coaching register, no logic-flip cadence, vary the wording rather than reciting a script). The proactive opener specifically must not read as a form question; match the register of `searchIntakeOpener`'s existing line.

## Static gates

- `npm run build` clean (full prebuild chain, tests, lint, vite build)
- `check-voice`: 0/0
- `check-sys-equality`, `check-prompt-refs`: re-verify unaffected
- `src/App.jsx` EOF integrity preserved before and after
- Diff scope limited to the files named above

## Runtime gate (post-merge, optional)

Bob (or Cowork-Claude) can verify in production: log in fresh, visit My Pipeline, confirm Coach asks once whether anything's moved (and doesn't ask again on a second visit the same session); reply naming a stage move, a date, and an interviewer already on the team, and confirm Coach doesn't re-offer to add that person; repeat with a genuinely new interviewer and confirm Coach asks for their role rather than silently omitting it.

## Constraints

Single PR. No effort estimates. PR title: "Let Coach ask what it doesn't know when something moves on your pipeline."

## Out of scope

The new stage vocabulary (Phone Screen / Interviewing / Final Round) and the redesigned pipeline visual are both separate, already-sequenced pieces of work — not touched here. No change to the underlying one-tap capture mechanisms themselves, only to when and how proactively they're used.

## Commit message

Not yet finalized — depends on Bob's answers to the two open decisions above.

## Push

Branch off current `main`, PR, CI, squash-merge per section 9. Vercel auto-deploys from `main` on merge.

## Implementer's checklist

1. Get Bob's answers on the two open decisions above before writing code.
2. Pull `main`, confirm HEAD, re-grep the anchors above for drift.
3. Apply the three instruction changes to `api/coach.js`.
4. Add the new proactive opener to `src/App.jsx`, matching `searchIntakeOpener`'s exact wiring pattern.
5. Add the new test file.
6. Run `npm run build` (full gate chain); confirm clean.
7. Verify `App.jsx` EOF (line count + closing tag) before and after.
8. Commit, push, open PR, subscribe to activity, watch CI, squash-merge.
9. Report PR URL and merge SHA.
