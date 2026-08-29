// Per-record playbook store (Phase 1 of moving savedPlaybooks out of the
// profile_state blob). One row per playbook in saved_playbooks, keyed
// (user_id, playbook_id). Phase 1: the client dual-writes here while reads still
// come from the blob; Phase 2 switches reads to this table; Phase 3 makes it the
// only home. Cookie-session auth (requireAuth) — the connector never writes
// playbooks, only pursuit_status / pursuit_interviewers.
//
//   GET    -> { playbooks: [...] }   every row for the caller (the full records)
//   PUT    -> { playbook }           upsert one, keyed by playbook.id; stale-write
//                                    guarded (an older updatedAt cannot overwrite)
//   DELETE -> { playbookId }         remove one (the explicit-delete path the blob
//                                    merge shim can't express)

import { sql } from './_lib/db.js'
import { requireAuth } from './_lib/session.js'
import { stripNul } from './_lib/strip-nul.js'

const parseTs = (v) => { if (v == null || v === '') return null; const d = new Date(v); return Number.isNaN(d.getTime()) ? null : d.toISOString() }

async function handler(req, res) {
  const uid = req.user.id
  try {
    if (req.method === 'GET') {
      const rows = await sql`SELECT data FROM saved_playbooks WHERE user_id = ${uid}::uuid ORDER BY created_at NULLS FIRST`
      return res.status(200).json({ playbooks: rows.map(r => r.data) })
    }

    if (req.method === 'PUT') {
      const raw = req.body && req.body.playbook
      if (!raw || typeof raw !== 'object' || typeof raw.id !== 'string' || !raw.id.trim()) {
        return res.status(400).json({ error: 'playbook with a string id is required' })
      }
      const p = stripNul(raw)
      const id = p.id
      const source = typeof p.source === 'string' ? p.source : null
      const archivedAt = parseTs(p.archivedAt)
      const createdAt = parseTs(p.createdAt)
      const updatedAt = parseTs(p.updatedAt) || createdAt || new Date().toISOString()
      // Stale-write guard: only overwrite an existing row when the incoming record
      // is at least as new as what's stored, so a slow tab can't stomp a newer edit.
      await sql`
        INSERT INTO saved_playbooks (user_id, playbook_id, source, archived_at, created_at, updated_at, data)
        VALUES (${uid}::uuid, ${id}, ${source}, ${archivedAt}, ${createdAt}, ${updatedAt}, ${p}::jsonb)
        ON CONFLICT (user_id, playbook_id) DO UPDATE SET
          source = EXCLUDED.source, archived_at = EXCLUDED.archived_at, created_at = EXCLUDED.created_at,
          updated_at = EXCLUDED.updated_at, data = EXCLUDED.data
        WHERE saved_playbooks.updated_at IS NULL OR EXCLUDED.updated_at >= saved_playbooks.updated_at
      `
      return res.status(200).json({ ok: true })
    }

    if (req.method === 'DELETE') {
      const id = req.body && typeof req.body.playbookId === 'string' ? req.body.playbookId.trim() : ''
      if (!id) return res.status(400).json({ error: 'playbookId is required' })
      await sql`DELETE FROM saved_playbooks WHERE user_id = ${uid}::uuid AND playbook_id = ${id}`
      return res.status(200).json({ ok: true })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (err) {
    console.error('saved-playbooks failed', { userId: uid, method: req.method, message: err?.message })
    return res.status(500).json({ error: 'saved-playbooks failed' })
  }
}

export default requireAuth(handler)
