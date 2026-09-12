// t01-19 follow-up (2026-09-12): the snooze-return test (brief §2.6, "Remind
// me later" holds a widen-the-search row for WIDEN_SNOOZE_DAYS = 5,
// src/widen-search.js) needs to read the return sooner than a real 5 days --
// but the only existing admin tool, reset-moments.js, wipes the WHOLE
// coachMoments blob, which would also erase the widen-search dedupe/pacing
// state a test session just spent establishing, not just fast-forward the
// one snooze date. This is the narrower tool: it touches exactly one field
// -- widenSearchState[rowKey][field] -- and nothing else in the profile.
//
// Same shape as reset-moments.js: widenSearchState (like coachMoments) is
// one top-level key inside users.profile_state, the same JSONB blob the
// ordinary autosave writes wholesale (api/profile/save.js). jsonb_set's
// default create_missing:=true means this works even if the row (or
// widenSearchState itself) has never been written yet.
//
// daysFromNow may be negative -- that is the actual use case: moving a
// snoozedUntil into the past makes the row read as no-longer-snoozed on the
// very next evaluator pass (src/widen-search.js's own isFuture check), the
// same effect five real days would have, without waiting for them.
//
// Restricted to an INTERNAL (@career.club) account only, same reasoning and
// same check (isInternalAccount) as reset-moments.js -- a blunt per-field
// testing tool, not something that belongs pointed at one of the 145 real
// registered accounts.
//
// Auth: signed-in session + ADMIN_LOGIN_EMAILS (api/_lib/admin-auth.js),
// same as every other admin control. POST { email, rowKey, field, daysFromNow }.

import { sql } from '../_lib/db.js'
import { checkAdminAuth, adminLoginEmailsMissing } from '../_lib/admin-auth.js'
import { getSessionUser } from '../_lib/session.js'
import { isInternalAccount } from '../_lib/feature-flags.js'
import { WIDEN_SEARCH_ROW_KEYS } from '../../src/coach-moments.js'

const VALID_FIELDS = ['snoozedUntil', 'retiredUntil']

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  if (adminLoginEmailsMissing()) {
    console.error('admin/set-widen-search-date: ADMIN_LOGIN_EMAILS not configured')
    return res.status(500).json({ error: 'Server misconfigured' })
  }
  if ((await checkAdminAuth(req, res)) !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' })
  }
  const admin = await getSessionUser(req, res)

  const body = req.body || {}
  const email = typeof body.email === 'string' ? body.email.trim() : ''
  const rowKey = typeof body.rowKey === 'string' ? body.rowKey.trim() : ''
  const field = typeof body.field === 'string' ? body.field.trim() : ''
  const daysFromNow = Number(body.daysFromNow)

  if (!email) return res.status(400).json({ error: 'email required' })
  if (!isInternalAccount({ email })) {
    return res.status(400).json({ error: 'Widen-search dates can only be set on an internal (@career.club) account' })
  }
  if (!WIDEN_SEARCH_ROW_KEYS.includes(rowKey)) {
    return res.status(400).json({ error: `rowKey must be one of: ${WIDEN_SEARCH_ROW_KEYS.join(', ')}` })
  }
  if (!VALID_FIELDS.includes(field)) {
    return res.status(400).json({ error: `field must be one of: ${VALID_FIELDS.join(', ')}` })
  }
  if (!Number.isFinite(daysFromNow)) {
    return res.status(400).json({ error: 'daysFromNow must be a number (negative moves the date into the past)' })
  }

  const iso = new Date(Date.now() + daysFromNow * 86400000).toISOString()

  try {
    const rows = await sql`
      UPDATE users
      SET profile_state = jsonb_set(
        COALESCE(profile_state, '{}'::jsonb),
        ARRAY['widenSearchState', ${rowKey}, ${field}],
        to_jsonb(${iso}::text),
        true
      )
      WHERE lower(email) = lower(${email})
      RETURNING email`
    if (rows.length === 0) return res.status(404).json({ error: 'No account with that email' })
    console.log('admin/set-widen-search-date', { email: rows[0].email, rowKey, field, iso, setBy: admin && admin.email })
    return res.status(200).json({ ok: true, email: rows[0].email, rowKey, field, iso })
  } catch (err) {
    console.error('admin/set-widen-search-date: query failed', err && err.message)
    return res.status(500).json({ error: 'Update failed' })
  }
}
