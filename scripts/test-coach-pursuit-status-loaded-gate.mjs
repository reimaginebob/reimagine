// Guards a race found while fixing Bob's read on Imerys/Lindsey (2026-09-10):
// op-playbook-arrival's copy names the one card that fits the record's
// STAGE, read from pursuitStatus -- a separate, genuinely async fetch
// (GET /api/pursuit-status) with no relationship to opRecord's own
// readiness. Arrival's dedupeValue is the fixed literal 'fired', so if it
// fired before that fetch settled, the stage-less copy it locked in would
// never correct itself (a real account could see "About This Company,
// Compensation... are built." with no "one card that fits the stage" line
// or tap, forever, if the fetch happened to be slow once).
//
// The fix (pursuitStatusLoaded) had its own bug on the first pass: setting
// it true in the `!hasPipeline` early-return stuck it true across the very
// render where hasPipeline flips true and the real fetch starts, letting
// arrival fire on stale (not-yet-loaded) pursuitStatus during that fetch --
// this is what scripts/test-coach-moments-op-side.mjs's six-built-card
// scenario caught intermittently (roughly 1 run in 3) before this file's
// checks below were written against the corrected shape.
import fs from 'node:fs'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } else { console.log(`  ok   ${msg}`) } }

const APP = 'src/App.jsx'
const app = fs.readFileSync(APP, 'utf8')

check(app.includes('const[pursuitStatusLoaded,setPursuitStatusLoaded]=useState(false)'),
  `${APP}: pursuitStatusLoaded state is missing`)

const effectIdx = app.indexOf('if(isDemo||isTest){setStoriesLoaded(true);setPursuitStatusLoaded(true);return}')
check(effectIdx !== -1, `${APP}: the My Search hydration effect no longer sets pursuitStatusLoaded true on the demo/test short-circuit`)
const effectBlock = effectIdx !== -1 ? app.slice(effectIdx, effectIdx + 1600) : ''

// The regression itself: the `!hasPipeline` branch must NOT set
// pursuitStatusLoaded true -- that early return fires on every render before
// sign-in resolves, including the one where hasPipeline is about to flip
// true and the real fetch is about to start; setting the flag there stuck it
// true across that transition.
check(effectBlock.includes('if(!hasPipeline)return') && !effectBlock.includes('if(!hasPipeline){setPursuitStatusLoaded(true);return}'),
  `${APP}: the !hasPipeline branch sets pursuitStatusLoaded true -- this is the exact race: it stays true across the render where the real pursuit-status fetch starts, so arrival can fire on stale/not-yet-loaded pursuitStatus`)

// The real fetch's own settlement is what may set it true.
check(effectBlock.includes(".finally(()=>setPursuitStatusLoaded(true))"),
  `${APP}: the /api/pursuit-status fetch no longer sets pursuitStatusLoaded true once it settles (success or failure)`)

// Wired into the Moments evaluator: ctx carries it, the dependency array
// re-runs the evaluator once it flips, and op-playbook-arrival's own
// eligible() actually waits on it.
check(app.includes(',viewedSection,opArrivalFired,opAutoBuildActive,opStageQuickReplies,pursuitStatusLoaded,hydrationStable}'),
  `${APP}: the evaluator's ctx no longer carries pursuitStatusLoaded`)
check(app.includes(',pursuitStatus,pursuitStatusLoaded,connNetwork,connManual,connSearch,activeSectionTick,hydrationStable])'),
  `${APP}: the evaluator effect's dependency array no longer includes pursuitStatusLoaded -- it would not re-run once the real fetch settles`)

const MOMENTS = 'src/coach-moments.js'
const moments = fs.readFileSync(MOMENTS, 'utf8')
// opAutoBuildActive added by F1 twenty-minute session item 2 (2026-09-11
// evening): a separate race (the auto-build sequence), not a replacement
// for the pursuitStatusLoaded gate this file is about.
check(moments.includes("eligible: (ctx) => !!ctx.hasOnboardingConcierge && !!ctx.opRecord && !!ctx.pursuitStatusLoaded && !ctx.opAutoBuildActive,"),
  `${MOMENTS}: op-playbook-arrival's eligible() no longer waits on pursuitStatusLoaded`)

if (failures) {
  console.error(`test-coach-pursuit-status-loaded-gate: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-coach-pursuit-status-loaded-gate: OK (pursuitStatusLoaded is not prematurely set true before the real pursuit-status fetch runs, is set once that fetch actually settles, and op-playbook-arrival waits on it before firing)')
}
