// Production fix (Bob live-test finding, 2026-09-12): the Moments evaluator
// already picks only one candidate per pass, but nothing stopped the VERY
// NEXT pass from picking a second, unrelated one the instant the first
// candidate's own async fetch (if any) settled -- with no requirement that
// the person had actually responded to what Coach just said. Reproduced
// live: career-paths-intro and the Industry Insider ecosystem hint landed
// back to back off one "yes", each carrying its own dismiss buttons.
//
// Fix: hold any new unprompted moment until the most recently fired one
// (identified by its checkinKey starting 'moment:') has been followed by a
// real, non-synthetic user message. Source-level test, same reasoning as
// the other Moments-evaluator tests in this suite -- this needs a real
// signed-in browser session with live chat state to exercise end to end.
import fs from 'node:fs'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

const APP = 'src/App.jsx'
const app = fs.readFileSync(APP, 'utf8')

const gateIdx = app.indexOf('if(momentInFlightRef.current)return')
const secondGateIdx = gateIdx === -1 ? -1 : app.indexOf('if(momentInFlightRef.current)return', gateIdx + 1)
check(gateIdx !== -1 && secondGateIdx === -1,
  `${APP}: expected exactly one 'if(momentInFlightRef.current)return' gate in the evaluator -- found none or more than one`)

const pickedIdx = app.indexOf('const{entry,subKey,dedupeValue}=picked')
check(gateIdx !== -1 && pickedIdx !== -1 && gateIdx < pickedIdx,
  `${APP}: could not locate the turn-pacing gate between the in-flight guard and the picked-candidate destructure`)

const gateBlock = (gateIdx !== -1 && pickedIdx !== -1) ? app.slice(gateIdx, pickedIdx) : ''

// The gate scans for the LAST catalog-fired message (checkinKey starting
// 'moment:') and requires a real, non-synthetic user message after it.
check(gateBlock.includes("mm.checkinKey.startsWith('moment:')"),
  `${APP}: the turn-pacing gate does not scope itself to catalog fires (checkinKey starting 'moment:') -- it would also gate on freeform Coach replies, which are already one-per-turn by construction`)
check(gateBlock.includes("mm.role==='user'&&!mm.synthetic"),
  `${APP}: the turn-pacing gate does not require a REAL (non-synthetic) user message -- a quick-reply tap (synthetic:true) would incorrectly satisfy it`)
check(gateBlock.includes('lastMomentIdx!==-1'),
  `${APP}: the turn-pacing gate does not guard the no-prior-moment-yet case -- it would incorrectly block the very first moment of a session`)

// The gate must run AFTER the in-flight guard (so it doesn't fire while a
// generated moment's own fetch is still resolving) and BEFORE the picked
// candidate is committed.
check(app.indexOf('if(momentInFlightRef.current)return') < app.indexOf('lastMomentIdx'),
  `${APP}: the turn-pacing gate must be checked after the in-flight guard, not before`)
check(app.indexOf('lastMomentIdx') < pickedIdx,
  `${APP}: the turn-pacing gate must be checked before the picked candidate is committed`)

// chatMessages is now read inside this effect, so it must be a dependency --
// otherwise the gate would use a stale closure and never see a just-sent
// reply that should release the hold.
check(app.includes(',activeSectionTick,hydrationStable,chatMessages])'),
  `${APP}: chatMessages is read by the turn-pacing gate but missing from the evaluator effect's dependency array -- the gate would use a stale closure`)

// Out of scope per the brief: candidate selection (sort by priority, take
// candidates[0]) and per-entry dedupe are untouched by this change.
check(app.includes('candidates.sort((a,b)=>(b.entry.priority||0)-(a.entry.priority||0))'),
  `${APP}: the priority-sort single-candidate selection was touched -- this brief only adds a pacing hold in front of it`)

if (failures) {
  console.error(`test-coach-moments-turn-pacing: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-coach-moments-turn-pacing: OK (the evaluator now holds any new unprompted catalog moment until the most recently fired one has been followed by a real, non-synthetic user message; freeform Coach replies carry no checkinKey and are unaffected; candidate selection and per-entry dedupe are untouched)')
}
