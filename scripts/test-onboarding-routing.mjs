// Guards the direct routing question (Coach-as-Concierge, item 1, slice 4,
// the final piece): Coach asks a flagged account directly whether something's
// already in motion on first arrival at twoDoors, and routes on the answer --
// replacing the two-card menu with a real question. Source-level for the
// same reason its siblings are.
import fs from 'node:fs'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

const APP = 'src/App.jsx'
const app = fs.readFileSync(APP, 'utf8')

check(/const\[seenOrientationRoute,setSeenOrientationRoute\]=useState\(false\)/.test(app),
  `${APP}: seenOrientationRoute useState declaration is missing`)

// The existing PB check-in must now explicitly exclude flagged accounts --
// this is what stops it colliding with the new routing question for an
// account whose brand predates the Personal Brand delivery moment (slice 3)
// ever pre-satisfying seenPbCheckin for it.
const pbCheckinIdx = app.indexOf("if(step!=='twoDoors'||!signedInUser)return")
check(pbCheckinIdx !== -1, `${APP}: could not find the existing Personal Brand check-in effect`)
const pbCheckinBlock = app.slice(Math.max(0, pbCheckinIdx - 60), pbCheckinIdx + 60)
check(pbCheckinBlock.includes('if(hasOnboardingConcierge)return'),
  `${APP}: the existing Personal Brand check-in no longer excludes onboarding_concierge accounts -- it could collide with the new routing question at twoDoors`)

// The trigger: fires at twoDoors, gated, once ever.
const routeIdx = app.indexOf("if(step!=='twoDoors')return\n    if(!(outputs&&outputs.p3))return\n    if(seenOrientationRoute")
check(routeIdx !== -1,
  `${APP}: the routing-question effect's guard sequence (step==='twoDoors', outputs.p3, dedupe) no longer matches expected shape`)
check(/if\(seenOrientationRoute\|\|orientationRouteFiredRef\.current\)return/.test(app),
  `${APP}: the routing-question effect lost its dedupe guard (flag + session ref)`)

// The two quick-reply values and their routing branch.
check(app.includes("{label:'Something\\'s already moving',value:'in_motion'") || app.includes("value:'in_motion'"),
  `${APP}: the "something's already moving" quick-reply option is missing`)
check(app.includes("value:'fresh'"),
  `${APP}: the "starting from scratch" quick-reply option is missing`)
check(app.includes("checkinKey==='orientation-route'"),
  `${APP}: the orientation-route dispatcher branch is missing from handleEmploymentQuickReply`)
const dispatchIdx = app.indexOf("checkinKey==='orientation-route'")
const dispatchBlock = app.slice(dispatchIdx, dispatchIdx + 300)
check(dispatchBlock.includes("markDone('twoDoors')") && dispatchBlock.includes('addNewOpportunity()'),
  `${APP}: the "in_motion" branch no longer routes to addNewOpportunity -- same action the Add an Opportunity card performs`)
check(dispatchBlock.includes("advance('twoDoors','laneSelect')"),
  `${APP}: the "fresh" branch no longer routes to laneSelect -- same action the Career Paths card performs`)

// Dedupe threading: both hydration paths and the autosave blob.
const hydrationHits = (app.match(/if\(d\.seenOrientationRoute\)setSeenOrientationRoute\(true\)/g) || []).length
check(hydrationHits === 2,
  `${APP}: expected seenOrientationRoute hydration in both the local pe_v4 path and the server profile/load path -- found ${hydrationHits}`)
const saveBlobIdx = app.indexOf('const blob=JSON.stringify(')
check(app.slice(saveBlobIdx, saveBlobIdx + 450).includes('seenOrientationRoute'),
  `${APP}: seenOrientationRoute is missing from the autosave blob's JSON.stringify -- the dedupe would never actually persist`)
const saveDepsIdx = app.indexOf('saveRef.current=save')
check(app.slice(saveDepsIdx, saveDepsIdx + 550).includes('seenOrientationRoute'),
  `${APP}: seenOrientationRoute is missing from the autosave effect's dependency array`)

if (failures) {
  console.error(`test-onboarding-routing: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-onboarding-routing: OK (existing PB check-in excludes flagged accounts, routing question correctly gated, both branches route to the same actions the twoDoors cards use, dedupe threaded through both hydration paths and the autosave blob)')
}
