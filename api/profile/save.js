import { sql } from '../_lib/db.js'
import { requireAuth } from '../_lib/session.js'
import { stripNul } from '../_lib/strip-nul.js'

async function handler(req, res) {
  if (req.method !== 'PUT' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  const rawProfile = req.body
  if (!rawProfile || typeof rawProfile !== 'object') {
    return res.status(400).json({ error: 'Invalid profile' })
  }

  const profile = stripNul(rawProfile)
  const serialized = JSON.stringify(profile)
  if (serialized.length > 1024 * 1024) {
    return res.status(413).json({ error: 'Profile too large' })
  }

  try {
    await sql`
      UPDATE users
      SET profile_state = ${profile}::jsonb, profile_updated_at = NOW()
      WHERE id = ${req.user.id}
    `
  } catch (err) {
    console.error('profile/save failed', {
      userId: req.user?.id,
      requestId: req.headers['x-vercel-id'] || null,
      pgCode: err?.code || null,
      pgDetail: err?.detail || null,
      bodyBytes: serialized.length,
      message: err?.message || String(err),
    })
    return res.status(500).json({ error: 'Save failed' })
  }
  return res.status(200).json({ ok: true })
}

export default requireAuth(handler)
