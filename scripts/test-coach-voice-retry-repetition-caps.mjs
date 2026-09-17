// Coach voice retry: cap repeated constructions (Output/handoff/2026-09-16_
// coach-repetition-caps.md). Source: a live Coach reply in Offer &
// Negotiation (HOPE offer) that read as AI-generated -- the same hedge word
// ("worth") did five different jobs in one reply, a two-word flat verdict
// ("That's real X") was reused with a different noun, four sentences used a
// colon-launch, and five em dashes did three different jobs across seven
// short paragraphs. None of this tripped voice-patterns.js's existing
// single-match HARD_PATTERNS, because each construction is ordinary ONCE and
// only reads as machine-written on repetition -- a threshold concept the
// regex array was never built to hold. Rejected as a system-prompt fix (the
// brief's own reasoning): PLAIN_ENGLISH already asks Coach to write like a
// person and did not stop this reply, and a prompt instruction costs weight
// on every turn while a code-side count only costs a regeneration on the
// turns that actually need one. Built on the exact precedent already in this
// file: sessionOpenTooLong/sessionOpenSaysINoticed, added for the identical
// reason (a prose instruction with nothing checking the model followed it).
import fs from 'node:fs'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

// api/coach.js cannot be imported directly here (its top-level db import
// throws without a live DATABASE_URL, same reason test-coach-session-open-
// cap.mjs and test-coach-voice-retry-order.mjs read this file as text rather
// than importing it). Extract each counting function together with the
// module-level regex constant it closes over, and eval the pair inside a
// wrapper so the behavioral checks below exercise the actual shipped
// implementation, not a hand-duplicated copy that could silently drift from it.
const COACH = 'api/coach.js'
const coach = fs.readFileSync(COACH, 'utf8')

function extractCountFn(constMarker, fnName) {
  const startIdx = coach.indexOf(constMarker)
  if (startIdx === -1) return null
  const fnMarker = `export function ${fnName}(text) {`
  const fnStart = coach.indexOf(fnMarker, startIdx)
  if (fnStart === -1) return null
  const fnEnd = coach.indexOf('\n}', fnStart) + 2
  const block = coach.slice(startIdx, fnEnd).replace('export function', 'function')
  return (0, eval)(`(function(){ ${block}\nreturn ${fnName} })()`)
}

const countWorthHedge = extractCountFn('const WORTH_HEDGE_RE = ', 'countWorthHedge')
const countFlatVerdict = extractCountFn('const FLAT_VERDICT_RE = ', 'countFlatVerdict')
const countColonLaunch = extractCountFn('const COLON_LAUNCH_RE = ', 'countColonLaunch')
const countEmDash = extractCountFn('const EM_DASH_RE = ', 'countEmDash')

check(typeof countWorthHedge === 'function', `${COACH}: could not extract countWorthHedge for behavioral testing`)
check(typeof countFlatVerdict === 'function', `${COACH}: could not extract countFlatVerdict for behavioral testing`)
check(typeof countColonLaunch === 'function', `${COACH}: could not extract countColonLaunch for behavioral testing`)
check(typeof countEmDash === 'function', `${COACH}: could not extract countEmDash for behavioral testing`)

// --- Behavioral: countWorthHedge ---
if (countWorthHedge) {
  check(countWorthHedge('') === 0, 'countWorthHedge(""): should be 0')
  check(countWorthHedge("It's worth checking with the recruiter.") === 1,
    'countWorthHedge: a single "worth checking" should count as 1')
  check(countWorthHedge("It's worth checking with the recruiter, and also worth asking about the timeline.") === 2,
    'countWorthHedge: two different "worth ___" hedges in one reply should count as 2')
  check(countWorthHedge("This is worth a closer looking.") === 1,
    'countWorthHedge: the "worth a [adj] [gerund]" shape should still match')
  check(countWorthHedge("That's worth it.") === 0,
    'countWorthHedge: the idiom "worth it" should NOT count -- it is not in the recommendation-verb list')
  check(countWorthHedge('Her net worth is high.') === 0,
    'countWorthHedge: "net worth" should NOT count -- no recommendation verb follows')
}

// --- Behavioral: countFlatVerdict ---
if (countFlatVerdict) {
  check(countFlatVerdict('') === 0, 'countFlatVerdict(""): should be 0')
  check(countFlatVerdict("That's a real gap.") === 1,
    'countFlatVerdict: a single "that\'s a real X" should count as 1')
  check(countFlatVerdict("That's a real gap. That's real leverage.") === 2,
    'countFlatVerdict: the construction repeated with a different noun should count as 2')
  check(countFlatVerdict("That's great.") === 0,
    'countFlatVerdict: an ordinary "that\'s great" with no "real" should NOT count')
}

// --- Behavioral: countColonLaunch ---
if (countColonLaunch) {
  check(countColonLaunch('') === 0, 'countColonLaunch(""): should be 0')
  check(countColonLaunch("Here's the plan: do X first.") === 1,
    'countColonLaunch: a single label-then-colon sentence should count as 1')
  check(countColonLaunch('Bottom line: it works. Quick note: watch for Y.') === 2,
    'countColonLaunch: two colon-launches in one reply should count as 2')
  check(countColonLaunch('This has no colon at all.') === 0,
    'countColonLaunch: ordinary prose with no colon should NOT count')
}

// --- Behavioral: countEmDash ---
if (countEmDash) {
  check(countEmDash('') === 0, 'countEmDash(""): should be 0')
  check(countEmDash('no dashes here') === 0, 'countEmDash: prose with no em dash should be 0')
  check(countEmDash('one — two — three — four') === 3, 'countEmDash: three em dashes should count as 3')
}

// --- Static: the four checks are wired into the existing generic voice-
// retry block (not a separate mechanism), unconditional on turnKind (the
// reproducing reply was an ordinary Offer & Negotiation turn, not a
// session-open one) ---
const retryIdx = coach.indexOf("// Regenerate-on-violation retry (the brief's deferred-optional item)")
check(retryIdx !== -1, `${COACH}: could not find the voice-retry block`)
// Window widened 8000 -> 11000 (2026-09-16) for the same reason it was
// widened 6000 -> 8000 before: the four repetition-cap checks below push the
// tail markers this file checks further out.
const retryBlock = retryIdx !== -1 ? coach.slice(retryIdx, retryIdx + 11000) : ''

check(retryBlock.includes('const worthHedgeCount = countWorthHedge(strippedText)'),
  `${COACH}: worthHedgeCount is not computed against strippedText ahead of the retry trigger`)
check(retryBlock.includes('const flatVerdictCount = countFlatVerdict(strippedText)'),
  `${COACH}: flatVerdictCount is not computed against strippedText ahead of the retry trigger`)
check(retryBlock.includes('const colonLaunchCount = countColonLaunch(strippedText)'),
  `${COACH}: colonLaunchCount is not computed against strippedText ahead of the retry trigger`)
check(retryBlock.includes('const emDashCount = countEmDash(strippedText)'),
  `${COACH}: emDashCount is not computed against strippedText ahead of the retry trigger`)

// Both must be part of the trigger condition, not just computed and ignored.
const triggerIdx = retryBlock.indexOf('if (flags.comparative')
const triggerLine = triggerIdx !== -1 ? retryBlock.slice(triggerIdx, retryBlock.indexOf('{', triggerIdx) + 1) : ''
check(triggerLine.includes('worthHedgeCount > 1'), `${COACH}: the voice-retry trigger condition does not check worthHedgeCount`)
check(triggerLine.includes('flatVerdictCount >= 2'), `${COACH}: the voice-retry trigger condition does not check flatVerdictCount`)
check(triggerLine.includes('colonLaunchCount > 1'), `${COACH}: the voice-retry trigger condition does not check colonLaunchCount`)
check(triggerLine.includes('emDashCount > 2'), `${COACH}: the voice-retry trigger condition does not check emDashCount`)

// Each must produce a corrective instruction naming the actual count found,
// the same style hardViolations and the session-open checks already use.
check(retryBlock.includes('if (worthHedgeCount > 1) wants.push('), `${COACH}: no corrective instruction is added for worthHedgeCount`)
check(retryBlock.includes('if (flatVerdictCount >= 2) wants.push('), `${COACH}: no corrective instruction is added for flatVerdictCount`)
check(retryBlock.includes('if (colonLaunchCount > 1) wants.push('), `${COACH}: no corrective instruction is added for colonLaunchCount`)
check(retryBlock.includes('if (emDashCount > 2) wants.push('), `${COACH}: no corrective instruction is added for emDashCount`)

// Each must be re-checked on the rewrite and folded into score() -- otherwise
// a rewrite could still repeat the construction and get adopted anyway.
check(retryBlock.includes('const worthHedgeCount2 = countWorthHedge(cleaned2)'),
  `${COACH}: the rewrite (cleaned2) is not re-checked for worthHedgeCount`)
check(retryBlock.includes('const flatVerdictCount2 = countFlatVerdict(cleaned2)'),
  `${COACH}: the rewrite (cleaned2) is not re-checked for flatVerdictCount`)
check(retryBlock.includes('const colonLaunchCount2 = countColonLaunch(cleaned2)'),
  `${COACH}: the rewrite (cleaned2) is not re-checked for colonLaunchCount`)
check(retryBlock.includes('const emDashCount2 = countEmDash(cleaned2)'),
  `${COACH}: the rewrite (cleaned2) is not re-checked for emDashCount`)

const scoreIdx = retryBlock.indexOf('const score = (f, hv')
const scoreLine = scoreIdx !== -1 ? retryBlock.slice(scoreIdx, retryBlock.indexOf('\n', scoreIdx)) : ''
check(scoreLine.includes('worthHedge') && scoreLine.includes('flatVerdict') && scoreLine.includes('colonLaunch') && scoreLine.includes('emDash'),
  `${COACH}: score() does not factor in the four repetition caps -- a retry that still repeats a construction could still win`)
check(scoreLine.includes('(worthHedge > 1 ? 1 : 0)') && scoreLine.includes('(flatVerdict >= 2 ? 1 : 0)') && scoreLine.includes('(colonLaunch > 1 ? 1 : 0)') && scoreLine.includes('(emDash > 2 ? 1 : 0)'),
  `${COACH}: score()'s per-check thresholds have drifted from the trigger condition's own thresholds`)
check(retryBlock.includes('score(flags2, hardViolations2, sessionOpenTooLong2, sessionOpenSaysINoticed2, worthHedgeCount2, flatVerdictCount2, colonLaunchCount2, emDashCount2)'),
  `${COACH}: the rewrite's score() call is not passed the re-checked repetition-cap counts`)
check(retryBlock.includes('score(flags, hardViolations, sessionOpenTooLong, sessionOpenSaysINoticed, worthHedgeCount, flatVerdictCount, colonLaunchCount, emDashCount)'),
  `${COACH}: the original's score() call is not passed the repetition-cap counts`)

// Observability: the log line should carry the counts on both sides, so a
// false-positive rate on the least-literal checks (worth/colon) can be
// watched in production, per the brief's own runtime gate.
const logIdx = retryBlock.indexOf("console.log('coach voice-retry'")
const logLine = logIdx !== -1 ? retryBlock.slice(logIdx, retryBlock.indexOf('\n', logIdx)) : ''
check(logLine.includes('worthHedgeCount') && logLine.includes('flatVerdictCount') && logLine.includes('colonLaunchCount') && logLine.includes('emDashCount'),
  `${COACH}: the voice-retry log line does not record the repetition-cap counts on the before side`)
check(logLine.includes('worthHedgeCount: worthHedgeCount2') && logLine.includes('flatVerdictCount: flatVerdictCount2') && logLine.includes('colonLaunchCount: colonLaunchCount2') && logLine.includes('emDashCount: emDashCount2'),
  `${COACH}: the voice-retry log line does not record the repetition-cap counts on the after side`)

if (failures) {
  console.error(`test-coach-voice-retry-repetition-caps: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-coach-voice-retry-repetition-caps: OK (countWorthHedge/countFlatVerdict/countColonLaunch/countEmDash behave correctly on real fixtures and are wired into the existing voice-retry trigger, corrective wants, rewrite re-check, score comparison, and observability log)')
}
