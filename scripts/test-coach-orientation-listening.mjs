// Guards Orientation Listening Mode (2026-09-07, live QA): caught mid-
// orientation when a reply to something close to "which of these am I weak
// in for interviews" gave a brief redirect then pivoted, in the same reply,
// to an unrelated Life Story question -- Coach filling the vacuum left by
// six capture notes all riding in the prompt at once with nothing telling it
// to hold back. This is the counterweight instruction: reflect and stay with
// what a person raises before redirecting, capturing, or moving on.
import fs from 'node:fs'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

const COACH = 'api/coach.js'
const coach = fs.readFileSync(COACH, 'utf8')

check(coach.includes('const ORIENTATION_LISTENING_NOTE ='),
  `${COACH}: ORIENTATION_LISTENING_NOTE is missing`)
check(coach.includes('reflect it back and stay with it before you redirect, caveat, or pivot to anything else'),
  `${COACH}: ORIENTATION_LISTENING_NOTE lost its core instruction to reflect before redirecting`)
check(coach.includes('This does not cancel any capture note elsewhere in this prompt'),
  `${COACH}: ORIENTATION_LISTENING_NOTE does not clarify it governs ORDER (listen first), not whether capture notes still apply`)
check(coach.includes('you do not owe them a next question every turn'),
  `${COACH}: ORIENTATION_LISTENING_NOTE does not give Coach permission to just acknowledge, without manufacturing a follow-up question`)

// Gated on the SAME brandStepDone flag as preBrandNote, right next to it --
// this is an orientation-phase instruction, not a permanent one. Post-brand,
// Coach is expected to actively coach and advise, a different job.
check(coach.includes("const orientationListeningNote = brandStepDone ? '' : ORIENTATION_LISTENING_NOTE"),
  `${COACH}: orientationListeningNote is not gated on brandStepDone -- it would keep suppressing Coach's advice-giving even after orientation is long done`)

// Threaded into both profile-slice templates: the empty-profile branch
// (definitionally pre-brand, so unconditional there) and the main template
// (conditional on brandStepDone).
check(coach.includes('${lifeStoryCaptureNote}${ORIENTATION_LISTENING_NOTE}`'),
  `${COACH}: ORIENTATION_LISTENING_NOTE is not appended in the empty-profile template`)
check(coach.includes('${sparseNote}${preBrandNote}${orientationListeningNote}${myStatusData}'),
  `${COACH}: orientationListeningNote is not appended in the main profile-slice template, right after preBrandNote`)

if (failures) {
  console.error(`test-coach-orientation-listening: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-coach-orientation-listening: OK (reflect-before-redirect instruction present, gated on brandStepDone alongside preBrandNote, threaded into both profile-slice templates, permission to just acknowledge without manufacturing a follow-up)')
}
