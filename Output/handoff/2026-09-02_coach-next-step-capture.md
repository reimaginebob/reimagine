# My Coach captures a next step (pilot, gated)

## Prompt for Code

Apply the changes in this brief. Premise-verify every anchor quoted below against current `main` before you touch anything — if a quoted line has drifted, STOP and surface it rather than guessing at the new shape. Run the static gates, follow the gh flow in CLAUDE.md §9, and report the PR URL and merge SHA. This ships behind a per-user flag; it must be invisible to every account that does not hold the flag.

---

## Date / Type / Source

- **Date:** 2026-09-02
- **Type:** Feature (gated pilot)
- **Source:** Product conversation with Bob, 2026-09-02. Bob's framing: *"the user says oh yeah I actually do, I'm calling Theresa on September 14. Could my coach populate next steps 'call Theresa' with the date September 14 — then they don't just have a coach, they have an assistant."*

---

## Pre-flight discovery (scope correction)

This was drafted against `main` at `1b5ae00`. What is already shipped, and therefore NOT in scope to build:

- **Speech input already exists.** `src/components/Chat.jsx:3` imports `SpeechBtn` and line 545 renders it. Nothing to add for "spoken feedback."
- **The one-tap capture pattern exists three times over.** Employment status (regex-triggered quick replies), pursuit **stage** (regex-triggered, `STAGE_MENTION_RE`), interview team and Values (model-emitted trailer → base64 response header → one-tap offer). This brief adds a fourth instance of the *fourth* pattern; it invents no mechanism.
- **The write path already exists end to end.** `pursuit_status.next_move` and `next_step_at` are live columns (`migrations/2026-08-19_pursuit-next-step.sql`). `api/pursuit-status.js` already accepts `nextMove` and `nextStepAt` on PUT, validates the date through `parseTs`, and read-merge-writes so a partial patch cannot clear a sibling field. `savePursuit(recordId, patch)` in `src/App.jsx` already maps `next_move`/`next_step_at` to those body keys. **No endpoint change and no migration are needed.**
- **The Coach already reads these fields.** `buildPursuitStatusBlock` in `api/coach.js` reports the next step and computes `OVERDUE by N days`. So today the Coach can name the gap and cannot fill it — that half-state is the actual defect this closes.
- **The stage regex would not catch Bob's example.** `STAGE_MENTION_RE` (`src/components/Chat.jsx:19`) requires stage vocabulary ("interview", "offer", "rejected"). *"I'm calling Theresa on September 14"* matches none of it, and no regex resolves "next Thursday" against today's date. This is why the capture must be model-emitted, not regex-triggered.
- **The flag plumbing is single-flag today.** `api/_lib/feature-flags.js` names exactly one flag (`CONNECTOR_BETA_FLAG = 'my_search'`) and `api/admin/pipeline-access.js` hardcodes it. A second gated pilot needs that file to hold more than one grantable flag. That is why the flag plumbing is in this brief rather than a separate one — it is a prerequisite for this change's own gate, not a bundled concern.

**Net scope:** one prompt instruction, one trailer parser, one response header, one client offer, one write branch, plus the multi-flag plumbing the gate requires.

---

## Files affected

| File | Change |
|---|---|
| `api/_lib/feature-flags.js` | Add `PIPELINE_CAPTURE_FLAG`, its predicate, and a `GRANTABLE_FLAGS` registry |
| `api/admin/pipeline-access.js` | Accept an optional `flag` from the registry; default unchanged |
| `src/AdminDashboard.jsx` | Flag selector on the tester panel; correct the stale "My Pipeline" result copy |
| `api/coach.js` | `NEXT_STEP_CAPTURE_NOTE` (flag-gated), `NEXTSTEP:` trailer parse, `X-Coach-Next-Step` header |
| `src/components/Chat.jsx` | New prop `nextStepCaptureActive`; render the one-tap offer from the header |
| `src/App.jsx` | Pass the prop at both `<Chat>` call sites; handle `checkinKey === 'pursuit-next-step'` |

---

## Specific changes

### 1. `api/_lib/feature-flags.js` — make the file hold more than one flag

Append below the existing `hasConnectorBeta` export. Do **not** alter `CONNECTOR_BETA_FLAG` or its comment block; its documented history is why this file exists.

```js
// PILOT — My Coach next-step capture, 2026-09-02. Gates one thing: whether the
// Coach is told it may propose a next step and a date for an opportunity. The
// WRITE it proposes is not gated and does not need to be — it goes through the
// same PUT /api/pursuit-status the card editor uses, and it only happens when
// the person taps. What the flag controls is whether the instruction is in the
// prompt at all, which is also why a non-flagged account cannot produce the
// trailer even by asking for it.
//
// To open this to everyone: delete this constant and its uses, add the
// FEATURE_MAP note and the user-guide text staged in the brief, and run
// `npm run gen:coach-nav-map`. Those go together — see the GA checklist.
export const PIPELINE_CAPTURE_FLAG = 'pipeline_capture'

export function hasPipelineCapture(user) {
  const flags = user && Array.isArray(user.feature_flags) ? user.feature_flags : []
  return flags.includes(PIPELINE_CAPTURE_FLAG)
}

// The flags the admin dashboard may grant and revoke by email. A flag that is
// not in here cannot be set from the dashboard at all, so a typo in the request
// body is a 400 rather than a row carrying a string nothing reads. `label` is
// what the dashboard shows; keep it the user-facing name of the surface.
export const GRANTABLE_FLAGS = {
  [CONNECTOR_BETA_FLAG]: { label: 'Assistant connector' },
  [PIPELINE_CAPTURE_FLAG]: { label: 'Coach next-step capture' },
}
```

### 2. `api/admin/pipeline-access.js` — grant any registered flag

Replace this import:

```js
import { CONNECTOR_BETA_FLAG } from '../_lib/feature-flags.js'
```

with:

```js
import { CONNECTOR_BETA_FLAG, GRANTABLE_FLAGS } from '../_lib/feature-flags.js'
```

Replace:

```js
// Named in api/_lib/feature-flags.js; the value is unchanged from the pilot,
// its meaning narrowed to the connector when My Pipeline went GA (2026-08-30).
const FLAG = CONNECTOR_BETA_FLAG
```

with:

```js
// Named in api/_lib/feature-flags.js. The default is unchanged from when this
// endpoint served one pilot, so an older caller that sends no `flag` still
// grants the connector beta and nothing about its behaviour moved.
const DEFAULT_FLAG = CONNECTOR_BETA_FLAG

// Resolve the requested flag against the registry. Anything unregistered is
// rejected rather than written: a flag value nothing reads is a silent no-op
// that looks like a successful grant, which is the worst outcome for a pilot.
function resolveFlag(raw) {
  if (raw === undefined || raw === null || raw === '') return DEFAULT_FLAG
  const f = typeof raw === 'string' ? raw.trim() : ''
  return Object.prototype.hasOwnProperty.call(GRANTABLE_FLAGS, f) ? f : null
}
```

In the `GET` branch, replace:

```js
      const rows = await sql`SELECT email FROM users WHERE ${FLAG} = ANY(feature_flags) ORDER BY lower(email)`
      return res.status(200).json({ testers: rows.map(r => r.email) })
```

with:

```js
      const flag = resolveFlag(req.query && req.query.flag)
      if (!flag) return res.status(400).json({ error: 'unknown flag' })
      const rows = await sql`SELECT email FROM users WHERE ${flag} = ANY(feature_flags) ORDER BY lower(email)`
      // `flags` lets the dashboard build its picker from the server's registry
      // rather than a copy of it that can drift.
      return res.status(200).json({ testers: rows.map(r => r.email), flag, flags: GRANTABLE_FLAGS })
```

In the `POST` branch, after the existing `action` validation, insert:

```js
    const flag = resolveFlag(body.flag)
    if (!flag) return res.status(400).json({ error: 'unknown flag' })
```

Then replace every remaining `${FLAG}` in the two UPDATE statements with `${flag}`, and replace the log line:

```js
    console.log('admin/pipeline-access', { email, action, enabled: rows[0].enabled })
```

with:

```js
    console.log('admin/pipeline-access', { email, action, flag, enabled: rows[0].enabled })
```

and the response:

```js
    return res.status(200).json({ ok: true, email: rows[0].email, enabled: !!rows[0].enabled })
```

with:

```js
    return res.status(200).json({ ok: true, email: rows[0].email, flag, enabled: !!rows[0].enabled })
```

### 3. `src/AdminDashboard.jsx` — pick the flag, and stop naming the wrong feature

Add a flag selector to the tester panel, defaulting to the connector flag so the panel's existing use is unchanged. Populate its options from the `flags` object the GET now returns; fall back to the connector flag alone if the field is absent.

Then replace this line, which names a feature the flag has not gated since 2026-08-30:

```js
      setPipelineMsg(data.enabled ? `Granted My Pipeline to ${data.email}.` : `Revoked My Pipeline from ${data.email}.`)
```

with a message built from the selected flag's label, e.g.:

```js
      const what = (flags[data.flag] && flags[data.flag].label) || data.flag
      setPipelineMsg(data.enabled ? `Granted ${what} to ${data.email}.` : `Revoked ${what} from ${data.email}.`)
```

Pass the selected flag on both the GET (`?flag=`) and the POST body. The panel heading should name what it does — granting pilot access — rather than "My Pipeline".

### 4. `api/coach.js` — the instruction, the trailer, the header

**4a. The instruction.** Add beside `VALUES_CAPTURE_NOTE` (which currently sits at line 77). Written to the same contract as its siblings: the model proposes, the app never writes without a tap.

```js
const NEXT_STEP_CAPTURE_NOTE = '\n\nNEXT STEP CAPTURE: when this person tells you an action THEY intend to take on one of their opportunities — a call they are making, a follow-up they are sending, someone they are reaching out to, something they will prepare — end your reply with a final line exactly like NEXTSTEP: {"opportunity":"<the opportunity title from their saved work>","move":"Call Theresa","date":"2026-09-14"} . `move` is a short imperative phrase in their own words, under 80 characters, never a sentence and never your paraphrase of their reasoning. `date` is YYYY-MM-DD, resolved against TODAY\'S DATE above — "next Thursday", "the 14th" and "a week from Tuesday" all resolve to a real date; omit the key entirely if they gave no timing, and never invent one. Include `opportunity` only when it is clear which one they mean. Emit it ONLY for an action they have actually decided on — not for something you suggested and they have not agreed to, not for a meeting the employer is scheduling (that is not their step), and not to restate a next step they already have. The app turns that line into a one-tap offer showing the exact wording and date before anything is saved, and never shows the line itself — so do not mention it, and do not tell them to go type it in. At most once per reply; otherwise omit it entirely.'
```

**4b. Gate it into the prompt.** `buildCoachProfileSlice` currently takes `featureFlags` and already computes `connectorNote` from it. Add alongside:

```js
  const nextStepNote = hasPipelineCapture({ feature_flags: featureFlags }) ? NEXT_STEP_CAPTURE_NOTE : ''
```

and append `${nextStepNote}` to the returned template string, immediately after `${INTERVIEW_TEAM_CAPTURE_NOTE}`. Import `hasPipelineCapture` alongside the existing `hasConnectorBeta` import. A non-flagged account never receives the instruction, so the parser below simply never fires for them — the same no-op the interview-team capture already relies on.

**4c. Parse the trailer.** Immediately after the Values block (the `vcMatch` handling that ends around line 1060), mirroring its shape exactly:

```js
  // Next-step capture: the model may end with a NEXTSTEP: {json} line carrying an
  // action the person said they will take on an opportunity. Strip it and ship it
  // on a response header; the client shows the exact wording and date and offers a
  // one-tap save that writes through the same PUT the card editor uses. The date is
  // validated here, not trusted: a value outside a sane window is dropped rather
  // than offered, so a model slip cannot put "overdue by 9,131 days" on a card.
  let nextStepB64 = null
  const nsMatch = strippedText.match(/^\s*NEXTSTEP:\s*(\{[\s\S]*?\})\s*$/im)
  if (nsMatch) {
    strippedText = strippedText.replace(nsMatch[0], '').trim()
    try {
      const parsed = JSON.parse(nsMatch[1])
      const move = typeof (parsed && parsed.move) === 'string' ? parsed.move.trim().slice(0, 200) : ''
      let date = ''
      if (typeof (parsed && parsed.date) === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(parsed.date.trim())) {
        const d = new Date(`${parsed.date.trim()}T12:00:00Z`)
        const days = (d.getTime() - Date.now()) / 86400000
        // Same window api/pursuit-status.js parseTs enforces, applied before the
        // offer rather than after the tap, so a bad date is never shown as savable.
        if (!Number.isNaN(d.getTime()) && days > -400 && days < 1900) date = parsed.date.trim()
      }
      if (move) {
        nextStepB64 = Buffer.from(JSON.stringify({
          opportunity: String((parsed && parsed.opportunity) || '').slice(0, 200),
          move,
          date,
        })).toString('base64')
      }
    } catch { /* malformed — drop the line, no offer */ }
  }
```

**4d. Emit the header.** Beside the existing three (lines 1107-1109):

```js
  if (nextStepB64) res.setHeader('X-Coach-Next-Step', nextStepB64)
```

Verify against current code whether these headers need adding to an `Access-Control-Expose-Headers` value. The client reads `X-Coach-Interviewers` same-origin today with no expose list, so most likely nothing is needed — but confirm rather than assume, and if an expose list exists anywhere in the response path, add the new header to it.

### 5. `src/components/Chat.jsx` — the offer

Add `nextStepCaptureActive = false` to the destructured props (line 32), and read the header beside its siblings (line 300):

```js
        const nsHeader = res.headers.get('X-Coach-Next-Step') || null
```

Then, after the Values capture block, add:

```js
        // Next-step capture: the server extracted an action the person said they
        // would take. Show the exact wording and the resolved date on the button —
        // voice input is least reliable on names and numbers, and this is entirely
        // names and numbers, so the interpretation has to be visible BEFORE the tap
        // rather than discoverable two weeks later when the plan is wrong.
        if (nextStepCaptureActive && nsHeader) {
          try {
            const data = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(nsHeader), c => c.charCodeAt(0))))
            const move = data && typeof data.move === 'string' ? data.move.trim() : ''
            if (move) {
              const when = data.date
                ? new Date(`${data.date}T12:00:00Z`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })
                : ''
              const where = data.opportunity ? ` on ${data.opportunity}` : ''
              setMessages(m => [...m, {
                role: 'assistant',
                content: `Want me to put that on My Pipeline as your next step${where}? You can change it there any time.\n\n${move}${when ? ` — ${when}` : ' — no date set'}`,
                checkinKey: 'pursuit-next-step',
                quickReplies: [
                  { label: when ? `Save it — ${when}` : 'Save it', value: JSON.stringify(data), followUp: 'Saved to My Pipeline.' },
                  { label: 'Not now', value: 'dismiss' },
                ],
              }])
            }
          } catch { /* malformed header — no offer */ }
        }
```

### 6. `src/App.jsx` — pass the prop, write on the tap

**6a.** Add the flag mirror beside the existing `hasConnectorBeta` (line 7210):

```js
  // PILOT — Coach next-step capture, 2026-09-02. Server-side truth is
  // api/_lib/feature-flags.js (PIPELINE_CAPTURE_FLAG); this mirror only decides
  // whether the client will render an offer, and the server independently
  // decides whether the model was ever told it could make one.
  const hasPipelineCapture=Array.isArray(signedInUser?.feature_flags)&&signedInUser.feature_flags.includes('pipeline_capture')
```

**6b.** Add `nextStepCaptureActive={hasPipeline&&hasPipelineCapture}` to **both** `<Chat ...>` call sites (lines 13461 and 15249). Both, or the capture works in the panel and not the bubble.

**6c.** In `handleEmploymentQuickReply`, insert a branch immediately after the `pursuit-stage` branch:

```js
    // Coach proposed a next step the person stated; the tap is what writes it.
    // Matches the opportunity by title, falling back to the open one — same
    // resolution the interview-team branch below uses, and the same refusal:
    // with no target, write nothing rather than write to the wrong record.
    if(checkinKey==='pursuit-next-step'){
      if(value==='dismiss')return true
      let data;try{data=JSON.parse(value)}catch{return false}
      const move=data&&typeof data.move==='string'?data.move.trim():''
      if(!move)return false
      const oppName=String(data.opportunity||'').trim().toLowerCase()
      const match=oppName?activePlaybooks.find(r=>r&&r.source==='door2'&&String(r.title||'').toLowerCase().includes(oppName)):null
      const tgt=coachSaveTarget()
      const targetId=(match&&match.id)||(tgt&&tgt.id)||null
      if(!targetId)return false
      const patch={next_move:move}
      // Only send the date when there is one. Sending null would CLEAR a date the
      // person already has, and "I'm calling Theresa" with no timing must never
      // silently erase the deadline already on the card.
      if(data.date)patch.next_step_at=new Date(`${data.date}T12:00:00Z`).toISOString()
      savePursuit(targetId,patch)
      return true
    }
```

---

## Voice rules on inserted text

The only user-facing strings added are the offer message and its two buttons.

- *"Want me to put that on My Pipeline as your next step on <opportunity>? You can change it there any time."* — plain language, names the surface by its render-true label, no logic-flip cadence, no comparative standing, no coaching register, no typology. Matches the register of the Values and interview-team offers already shipping.
- *"Save it — Sun Sep 14"* / *"Not now"* — the same two-button shape as the existing captures.
- Nothing here asserts anything about the user. Every claim is a readback of what they just said, which is the translation-not-praise rule in its simplest form.
- Prompt text in change 4a is model instruction, not user-facing copy, and is exempt from the voice gate the same way the existing capture notes are. It still must not instruct the model toward banned constructions, and it does not.

---

## Static gates

- `npm run build` clean.
- `check-voice` 0/0. No new voice-allow region. If one appears to be needed, STOP and surface it — the current count (~12) is watched.
- `check-prompt-refs` 0.
- `check-coach-nav-map` passes unchanged. This brief adds **no** `FEATURE_MAP` entry, so the generated map must not move; a diff there means something was added that should not have been.
- `check-fontsize` ratchet not raised.
- `src/App.jsx` EOF integrity: record the line count and the final closing tag before and after every edit, and confirm they match expectations. Use git clone + Python rewrite if the Edit tool truncates.
- Diff limited to the six files in the table above.

## Runtime gate (post-merge)

Preview-deploy smoke first — this touches `api/*`. `npm run smoke:preview -- https://reimagine2-git-<branch>-career-club.vercel.app`; both `/api/health` and `/api/claude` must return non-5xx. Use the **reimagine2** host; `reimagine-git-*` is the other project and the bypass token does not open it.

Then, after merge, on production:

1. Grant `pipeline_capture` to Lindsey from the admin dashboard. Confirm the result message names "Coach next-step capture", not "My Pipeline".
2. As a **non-flagged** account: open My Coach with an opportunity open and say *"I'm calling Theresa on the 14th."* Expect a normal reply, no offer, and no `NEXTSTEP:` text visible anywhere in the answer.
3. As the flagged account, same sentence. Expect the offer, with the date rendered on the button. Tap it; confirm the next step and date appear on that opportunity's My Pipeline card and survive a reload.
4. Say a relative date (*"I'll follow up next Thursday"*) and confirm the rendered date is the correct upcoming Thursday.
5. Say something with no date (*"I need to email the recruiter"*) and confirm the offer appears with "no date set" and that tapping it does **not** clear a date already on the card.
6. Decline an offer ("Not now") and confirm nothing is written.

## Constraints

- Single PR. No effort estimates anywhere in the PR or commits.
- PR title: `Coach can save a next step you just named (gated pilot)`.
- The model never writes. The tap writes. Do not add any path where a header alone mutates state.

## Out of scope

- Any migration. The columns exist.
- Any change to `api/pursuit-status.js`. Its PUT contract already accepts both fields.
- Capturing the **meeting** date (`next_conversation_at`) or the stage through this trailer. Both are natural extensions and both should wait until this one has been used by a real person for a week; folding them in now triples the surface under test and makes a bad result hard to attribute.
- Retiring `STAGE_MENTION_RE`. It keeps working; superseding it is a later call.
- Non-opportunity activity (networking outreach, recruiter relationships, applications with no playbook). Nothing in the schema models these, and inventing that model belongs in its own brief.
- The public user-guide chapters and any `FEATURE_MAP` entry. Pilot documentation ships in this PR, partitioned by audience — see Documentation below.

## Documentation (in THIS PR, partitioned by audience)

CLAUDE.md §8 requires docs to ship with a user-facing change. An earlier draft of this brief proposed holding them until GA; that was wrong, and it reinvented a problem the repo already solved.

`src/data/user-guide/ORDER.json` warns that any listed chapter is interpolated into the ONE cached system block `api/coach.js` sends to **every user on every turn** — so a chapter about a one-account pilot would ship to all 145. The established answer is `src/data/go-independent-knowledge.js`: content in its own plain-`.js` file, deliberately out of `ORDER.json`, imported by `api/coach.js` and injected as its own `cache_control` block only for the audience that has the feature.

Use that pattern here. In this PR:

1. Write the capture's documentation into `src/data/next-step-knowledge.js` if the Your Next Step brief has already created it, or a small `src/data/pipeline-capture-knowledge.js` if not — a paragraph on what the Coach can now offer to save, and that nothing is written without a tap.
2. Import it in `api/coach.js` and gate its injection on `hasPipelineCapture`, mirroring `goIndependentBlock` (`api/coach.js:833`, spread conditionally into the system array at line 932).
3. Add it to the file's header comment as the reason it is not in `ORDER.json`.

At GA, the flag and its uses come out, the text moves into `src/data/user-guide/my-coach.md` and `my-pipeline.md`, and a `FEATURE_MAP` entry is added if one is warranted (then `npm run gen:coach-nav-map`).

## Commit message

```
Let My Coach save a next step the person just named

My Coach already reads next_move and next_step_at -- it can tell someone a
step is missing or twelve days overdue, and then hand them a form. This
closes that half-state: when someone says they are calling Theresa on the
14th, the Coach offers to put it on the card.

Fourth instance of the capture pattern the interview-team and Values offers
already use: the model ends its reply with a hidden line, the server
validates it onto a response header, the client shows the exact wording and
the resolved date, and the person taps. The model still never writes.
Model-emitted rather than regex-triggered because the stage regex catches no
part of "calling Theresa on the 14th", and no regex resolves "next Thursday".

The date is validated server-side against the same window
api/pursuit-status.js enforces, so a bad value is never offered as savable,
and it is omitted from the patch when absent so a dateless step cannot clear
a deadline already on the card. No migration and no endpoint change: the
columns and the PUT contract have been there since August.

Behind a per-user flag. api/_lib/feature-flags.js grew from one named flag to
a registry, and the admin tester panel can now grant any flag in it -- which
also retires a result message that had been naming My Pipeline since that
flag stopped meaning My Pipeline in August.
```

## Push

Branch, PR, `gh pr checks --watch`, squash-merge once green — the gh flow in CLAUDE.md §9. Vercel auto-deploys from `main`. Report the PR URL and the merge SHA.

## Implementer's checklist

1. Pull `main`.
2. Premise-verify: `PURSUIT_STAGES` / `savePursuit` / `handleEmploymentQuickReply` in `src/App.jsx`; the four header reads and the Values block in `src/components/Chat.jsx`; `VALUES_CAPTURE_NOTE`, `buildCoachProfileSlice`, the `vcMatch` block and the `setHeader` trio in `api/coach.js`; the PUT body parse in `api/pursuit-status.js`; `CONNECTOR_BETA_FLAG` in `api/_lib/feature-flags.js`. Substance-grep, not just block-existence — if `next_move` handling has already grown a capture path, this brief is reshaping rather than adding and its scope changes.
3. Apply changes 1-6 in order. Record `src/App.jsx` line count before and after.
4. Run the static gates.
5. Update Chapter 11 (changelog) in `Output/docs/reimagine-system-documentation/`.
6. Push, open the PR, watch CI, smoke the preview, squash-merge.
7. Report the PR URL and merge SHA, and confirm which gates passed with their actual output.
