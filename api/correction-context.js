// Vercel serverless function: records the text a correction was aimed at.
// The client (recordCorrection in src/App.jsx) posts it once, at the moment
// of the correction, for the section exactly as the person saw it. See
// migrations/2026-09-14_correction-context.sql for why this is its own
// write rather than a field inside profile.corrections.
//
// - POST only; origin allowlist; signed-in only (writes the caller's rows).
// - Body: { id: 'corr_…', step: string, original: string, recordId?: string }.
// - Write-once: ON CONFLICT (correction_id) DO NOTHING, so a retry or a
//   duplicate post never replaces the first snapshot.
// - Also fills corrections.original_inference when the autosave has already
//   inserted that correction. When it has not, api/profile/save.js fills it
//   from this table on insert. Either order ends with the column filled.

import { sql } from './_lib/db.js'
import { getSessionUser } from './_lib/session.js'
import { isAllowedOrigin } from './_lib/allowed-hosts.js'
import { stripNul } from './_lib/strip-nul.js'

// Long enough for the largest generated section (an Opportunity Playbook runs
// ~40 KB); truncating the tail of an outlier beats rejecting the snapshot.
export const MAX_ORIGINAL = 100000
const ID_RE = /^corr_[A-Za-z0-9_]{1,80}$/

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  const origin = req.headers.origin || req.headers.referer || ''
  if (!isAllowedOrigin(origin)) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  const body = req.body || {}
  const id = typeof body.id === 'string' ? body.id : ''
  const step = typeof body.step === 'string' ? body.step.trim().slice(0, 60) : ''
  const original = typeof body.original === 'string' ? stripNul(body.original).slice(0, MAX_ORIGINAL) : ''
  const recordId = typeof body.recordId === 'string' && body.recordId.trim() ? body.recordId.trim().slice(0, 120) : null
  if (!ID_RE.test(id) || !step || !original.trim()) {
    return res.status(400).json({ error: 'id, step and original are required' })
  }

  let user
  try {
    user = await getSessionUser(req, res)
  } catch (err) {
    console.warn('correction-context: session lookup failed', err)
    user = null
  }
  if (!user || !user.id) {
    return res.status(401).json({ error: 'Not authenticated' })
  }

  try {
    const inserted = await sql`
      INSERT INTO correction_context (correction_id, user_id, step, record_id, original_text)
      VALUES (${id}, ${user.id}::uuid, ${step}, ${recordId}, ${original})
      ON CONFLICT (correction_id) DO NOTHING
      RETURNING correction_id
    `
    // Only the first snapshot fills the column, and only on the caller's own row.
    if (inserted.length) {
      await sql`
        UPDATE corrections SET original_inference = ${original}
        WHERE id = ${id} AND user_id = ${user.id}::uuid AND original_inference IS NULL
      `
    }
    return res.status(200).json({ ok: true, recorded: inserted.length > 0 })
  } catch (err) {
    console.error('correction-context: write failed', { message: err?.message || String(err) })
    return res.status(500).json({ error: 'Could not record correction context.' })
  }
}
