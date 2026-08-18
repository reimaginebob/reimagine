// End-to-end verification for PR #447 (OAuth revocation + refresh expiry +
// atomic code redemption). Drives the REAL Vercel handlers with mock req/res
// against a throwaway Neon branch, so every assertion exercises shipped code
// rather than a re-implementation of it.
//
// Requires DATABASE_URL pointed at a VERIFY BRANCH, never production: it seeds
// and then deletes a test user, and exercises the revoke endpoint, which
// destroys tokens.
//
// Run: DATABASE_URL='<branch>' node scripts/verify-oauth-e2e.mjs

import crypto from 'node:crypto'

process.env.ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'verify-admin-token'

const { sql } = await import('../api/_lib/db.js')
const authorize = (await import('../api/oauth/authorize.js')).default
const token = (await import('../api/oauth/token.js')).default
const register = (await import('../api/oauth/register.js')).default
const revoke = (await import('../api/oauth/revoke.js')).default
const mcp = (await import('../api/mcp.js')).default

const TEST_EMAIL = 'oauth-e2e-probe@example.invalid'
const REDIRECT_URI = 'https://claude.ai/api/mcp/auth_callback'
const RECORD_ID = 'sp_e2e_probe'

let pass = 0, fail = 0
function check(label, ok, detail) {
  if (ok) { pass++; console.log(`  PASS  ${label}`) }
  else { fail++; console.log(`  FAIL  ${label}${detail ? ` -- ${detail}` : ''}`) }
}
function section(t) { console.log(`\n${t}`) }

// Minimal Vercel-shaped req/res.
function mkReq({ method = 'GET', body = {}, query = {}, headers = {} } = {}) {
  return { method, body, query, headers }
}
function mkRes() {
  const r = {
    statusCode: null, headers: {}, body: null, chunks: [],
    status(c) { r.statusCode = c; return r },
    json(o) { r.body = o; return r },
    send(s) { r.body = s; return r },
    write(s) { r.chunks.push(s); return true },
    end() { if (r.chunks.length) r.body = r.chunks.join(''); return r },
    setHeader(k, v) { r.headers[k.toLowerCase()] = v },
    getHeader(k) { return r.headers[k.toLowerCase()] },
  }
  return r
}

const b64url = b => Buffer.from(b).toString('base64url')
const sha256hex = s => crypto.createHash('sha256').update(s).digest('hex')

async function cleanup() {
  await sql`DELETE FROM users WHERE email = ${TEST_EMAIL}`
  await sql`DELETE FROM oauth_clients WHERE client_name = 'e2e-probe'`
}

// ---------------------------------------------------------------- seed
await cleanup()
const profileState = {
  savedPlaybooks: [{ id: RECORD_ID, source: 'door2', title: 'Probe Role', company: 'Probe Co' }],
}
const [user] = await sql`
  INSERT INTO users (email, first_name, feature_flags, profile_state, push_token_hash, push_token_created_at)
  VALUES (${TEST_EMAIL}, 'Probe', ARRAY['my_search']::text[], ${profileState}::jsonb, ${sha256hex('probe-push-token')}, NOW())
  RETURNING id, email`
const sessionToken = crypto.randomBytes(32).toString('base64url')
await sql`INSERT INTO sessions (token, user_id, expires_at) VALUES (${sessionToken}, ${user.id}, NOW() + INTERVAL '1 day')`
const cookie = `pe_session=${sessionToken}`
console.log(`seeded test user ${user.id}`)

// ---------------------------------------------- 0. migration landed
section('0. Migration')
const cols = await sql`
  SELECT column_name, data_type, is_nullable FROM information_schema.columns
  WHERE table_name = 'oauth_tokens' AND column_name = 'refresh_expires_at'`
check('refresh_expires_at exists on oauth_tokens', cols.length === 1)
check('is timestamptz', cols[0]?.data_type === 'timestamp with time zone', cols[0]?.data_type)
check('is nullable (fails closed, not NOT NULL)', cols[0]?.is_nullable === 'YES', cols[0]?.is_nullable)
const idx = await sql`SELECT indexname FROM pg_indexes WHERE tablename='oauth_tokens' AND indexname='oauth_tokens_user_client_idx'`
check('(user_id, client_id) index created', idx.length === 1)
const unbackfilled = await sql`SELECT count(*)::int n FROM oauth_tokens WHERE refresh_token_hash IS NOT NULL AND refresh_expires_at IS NULL`
check('no un-backfilled refresh rows left', unbackfilled[0].n === 0, `${unbackfilled[0].n} rows`)

// ---------------------------------------------- 1. mint + redeem
section('1. Mint and redeem (register -> authorize -> token)')
const regRes = mkRes()
await register(mkReq({ method: 'POST', body: { redirect_uris: [REDIRECT_URI], client_name: 'e2e-probe' } }), regRes)
const clientId = regRes.body?.client_id
check('client registered', regRes.statusCode === 201 && !!clientId, JSON.stringify(regRes.body))

const verifier = crypto.randomBytes(32).toString('base64url')
const challenge = crypto.createHash('sha256').update(verifier).digest('base64url')
const authParams = {
  response_type: 'code', client_id: clientId, redirect_uri: REDIRECT_URI,
  code_challenge: challenge, code_challenge_method: 'S256', state: 'xyz', scope: 'pipeline',
}

const consentRes = mkRes()
await authorize(mkReq({ method: 'GET', query: authParams, headers: { cookie } }), consentRes)
check('consent screen renders', consentRes.statusCode === 200)
check('consent copy: disconnect instructions present',
  typeof consentRes.body === 'string' && consentRes.body.includes('To disconnect it later, email info@career.club'))
check('consent copy: old false claim gone',
  typeof consentRes.body === 'string' && !consentRes.body.includes('You can disconnect anytime'))

const approveRes = mkRes()
await authorize(mkReq({ method: 'POST', body: { ...authParams, decision: 'approve' }, headers: { cookie } }), approveRes)
const loc = approveRes.getHeader('location') || ''
const code = new URL(loc).searchParams.get('code')
check('approve redirects with a code', approveRes.statusCode === 302 && !!code, loc)

const tokRes = mkRes()
await token(mkReq({ method: 'POST', body: { grant_type: 'authorization_code', code, code_verifier: verifier, client_id: clientId, redirect_uri: REDIRECT_URI } }), tokRes)
check('code redeemed for tokens', tokRes.statusCode === 200 && !!tokRes.body?.access_token, JSON.stringify(tokRes.body))
check('access TTL is 3600s', tokRes.body?.expires_in === 3600, String(tokRes.body?.expires_in))
const accessToken = tokRes.body?.access_token
const refreshToken = tokRes.body?.refresh_token

const [row1] = await sql`SELECT expires_at, refresh_expires_at FROM oauth_tokens WHERE access_token_hash = ${sha256hex(accessToken)}`
const days = (new Date(row1.refresh_expires_at) - Date.now()) / 86400000
check('refresh expiry set to ~90 days', days > 89.9 && days < 90.1, `${days.toFixed(2)} days`)
const accessMins = (new Date(row1.expires_at) - Date.now()) / 60000
check('access expiry distinct from refresh (~60 min)', accessMins > 59 && accessMins < 61, `${accessMins.toFixed(1)} min`)

// ---------------------------------------------- 2. atomic redemption
section('2. Atomic code redemption')
const replayRes = mkRes()
await token(mkReq({ method: 'POST', body: { grant_type: 'authorization_code', code, code_verifier: verifier, client_id: clientId, redirect_uri: REDIRECT_URI } }), replayRes)
check('replayed code rejected', replayRes.statusCode === 400 && replayRes.body?.error === 'invalid_grant', JSON.stringify(replayRes.body))

const v2 = crypto.randomBytes(32).toString('base64url')
const c2 = crypto.createHash('sha256').update(v2).digest('base64url')
const ap2 = { ...authParams, code_challenge: c2 }
const ar2 = mkRes()
await authorize(mkReq({ method: 'POST', body: { ...ap2, decision: 'approve' }, headers: { cookie } }), ar2)
const code2 = new URL(ar2.getHeader('location')).searchParams.get('code')
const race = [mkRes(), mkRes(), mkRes()]
await Promise.all(race.map(r => token(mkReq({ method: 'POST', body: { grant_type: 'authorization_code', code: code2, code_verifier: v2, client_id: clientId, redirect_uri: REDIRECT_URI } }), r)))
const winners = race.filter(r => r.statusCode === 200)
check('3 concurrent redemptions -> exactly 1 succeeds', winners.length === 1, `${winners.length} succeeded`)
for (const w of winners) if (w.body?.access_token) await sql`DELETE FROM oauth_tokens WHERE access_token_hash = ${sha256hex(w.body.access_token)}`

// ---------------------------------------------- 3. refresh behaviour
section('3. Refresh: rotation, carry-forward, expiry')
const refRes = mkRes()
await token(mkReq({ method: 'POST', body: { grant_type: 'refresh_token', refresh_token: refreshToken, client_id: clientId } }), refRes)
check('refresh succeeds', refRes.statusCode === 200 && !!refRes.body?.access_token, JSON.stringify(refRes.body))
const access2 = refRes.body?.access_token
const refresh2 = refRes.body?.refresh_token
const [row2] = await sql`SELECT refresh_expires_at FROM oauth_tokens WHERE access_token_hash = ${sha256hex(access2)}`
check('rotation CARRIES FORWARD the grant expiry (does not extend it)',
  new Date(row2.refresh_expires_at).getTime() === new Date(row1.refresh_expires_at).getTime(),
  `${row2.refresh_expires_at} vs ${row1.refresh_expires_at}`)
const oldGone = await sql`SELECT 1 FROM oauth_tokens WHERE refresh_token_hash = ${sha256hex(refreshToken)}`
check('old refresh token rotated out', oldGone.length === 0)
const reuseRes = mkRes()
await token(mkReq({ method: 'POST', body: { grant_type: 'refresh_token', refresh_token: refreshToken, client_id: clientId } }), reuseRes)
check('reusing the rotated-out refresh token is rejected', reuseRes.statusCode === 400)

await sql`UPDATE oauth_tokens SET refresh_expires_at = NOW() - INTERVAL '1 day' WHERE refresh_token_hash = ${sha256hex(refresh2)}`
const expRes = mkRes()
await token(mkReq({ method: 'POST', body: { grant_type: 'refresh_token', refresh_token: refresh2, client_id: clientId } }), expRes)
check('EXPIRED refresh token rejected', expRes.statusCode === 400 && expRes.body?.error === 'invalid_grant', JSON.stringify(expRes.body))
await sql`UPDATE oauth_tokens SET refresh_expires_at = NOW() + INTERVAL '90 days' WHERE refresh_token_hash = ${sha256hex(refresh2)}`

// ---------------------------------------------- 4. MCP works, then revoke
section('4. Revoke, end to end through /api/mcp')
const callMcp = async (bearer, method = 'tools/list') => {
  const r = mkRes()
  await mcp(mkReq({ method: 'POST', body: { jsonrpc: '2.0', id: 1, method }, headers: { authorization: `Bearer ${bearer}` } }), r)
  return r
}
const before = await callMcp(access2)
check('MCP accepts the live access token', before.statusCode === 200 && !!before.body?.result?.tools, JSON.stringify(before.body).slice(0, 120))
const pushBefore = await callMcp('probe-push-token')
check('MCP also accepts the push token (the fallback path)', pushBefore.statusCode === 200)

const adminHdr = { authorization: `Bearer ${process.env.ADMIN_TOKEN}` }
const listRes = mkRes()
await revoke(mkReq({ method: 'GET', query: { email: TEST_EMAIL }, headers: adminHdr }), listRes)
check('GET lists the account grants', listRes.statusCode === 200 && listRes.body?.grants?.length >= 1, JSON.stringify(listRes.body?.grants?.length))
check('GET reports the push token as connected', listRes.body?.push_token?.connected === true)

const noAuth = mkRes()
await revoke(mkReq({ method: 'POST', body: { email: TEST_EMAIL }, headers: {} }), noAuth)
check('revoke rejects a missing admin token', noAuth.statusCode === 403)

const revRes = mkRes()
await revoke(mkReq({ method: 'POST', body: { email: TEST_EMAIL }, headers: adminHdr }), revRes)
check('full disconnect returns ok', revRes.statusCode === 200 && revRes.body?.ok === true, JSON.stringify(revRes.body))
check('grants revoked', revRes.body?.grants_revoked >= 1, String(revRes.body?.grants_revoked))
check('push token revoked', revRes.body?.push_revoked === true)

const leftover = await sql`SELECT count(*)::int n FROM oauth_tokens WHERE user_id = ${user.id}::uuid`
check('no oauth_tokens rows remain for the user', leftover[0].n === 0, `${leftover[0].n} rows`)
const codesLeft = await sql`SELECT count(*)::int n FROM oauth_codes WHERE user_id = ${user.id}::uuid`
check('no pending auth codes remain', codesLeft[0].n === 0, `${codesLeft[0].n} rows`)

const after = await callMcp(access2)
check('MCP now rejects the revoked access token (401)', after.statusCode === 401, String(after.statusCode))
const pushAfter = await callMcp('probe-push-token')
check('MCP now rejects the push token too (401)', pushAfter.statusCode === 401, String(pushAfter.statusCode))

// targeted single-client revoke leaves the push token alone
section('5. Targeted single-client revoke')
await sql`UPDATE users SET push_token_hash = ${sha256hex('probe-push-token')}, push_token_created_at = NOW() WHERE id = ${user.id}::uuid`
const v3 = crypto.randomBytes(32).toString('base64url')
const c3 = crypto.createHash('sha256').update(v3).digest('base64url')
const ar3 = mkRes()
await authorize(mkReq({ method: 'POST', body: { ...authParams, code_challenge: c3, decision: 'approve' }, headers: { cookie } }), ar3)
const code3 = new URL(ar3.getHeader('location')).searchParams.get('code')
const tr3 = mkRes()
await token(mkReq({ method: 'POST', body: { grant_type: 'authorization_code', code: code3, code_verifier: v3, client_id: clientId, redirect_uri: REDIRECT_URI } }), tr3)
const tRes = mkRes()
await revoke(mkReq({ method: 'POST', body: { email: TEST_EMAIL, client_id: clientId }, headers: adminHdr }), tRes)
check('targeted revoke removes that grant', tRes.body?.grants_revoked >= 1, JSON.stringify(tRes.body))
check('targeted revoke leaves the push token alone', tRes.body?.push_revoked === false)
const pushStill = await callMcp('probe-push-token')
check('push token still works after a targeted revoke', pushStill.statusCode === 200, String(pushStill.statusCode))

// ---------------------------------------------------------------- teardown
await cleanup()
const gone = await sql`SELECT count(*)::int n FROM users WHERE email = ${TEST_EMAIL}`
check('test user removed', gone[0].n === 0)

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
