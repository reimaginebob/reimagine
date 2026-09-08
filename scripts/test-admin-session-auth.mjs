// Guards finding #2.8 from the 2026-09-08 prelaunch audit: the admin
// dashboard's whole auth model was one static ADMIN_TOKEN, kept in the
// dashboard's own localStorage (reachable by any XSS anywhere in the React
// app), accepted via a `?t=` query param besides the Authorization header,
// and compared with a plain `===`. Migrated to the signed-in session cookie
// (api/_lib/session.js's getSessionUser, the same mechanism the product
// itself uses) checked against a new ADMIN_LOGIN_EMAILS/ANALYST_LOGIN_EMAILS
// allowlist.
//
// BEHAVIORAL for the two genuinely pure functions this fix introduces:
// constantTimeEqual (api/_lib/timing-safe.js) and adminLoginEmailsMissing
// (api/_lib/admin-auth.js, which behaviorally exercises the unexported
// parseEmailList parsing/trimming/case-folding through its own env-var
// input). checkAdminAuth itself calls getSessionUser, a live DB lookup, and
// cannot be exercised without a live Postgres connection -- same constraint
// as the Coach turn-cap query in PR3 -- so its branching (suspended check,
// admin-vs-analyst email match) is guarded by source-presence below.
//
// Also source-presence across every file this migration touched: the 13
// browser-facing admin endpoints (no more ADMIN_TOKEN, no CORS, no ?t=),
// the 2 legacy curl-only endpoints that deliberately kept ADMIN_TOKEN but
// now compare it with constantTimeEqual, and the 6 client files (no more
// Authorization header, no more localStorage token, credentials:'include'
// on every admin fetch).
import fs from 'node:fs'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

process.env.DATABASE_URL ||= 'postgres://user:pass@localhost/dummy'

const { constantTimeEqual } = await import('../api/_lib/timing-safe.js')
const { adminLoginEmailsMissing } = await import('../api/_lib/admin-auth.js')

// --- constantTimeEqual -------------------------------------------------

check(constantTimeEqual('abc', 'abc') === true, 'two identical strings did not compare equal')
check(constantTimeEqual('abc', 'abd') === false, 'two different same-length strings compared equal')
check(constantTimeEqual('abc', 'abcd') === false, 'two different-length strings compared equal')
check(constantTimeEqual('', '') === true, 'two empty strings did not compare equal')
check(constantTimeEqual('abc', '') === false, 'a non-empty and an empty string compared equal')
check(constantTimeEqual(null, 'abc') === false, 'a non-string (null) operand did not fail closed')
check(constantTimeEqual('abc', undefined) === false, 'a non-string (undefined) operand did not fail closed')
check(constantTimeEqual(123, 123) === false, 'two non-string (number) operands did not fail closed')

// --- adminLoginEmailsMissing (exercises parseEmailList's parsing) ----------

{
  const saved = process.env.ADMIN_LOGIN_EMAILS
  try {
    delete process.env.ADMIN_LOGIN_EMAILS
    check(adminLoginEmailsMissing() === true, 'an unset ADMIN_LOGIN_EMAILS was not treated as missing')

    process.env.ADMIN_LOGIN_EMAILS = ''
    check(adminLoginEmailsMissing() === true, 'an empty ADMIN_LOGIN_EMAILS was not treated as missing')

    process.env.ADMIN_LOGIN_EMAILS = '   ,  ,'
    check(adminLoginEmailsMissing() === true, 'a whitespace/comma-only ADMIN_LOGIN_EMAILS was not treated as missing')

    process.env.ADMIN_LOGIN_EMAILS = 'Bob@Career.Club'
    check(adminLoginEmailsMissing() === false, 'a single real address was treated as missing')

    process.env.ADMIN_LOGIN_EMAILS = ' bob@career.club , dana@career.club '
    check(adminLoginEmailsMissing() === false, 'a comma-separated, whitespace-padded list was treated as missing')
  } finally {
    if (saved === undefined) delete process.env.ADMIN_LOGIN_EMAILS
    else process.env.ADMIN_LOGIN_EMAILS = saved
  }
}

// --- Source-presence: api/_lib/admin-auth.js --------------------------------

const ADMIN_AUTH = 'api/_lib/admin-auth.js'
const adminAuth = fs.readFileSync(ADMIN_AUTH, 'utf8')

check(adminAuth.includes('export async function checkAdminAuth(req, res, { allowAnalyst = false } = {}) {'),
  `${ADMIN_AUTH}: checkAdminAuth no longer has the expected async (req, res, opts) signature`)
check(adminAuth.includes('const user = await getSessionUser(req, res)'),
  `${ADMIN_AUTH}: checkAdminAuth no longer authenticates via the session cookie`)
check(adminAuth.includes('if (!user || user.suspended_at) return null'),
  `${ADMIN_AUTH}: checkAdminAuth no longer rejects a suspended account`)
check(adminAuth.includes('parseEmailList(process.env.ADMIN_LOGIN_EMAILS).has(email)) return \'admin\''),
  `${ADMIN_AUTH}: checkAdminAuth no longer grants 'admin' from ADMIN_LOGIN_EMAILS`)
check(/if \(allowAnalyst && parseEmailList\(process\.env\.ANALYST_LOGIN_EMAILS\)\.has\(email\)\)/.test(adminAuth),
  `${ADMIN_AUTH}: analyst access is no longer gated on allowAnalyst being explicitly true`)
check(!adminAuth.includes('process.env.ADMIN_TOKEN') && !adminAuth.includes('process.env.ANALYST_TOKEN'),
  `${ADMIN_AUTH}: still reads the retired ADMIN_TOKEN/ANALYST_TOKEN env vars`)

// --- Source-presence: the 13 migrated browser-facing admin endpoints -------

const MIGRATED = [
  'api/admin/analytics.js', 'api/admin/coach-insights.js', 'api/admin/feedback-dashboard.js',
  'api/admin/economics.js', 'api/admin/pipeline-access.js', 'api/admin/suspend-user.js',
  'api/admin/track-access.js', 'api/admin/corner-segment.js', 'api/admin/dormant.js',
  'api/admin/generation-attempts.js', 'api/admin/growth.js', 'api/admin/send-campaign.js',
  'api/admin/user-stages.js',
]
for (const file of MIGRATED) {
  const src = fs.readFileSync(file, 'utf8')
  check(src.includes("from '../_lib/admin-auth.js'") && src.includes('checkAdminAuth') && src.includes('adminLoginEmailsMissing'),
    `${file}: no longer imports checkAdminAuth/adminLoginEmailsMissing from the shared admin-auth module`)
  check(/await checkAdminAuth\(req, res/.test(src),
    `${file}: no longer awaits checkAdminAuth with (req, res, ...) -- the session-cookie signature`)
  check(!src.includes('process.env.ADMIN_TOKEN'), `${file}: still reads the retired ADMIN_TOKEN env var`)
  check(!src.includes('Access-Control-Allow-Origin'), `${file}: a CORS wildcard header survives -- dangerous now that auth is cookie-based, and unnecessary for a same-origin-only endpoint`)
  check(!src.includes('req.query.t') && !src.includes('query.t ==='), `${file}: ?t= query-param token acceptance survives`)
}

// --- Source-presence: the 2 legacy curl-only endpoints ----------------------
// Deliberately kept on ADMIN_TOKEN (no browser UI, never exposed to the
// dashboard's localStorage) but must compare it constant-time now.

for (const file of ['api/admin/stage-snapshot.js', 'api/oauth/revoke.js']) {
  const src = fs.readFileSync(file, 'utf8')
  check(src.includes('ADMIN_TOKEN'), `${file}: expected to still reference ADMIN_TOKEN (deliberately not migrated) but does not`)
  check(src.includes('constantTimeEqual'), `${file}: its ADMIN_TOKEN compare is not using the constant-time helper`)
  check(!/auth === `Bearer \$\{(admin|expected)/.test(src) && !/authorization \|\| ''\) !== `Bearer/.test(src),
    `${file}: a plain \`===\`/\`!==\` bearer-token compare survives alongside (or instead of) the constant-time one`)
}

// --- Source-presence: the 6 client files ------------------------------------

const CLIENT_FILES = [
  'src/AdminDashboard.jsx', 'src/CoachInsights.jsx', 'src/FeedbackDashboard.jsx',
  'src/GrowthDashboard.jsx', 'src/DormantAccounts.jsx', 'src/EconomicsDashboard.jsx',
]
for (const file of CLIENT_FILES) {
  const src = fs.readFileSync(file, 'utf8')
  check(!src.includes('Authorization: `Bearer'), `${file}: still builds an Authorization: Bearer header -- the old ADMIN_TOKEN transport`)
  check(!src.includes('reimagine-admin-token'), `${file}: still references the retired admin-token localStorage key`)
  check(src.includes('credentials: "include"') || src.includes("credentials: 'include'"),
    `${file}: no fetch call opts into credentials:'include' -- the session cookie would never be sent`)
}
// AdminDashboard.jsx no longer threads a token prop into its three child tabs.
{
  const app = fs.readFileSync('src/AdminDashboard.jsx', 'utf8')
  check(!/<(FeedbackDashboard|GrowthDashboard|EconomicsDashboard)[^>]*\btoken=/.test(app),
    `src/AdminDashboard.jsx: still passes a token prop into a child dashboard tab`)
}
{
  const growth = fs.readFileSync('src/GrowthDashboard.jsx', 'utf8')
  check(!/<DormantAccounts[^>]*\btoken=/.test(growth),
    `src/GrowthDashboard.jsx: still passes a token prop into DormantAccounts`)
}

if (failures) {
  console.error(`test-admin-session-auth: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-admin-session-auth: OK (constantTimeEqual and adminLoginEmailsMissing behave correctly; every browser-facing admin endpoint gates on the session cookie + ADMIN_LOGIN_EMAILS with no CORS/?t=/ADMIN_TOKEN left, the 2 curl-only legacy endpoints keep ADMIN_TOKEN but compare it constant-time, and every client file sends credentials instead of a Bearer token)')
}
