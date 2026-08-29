import { sql } from './db.js'

// Read a user's playbooks from the per-record saved_playbooks table (Phase 2:
// reads move here from the profile_state blob). Union with the blob fallback so a
// dual-write miss during the transition can't hide a record — the table wins on
// id (it's the go-forward source and gives cross-device freshness), and any
// blob-only record is preserved. On a table-read failure, fall back entirely to
// the blob. After Phase 3 the blob no longer carries playbooks, so this naturally
// becomes table-only.
export async function getSavedPlaybooks(userId, blobFallback) {
  const blob = Array.isArray(blobFallback) ? blobFallback : []
  let fromTable
  try {
    const rows = await sql`SELECT data FROM saved_playbooks WHERE user_id = ${userId}::uuid ORDER BY created_at NULLS FIRST`
    fromTable = rows.map(r => r.data).filter(Boolean)
  } catch {
    return blob
  }
  const byId = new Map()
  for (const r of blob) if (r && r.id) byId.set(r.id, r)
  for (const r of fromTable) if (r && r.id) byId.set(r.id, r) // table wins on shared id
  const idless = blob.filter(r => r && !r.id)
  return [...byId.values(), ...idless]
}
