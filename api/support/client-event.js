// The half of the error trail the server cannot see (2026-09-08 observability
// brief, part B). Two failures happen entirely inside the browser and, until
// now, never left it:
//
//   client_crash  src/ErrorBoundary.jsx caught a render error, wrote a
//                 diagnostic record to localStorage, and stopped there. The
//                 only way out was a clipboard copy the user had to paste into
//                 an email themselves, which means every crash nobody bothered
//                 to report simply never happened as far as we knew.
//   save_failed   the offline and device_full cases. The server's own
//                 save_failed rows (api/profile/save.js) cover 413/409/500;
//                 these two are precisely the ones where the request never
//                 arrived, so nothing server-side could ever record them.
//
// The client posts only those two. CLIENT_SUPPORT_EVENT_KINDS enforces it, and
// generation_failed/coach_failed are deliberately absent: a browser that could
// post them could invent failures the server never observed, which would make
// the trail actively misleading rather than merely incomplete.
//
// PRIVACY. Everything a browser sends here goes through sanitizeSupportEvent,
// which is a whitelist -- a key that is not a support_events column is dropped
// rather than forwarded to the INSERT, so a future client (or a hand-rolled
// curl) cannot widen this table by adding a field. user_agent is read from the
// request header rather than the body: it is a fact about the connection, and
// taking the client's word for it would make one of the few columns that is
// reliably true into one that is not.
//
// CSRF: the session cookie is HttpOnly + SameSite=Lax, so a cross-site POST
// does not carry it and getSessionUser returns null. Same reasoning as
// api/coach-rate.js. The origin check below is belt and braces on a write
// endpoint whose caller is always our own page.

import { getSessionUser } from '../_lib/session.js'
import { isAllowedOrigin } from '../_lib/allowed-hosts.js'
import { recordSupportEvent, clientEventRateLimited, CLIENT_SUPPORT_EVENT_KINDS } from '../_lib/support-events.js'

// 30 posts per user per 15 minutes. A crash loop is the case this bounds: a
// component that throws on every render would otherwise write a row per render
// forever. Generous enough that a genuinely bad session (a handful of crashes,
// a stretch offline) is fully recorded, which is the session most worth having
// a record of.
const RATE_WINDOW_MINUTES = 15
const RATE_LIMIT = 30

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const origin = req.headers.origin || req.headers.referer || ''
  if (!isAllowedOrigin(origin)) return res.status(403).json({ error: 'Forbidden' })

  const user = await getSessionUser(req, res)
  // A crash on a signed-out screen has no account to hang off, so there is
  // nothing useful to write. 204 rather than 401: the caller is a fire-and-
  // forget reporter on a page that is already broken, and an error response
  // would be one more thing failing on a screen the user is looking at.
  if (!user) return res.status(204).end()

  const body = (req.body && typeof req.body === 'object') ? req.body : {}
  const kind = typeof body.kind === 'string' ? body.kind.trim() : ''
  if (!CLIENT_SUPPORT_EVENT_KINDS.includes(kind)) {
    return res.status(400).json({ error: 'Unsupported kind' })
  }

  if (await clientEventRateLimited(user.id, { windowMinutes: RATE_WINDOW_MINUTES, limit: RATE_LIMIT })) {
    return res.status(429).json({ error: 'rate_limited' })
  }

  // Only these five come off the body, and each one is re-cleaned and capped
  // downstream. Anything else the caller sent is not read at all.
  await recordSupportEvent(user.id, kind, {
    step: body.step,
    error_class: body.error_class,
    http_status: body.http_status,
    duration_ms: body.duration_ms,
    build_sha: body.build_sha,
    user_agent: req.headers['user-agent'],
    detail: body.detail,
  })

  return res.status(204).end()
}
