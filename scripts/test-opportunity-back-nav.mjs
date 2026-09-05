// Guards the opportunity/focus-playbook "Back to X" link (2026-09-05,
// reported live: opening an opportunity from My Pipeline showed "Back to Put
// It to Work" -- the link was hardcoded to hubStep/hubLabel regardless of
// where the person actually came from). Source-level: this needs a real
// signed-in browser session with real navigation history to exercise end to
// end.
import fs from 'node:fs'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

const APP = 'src/App.jsx'
const app = fs.readFileSync(APP, 'utf8')

check(app.includes('const opReturnStepRef=useRef(null)'),
  `${APP}: opReturnStepRef is missing`)

// restoreFromSavedSlot is the one chokepoint every entry into a saved
// record (role or opportunity) already routes through, so the capture has
// to live there rather than at each individual call site.
const restoreIdx = app.indexOf('const restoreFromSavedSlot=(rec)=>{')
check(restoreIdx !== -1, `${APP}: restoreFromSavedSlot is missing`)
const restoreBlock = restoreIdx !== -1 ? app.slice(restoreIdx, restoreIdx + 200) : ''
check(restoreBlock.includes("if(step!=='op'&&step!=='focus')opReturnStepRef.current=step"),
  `${APP}: restoreFromSavedSlot no longer captures the real origin step (guarded against overwriting it with 'op'/'focus' when switching records while already inside one)`)

// Both the Focus Playbook (door1/role) and Opportunity Playbook (door2)
// "Back to X" links must read the captured origin, falling back to the
// hub only when nothing was captured.
const backLinkCount = (app.match(/onClick=\{\(\)=>nav\(opReturnStepRef\.current\|\|hubStep\)\}/g) || []).length
check(backLinkCount === 2, `${APP}: expected the origin-aware back-link onClick on both the Focus Playbook and Opportunity Playbook headers, found ${backLinkCount}`)
const backLabelCount = (app.match(/Back to \{NAV_LABELS\[opReturnStepRef\.current\]\|\|hubLabel\}/g) || []).length
check(backLabelCount === 2, `${APP}: expected the origin-aware back-link label on both headers, found ${backLabelCount}`)

// The p4 (Career Paths lane view) back-links are deliberately untouched --
// that screen is only ever reached via the hub (pick a lane), never via a
// saved-record restore, so hubStep/hubLabel there is already correct. Matches
// the literal "Back to {hubLabel}" text specifically (not just any
// nav(hubStep) call -- a different, unrelated hub-entry button elsewhere
// uses the same onClick target for a different purpose).
const p4BackLinkCount = (app.match(/Back to \{hubLabel\}/g) || []).length
check(p4BackLinkCount === 2, `${APP}: expected exactly the two untouched p4 back-links still reading "Back to {hubLabel}", found ${p4BackLinkCount} -- did a p4 site get changed, or did an opportunity/focus site not get fixed?`)

if (failures) {
  console.error(`test-opportunity-back-nav: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-opportunity-back-nav: OK (origin step captured in restoreFromSavedSlot, both Focus/Opportunity Playbook back-links origin-aware, p4\'s hub-only back-links untouched)')
}
