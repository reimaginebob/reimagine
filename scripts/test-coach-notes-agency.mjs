// Guards the save-to-notes agency brief (2026-09-05): "let Coach save to
// notes on request, not on its own judgment." Bob's explicit correction to a
// judgment-based "offer this rarely" proposal -- Coach mentions the
// capability once, then only ever acts on an explicit ask, never a
// content-worthiness guess. Source-level: this needs a real signed-in
// browser session and a real model call to exercise end to end.
import fs from 'node:fs'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

const FLAGS = 'api/_lib/feature-flags.js'
const flags = fs.readFileSync(FLAGS, 'utf8')
check(flags.includes("export const COACH_NOTE_AGENCY_FLAG = 'coach_note_agency'"),
  `${FLAGS}: COACH_NOTE_AGENCY_FLAG is missing`)
check(/export function hasCoachNoteAgency\(user\) \{\s*if \(isInternalAccount\(user\)\) return true/.test(flags),
  `${FLAGS}: hasCoachNoteAgency is missing or does not auto-grant internal (@career.club) accounts`)
check(flags.includes('[COACH_NOTE_AGENCY_FLAG]: { label:'),
  `${FLAGS}: COACH_NOTE_AGENCY_FLAG is not listed in GRANTABLE_FLAGS`)

const COACH = 'api/coach.js'
const coach = fs.readFileSync(COACH, 'utf8')
check(coach.includes('hasCoachNoteAgency'),
  `${COACH}: hasCoachNoteAgency is not imported/used -- the capture note would never be gated correctly`)

// The capture note itself must be request-only, never a judgment call -- the
// exact thing Bob corrected. This is the one line worth pinning down: losing
// it silently reverts to "Coach decides which replies are worth keeping."
check(coach.includes('never because you judged the reply worth keeping on your own'),
  `${COACH}: COACH_NOTE_CAPTURE_NOTE no longer forbids Coach judging a reply worth saving on its own`)
check(coach.includes('COACHNOTE: save'),
  `${COACH}: the save-to-notes trailer format is missing from the capture note`)
check(coach.includes('${coachNoteAgencyNote}'),
  `${COACH}: coachNoteAgencyNote is computed but never spliced into the returned profile block`)

// The trailer parse: no JSON payload, since the content to save is the
// reply's own visible text -- a bare flag header is enough.
check(/const cnMatch = strippedText\.match\(\/\^\\s\*COACHNOTE:\\s\*save\\s\*\$\/im\)/.test(coach),
  `${COACH}: the COACHNOTE: save trailer is no longer parsed`)
check(coach.includes("res.setHeader('X-Coach-Note-Offer', '1')"),
  `${COACH}: the X-Coach-Note-Offer header is never set`)

const APP = 'src/App.jsx'
const app = fs.readFileSync(APP, 'utf8')

check(app.includes("signedInUser.feature_flags.includes('coach_note_agency')"),
  `${APP}: the client-side hasCoachNoteAgency mirror is missing`)

// The one-time disclosure: fires once ever (persisted, not per-opportunity),
// gated on an opportunity actually being in focus, and yields to the
// employment/search-intake prompts so at most one thing is said per open.
check(app.includes("const notesCapabilityMessage=()=>({role:'assistant',content:"),
  `${APP}: notesCapabilityMessage is missing`)
check(app.includes('const[seenNotesCapabilityMention,setSeenNotesCapabilityMention]=useState(false)'),
  `${APP}: seenNotesCapabilityMention state is missing`)
const disclosureEffectIdx = app.indexOf('if(!hasCoachNoteAgency)return')
check(disclosureEffectIdx !== -1, `${APP}: the disclosure trigger effect is missing`)
const disclosureEffectBlock = disclosureEffectIdx !== -1 ? app.slice(disclosureEffectIdx, disclosureEffectIdx + 500) : ''
check(disclosureEffectBlock.includes('if(!coachSaveTarget())return'),
  `${APP}: the disclosure no longer requires an opportunity to be in focus`)
check(disclosureEffectBlock.includes('if(employmentPromptFiredRef.current||searchIntakePromptFiredRef.current)return'),
  `${APP}: the disclosure no longer yields to the employment/search-intake prompts on the same open`)
check(disclosureEffectBlock.includes('setSeenNotesCapabilityMention(true)'),
  `${APP}: the disclosure never marks itself seen -- it would fire on every open`)

// Persistence: both hydration paths and the save blob must carry the flag,
// or it fires again after a reload/re-signin.
const hydrationCount = (app.match(/if\(d\.seenNotesCapabilityMention\)setSeenNotesCapabilityMention\(true\);/g) || []).length
check(hydrationCount === 2, `${APP}: expected seenNotesCapabilityMention hydration in both the localStorage and server-profile load paths, found ${hydrationCount}`)
check(app.includes('seenSearchIntakePrompt,seenNotesCapabilityMention,seenSupportAnnounce'),
  `${APP}: seenNotesCapabilityMention is not threaded into the debounced save blob`)

// The write branch: an explicit ask writes through the exact same path the
// manual "Save to this opportunity" button already uses -- no new write path.
const writeIdx = app.indexOf("if(checkinKey==='coach-note-save'){")
check(writeIdx !== -1, `${APP}: the coach-note-save write branch is missing`)
const writeBlock = writeIdx !== -1 ? app.slice(writeIdx, writeIdx + 200) : ''
check(writeBlock.includes('saveCoachNoteToOpportunity(value)'),
  `${APP}: coach-note-save does not write through saveCoachNoteToOpportunity, the existing save path`)

// Prop wiring: both Chat mounts must pass notesCaptureActive, gated on the
// flag AND an opportunity actually being open.
const notesCaptureActiveCount = (app.match(/notesCaptureActive=\{hasCoachNoteAgency&&!!coachSaveTarget\(\)\}/g) || []).length
check(notesCaptureActiveCount === 2, `${APP}: expected notesCaptureActive={hasCoachNoteAgency&&!!coachSaveTarget()} on both <Chat> mounts (floating + embedded), found ${notesCaptureActiveCount}`)

const CHAT = 'src/components/Chat.jsx'
const chat = fs.readFileSync(CHAT, 'utf8')
check(chat.includes('notesCaptureActive = false'),
  `${CHAT}: Chat no longer accepts a notesCaptureActive prop`)
check(chat.includes("const noteHeader = res.headers.get('X-Coach-Note-Offer') || null"),
  `${CHAT}: the X-Coach-Note-Offer header is no longer read`)
check(chat.includes('if (notesCaptureActive && noteHeader === \'1\' && fullText.trim())'),
  `${CHAT}: the post-stream save offer is no longer gated on notesCaptureActive and a real header`)
check(chat.includes("checkinKey: 'coach-note-save'") && chat.includes("{ label: 'Save it', value: fullText }"),
  `${CHAT}: the save offer no longer carries the reply's own text as the value to save`)

if (failures) {
  console.error(`test-coach-notes-agency: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-coach-notes-agency: OK (flag + GRANTABLE_FLAGS entry, request-only capture note, trailer parse, one-time disclosure with yield + persistence, write path reuses saveCoachNoteToOpportunity, client offer wired)')
}
