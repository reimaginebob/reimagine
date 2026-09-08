// Guards findings #3.6 and #3.7 from the 2026-09-07 My Coach diagnostic
// review.
//
// #3.6: every date computation in api/coach.js anchored to the SERVER's UTC
// date (new Date().toISOString().slice(0,10)), so a person in the US evening
// was told "due today" had become "overdue by 1 day" -- UTC is already
// tomorrow once evening hits anywhere west of Greenwich. The fix threads the
// client's own getTimezoneOffset() through every request and computes each
// "today" from it instead.
//
// #3.7: CLAUDE.md and two source comments (Chat.jsx, App.jsx) all claimed
// Coach's chat replies stream live and so cannot go through a silent
// pre-display retry the way generation's callClaudeWithVoiceGate does. That
// premise was backwards: api/coach.js buffers the entire reply and runs its
// own regenerate-on-violation retry server-side BEFORE ever writing a byte
// to the client -- confirmed by reading api/coach.js's own comment on why
// the upstream call is buffered non-streaming, and by the single
// `res.write(visibleText)` that ships the complete, already-retried text in
// one call. Pre-flight discovery on the brief's further ask ("drop or
// re-scope the client detector so violation counts stop double-counting")
// found no actual double-count: the server's own retry outcome is only ever
// console.log'd (never persisted to a table or the corrections-log pipe the
// client's detector posts to), so there is nowhere today where the same
// violation is counted twice. The client-side detector is kept as Bob's only
// visibility into what reaches production after the server's retry; only
// the three comments describing WHY it exists are corrected.
//
// Source-level throughout: both fixes live in files this test suite cannot
// execute end to end (api/coach.js constructs live DB/Resend clients at
// import time without dummy env vars set up for date logic specifically;
// Chat.jsx needs a browser).
import fs from 'node:fs'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

const COACH = 'api/coach.js'
const coach = fs.readFileSync(COACH, 'utf8')
const CHAT = 'src/components/Chat.jsx'
const chat = fs.readFileSync(CHAT, 'utf8')
const CLAUDE_MD = 'CLAUDE.md'
const claudeMd = fs.readFileSync(CLAUDE_MD, 'utf8')
const APP = 'src/App.jsx'
const app = fs.readFileSync(APP, 'utf8')

// --- #3.6: timezone -------------------------------------------------------

// The shared helper exists and is the ONLY place UTC-vs-local math happens.
check(coach.includes('function localTodayStr(tzOffsetMinutes)'),
  `${COACH}: localTodayStr helper is missing`)
check(!/new Date\(\)\.toISOString\(\)\.slice\(0, ?10\)/.test(coach),
  `${COACH}: a raw new Date().toISOString().slice(0,10) survives outside localTodayStr -- this is the exact UTC-anchored pattern finding #3.6 flagged`)

// Both date-driven blocks route through it instead of computing UTC directly.
check(/const todayStr = localTodayStr\(opts\.tzOffsetMinutes\)/.test(coach),
  `${COACH}: buildPursuitStatusBlock no longer derives todayStr from localTodayStr(opts.tzOffsetMinutes)`)
check(/function buildFocusPlaybookBlock\(state, independent, tzOffsetMinutes\)/.test(coach),
  `${COACH}: buildFocusPlaybookBlock lost its tzOffsetMinutes parameter`)
check(/const today = Date\.parse\(localTodayStr\(tzOffsetMinutes\)\)/.test(coach),
  `${COACH}: buildFocusPlaybookBlock no longer derives today from localTodayStr(tzOffsetMinutes)`)

// The "TODAY'S DATE" anchor sent to the model every turn is the same
// finding #3.6 named directly ("labeled as such") -- it must use the same
// local date, and must no longer claim "(UTC)" now that it does not mean UTC.
check(/const nowLabel = new Date\(localTodayStr\(tzOffsetMinutes\) \+ 'T00:00:00Z'\)\.toLocaleDateString/.test(coach),
  `${COACH}: the TODAY'S DATE anchor (nowLabel) no longer derives from localTodayStr(tzOffsetMinutes)`)
check(!coach.includes("TODAY'S DATE: ${nowLabel} (UTC)"),
  `${COACH}: the TODAY'S DATE anchor still says "(UTC)" -- now that it reflects the person's own local date, that label is actively misleading`)

// Threaded end to end: buildCoachRequest accepts it, passes it down to the
// profile slice, and the top-level handler reads it off the request body.
check(/export function buildCoachRequest\(\{[\s\S]{0,700}tzOffsetMinutes,\s*\}\)/.test(coach),
  `${COACH}: buildCoachRequest does not accept tzOffsetMinutes as a parameter`)
check(coach.includes('buildCoachProfileSlice(profileState, employmentStatus, featureFlags, pursuitRows, searchIntake, userEmail, isIndependentTrack, activityFacts, priorSessionAt, sessionOpenRequested, tzOffsetMinutes)'),
  `${COACH}: buildCoachProfileSlice is not called with tzOffsetMinutes`)
check(coach.includes("tzOffsetMinutes: typeof (req.body && req.body.tzOffsetMinutes) === 'number' ? req.body.tzOffsetMinutes : 0,"),
  `${COACH}: the handler does not read tzOffsetMinutes off req.body (with a safe 0/UTC default) when calling buildCoachRequest`)

// A malformed or missing offset must degrade to UTC (0), never throw or
// silently produce a garbage date -- an old cached client that never sends
// this field must keep working exactly as before.
check(/Math\.abs\(tzOffsetMinutes\) <= 840 \? tzOffsetMinutes : 0/.test(coach),
  `${COACH}: localTodayStr no longer clamps an out-of-range or non-numeric offset back to 0`)

// The client actually sends its own offset on every /api/coach call.
check(chat.includes('tzOffsetMinutes: new Date().getTimezoneOffset(),'),
  `${CHAT}: the /api/coach request no longer sends the client's own timezone offset`)

// --- #3.7: streaming/retry docs --------------------------------------------

// The three places that claimed live streaming forecloses a pre-display
// retry must no longer say so -- each is corrected to describe the real
// mechanism (api/coach.js buffers and retries server-side before the first
// byte ships).
check(!claudeMd.includes('Coach’s live chat replies stream directly into the UI and cannot go through the silent pre-display retry') &&
  !claudeMd.includes("Coach's live chat replies stream directly into the UI and cannot go through the silent pre-display retry"),
  `${CLAUDE_MD}: still asserts that live streaming forecloses a pre-display retry -- api/coach.js already runs one server-side`)
check(claudeMd.includes('finding #3.7'),
  `${CLAUDE_MD}: the corrected passage does not cite finding #3.7, so a future reader has no trail back to why this changed`)

check(!chat.includes("Coach's live replies stream straight into the visible UI, so a"),
  `${CHAT}: still asserts that live streaming forecloses a pre-display retry`)
check(chat.includes('finding #3.7'),
  `${CHAT}: the corrected comment does not cite finding #3.7`)

check(!app.includes("Coach's live chat replies stream straight into the visible UI (Chat.jsx),"),
  `${APP}: still asserts that live streaming forecloses a pre-display retry`)
check(/finding #3\.7[\s\S]{0,700}handleCoachVoiceViolation/.test(app),
  `${APP}: the corrected comment does not sit directly above handleCoachVoiceViolation, or does not cite finding #3.7`)

// Deliberately UNCHANGED: the client-side detector itself. Pre-flight
// discovery found no actual double-counting to fix (the server's own retry
// outcome is console.log-only, never persisted anywhere the client's
// corrections-log entries could collide with) -- removing Bob's only
// visibility into what reaches production would be a regression, not a fix.
check(chat.includes("detectVoiceViolations(fullText, { scope: 'runtime' }).filter(v => v.severity === 'hard')"),
  `${CHAT}: the post-stream voice-violation detector was removed or changed -- this was a deliberate keep (see this test's header), not part of #3.7's fix`)
check(app.includes('const handleCoachVoiceViolation=(violations)=>{'),
  `${APP}: handleCoachVoiceViolation was removed -- this was a deliberate keep, not part of #3.7's fix`)

if (failures) {
  console.error(`test-coach-timezone-streaming-docs: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-coach-timezone-streaming-docs: OK (every coach.js date computation now derives from the client\'s own local date via localTodayStr/tzOffsetMinutes with a safe UTC fallback, the TODAY\'S DATE anchor dropped its now-inaccurate "(UTC)" label, and the three comments misdescribing why the client keeps its post-stream voice check were corrected without removing the check itself)')
}
