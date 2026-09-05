## Prompt for Code

Apply the changes in this brief to `api/coach.js`, `api/_lib/feature-flags.js`, `src/App.jsx`, and `src/components/Chat.jsx`, premise-verify the anchors below against current `main`, run the static gates, add a source-level regression test, then follow the gh flow in section 9 of CLAUDE.md: push, open the PR, watch CI, squash-merge once green, and report the PR URL and merge SHA.

---

## Date / Type / Source

2026-09-05. Implementation brief, arising from a live design conversation with Bob about the existing, under-used "Save to this opportunity" button. Bob's explicit correction to my first proposal (a judgment-based "offer this rarely" instruction) is the actual spec: no judgment call anywhere. Coach tells the person once, early, that saving is available on request; after that, Coach honors an explicit ask every time. Never a content-worthiness guess.

## Pre-flight discovery (scope correction)

Verified against `main` at HEAD (post PR #733):

- **The save mechanism itself is fully built and needs no changes.** `saveCoachNoteToOpportunity(text, personName)` (`src/App.jsx:10036-10043`) already writes a `{id, text, source:'coach', personName, createdAt}` row onto the in-focus opportunity's `savedNotes`, which already renders at the bottom of that opportunity's card under "Notes" (`src/App.jsx:15512+` in the current file, labeled "From My Coach"). The existing manual button (`src/components/Chat.jsx:837-840`, `onClick={() => onSaveNote(m.content)}`) already calls this correctly. This brief adds a second, agency-driven way to reach the exact same write — it does not touch the write path.
- **The gap is entirely on the "does the person know this exists" side**, confirmed by the code's own comment on the Notes section (`src/App.jsx`, the block right above the render): the list "held only saved My Coach replies and hid itself when empty, so most people never learned it existed."
- **The one-tap contract this reuses is the exact pattern every other capture in `api/coach.js` already follows**: model ends its reply with a hidden trailer (e.g. `INTERVIEWTEAM: {...}`, `VALUESCAPTURE: {...}`), the server strips it and ships extracted data on a response header, the client turns the header into a one-tap offer, the tap is the only thing that writes (`api/coach.js:1539-1728` for the full parse-and-header pattern; `src/components/Chat.jsx:475-537` for the client read-and-offer pattern). This brief's new trailer needs no JSON payload at all — the content to save is simply the reply's own visible text, already in scope client-side as `fullText` at the point each existing offer is constructed, so the header can be a bare flag rather than a base64 JSON blob.
- **The recognition step genuinely needs the model's judgment, and that is fine** — it is the same category of judgment every other capture already relies on (recognizing that a person named an interviewer, or settled on a value, is natural-language understanding of something they explicitly said, not a content-worthiness guess). What Bob's correction rules out is Coach deciding *unprompted* that a given reply deserves an offer. Recognizing an explicit request ("save that," "keep this," "write that down") is the same kind of recognition INTERVIEWTEAM/VALUESCAPTURE already do, not the thing he corrected.
- **The one-time disclosure needs to be deterministic, not model-judged**, for the same reason every other one-time prompt in this file (`employmentPromptMessage`, `searchIntakeOpener`, `pipelineIntroCard`) is a scripted client-side message gated on a persisted boolean, never a "mention it if you judge the moment right" instruction to the model: a model has no reliable memory across a long conversation of what it already said, so a judgment-based mention could repeat, or never fire, or fire mid-thought. This brief follows the established pattern exactly rather than inventing a new one.
- **New pilot flag needed**, per CLAUDE.md §8 — this is a new user-facing behavior change (Coach speaks proactively, and a new voice command now writes), not a copy fix, so it ships behind its own flag rather than riding an existing one (matching `ONBOARDING_CONCIERGE_FLAG`'s own reasoning for being separate from `NEXT_STEP_FLAG`: two rollouts that should be independently toggleable). Auto-on for `@career.club` via the established `isInternalAccount` pattern, so Bob sees it on `bob+lindsey@career.club` with no dashboard step.

## Files affected

| File | Change |
|---|---|
| `api/_lib/feature-flags.js` | New `COACH_NOTE_AGENCY_FLAG` / `hasCoachNoteAgency`, added to `GRANTABLE_FLAGS` |
| `api/coach.js` | New `COACH_NOTE_CAPTURE_NOTE` (gated), new `COACHNOTE:` trailer parse → `X-Coach-Note-Offer` header |
| `src/App.jsx` | Client-side `hasCoachNoteAgency` mirror; new one-time disclosure message + trigger effect (persisted boolean, both hydration paths + save blob); new `checkinKey==='coach-note-save'` write branch calling the existing `saveCoachNoteToOpportunity` |
| `src/components/Chat.jsx` | New `notesCaptureActive` prop; read `X-Coach-Note-Offer`, offer a one-tap "Save it" / "Not now" on the reply that just streamed |
| `scripts/test-coach-notes-agency.mjs` | New regression test |

## Specific changes

**1. `api/_lib/feature-flags.js` — new flag**, following the exact `ONBOARDING_CONCIERGE_FLAG`/`hasOnboardingConcierge` pattern:
```js
// PILOT -- Save-to-notes agency, 2026-09-05. Coach mentions once, early, that
// anything worth keeping can be saved to the opportunity's notes on request,
// then honors that request whenever it is made -- never a judgment call
// about which reply earns an unprompted offer. A separate flag from the
// other pilots on this surface so it can be toggled independently.
export const COACH_NOTE_AGENCY_FLAG = 'coach_note_agency'

export function hasCoachNoteAgency(user) {
  if (isInternalAccount(user)) return true
  const flags = user && Array.isArray(user.feature_flags) ? user.feature_flags : []
  return flags.includes(COACH_NOTE_AGENCY_FLAG)
}
```
Add to `GRANTABLE_FLAGS`: `[COACH_NOTE_AGENCY_FLAG]: { label: 'Coach save-to-notes agency' },`

**2. `api/coach.js` — new capture note**, placed near `VALUES_CAPTURE_NOTE`:
```js
const COACH_NOTE_CAPTURE_NOTE = '\n\nSAVE-TO-NOTES CAPTURE: when this person asks you, in their own words, to save, keep, remember, or write down this reply or what you just covered to the opportunity\'s notes, end your reply with a final line exactly like COACHNOTE: save. Only emit it when they clearly asked for this themselves in this turn -- never because you judged the reply worth keeping on your own; that call is always theirs, not yours, and you make no exceptions for a reply that feels important. The app turns that line into a one-tap offer showing exactly what will be saved (this reply, in full) and never shows the line itself, so do not mention it, and never say you have already saved it -- their tap is the only thing that writes.'
```
Include it in `buildCoachProfileSlice`'s returned template, gated on the new flag: `const coachNoteAgencyNote = hasCoachNoteAgency({ feature_flags: featureFlags, email: userEmail }) ? COACH_NOTE_CAPTURE_NOTE : ''`, spliced in alongside the other capture notes.

**3. `api/coach.js` — trailer parse**, modeled exactly on the `ACTIVITY:` parse (`api/coach.js:1567-1580`), since this trailer carries no data (the content to save is the reply's own visible text, already the thing being sent):
```js
// Save-to-notes capture: the model may end with COACHNOTE: save when the
// person explicitly asked for this reply (or what was just covered) to be
// kept. No payload needed -- the content to save is this reply's own
// visible text, which the client already has once the stream completes.
let coachNoteOffer = false
const cnMatch = strippedText.match(/^\s*COACHNOTE:\s*save\s*$/im)
if (cnMatch) {
  strippedText = strippedText.replace(cnMatch[0], '').trim()
  coachNoteOffer = true
}
```
Set the header alongside the others: `if (coachNoteOffer) res.setHeader('X-Coach-Note-Offer', '1')`.

**4. `src/App.jsx` — client-side flag mirror**, alongside `hasOnboardingConcierge`/`hasPipelineBoard`:
```js
// PILOT -- Save-to-notes agency, 2026-09-05. Mirrors hasCoachNoteAgency in
// api/_lib/feature-flags.js; the server decides who gets the instruction,
// this only decides whether the client renders the disclosure and the offer.
const hasCoachNoteAgency=(!!signedInUser&&/@career\.club$/i.test(signedInUser.email||''))||(Array.isArray(signedInUser?.feature_flags)&&signedInUser.feature_flags.includes('coach_note_agency'))
```

**5. `src/App.jsx` — one-time disclosure**, following `searchIntakeOpener`'s exact shape (a standalone message, no quick replies) and `employmentPromptMessage`'s trigger-effect shape (once ever, persisted, gated on `coachOpenTick`, yielding to prompts that can share the same open):
```js
const notesCapabilityMessage=()=>({role:'assistant',content:"By the way — anytime something in here is worth keeping, just say so and I'll add it to this opportunity's notes so you can find it again.",checkinKey:'notes-capability-mention'})
```
New state `const[seenNotesCapabilityMention,setSeenNotesCapabilityMention]=useState(false)` and `const notesCapabilityFiredRef=useRef(false)`, alongside the other `seen*`/`*FiredRef` pairs. New effect, placed after the search-intake trigger effect:
```js
useEffect(()=>{
  if(isDemo||isTest)return
  if(!hasCoachNoteAgency)return
  if(!coachOpenTick)return
  if(seenNotesCapabilityMention||notesCapabilityFiredRef.current)return
  if(!coachSaveTarget())return
  // Yield to the employment/search-intake prompts when either just fired on
  // this same open -- one thing said per open, never three stacked.
  if(employmentPromptFiredRef.current||searchIntakePromptFiredRef.current)return
  notesCapabilityFiredRef.current=true
  setSeenNotesCapabilityMention(true)
  setChatMessages(m=>[...m,notesCapabilityMessage()])
},[coachOpenTick,hasCoachNoteAgency,seenNotesCapabilityMention,isDemo,isTest])
```
Persist `seenNotesCapabilityMention` exactly like `seenSearchIntakePrompt`: add `if(d.seenNotesCapabilityMention)setSeenNotesCapabilityMention(true)` to both hydration blocks (`src/App.jsx:8107` and `:8128`), and add `seenNotesCapabilityMention` to both the `JSON.stringify` save blob and its `useEffect` dependency array (`src/App.jsx:8564` and `:8587`).

**6. `src/App.jsx` — the write branch**, alongside the `checkinKey==='interview-team'` branch in `handleEmploymentQuickReply`:
```js
if(checkinKey==='coach-note-save'){
  if(value==='dismiss')return true
  const title=saveCoachNoteToOpportunity(value)
  return title?{content:`Saved to ${title}'s notes.`}:false
}
```

**7. `src/components/Chat.jsx` — read the header and offer the save**, alongside the other header reads (`src/components/Chat.jsx:475-481`) and the other post-stream offers (`:526-537`):
```js
const noteHeader = res.headers.get('X-Coach-Note-Offer') || null
```
and, after the stream completes (mirroring the interview-team offer's shape, using `fullText` directly as the value since there is no JSON to carry):
```js
// Save-to-notes: the server saw an explicit request to keep this reply and
// set X-Coach-Note-Offer. The content offered is this reply's own text --
// exactly what the manual "Save to this opportunity" button already saves.
if (notesCaptureActive && noteHeader === '1' && fullText.trim()) {
  setMessages(m => [...m, { role: 'assistant', content: 'Want me to add this to the opportunity\'s notes?', checkinKey: 'coach-note-save', quickReplies: [{ label: 'Save it', value: fullText, followUp: 'Saved.' }, { label: 'Not now', value: 'dismiss' }] }])
}
```
New prop `notesCaptureActive = false` added to the `Chat` component's destructured props (alongside `pipelineCaptureActive`), passed from both mounts in `src/App.jsx` as `notesCaptureActive={hasCoachNoteAgency&&!!coachSaveTarget()}`.

## Voice rules on inserted text

The disclosure line and the new capture note's prose are both new user-facing/Coach-facing text. The disclosure ("By the way — anytime something in here is worth keeping...") is plain, first-person, no AI-coaching register, no logic-flip cadence — run it through `check-voice`'s `HARD_PATTERNS` manually since it lands in `src/App.jsx` (already covered by the build-time gate) as literal string content. `api/coach.js`'s capture-note prose is instruction text Coach reads, not shipped UI copy, so it is outside `check-voice`'s `FILES_TO_CHECK` (consistent with every other capture note in this file) — reviewed by hand for the same register.

## Static gates

- `npm run build` clean (full prebuild chain, tests, lint, vite build)
- `check-voice`: 0/0
- `check-fontsize`, `check-btn-prominence`: unaffected
- `check-sys-equality`, `check-prompt-refs`, `check-coach-nav-map`: unaffected
- `src/App.jsx` EOF integrity preserved before and after
- Diff scope limited to the files named above

## Runtime gate (post-merge)

Bob can verify on `bob+lindsey@career.club`: open an opportunity, open Coach for the first time this account has ever had one in focus, confirm the disclosure line appears once (and never again on a later visit); have a real exchange, say "can you save that for me," confirm Coach offers a one-tap "Save it" / "Not now" rather than claiming to have saved it already; tap Save, confirm the note appears at the bottom of that opportunity's card labeled "From My Coach."

## Constraints

Single PR. No effort estimates. PR title: "Let Coach save to notes on request, not on its own judgment."

## Out of scope

No change to the existing manual "Save to this opportunity" button — it stays exactly as it is, as the always-available fallback for anything Coach does not catch. No change to `savedNotes`' data model or render. No repeated/counted disclosure (Bob's "first time or several early times" is implemented as a single, clear, one-time mention per account, matching the file's existing one-time-prompt convention exactly — flagged here rather than guessed past silently, since a literal repeated-N-times mention was the other reading available and would need new state this brief does not add).

## Commit message

```
Let Coach save to notes on request, not on its own judgment

The "Save to this opportunity" button already works but goes almost
entirely unused -- the Notes section's own code comment admits as much
("most people never learned it existed"). The fix is not Coach guessing
which replies are worth keeping (a judgment call with no way to verify it
got the frequency right); it's telling the person once that the option
exists, then honoring it whenever they ask. A new one-time disclosure
message fires the first time Coach opens with an opportunity in focus, and
a new SAVE-TO-NOTES capture note lets Coach recognize an explicit request
("save that", "keep this") and offer a one-tap save of its own reply --
reusing the exact write path and one-tap contract the manual button and
every other capture in this file already use.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Qbsj3ds9Cfozte1ASdRrDx
```

## Push

Branch off current `main`, PR, CI, squash-merge per section 9. Vercel auto-deploys from `main` on merge.

## Implementer's checklist

1. Pull `main`, confirm HEAD, re-grep the anchors above for drift.
2. Add `COACH_NOTE_AGENCY_FLAG`/`hasCoachNoteAgency` to `api/_lib/feature-flags.js` and `GRANTABLE_FLAGS`.
3. Add `COACH_NOTE_CAPTURE_NOTE` and the trailer parse to `api/coach.js`.
4. Add the client-side flag mirror, the disclosure message + trigger effect (both hydration paths, both save-blob sites), and the `coach-note-save` write branch to `src/App.jsx`.
5. Add the `notesCaptureActive` prop, header read, and post-stream offer to `src/components/Chat.jsx`; wire the prop at both `<Chat>` mounts in `src/App.jsx`.
6. Add the new test file.
7. Run `npm run build` (full gate chain); confirm clean.
8. Verify `App.jsx` EOF (line count + closing tag) before and after.
9. Commit, push, open PR, subscribe to activity, watch CI, squash-merge.
10. Report PR URL and merge SHA.
