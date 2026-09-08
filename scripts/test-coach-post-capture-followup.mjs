// Guards the opportunity-update split-turn redesign (2026-09-06). Live
// testing on the newly-merged capture mechanism (PR #744/#747) surfaced a
// UX problem, not a correctness one: the model's reply carrying the
// OPPORTUNITYUPDATE trailer also carried full interview-prep coaching in
// the same breath, and the one-tap confirmation card rendered last, below
// all of it. A person's thumb goes to the easy, visibly-finished action
// (tap the card) before the harder one (engage with the coaching), so the
// coaching got skipped past by the tactical housework sitting right next
// to it.
//
// Fixed by splitting into two turns: the capture-note reply is now
// instructed to stay short and purely tactical, and a genuine second Coach
// turn -- not a canned string -- fires the moment the tap's write succeeds,
// picking up the coaching that the first reply deliberately withheld.
// Source-level, like its sibling Coach tests: this needs a real signed-in
// session and a real model call to exercise end to end.
import fs from 'node:fs'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

const COACH = 'api/coach.js'
const coach = fs.readFileSync(COACH, 'utf8')

// The capture-note reply itself must be told to stay short and defer coaching.
check(coach.includes('keep the REPLY that carries it short'),
  `${COACH}: OPPORTUNITY_UPDATE_CAPTURE_NOTE no longer tells the model to keep its reply short when it emits the trailer`)
check(coach.includes('Do NOT give interview prep, coaching, or next-step advice in this same reply'),
  `${COACH}: OPPORTUNITY_UPDATE_CAPTURE_NOTE no longer withholds coaching from the capture-carrying reply`)

// The post-capture follow-up turn: request shape, authoritative re-gate,
// and the message builder that tells the model what just landed.
check(coach.includes('postCaptureUpdate'),
  `${COACH}: the postCaptureUpdate request field is missing`)
check(/const postCaptureUpdateShapeOk = !!\(postCaptureUpdate/.test(coach),
  `${COACH}: postCaptureUpdate has no shape validation`)
check(/const postCaptureUpdateRequested = postCaptureUpdateShapeOk && !generalMode && hasPipelineCapture/.test(coach),
  `${COACH}: postCaptureUpdate is not authoritatively re-gated on hasPipelineCapture -- the client's own say-so would be trusted alone, unlike every sibling silent-turn flag on this endpoint`)
check(coach.includes('postCaptureUpdateRequested ? buildPostCaptureTurnText(postCaptureUpdate)'),
  `${COACH}: the message computation does not route to buildPostCaptureTurnText when a post-capture follow-up is authoritatively requested`)
check(/function buildPostCaptureTurnText\(data\) \{/.test(coach),
  `${COACH}: buildPostCaptureTurnText is missing`)
check(coach.includes('do not restate, re-describe, or re-confirm what was just captured'),
  `${COACH}: buildPostCaptureTurnText does not tell the model to avoid repeating what the tap's own recap already showed`)

const CHAT = 'src/components/Chat.jsx'
const chat = fs.readFileSync(CHAT, 'utf8')

// send() must accept the new option and route it to the request body without
// disturbing the existing silent (session-open) path.
check(/const send = async \(explicit, \{ silent = false, postCaptureUpdate = null \} = \{\}\) =>/.test(chat),
  `${CHAT}: send() lost its postCaptureUpdate option`)
check(chat.includes('const isSilentTurn = silent || !!postCaptureUpdate'),
  `${CHAT}: send() does not treat a postCaptureUpdate turn as silent (no user bubble, placeholder only pushed once a real response is in hand)`)
check(chat.includes('...(postCaptureUpdate ? { postCaptureUpdate } : (silent ? { sessionOpen: true } : { message: userMsg.content }))'),
  `${CHAT}: the request body does not send postCaptureUpdate when present`)

// The tap handler: fires the follow-up only on a genuine successful
// opportunity-update save, using the exact payload the tap itself carried,
// never on dismiss or on an unrelated checkinKey.
const tapIdx = chat.indexOf("if (handled && typeof handled === 'object' && handled.content) {")
check(tapIdx !== -1, `${CHAT}: the quick-reply success branch in tapQuickReply is missing`)
const tapBlock = tapIdx !== -1 ? chat.slice(tapIdx, tapIdx + 1200) : ''
check(tapBlock.includes("checkinKey === 'opportunity-update'"),
  `${CHAT}: tapQuickReply does not scope the post-capture follow-up to the opportunity-update checkinKey`)
check(tapBlock.includes('JSON.parse(opt.value)') && tapBlock.includes('sendRef.current(null, { postCaptureUpdate: capturedData })'),
  `${CHAT}: tapQuickReply does not trigger the post-capture follow-up with the tap's own captured data`)

if (failures) {
  console.error(`test-coach-post-capture-followup: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-coach-post-capture-followup: OK (capture reply stays short, post-capture follow-up gated and wired end to end, tap triggers it with the confirmed payload)')
}
