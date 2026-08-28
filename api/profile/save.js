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
  // Ceiling raised 1 MB -> 3 MB on 2026-08-28. The old limit was reached by a
  // real account (1,049,069 bytes — 493 over), and because the client dropped
  // the 413 on the floor, every save it made for six days failed in silence.
  // The client now shows a save-failure notice, so crossing this is visible;
  // 3 MB keeps the request under Vercel's 4.5 MB body limit with room to spare.
  // This is headroom, not a fix for unbounded growth: profile_state is written
  // whole on every autosave, so a genuinely large blob is a cost problem before
  // it is a correctness one. Pruning what savedPlaybooks carries is the real fix.
  const MAX_PROFILE_BYTES = 3 * 1024 * 1024
  if (serialized.length > MAX_PROFILE_BYTES) {
    console.error('profile/save rejected: over size ceiling', {
      userId: req.user?.id,
      bodyBytes: serialized.length,
      ceiling: MAX_PROFILE_BYTES,
    })
    return res.status(413).json({ error: 'Profile too large', bytes: serialized.length, ceiling: MAX_PROFILE_BYTES })
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
