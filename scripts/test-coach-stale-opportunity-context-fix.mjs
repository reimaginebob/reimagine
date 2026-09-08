// Guards finding #4.5 from the 2026-09-07 My Coach diagnostic review:
// currentSavedSlotIdRef was never cleared by nav(), so the floating bubble
// and the My Coach panel (both read coachSaveTarget(), which filters
// source==='door2') kept treating the last-opened opportunity as still in
// focus from any other screen -- focusRecordId stayed pinned to it,
// pursuitCaptureActive/notesCaptureActive stayed true, and pursuit-stage/
// close-reason/opportunity-update/opportunity-context/coach-note-save all
// fell back to writing to that stale record. Separately, the pursuit-stage
// offer named coachSaveTarget().title at render time but re-resolved
// coachSaveTarget() again at tap time, so opening a different opportunity
// between the offer and the tap wrote the stage to the wrong record.
//
// Source-level for the same reason its siblings are: App.jsx cannot be
// imported and exercised outside a live browser session.
import fs from 'node:fs'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

const APP = 'src/App.jsx'
const app = fs.readFileSync(APP, 'utf8')

// nav() clears currentSavedSlotIdRef, but ONLY when the ref currently
// resolves to a door2 (opportunity) record AND the destination is neither
// 'op' nor 'myCoach' -- not a step allowlist, and not unconditional. A step
// allowlist or an unconditional clear would both risk corrupting door1
// (Career Paths / Focus Playbook) slot tracking, which shares this same ref
// across many role-building screens (p3, laneSelect, p4, focus, income).
const navIdx = app.indexOf("const nav=(to)=>{")
check(navIdx !== -1, `${APP}: nav() is missing`)
const navBlock = navIdx !== -1 ? app.slice(navIdx, navIdx + 400) : ''
check(navBlock.includes("_navSlot.source==='door2'&&to!=='op'&&to!=='myCoach'"),
  `${APP}: nav() no longer clears currentSavedSlotIdRef gated on door2 + destination not op/myCoach`)
check(navBlock.includes('currentSavedSlotIdRef.current=null'),
  `${APP}: nav() no longer actually nulls currentSavedSlotIdRef when the condition is met`)
// Gated on source, not a step list: this string must NOT appear as part of
// nav's own clearing logic (it's fine elsewhere in the file for unrelated
// reasons, so scope the check to the nav() block specifically).
check(!navBlock.includes("to!=='p3'"),
  `${APP}: nav() appears to gate the clear on a step allowlist instead of the ref's current source -- this risks clearing a live door1 slot on an unenumerated role-building step`)

// pursuit-stage: the offer's value now carries targetId (JSON), the same
// pattern opportunity-update already used, instead of a bare stage string
// resolved again via coachSaveTarget() at tap time.
check(app.includes('const pursuitStageQuickReplies=(targetId)=>PURSUIT_STAGES.map(s=>({label:s.label,value:JSON.stringify({stage:s.value,targetId})'),
  `${APP}: the pursuit-stage quick replies no longer carry targetId in their value`)
check(app.includes("const pursuitOfferMessage=(title,targetId)=>({role:'assistant'"),
  `${APP}: pursuitOfferMessage no longer accepts a targetId parameter`)
// 3, not 2, since Phase 1b (2026-09-08) gave the concierge embedded mount
// the same capture props the other two mounts already carried.
check((app.match(/pursuitOfferMessage\(coachSaveTarget\(\)\.title,coachSaveTarget\(\)\.id\)/g) || []).length === 3,
  `${APP}: expected all 3 Chat mounts to pass coachSaveTarget().id into pursuitOfferMessage -- the offer must be built with the target that was actually in focus when it was shown`)

// The tap handler reads targetId from the parsed payload and writes to it
// directly -- it must NOT call coachSaveTarget() again to resolve where to
// write, which is exactly the race this finding describes (a different
// opportunity could be open by the time the tap lands).
const pursuitTapIdx = app.indexOf("if(checkinKey==='pursuit-stage'){")
check(pursuitTapIdx !== -1, `${APP}: the pursuit-stage tap handler is missing`)
const pursuitTapBlock = pursuitTapIdx !== -1 ? app.slice(pursuitTapIdx, pursuitTapIdx + 500) : ''
check(pursuitTapBlock.includes('JSON.parse(value)') && pursuitTapBlock.includes('payload&&payload.targetId') && pursuitTapBlock.includes('savePursuit(targetId,patch)'),
  `${APP}: the pursuit-stage tap handler no longer writes to the targetId carried in the tap's own payload`)
check(!pursuitTapBlock.includes('coachSaveTarget()'),
  `${APP}: the pursuit-stage tap handler still re-resolves coachSaveTarget() at tap time -- this is the exact race finding #4.5 describes (a different opportunity could be open by the time the tap lands)`)

if (failures) {
  console.error(`test-coach-stale-opportunity-context-fix: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-coach-stale-opportunity-context-fix: OK (nav() clears currentSavedSlotIdRef only for a stale door2 target leaving op/myCoach, door1 slot tracking untouched, pursuit-stage carries its target id in the offer payload instead of re-resolving coachSaveTarget() at tap time)')
}
