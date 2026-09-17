// The operational error trail's privacy boundary, tested where it actually
// lives: sanitizeSupportEvent (api/_lib/support-events.js) is the one function
// every write goes through, so it is exercised BEHAVIORALLY here -- real calls,
// real return values -- rather than grepped for.
//
// What this guards is narrow and load-bearing: a support_events row must never
// be able to carry prompt text, reply text, profile or resume content, or a
// stack trace, and the only free-text column it has must be capped at 200
// characters. The failure mode is not a crash; it is a row that quietly
// contains something it should not, which nobody notices until it matters.
//
// The DB-touching parts (recordSupportEvent's INSERT, clientEventRateLimited's
// COUNT, the cleanup cron's DELETEs) have no live Postgres here, so those are
// source-presence checks -- the same constraint every other DB-dependent test
// in this repo works under. The arithmetic that decides WHAT gets deleted is
// asserted against the SQL text, because "90 days" quietly becoming "900" is
// exactly the kind of change that would pass every other gate.
import fs from 'node:fs'

// api/_lib/db.js calls neon() at module scope, which throws without a
// connection string, so the import below needs one to exist. Same dummy value
// every other api/* test in this repo uses (test-admin-session-auth.mjs,
// test-coach-rate-limit.mjs). Nothing here opens a connection: the function
// under test is pure.
process.env.DATABASE_URL ||= 'postgres://user:pass@localhost/dummy'
const { sanitizeSupportEvent, SUPPORT_EVENT_KINDS, CLIENT_SUPPORT_EVENT_KINDS, DETAIL_MAX } =
  await import('../api/_lib/support-events.js')

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

// --- The allowed-field filter is a WHITELIST, not a blacklist --------------
//
// The distinction is the whole design. A blacklist has to anticipate every
// content-bearing key a caller might invent; a whitelist cannot be widened by
// the caller at all. api/support/client-event.js's caller is a browser, so
// this is the guarantee that matters most.

const leaky = sanitizeSupportEvent('client_crash', {
  step: 'p3',
  // Every one of these is a key a well-meaning future caller might add, and
  // every one of them carries content that must never reach the table.
  prompt: 'Here is my whole resume: ...',
  reply: 'Your Personal Brand is ...',
  resume: 'CONFIDENTIAL',
  profile: { values: 'family' },
  message: 'the user typed this',
  stack: 'at Foo (App.jsx:1)\n  at Bar',
  componentStack: '\n    in Chat\n    in App',
  email: 'someone@example.com',
})
check(leaky !== null, 'sanitizeSupportEvent returned null for a valid kind')
const leakedKeys = Object.keys(leaky).filter(k => !['kind', 'step', 'error_class', 'http_status', 'duration_ms', 'build_sha', 'user_agent', 'detail'].includes(k))
check(leakedKeys.length === 0,
  `sanitizeSupportEvent passed through keys outside the allowed set: ${leakedKeys.join(', ')} -- the filter must be a whitelist, so an unknown key is dropped rather than forwarded to the INSERT`)
const serialized = JSON.stringify(leaky)
for (const secret of ['resume', 'CONFIDENTIAL', 'Personal Brand', 'the user typed this', 'App.jsx:1', 'someone@example.com', 'family']) {
  check(!serialized.includes(secret),
    `sanitizeSupportEvent's output still contains ${JSON.stringify(secret)} -- content reached a support_events row`)
}
check(leaky.step === 'p3', 'sanitizeSupportEvent dropped `step`, which IS an allowed column')

// The returned object must be a fresh one. Handing back the caller's object
// with extra keys deleted would let a later mutation of the caller's copy
// reach the row.
const caller = { step: 'op' }
const sanitized = sanitizeSupportEvent('save_failed', caller)
check(sanitized !== caller, 'sanitizeSupportEvent returned the caller\'s own object rather than a fresh one')

// --- The 200-character detail cap -----------------------------------------

const long = sanitizeSupportEvent('generation_failed', { detail: 'x'.repeat(5000) })
check(long.detail.length === DETAIL_MAX,
  `detail was not capped at ${DETAIL_MAX} characters (got ${long.detail.length}) -- the database CHECK would reject the INSERT and the failure would go unrecorded`)
check(DETAIL_MAX === 200, `DETAIL_MAX is ${DETAIL_MAX}; the brief and the migration's CHECK both say 200`)

// Newlines and control characters collapse: a multi-line value is a stack
// trace trying to get in through the one free-text column.
const multiline = sanitizeSupportEvent('client_crash', { detail: 'Boom\n    at Foo\n    at Bar' })
check(!multiline.detail.includes('\n'),
  'detail kept its newlines -- a multi-line detail is a stack trace, and the column is for a one-line error message')

// --- Type coercion on the numeric columns ---------------------------------
//
// http_status and duration_ms are int4. A browser can post anything at all
// into them, and a value Postgres cannot store means the whole INSERT fails,
// which loses the event entirely.

const nums = sanitizeSupportEvent('save_failed', { http_status: '413', duration_ms: 1234.9 })
check(nums.http_status === 413, `http_status '413' did not coerce to the number 413 (got ${JSON.stringify(nums.http_status)})`)
check(nums.duration_ms === 1234, `duration_ms 1234.9 was not truncated to an integer (got ${JSON.stringify(nums.duration_ms)})`)
const junkNums = sanitizeSupportEvent('save_failed', { http_status: 'not a number', duration_ms: -5 })
check(junkNums.http_status === null, 'a non-numeric http_status must become NULL, not reach the INSERT as text')
check(junkNums.duration_ms === null, 'a negative duration_ms must become NULL -- it is a clock artifact, not data')
const overflow = sanitizeSupportEvent('save_failed', { duration_ms: 99999999999 })
check(overflow.duration_ms === null,
  'a duration_ms past int4 range must become NULL -- otherwise Postgres rejects the whole row and the event is lost')

// Absent fields are explicit nulls, not undefined: the INSERT binds all nine
// columns positionally, and an undefined would bind as something else.
const sparse = sanitizeSupportEvent('coach_failed', {})
for (const col of ['step', 'error_class', 'http_status', 'duration_ms', 'build_sha', 'user_agent', 'detail']) {
  check(sparse[col] === null, `an absent ${col} came back as ${JSON.stringify(sparse[col])} rather than null`)
}

// --- The kind is a closed set ---------------------------------------------

check(sanitizeSupportEvent('anything_else', { step: 'p3' }) === null,
  'an unrecognized kind must return null so recordSupportEvent refuses the write outright')
check(sanitizeSupportEvent(null, {}) === null, 'a null kind must return null')
check(sanitizeSupportEvent(42, {}) === null, 'a non-string kind must return null')
for (const kind of SUPPORT_EVENT_KINDS) {
  check(sanitizeSupportEvent(kind, {}) !== null, `${kind} is in SUPPORT_EVENT_KINDS but sanitizeSupportEvent rejects it`)
}
// The brief's original four, plus coach_summary_scope_bleed (2026-09-18): a
// conversation summary about to be filed against one opportunity while naming
// another, suppressed rather than saved. Checked as an exact set rather than a
// count, because what matters is that this stays a short, deliberate allowlist
// -- a kind that is not here cannot be written at all, which is the property
// that keeps this table from becoming a general log.
check(SUPPORT_EVENT_KINDS.length === 5,
  `SUPPORT_EVENT_KINDS has ${SUPPORT_EVENT_KINDS.length} kinds -- adding one is a deliberate act, so update this test along with it`)
for (const k of ['generation_failed', 'coach_failed', 'client_crash', 'save_failed', 'coach_summary_scope_bleed']) {
  check(SUPPORT_EVENT_KINDS.includes(k), `SUPPORT_EVENT_KINDS is missing ${k}`)
}

// The browser-postable subset must stay a STRICT subset. If generation_failed
// ever became client-postable, a browser could invent failures the server
// never saw, which makes the trail worse than not having one.
check(CLIENT_SUPPORT_EVENT_KINDS.every(k => SUPPORT_EVENT_KINDS.includes(k)),
  'CLIENT_SUPPORT_EVENT_KINDS contains a kind that is not a support event kind at all')
check(!CLIENT_SUPPORT_EVENT_KINDS.includes('generation_failed') && !CLIENT_SUPPORT_EVENT_KINDS.includes('coach_failed'),
  'a server-side failure kind became browser-postable -- a client could then fabricate failures the server never observed')

// --- Migration: the schema IS the privacy boundary ------------------------

const MIGRATION = 'migrations/2026-09-14_support-events.sql'
check(fs.existsSync(MIGRATION), `${MIGRATION}: file is missing`)
const migration = fs.readFileSync(MIGRATION, 'utf8')

check(/CREATE TABLE IF NOT EXISTS support_events/.test(migration),
  `${MIGRATION}: support_events is missing or not idempotent (IF NOT EXISTS) -- migrations auto-apply on every production deploy and must re-run as a no-op`)
check(/CREATE TABLE IF NOT EXISTS support_diagnostics/.test(migration),
  `${MIGRATION}: support_diagnostics is missing or not idempotent`)
check(/user_id\s+uuid\s+REFERENCES users\(id\) ON DELETE CASCADE/.test(migration),
  `${MIGRATION}: user_id must cascade on user delete -- an account deletion must take its error trail with it`)
check(/CHECK \(detail IS NULL OR char_length\(detail\) <= 200\)/.test(migration),
  `${MIGRATION}: the 200-character CHECK on detail is missing -- the application cap in support-events.js is then the ONLY thing standing between a careless caller and content in the table`)
check(/CREATE INDEX IF NOT EXISTS support_events_user_idx ON support_events \(user_id, created_at DESC\)/.test(migration),
  `${MIGRATION}: the (user_id, created_at DESC) index is missing -- both the per-account timeline and the per-user rate-limit count read through it`)
check(/CREATE INDEX IF NOT EXISTS support_events_created_idx ON support_events \(created_at\)/.test(migration),
  `${MIGRATION}: the (created_at) index is missing -- the nightly retention sweep has no user_id to narrow by and would scan the whole table`)

// No content-bearing column may exist on support_events. This is the check
// that would catch someone "just adding" a message or prompt column later.
const supportEventsDdl = migration.slice(migration.indexOf('CREATE TABLE IF NOT EXISTS support_events'), migration.indexOf('CREATE TABLE IF NOT EXISTS support_diagnostics'))
for (const banned of ['prompt', 'reply', 'message', 'content', 'resume', 'profile_state', 'stack', 'transcript', 'email']) {
  check(!new RegExp(`^\\s*${banned}\\b`, 'mi').test(supportEventsDdl),
    `${MIGRATION}: support_events has a '${banned}' column -- this table carries no user content, and adding one is a policy change, not a schema change`)
}

// --- Server-side failure recording at all four sites ----------------------

const claude = fs.readFileSync('api/claude.js', 'utf8')
check(/import \{ recordSupportEvent \} from '\.\/_lib\/support-events\.js'/.test(claude),
  "api/claude.js: recordSupportEvent is not imported -- note the .js extension; a .mjs import across the api/src boundary is the 2026-05-27 FUNCTION_INVOCATION_FAILED outage")
const claudeCalls = (claude.match(/recordSupportEvent\(/g) || []).length
check(claudeCalls === 3,
  `api/claude.js: expected 3 recordSupportEvent calls (the non-2xx path, the network-throw catch, and the empty-output case), found ${claudeCalls}`)
check(/error_class: 'empty_output'/.test(claude),
  "api/claude.js: the empty-output case is not recorded -- a 200 with no text is the 'it just never came back' failure, and it reaches neither upstream-failure path")
check(/generation_events/.test(claude) && !/INSERT INTO generation_events[\s\S]{0,600}generation_failed/.test(claude),
  'api/claude.js: a failure must not write a generation_events row -- that would inflate the month\'s generation count and push the user toward the hourly cap for a call that never ran')

const coach = fs.readFileSync('api/coach.js', 'utf8')
check(/import \{ recordSupportEvent \} from '\.\/_lib\/support-events\.js'/.test(coach),
  'api/coach.js: recordSupportEvent is not imported')
const coachCalls = (coach.match(/recordSupportEvent\(/g) || []).length
check(coachCalls === 3,
  `api/coach.js: expected 3 recordSupportEvent calls (the upstream-error branch, the 429 turn-cap branch, and the suppressed cross-opportunity summary), found ${coachCalls}`)
// The new one is not a failure the person saw, so it must not claim to be one.
check(/'coach_summary_scope_bleed'/.test(coach),
  'api/coach.js: the suppressed-summary event does not use its own kind')
{
  // No user content in the row: the name that matched is a company from this
  // person's own pipeline (CLAUDE.md section 8, no exceptions).
  const i = coach.indexOf("'coach_summary_scope_bleed'")
  const block = i === -1 ? '' : coach.slice(i, i + 700)
  check(!/\$\{bleed\}|\$\{name\}|\$\{inFocus/.test(block),
    'api/coach.js: the suppressed-summary event interpolates pipeline content into detail -- this table carries no user content')
}
check(/error_class: 'rate_limited'/.test(coach),
  "api/coach.js: the 429 turn-cap branch is not recorded with error_class 'rate_limited' -- from the user's side a cap and an outage look identical")

const save = fs.readFileSync('api/profile/save.js', 'utf8')
check(/recordSupportEvent/.test(save), 'api/profile/save.js: save failures are not recorded')
for (const [cls, status] of [['too_large', 413], ['stale', 409], ['server', 500]]) {
  check(new RegExp(`'${cls}', ${status}`).test(save),
    `api/profile/save.js: the ${status} response does not record a '${cls}' save_failed event`)
}
// The 500 path's detail is the one place a Postgres driver message could
// smuggle the offending VALUE into the row, and the offending value here is
// the user's own profile blob.
const serverDetail = (save.match(/recordSaveFailure\(req, 'server', 500, ([^,]+),/) || [])[1] || ''
check(/err && err\.code|err\?\.code/.test(serverDetail),
  `api/profile/save.js: the 500 path's detail is ${JSON.stringify(serverDetail.trim())} -- it must be built from the pgCode, never from err.message, which can quote the offending value back and the offending value here is the user's profile`)

// --- The retention sweep --------------------------------------------------

const CLEANUP = 'api/admin/cleanup.js'
check(fs.existsSync(CLEANUP), `${CLEANUP}: file is missing`)
const cleanup = fs.readFileSync(CLEANUP, 'utf8')

check(/SUPPORT_RETENTION_DAYS = 90/.test(cleanup),
  `${CLEANUP}: the retention window is not 90 days -- src/legalDocs.js promises "typically 30 to 90 days", so 90 is the ceiling, not a starting point`)
for (const table of ['support_events', 'support_diagnostics']) {
  check(new RegExp(`DELETE FROM ${table}\\s+WHERE created_at < NOW\\(\\) - \\(\\$\\{SUPPORT_RETENTION_DAYS\\} \\* INTERVAL '1 day'\\)`).test(cleanup),
    `${CLEANUP}: ${table} is not pruned on the SUPPORT_RETENTION_DAYS window -- without this, the privacy page's retention promise stops being true`)
}
for (const table of ['sessions', 'magic_link_tokens', 'oauth_codes']) {
  check(new RegExp(`DELETE FROM ${table}\\s+WHERE expires_at < NOW\\(\\)`).test(cleanup),
    `${CLEANUP}: expired rows in ${table} are not pruned (prelaunch audit finding #3.10)`)
}
// The one predicate here that is easy to get wrong and expensive when wrong.
check(/DELETE FROM oauth_tokens\s+WHERE COALESCE\(refresh_expires_at, expires_at\) < NOW\(\)/.test(cleanup),
  `${CLEANUP}: oauth_tokens must be pruned on COALESCE(refresh_expires_at, expires_at), NOT on expires_at alone -- expires_at is the ACCESS token's expiry (about an hour), while the row stays live for as long as its refresh token does. Pruning on expires_at would revoke every connector-beta bearer token hourly.`)
check(/process\.env\.CRON_SECRET/.test(cleanup) && /if \(!expected\)/.test(cleanup) && /status\(500\)/.test(cleanup),
  `${CLEANUP}: must 500 with a clear log line when CRON_SECRET is unconfigured rather than 403ing as if a caller sent the wrong token`)
check(/req\.headers\.authorization \|\| ''\)\s*!==\s*`Bearer \$\{expected\}`/.test(cleanup),
  `${CLEANUP}: the auth compare should match the sibling cron endpoints' Bearer-token shape`)
check(/alertOnce\(/.test(cleanup),
  `${CLEANUP}: a failing sweep must page the operator -- a retention sweep that has silently stopped running looks exactly like one that is working`)

const crons = JSON.parse(fs.readFileSync('vercel.json', 'utf8')).crons || []
const cleanupCron = crons.find(c => c.path === '/api/admin/cleanup')
check(!!cleanupCron, 'vercel.json: no cron entry registered for /api/admin/cleanup -- the table would grow forever')
if (cleanupCron) {
  check(/^\d{1,2} \d{1,2} \* \* \*$/.test(cleanupCron.schedule || ''),
    `vercel.json: cleanup's schedule "${cleanupCron.schedule}" is not a well-formed daily cron string`)
  const clash = crons.filter(c => c.schedule === cleanupCron.schedule)
  check(clash.length === 1,
    `vercel.json: cleanup shares its schedule with ${clash.length - 1} other cron(s) -- stagger them so they do not compete for DB connections`)
}

if (failures) {
  console.error(`test-support-events: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-support-events: OK (sanitizeSupportEvent drops every field outside the allowed set and caps detail at 200 chars, the migration carries the CHECK and both indexes and no content column, all four server failure sites record, and the nightly sweep prunes on the right predicates -- including oauth_tokens on refresh expiry rather than access expiry)')
}
