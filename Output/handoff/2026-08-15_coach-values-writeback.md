# Coach values capture — one-tap save to Values, Passions & Causes

## Prompt for Code

Apply the changes in this brief. It adds a fourth Coach capture offer alongside the three that already ship (employment status, pursuit stage, interview team): when a Coach conversation settles what someone wants in their Values and Passions & Causes fields, Coach offers to save it and one tap writes it. Premise-verify every anchor below before editing — this brief was written against `origin/main` at `164b356` and the file is large and moves. Run the full static gate chain, update the user guide in the same PR, and follow the gh flow in CLAUDE.md §9. Report the PR URL and merge SHA.

---

**Date:** 2026-08-15
**Type:** Feature — Coach capture (fourth in the family)
**Source:** My Coach question insights, 7-day window Aug 9–15 2026. The values/passions thread on Aug 15 (11 turns, 12:56 PM – 2:06 PM) ends with the user asking *"Do I need to go back and put them in the fields? Can you summarize so I can cut and paste?"* The same seeded prompt opened a second dead-ending conversation on Aug 13. Four threads in the window end with the user hand-carrying Coach output back into the product.

---

## Pre-flight discovery (scope correction)

Verified against `origin/main` at `164b356`:

**The mechanism already exists and is one day old.** PR #423 (`853c08b`, Aug 15) shipped the exact pattern this brief reuses: the model emits a silent trailer, `api/coach.js` strips it and ships the payload base64 on a response header, `Chat.jsx` reads the header and renders a quick-reply offer, `App.jsx` writes through the normal path on tap. 53 lines across 3 files. This brief is a fourth instance of an established family, not new architecture.

**Three capture offers already ship.** `employmentCaptureActive` (#391), `pursuitCaptureActive` (#407), `interviewTeamCaptureActive` (#423). All three route their tap through `handleEmploymentQuickReply(checkinKey, value)` at `src/App.jsx:5082`. This brief adds a fourth branch there.

**The seeded prompt that generates this traffic already exists.** `ASK_COACH_ORIENT.values` (`src/App.jsx:5146`) is rendered on the Values screen by `coachNudge(ASK_COACH_ORIENT.values, 'Not sure what to put here? Ask your coach')` at `src/App.jsx:8929`. The product opens this loop and currently has no way to close it.

**Field keys confirmed.** `profile.values` and `profile.passions`, written by `pr('values', …)` / `pr('passions', …)` at `src/App.jsx:8924-8925`. The Coach already reads both — `api/coach.js:89-90` prints them as `VALUES:` and `PASSIONS AND CAUSES:` in ANCHOR 1, so the model can see current state and does not need it re-supplied.

**Two hazards found, both handled below.**

1. **`pr()` will not fire the Personal Brand staleness cascade from a Coach tap.** `const pr=(f,v)=>{setProfile(p=>({...p,[f]:v}));markInputEdited()}` (`src/App.jsx:5474`), and `markInputEdited` (`5473`) is gated on `INPUT_EDIT_STEPS.has(step)` — the step the user is *currently on*. A tap from the floating bubble happens on whatever step they are on (`myCoach`, `twoDoors`, a playbook), so `INPUT_EDIT_STEPS.has(step)` is false and `pbNeedsUpdate` never sets. Values feed Personal Brand; without this, a Coach-written value silently desyncs from the brand it should invalidate. Change 5 handles it.

2. **No server-side blob write.** PR #422 put interviewers in their own table specifically to leave the shared `profile_state` blob untouched. Values and passions live *in* that blob, which the client autosaves — the same clobber hazard that pushed employment status into its own column (PR #391). This brief therefore keeps the write **client-side through `pr()`**, exactly as the interview-team tap writes through the normal panel path. The server never writes the blob. No migration, no new table, no new endpoint.

**Deliberately ungated.** The three existing captures are gated (`hasMySearch` for two, `!employmentStatus` for one). This one ships to all signed-in non-demo users: Values and Passions are core Orientation fields every user has, and the dead-end is hitting general users, not pilot users. Consequence, stated so it is a decision and not an oversight: this is the first Coach capture in the cached-for-everyone path, so the user guide must document it (CLAUDE.md §8) — Change 7.

**`FEATURE_MAP` / `COACH_NAV_MAP` untouched.** Capture behaviors are not destinations and carry no self-check slug; #423 set this precedent. `scripts/check-coach-nav-map.mjs` should pass unchanged. Coach still emits `SELFCHECK: none` on these turns unless a feature genuinely fits independently.

---

## Files affected

| File | Change |
|---|---|
| `api/coach.js` | Static capture instruction appended to the uncached per-user profile block; `VALUESCAPTURE:` trailer stripped from the reply and shipped on `X-Coach-Values` |
| `src/components/Chat.jsx` | New `valuesCaptureActive` prop; reads `X-Coach-Values`; renders the offer |
| `src/App.jsx` | `values-capture` branch in `handleEmploymentQuickReply`; prop passed on both Chat mounts |
| `src/data/user-guide/04-orientation-phase.md` | Documents the one-tap save on the Values screen |

---

## Specific changes

### 1. `api/coach.js` — the capture instruction (module scope)

Insert immediately **before** `function buildCoachProfileSlice(state, employmentStatus, featureFlags) {` (currently `api/coach.js:59`):

```js
// Values capture (brief 2026-08-15). The in-conversation counterpart to the
// Values, Passions & Causes screen: when a conversation settles what the person
// wants in those fields, the model emits a silent trailer and the client offers a
// one-tap save. Static text, appended to the UNCACHED per-user block rather than
// SYSTEM_PROMPT_STABLE — the stable prefix tells the coach it is "Read-only
// throughout", and this is the narrow, explicit exception to that, exactly as the
// interview-team trailer is. The model already sees current VALUES / PASSIONS AND
// CAUSES in ANCHOR 1, so it knows whether it is filling a blank or replacing.
const VALUES_CAPTURE_NOTE = '\n\nVALUES CAPTURE: this person\'s Values and Passions & Causes live on a screen in Reimagine called "Values, Passions & Causes", and you can offer to write them there. When a conversation has settled into a statement of their values or their passions and causes that they seem happy with — their words and their conclusions, not a list you proposed and they have not responded to — end your reply with a final line exactly like VALUESCAPTURE: {"values":"Independence; Creative problem solving; Belonging","passions":"Youth mentoring; Faith-based service"} carrying whichever of the two you have. Include a key ONLY for a field the conversation actually settled; omit the other entirely. Write each as a short semicolon-separated list in their own words, not a paragraph and not your paraphrase. If ANCHOR 1 shows a field already has content, only emit it when they have clearly landed somewhere new — the tap replaces what is there. The app turns that line into a one-tap save offer and never shows it, so do not mention the line, and do not tell them to copy anything or type it in themselves. Emit it at most once per reply, and only on a turn that genuinely settled something; otherwise omit it entirely.'
```

### 2. `api/coach.js` — append the note to both returns of `buildCoachProfileSlice`

**2a.** The no-profile early return currently ends (`api/coach.js:65`):

```js
Never describe any of them as somewhere they can go right now, and never walk them through clicking to it.`
```

Append the note to that returned template literal so it becomes:

```js
Never describe any of them as somewhere they can go right now, and never walk them through clicking to it.${VALUES_CAPTURE_NOTE}`
```

**2b.** The main return (`api/coach.js:204`) currently reads:

```js
  return `THIS USER'S REIMAGINE PROFILE (read-only; you can reference and reason about it, but you never change it):\n\n${anchor1}\n\n${anchor2}\n\n${indexBlock}${offerBlock}${sparseNote}${preBrandNote}${myStatusNote}`
```

Two edits on this line. Qualify the read-only preamble so it no longer contradicts the capture instruction, and append the note:

```js
  return `THIS USER'S REIMAGINE PROFILE (you can reference and reason about it; you never change it yourself — the only writes are the one-tap offers described at the end of this block, which the person accepts or declines):\n\n${anchor1}\n\n${anchor2}\n\n${indexBlock}${offerBlock}${sparseNote}${preBrandNote}${myStatusNote}${VALUES_CAPTURE_NOTE}`
```

`VALUES_CAPTURE_NOTE` goes **last**, after `myStatusNote`, so the two trailer instructions (`INTERVIEWTEAM:` and `VALUESCAPTURE:`) sit adjacent and read as one family.

### 3. `api/coach.js` — strip the trailer, ship the header

Immediately **after** the interview-team strip block (which ends at `api/coach.js:665` with `  }` closing `if (itMatch) {`) and **before** the comment `  // Distress safety-net:`, insert:

```js
  // Values capture: the model may end with a VALUESCAPTURE: {json} line carrying
  // what the conversation settled for Values and/or Passions & Causes. Strip it
  // and ship it on a response header; the client offers a one-tap save that
  // writes through the same setter the screen's own textareas use.
  let valuesB64 = null
  const vcMatch = strippedText.match(/^\s*VALUESCAPTURE:\s*(\{[\s\S]*?\})\s*$/im)
  if (vcMatch) {
    strippedText = strippedText.replace(vcMatch[0], '').trim()
    try {
      const parsed = JSON.parse(vcMatch[1])
      const clean = v => (typeof v === 'string' ? v.trim().slice(0, 600) : '')
      const payload = {}
      if (clean(parsed && parsed.values)) payload.values = clean(parsed.values)
      if (clean(parsed && parsed.passions)) payload.passions = clean(parsed.passions)
      if (payload.values || payload.passions) {
        valuesB64 = Buffer.from(JSON.stringify(payload)).toString('base64')
      }
    } catch { /* malformed — drop the line, no offer */ }
  }
```

Note for Code: this matches against `strippedText` (not `strippedText0`) and reassigns it, so the two trailers compose when the model emits both. `strippedText` is already declared with `let` at `api/coach.js:651` — do **not** redeclare it.

Then, alongside the existing header write at `api/coach.js:689`:

```js
  if (interviewersB64) res.setHeader('X-Coach-Interviewers', interviewersB64)
```

add on the following line:

```js
  if (valuesB64) res.setHeader('X-Coach-Values', valuesB64)
```

### 4. `src/components/Chat.jsx` — prop, header read, offer

**4a.** The props signature (`src/components/Chat.jsx:31`) currently ends:

```js
pursuitCaptureActive = false, pursuitOfferMessage = null, interviewTeamCaptureActive = false }) {
```

becomes:

```js
pursuitCaptureActive = false, pursuitOfferMessage = null, interviewTeamCaptureActive = false, valuesCaptureActive = false }) {
```

**4b.** After the header read at `src/components/Chat.jsx:186`:

```js
        const itHeader = res.headers.get('X-Coach-Interviewers') || null
```

add:

```js
        const vcHeader = res.headers.get('X-Coach-Values') || null
```

**4c.** After the interview-team offer block (closes at `src/components/Chat.jsx:234` with `        }`), insert:

```js
        // Values capture: the server extracted what this turn settled for Values
        // and/or Passions & Causes onto X-Coach-Values. Show it back in full — the
        // person accepts the exact text they are about to store, never a summary
        // of it — and offer a one-tap save.
        if (valuesCaptureActive && vcHeader) {
          try {
            const data = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(vcHeader), c => c.charCodeAt(0))))
            const parts = []
            if (data && data.values) parts.push(`Core Values: ${data.values}`)
            if (data && data.passions) parts.push(`Passions, Interests & Causes: ${data.passions}`)
            if (parts.length) {
              setMessages(m => [...m, { role: 'assistant', content: `Want me to save this to your Values, Passions & Causes screen? It replaces whatever is in the ${parts.length > 1 ? 'fields' : 'field'} now, and you can edit it there any time.\n\n${parts.join('\n\n')}`, checkinKey: 'values-capture', quickReplies: [{ label: 'Save it', value: JSON.stringify(data), followUp: 'Saved to your Values, Passions & Causes.' }, { label: 'Not now', value: 'dismiss' }] }])
            }
          } catch { /* malformed header — no offer */ }
        }
```

### 5. `src/App.jsx` — the write branch

In `handleEmploymentQuickReply` (`src/App.jsx:5082`), add a branch alongside the existing `employment-status` and `pursuit-stage` branches:

```js
    // Values capture (brief 2026-08-15). Writes through pr() — the same setter the
    // Values screen's own textareas use — so autosave carries it and nothing races
    // a server-side blob write. pr() calls markInputEdited(), but that is gated on
    // INPUT_EDIT_STEPS.has(step) and this tap fires from whatever step the person
    // is on (usually myCoach or the bubble), so the Personal Brand staleness flag
    // would never set. Values feed Personal Brand, so set it directly here.
    if(checkinKey==='values-capture'){
      if(value==='dismiss')return true
      let d=null
      try{d=JSON.parse(value)}catch{return true}
      if(!d||(!d.values&&!d.passions))return true
      if(d.values)pr('values',d.values)
      if(d.passions)pr('passions',d.passions)
      if(!isDemo&&outputs.p3&&!pbNeedsUpdate)setPbNeedsUpdate(true)
      return true
    }
```

Code: confirm the branch order and the handler's return convention against the two branches already there (`5083` and `5086`) and match them; the `return true` shape above assumes the existing convention and must be adjusted if it differs.

### 6. `src/App.jsx` — pass the prop on both Chat mounts

Both mounts currently end with `interviewTeamCaptureActive={hasMySearch}/>`:

- the embedded panel on the `myCoach` step (`src/App.jsx:9516`)
- the floating bubble (`src/App.jsx:10737`)

On each, add `valuesCaptureActive={!isDemo}` immediately after `interviewTeamCaptureActive={hasMySearch}`. Demo mode is excluded deliberately: `demoProfile` is shared fixture data and must not be written.

### 7. `src/data/user-guide/04-orientation-phase.md` — document it

CLAUDE.md §8: this is a user-facing capability shipping ungated, so the guide updates in this PR. Add to the Values, Passions & Causes section:

> If you are not sure what belongs here, ask your coach — there is a prompt on the screen that opens the conversation. Once the two of you land on something, your coach offers to save it straight into these fields. You tap once, and you can edit it here afterwards like anything else you typed.

Code: locate the Values, Passions & Causes section in that chapter and place this after the existing field guidance. If a My Coach chapter exists in `src/data/user-guide/` and describes what the coach can and cannot do, add a matching sentence there; if the chapter states the coach never changes anything, that line is now wrong and must be corrected in this PR.

---

## Voice rules on inserted text

Two user-facing strings ship here (the offer in Change 4c, the guide text in Change 7). Both checked against CLAUDE.md §3:

- No logic-flip cadence, no comparative standing, no AI-coaching register, no meta-narration, no sincerity qualifiers, no typology labels, no slogan closers, no "rooms."
- Positive framing: the offer describes a gain ("save this," "edit it there any time"), never the user's current state as deficient.
- Plain language: "Save it," "Not now" — the same register as the three existing capture offers.
- Honesty: the offer states plainly that it replaces existing content, before the tap, not after. Field names are render-true against `src/App.jsx:8924-8925` ("Core Values", "Passions, Interests & Causes") and the screen title is render-true against `8918`.

The strings in Changes 1–3 are model instructions, not user-facing, and are out of the voice gate's scope.

---

## Static gates

- `npm run build` clean.
- `npm run check-voice` — 0/0. No new voice-allow region.
- `check-prompt-refs` — 0.
- `check-coach-nav-map` — passes **unchanged**; this brief touches neither `FEATURE_MAP` nor `NAV_LABELS`. If it reports stale, something was edited out of scope.
- `check-fontsize` — baseline held. No new `fontSize:` values; the offer renders through the existing quick-reply component.
- `src/App.jsx` EOF integrity: record the line count before and after, and confirm the final closing tag/brace is intact.
- Diff scope limited to the four files in the table.
- **Preview smoke test required** — this touches `api/coach.js`. Per CLAUDE.md §8, run `npm run smoke:preview -- <preview-url>` before merge; both `/api/health` and `/api/claude` must return non-5xx.

---

## Runtime gate (post-merge)

On production, signed in as a real account:

1. Open My Coach and work through values conversationally until you settle on three or four. Confirm the save offer appears, that the text shown matches what you said, and that no `VALUESCAPTURE:` line is visible anywhere in the reply.
2. Tap **Save it**. Go to Values, Passions & Causes and confirm both fields hold exactly the offered text.
3. With a generated Personal Brand already in place, confirm the "your Personal Brand may need updating" nudge appears after the save — this is hazard 1 from pre-flight and the reason for the explicit `setPbNeedsUpdate` in Change 5.
4. Tap **Not now** on a later offer and confirm nothing is written.
5. Confirm an ordinary Coach turn that settles nothing produces no offer.

---

## Constraints

- Single PR.
- No effort estimates anywhere in the PR description.
- PR title: `Coach values capture: save what the conversation settled, one tap`

---

## Out of scope

- Any other field. Reputation, Life-Shaping Experiences, and the resume are the obvious next candidates and are deliberately excluded — ship one field pair, watch it, then extend.
- Server-side writes to `profile_state`. The write stays client-side through `pr()`.
- Undo or version history for the replaced text.
- Any `FEATURE_MAP` / `COACH_NAV_MAP` change.
- The `reach: 'standalone'` nesting inaccuracy for Career Paths / Add an Opportunity / Income Now, and the phase-header click affordance. Both are real and both are separate briefs.

---

## Commit message

```
Coach values capture: save what the conversation settled, one tap (#XXX)

The in-conversation counterpart to the Values, Passions & Causes screen. When a
Coach conversation lands on someone's values or passions, Coach offers to write
them into the fields; one tap saves. Closes the loop the screen's own "Ask your
coach" prompt already opens — until now that conversation ended with the person
copying the answer back in by hand.

- coach.js: static VALUES CAPTURE instruction in the uncached per-user block
  (the stable prefix says "read-only throughout"; this is the narrow exception,
  same as the interview-team trailer). Model emits a silent VALUESCAPTURE:{json}
  trailer; the server strips it and ships it on X-Coach-Values. Read-only
  preamble qualified so it no longer contradicts the capture offers.
- Chat.jsx: reads the header, shows the exact text back, offers Save it /
  Not now.
- App.jsx: the tap writes through pr() — the same setter the screen's textareas
  use, so autosave carries it and no server write races the blob. Sets
  pbNeedsUpdate directly: markInputEdited() is gated on the current step and
  this tap fires from anywhere, so the Personal Brand staleness cascade would
  otherwise be skipped.
- User guide: Values chapter documents the one-tap save.

Ungated (all signed-in non-demo users). Fourth capture in the family after
employment status, pursuit stage, and interview team. Build clean, voice 0/0,
coach-nav-map untouched, fontsize baseline held.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

---

## Push

Direct to `main` via the gh flow (CLAUDE.md §9). Vercel auto-deploys.

---

## Implementer's checklist

1. `git fetch origin` and confirm you are on current `origin/main`. This brief was written against `164b356`; if main has moved, re-verify every anchor before editing.
2. Premise-verify, substance-grep not just block-existence:
   - `VALUESCAPTURE` and `X-Coach-Values` appear nowhere yet.
   - `interviewTeamCaptureActive` appears in exactly three places in `src/App.jsx` + `src/components/Chat.jsx` (the prop signature and the two mounts) — if a fourth has appeared, a concurrent change landed and the mount list needs re-deriving.
   - `pr` is still `(f,v)=>{setProfile(p=>({...p,[f]:v}));markInputEdited()}` and `markInputEdited` is still step-gated. **If `markInputEdited` is no longer step-gated, drop the explicit `setPbNeedsUpdate` from Change 5** — it would be redundant.
   - `strippedText` is still declared `let` at the interview-team block.
   - If any premise fails, STOP and surface back rather than proceeding on assumed state.
3. Check for uncommitted work in the tree from a concurrent session before you branch; stash-isolate if present, do not bundle it.
4. Apply Changes 1–7.
5. Run the full static gate chain. Record `src/App.jsx` line count before and after.
6. Run the preview smoke test against the Vercel preview URL.
7. Update the changelog (Chapter 11, `Output/docs/reimagine-system-documentation/`).
8. Open the PR with `gh pr create --body-file`, watch `gh pr checks --watch` to green, merge with `--squash`.
9. Report the PR URL and the merge commit SHA, plus anything premise verification corrected.
