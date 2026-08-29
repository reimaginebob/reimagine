import { sql } from '../_lib/db.js'
import { requireAuth } from '../_lib/session.js'
import { stripNul } from '../_lib/strip-nul.js'

// Merge-on-save shim (2026-08-28, Phase 0 of the per-record savedPlaybooks
// migration). The client PUTs the WHOLE profile_state; a stale tab or second
// device carrying an OLDER savedPlaybooks would otherwise overwrite the column
// and silently drop playbooks it never saw — that is how a real user lost five
// opportunities. Union incoming with stored by playbook id, newest updatedAt
// wins, and NEVER drop a stored record just because the incoming payload lacks
// it. Caveat: a whole-array PUT can't tell "deleted" from "this tab never had
// it", so a permanently-deleted (or 90-day-purged) playbook can resurrect —
// acceptable versus losing work; Phase 3 (explicit per-record deletes) ends it.
function mergeSavedPlaybooks(incoming, stored) {
  const ts = (r) => (r && Date.parse(r.updatedAt || r.createdAt)) || 0
  const byId = new Map()
  const idless = []
  for (const r of (Array.isArray(stored) ? stored : [])) if (r && r.id) byId.set(r.id, r)
  for (const r of (Array.isArray(incoming) ? incoming : [])) {
    if (!r) continue
    if (!r.id) { idless.push(r); continue }
    const prev = byId.get(r.id)
    if (!prev || ts(r) >= ts(prev)) byId.set(r.id, r)
  }
  return [...byId.values(), ...idless]
}

async function handler(req, res) {
  if (req.method !== 'PUT' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  const rawProfile = req.body
  if (!rawProfile || typeof rawProfile !== 'object') {
    return res.status(400).json({ error: 'Invalid profile' })
  }

  const profile = stripNul(rawProfile)

  // Merge savedPlaybooks against what's stored so a stale client can't clobber
  // playbooks it never saw. Best-effort: if the read fails, fall through and
  // write incoming as-is rather than blocking the save. Other profile fields keep
  // their prior last-write-wins behavior — the accumulating, high-value array is
  // savedPlaybooks, and that's what this protects.
  if (Array.isArray(profile.savedPlaybooks)) {
    try {
      const rows = await sql`SELECT profile_state->'savedPlaybooks' AS sp FROM users WHERE id = ${req.user.id} LIMIT 1`
      let stored = rows.length ? rows[0].sp : null
      if (typeof stored === 'string') { try { stored = JSON.parse(stored) } catch { stored = [] } }
      profile.savedPlaybooks = mergeSavedPlaybooks(profile.savedPlaybooks, Array.isArray(stored) ? stored : [])
    } catch (err) {
      console.error('profile/save merge-on-save read failed; writing incoming as-is', { userId: req.user?.id, message: err?.message })
    }
  }

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
