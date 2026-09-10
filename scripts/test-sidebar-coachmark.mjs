// Batch item 10 (Output/handoff/2026-09-09_concierge-batch-and-phase4-brief.md,
// 2026-09-10 revision): "CoachMark on the sidebar's My Coach row. Same mark
// as the header pill so the two entrances share an identity. No other
// sidebar change." Two distinct renderings of the sidebar's My Coach entry
// exist depending on account stage -- the standalone pre-brand orientation-
// rail block (a custom, gold-tinted callout), and the generic post-brand
// primaryItems row (shared with every other "Your work" nav entry) -- both
// get the mark, since both are genuine entrances a person encounters.
import fs from 'node:fs'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

const APP = 'src/App.jsx'
const app = fs.readFileSync(APP, 'utf8')

check(app.includes('import CoachMark from "./components/CoachMark"'),
  `${APP}: CoachMark is not imported`)

// --- Pre-brand orientation-rail standalone block ---
const preIdx = app.indexOf("data-step=\"myCoach\" onClick={()=>onNav('myCoach')}")
check(preIdx !== -1, `${APP}: the pre-brand orientation-rail My Coach block is missing`)
const preBlock = preIdx !== -1 ? app.slice(preIdx, preIdx + 900) : ''
check(preBlock.includes('>My Coach<CoachMark C={C}/></div>'),
  `${APP}: the pre-brand My Coach row no longer carries CoachMark next to its title`)
check(preBlock.includes('Ask anything, anytime'),
  `${APP}: the pre-brand My Coach row's subtitle is missing or has drifted -- the block located may not be the right one`)

// --- Post-brand generic primaryItems row (shared renderer, myCoach-only) ---
const rowIdx = app.indexOf('primaryItems.flatMap(')
check(rowIdx !== -1, `${APP}: the primaryItems row renderer is missing`)
const rowBlock = rowIdx !== -1 ? app.slice(rowIdx, rowIdx + 900) : ''
check(rowBlock.includes("<span style={{flex:1,display:'flex',alignItems:'center',gap:6}}>{label}{id==='myCoach'&&<CoachMark C={C}/>}</span>"),
  `${APP}: the generic sidebar row no longer conditionally adds CoachMark for the myCoach id only`)
// "No other sidebar change": the mark must be scoped to id==='myCoach' --
// every other row (p3, positioning, pipeline, etc.) renders through this
// exact same code path and must not pick up the mark.
check(!rowBlock.includes("id==='p3'&&<CoachMark") && !rowBlock.includes("id==='pipeline'&&<CoachMark"),
  `${APP}: CoachMark leaked onto a sidebar row other than myCoach`)

if (failures) {
  console.error(`test-sidebar-coachmark: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-sidebar-coachmark: OK (both sidebar entrances to My Coach -- the pre-brand orientation-rail block and the post-brand generic primaryItems row -- carry the same CoachMark the header pill uses, scoped to the myCoach row only in the shared renderer, no other row touched)')
}
