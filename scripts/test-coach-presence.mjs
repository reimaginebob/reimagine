// Coach-as-Concierge Phase 1b (Output/handoff/2026-09-08_coach-concierge-
// phase-1b-presence.md): widens the desktop embedded panel from onboarding-
// only to every screen after Welcome, and gives it a minimize affordance it
// did not have before (previously all-or-nothing: full size or not
// rendered). Two states only -- open, minimized -- deliberately NOT three:
// "quiet" and the two dismissal affordances that would set it are held for
// Phase 2, alongside the Moments engine that gives them something to do.
// Mobile is untouched -- the floating Chat's existing bottom sheet already
// covers every non-onboarding screen and needed no changes.
//
// App.jsx and Chat.jsx are JSX, not importable by plain Node, so this is
// source-presence plus a pure re-derivation of the widened gate's logic.
import fs from 'node:fs'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

const APP = 'src/App.jsx'
const app = fs.readFileSync(APP, 'utf8')
const CHAT = 'src/components/Chat.jsx'
const chat = fs.readFileSync(CHAT, 'utf8')
const FLAGS = 'api/_lib/feature-flags.js'
const flags = fs.readFileSync(FLAGS, 'utf8')

// --- Pure re-derivation of the widened conciergeEmbedded gate ---
function resolveConciergeEmbedded({ isMobile, isDemo, isTest, signedIn, hasCoachPresence, hasOnboardingConcierge, step, onboardingSteps }) {
  if (isMobile || isDemo || isTest || !signedIn) return false
  if (hasCoachPresence) return step !== 'welcome' && step !== 'myCoach'
  return hasOnboardingConcierge && onboardingSteps.includes(step)
}
const ONBOARDING_STEPS = ['welcome', 'orientation-intro', 'location', 'resume', 'resume-builder', 'linkedin', 'assessment', 'values', 'priorities', 'reputation', 'fit', 'life-events', 'skills', 'orientation-done', 'p3']
const base = { isMobile: false, isDemo: false, isTest: false, signedIn: true, onboardingSteps: ONBOARDING_STEPS }

check(resolveConciergeEmbedded({ ...base, hasCoachPresence: false, hasOnboardingConcierge: true, step: 'p3' }) === true,
  'a non-flagged (coach_presence) account must keep exactly today\'s onboarding-only behavior')
check(resolveConciergeEmbedded({ ...base, hasCoachPresence: false, hasOnboardingConcierge: true, step: 'op' }) === false,
  'a non-flagged account must NOT get the panel on a non-onboarding step -- that would be an unannounced behavior change for everyone still on the old flag')
check(resolveConciergeEmbedded({ ...base, hasCoachPresence: true, hasOnboardingConcierge: false, step: 'op' }) === true,
  'a coach_presence-flagged account must get the panel on a non-onboarding step (Opportunity Playbook) EVEN WITHOUT onboarding_concierge -- presence and onboarding narration are orthogonal flags')
check(resolveConciergeEmbedded({ ...base, hasCoachPresence: true, hasOnboardingConcierge: false, step: 'welcome' }) === false,
  'Welcome must stay excluded even for a flagged account -- it has no Coach panel treatment at all')
check(resolveConciergeEmbedded({ ...base, hasCoachPresence: true, hasOnboardingConcierge: false, step: 'myCoach' }) === false,
  'myCoach must stay excluded -- it is the dedicated full-page view, not the sidebar panel')
check(resolveConciergeEmbedded({ ...base, hasCoachPresence: true, isMobile: true, step: 'op' }) === false,
  'mobile must stay excluded regardless of the flag -- Phase 1b makes no mobile changes, the floating bottom sheet already covers this')

// --- Source-presence: the fix is actually wired the way the logic above assumes ---
check(flags.includes("export const COACH_PRESENCE_FLAG = 'coach_presence'"), `${FLAGS}: COACH_PRESENCE_FLAG is missing`)
check(flags.includes('export function hasCoachPresence(user) {'), `${FLAGS}: hasCoachPresence is missing`)
check(flags.includes("[COACH_PRESENCE_FLAG]: { label: 'Coach presence (embedded panel beyond onboarding)' },"), `${FLAGS}: GRANTABLE_FLAGS entry is missing`)

check(app.includes("const hasCoachPresence=(!!signedInUser&&/@career\\.club$/i.test(signedInUser.email||''))||(Array.isArray(signedInUser?.feature_flags)&&signedInUser.feature_flags.includes('coach_presence'))"),
  `${APP}: client-side hasCoachPresence mirror is missing or has drifted`)
check(app.includes("const conciergeEmbedded=!isMobile&&!isDemo&&!isTest&&!!signedInUser&&(hasCoachPresence?(step!=='welcome'&&step!=='myCoach'):(hasOnboardingConcierge&&CONCIERGE_ORIENTATION_STEPS.includes(step)))"),
  `${APP}: conciergeEmbedded's widened gate is missing or has drifted from the re-derived logic above`)
check(app.includes("const[coachPresence,setCoachPresence]=useState('open')"), `${APP}: coachPresence state is missing`)
check(!app.includes("useState('quiet')") && !/coachPresence['"]?\s*[:=]\s*['"]quiet['"]/.test(app),
  `${APP}: a 'quiet' value must not appear -- nothing can set it yet (Phase 2), so it must stay absent rather than a dead state`)
check(app.includes('presence={coachPresence} setPresence={setCoachPresence}'), `${APP}: the embedded <Chat> mount is not wired to coachPresence/setCoachPresence`)
check(app.includes('coachSaveTarget={coachSaveTarget()} onSaveNote={saveCoachNoteToOpportunity}') && app.includes('opportunityUpdateCaptureActive={hasPipeline&&!isIndependent&&hasPipelineCapture}'),
  `${APP}: the embedded mount must carry the same capture props the floating mount does now that it also covers Opportunity Playbook / My Pipeline screens -- omitting them would silently drop working Coach capabilities on those screens`)

check(chat.includes("presence = 'open', setPresence = null, onSaveNote,"), `${CHAT}: presence/setPresence props are missing from Chat's destructure`)
check(chat.includes("if (embedded && setPresence && presence === 'minimized') {"), `${CHAT}: the minimized-state branch is missing`)
check(chat.includes("onClick={() => setPresence('open')}"), `${CHAT}: the collapsed strip's tap-to-reopen handler is missing`)
check(chat.includes("onClick={() => setPresence('minimized')}"), `${CHAT}: the minimize button is missing`)
check(!chat.includes("'not on this screen'") && !/I'?m good for now/i.test(chat),
  `${CHAT}: the dismissal-affordance copy must NOT appear yet -- both affordances are held for Phase 2`)

if (failures) {
  console.error(`test-coach-presence: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-coach-presence: OK (embedded panel now reaches every desktop screen after Welcome for a flagged account, carries the same capture props the floating mount does, gained a minimize affordance it never had, and stayed a two-state model with no dead "quiet" state or inert dismiss UI)')
}
