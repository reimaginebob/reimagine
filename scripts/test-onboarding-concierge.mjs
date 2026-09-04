// Guards the onboarding_concierge pilot (Coach-as-Concierge, item 1, slice 1):
// the upfront framing message Coach opens with on a genuinely first-time
// user's arrival at 'welcome'. Source-level rather than a live-call test for
// the same reason test-coach-session-open.mjs is: this needs a real signed-in
// browser session to exercise end to end, and cannot be run here. This pins
// down the pieces a refactor could silently break: the flag exists and is
// gated correctly (both server and client), the trigger fires only on a
// genuinely first-time account (not the stale localStorage migration
// signal), and the dedupe flag is threaded through both hydration paths and
// the autosave blob -- losing any one of those three re-fires the message
// every session, or fires it for a returning user, both of which are the
// exact failure this file exists to catch.
import fs from 'node:fs'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

const FLAGS = 'api/_lib/feature-flags.js'
const flags = fs.readFileSync(FLAGS, 'utf8')

check(/export const ONBOARDING_CONCIERGE_FLAG = 'onboarding_concierge'/.test(flags),
  `${FLAGS}: ONBOARDING_CONCIERGE_FLAG is missing or its value changed`)
check(/export function hasOnboardingConcierge\(user\) \{\s*if \(isInternalAccount\(user\)\) return true/.test(flags),
  `${FLAGS}: hasOnboardingConcierge does not auto-grant internal accounts`)
check(!/ONBOARDING_CONCIERGE_FLAG\]:/.test(flags.slice(flags.indexOf('GRANTABLE_FLAGS'))),
  `${FLAGS}: onboarding_concierge was added to GRANTABLE_FLAGS -- the brief says @career.club only while this is built and reviewed, not yet open to named outside testers from the dashboard`)

const APP = 'src/App.jsx'
const app = fs.readFileSync(APP, 'utf8')

check(app.includes("hasOnboardingConcierge=(!!signedInUser&&/@career\\.club$/i.test(signedInUser.email||''))||(Array.isArray(signedInUser?.feature_flags)&&signedInUser.feature_flags.includes('onboarding_concierge'))"),
  `${APP}: the client-side hasOnboardingConcierge mirror is missing or no longer matches the server gate`)

// The trigger effect itself: must fire on 'welcome', must be gated on
// hasOnboardingConcierge, and must NOT fire for anyone with existing
// progress -- done.length or outputs.p3, not the unrelated hasProgress
// migration flag (which answers "did this browser have local work before
// signing up", a different and looser question).
check(/if\(step!=='welcome'\|\|!signedInUser\)return/.test(app),
  `${APP}: the framing effect no longer guards on step==='welcome'`)
check(/if\(!hasOnboardingConcierge\)return/.test(app),
  `${APP}: the framing effect lost its hasOnboardingConcierge gate`)
check(/if\(seenOnboardingFraming\|\|onboardingFramingFiredRef\.current\)return/.test(app),
  `${APP}: the framing effect lost its dedupe guard (flag + session ref)`)
check(/if\(done\.length>0\|\|\(outputs&&outputs\.p3\)\)return/.test(app),
  `${APP}: the framing effect no longer checks done.length/outputs.p3 for genuine first-time status`)

// Dedupe threading: the useState, both hydration paths, and the autosave
// blob (JSON.stringify call plus its effect's dependency array) all need to
// carry seenOnboardingFraming, or the "once" contract silently breaks on
// reload / cross-device / autosave.
check(/const\[seenOnboardingFraming,setSeenOnboardingFraming\]=useState\(false\)/.test(app),
  `${APP}: seenOnboardingFraming useState declaration is missing`)
const seenFieldSites = (app.match(/seenOnboardingFraming/g) || []).length
check(seenFieldSites >= 6,
  `${APP}: expected seenOnboardingFraming to appear at least 6 times (useState, both hydration paths, both places in the save effect, the trigger effect itself) -- found ${seenFieldSites}, one of the threading sites may have been dropped`)
check(/if\(d\.seenOnboardingFraming\)setSeenOnboardingFraming\(true\)/.test(app),
  `${APP}: at least one hydration path (local pe_v4 or server profile load) is missing the seenOnboardingFraming read-back`)
const hydrationHits = (app.match(/if\(d\.seenOnboardingFraming\)setSeenOnboardingFraming\(true\)/g) || []).length
check(hydrationHits === 2,
  `${APP}: expected seenOnboardingFraming hydration in both the local pe_v4 path and the server profile/load path -- found ${hydrationHits}`)
check(/seenMoveAnnounce,seenOnboardingFraming\}\)/.test(app),
  `${APP}: seenOnboardingFraming is missing from the autosave blob's JSON.stringify -- the flag would never actually persist`)
check(/seenMoveAnnounce,seenOnboardingFraming,signedInUser,serverLoadDone,isDemo,isTest\]\)/.test(app),
  `${APP}: seenOnboardingFraming is missing from the autosave effect's dependency array -- a change to it would not trigger a save`)

if (failures) {
  console.error(`test-onboarding-concierge: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-onboarding-concierge: OK (flag gated correctly, framing trigger fires only for genuine first-time accounts, dedupe threaded through both hydration paths and the autosave blob)')
}
