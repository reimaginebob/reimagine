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

// --- 2b. The prompt's own crisis line says what the fallback says --------
// Until 2026-09-19 these two diverged: DISTRESS_POINTER named 988, while
// SYSTEM_PROMPT_STABLE told the model only to suggest "someone they trust."
// That is worse than it sounds, because "someone you trust" is itself on
// SUPPORT_POINTER_RE -- so a reply that followed the instruction CORRECTLY
// counted as already carrying a pointer and suppressed the fallback. The
// better the model behaved, the less the person in crisis was handed. These
// checks pin the two sides together; api/claude.js's own crisis rule has
// named 988 since well before either, so this is the surface catching up.
{
  const crisisAt = coach.indexOf('explicit self-harm')
  check(crisisAt !== -1, `${COACH}: the explicit-self-harm instruction is missing entirely`)
  const crisisLine = crisisAt === -1 ? '' : coach.slice(crisisAt, crisisAt + 400)
  check(/988/.test(crisisLine),
    `${COACH}: the crisis instruction does not name 988, so a correctly-followed reply hands the person a weaker pointer than the automatic fallback would have`)
  check(/Suicide & Crisis Lifeline/.test(crisisLine),
    `${COACH}: the number is given with no name, so the person cannot tell what they would be calling`)
  check(/someone they trust/.test(crisisLine),
    `${COACH}: the people in the person's life were dropped from the instruction -- the number is the backstop, not the first offer`)
  check(crisisLine.indexOf('someone they trust') < crisisLine.indexOf('988'),
    `${COACH}: the instruction puts the number ahead of the people in their life, which reads as handing them off rather than staying with them`)
  check(/[Tt]hen return to coaching/.test(crisisLine),
    `${COACH}: the instruction no longer returns the model to coaching, so a crisis line risks becoming the whole reply`)
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
  check(/n >= 1 && n <= \d/.test(coach),
    `${COACH}: the angle number is not range-checked, so a drifted value is stored as if it meant something`)
  // Stripped before the text that reaches the person, and placed AFTER the
  // widen-search parse so the MOOD -> WIDENSEARCH chain that
  // test-coach-widen-search-hint-offer pins stays unbroken.
  check(/const strippedText0 = angleStripped\.trim\(\)/.test(coach),
    `${COACH}: the ANGLE line is not removed from the text that reaches the person -- the MOOD leak of 2026-09-09 in a new costume`)
  check(/parseWidenSearchHint\(moodStripped\)/.test(coach),
    `${COACH}: the MOOD -> WIDENSEARCH parse chain was broken to fit this in; it does not need to sit inside that chain`)
}

// --- 3a. The eighth angle: slow a decision down --------------------------
// Different in kind from the seven above it. They sustain someone who is
// running low; this one stops someone with plenty of fight left from spending
// it in the wrong direction. It is the only angle that reasons about a
// decision, which is why it needs the no-verdict rule restated inside it
// rather than inherited from three paragraphs away.
{
  const i = coach.indexOf('8. SLOW THE DECISION DOWN')
  check(i !== -1, `${COACH}: the eighth angle is missing`)
  const j = coach.indexOf('Match the angle to the moment')
  const a8 = i === -1 ? '' : coach.slice(i, j)
  check(/GROUND BEFORE YOU ASSERT/.test(a8),
    `${COACH}: angle 8 does not restate the no-verdict rule -- it is the one angle that reasons about a decision, which is exactly where a verdict would do harm`)
  check(/you cannot see|cannot see/.test(a8) && /financial pressure/.test(a8) && /family situation/.test(a8),
    `${COACH}: angle 8 does not name what Coach cannot see, so it can reason about a decision as though it had the whole picture`)
  check(/not provided/.test(a8),
    `${COACH}: angle 8 does not tell Coach to ask when a needed field is empty -- ANCHOR 1 prints "not provided" precisely so this is checkable rather than guessable`)
  check(/ANCHOR 1/.test(a8),
    `${COACH}: angle 8 references profile data without pointing at where it lives`)
  check(/separate turns/.test(a8) && /Never run them together/.test(a8),
    `${COACH}: angle 8's three beats are not marked as separate turns, so it reads as a monologue to recite`)
  // The two constructions the repo bans that the draft wording contained.
  check(!/worth naming/.test(a8),
    `${COACH}: angle 8 contains "worth naming" -- insight-flagging, banned by Coach's own BANNED SHAPES item 2`)
  check(!/pulling at you/.test(a8),
    `${COACH}: angle 8 contains "pulling at you" -- psychotherapy pull-language, banned by CLAUDE.md section 3. The ai-coaching-pull-language pattern now catches this shape in Coach OUTPUT; this check is what keeps it out of the PROMPT, which no runtime gate ever scans`)
}
{
  // The map has to route to it, and has to say it does not stack with the rest.
  // Bounded forward from the map: "TEACH THE FRAMEWORKS" also appears much
  // earlier in the file, so searching from 0 gives a backwards slice.
  const mapAt = coach.indexOf('Match the angle to the moment')
  const map = coach.slice(mapAt, coach.indexOf('TEACH THE FRAMEWORKS', mapAt))
  check(mapAt !== -1 && map.length > 0, `${COACH}: could not locate the angle map`)
  check(/→ 8/.test(map), `${COACH}: the angle map has no route to angle 8, so nothing tells Coach when to reach for it`)
  check(/do not pair it with them/.test(map),
    `${COACH}: nothing stops angle 8 being stacked onto a sustaining angle, which is the one combination that contradicts itself`)
}
check(/a single digit from 1 to 8/.test(coach),
  `${COACH}: the ANGLE trailer still asks for 1-7, so angle 8 can never be logged`)
check(/n >= 1 && n <= 8/.test(coach),
  `${COACH}: the server still range-checks 1-7, so a correctly-emitted ANGLE: 8 is discarded as drift`)

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
  console.log('test-coach-discouragement-boundaries: OK (angle 6 checks the four consequential endings against CONSEQUENTIAL TOPICS before reframing, and says why, ahead of its own exemplar; the crisis floor now hands over 988 by name, after the people in the person\'s life and before the closing line; the prompt\'s own crisis instruction now says the same thing the fallback says, so the person Coach answers correctly is no longer handed less than the person it fails; which of the seven angles fired is emitted, swept, range-checked, stripped ahead of the widen-search parse and logged beside mood; a corrected reflection is dropped rather than guessed at twice; and the eighth angle slows a decision down without rendering a verdict, names what Coach cannot see, asks rather than guesses at an empty field, is routed from the map and barred from stacking, is logged end-to-end, and carries neither of the two banned constructions the draft wording arrived with)')
}
