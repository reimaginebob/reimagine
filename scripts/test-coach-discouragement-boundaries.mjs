// Five gaps in My Coach's discouragement coaching and its two hard boundaries
// (2026-09-18). An outside review of the DISCOURAGEMENT section raised them;
// each was verified against the real prompt before anything was written. This
// file holds the four that shipped. The two that did not -- an eighth angle
// for a fear-driven decision, and widening DISTRESS_TRIGGER_RE -- are Bob's
// calls, deliberately left open rather than guessed at.
//
// The two that matter most are boundaries, not coaching:
//
//   Angle 6 vs. the attorney handoff. LET THE PAST GO reframes bitterness
//   about how a role ended as something to set down. CONSEQUENTIAL TOPICS
//   routes discrimination, harassment, retaliation and wrongful termination
//   to an employment attorney. Both rules existed; nothing sequenced them,
//   and one conversation is not enough to tell the two apart by language
//   alone. A wrong sort here tells someone to let go of something they may
//   have a right to act on, so the check now sits inside angle 6, at the
//   moment of use, rather than as a separate rule read earlier.
//
//   The crisis pointer. DISTRESS_POINTER is force-appended by
//   ensureDistressSupport whenever the user's own message matches
//   DISTRESS_TRIGGER_RE and the reply carries no human-pointer -- a real
//   code-side floor, not a prompt instruction. It named "a friend, someone
//   close to you, or a counselor" and nothing concrete. Angle 7 exists for
//   someone carrying the search entirely alone, which is exactly the person
//   for whom "someone you trust" may describe nobody.
import fs from 'node:fs'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

const COACH = 'api/coach.js'
const TS = 'src/text-strippers.js'
const coach = fs.readFileSync(COACH, 'utf8')
const strippers = fs.readFileSync(TS, 'utf8')

// --- 1. Angle 6 checks the legal boundary before reframing ----------------
{
  const i = coach.indexOf('6. LET THE PAST GO')
  const j = coach.indexOf('7. DON\'T DO IT ALONE')
  check(i !== -1 && j !== -1 && j > i, `${COACH}: could not locate angle 6`)
  const angle6 = coach.slice(i, j)
  check(/CONSEQUENTIAL TOPICS/.test(angle6),
    `${COACH}: angle 6 does not send the reader to CONSEQUENTIAL TOPICS -- the two rules sit independently and a bitter-sounding turn is sorted between "coach it" and "see an attorney" with no floor under the model's read`)
  check(/discrimination/.test(angle6) && /harassment/.test(angle6) && /retaliation/.test(angle6) && /wrongful/.test(angle6),
    `${COACH}: angle 6 does not name the four endings that must route to an attorney first`)
  check(/right to act on/.test(angle6),
    `${COACH}: angle 6 states the check without stating the stake -- a rule the model is told to follow but not why is the one it drops under pressure`)
  // Ordering is the whole point: the check has to come before the exemplar.
  const checkAt = angle6.indexOf('CONSEQUENTIAL TOPICS')
  const exemplarAt = angle6.indexOf('Whatever put you here')
  check(exemplarAt !== -1 && checkAt < exemplarAt,
    `${COACH}: the attorney check falls after angle 6's exemplar, so the model reads the reframe before the reason not to use it`)
}

// --- 2. The crisis pointer hands over something concrete ------------------
check(/988/.test(strippers),
  `${TS}: DISTRESS_POINTER names no reachable resource -- it offers "someone you trust" to a person who may have nobody, which is precisely angle 7's case`)
check(/Suicide & Crisis Lifeline/.test(strippers),
  `${TS}: the number is given with no name, so a person in distress cannot tell what they are calling`)
check(/carry that alone/.test(strippers),
  `${TS}: the closing line was dropped -- test-text-strippers pins this phrase, and it is the sentence that does the actual work`)
{
  // Scoped to the pointer itself: 988 already appears earlier in this file,
  // in a comment and inside SUPPORT_POINTER_RE, so a file-wide search finds
  // the wrong one. That SUPPORT_POINTER_RE hit is worth noting on its own --
  // the guard already counted a reply naming 988 as carrying a real human
  // pointer, so the pointer it falls back to now matches what it accepts.
  const dp = (strippers.match(/const DISTRESS_POINTER = "[^"]*"/) || [''])[0]
  check(dp.length > 0, `${TS}: could not locate DISTRESS_POINTER`)
  // The people in their life come first. A phone number offered ahead of them
  // reads as being handed off rather than stayed with.
  check(dp.indexOf('someone you trust') !== -1 && dp.indexOf('someone you trust') < dp.indexOf('988'),
    `${TS}: the crisis line is offered before the people in their life, which reads as handing them off rather than staying with them`)
  check(dp.indexOf('988') < dp.indexOf('carry that alone'),
    `${TS}: the number lands after the closing line, so the reply ends on a phone number rather than on them`)
}

// --- 3. Which angle fired is recorded ------------------------------------
check(/ANGLE: <number>/.test(coach),
  `${COACH}: the model is never asked which angle it used, so "vary which angle you reach for" stays an instruction with nothing behind it -- the same shape as the COACHSUMMARY proactive rule the model ignored on its first live test`)
check(/\(\?:SELFCHECK\|MOOD\|ANGLE\|/.test(coach),
  `${COACH}: ANGLE is missing from TRAILER_NAME_SWEEP, so the number can reach the person as visible text -- exactly the MOOD leak of 2026-09-09`)
check(/discouragementAngle/.test(coach),
  `${COACH}: the ANGLE trailer is never parsed server-side`)
check(/angle: discouragementAngle/.test(coach),
  `${COACH}: the parsed angle is not logged beside mood, so nothing can be checked against real turns`)
{
  // Validated against the real range, and stripped before the widen-search
  // parse so the number cannot survive into the reply.
  check(/n >= 1 && n <= 7/.test(coach),
    `${COACH}: the angle number is not range-checked, so a drifted value is stored as if it meant something`)
  // Stripped before the text that reaches the person, and placed AFTER the
  // widen-search parse so the MOOD -> WIDENSEARCH chain that
  // test-coach-widen-search-hint-offer pins stays unbroken.
  check(/const strippedText0 = angleStripped\.trim\(\)/.test(coach),
    `${COACH}: the ANGLE line is not removed from the text that reaches the person -- the MOOD leak of 2026-09-09 in a new costume`)
  check(/parseWidenSearchHint\(moodStripped\)/.test(coach),
    `${COACH}: the MOOD -> WIDENSEARCH parse chain was broken to fit this in; it does not need to sit inside that chain`)
}

// --- 4. A wrong reflection has a stated recovery --------------------------
{
  const i = coach.indexOf('Reflections.')
  const j = coach.indexOf('Summaries.')
  check(i !== -1 && j > i, `${COACH}: could not locate the Reflections paragraph`)
  const refl = coach.slice(i, j)
  check(/took? the correction at face value|take the correction at face value/.test(refl),
    `${COACH}: Reflections says to check a tentative read but not what to do when it comes back wrong`)
  check(/rather than trying a second guess/.test(refl),
    `${COACH}: nothing rules out a second guess, which is what makes the first one unsafe to correct`)
}

if (failures) {
  console.error(`test-coach-discouragement-boundaries: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-coach-discouragement-boundaries: OK (angle 6 checks the four consequential endings against CONSEQUENTIAL TOPICS before reframing, and says why, ahead of its own exemplar; the crisis floor now hands over 988 by name, after the people in the person\'s life and before the closing line; which of the seven angles fired is emitted, swept, range-checked, stripped ahead of the widen-search parse and logged beside mood; and a corrected reflection is dropped rather than guessed at twice)')
}
