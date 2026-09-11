// Guards the onboarding_concierge pilot (Coach-as-Concierge, item 1, slice 1):
// the upfront framing message Coach opens with on a genuinely first-time
// user's arrival at 'welcome'. Source-level rather than a live-call test for
// the same reason test-coach-session-open.mjs is: this needs a real signed-in
// browser session to exercise end to end, and cannot be run here.
//
// Rewritten for Phase 4 §2.3 (Output/handoff/2026-09-09_concierge-batch-
// and-phase4-brief.md): the standalone hand-wired effect this test used to
// pin down (seenOnboardingFraming/onboardingFramingFiredRef, a dedicated
// useEffect firing framingMsg directly) is retired. The same trigger now
// lives as the 'coach-intro' row in MOMENT_CATALOG (src/coach-moments.js),
// fired through the shared Moments evaluator (src/App.jsx) -- dedupe rides
// coachMoments like every other catalog entry, not a standalone seen*/ref
// pair. This still pins down the three things that mattered before: the
// flag is gated correctly (server and client, unchanged), the entry fires
// only for a genuinely first-time account (done.length===0 && !outputs.p3,
// not the unrelated hasProgress migration signal), and the evaluator
// actually delivers it the way onboarding intends -- as the small banner
// card next to the closed bubble, replacing the untouched seed rather than
// stacking a second "hello" under it.
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

// The old hand-wired mechanism must actually be gone, not just superseded --
// a leftover copy firing alongside the new catalog row would double the
// message.
check(!/seenOnboardingFraming/.test(app.replace(/\/\/.*$/gm, '')),
  `${APP}: seenOnboardingFraming still appears in live code -- the old hand-wired effect (or its dedupe threading) was not fully removed`)

const MOMENTS = 'src/coach-moments.js'
const moments = fs.readFileSync(MOMENTS, 'utf8')

const introIdx = moments.indexOf("key: 'coach-intro'")
check(introIdx !== -1, `${MOMENTS}: the 'coach-intro' catalog entry (Row A) is missing`)
const introBlock = introIdx !== -1 ? moments.slice(introIdx, introIdx + 2000) : ''

check(introBlock.includes("screen: 'welcome'"), `${MOMENTS}: coach-intro is not scoped to the 'welcome' screen`)
check(introBlock.includes("dismissible: false"), `${MOMENTS}: coach-intro should not be dismissible -- a "Remind me later" on meeting your coach for the first time makes no sense`)
check(introBlock.includes('banner: true'), `${MOMENTS}: coach-intro lost the banner delivery (small card next to the closed bubble, not the full panel)`)
check(introBlock.includes('replaceIfOnlySeed: true'), `${MOMENTS}: coach-intro lost replaceIfOnlySeed -- it would stack under the untouched "Hi, I'm your coach" seed instead of replacing it`)
// Genuine first-time gate, carried over unchanged from the retired effect.
check(introBlock.includes('ctx.done.length === 0 && !(ctx.outputs && ctx.outputs.p3)'),
  `${MOMENTS}: coach-intro's eligibility no longer checks done.length===0 && !outputs.p3 for genuine first-time status`)
check(introBlock.includes('!!ctx.hasOnboardingConcierge'), `${MOMENTS}: coach-intro lost its hasOnboardingConcierge gate`)
// Only APPROVED copy ships -- the brief's DRAFT closing line ("Ready?
// We'll start with where you are right now.") must not appear as the
// entry's actual message text; the already-shipped, already-approved
// closer is reused instead. Checked against the message value itself
// (introBlock), not the whole file, so a comment citing the DRAFT line by
// name (to explain why it was not used) cannot trip this check.
check(!introBlock.includes("Ready? We"),
  `${MOMENTS}: coach-intro shipped the brief's DRAFT closing sentence -- CLAUDE.md's copy rule requires Bob's sign-off first`)
check(introBlock.includes("Let\\'s start with where you are right now."),
  `${MOMENTS}: coach-intro dropped the approved closing sentence (and its tap) entirely`)
check(introBlock.includes("value: 'coach-intro-go'"), `${MOMENTS}: coach-intro's [Let's go] tap is missing`)
check(introBlock.includes("ctx.advance('welcome', ctx.isIndependent ? 'orientation-intro' : 'location')"),
  `${MOMENTS}: coach-intro's onTap no longer advances to the right next step for both tracks`)

// Evaluator support: banner/replaceIfOnlySeed and the ctx fields coach-intro
// needs (done, isIndependent) must actually be wired, not just declared on
// the catalog entry with nothing reading them.
check(/const ctx=\{hasOnboardingConcierge,outputs,step,signedInUser,selectedLane,chosen,isIndependent,done,/.test(app),
  `${APP}: the evaluator's ctx object no longer carries done (coach-intro's eligibility needs it)`)
check(app.includes('if(entry&&entry.onTap)return entry.onTap(value,{markDone,addNewOpportunity,advance,genSec,isIndependent,'),
  `${APP}: the generic moment tap dispatcher no longer passes isIndependent (coach-intro's onTap needs it for the track-conditional advance)`)
check(app.includes('entry.banner?{banner:true}:{}'), `${APP}: the evaluator's static-firing branch lost banner passthrough`)
check(app.includes('entry.replaceIfOnlySeed'), `${APP}: the evaluator's static-firing branch lost replaceIfOnlySeed support`)
check(app.includes('m[0].content===INTRO_MSG.content)?[newEntryMsg]:[...m,newEntryMsg]'),
  `${APP}: the evaluator's replace-on-seed logic no longer matches the untouched INTRO_MSG seed correctly`)

if (failures) {
  console.error(`test-onboarding-concierge: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-onboarding-concierge: OK (flag gated correctly; the old hand-wired effect is gone; coach-intro fires only for genuine first-time accounts, delivered as a replacing banner card with only approved copy, and the evaluator actually carries the ctx fields and generic banner/replace support the entry depends on)')
}
