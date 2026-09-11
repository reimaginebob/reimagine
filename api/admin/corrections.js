// Admin read endpoint for the corrections table (replaces reviewing the
// "Reimagine Corrections Log" Google Sheet, dead since 2026-08-20 -- see
// migrations/2026-09-11_corrections-table.sql for why). Every correction a
// user makes across any section now lands here automatically via
// api/profile/save.js; this just reads it back.
//
// Auth: signed-in session + ADMIN_LOGIN_EMAILS/ANALYST_LOGIN_EMAILS
// (api/_lib/admin-auth.js) -- same pattern as api/admin/growth.js. Read-only,
// so analyst access is enough.

import { sql } from '../_lib/db.js'
import { checkAdminAuth, adminLoginEmailsMissing } from '../_lib/admin-auth.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  if (adminLoginEmailsMissing()) {
    console.error('admin/corrections: ADMIN_LOGIN_EMAILS not configured')
    return res.status(500).json({ error: 'Server misconfigured' })
  }
  if (!(await checkAdminAuth(req, res, { allowAnalyst: true }))) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  const rawLimit = (req.query && typeof req.query.limit === 'string') ? parseInt(req.query.limit, 10) : 200
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 1000) : 200
  const stepFilter = (req.query && typeof req.query.step === 'string' && req.query.step) ? req.query.step : null

  let rows, byStep
  try {
    rows = stepFilter
      ? await sql`
          SELECT id, user_email, step, step_display_name, correction_text, created_at, captured_at
          FROM corrections
          WHERE step = ${stepFilter}
          ORDER BY created_at DESC NULLS LAST
          LIMIT ${limit}
        `
      : await sql`
          SELECT id, user_email, step, step_display_name, correction_text, created_at, captured_at
          FROM corrections
          ORDER BY created_at DESC NULLS LAST
          LIMIT ${limit}
        `
    byStep = await sql`
      SELECT step, count(*)::int AS n, max(created_at) AS last_at
      FROM corrections
      GROUP BY step
      ORDER BY n DESC
    `
  } catch (err) {
    console.error('admin/corrections: query failed', err && err.message)
    return res.status(500).json({ error: 'Query failed' })
  }

  return res.status(200).json({
    generatedAt: new Date().toISOString(),
    total: byStep.reduce((sum, r) => sum + r.n, 0),
    byStep,
    corrections: rows,
  })
}
