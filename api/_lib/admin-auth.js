// Admin dashboard auth (finding #2.8, 2026-09-08 prelaunch audit): session
// cookie plus an email allowlist, replacing a single static ADMIN_TOKEN that
// the dashboard kept in its own localStorage (reachable by any XSS anywhere
// in the React app, since it shares an origin with the product) and accepted
// via a `?t=` query param besides the Authorization header. Comparisons were
// plain `===`.
//
// Cookies here are HttpOnly (unreachable from JS -- no XSS surface) and
// forging a session means guessing a 32-byte random token against a hashed
// DB lookup, not a short static string against an app-level compare. That
// removes the bearer-secret whose timing profile mattered; there is no
// longer a secret being compared here for `===` to leak. (Two narrow
// exceptions survive with the OLD static-token model, because they are
// unattended/curl-only ops paths with no browser surface to steal a token
// from: api/admin/stage-snapshot.js's manual-trigger escape hatch and
// api/oauth/revoke.js. Both now compare with the constant-time helper in
// api/_lib/timing-safe.js.)
//
// Two levels, same shape as the token model: 'admin' can do anything
// (suspend an account, grant a flag, send a campaign); 'analyst' is
// read-only, limited to routes that opt in with allowAnalyst.
//
// ADMIN_LOGIN_EMAILS / ANALYST_LOGIN_EMAILS are new env vars, deliberately
// NOT reusing the existing ADMIN_EMAILS var -- that name already means
// something else (an analytics-exclusion + ops-alert-recipient list, read in
// eight other places); reusing it here would mean granting dashboard access
// to an address also changes who gets excluded from Bob's own analytics.
//
// Returns 'admin' | 'analyst' | null. Callers translate null into a 403
// rather than this helper doing it, so each route keeps its own error shape.

import { getSessionUser } from './session.js'

function parseEmailList(raw) {
  return new Set(
    (raw || '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
  )
}

export async function checkAdminAuth(req, res, { allowAnalyst = false } = {}) {
  const user = await getSessionUser(req, res)
  if (!user || user.suspended_at) return null

  const email = (user.email || '').trim().toLowerCase()
  if (!email) return null

  if (parseEmailList(process.env.ADMIN_LOGIN_EMAILS).has(email)) return 'admin'

  if (allowAnalyst && parseEmailList(process.env.ANALYST_LOGIN_EMAILS).has(email)) {
    return 'analyst'
  }

  return null
}

// True when ADMIN_LOGIN_EMAILS is unset/empty, a server misconfiguration
// (nobody could ever pass the allowlist) rather than a failed credential --
// should be a 500, not a 403. ANALYST_LOGIN_EMAILS being unset is not an
// error; it just means nobody has been granted analyst access.
export function adminLoginEmailsMissing() {
  return parseEmailList(process.env.ADMIN_LOGIN_EMAILS).size === 0
}
