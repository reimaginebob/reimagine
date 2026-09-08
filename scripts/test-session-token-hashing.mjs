// Guards finding #2.4 from the 2026-09-08 prelaunch audit: sessions.token
// was stored as plaintext, the primary key for every session row -- a DB
// read of any kind (backup, Neon console, a future SQL injection, a log
// line) yielded a working cookie for every signed-in user. api/_lib/session.js
// now hashes the token before every write/read against that column, and
// migrations/2026-09-08_hash-session-tokens.sql converts existing rows in
// place so already-signed-in browsers keep working.
//
// BEHAVIORAL for hashToken/generateToken (pure functions): imports the real
// module with dummy env vars and calls them directly. createSession/
// getSessionUser/deleteSession all issue real SQL against a live Neon
// connection and cannot be exercised without one; those three are guarded by
// source-presence checks that each routes through hashToken(...) rather than
// the raw token before touching the `token` column.
import fs from 'node:fs'
import crypto from 'node:crypto'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

process.env.DATABASE_URL ||= 'postgres://user:pass@localhost/dummy'

const { hashToken, generateToken } = await import('../api/_lib/session.js')

// hashToken is a deterministic sha256-hex digest -- the same shape
// magic_link_tokens.token_hash and the OAuth bearer-token hash already use.
{
  const t = 'abc123'
  const h1 = hashToken(t)
  const h2 = hashToken(t)
  const expected = crypto.createHash('sha256').update(t).digest('hex')
  check(h1 === h2, 'hashToken is not deterministic -- the same input produced two different hashes')
  check(h1 === expected, 'hashToken does not produce a plain sha256-hex digest')
  check(/^[0-9a-f]{64}$/.test(h1), `hashToken output is not a 64-char lowercase hex string: ${h1}`)
}

// A different token hashes to a different value (not a constant/no-op).
check(hashToken('tokenA') !== hashToken('tokenB'), 'hashToken returns the same value for two different tokens')

// generateToken still produces the raw token that goes in the cookie -- it
// must NOT itself return a hash (that would break the cookie/DB round trip).
{
  const raw = generateToken()
  check(typeof raw === 'string' && raw.length > 0, 'generateToken did not return a non-empty string')
  check(raw !== hashToken(raw), 'generateToken appears to already be hashing its own output')
}

// Source-presence: every place sessions.token is written or looked up must
// route through hashToken(...), not the raw token variable, and the raw
// token must still be what goes in the cookie (buildCookie/res.setHeader).
const SESSION = 'api/_lib/session.js'
const session = fs.readFileSync(SESSION, 'utf8')

check(session.includes('VALUES (${hashToken(token)}, ${userId}'),
  `${SESSION}: createSession no longer hashes the token before INSERT`)
check(session.includes('buildCookie(token, SESSION_DAYS * 24 * 60 * 60, isProd)'),
  `${SESSION}: createSession/getSessionUser no longer sets the cookie to the RAW token -- the browser must hold the raw value, never the hash`)

check(session.includes('const tokenHash = hashToken(token)'),
  `${SESSION}: getSessionUser no longer hashes the cookie-provided token before querying`)
check(session.includes('WHERE s.token = ${tokenHash} AND s.expires_at > NOW()'),
  `${SESSION}: getSessionUser's session lookup no longer queries by the hashed token`)
check(session.includes('WHERE token = ${tokenHash}'),
  `${SESSION}: getSessionUser's last_used_at/expires_at touch no longer keys off the hashed token`)

check(session.includes('await sql`DELETE FROM sessions WHERE token = ${hashToken(token)}`'),
  `${SESSION}: deleteSession no longer hashes the token before DELETE`)

// A raw (unhashed) token must never appear inside a `sessions` SQL template
// as the value bound to the token column -- the only place `token` alone
// (not hashToken(token)/tokenHash) may appear in a sessions query is the
// cookie-building call, which is intentionally the raw value.
check(!/INSERT INTO sessions \(token,[\s\S]{0,20}VALUES \(\$\{token\}/.test(session),
  `${SESSION}: createSession's INSERT still binds the raw token, not its hash`)

// --- Migration: idempotent, in-place, matches the app's hash shape --------

const MIGRATION = 'migrations/2026-09-08_hash-session-tokens.sql'
check(fs.existsSync(MIGRATION), `${MIGRATION} is missing`)
const migration = fs.existsSync(MIGRATION) ? fs.readFileSync(MIGRATION, 'utf8') : ''

check(migration.includes("UPDATE sessions SET token = encode(digest(token, 'sha256'), 'hex')"),
  `${MIGRATION}: does not rehash sessions.token in place using pgcrypto's digest(...) -- must match hashToken's sha256-hex shape exactly so an already-cookied browser still resolves`)
check(migration.includes("WHERE token !~ '^[0-9a-f]{64}$'"),
  `${MIGRATION}: is missing the idempotency guard -- without it, a re-run would hash an already-hashed value and break every existing session`)
check(!migration.includes('ALTER TABLE'),
  `${MIGRATION}: adds a column/changes schema -- the brief calls for migrating existing rows in place (same column, same primary key), not a schema change`)

if (failures) {
  console.error(`test-session-token-hashing: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-session-token-hashing: OK (hashToken is a deterministic sha256-hex digest, createSession/getSessionUser/deleteSession all hash before touching the sessions.token column while the cookie still carries the raw token, and the migration rehashes existing rows in place idempotently)')
}
