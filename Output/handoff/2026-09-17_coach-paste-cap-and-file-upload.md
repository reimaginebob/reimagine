# My Coach: raise the paste cap, add a document-attach control (pilot)

## Prompt for Code

Apply the changes in this brief to the reimagine repo. Premise-verify every anchor quoted below against current `main` before editing (line numbers will have drifted). Make the changes, run the static gates listed, update the changelog, and follow the standard gh flow (branch, PR, watch CI, squash-merge) from CLAUDE.md section 9. Report the PR URL and merge SHA when done.

## Date / Type / Source

2026-09-17. Bug fix + new pilot capability, one PR. Source: a live user report (Magnus, via Bob) — pasting a long call transcript into My Coach failed with a generic "Sorry, something went wrong" error — followed by a scoping conversation with Bob that expanded the fix into two related changes he asked to ship together.

## Pre-flight discovery (scope correction)

Confirmed against current code (not audit hypotheses — this brief was drafted directly from the live codebase in the same session):

- **Root cause of the reported bug, confirmed by reading both sides of the request.** `api/coach.js` rejects any Coach message over `MAX_MESSAGE_BYTES` (8000 bytes, `api/coach.js:580`) with `res.status(400).json({ error: 'message too long' })` (`api/coach.js:2244-2246`), no `message` field. `src/components/Chat.jsx` only builds a tailored error string for status 401 and 503 (`Chat.jsx:804-817`); every other failure, including this 400, falls through to the generic "Sorry, something went wrong. Try again in a moment." Magnus had no way to know his paste was the problem.
- **The cap itself was never protecting against a real size problem.** A one-hour speaker-labeled transcript runs roughly 50-150 KB as plain text (~9,000-12,000 words at ~5-6 bytes/word) — comfortably under 1 MB, and around 12,000-16,000 tokens against Claude's 200K-token context window. The 8000-byte cap (comment at `api/coach.js:573-579` calls it "generous... for anything a person would plausibly type or dictate in one turn") was sized for a chat turn, not a pasted document, and was never a payload-size or context-window constraint.
- **Existing upload infrastructure is 100% client-side, reusable, and holds no files.** Every current upload (resume, LinkedIn export, job offer, job description) works by extracting text from the file IN THE BROWSER — `extractText(file)` at `src/App.jsx:3247-3272` (mammoth for `.docx`/`.doc`, pdf.js for `.pdf`, `FileReader` fallback for everything else) — then writing only the extracted text into `profile.*` string fields, autosaved as part of the `profile_state` JSONB column. No blob storage, no virus scanning, no raw file ever reaches a server. This is directly reusable for Coach: the plan below moves `extractText` (and its private helpers `stripNulText`, `loadPDFJS`, `PDFJS_LOAD_TIMEOUT_MS`) into a new shared module and calls it from `Chat.jsx` the same way `App.jsx`'s upload screens already do.
- **Coach today has zero file concept, not even stubbed.** Its system prompt states outright, at `api/coach.js:1718`: *"You cannot accept file uploads, open attachments, or see their screen — when they want you to work from a document like a job description, a posting, or a resume, ask them to paste the relevant text into the chat."* This sentence needs a small amendment (not a rewrite) so it can be superseded for pilot accounts without contradicting itself mid-prompt.
- **PowerPoint (.pptx) is explicitly out of scope for this brief.** `.pptx` is a zip of XML like `.docx`, but mammoth does not parse it (Word only), so supporting it needs a new client-side dependency (a zip/XML reader) that hasn't been chosen yet. Raw `.pptx` file size (0.3-20 MB) is irrelevant either way, since only extracted text ever leaves the browser — but picking and vetting that dependency is its own scoped decision, not a rider on this brief. See "Out of scope."
- **This ships as a gated pilot, per CLAUDE.md section 8's "no exceptions" rule** (new user-facing capability → named flag, Bob first). Checked `api/_lib/feature-flags.js`: the established pattern for a small, single-purpose pilot gate is `CORRECTION_ACTIONS_FLAG`/`hasCorrectionActions` (flag OR `isInternalAccount`), added 2026-09-14 — this brief follows that exact shape for a new `COACH_FILE_UPLOAD_FLAG`.
- **Docs-currency check (CLAUDE.md section 8).** `src/data/user-guide/*.md` was grepped for any existing mention of a Coach message-length limit — none exists, so the cap raise has nothing stale to correct. File upload is gated, so per the "pilot documentation is partitioned, not deferred" rule (the `go-independent-knowledge.js` / `correction-actions-knowledge.js` pattern), its Coach-facing knowledge goes in its own new `.js` file outside `src/data/user-guide/ORDER.json`, injected only for flagged accounts. The public user guide and `FEATURE_MAP` (`src/coach-routing.js`) are deliberately NOT touched in this PR — see "Out of scope."
- **The byte-cap unit test needs no changes.** `scripts/test-coach-rate-limit.mjs` references `MAX_MESSAGE_BYTES` symbolically throughout (`'a'.repeat(MAX_MESSAGE_BYTES)`, etc.), never the literal `8000` — confirmed by grep. It will exercise the new value automatically.

## Files affected

| File | Change |
|---|---|
| `api/coach.js` | Raise `MAX_MESSAGE_BYTES`; give the "message too long" response a real `message`; amend one sentence in the system prompt; import and wire the new pilot flag and its knowledge block |
| `src/extract-text.js` (NEW) | `extractText` + its private helpers, moved out of `App.jsx` verbatim so `Chat.jsx` can import the same function |
| `src/App.jsx` | Replace the local `extractText`/`stripNulText`/`loadPDFJS`/`PDFJS_LOAD_TIMEOUT_MS` definitions with an import from the new module; add the client-side flag mirror; pass the new prop into both `<Chat/>` mounts |
| `src/components/Chat.jsx` | Add a gated attach control next to the message box; generalize the error-fallback text to read a server-provided `message` for any failure status, not just 503 |
| `api/_lib/feature-flags.js` | Add `COACH_FILE_UPLOAD_FLAG` / `hasCoachFileUpload`; register it in `GRANTABLE_FLAGS` |
| `src/data/coach-file-upload-knowledge.js` (NEW) | Gated Coach knowledge describing the attach control, injected only for flagged accounts |

## Specific changes

### 1. `api/coach.js` — raise the cap and explain why

Replace:

```js
// Prelaunch audit, finding #2.2: a Coach message had no length limit at all.
// Measured in bytes (not characters), since a multi-byte-heavy paste could be
// well within a character-count cap while still being a multi-megabyte
// payload. 8000 bytes is roughly 1300+ words -- generous for anything a
// person would plausibly type or dictate in one turn, small next to the
// abuse case (a scripted caller pasting megabytes to run the cost up).
// Exported as a pure function so the byte-cap logic can be tested directly.
export const MAX_MESSAGE_BYTES = 8000
export function messageExceedsByteCap(message) {
  return typeof message === 'string' && Buffer.byteLength(message, 'utf8') > MAX_MESSAGE_BYTES
}
```

with:

```js
// Prelaunch audit, finding #2.2: a Coach message had no length limit at all.
// Measured in bytes (not characters), since a multi-byte-heavy paste could be
// well within a character-count cap while still being a multi-megabyte
// payload. Originally set to 8000 bytes (~1300 words) as "generous for
// anything a person would plausibly type" -- which undersold what people
// actually paste in. A one-hour speaker-labeled transcript runs roughly
// 50-150 KB of plain text (~9,000-12,000 words), and even that is a rounding
// error against Claude's 200K-token context window: neither payload size nor
// context capacity was ever the real constraint. Raised 2026-09-17 (Magnus's
// reported failure pasting a call transcript) to 300,000 bytes -- comfortably
// covers a multi-hour transcript or a long document with room to spare -- and
// kept as a true outer bound against the actual abuse case: a scripted caller
// pasting megabytes to run the cost up.
// Exported as a pure function so the byte-cap logic can be tested directly.
export const MAX_MESSAGE_BYTES = 300000
export function messageExceedsByteCap(message) {
  return typeof message === 'string' && Buffer.byteLength(message, 'utf8') > MAX_MESSAGE_BYTES
}
```

### 2. `api/coach.js` — give the rejection a message the client can show

Replace:

```js
  if (messageExceedsByteCap(rawMessage)) {
    return res.status(400).json({ error: 'message too long' })
  }
```

with:

```js
  if (messageExceedsByteCap(rawMessage)) {
    return res.status(400).json({ error: 'message too long', message: "That's too long for me to read in one message. Try sending it in a shorter chunk." })
  }
```

### 3. `api/coach.js` — amend the system prompt's file-upload disclaimer

Find, inside `SYSTEM_PROMPT_HEAD` (`api/coach.js:1718`):

```
- You are talking with the person in a text chat. You cannot accept file uploads, open attachments, or see their screen — when they want you to work from a document like a job description, a posting, or a resume, ask them to paste the relevant text into the chat. You see the titles of their saved playbooks in the index,
```

Replace the opening clause only (leave the rest of the bullet — "You see the titles of their saved playbooks..." onward — unchanged) with:

```
- You are talking with the person in a text chat. You cannot open attachments or see their screen, and unless a later note in this prompt says otherwise for this account, you cannot accept file uploads either — when they want you to work from a document like a job description, a posting, or a resume, ask them to paste the relevant text into the chat. You see the titles of their saved playbooks in the index,
```

This is the minimal edit that lets the new pilot knowledge block (change 6 below) supersede the general rule for flagged accounts without leaving two flatly contradictory instructions in the same prompt.

### 4. `api/coach.js` — import the new flag and knowledge

Find the flag import (`api/coach.js:23`):

```js
import { hasConnectorBeta, hasPipelineCapture, hasNextStep, hasOnboardingConcierge, hasCoachNoteAgency, hasSectionRework, hasMilestonePrompt, hasOrientationCapture, hasCloseReasonCapture, hasIndustryEcosystemView, hasCoachSituation } from './_lib/feature-flags.js'
```

Add `hasCoachFileUpload` to that list:

```js
import { hasConnectorBeta, hasPipelineCapture, hasNextStep, hasOnboardingConcierge, hasCoachNoteAgency, hasSectionRework, hasMilestonePrompt, hasOrientationCapture, hasCloseReasonCapture, hasIndustryEcosystemView, hasCoachSituation, hasCoachFileUpload } from './_lib/feature-flags.js'
```

Find the knowledge import (`api/coach.js:21`):

```js
import { CORRECTION_ACTIONS_KNOWLEDGE } from '../src/data/correction-actions-knowledge.js'
```

Add a line directly after it:

```js
import { COACH_FILE_UPLOAD_KNOWLEDGE } from '../src/data/coach-file-upload-knowledge.js'
```

### 5. `api/coach.js` — push the knowledge block when the flag is on

Find, in `buildCoachRequest` (`api/coach.js:1969`):

```js
  if (!generalMode && hasCorrectionActions({ feature_flags: featureFlags, email: userEmail })) knowledgeParts.push(CORRECTION_ACTIONS_KNOWLEDGE)
```

Add directly after it:

```js
  if (!generalMode && hasCoachFileUpload({ feature_flags: featureFlags, email: userEmail })) knowledgeParts.push(COACH_FILE_UPLOAD_KNOWLEDGE)
```

### 6. `src/data/coach-file-upload-knowledge.js` (NEW)

```js
// Coach knowledge for the file-upload pilot (2026-09-17): the paperclip
// attach control next to the My Coach message box.
//
// DELIBERATELY NOT IN src/data/user-guide/ORDER.json. That list feeds the one
// cached system block api/coach.js sends to EVERY user on EVERY turn, so a
// chapter there would describe a control most accounts cannot see. Same
// shape as src/data/correction-actions-knowledge.js: api/coach.js injects
// this only for accounts where hasCoachFileUpload is true. When the pilot
// opens to everyone, this moves into the My Coach user-guide chapter and
// this file is deleted.
//
// Cross-boundary import rule (CLAUDE.md section 8): `.js`, never `.mjs`,
// because api/coach.js imports it.
export const COACH_FILE_UPLOAD_KNOWLEDGE = `ATTACHING A DOCUMENT (this person has it; most accounts do not, so never imply it is generally available).

This person can attach a document -- a PDF, a Word file, or a plain text file -- using the paperclip control next to the message box. When they do, its text is pulled out and placed into their next message before it reaches you, so by the time you see it, the file's content is already part of what they wrote. Read it the way you would anything else they typed: a pasted meeting transcript, a job posting, a homework assignment, anything on paper they want you to work from.

This overrides the earlier instruction that you cannot accept file uploads and must ask them to paste text instead -- for this account, that no longer applies. If they ask whether you can take a file, say yes and point them to the paperclip next to the message box.

A very large attachment can still come through as more text than one message holds. If something they send ever looks cut short, ask them to attach a shorter section or paste the part that matters most, rather than guessing at what was cut.`
```

### 7. `api/_lib/feature-flags.js` — the new flag

Find:

```js
export function hasCorrectionActions(user) {
  const flags = user && Array.isArray(user.feature_flags) ? user.feature_flags : []
  return flags.includes(CORRECTION_ACTIONS_FLAG) || isInternalAccount(user)
}
```

Add directly after it (before the `GRANTABLE_FLAGS` comment block):

```js

// PILOT -- Coach file upload, 2026-09-17. Gates the paperclip attach control
// next to the My Coach message box: drop in a PDF, Word doc, or text file and
// its extracted text is inserted into the next message -- the same
// client-side extraction path (mammoth for Word, pdf.js for PDF, no
// server-side storage) already used for resume, LinkedIn, and
// job-description uploads elsewhere in the app. A separate flag from the
// others on purpose: this changes what Coach's own system prompt tells the
// model it can accept, which Bob QCs on its own before any outside account
// sees it.
export const COACH_FILE_UPLOAD_FLAG = 'coach_file_upload'

export function hasCoachFileUpload(user) {
  const flags = user && Array.isArray(user.feature_flags) ? user.feature_flags : []
  return flags.includes(COACH_FILE_UPLOAD_FLAG) || isInternalAccount(user)
}
```

Find:

```js
export const GRANTABLE_FLAGS = {
  [CONNECTOR_BETA_FLAG]: { label: 'Assistant connector' },
  [CORRECTION_ACTIONS_FLAG]: { label: 'Does this feel right?: what should happen' },
}
```

Replace with:

```js
export const GRANTABLE_FLAGS = {
  [CONNECTOR_BETA_FLAG]: { label: 'Assistant connector' },
  [CORRECTION_ACTIONS_FLAG]: { label: 'Does this feel right?: what should happen' },
  [COACH_FILE_UPLOAD_FLAG]: { label: 'My Coach: attach a document' },
}
```

### 8. `src/extract-text.js` (NEW) — move the shared extractor out of `App.jsx`

Move these four things out of `src/App.jsx` verbatim (no logic change) into a new file:

- `PDFJS_LOAD_TIMEOUT_MS` (currently `App.jsx:1072`)
- `loadPDFJS` (currently `App.jsx:1081-1110`)
- `stripNulText` (currently `App.jsx:3245`)
- `extractText` (currently `App.jsx:3247-3272`)

```js
const PDFJS_LOAD_TIMEOUT_MS=20000
function loadPDFJS(){return new Promise((resolve,reject)=>{
  if(window.pdfjsLib){resolve(window.pdfjsLib);return}
  const s=document.createElement('script')
  s.src='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
  // Subresource Integrity: pin the SHA-384 of the exact bytes we expect so a
  // compromised CDN or MITM cannot execute swapped code. crossOrigin is
  // required or the browser silently skips the integrity check on a
  // cross-origin script. The worker is self-hosted under /public (SRI does
  // not apply to Worker URLs the same way), removing third-party trust there.
  s.integrity='sha384-/1qUCSGwTur9vjf/z9lmu/eCUYbpOTgSjmpbMQZ1/CtX2v/WcAIKqRv+U1DUCG6e'
  s.crossOrigin='anonymous'
  // One-shot settle guard: whichever of load / error / timeout arrives first
  // wins and the rest become no-ops.
  let settled=false
  const fail=(why)=>{if(settled)return;settled=true;clearTimeout(timer);const e=new Error(why);e.pdfLoaderFailed=true;reject(e)}
  const timer=setTimeout(()=>fail('pdf_reader_timeout'),PDFJS_LOAD_TIMEOUT_MS)
  s.onload=()=>{
    if(settled)return
    // `load` fires but the global is absent when the bundle was served as
    // something other than the script we expect — a captive-portal login page
    // or a proxy error page with a 200. Treat it as a failure, not a success
    // that crashes on the next line.
    if(!window.pdfjsLib){fail('pdf_reader_unavailable');return}
    settled=true;clearTimeout(timer)
    window.pdfjsLib.GlobalWorkerOptions.workerSrc='/pdf-worker/3.11.174/pdf.worker.min.js'
    resolve(window.pdfjsLib)
  }
  s.onerror=()=>fail('pdf_reader_blocked')
  document.head.appendChild(s)
})}
const stripNulText=s=>typeof s==='string'?s.replace(/\x00/g,''):s
export async function extractText(file){
  const ext=file.name.toLowerCase().split('.').pop()
  if(ext==='docx'||ext==='doc'){const mammoth=await import('mammoth');const ab=await file.arrayBuffer();const r=await mammoth.extractRawText({arrayBuffer:ab});return stripNulText(r.value)}
  if(ext==='pdf'){
    // The reader failing to LOAD and a PDF failing to PARSE are different
    // problems with different advice, and they are separated here.
    //
    // A parse failure degrades gracefully: the bracketed notice is returned as
    // the extracted text, lands in the field, and tells the user what to do.
    // That is deliberate: the file really cannot be read, and the user needs
    // the guidance in front of them.
    //
    // A loader failure THROWS instead. Nothing is wrong with the file, so
    // writing a notice into the user's assessment or resume would be wrong on
    // the facts and would sit in their profile (and in every prompt built from
    // it) forever. Every call site wraps this in try/catch + finally, so the
    // throw clears the busy flag and surfaces a real error.
    let lib
    try{lib=await loadPDFJS()}
    // Reads correctly both on its own (the resume upload shows e.message alone)
    // and after a prefix (the others show "Could not read <file>: <message>").
    catch{throw new Error("We could not load the PDF reader. An ad blocker or network filter may be blocking it. Paste the text into the box below instead, or try again on a different network.")}
    try{const ab=await file.arrayBuffer();const pdf=await lib.getDocument({data:ab}).promise;let t='';for(let i=1;i<=pdf.numPages;i++){const pg=await pdf.getPage(i);const c=await pg.getTextContent();t+=c.items.map(x=>x.str).join(' ')+'\n'}if(t.trim().length<100)return "[This PDF appears to be image-based or browser-printed and couldn't be read as text. Try opening it and using Save As to save as a standard PDF, or simply paste the text below.]";return stripNulText(t)}catch{return "[This PDF couldn't be read automatically. If it was saved from a browser (like Edge or Chrome), try opening it and printing to a standard PDF, or just paste the text directly below.]"}
  }
  return new Promise((res,rej)=>{const r=new FileReader();r.onload=e=>res(stripNulText(e.target.result));r.onerror=rej;r.readAsText(file)})
}
```

Note: only `extractText` needs to be exported. `PDFJS_LOAD_TIMEOUT_MS`, `loadPDFJS`, and `stripNulText` are private to this module (confirmed by grep: nothing else in `App.jsx` calls them outside `extractText`/`loadPDFJS` itself).

### 9. `src/App.jsx` — import instead of define

Delete the four items moved in change 8 from their current locations (`App.jsx:1072-1110` and `App.jsx:3245-3272`), and add an import near the top of the file, alongside the other local-module imports:

```js
import { extractText } from './extract-text.js'
```

Verify line count and EOF closure before AND after this edit, per CLAUDE.md section 5's App.jsx integrity rule — this touches two separate regions of a very large file.

### 10. `src/App.jsx` — client-side flag mirror

Find (`App.jsx:8433-8435`):

```js
  // PILOT -- correction actions (2026-09-14). Mirror of hasCorrectionActions in
  // api/_lib/feature-flags.js: the flag, or any internal account.
  const hasCorrectionActions=!!signedInUser&&((Array.isArray(signedInUser.feature_flags)&&signedInUser.feature_flags.includes('correction_actions'))||/@career\.club$/i.test(signedInUser.email||''))
```

Add directly after it:

```js
  // PILOT -- Coach file upload (2026-09-17). Mirror of hasCoachFileUpload in
  // api/_lib/feature-flags.js: the flag, or any internal account.
  const hasCoachFileUpload=!!signedInUser&&((Array.isArray(signedInUser.feature_flags)&&signedInUser.feature_flags.includes('coach_file_upload'))||/@career\.club$/i.test(signedInUser.email||''))
```

### 11. `src/App.jsx` — pass the prop into both `<Chat/>` mounts

Both current mounts end with `...onSessionOpen={handleCoachSessionOpen}/>` (`App.jsx:19596` inside the concierge-embedded panel, and `App.jsx:19609` the floating-bubble mount). In both places, insert `hasCoachFileUpload={hasCoachFileUpload}` immediately before that closing prop, e.g.:

```
...onMoodLow={handleCoachMoodLow} hasCoachFileUpload={hasCoachFileUpload} onSessionOpen={handleCoachSessionOpen}/>
```

(Apply the same insertion — `hasCoachFileUpload={hasCoachFileUpload}` right before `onSessionOpen={handleCoachSessionOpen}/>` — at both line 19596 and line 19609.)

### 12. `src/components/Chat.jsx` — imports

Find:

```js
import { useState, useEffect, useRef } from 'react'
import MD from './MD'
import CoachMark from './CoachMark'
import SpeechBtn, { hasSpeech } from './SpeechBtn'
```

Replace with:

```js
import { useState, useEffect, useRef } from 'react'
import { Paperclip } from 'lucide-react'
import MD from './MD'
import CoachMark from './CoachMark'
import SpeechBtn, { hasSpeech } from './SpeechBtn'
import { extractText } from '../extract-text.js'
```

### 13. `src/components/Chat.jsx` — accept the new prop

In the component signature (`Chat.jsx:94`), find the tail:

```
onVoiceViolation = null, onDistressDetected = null, onMoodLow = null, onSessionOpen = null }) {
```

Replace with:

```
onVoiceViolation = null, onDistressDetected = null, onMoodLow = null, onSessionOpen = null, hasCoachFileUpload = false }) {
```

### 14. `src/components/Chat.jsx` — local state for the attach control

Add near the component's other `useState` declarations (alongside `input`/`loading`):

```js
  const [fileBusy, setFileBusy] = useState(false)
  const [fileErr, setFileErr] = useState(null)
  const fileInputRef = useRef()
```

### 15. `src/components/Chat.jsx` — the control itself

Find (`Chat.jsx:1610`):

```js
      {hasSpeech && <SpeechBtn ref={speechBtnRef} onResult={t => setInput((input || '') + t)} C={C} title="Speak your question" />}
```

Add directly after it:

```js
      {hasCoachFileUpload && <>
        <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,.txt" style={{ display: 'none' }}
          onChange={async e => {
            const f = e.target.files[0]
            e.target.value = ''
            if (!f) return
            setFileBusy(true); setFileErr(null)
            try {
              const t = await extractText(f)
              setInput(prev => (prev ? prev.trim() + '\n\n' : '') + t)
            } catch (err) {
              setFileErr(`Could not read ${f.name}: ${err.message}`)
            } finally {
              setFileBusy(false)
            }
          }} />
        <button type="button" title="Attach a document (PDF, Word, or text)" disabled={fileBusy || loading}
          onClick={() => fileInputRef.current.click()}
          style={{
            background: '#fff', border: '1px solid #E2E5EA', borderRadius: 8, padding: '8px 10px',
            cursor: (fileBusy || loading) ? 'default' : 'pointer', opacity: (fileBusy || loading) ? 0.5 : 1,
            display: 'flex', alignItems: 'center',
          }}>
          <Paperclip size={17} color="#8A9BB8" />
        </button>
      </>}
```

Add a line to render `fileErr` and the busy state just above the input row's opening `<div>` (`Chat.jsx:1594`, `<div style={{ padding: 12, display: 'flex', gap: 8, alignItems: 'flex-end' }}>`) — insert immediately before it:

```js
      {fileBusy && <div style={{ fontSize: 15, color: '#8A9BB8', padding: '10px 12px 0' }}>Reading your file…</div>}
      {fileErr && <div style={{ fontSize: 15, color: '#B23B3B', padding: '10px 12px 0' }}>{fileErr}</div>}
```

### 16. `src/components/Chat.jsx` — generalize the error fallback

Find (`Chat.jsx:809-817`):

```js
        let systemMsg = null
        if (res.status === 503) {
          const body = await res.json().catch(() => null)
          const m = body && body.error && body.error.message
          if (typeof m === 'string' && m.trim()) systemMsg = m.trim()
        }
        const fallback = res.status === 401
          ? 'Sign in first to talk with your coach.'
          : systemMsg || 'Sorry, something went wrong. Try again in a moment.'
```

Replace with:

```js
        let systemMsg = null
        if (res.status !== 401) {
          const body = await res.json().catch(() => null)
          const m = (body && body.error && body.error.message) || (body && typeof body.message === 'string' ? body.message : null)
          if (typeof m === 'string' && m.trim()) systemMsg = m.trim()
        }
        const fallback = res.status === 401
          ? 'Sign in first to talk with your coach.'
          : systemMsg || 'Sorry, something went wrong. Try again in a moment.'
```

This is what makes the "message too long" fix (change 2) actually reach the user instead of showing the same generic line Magnus saw — and, as a side effect, it also surfaces the 429 rate-limit endpoint's existing `message` field (`api/coach.js:2275`), which the client silently ignored before today.

## Voice rules on inserted text

Checked every new user-facing/model-facing string against CLAUDE.md section 3's banned constructions:

- `"That's too long for me to read in one message. Try sending it in a shorter chunk."` — plain, no logic-flip, no AI-coaching register, no comparative standing.
- `COACH_FILE_UPLOAD_KNOWLEDGE` — follows the exact "(this person has it; most accounts do not, so never imply it is generally available)" pattern already shipped in `correction-actions-knowledge.js` and `pipeline-capture-knowledge.js`; no typology labels, no slogan cadence, no rooms language.
- The amended `SYSTEM_PROMPT_HEAD` clause — plain instructional amendment, no banned constructions introduced.
- `"Could not read ${f.name}: ${err.message}"` — reuses the exact established error-string pattern from every other upload call site in `App.jsx` (e.g. `App.jsx:16718`), already shipped and voice-cleared.
- `"Attach a document (PDF, Word, or text)"` (button title) and `"Reading your file…"` — plain UI copy, no banned constructions.

## Static gates

- `npm run build` clean.
- `npm run test` clean, including `scripts/test-coach-rate-limit.mjs` (exercises the new `MAX_MESSAGE_BYTES` value symbolically — no test file changes needed) and `scripts/test-api-surface.mjs`.
- `check-voice` 0/0.
- `check-prompt-refs` 0.
- `check-coach-nav-map` clean (no change expected — `FEATURE_MAP`/`NAV_LABELS` untouched).
- `check-fontsize` ratchet not exceeded (new UI lives in `src/components/Chat.jsx`, which the gate scans; the attach button is icon-only with no `fontSize:`, and the two new inline messages are 15px, at the floor).
- `check-btn-prominence` ratchet not exceeded (the new attach button is a utility control, not a primary action, and uses no `<Btn small>` shape).
- `App.jsx` line count and EOF closure verified before AND after the edit (two separate regions removed, one import added).
- Diff scope limited to the six files named in "Files affected" plus the two new files.

## Runtime gate (post-merge, optional)

Bob or Cowork-Claude, on the Vercel preview or production after merge:

1. Grant `coach_file_upload` to a test account (or use an `@career.club` account, which auto-grants) via the admin dashboard.
2. Open My Coach on that account; confirm the paperclip control appears next to the message box (and does NOT appear for a non-flagged account).
3. Attach a `.docx`, then a `.pdf`, then a `.txt` file; confirm each one's text lands in the message box and sends successfully, and Coach's reply reflects the content.
4. Paste a plain-text block between 8,000 and 300,000 bytes directly into the box (no attachment) and confirm it now sends — this was the exact failure Magnus hit.
5. Construct a message over 300,000 bytes and confirm the chat shows the new friendly rejection line instead of the old generic "Sorry, something went wrong."
6. On a non-flagged account, ask Coach directly "can I send you a file?" and confirm it still says no and asks for pasted text (the un-amended default behavior).

## Constraints

Single PR. No effort estimates. PR title: `My Coach: raise the paste cap, add a gated document-attach control`.

## Out of scope

- **`.pptx` (PowerPoint) support.** Needs a new client-side zip/XML-parsing dependency that hasn't been picked or vetted; a separate brief once that choice is made.
- **Public user-guide chapter (`src/data/user-guide/my-coach.md`) and `FEATURE_MAP` updates.** Deferred to the pilot's GA, per CLAUDE.md's "pilot documentation is partitioned, not deferred" rule — writing this into the always-loaded guide now would describe a control most of the 145 accounts cannot see.
- **Auto-chunking or summarization for a message that still exceeds 300,000 bytes.** At this size, that's the abuse-guard case, not a UX case; a clear rejection is the right behavior, not a trimming fallback.
- **OCR for image-based or scanned attachments.** `extractText`'s existing graceful-degradation notice for image-based PDFs is unchanged and applies as-is; no new capability added here.
- **Any change to the admin dashboard's flag-granting UI beyond what reading `GRANTABLE_FLAGS` already renders automatically.**

## Commit message

```
My Coach: raise the paste cap, add a gated document-attach control

Pasting a long call transcript into My Coach failed with a generic
"something went wrong" error (reported live by a user) -- the 8000-byte
message cap was sized for a chat turn, not a document, and the client
never surfaced the real reason for the rejection. Raises the cap to
300,000 bytes (comfortably covers a multi-hour transcript, still a real
ceiling against abuse), makes the rejection message actually reach the
user, and adds a paperclip attach control (PDF/Word/text) behind a new
pilot flag, reusing the same client-side text-extraction path every
other upload in the app already uses.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01T2f5qXRCkZQJb9jg4w5WkZ
```

## Push

Branch, PR, `gh pr checks --watch`, squash-merge once green, per CLAUDE.md section 9. Vercel auto-deploys `main`. Because this touches `api/coach.js`, run the manual or CI preview smoke test (`/api/health`, `/api/claude`) before merging, per CLAUDE.md's Vercel runtime constraints section.

## Implementer's checklist

1. Pull latest `main`.
2. Re-verify every quoted anchor above against current code; stop and re-scope if any has drifted materially.
3. Apply changes 1-16 in order.
4. Run `npm run build`, `npm run test`, and the full static-gate suite listed above.
5. Manually smoke-test locally: sign in as an internal (`@career.club`) account, confirm the paperclip appears and works for at least one file type; sign in (or simulate) as a non-flagged account and confirm it does not appear and Coach still declines file uploads in prose.
6. Update `Output/docs/reimagine-system-documentation/` Chapter 11 changelog.
7. Commit with the message above, push to a new branch, open the PR, watch CI, squash-merge.
8. Run the preview smoke test against the `reimagine2` preview URL (copy the exact hostname from the Vercel bot's PR comment) before merging.
9. Report the PR URL and merge SHA.
