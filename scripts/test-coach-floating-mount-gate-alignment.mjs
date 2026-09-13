// Guards findings #2.6a and #2.6c from the 2026-09-07 My Coach diagnostic
// review -- client/server gate mismatches that silently drop Coach offers.
//
// #2.6a: the floating bubble mount did not pass activityCaptureActive, while
// the dedicated My Coach step's embedded mount did. The server emits
// ACTIVITY for any hasNextStep account on any surface, so activity offers
// only ever rendered on the one screen, never from the bubble a person
// actually has open on every other screen.
//
// #2.6c: the server gated OPPORTUNITYUPDATE, OPPORTUNITYCONTEXT,
// OPPORTUNITYARCHIVE, CLOSEREASON, and OPCARDREWORK on their pilot flags
// alone; the client additionally required !isIndependent at every mount's
// props. A flagged independent-track account had the model told it could
// make these offers, the model emitted the trailer believing it succeeded,
// and the client silently discarded it -- the model never learns the offer
// went nowhere. This finding is #4.8-shaped (a client restriction the
// server did not mirror), not a client bug: the client's exclusion is
// correct (My Pipeline concepts do not exist on the Go Independent track),
// so the fix is adding the same exclusion server-side, not removing it
// client-side.
//
// Pre-flight discovery: the review's own section 2.6 named a second gap (the
// concierge embedded mount passing none of the pipeline/close-reason/
// op-card/activity/session-open props) that this PR deliberately does NOT
// touch -- scoped out as a separate, larger change to that specific
// onboarding surface, not folded in here.
//
// Source-level: App.jsx's Chat mount sites and api/coach.js's note gating
// are both plain source text, not independently exercisable outside a
// browser/live request.
//
// Updated 2026-09-13 (One Coach consolidation): the dedicated My Coach
// step's own embedded mount (a third Chat mount, inside the now-retired
// case'myCoach') was retired -- the sidebar now opens the floating or
// concierge-embedded panel in place instead of navigating to a separate
// page. Two mounts remain: the floating bubble and the concierge-embedded
// panel. The "baseline that already had activityCaptureActive and should
// not have changed" check below now anchors on the concierge-embedded
// mount (the survivor) instead of the retired dedicated one.
import fs from 'node:fs'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

const APP = 'src/App.jsx'
const app = fs.readFileSync(APP, 'utf8')
const COACH = 'api/coach.js'
const coach = fs.readFileSync(COACH, 'utf8')

// --- #2.6a: floating bubble mount gains activityCaptureActive -------------

const mountStarts = [...app.matchAll(/<Chat (?:embedded )?currentStep=\{step\}/g)].map(m => m.index)
check(mountStarts.length === 2, `${APP}: expected exactly 2 Chat mount sites (the dedicated My Coach mount was retired 2026-09-13), found ${mountStarts.length} -- this test's assumptions about which mount is which need re-checking`)

// Identify the floating bubble mount specifically: it is the one NOT marked
// `embedded` and gated on `!conciergeEmbedded` just before the tag --
// distinct from the remaining embedded mount (the onboarding-concierge
// surface; the dedicated My Coach step's own embedded mount was retired).
const bubbleIdx = app.indexOf("!conciergeEmbedded&&<Chat currentStep={step}")
check(bubbleIdx !== -1, `${APP}: the floating bubble's mount (gated on !conciergeEmbedded) is missing or has changed shape`)
const bubbleEnd = bubbleIdx !== -1 ? app.indexOf('/>', bubbleIdx) : -1
const bubbleMount = bubbleIdx !== -1 && bubbleEnd !== -1 ? app.slice(bubbleIdx, bubbleEnd) : ''
check(bubbleMount.includes('activityCaptureActive={hasNextStep}'),
  `${APP}: the floating bubble mount still does not pass activityCaptureActive -- activity offers would only ever render on the concierge-embedded surface, never from the bubble open on every other screen`)

// The concierge-embedded mount already had it (this is the baseline the
// bubble was missing, not something this PR should touch).
const dedicatedIdx = app.indexOf('<Chat embedded currentStep={step} C={C} presence={coachPresence}')
check(dedicatedIdx !== -1, `${APP}: the concierge-embedded mount is missing or has changed shape`)
const dedicatedEnd = dedicatedIdx !== -1 ? app.indexOf('/>', dedicatedIdx) : -1
check(dedicatedIdx !== -1 && dedicatedEnd !== -1 && app.slice(dedicatedIdx, dedicatedEnd).includes('activityCaptureActive={hasNextStep}'),
  `${APP}: the concierge-embedded mount lost activityCaptureActive -- it was always correct and should not have changed`)

// --- #2.6c: server-side independent-track exclusion on the 5 pipeline notes

const gates = [
  ['opportunityUpdateNote', 'hasPipelineCapture', 'OPPORTUNITY_UPDATE_CAPTURE_NOTE'],
  ['opportunityContextNote', 'hasPipelineCapture', 'OPPORTUNITY_CONTEXT_CAPTURE_NOTE'],
  ['opportunityArchiveNote', 'hasPipelineCapture', 'OPPORTUNITY_ARCHIVE_CAPTURE_NOTE'],
  ['closeReasonNote', 'hasCloseReasonCapture', 'CLOSE_REASON_CAPTURE_NOTE'],
  ['opCardReworkNote', 'hasSectionRework', 'OP_CARD_REWORK_CAPTURE_NOTE'],
]
for (const [varName, flagFn, noteConst] of gates) {
  const re = new RegExp(`const ${varName} = ${flagFn}\\(\\{ feature_flags: featureFlags, email: userEmail \\}\\) && !independent \\? ${noteConst} : ''`)
  check(re.test(coach),
    `${COACH}: ${varName} is not gated on ${flagFn}(...) && !independent -- a flagged independent-track account would have the model emit this offer even though every client mount already discards it for that track`)
}

// The client-side exclusion these five notes now mirror -- confirms the
// premise (the client was already right; the server was the one under-gated)
// rather than this test asserting a fix against a moving target.
for (const prop of ['opportunityUpdateCaptureActive', 'opportunityContextCaptureActive', 'opportunityArchiveCaptureActive', 'closeReasonCaptureActive', 'opCardReworkCaptureActive']) {
  check(app.includes(`${prop}={hasPipeline&&!isIndependent&&has`) || app.includes(`${prop}={hasPipeline&&!isIndependent&&hasCloseReasonCapture}`) || app.includes(`${prop}={hasPipeline&&!isIndependent&&hasSectionRework}`),
    `${APP}: ${prop} no longer requires !isIndependent at the mount -- if the client's own restriction changed, the server-side #2.6c fix above needs to change with it`)
}

if (failures) {
  console.error(`test-coach-floating-mount-gate-alignment: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-coach-floating-mount-gate-alignment: OK (floating bubble mount now passes activityCaptureActive like the dedicated My Coach step already did, and all 5 My Pipeline capture notes are gated server-side on !independent to match the client\'s existing restriction)')
}
