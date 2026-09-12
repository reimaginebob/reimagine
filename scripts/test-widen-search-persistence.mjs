// Coach-as-Concierge Phase 4 Part 2 (Output/handoff/2026-09-09_concierge-
// batch-and-phase4-brief.md, §2.6): the widen-the-search engine's persisted
// shape in App.jsx -- widenSearchState travels the same three paths
// coachMoments already does (local pe_v4 hydration, server /api/profile/
// load hydration, and the stateForSave blob written back out), so a
// snooze or retirement set on one device holds on another. No catalog
// rows read or write it yet -- this PR is the persisted shape only.
import fs from 'node:fs'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

const APP = 'src/App.jsx'
const app = fs.readFileSync(APP, 'utf8')

check(app.includes("const[widenSearchState,setWidenSearchState]=useState({})"),
  `${APP}: the widenSearchState state declaration is missing or has drifted`)
check(app.includes('const widenSearchOfferedThisSessionRef=useRef((()=>{'),
  `${APP}: the session-only pacing ref is missing -- §2.6\'s "at most one unprompted offer per session" has nothing to key off`)
// sessionStorage-backed (production fix, 2026-09-12 live QA), not a bare
// useRef(false) -- a plain ref reset to false on every page load, so a
// reload restarted pacing from zero instead of surviving within the tab.
check(app.includes("sessionStorage.getItem('pe_widen_search_offered_session')==='true'"),
  `${APP}: the pacing ref no longer seeds itself from sessionStorage -- a reload would restart widen-the-search pacing from zero`)

// --- Local (pe_v4) hydration ---
const localHydrateIdx = app.indexOf("localStorage.removeItem('pe_v3');localStorage.removeItem('pe_v4')")
check(localHydrateIdx !== -1, `${APP}: could not locate the pe_v4 hydration effect to check against`)
const localHydrateBlock = localHydrateIdx !== -1 ? app.slice(localHydrateIdx, app.indexOf('setLocalHydrationDone(true)', localHydrateIdx) + 40) : ''
check(localHydrateBlock.includes("if(d.widenSearchState&&typeof d.widenSearchState==='object')setWidenSearchState(d.widenSearchState)"),
  `${APP}: local pe_v4 hydration does not restore widenSearchState`)
check(localHydrateBlock.indexOf("if(d.widenSearchState") > localHydrateBlock.indexOf("if(d.coachMoments"),
  `${APP}: widenSearchState restore should sit alongside coachMoments' own restore in the same hydration pass`)

// --- Server (/api/profile/load) hydration ---
const serverHydrateIdx = app.indexOf("fetch('/api/profile/load'")
check(serverHydrateIdx !== -1, `${APP}: could not locate the /api/profile/load hydration chain to check against`)
const serverHydrateBlock = serverHydrateIdx !== -1 ? app.slice(serverHydrateIdx, app.indexOf('didMigrate', serverHydrateIdx) + 200) : ''
check(serverHydrateBlock.includes("if(d.widenSearchState&&typeof d.widenSearchState==='object')setWidenSearchState(d.widenSearchState)"),
  `${APP}: server /api/profile/load hydration does not restore widenSearchState`)

// --- stateForSave: written back out alongside coachMoments ---
const saveIdx = app.indexOf('const stateForSave=')
check(saveIdx !== -1, `${APP}: could not locate stateForSave`)
const saveLine = saveIdx !== -1 ? app.slice(saveIdx, app.indexOf('\n', saveIdx)) : ''
check(saveLine.includes('coachMoments,widenSearchState,qualityCheckedFields'),
  `${APP}: stateForSave does not carry widenSearchState alongside coachMoments`)

if (failures) {
  console.error(`test-widen-search-persistence: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-widen-search-persistence: OK (widenSearchState is declared, restored from both pe_v4 and /api/profile/load, and written back out via stateForSave, mirroring coachMoments\' own cross-device sync)')
}
