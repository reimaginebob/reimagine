// Guards finding 6.3 item 2 from the 2026-09-08 prelaunch audit: silent
// Coach turns -- session-open, orientation-check, post-capture -- fire on a
// standing scripted instruction the client sends with nobody typing
// anything, not an open-ended coaching question. They need the persona/
// voice rules and the person's profile to react appropriately, but not the
// step-specific user-guide slice or the book (MYOW_CONTENT), and they don't
// need the model reasoning as broadly as a real question does either.
// api/coach.js's own `system`-array and `effort` shape (guarded in detail
// by scripts/test-coach-cache-blocks.mjs) is what this PR trims; this file
// covers the pure precedence logic that decides WHICH turns get trimmed --
// computeTurnKind, re-derived here as a pure predicate the same way this
// batch's other DB-touching-file logic has been (api/coach.js constructs
// Postgres/Resend clients eagerly at module load, so it can't be imported
// standalone) -- plus source-presence checks that the handler actually
// wires turnKind and effort together correctly.
import fs from 'node:fs'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

// --- computeTurnKind, re-derived: the exact precedence api/coach.js uses ---

function computeTurnKind(rawMessage, { orientationCheckRequested, postCaptureUpdateRequested, sessionOpenRequested }) {
  if (typeof rawMessage === 'string' && rawMessage.trim()) return 'user'
  if (orientationCheckRequested) return 'orientation_check'
  if (postCaptureUpdateRequested) return 'post_capture'
  if (sessionOpenRequested) return 'session_open'
  return 'user'
}

// A real typed message always wins as 'user', even if every silent-turn
// flag also somehow came back true -- a person who typed something gets a
// real answer, never a scripted one.
check(computeTurnKind('what should I say in the interview', { orientationCheckRequested: true, postCaptureUpdateRequested: true, sessionOpenRequested: true }) === 'user',
  'a real typed message must win as \'user\' even when every silent-turn flag is true')
check(computeTurnKind('   ', { orientationCheckRequested: false, postCaptureUpdateRequested: false, sessionOpenRequested: true }) === 'session_open',
  'a whitespace-only rawMessage must not count as a real message')
check(computeTurnKind(undefined, { orientationCheckRequested: true, postCaptureUpdateRequested: true, sessionOpenRequested: true }) === 'orientation_check',
  'orientation_check must take precedence over post_capture and session_open')
check(computeTurnKind(undefined, { orientationCheckRequested: false, postCaptureUpdateRequested: true, sessionOpenRequested: true }) === 'post_capture',
  'post_capture must take precedence over session_open')
check(computeTurnKind(undefined, { orientationCheckRequested: false, postCaptureUpdateRequested: false, sessionOpenRequested: true }) === 'session_open',
  'session_open must fire when it is the only true flag')
check(computeTurnKind(undefined, { orientationCheckRequested: false, postCaptureUpdateRequested: false, sessionOpenRequested: false }) === 'user',
  'no message and no flags must default to \'user\', not throw or return something else')

// --- effort-by-turnKind: 'user' gets 'medium', every silent kind gets 'low' ---

function effortFor(turnKind) {
  return turnKind === 'user' ? 'medium' : 'low'
}
check(effortFor('user') === 'medium', '\'user\' turns must run at effort \'medium\' -- a real coaching question needs the broader reasoning')
check(effortFor('orientation_check') === 'low', 'orientation_check turns must run at effort \'low\'')
check(effortFor('post_capture') === 'low', 'post_capture turns must run at effort \'low\'')
check(effortFor('session_open') === 'low', 'session_open turns must run at effort \'low\'')

// --- Source-presence: api/coach.js wires turnKind into the trim + effort --

const FILE = 'api/coach.js'
const src = fs.readFileSync(FILE, 'utf8')

check(src.includes('const isSilentTurn = turnKind && turnKind !== \'user\''),
  `${FILE}: the isSilentTurn derivation is missing or no longer matches computeTurnKind's 'user' sentinel`)
check(/export function buildCoachRequest\(\{[\s\S]{0,700}\bturnKind\b[\s\S]{0,50}\}\)/.test(src),
  `${FILE}: buildCoachRequest's parameter list no longer destructures turnKind`)
check(/generalMode, milestoneMentions, closeReasons, turnKind,/.test(src),
  `${FILE}: the handler's buildCoachRequest({...}) call no longer passes turnKind through`)
check(/const effort = turnKind === 'user' \? 'medium' : 'low'/.test(src),
  `${FILE}: the effort-by-turnKind const is missing or its 'user'->'medium' / else->'low' mapping changed`)

// The effort const must be computed AFTER turnKind and BEFORE both
// generate() calls, or a silent turn could ship with the wrong effort (or
// the code wouldn't compile at all -- a use-before-define).
const turnKindIdx = src.indexOf('const turnKind = computeTurnKind(')
const effortIdx = src.indexOf('const effort = turnKind ===')
const primaryGenerateIdx = src.indexOf('raw = await generate(messages, effort)')
const retryGenerateIdx = src.indexOf('generate([...messages, { role: \'assistant\', content: raw }, { role: \'user\', content: corrective }], effort)')
check(turnKindIdx !== -1 && effortIdx !== -1 && primaryGenerateIdx !== -1 && retryGenerateIdx !== -1 &&
  turnKindIdx < effortIdx && effortIdx < primaryGenerateIdx && primaryGenerateIdx < retryGenerateIdx,
  `${FILE}: turnKind, effort, the primary generate() call, and the voice-retry generate() call are no longer in that order -- effort must be computed from turnKind before either call, and both calls must use the same effort`)

if (failures) {
  console.error(`test-coach-silent-turn-trim: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-coach-silent-turn-trim: OK (computeTurnKind\'s precedence is right, effort maps \'user\'->medium and every silent kind->low, and api/coach.js wires turnKind through to both the system-array trim and both generate() calls in the right order)')
}
