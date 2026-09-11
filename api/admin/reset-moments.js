// F1 twenty-minute session, item 3: admin-only reset of one account's My
// Coach moment state (coachMoments -- the dedupe/decline record every
// MOMENT_CATALOG entry writes to, src/coach-moments.js), so an internal
// tester can replay arrivals, Deliveries, Row A/B/C, and any future moment
// on demand instead of having its dedupe permanently consumed by an earlier
// verification pass.
//
// coachMoments is not a separate table -- it is one top-level key inside
// users.profile_state (the same JSONB blob the ordinary autosave writes
// wholesale, api/profile/save.js), alongside outputs/done/chosen/etc. This
// resets that one key to {} and leaves everything else in the blob
// untouched.
//
// Restricted to resetting an INTERNAL (@career.club) account only -- this is
// a blunt developer/testing tool (it wipes every moment's fire history at
// once, with no per-moment picker), not something that belongs pointed at
// one of the 145 real registered accounts. isInternalAccount is the same
// check api/_lib/feature-flags.js already uses to auto-grant every pilot to
// the team.
//
// Auth: signed-in session + ADMIN_LOGIN_EMAILS (api/_lib/admin-auth.js),
// same as every other admin control. POST { email }.

import { sql } from '../_lib/db.js'
import { checkAdminAuth, adminLoginEmailsMissing } from '../_lib/admin-auth.js'
import { getSessionUser } from '../_lib/session.js'
import { isInternalAccount } from '../_lib/feature-flags.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  if (adminLoginEmailsMissing()) {
    console.error('admin/reset-moments: ADMIN_LOGIN_EMAILS not configured')
    return res.status(500).json({ error: 'Server misconfigured' })
  }
  if ((await checkAdminAuth(req, res)) !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' })
  }
  const admin = await getSessionUser(req, res)

  const body = req.body || {}
  const email = typeof body.email === 'string' ? body.email.trim() : ''
  if (!email) return res.status(400).json({ error: 'email required' })
  if (!isInternalAccount({ email })) {
    return res.status(400).json({ error: 'Moment state can only be reset on an internal (@career.club) account' })
  }

  try {
    const rows = await sql`
      UPDATE users
      SET profile_state = jsonb_set(COALESCE(profile_state, '{}'::jsonb), '{coachMoments}', '{}'::jsonb)
      WHERE lower(email) = lower(${email})
      RETURNING email`
    if (rows.length === 0) return res.status(404).json({ error: 'No account with that email' })
    console.log('admin/reset-moments', { email: rows[0].email, resetBy: admin && admin.email })
    return res.status(200).json({ ok: true, email: rows[0].email })
  } catch (err) {
    console.error('admin/reset-moments: query failed', err && err.message)
    return res.status(500).json({ error: 'Update failed' })
  }
}
