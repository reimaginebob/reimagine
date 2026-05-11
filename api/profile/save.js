import { sql } from '../_lib/db.js'
import { requireAuth } from '../_lib/session.js'

async function handler(req, res) {
  if (req.method !== 'PUT' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  const profile = req.body
  if (!profile || typeof profile !== 'object') {
    return res.status(400).json({ error: 'Invalid profile' })
  }

  // Cap payload size at 1 MB to prevent abuse
  const serialized = JSON.stringify(profile)
  if (serialized.length > 1024 * 1024) {
    return res.status(413).json({ error: 'Profile too large' })
  }

  await sql`
    UPDATE users
    SET profile_state = ${profile}::jsonb, profile_updated_at = NOW()
    WHERE id = ${req.user.id}
  `
  return res.status(200).json({ ok: true })
}

export default requireAuth(handler)
