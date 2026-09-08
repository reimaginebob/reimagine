// Guards finding #2.6 from the 2026-09-08 prelaunch audit: a corrupted or
// accidentally-emptied profile_state had no way back short of a full Neon
// point-in-time restore -- a whole-database operation, not a per-user undo.
// This PR adds a nightly snapshot table (migrations/2026-09-08_profile-
// state-snapshots.sql) written by a new cron endpoint
// (api/admin/profile-snapshot.js). The Neon PITR window itself could not
// be confirmed from this sandbox (no Neon console/API access here), so it
// was documented in CLAUDE.md as unconfirmed rather than guessed; Bob
// confirmed it directly the same day (7 days) and CLAUDE.md was updated
// with the real number.
//
// SOURCE-PRESENCE throughout: the migration is schema (nothing to execute
// without a live Postgres connection -- same constraint as every other
// DB-dependent piece in this batch), the cron endpoint's only real logic is
// its auth compare and its INSERT...SELECT shape, and vercel.json/CLAUDE.md
// are config and docs. There is no pure function here to extract and run
// standalone.
import fs from 'node:fs'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

// --- Migration: table + index shape ---------------------------------

const MIGRATION = 'migrations/2026-09-08_profile-state-snapshots.sql'
check(fs.existsSync(MIGRATION), `${MIGRATION}: file is missing`)
const migration = fs.readFileSync(MIGRATION, 'utf8')

check(/CREATE TABLE IF NOT EXISTS profile_state_snapshots/.test(migration),
  `${MIGRATION}: the profile_state_snapshots table definition is missing or not idempotent (IF NOT EXISTS)`)
check(/user_id\s+uuid NOT NULL REFERENCES users\(id\) ON DELETE CASCADE/.test(migration),
  `${MIGRATION}: user_id must be a NOT NULL FK to users(id) with ON DELETE CASCADE -- a snapshot for a deleted account should not orphan`)
check(/profile_state\s+jsonb NOT NULL/.test(migration),
  `${MIGRATION}: profile_state must be a NOT NULL jsonb column -- this is the actual backup payload`)
check(/source_updated_at\s+timestamptz/.test(migration),
  `${MIGRATION}: source_updated_at is missing -- without it a restored snapshot can't be checked against the live row's own profile_updated_at`)
check(/snapshotted_at\s+timestamptz NOT NULL DEFAULT NOW\(\)/.test(migration),
  `${MIGRATION}: snapshotted_at must default to NOW() so every insert is self-timestamping`)
check(/CREATE INDEX IF NOT EXISTS profile_state_snapshots_user_idx ON profile_state_snapshots \(user_id, snapshotted_at DESC\)/.test(migration),
  `${MIGRATION}: the (user_id, snapshotted_at DESC) index is missing or not idempotent -- without it, finding "the most recent snapshot for this user" is a full table scan`)

// --- Cron endpoint: auth + query shape --------------------------------

const ENDPOINT = 'api/admin/profile-snapshot.js'
check(fs.existsSync(ENDPOINT), `${ENDPOINT}: file is missing`)
const endpoint = fs.readFileSync(ENDPOINT, 'utf8')

check(endpoint.includes("process.env.CRON_SECRET"),
  `${ENDPOINT}: must read CRON_SECRET from the environment, matching the sibling cron endpoints' auth convention`)
check(/req\.headers\.authorization \|\| ''\)\s*!==\s*`Bearer \$\{expected\}`/.test(endpoint),
  `${ENDPOINT}: expected a plain !== Bearer-token compare -- this endpoint is a same-project cron secret (not the ADMIN_TOKEN browser-facing case PR6 hardened to constant-time), so it should match the OTHER untouched crons, not diverge`)
check(!endpoint.includes('constantTimeEqual'),
  `${ENDPOINT}: unexpectedly imports constantTimeEqual -- that hardening was PR6's scope for ADMIN_TOKEN specifically; this cron's CRON_SECRET check should stay consistent with its sibling crons`)
check(/INSERT INTO profile_state_snapshots \(user_id, profile_state, source_updated_at\)/.test(endpoint),
  `${ENDPOINT}: the INSERT target columns are missing or no longer match the migration's schema`)
check(/SELECT id, profile_state, profile_updated_at\s*\n\s*FROM users/.test(endpoint),
  `${ENDPOINT}: expected an INSERT...SELECT straight from the users table -- one row per account, every run`)
check(endpoint.includes('RETURNING id'),
  `${ENDPOINT}: RETURNING id is missing -- the handler reports rows.length as the snapshotted count, which needs this to be accurate`)
check(!expected_missing_500(endpoint),
  `${ENDPOINT}: should 500 with a clear log line when CRON_SECRET itself is unconfigured, not silently 403 as if a caller sent the wrong token`)

function expected_missing_500(src) {
  return !(/if \(!expected\)/.test(src) && /status\(500\)/.test(src))
}

// --- vercel.json: cron registration -----------------------------------

const VERCEL_JSON = 'vercel.json'
const vercelConfig = JSON.parse(fs.readFileSync(VERCEL_JSON, 'utf8'))
const crons = Array.isArray(vercelConfig.crons) ? vercelConfig.crons : []
const snapshotCron = crons.find(c => c.path === '/api/admin/profile-snapshot')
check(!!snapshotCron, `${VERCEL_JSON}: no cron entry registered for /api/admin/profile-snapshot`)
if (snapshotCron) {
  check(/^\d{1,2} \d{1,2} \* \* \*$/.test(snapshotCron.schedule || ''),
    `${VERCEL_JSON}: profile-snapshot's cron schedule "${snapshotCron.schedule}" is not a well-formed daily (5-field) cron string`)
  const stageSnapshotCron = crons.find(c => c.path === '/api/admin/stage-snapshot')
  check(!stageSnapshotCron || stageSnapshotCron.schedule !== snapshotCron.schedule,
    `${VERCEL_JSON}: profile-snapshot and stage-snapshot are scheduled at the exact same time -- stagger them so they don't compete for DB connections on every account`)
}

// --- CLAUDE.md: the PITR window is documented, not guessed --------------
//
// 2026-09-08: Bob confirmed the number directly (7 days) after checking the
// Neon console, so this no longer guards an "unconfirmed" placeholder --
// it guards that the real, confirmed number stayed written down rather
// than reverting to a guess or going missing again.

const CLAUDE_MD = 'CLAUDE.md'
const claudeMd = fs.readFileSync(CLAUDE_MD, 'utf8')

check(claudeMd.includes('finding #2.6'),
  `${CLAUDE_MD}: the backup/recovery bullet no longer references finding #2.6`)
check(/Neon.{0,40}PITR|PITR.{0,40}window/i.test(claudeMd),
  `${CLAUDE_MD}: the Neon PITR window is not mentioned -- this bullet exists specifically to document that number`)
check(/PITR\)[\s\S]{0,80}is \*\*7 days\*\*/.test(claudeMd),
  `${CLAUDE_MD}: the confirmed PITR window (7 days) is missing or no longer stated plainly -- do not let this silently revert to a placeholder`)
check(claudeMd.includes('profile_state_snapshots'),
  `${CLAUDE_MD}: the snapshot table must be named as the actual per-user restore fallback`)
check(claudeMd.includes('api/admin/profile-snapshot.js'),
  `${CLAUDE_MD}: the cron endpoint must be named so a future reader can find the code that writes the table`)

if (failures) {
  console.error(`test-profile-snapshot: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-profile-snapshot: OK (the nightly profile_state_snapshots table, its cron endpoint\'s auth and INSERT...SELECT shape, the vercel.json cron registration, and the CLAUDE.md documentation of the confirmed 7-day Neon PITR window are all in place)')
}
