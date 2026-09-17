// Guards Coach hand-holding in the resume builder. Three pieces, the third
// two v3 revisions of the second (2026-09-13):
//   1. An ORIENTATION_NARRATION arrival line for 'resume-builder' -- the one
//      orientation step that had never gotten one, despite already being a
//      valid step value and already listed in CONCIERGE_ORIENTATION_STEPS.
//      Zero engine change: it fires through the exact same one-time-per-step
//      mechanism every other orientation line already uses.
//   2. A standalone one-time invitation firing when the builder's first
//      draft finishes generating (profile.builder.phase becomes 'draft'),
//      built on the same seen*/ref/hydration/save pattern as the Values and
//      Life Events thinness prompts, but without their shared hub-arrival
//      yield chain -- this fires only inside the builder, a screen those
//      prompts never touch. v3 (this revision) replaced the generic static
//      invitation with a real, role-specific model call reasoning over the
//      first role's actual title/company/bullets -- the same reasoning the
//      builder's own "need ideas?"/"add a number?" links already produce,
//      spoken as Coach. The static message now survives only as the
//      call-failure fallback.
//   3. A situational note (api/coach.js) giving Coach live visibility into
//      the builder's in-progress roles, so a later on-request "do that for
//      my second job too" has real data to reason from instead of nothing --
//      reactive only, never repeating the first-role walkthrough unprompted.
import fs from 'node:fs'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

const NARRATION = 'src/data/orientation-narration.js'
const narration = fs.readFileSync(NARRATION, 'utf8')
const APP = 'src/App.jsx'
const app = fs.readFileSync(APP, 'utf8')
const COACH = 'api/coach.js'
const coach = fs.readFileSync(COACH, 'utf8')

// --- Arrival line ---
check(/'resume-builder':\s*'I\\'m right here while you build this out\./.test(narration),
  `${NARRATION}: the resume-builder arrival line is missing or has drifted`)
check(narration.includes("say so and I\\'ll turn it into resume language for you."),
  `${NARRATION}: the resume-builder arrival line no longer offers the talk-instead-of-type alternative`)

// CONCIERGE_ORIENTATION_STEPS already includes resume-builder (this brief's
// own premise -- confirming it wasn't quietly dropped elsewhere).
check(app.includes("CONCIERGE_ORIENTATION_STEPS=['welcome','orientation-intro','location','resume','resume-builder',"),
  `${APP}: resume-builder is no longer in CONCIERGE_ORIENTATION_STEPS -- the arrival line above would never fire in the embedded panel`)

// --- Draft-ready invitation: fallback message function (unchanged shape,
// now used only when the model call below fails) ---
const msgIdx = app.indexOf('const resumeBuilderDraftInviteMessage=')
check(msgIdx !== -1, `${APP}: resumeBuilderDraftInviteMessage is missing`)
const msgBlock = msgIdx !== -1 ? app.slice(msgIdx, msgIdx + 400) : ''
check(msgBlock.includes("checkinKey:'resume-builder-draft-invite'"),
  `${APP}: resumeBuilderDraftInviteMessage does not carry the resume-builder-draft-invite checkinKey`)
check(!msgBlock.includes('quickReplies'),
  `${APP}: resumeBuilderDraftInviteMessage grew quick replies -- this was scoped as a plain one-time invitation, not an accept/decline offer (no PROMPT_ENGAGEMENT_META_BY_CHECKIN entry exists for it, matching that)`)

// --- State + both hydration paths + autosave blob/deps (untouched by v3) ---
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
const fireBlock = fireIdx !== -1 ? app.slice(fireIdx - 500, fireIdx + 1200) : ''
check(fireBlock.includes('if(!hasOnboardingConcierge||!signedInUser)return'),
  `${APP}: resume-builder-draft-invite is not gated on hasOnboardingConcierge + signedInUser`)
check(fireBlock.includes("step!=='resume-builder'||!profile.builder||profile.builder.phase!=='draft'"),
  `${APP}: resume-builder-draft-invite is not scoped to the builder step with phase==='draft'`)
// v3: requires an actual first role to reason over, not just any baseline
// draft object -- a draft with an empty experience array would have nothing
// for the walkthrough prompt below to describe.
check(fireBlock.includes('if(!profile.baselineResume||!(profile.baselineResume.experience&&profile.baselineResume.experience[0]))return'),
  `${APP}: resume-builder-draft-invite does not require a real first role (baselineResume.experience[0]) to exist`)
check(fireBlock.includes('seenResumeBuilderDraftInvite||resumeBuilderDraftInviteFiredRef.current'),
  `${APP}: resume-builder-draft-invite's one-shot guard is missing or has drifted`)
check(fireBlock.includes("logPromptEngagement('resume_builder_draft_invite','hub_arrival','shown')"),
  `${APP}: resume-builder-draft-invite does not log its own 'shown' event`)

// v3: the model call replacing the static push. Reads the first role's
// title/company/bullets straight off the just-generated baseline draft,
// calls the new BUILDER_FIRST_ROLE_WALKTHROUGH prompt through the same
// voice-gated path the builder's own nudge/say-more calls use, and keeps
// the checkinKey stable so hydration/save/logging above needed no changes.
check(fireBlock.includes('const role=profile.baselineResume.experience[0]'),
  `${APP}: resume-builder-draft-invite no longer reads the first role off the baseline draft`)
check(fireBlock.includes('P.BUILDER_FIRST_ROLE_WALKTHROUGH(title,role.company||\'\',bullets)'),
  `${APP}: resume-builder-draft-invite no longer calls P.BUILDER_FIRST_ROLE_WALKTHROUGH with the first role's title/company/bullets`)
check(fireBlock.includes("step:'builder-first-role-walkthrough'"),
  `${APP}: the walkthrough call is not tagged with its own step for telemetry/voice-gate scoping`)
check(fireBlock.includes("checkinKey:'resume-builder-draft-invite'") && fireBlock.indexOf("checkinKey:'resume-builder-draft-invite'") > fireBlock.indexOf('BUILDER_FIRST_ROLE_WALKTHROUGH'),
  `${APP}: the model-generated message no longer carries the resume-builder-draft-invite checkinKey`)
check(fireBlock.includes('}catch{') && fireBlock.includes('setChatMessages(m=>[...m,resumeBuilderDraftInviteMessage()])') &&
  fireBlock.indexOf('setChatMessages(m=>[...m,resumeBuilderDraftInviteMessage()])') > fireBlock.indexOf('}catch{'),
  `${APP}: resume-builder-draft-invite lost its fallback to the static message when the model call fails`)

// Deliberately standalone -- no yield chain to the hub_arrival prompts
// (employment/search-intake/pbCheckin/notes/close-reason/life-events/values),
// since this fires only inside the builder, a screen none of those touch.
check(!fireBlock.includes('employmentPromptFiredRef') && !fireBlock.includes('searchIntakePromptFiredRef') && !fireBlock.includes('pbCheckinFiredRef'),
  `${APP}: resume-builder-draft-invite picked up the hub_arrival yield chain -- this was scoped as a standalone effect since it never competes with those prompts' landing screens`)

// --- The new prompt builder itself ---
const walkthroughIdx = app.indexOf('BUILDER_FIRST_ROLE_WALKTHROUGH:(title,companyContext,bullets)=>')
check(walkthroughIdx !== -1, `${APP}: P.BUILDER_FIRST_ROLE_WALKTHROUGH is missing from the P object`)
const walkthroughBlock = walkthroughIdx !== -1 ? app.slice(walkthroughIdx, walkthroughIdx + 1600) : ''
check(walkthroughBlock.includes('Do not invent specifics about this person'),
  `${APP}: BUILDER_FIRST_ROLE_WALKTHROUGH dropped its no-fabrication guardrail`)
check(walkthroughBlock.includes('walk through this same thing for any other company'),
  `${APP}: BUILDER_FIRST_ROLE_WALKTHROUGH no longer closes by inviting the same help on any other role -- this is the line the on-request help note (api/coach.js) depends on being true`)
check(walkthroughBlock.includes('Do not mention that this is an automated check'),
  `${APP}: BUILDER_FIRST_ROLE_WALKTHROUGH lost its instruction against meta-narrating itself`)

// --- computeSituation: live builderRoles summary (getter pattern, per
// CLAUDE.md's Situation rule -- read at the moment of use via getSituation,
// never memoized at render time; PR #838/#841 fixed this bug class once) ---
const situationIdx = app.indexOf('const computeSituation=()=>{')
check(situationIdx !== -1, `${APP}: computeSituation is missing`)
const situationBlock = situationIdx !== -1 ? app.slice(situationIdx, situationIdx + 1200) : ''
check(situationBlock.includes("step==='resume-builder'&&profile.builder&&profile.builder.phase==='draft'&&profile.baselineResume&&Array.isArray(profile.baselineResume.experience)"),
  `${APP}: computeSituation's builderRoles gate is missing or has drifted`)
check(situationBlock.includes('bulletsMissingNumbers:Array.isArray(r.bullets)?r.bullets.filter(b=>!/\\d/.test(String(b||\'\'))).length:0'),
  `${APP}: computeSituation no longer counts bullets missing a number per role`)
check(situationBlock.includes("return{screen:step,record,section:activeSectionRef.current||null,builderRoles,lane:selectedLane||null,ecosystemCategory:(step==='p4'&&selectedLane==='insider'&&hasIndustryEcosystemView&&ecosystem.expanded)||null}"),
  `${APP}: computeSituation no longer returns builderRoles alongside screen/record/section`)

// --- api/coach.js: the on-request help note ---
check(coach.includes('const RESUME_BUILDER_HELP_NOTE ='),
  `${COACH}: RESUME_BUILDER_HELP_NOTE is missing`)
check(coach.includes('Do not repeat the first-role walkthrough unprompted; only do this when they ask.'),
  `${COACH}: RESUME_BUILDER_HELP_NOTE dropped the reactive-only instruction -- Bob explicitly rejected repeating the walkthrough per role unprompted as nagging`)
const noteWireIdx = coach.indexOf("currentStep === 'resume-builder'")
check(noteWireIdx !== -1, `${COACH}: RESUME_BUILDER_HELP_NOTE is not wired into buildCoachRequest`)
const noteWireBlock = noteWireIdx !== -1 ? coach.slice(noteWireIdx, noteWireIdx + 900) : ''
check(noteWireBlock.includes('situation.builderRoles') && noteWireBlock.includes('hasOnboardingConcierge('),
  `${COACH}: the resume-builder help note is not gated on both situation.builderRoles and hasOnboardingConcierge`)
check(noteWireBlock.includes("RESUME_BUILDER_HELP_NOTE.replace('{builderRolesSummary}'"),
  `${COACH}: the resume-builder help note's {builderRolesSummary} placeholder is not being interpolated from situation.builderRoles`)

// --- Prompt-engagement code registered (server validates against this;
// unchanged by v3 -- the checkinKey/log call are the same as PR #922) ---
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
  console.log('test-resume-builder-coach-handholding: OK (resume-builder arrival line present via the existing narration mechanism with no engine change; the draft-ready invitation now calls a real, role-specific walkthrough prompt over the first role\'s actual title/company/bullets -- falling back to the static message on failure -- gated on concierge + a real first role, wired through both hydration paths and the autosave blob/deps, logging its own bounded prompt code; Coach also gets a live, gated situational note so an on-request "do that for my other role" has real data to answer with, without ever repeating the walkthrough unprompted)')
}
