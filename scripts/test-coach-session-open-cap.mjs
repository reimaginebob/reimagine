// Production fix (Bob's read on Imerys/Lindsey, 2026-09-10): the session-open
// prompt block (WHAT CHANGED SINCE THEIR LAST SESSION, buildCoachProfileSlice)
// already instructs a three-sentence cap and never says "I noticed", but that
// was prose instruction only -- Bob's actual recap at sign-in was five
// sentences and used "I noticed". This guards the deterministic enforcement
// added to the existing generic voice-retry block: a session-open reply that
// runs long or says "I noticed" now triggers the same regenerate-once-and-
// keep-the-better-version path every other voice violation already uses.
import fs from 'node:fs'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

// api/coach.js cannot be imported directly here (its top-level db import
// throws without a live DATABASE_URL, same reason test-coach-voice-retry-
// order.mjs reads this file as text rather than importing it). Extract the
// real countSentences source out of the file and eval it standalone, so the
// behavioral checks below exercise the actual shipped implementation, not a
// hand-duplicated copy that could silently drift from it.
const COACH = 'api/coach.js'
const coach = fs.readFileSync(COACH, 'utf8')
const fnStart = coach.indexOf('export function countSentences(text) {')
if (fnStart === -1) {
  console.error(`${COACH}: could not find countSentences to extract for behavioral testing`)
  process.exit(1)
}
const fnEnd = coach.indexOf('\n}', fnStart) + 2
const fnSrc = coach.slice(fnStart, fnEnd).replace('export function', 'function')
const countSentences = (0, eval)(`(${fnSrc})`)

// Behavioral: countSentences itself.
check(countSentences('') === 0, 'countSentences("") should be 0')
check(countSentences('Hi there.') === 1, 'countSentences: one sentence should be 1')
check(countSentences('Hi there. How are you?') === 2, 'countSentences: two sentences should be 2')
check(countSentences('One. Two. Three.') === 3, 'countSentences: three sentences should be 3')
check(countSentences('One. Two. Three. Four. Five.') === 5,
  'countSentences: Bob\'s actual five-sentence recap shape should count as 5, not 3')
check(countSentences('No terminal punctuation here') === 1,
  'countSentences: a single clause with no ending punctuation should still count as 1, not 0')

// Static: the enforcement is wired into the existing generic voice-retry
// block (not a separate mechanism), gated on turnKind === 'session_open' only
// (never a global voice-patterns.js HARD_PATTERN -- "I noticed" is ordinary
// and fine outside this one turn shape).
const retryIdx = coach.indexOf("// Regenerate-on-violation retry (the brief's deferred-optional item)")
check(retryIdx !== -1, `${COACH}: could not find the voice-retry block`)
const retryBlock = retryIdx !== -1 ? coach.slice(retryIdx, retryIdx + 8000) : ''

check(retryBlock.includes("const sessionOpenTooLong = turnKind === 'session_open' && countSentences(strippedText) > 3"),
  `${COACH}: sessionOpenTooLong is not computed (or not gated on turnKind === 'session_open') ahead of the retry trigger`)
check(retryBlock.includes("const sessionOpenSaysINoticed = turnKind === 'session_open' && /\\bi noticed\\b/i.test(strippedText)"),
  `${COACH}: sessionOpenSaysINoticed is not computed (or not gated on turnKind === 'session_open') ahead of the retry trigger`)

// Both new checks must actually be part of the trigger condition, not just
// computed and ignored.
const triggerIdx = retryBlock.indexOf('if (flags.comparative')
const triggerLine = triggerIdx !== -1 ? retryBlock.slice(triggerIdx, retryBlock.indexOf('{', triggerIdx) + 1) : ''
check(triggerLine.includes('sessionOpenTooLong'), `${COACH}: the voice-retry trigger condition does not check sessionOpenTooLong`)
check(triggerLine.includes('sessionOpenSaysINoticed'), `${COACH}: the voice-retry trigger condition does not check sessionOpenSaysINoticed`)

// Both must produce a corrective instruction (the `wants` array).
check(retryBlock.includes('if (sessionOpenTooLong) wants.push('), `${COACH}: no corrective instruction is added for sessionOpenTooLong`)
check(retryBlock.includes('if (sessionOpenSaysINoticed) wants.push('), `${COACH}: no corrective instruction is added for sessionOpenSaysINoticed`)

// Both must be re-checked on the rewrite and folded into the score() used to
// decide whether the retry actually wins -- otherwise a rewrite could still
// be five sentences (or still say "I noticed") and get adopted anyway.
check(retryBlock.includes("const sessionOpenTooLong2 = turnKind === 'session_open' && countSentences(cleaned2) > 3"),
  `${COACH}: the rewrite (cleaned2) is not re-checked for sentence count`)
check(retryBlock.includes("const sessionOpenSaysINoticed2 = turnKind === 'session_open' && /\\bi noticed\\b/i.test(cleaned2)"),
  `${COACH}: the rewrite (cleaned2) is not re-checked for "I noticed"`)
const scoreIdx = retryBlock.indexOf('const score = (f, hv')
const scoreLine = scoreIdx !== -1 ? retryBlock.slice(scoreIdx, retryBlock.indexOf('\n', scoreIdx)) : ''
check(scoreLine.includes('tooLong') && scoreLine.includes('saysINoticed'),
  `${COACH}: score() does not factor in the session-open sentence-count or "I noticed" checks -- a retry that is still too long could still win`)
check(retryBlock.includes('score(flags2, hardViolations2, sessionOpenTooLong2, sessionOpenSaysINoticed2)'),
  `${COACH}: the rewrite's score() call is not passed the re-checked session-open flags`)
check(retryBlock.includes('score(flags, hardViolations, sessionOpenTooLong, sessionOpenSaysINoticed)'),
  `${COACH}: the original's score() call is not passed the session-open flags`)

if (failures) {
  console.error(`test-coach-session-open-cap: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-coach-session-open-cap: OK (countSentences behaves correctly; the session-open three-sentence cap and "I noticed" ban are wired into the existing voice-retry trigger, corrective wants, and score comparison)')
}
