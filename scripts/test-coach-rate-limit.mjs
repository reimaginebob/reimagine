// Guards finding #2.2 from the 2026-09-08 prelaunch audit: My Coach had no
// rate limit at all. api/claude.js's shared hourly generation cap explicitly
// excludes kind='coach' rows (a different usage pattern -- an active
// back-and-forth is expected, not a handful of button-click generations),
// and api/admin/activity-watchdog.js excludes them the same way. Message
// length and history content were unbounded too.
//
// BEHAVIORAL for messageExceedsByteCap (a pure function, exported for this
// reason): imports the real module with dummy env vars and calls it
// directly. The turn-cap check itself is a live SQL query gated on a real
// session and cannot be exercised without a live DB; it is guarded by
// source-presence checks that confirm it runs before the profile read, uses
// a 429 (not the generation cap's auto-suspend), and exempts @career.club
// the same way the generation cap does.
import fs from 'node:fs'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

process.env.DATABASE_URL ||= 'postgres://user:pass@localhost/dummy'
process.env.RESEND_API_KEY ||= 'dummy'
process.env.ANTHROPIC_API_KEY ||= 'dummy'

const { messageExceedsByteCap, MAX_MESSAGE_BYTES, COACH_TURN_CAP_HR } = await import('../api/coach.js')

// --- messageExceedsByteCap -------------------------------------------------

check(messageExceedsByteCap('hello') === false, 'a short, ordinary message was flagged as too long')
check(messageExceedsByteCap('') === false, 'an empty string was flagged as too long')
check(messageExceedsByteCap(undefined) === false, 'a non-string (undefined) was flagged as too long -- the shape check upstream handles that case, not this one')
check(messageExceedsByteCap(null) === false, 'a non-string (null) was flagged as too long')
check(messageExceedsByteCap(123) === false, 'a non-string (number) was flagged as too long')

check(messageExceedsByteCap('a'.repeat(MAX_MESSAGE_BYTES)) === false, `a message exactly at the ${MAX_MESSAGE_BYTES}-byte cap was rejected -- the cap should be exclusive (over, not at)`)
check(messageExceedsByteCap('a'.repeat(MAX_MESSAGE_BYTES + 1)) === true, `a message one byte over the ${MAX_MESSAGE_BYTES}-byte cap was not caught`)
check(messageExceedsByteCap('a'.repeat(MAX_MESSAGE_BYTES * 3)) === true, 'a grossly oversized message was not caught')

// Measured in BYTES, not characters: a multi-byte character string can be
// well under the character count while over the byte cap. '𝔘' below is a
// 4-byte UTF-8 character (U+1D518, outside the BMP) -- 2001 of them is 8004
// bytes, one character over what a character-count check of the same limit
// would have allowed through.
{
  const multiByteChar = '𝔘'
  check(Buffer.byteLength(multiByteChar, 'utf8') === 4, 'test assumption broken: expected a 4-byte UTF-8 test character')
  const justOver = multiByteChar.repeat(Math.floor(MAX_MESSAGE_BYTES / 4) + 1)
  check(messageExceedsByteCap(justOver) === true,
    'a multi-byte-character message over the byte cap was not caught -- this check must measure bytes, not characters, or a multi-byte paste bypasses it')
}

// --- Source-presence: the turn cap runs before the profile read, throttles

const COACH = 'api/coach.js'
const coach = fs.readFileSync(COACH, 'utf8')

check(typeof COACH_TURN_CAP_HR === 'number' && COACH_TURN_CAP_HR > 0, 'COACH_TURN_CAP_HR is not a positive number')

const byteCapIdx = coach.indexOf('if (messageExceedsByteCap(rawMessage)) {')
check(byteCapIdx !== -1, `${COACH}: the byte-cap check is missing from the handler`)

const turnCapIdx = coach.indexOf("SELECT COUNT(*)::int AS n FROM generation_events WHERE user_id = ${user.id} AND kind = 'coach' AND created_at >= NOW() - INTERVAL '1 hour'")
check(turnCapIdx !== -1, `${COACH}: the per-user Coach turns-per-hour query is missing or has drifted`)

check(coach.includes("if (turnCount >= COACH_TURN_CAP_HR) {") && coach.includes("return res.status(429).json({ error: 'rate_limited'"),
  `${COACH}: hitting the turn cap does not return a 429 rate_limited response`)
check(!/turnCount >= COACH_TURN_CAP_HR[\s\S]{0,200}suspended_at = NOW\(\)/.test(coach),
  `${COACH}: the Coach turn cap appears to auto-suspend the account -- this should be a temporary 429 throttle, not the generation cap's suspend treatment (Coach is meant to be used continuously)`)

check(/if \(!\/@career\\\.club\$\/i\.test\(user\.email \|\| ''\)\) \{\s*try \{\s*const turnCapRows/.test(coach),
  `${COACH}: the turn-cap check no longer exempts @career.club accounts`)

// Both new checks must run BEFORE the profile read (the requirement in
// finding #2.2's own fix line), and before generalMode is computed.
const profileReadIdx = coach.indexOf("SELECT profile_state, employment_status, feature_flags, track")
check(byteCapIdx !== -1 && profileReadIdx !== -1 && byteCapIdx < profileReadIdx,
  `${COACH}: the byte-cap check runs after the profile read, not before it`)
check(turnCapIdx !== -1 && profileReadIdx !== -1 && turnCapIdx < profileReadIdx,
  `${COACH}: the turn-cap check runs after the profile read, not before it`)

// The turn-cap query must fail OPEN, matching the generation cap's own
// precedent -- a counting hiccup must never block a legitimate turn.
const turnCapBlockEnd = coach.indexOf('}', coach.indexOf("catch (e) { console.error('coach turn-cap check skipped:'", turnCapIdx))
check(coach.indexOf("catch (e) { console.error('coach turn-cap check skipped:'", turnCapIdx) !== -1,
  `${COACH}: the turn-cap check has no fail-open catch -- a DB hiccup would block every Coach turn`)

if (failures) {
  console.error(`test-coach-rate-limit: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-coach-rate-limit: OK (messageExceedsByteCap correctly measures UTF-8 bytes not characters, and the per-user Coach turns-per-hour cap runs before the profile read, throttles with a 429 rather than suspending, fails open on a DB hiccup, and exempts @career.club)')
}
