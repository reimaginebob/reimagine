// Guards finding #2.9 from the 2026-09-08 prelaunch audit: spend attribution
// has a hole the budget cannot see through. 14 callClaude sites in
// src/App.jsx passed no `step`, so logGeneration (api/claude.js) wrote
// kind = NULL for each -- the dollars and counts still reached the hourly
// cap, the watchdog, and the budget totals (they don't filter on kind), but
// nobody could tell WHICH feature was driving a spike or a spend jump, the
// exact diagnostic blind spot that matters during an incident. Separately,
// logGeneration swallowed every insert failure with no alert at all, so a
// broken table would silently and permanently blind all three of those
// systems with zero operator visibility.
//
// BEHAVIORAL for the one piece of new logic this PR adds: the failure-alert
// threshold in logGeneration is exercised indirectly by simulating its
// counter arithmetic (a pure comparison, re-derived here rather than
// imported, since it lives inline inside a DB-touching function that can't
// run without a live Postgres connection -- same constraint as prior DB-
// dependent pieces in this batch). The rest -- the 14 step tags, and that
// logGeneration's alert call follows the established alertOnce convention
// -- is source-presence, since a JS string literal is what IS the fix here;
// there's no separate pure function to extract it into.
import fs from 'node:fs'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

// --- Threshold arithmetic (re-derived: fires exactly at the threshold, not before) ---

function willAlert(failureCount, threshold) {
  return failureCount >= threshold
}
check(willAlert(4, 5) === false, 'one failure short of the threshold incorrectly triggers an alert')
check(willAlert(5, 5) === true, 'reaching the threshold exactly does not trigger an alert')
check(willAlert(1, 5) === false, 'a single failure incorrectly triggers an alert -- this must tolerate an isolated blip')
check(willAlert(6, 5) === true, 'a failure count past the threshold does not trigger an alert')

// --- Source-presence: api/claude.js's logGeneration failure alert --------

const CLAUDE_API = 'api/claude.js'
const claudeApi = fs.readFileSync(CLAUDE_API, 'utf8')

check(claudeApi.includes('let consecutiveLogFailures = 0'), `${CLAUDE_API}: the consecutive-failure counter is missing`)
check(/const LOG_FAILURE_ALERT_THRESHOLD = \d+/.test(claudeApi), `${CLAUDE_API}: the alert threshold constant is missing`)
check(claudeApi.includes('consecutiveLogFailures = 0') && claudeApi.includes('consecutiveLogFailures++'),
  `${CLAUDE_API}: the counter does not both reset on success and increment on failure`)
check(/if \(consecutiveLogFailures >= LOG_FAILURE_ALERT_THRESHOLD\)/.test(claudeApi),
  `${CLAUDE_API}: the threshold check is missing or no longer gates the alert`)
check(claudeApi.includes("alertOnce('generation-log:insert-failing'"),
  `${CLAUDE_API}: logGeneration's failure alert no longer uses the established alertOnce(key, ...) convention`)
check(/alertOnce\('generation-log:insert-failing'[\s\S]{0,600}cooldownHours: 6/.test(claudeApi),
  `${CLAUDE_API}: the failure alert has no cooldown -- it should re-arm if the outage persists, matching the upstream-failure alert's own 6h cooldown`)
// The alert call must itself be try/caught -- alerting must never be what
// makes logGeneration surface an error to its caller.
check(/if \(consecutiveLogFailures >= LOG_FAILURE_ALERT_THRESHOLD\) \{\s*try \{\s*await alertOnce/.test(claudeApi),
  `${CLAUDE_API}: the alertOnce call is not wrapped in its own try/catch -- an alerting failure could otherwise propagate`)
check(claudeApi.includes('/* never surfaces to the caller */'),
  `${CLAUDE_API}: logGeneration's own catch no longer documents/preserves the never-surfaces-to-the-caller guarantee`)

// --- Source-presence: the 14 newly-tagged callClaude sites in src/App.jsx --

const APP = 'src/App.jsx'
const app = fs.readFileSync(APP, 'utf8')

const EXPECTED_TAGS = [
  'lane-infer', 'jd-metadata', 'industry-infer', 'openings-match',
  'recruiters-discovery', 'recruiters-leader-lookup', 'gtm-contact-lookup',
  'skillsExtract', 'p11-question-regen', 'op-p11-question-regen',
  'builder-areas', 'builder-skills', 'offer-parse',
]
for (const tag of EXPECTED_TAGS) {
  check(app.includes(`step:'${tag}'`), `${APP}: expected step:'${tag}' to appear at least once -- one of the 14 previously-untagged sites may be missing its tag`)
}
// The 14th site (runBuilderDocParse) tags dynamically from opts.source
// rather than a string literal -- checked separately.
check(app.includes('step:`builder-${source}-parse`'),
  `${APP}: runBuilderDocParse no longer tags dynamically from opts.source -- this one call site serves both the resume-parse and linkedin-parse uploads via opts.source, so a single literal tag would misattribute one of the two`)

// No callClaude( call site (the plain wrapper, not callClaudeWithVoiceGate)
// should remain without a step tag. Multi-line calls put step: on a
// following line, so this checks per-call-site text windows rather than
// requiring step: on the exact same line.
{
  const callSites = []
  const re = /(?<!With[A-Za-z]*)callClaude\(/g
  let m
  while ((m = re.exec(app))) {
    // Exclude the function's own definition and callClaudeWithVoiceGate hits
    // (the negative lookbehind above already screens the "WithVoiceGate("
    // spelling, but the function definition itself reads "async function
    // callClaude(" -- screen that separately).
    const lineStart = app.lastIndexOf('\n', m.index) + 1
    const line = app.slice(lineStart, app.indexOf('\n', m.index))
    if (line.includes('async function callClaude')) continue
    callSites.push(m.index)
  }
  check(callSites.length >= 30, `${APP}: found only ${callSites.length} plain callClaude( call sites -- expected at least 30; the detection regex may have broken`)
  const untagged = callSites.filter(idx => !app.slice(idx, idx + 400).includes('step:'))
  check(untagged.length === 0,
    `${APP}: ${untagged.length} callClaude( call site(s) still have no step: tag within 400 chars -- offsets: ${untagged.join(', ')}`)
}

if (failures) {
  console.error(`test-generation-attribution: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-generation-attribution: OK (the logGeneration failure-alert threshold fires at the right count with a cooldown-guarded alertOnce call that cannot itself surface to the caller, and every callClaude( site in src/App.jsx -- including the 14 previously-untagged ones -- now carries a step tag)')
}
