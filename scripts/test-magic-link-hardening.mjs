// Guards finding #2.3 from the 2026-09-08 prelaunch audit: the magic-link
// send flow had no per-IP rate limit (only a per-email one), no rate limit
// at all on check-email.js (an unauthenticated account-enumeration oracle),
// no upper bound on firstName/lastName, and built the outbound link's host
// from a caller-supplied header with no allowlist.
//
// BEHAVIORAL for the pure functions this PR extracted:
// - isAllowedOrigin / isAllowedHost (api/_lib/allowed-hosts.js) -- no DB
//   dependency, imported and called directly.
// - checkIpRateLimit / getClientIp (api/_lib/auth-rate-limit.js) -- imported
//   with dummy env vars; checkIpRateLimit hits a real (dummy, unreachable)
//   DB URL, so it is exercised only for its fail-open behavior and its
//   pure getClientIp helper, not for the real DB-backed count.
// - email.js's two-greeting split is not directly exported, so it is
//   covered by source-presence: the plain-text body must use the
//   unescaped name and the HTML body the escaped one.
//
// Everything else (the per-IP gate running before other work, the name
// caps applied everywhere firstName/lastName used to be, the base-URL
// allowlist pin) is source-presence, same pattern as test-coach-rate-limit.
import fs from 'node:fs'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

process.env.DATABASE_URL ||= 'postgres://user:pass@localhost/dummy'
process.env.RESEND_API_KEY ||= 'dummy'
process.env.ANTHROPIC_API_KEY ||= 'dummy'

const { isAllowedOrigin, isAllowedHost, ALLOWED_HOSTS } = await import('../api/_lib/allowed-hosts.js')
const { getClientIp, checkIpRateLimit } = await import('../api/_lib/auth-rate-limit.js')

// --- isAllowedOrigin --------------------------------------------------------

check(isAllowedOrigin('https://reimagine.career.club') === true, 'the production origin was rejected')
check(isAllowedOrigin('https://reimagine2-two.vercel.app') === true, 'the known production Vercel origin was rejected')
check(isAllowedOrigin('http://localhost:5173') === true, 'the local dev origin was rejected')
check(isAllowedOrigin('https://reimagine2-git-some-branch-career-club.vercel.app') === true,
  'a Vercel preview-deploy origin (matching the reimagine .vercel.app wildcard) was rejected')
check(isAllowedOrigin('https://evil.example.com') === false, 'an arbitrary attacker-controlled origin was allowed')
check(isAllowedOrigin('https://vercel.app.evil.com') === false, 'a hostname merely containing "vercel.app" as a suffix trick was allowed')
check(isAllowedOrigin('https://totally-unrelated.vercel.app') === false, 'a .vercel.app host with no "reimagine" in it was allowed')
check(isAllowedOrigin('not a url') === false, 'a malformed origin string did not fail closed')
check(isAllowedOrigin('') === false, 'an empty origin did not fail closed')
check(isAllowedOrigin(null) === false, 'a null origin did not fail closed')

// --- isAllowedHost (bare Host-header form, no scheme) -----------------------

check(isAllowedHost('reimagine.career.club') === true, 'the production host was rejected')
check(isAllowedHost('localhost:5173') === true, 'the local dev host:port was rejected')
check(isAllowedHost('reimagine2-git-some-branch-career-club.vercel.app') === true,
  'a Vercel preview-deploy host was rejected')
check(isAllowedHost('evil.example.com') === false, 'an arbitrary attacker-controlled Host header was allowed')
check(isAllowedHost('evil.example.com:443') === false, 'an attacker host with a port suffix bypassed the check')
check(isAllowedHost('') === false, 'an empty host did not fail closed')
check(isAllowedHost(undefined) === false, 'an undefined host did not fail closed')
check(ALLOWED_HOSTS.has('reimagine.career.club'), 'ALLOWED_HOSTS no longer names the production host')

// --- getClientIp -------------------------------------------------------------

check(getClientIp({ headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' }, socket: {} }) === '1.2.3.4',
  'x-forwarded-for with multiple hops did not take the first (client) address')
check(getClientIp({ headers: { 'x-forwarded-for': '  1.2.3.4  ' }, socket: {} }) === '1.2.3.4',
  'a single-hop x-forwarded-for value was not trimmed')
check(getClientIp({ headers: {}, socket: { remoteAddress: '9.9.9.9' } }) === '9.9.9.9',
  'fallback to socket.remoteAddress did not work when x-forwarded-for is absent')
check(getClientIp({ headers: {}, socket: {} }) === '', 'a request with no IP information at all did not fall back to an empty string')

// --- checkIpRateLimit fails open (dummy DB is unreachable) ------------------

{
  const result = await checkIpRateLimit('test-route', '1.2.3.4', { windowMinutes: 15, limit: 5 })
  check(result && result.limited === false, 'checkIpRateLimit did not fail OPEN when the DB is unreachable -- a DB hiccup must never block a real sign-in')
}
check((await checkIpRateLimit('test-route', '', { windowMinutes: 15, limit: 5 })).limited === false,
  'checkIpRateLimit did not fail open for a missing IP address')

// --- Source-presence: request-link.js -----------------------------------

const REQUEST_LINK = 'api/auth/request-link.js'
const requestLink = fs.readFileSync(REQUEST_LINK, 'utf8')

const ipCheckIdx = requestLink.indexOf("const ipCheck = await checkIpRateLimit('request-link'")
check(ipCheckIdx !== -1, `${REQUEST_LINK}: the per-IP rate-limit check is missing`)

const handlerStartIdx = requestLink.indexOf('export default async function handler')
const emailDestructureIdx = requestLink.indexOf('const { email, firstName, lastName')
check(handlerStartIdx !== -1 && ipCheckIdx !== -1 && emailDestructureIdx !== -1 && ipCheckIdx < emailDestructureIdx,
  `${REQUEST_LINK}: the per-IP check does not run before the rest of the handler's work`)

check(requestLink.includes('const cappedFirstName =') && requestLink.includes('const cappedLastName ='),
  `${REQUEST_LINK}: firstName/lastName are no longer capped`)
// Every line mentioning bare "firstName" (not "cappedFirstName") must be
// either the destructure, the capping line itself, or a comment -- any
// other use means a caller-controlled value slipped past the cap.
{
  const allowedLines = [
    "const { email, firstName, lastName, privacyAccepted, privacyVersion, termsAccepted, termsVersion,",
    'const cappedFirstName = typeof firstName === \'string\' ? firstName.trim().slice(0, MAX_NAME_CHARS) : firstName',
  ]
  const stray = requestLink.split('\n').filter(line => {
    const bareMatches = line.match(/(?<!capped)firstName\b/g)
    if (!bareMatches) return false
    if (allowedLines.includes(line.trim())) return false
    if (line.trim().startsWith('//')) return false
    return true
  })
  check(stray.length === 0, `${REQUEST_LINK}: a bare (uncapped) reference to firstName remains outside the destructure/capping lines: ${JSON.stringify(stray)}`)
}
check(requestLink.includes('sendMagicLinkEmail(normalizedEmail, link, cappedFirstName)'),
  `${REQUEST_LINK}: the outbound email send still uses the uncapped firstName`)
check(requestLink.includes("INSERT INTO magic_link_tokens") && requestLink.includes('${cappedFirstName || null}, ${cappedLastName || null}'),
  `${REQUEST_LINK}: the token-row insert still uses uncapped firstName/lastName`)

check(requestLink.includes("const safeHost = isAllowedHost(host) ? host : 'reimagine.career.club'"),
  `${REQUEST_LINK}: getRequestOrigin no longer pins an unrecognized host to the production fallback`)
check(requestLink.includes("import { isAllowedHost } from '../_lib/allowed-hosts.js'"),
  `${REQUEST_LINK}: no longer imports the shared allowlist`)

// Fail-open precedent: the per-IP check itself must not throw the request
// into a 500 on a DB hiccup -- that responsibility lives in checkIpRateLimit
// (tested above), so request-link.js should simply await it with no extra
// try/catch wrapping (the shared helper already swallows the error).
check(!/try\s*\{\s*const ipCheck = await checkIpRateLimit/.test(requestLink),
  `${REQUEST_LINK}: wraps checkIpRateLimit in its own try/catch -- the shared helper already fails open, double-wrapping suggests the call site expects it to throw`)

// --- Source-presence: check-email.js -------------------------------------

const CHECK_EMAIL = 'api/auth/check-email.js'
const checkEmail = fs.readFileSync(CHECK_EMAIL, 'utf8')

const checkEmailIpIdx = checkEmail.indexOf("const ipCheck = await checkIpRateLimit('check-email'")
check(checkEmailIpIdx !== -1, `${CHECK_EMAIL}: the per-IP rate-limit check is missing -- this endpoint was an unauthenticated account-enumeration oracle`)

const checkEmailBodyReadIdx = checkEmail.indexOf('const { email } = req.body')
check(checkEmailIpIdx !== -1 && checkEmailBodyReadIdx !== -1 && checkEmailIpIdx < checkEmailBodyReadIdx,
  `${CHECK_EMAIL}: the per-IP check does not run before the rest of the handler's work`)

check(checkEmail.includes('return res.status(429)'), `${CHECK_EMAIL}: hitting the IP rate limit does not return a 429`)

// --- Source-presence: email.js two-greeting split ---------------------------

const EMAIL_LIB = 'api/_lib/email.js'
const emailLib = fs.readFileSync(EMAIL_LIB, 'utf8')

check(emailLib.includes('function escapeHtml('), `${EMAIL_LIB}: escapeHtml helper is missing`)
check(/const greeting = firstName \? `Hi \$\{firstName\},` : 'Hi,'/.test(emailLib),
  `${EMAIL_LIB}: sendMagicLinkEmail's plain-text greeting must use the raw (unescaped) name`)
check(/const htmlGreeting = firstName \? `Hi \$\{escapeHtml\(firstName\)\},` : 'Hi,'/.test(emailLib),
  `${EMAIL_LIB}: sendMagicLinkEmail's HTML greeting must escape the name`)
check(emailLib.includes('<p>${htmlGreeting}</p>') , `${EMAIL_LIB}: the HTML body does not use the escaped greeting`)
check(!/<p>\$\{greeting\}<\/p>/.test(emailLib), `${EMAIL_LIB}: an HTML body appears to use the unescaped plain-text greeting directly`)

if (failures) {
  console.error(`test-magic-link-hardening: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-magic-link-hardening: OK (allowed-hosts allowlist matches/rejects correctly and fails closed, checkIpRateLimit fails open on a DB hiccup, and request-link.js/check-email.js/email.js carry the per-IP gate, name caps, host-pinning, and two-greeting escaping this PR added)')
}
