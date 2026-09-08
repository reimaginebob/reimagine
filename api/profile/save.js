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

// Validates the client's claimed profile_updated_at (finding #2.5). Absent
// or unparsable is deliberately treated the same as "no precondition" --
// see the call site's own comment -- rather than rejected outright, so an
// older cached client bundle (which never sends this field) keeps saving
// exactly as it always did.
export function parseIncomingUpdatedAt(raw) {
  return typeof raw === 'string' && raw && !Number.isNaN(Date.parse(raw)) ? raw : null
}

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
  const rawBody = req.body
  if (!rawBody || typeof rawBody !== 'object') {
    return res.status(400).json({ error: 'Invalid profile' })
  }

  // profile_updated_at (finding #2.5, 2026-09-08 prelaunch audit): the
  // client's own last-known server timestamp, sent so a device carrying a
  // stale copy (a slow load racing a fast one, or two tabs/devices editing
  // at once) cannot blindly overwrite work saved elsewhere since. Transport
  // metadata, not part of the stored shape -- pulled out before the rest
  // becomes profile_state. Absent or unparsable is treated as "no
  // precondition" (an older client bundle, or a genuinely first save),
  // matching how a caller with nothing to compare against always did before.
  const { profile_updated_at: rawIncomingUpdatedAt, ...rawProfile } = rawBody
  const incomingUpdatedAt = parseIncomingUpdatedAt(rawIncomingUpdatedAt)

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

  // Staleness precondition (finding #2.5): the UPDATE itself carries the
  // guard, atomically, rather than a separate read-then-write -- a stored
  // profile_updated_at of NULL (never saved before) or no incoming timestamp
  // (older client, first save) both mean "nothing to compare against, allow
  // it"; otherwise the incoming save must be at least as new as what is
  // already stored. RETURNING is empty exactly when the precondition failed
  // (req.user.id is already known to exist -- requireAuth confirmed the
  // session against it), so a zero-row result is read as "stale, rejected"
  // rather than probed further.
  let rows
  try {
    rows = await sql`
      UPDATE users
      SET profile_state = ${profile}::jsonb, profile_updated_at = NOW()
      WHERE id = ${req.user.id}
        AND (profile_updated_at IS NULL OR ${incomingUpdatedAt}::timestamptz IS NULL OR profile_updated_at <= ${incomingUpdatedAt}::timestamptz)
      RETURNING profile_updated_at
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

  if (rows.length === 0) {
    return res.status(409).json({ error: 'stale', message: 'Newer changes already exist on the server' })
  }

  return res.status(200).json({ ok: true, updatedAt: rows[0].profile_updated_at })
}

export default requireAuth(handler)
