// Guards Coach hand-holding in the resume builder (2026-09-13, Bob's
// concern that Coach says nothing to the person most likely to need it --
// someone building a resume from nothing). Two pieces:
//   1. An ORIENTATION_NARRATION arrival line for 'resume-builder' -- the one
//      orientation step that had never gotten one, despite already being a
//      valid step value and already listed in CONCIERGE_ORIENTATION_STEPS.
//      Zero engine change: it fires through the exact same one-time-per-step
//      mechanism every other orientation line already uses.
//   2. A new, standalone one-time invitation firing when the builder's first
//      draft finishes generating (profile.builder.phase becomes 'draft'),
//      built on the same seen*/ref/hydration/save pattern as the Values and
//      Life Events thinness prompts, but without their shared hub-arrival
//      yield chain -- this fires only inside the builder, a screen those
//      prompts never touch.
import fs from 'node:fs'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

const NARRATION = 'src/data/orientation-narration.js'
const narration = fs.readFileSync(NARRATION, 'utf8')
const APP = 'src/App.jsx'
const app = fs.readFileSync(APP, 'utf8')

// --- Arrival line ---
check(/'resume-builder':\s*'I\\'m right here while you build this out\./.test(narration),
  `${NARRATION}: the resume-builder arrival line is missing or has drifted`)
check(narration.includes("say so and I\\'ll turn it into resume language for you."),
  `${NARRATION}: the resume-builder arrival line no longer offers the talk-instead-of-type alternative`)

// CONCIERGE_ORIENTATION_STEPS already includes resume-builder (this brief's
// own premise -- confirming it wasn't quietly dropped elsewhere).
check(app.includes("CONCIERGE_ORIENTATION_STEPS=['welcome','orientation-intro','location','resume','resume-builder',"),
  `${APP}: resume-builder is no longer in CONCIERGE_ORIENTATION_STEPS -- the arrival line above would never fire in the embedded panel`)

// --- Draft-ready invitation: message function ---
const msgIdx = app.indexOf('const resumeBuilderDraftInviteMessage=')
check(msgIdx !== -1, `${APP}: resumeBuilderDraftInviteMessage is missing`)
const msgBlock = msgIdx !== -1 ? app.slice(msgIdx, msgIdx + 400) : ''
check(msgBlock.includes("checkinKey:'resume-builder-draft-invite'"),
  `${APP}: resumeBuilderDraftInviteMessage does not carry the resume-builder-draft-invite checkinKey`)
check(!msgBlock.includes('quickReplies'),
  `${APP}: resumeBuilderDraftInviteMessage grew quick replies -- this was scoped as a plain one-time invitation, not an accept/decline offer (no PROMPT_ENGAGEMENT_META_BY_CHECKIN entry exists for it, matching that)`)

// --- State + both hydration paths + autosave blob/deps ---
check(app.includes('const[seenResumeBuilderDraftInvite,setSeenResumeBuilderDraftInvite]=useState(false)'),
  `${APP}: seenResumeBuilderDraftInvite useState declaration is missing`)
check(app.includes('const resumeBuilderDraftInviteFiredRef=useRef(false)'),
  `${APP}: resumeBuilderDraftInviteFiredRef is missing`)
const hydrationHits = (app.match(/if\(d\.seenResumeBuilderDraftInvite\)setSeenResumeBuilderDraftInvite\(true\)/g) || []).length
check(hydrationHits === 2, `${APP}: expected seenResumeBuilderDraftInvite hydration in both hydration paths (local + server), found ${hydrationHits}`)
const saveBlobIdx = app.indexOf('const stateForSave={')
check(saveBlobIdx !== -1 && app.slice(saveBlobIdx, saveBlobIdx + 900).includes('seenResumeBuilderDraftInvite'),
  `${APP}: seenResumeBuilderDraftInvite is missing from the autosave blob's object literal`)
const saveDepsIdx = app.indexOf('saveRef.current=save')
check(saveDepsIdx !== -1 && app.slice(saveDepsIdx, saveDepsIdx + 900).includes('seenResumeBuilderDraftInvite'),
  `${APP}: seenResumeBuilderDraftInvite is missing from the autosave effect's dependency array`)

// --- The firing effect ---
const fireIdx = app.indexOf('resumeBuilderDraftInviteFiredRef.current=true')
check(fireIdx !== -1, `${APP}: the resume-builder-draft-invite firing effect is missing`)
const fireBlock = fireIdx !== -1 ? app.slice(fireIdx - 500, fireIdx + 400) : ''
check(fireBlock.includes('if(!hasOnboardingConcierge||!signedInUser)return'),
  `${APP}: resume-builder-draft-invite is not gated on hasOnboardingConcierge + signedInUser`)
check(fireBlock.includes("step!=='resume-builder'||!profile.builder||profile.builder.phase!=='draft'"),
  `${APP}: resume-builder-draft-invite is not scoped to the builder step with phase==='draft'`)
check(fireBlock.includes('if(!profile.baselineResume)return'),
  `${APP}: resume-builder-draft-invite does not require a real baseline draft to exist`)
check(fireBlock.includes('seenResumeBuilderDraftInvite||resumeBuilderDraftInviteFiredRef.current'),
  `${APP}: resume-builder-draft-invite's one-shot guard is missing or has drifted`)
check(fireBlock.includes("logPromptEngagement('resume_builder_draft_invite','hub_arrival','shown')"),
  `${APP}: resume-builder-draft-invite does not log its own 'shown' event`)
check(fireBlock.includes('setChatMessages(m=>[...m,resumeBuilderDraftInviteMessage()])'),
  `${APP}: resume-builder-draft-invite does not push its message onto chatMessages`)

// Deliberately standalone -- no yield chain to the hub_arrival prompts
// (employment/search-intake/pbCheckin/notes/close-reason/life-events/values),
// since this fires only inside the builder, a screen none of those touch.
check(!fireBlock.includes('employmentPromptFiredRef') && !fireBlock.includes('searchIntakePromptFiredRef') && !fireBlock.includes('pbCheckinFiredRef'),
  `${APP}: resume-builder-draft-invite picked up the hub_arrival yield chain -- this was scoped as a standalone effect since it never competes with those prompts' landing screens`)

// --- Prompt-engagement code registered (server validates against this) ---
const CODES = 'src/coach-prompt-codes.js'
const codes = fs.readFileSync(CODES, 'utf8')
check(codes.includes("'resume_builder_draft_invite',"),
  `${CODES}: NON_CATALOG_PROMPT_CODES is missing 'resume_builder_draft_invite' -- logPromptEngagement's 'shown' call would 400 server-side (api/coach-prompt-engagement.js validates promptCode against this bounded list) and the telemetry would silently never record`)

// No PROMPT_ENGAGEMENT_META_BY_CHECKIN entry is needed or expected: that
// table is only consulted on a quick-reply TAP (handleEmploymentQuickReply),
// and this message carries no quickReplies to tap.
check(!app.includes("'resume-builder-draft-invite':{code:"),
  `${APP}: an unnecessary PROMPT_ENGAGEMENT_META_BY_CHECKIN entry was added for resume-builder-draft-invite -- it has no quick-reply tap to dispatch, so none is needed`)

if (failures) {
  console.error(`test-resume-builder-coach-handholding: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-resume-builder-coach-handholding: OK (resume-builder arrival line present via the existing narration mechanism with no engine change; the draft-ready invitation is a standalone one-shot effect -- gated on concierge + a real baseline draft, wired through both hydration paths and the autosave blob/deps, logging its own bounded prompt code -- deliberately without the hub_arrival yield chain those other prompts share)')
}
