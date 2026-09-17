// Content-viewed event (2026-09-17 brief, part 1). Fires when a signed-in
// user opens or rereads an already-generated section -- distinct from
// generating it. See api/_lib/view-events.js for the table and the section
// allowlist, and src/App.jsx's nav()/restoreFromSavedSlot for where this is
// called from (gated on the section already being built, and skipped at the
// call sites that pair a nav with an immediate regenerate).
//
// CSRF: same reasoning as api/support/client-event.js -- the session cookie
// is HttpOnly + SameSite=Lax, so a cross-site POST cannot carry it. The
// origin check below is belt and braces on a write endpoint whose caller is
// always our own page.

import { getSessionUser } from './_lib/session.js'
import { isAllowedOrigin } from './_lib/allowed-hosts.js'
import { recordViewEvent, VIEWABLE_SECTION_IDS } from './_lib/view-events.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const origin = req.headers.origin || req.headers.referer || ''
  if (!isAllowedOrigin(origin)) return res.status(403).json({ error: 'Forbidden' })

  const user = await getSessionUser(req, res)
  // A view with no account to attribute it to is not useful -- see the
  // table's migration comment on why storage is account-linked. 204 rather
  // than 401: this is a fire-and-forget beacon, not a request the page is
  // waiting on.
  if (!user) return res.status(204).end()

  const body = (req.body && typeof req.body === 'object') ? req.body : {}
  const section = typeof body.section === 'string' ? body.section.trim() : ''
  if (!VIEWABLE_SECTION_IDS.includes(section)) {
    return res.status(400).json({ error: 'Unsupported section' })
  }

  await recordViewEvent(user.id, section)
  return res.status(204).end()
}
