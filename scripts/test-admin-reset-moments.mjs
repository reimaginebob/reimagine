// F1 twenty-minute session, item 3: admin-only reset of one account's My
// Coach moment dedupe state (coachMoments, inside users.profile_state), so
// an internal tester can replay arrivals/Deliveries/Row A-C on demand
// instead of an earlier verification pass permanently consuming the dedupe.
//
// checkAdminAuth itself needs a live DB lookup and cannot be exercised here
// (same constraint test-admin-session-auth.mjs documents for every other
// admin endpoint) -- source-presence covers the auth gate and the SQL
// shape; isInternalAccount (the target-account restriction) is a pure
// function and gets full behavioral coverage.
import fs from 'node:fs'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

const { isInternalAccount } = await import('../api/_lib/feature-flags.js')

// --- isInternalAccount, the target-restriction this endpoint relies on ---
check(isInternalAccount({ email: 'lindsey@career.club' }) === true,
  'an @career.club account should be treated as internal')
check(isInternalAccount({ email: 'LINDSEY@CAREER.CLUB' }) === true,
  'the internal-account check should be case-insensitive')
check(isInternalAccount({ email: 'lindsey@example.com' }) === false,
  'a non-career.club account should NOT be treated as internal')
check(isInternalAccount({ email: 'not-career.club@evil.com' }) === false,
  'a lookalike domain (career.club appearing before the @, not as the actual domain) must not pass')
check(isInternalAccount(null) === false, 'a null user should not be treated as internal')

// --- The endpoint itself ---
const ENDPOINT = 'api/admin/reset-moments.js'
const src = fs.readFileSync(ENDPOINT, 'utf8')

check(src.includes("checkAdminAuth(req, res)"), `${ENDPOINT}: missing the standard admin-session auth gate`)
check(src.includes("adminLoginEmailsMissing()"), `${ENDPOINT}: missing the server-misconfiguration guard`)
check(src.includes('isInternalAccount({ email })'), `${ENDPOINT}: the target account is not checked against isInternalAccount -- this must only ever be able to reset an internal account, never a real user's`)
check(/if\s*\(!isInternalAccount\(\{ email \}\)\)\s*\{\s*return res\.status\(400\)/.test(src),
  `${ENDPOINT}: a non-internal target email should be rejected with a 400, not silently proceed`)

// The write clears coachMoments to {} via jsonb_set while leaving the rest
// of profile_state untouched -- never a blind overwrite of the whole blob,
// which would also wipe outputs/done/chosen/etc.
check(src.includes("jsonb_set(COALESCE(profile_state, '{}'::jsonb), '{coachMoments}', '{}'::jsonb)"),
  `${ENDPOINT}: the UPDATE no longer scopes its write to the coachMoments key alone -- this must never touch the rest of profile_state`)
check(/UPDATE users/.test(src) && /WHERE lower\(email\) = lower\(\$\{email\}\)/.test(src),
  `${ENDPOINT}: the UPDATE is not scoped to the target email`)

// Logging who ran it, per the brief's explicit requirement.
check(src.includes('resetBy: admin && admin.email'),
  `${ENDPOINT}: the reset is not logged with which admin ran it`)
check(src.includes("getSessionUser(req, res)"),
  `${ENDPOINT}: the acting admin's own identity is never looked up -- resetBy would be undefined`)

// --- The dashboard panel ---
const DASH = 'src/AdminDashboard.jsx'
const dash = fs.readFileSync(DASH, 'utf8')
check(dash.includes('/api/admin/reset-moments'), `${DASH}: no fetch call to the reset-moments endpoint`)
check(dash.includes('Reset My Coach moments'), `${DASH}: the admin panel for this action is missing`)
check(/credentials:\s*"include"/.test(dash.slice(dash.indexOf('/api/admin/reset-moments') - 200, dash.indexOf('/api/admin/reset-moments') + 300)),
  `${DASH}: the reset-moments fetch does not send credentials -- it would 403 against the session-cookie auth model`)

if (failures) {
  console.error(`test-admin-reset-moments: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-admin-reset-moments: OK (isInternalAccount correctly restricts the reset target to an @career.club account; the endpoint gates on the standard admin session, scopes its write to coachMoments alone, rejects a non-internal target, and logs which admin ran it; the dashboard panel wires the fetch with credentials)')
}
