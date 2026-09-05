// Guards the Continue-defer fix (2026-09-04, reported live): nothing stopped
// a person from clicking Continue faster than Coach could react to what
// they just gave it, so the reaction always arrived on a LATER screen with
// no visible link back to what it was about to -- "Coach on the sideline
// waving his hands while she just keeps going." advance() now defers to
// doAdvance immediately unless coachThinkingCount>0, in which case the
// target is held (pendingAdvance) and released the instant the count
// returns to zero -- so Coach can never be outrun, and the overwhelming
// majority of Continue clicks (nothing in flight) are unaffected. Bundled:
// the orientation-check reaction now shows as the small banner card instead
// of force-opening the full panel, since holding Continue already keeps it
// in view -- forcing the panel open on top of that buys nothing.
// Source-level for the same reason its siblings are: this needs a real
// signed-in browser session to exercise end to end.
import fs from 'node:fs'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

const APP = 'src/App.jsx'
const app = fs.readFileSync(APP, 'utf8')

check(app.includes('const[pendingAdvance,setPendingAdvance]=useState(null)'),
  `${APP}: pendingAdvance state is missing`)
check(app.includes('const doAdvance=(from,to)=>{maybeInputStaleNudge(from,to);markDone(from);setStep(to);setErr(null);window.scrollTo(0,0)}'),
  `${APP}: doAdvance (the actual navigation, factored out of advance) is missing or changed shape`)

// advance() itself: immediate for the common case (nothing in flight),
// deferred otherwise. Both branches must route through doAdvance so there
// is exactly one navigation implementation.
const advanceIdx = app.indexOf('const advance=(from,to)=>{')
check(advanceIdx !== -1, `${APP}: advance() is missing`)
const advanceBlock = app.slice(advanceIdx, advanceIdx + 300)
check(advanceBlock.includes('if(coachThinkingCount>0){setPendingAdvance({from,to});return}'),
  `${APP}: advance() no longer defers to pendingAdvance when coachThinkingCount>0 -- Continue could outrun Coach again`)
check(advanceBlock.includes('doAdvance(from,to)'),
  `${APP}: advance() no longer falls through to doAdvance for the immediate (nothing in flight) case`)

// The release effect: keyed on coachThinkingCount itself (a real state
// change firing a real re-render), NOT a same-commit read of a sibling
// effect -- that shape is exactly the bug this session already removed
// once for narration ordering, see the comment above orientationCheckFields.
const releaseIdx = app.indexOf('if(coachThinkingCount>0||!pendingAdvance)return')
check(releaseIdx !== -1, `${APP}: the pendingAdvance release effect is missing`)
const releaseBlock = app.slice(releaseIdx, releaseIdx + 200)
check(releaseBlock.includes('setPendingAdvance(null)') && releaseBlock.includes('doAdvance(from,to)'),
  `${APP}: the release effect no longer clears pendingAdvance and fires doAdvance once coachThinkingCount returns to zero`)
check(app.includes('},[coachThinkingCount,pendingAdvance])'),
  `${APP}: the release effect is not keyed on [coachThinkingCount,pendingAdvance] -- it would not fire when the count actually changes`)

// The wait must be visible, not a silent dead click, and tied to
// pendingAdvance's own lifetime rather than a fixed timer (the wait is a
// live network call of variable length).
check(app.includes('{pendingAdvance&&<div data-print="hide" role="status"') && app.includes('Just a sec — Coach is still reacting to what you just added.'),
  `${APP}: the waiting indicator is missing or no longer tied directly to pendingAdvance`)

// The orientation-check reaction now shows as the banner card, not a forced
// full-panel open -- holding Continue already keeps the reaction in view,
// so force-opening on top of that is pure disruption with no benefit left.
check(app.includes("setChatMessages(m=>[...m,{role:'assistant',banner:true,content:reply}])"),
  `${APP}: the orientation-check reaction lost its banner:true flag -- it would force the full panel open again on top of the Continue hold`)
const replyPushIdx = app.indexOf("setChatMessages(m=>[...m,{role:'assistant',banner:true,content:reply}])")
check(replyPushIdx !== -1 && !app.slice(replyPushIdx, replyPushIdx + 80).includes('setPbCheckinOpenReq'),
  `${APP}: the orientation-check reaction still force-opens the panel right after pushing the banner message`)

if (failures) {
  console.error(`test-continue-waits-for-coach: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-continue-waits-for-coach: OK (advance() defers only while a reaction is genuinely in flight, release effect keyed on a real state change not a same-commit read, wait is visible and tied to the hold\'s own lifetime, reaction shown via the banner card instead of forcing the panel open)')
}
