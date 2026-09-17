// Production fix (2026-09-12 live QA on bob+lindsey@career.club): the
// Moments evaluator had no guard stopping it from running against
// coachMoments' un-hydrated useState({}) default. On mount, this effect and
// the two coachMoments-restoring effects (local pe_v4, then the server
// /api/profile/load chain) all read from the SAME initial render's closure,
// so a pass here could fire against empty state before either hydration
// effect's setCoachMoments call had been applied -- and since both
// hydration effects REPLACE coachMoments wholesale rather than merging,
// that pre-hydration pass's own dedupe write was silently discarded the
// moment real hydration landed. A reload repeated the same race from the
// same empty starting point every time. Reported live as a widen-the-search
// offer (and, separately, an op-opportunity-read one) firing again --
// sometimes verbatim -- on a reload with no taps in between.
import fs from 'node:fs'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

const APP = 'src/App.jsx'
const app = fs.readFileSync(APP, 'utf8')

const evaluatorIdx = app.indexOf('// Coach-as-Concierge Phase 2a/2b: the Moments evaluator')
check(evaluatorIdx !== -1, `${APP}: could not locate the Moments evaluator effect`)
const evaluatorBlock = evaluatorIdx !== -1 ? app.slice(evaluatorIdx, app.indexOf('if(coachDistressHold)return', evaluatorIdx) + 30) : ''

check(evaluatorBlock.includes('if(!hydrationStable)return'),
  `${APP}: the Moments evaluator has no global hydrationStable gate -- a pass can still fire against un-hydrated coachMoments, the root cause of the reload duplicate`)
check(evaluatorBlock.indexOf('if(!hydrationStable)return') < evaluatorBlock.indexOf('if(coachDistressHold)return'),
  `${APP}: the hydration gate must run before the distress-hold check (and everything after it), not after -- it has to be the first real gate once isDemo/isTest/signedInUser are ruled out`)
check(evaluatorBlock.indexOf('if(!hydrationStable)return') > evaluatorBlock.indexOf("if(!signedInUser)return"),
  `${APP}: the hydration gate should come after the isDemo/isTest/signedInUser short-circuits, not before them`)

// hydrationStable must already be a dependency of this effect, or the gate
// would never re-evaluate once hydration actually completes. chatMessages
// was added after it (2026-09-12, turn-pacing gate) so the array now ends
// with both.
check(app.includes(',activeSectionTick,hydrationStable,chatMessages])'),
  `${APP}: the evaluator's dependency array no longer ends with hydrationStable,chatMessages -- the gate would use a stale closure value`)

if (failures) {
  console.error(`test-coach-moments-hydration-gate: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-coach-moments-hydration-gate: OK (the Moments evaluator now bails out until hydrationStable, ahead of the distress hold, stopping every catalog entry -- not just one -- from ever being evaluated against un-hydrated coachMoments)')
}
