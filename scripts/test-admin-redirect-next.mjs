// Guards the admin-dashboard bookmark fix: a signed-out visit to a protected
// admin route (/admin/dashboard, /admin/coach-insights) used to always send
// a fresh magic link back to "/" after verify, so Bob had to click his
// bookmark a second time. Now the originally-requested path rides through
// request-link.js -> the emailed link -> verify.js as a validated `next`.
//
// BEHAVIORAL for sanitizeNextPath (api/_lib/next-path.js), the one piece of
// pure logic both endpoints share -- it is the open-redirect boundary, so it
// gets the most scrutiny.
// Everything else (the two endpoints actually wiring `next` through, and the
// client capturing/forwarding it) is source-presence, same pattern as
// test-magic-link-hardening.mjs.
import fs from 'node:fs'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

const { sanitizeNextPath } = await import('../api/_lib/next-path.js')

// --- sanitizeNextPath: accepted --------------------------------------------

check(sanitizeNextPath('/admin/dashboard') === '/admin/dashboard', 'a plain admin path was rejected')
check(sanitizeNextPath('/admin/coach-insights?tab=x') === '/admin/coach-insights?tab=x', 'a path with a query string was rejected')
check(sanitizeNextPath('/') === '/', 'the bare root path was rejected')

// --- sanitizeNextPath: rejected (open-redirect surface) --------------------

check(sanitizeNextPath('//evil.com') === null, 'a protocol-relative URL ("//evil.com") was allowed through')
check(sanitizeNextPath('https://evil.com') === null, 'an absolute https URL was allowed through')
check(sanitizeNextPath('http://evil.com') === null, 'an absolute http URL was allowed through')
check(sanitizeNextPath('javascript:alert(1)') === null, 'a javascript: URL was allowed through')
check(sanitizeNextPath('evil.com') === null, 'a value with no leading slash was allowed through')
check(sanitizeNextPath('/\\evil.com') === null, 'a backslash-leading path (browsers treat \\ as /) was allowed through')
check(sanitizeNextPath('/%2F%2Fevil.com') === null, 'a percent-encoded "//evil.com" was allowed through')
check(sanitizeNextPath('/%5Cevil.com') === null, 'a percent-encoded backslash variant was allowed through')
check(sanitizeNextPath('') === null, 'an empty string was allowed through')
check(sanitizeNextPath(null) === null, 'null did not fail closed')
check(sanitizeNextPath(undefined) === null, 'undefined did not fail closed')
check(sanitizeNextPath(42) === null, 'a non-string value did not fail closed')
check(sanitizeNextPath('/%') === null, 'an unparseable percent-escape threw instead of failing closed')

// --- Source-presence: request-link.js accepts, validates, and emails `next`

const REQUEST_LINK = 'api/auth/request-link.js'
const requestLink = fs.readFileSync(REQUEST_LINK, 'utf8')

check(requestLink.includes("import { sanitizeNextPath } from '../_lib/next-path.js'"),
  `${REQUEST_LINK}: no longer imports the shared next-path sanitizer`)
check(/const \{ email, firstName, lastName,[\s\S]*?next \} = req\.body/.test(requestLink),
  `${REQUEST_LINK}: no longer destructures \`next\` from the request body`)
check(requestLink.includes('const safeNext = sanitizeNextPath(next)'),
  `${REQUEST_LINK}: \`next\` is no longer validated before use`)
check(requestLink.includes('safeNext') && /link = safeNext[\s\S]*?next=\$\{encodeURIComponent\(safeNext\)\}/.test(requestLink),
  `${REQUEST_LINK}: the validated next is no longer appended (URL-encoded) to the emailed link`)

// --- Source-presence: verify.js re-validates and redirects to `next` -------

const VERIFY = 'api/auth/verify.js'
const verify = fs.readFileSync(VERIFY, 'utf8')

check(verify.includes("import { sanitizeNextPath } from '../_lib/next-path.js'"),
  `${VERIFY}: no longer imports the shared next-path sanitizer`)
check(verify.includes('const { token, next } = req.query'),
  `${VERIFY}: no longer reads \`next\` off the query string`)
check(verify.includes('sanitizeNextPath(next)'),
  `${VERIFY}: \`next\` is used without being re-validated -- a value coming back off a URL must never be trusted directly`)
check(verify.includes("if (!safeNext) return '/?auth=ok'"),
  `${VERIFY}: an invalid/missing next no longer falls back to '/?auth=ok'`)
check(verify.includes('return res.redirect(302, buildRedirectTarget(next))'),
  `${VERIFY}: the final redirect no longer routes through the validated next`)
// The old hardcoded fallback must be gone from the actual redirect call, not
// just superseded -- otherwise this is dead code sitting next to a live bug.
check(!/return res\.redirect\(302, '\/\?auth=ok'\)\s*$/m.test(verify.split('function buildRedirectTarget')[1] ? verify : verify.replace(/[\s\S]*buildRedirectTarget\([^)]*\)\s*\{[\s\S]*?\n\}\n/, '')),
  `${VERIFY}: a stale hardcoded '/?auth=ok' redirect remains outside buildRedirectTarget`)

// --- Source-presence: client captures and forwards `next` ------------------

const APP = 'src/App.jsx'
const app = fs.readFileSync(APP, 'utf8')

check(app.includes("const nextParam=_params.get('next')||null"),
  `${APP}: no longer captures a \`next\` query param from the incoming URL`)
check((app.match(/next:nextParam/g) || []).length === 2,
  `${APP}: expected both the sign-in and sign-up request-link calls to forward next:nextParam`)

for (const [file, label] of [['src/AdminDashboard.jsx', 'AdminDashboard'], ['src/CoachInsights.jsx', 'CoachInsights']]) {
  const src = fs.readFileSync(file, 'utf8')
  check(src.includes('next=${encodeURIComponent(window.location.pathname + window.location.search)}'),
    `${file}: the ${label} "Go to sign in" link no longer captures the current path as \`next\``)
  check(!/href="\/"/.test(src),
    `${file}: a bare href="/" sign-in link remains that drops the current path`)
}

if (failures) {
  console.error(`test-admin-redirect-next: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-admin-redirect-next: OK (sanitizeNextPath accepts relative paths and fails closed on every open-redirect shape tried; request-link.js validates and emails next, verify.js re-validates and redirects to it with a safe fallback; the client captures next from admin sign-in links and forwards it on both request-link calls)')
}
