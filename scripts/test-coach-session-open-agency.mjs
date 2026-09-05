// Guards the 2026-09-05 generalization of the session-open note from a status
// recap into a mood-first, agency-driven opener (Bob's anticipation
// principle applied to the returning-session welcome). Source-level rather
// than a live-call test, same reasoning as test-coach-session-open.mjs: this
// pins down the pieces a refactor could silently break, not the model's
// actual phrasing on any given turn.
import fs from 'node:fs'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

const COACH = 'api/coach.js'
const coach = fs.readFileSync(COACH, 'utf8')

// The gate and the delta computation are untouched by this brief -- only the
// text sessionOpenNote returns changes. A regression here would mean the
// generalization accidentally touched the pilot gate itself.
check(/const sessionOpenNote = \(sightOn && sessionOpenRequested\)/.test(coach),
  `${COACH}: sessionOpenNote is no longer gated on (sightOn && sessionOpenRequested)`)
check(/computeSessionDelta\(state, pursuitRows, activityFacts, priorSessionAt\)/.test(coach),
  `${COACH}: sessionOpenNote no longer computes the session delta -- the opener needs it to weave in what actually happened`)

// The opener must lead with the person, not recite a status update, and ask
// exactly one mood question rather than the same question phrased twice
// (reported live 2026-09-05: the model asked "how's it going?" and then
// "how are you doing this week?" back to back in one reply).
check(coach.includes('ask ONE question about how they are doing'),
  `${COACH}: sessionOpenNote no longer instructs Coach to ask exactly one mood question`)
check(coach.includes('never ask twice in different words in the same reply'),
  `${COACH}: sessionOpenNote lost the guard against restating the mood question in a second phrasing`)

// The agency question -- name a focus, or ask for a suggestion -- is the
// actual point of this brief. Losing it silently reverts to the old
// Coach-decides-unprompted behavior.
check(coach.includes('whether there is something specific they would like to work on today'),
  `${COACH}: sessionOpenNote lost the agency question (work on something specific, or ask Coach to suggest)`)
check(coach.includes('follow it completely rather than steering back to your own read'),
  `${COACH}: sessionOpenNote no longer instructs Coach to follow the person's own stated focus rather than overriding it`)
check(coach.includes('only when they ask you to suggest something do you reach for what is on the table for them below'),
  `${COACH}: sessionOpenNote no longer defers the next-step recommendation until the person actually asks for one`)

// The old unconditional "lay out the real options" / "confirm what is
// already in motion" recap language must actually be gone, not just
// supplemented -- otherwise Coach gets both the old report and the new
// question in the same turn.
check(!coach.includes('lay out the real options with why each one'),
  `${COACH}: the old unprompted status-recap language is still present alongside the new agency opener`)

// The stacked-questions fix: search-intake's own ask must be suppressed on
// exactly the session-open turn, and resume otherwise.
check(/const searchIntakeNoteThisTurn = sessionOpenRequested \? '' : searchIntakeNote\(si\)/.test(coach),
  `${COACH}: searchIntakeNote is no longer suppressed on the session-open turn -- a thin-signal session would get two open questions stacked in one reply`)
check(coach.includes('${searchIntakeNoteThisTurn}') && !coach.includes('${searchIntakeNote(si)}'),
  `${COACH}: the profile-slice return statement does not use the turn-aware searchIntakeNoteThisTurn in place of the unconditional call`)

if (failures) {
  console.error(`test-coach-session-open-agency: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-coach-session-open-agency: OK (mood-first opener, agency question, deferred suggestion, search-intake suppression on the open turn all present)')
}
