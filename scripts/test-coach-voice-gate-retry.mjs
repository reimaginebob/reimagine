#!/usr/bin/env node
// Guards the 2026-09-05 widening of Coach's regenerate-on-violation retry
// (api/coach.js) to also check the full HARD_PATTERNS set (src/voice-patterns.js),
// not just detectResidualVoice's five hand-picked categories. Source-level:
// the retry only fires when a violation actually survives the deterministic
// strippers, which is not reliably provokable from a live model call in a
// test, so this checks the wiring the same way test-coach-voice-gate-wiring.mjs
// checks the client-side backstop.
import fs from 'node:fs'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

const COACH = 'api/coach.js'
const coach = fs.readFileSync(COACH, 'utf8')

check(/import\s*\{\s*detectVoiceViolations\s*\}\s*from\s*'\.\.\/src\/voice-patterns\.js'/.test(coach),
  `${COACH}: detectVoiceViolations is not imported from ../src/voice-patterns.js`)

check(/const hardViolations = detectVoiceViolations\(cleaned, \{ scope: 'runtime' \}\)/.test(coach),
  `${COACH}: hardViolations is not computed from the completed, stripped reply before the retry trigger`)

check(/flags\.citedStat \|\| hardViolations\.length\)/.test(coach),
  `${COACH}: the retry trigger condition does not fold in hardViolations.length alongside the existing five flags`)

check(/for \(const v of hardViolations\.slice\(0, 3\)\) wants\.push/.test(coach),
  `${COACH}: named hard violations (capped at 3) are not folded into the corrective rewrite instruction`)

check(/const hardViolations2 = detectVoiceViolations\(cleaned2, \{ scope: 'runtime' \}\)/.test(coach),
  `${COACH}: the retry's re-check does not re-run detectVoiceViolations on the regenerated reply`)

check(/const score = \(f, hv\) => .*\+ hv\.length/.test(coach),
  `${COACH}: the before/after scoring function does not count hardViolations toward whether the retry wins`)

check(/useRetry = score\(flags2, hardViolations2\) < score\(flags, hardViolations\)/.test(coach),
  `${COACH}: useRetry does not compare the widened score (deterministic flags + hard violations) before and after`)

// Additive, not a replacement: detectResidualVoice's own five-category check
// must still run unchanged alongside the new one.
check(/const flags = detectResidualVoice\(cleaned\)/.test(coach),
  `${COACH}: detectResidualVoice's existing five-category check was removed rather than kept alongside the new one`)

if (failures) {
  console.error(`test-coach-voice-gate-retry: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-coach-voice-gate-retry: OK (Coach\'s pre-display retry now also checks and scores against the full HARD_PATTERNS set)')
}
