// The STAR story library store. One row per story per user in star_stories.
//
// Stories belong to the person, not to an opportunity, so nothing here takes a
// playbook id. Same per-record shape as api/saved-playbooks.js — targeted writes
// and deletes rather than a whole-blob rewrite, which is what kept a stale tab
// from dropping records it never saw.
//
//   GET    -> { stories: [...] }   every row for the caller
//   PUT    -> { story }            upsert one, keyed by story.id; stale-write guarded
//   DELETE -> { storyId }          remove one
//   DELETE -> { all: true }        remove every story for the caller
//
// Cookie-session auth (requireAuth), same as saved-playbooks.

import { sql } from './_lib/db.js'
import { requireAuth } from './_lib/session.js'
import { stripNul } from './_lib/strip-nul.js'

const parseTs = (v) => { if (v == null || v === '') return null; const d = new Date(v); return Number.isNaN(d.getTime()) ? null : d.toISOString() }
const str = (v) => (typeof v === 'string' ? v.trim() : '')

async function handler(req, res) {
  const uid = req.user.id
  try {
    if (req.method === 'GET') {
      const rows = await sql`SELECT data FROM star_stories WHERE user_id = ${uid}::uuid ORDER BY created_at NULLS FIRST`
      return res.status(200).json({ stories: rows.map(r => r.data) })
    }

    if (req.method === 'PUT') {
      const raw = req.body && req.body.story
      if (!raw || typeof raw !== 'object' || !str(raw.id)) {
        return res.status(400).json({ error: 'story with a string id is required' })
      }
      const s = stripNul(raw)
      const title = str(s.title)
      if (!title) return res.status(400).json({ error: 'story.title is required' })
      const createdAt = parseTs(s.createdAt)
      const updatedAt = parseTs(s.updatedAt) || createdAt || new Date().toISOString()
      // Stale-write guard: an older version of a story cannot overwrite a newer
      // one, so a slow tab cannot stomp an edit made somewhere else.
      await sql`
        INSERT INTO star_stories (user_id, story_id, title, kind, origin, created_at, updated_at, data)
        VALUES (${uid}::uuid, ${str(s.id)}, ${title}, ${str(s.kind) || null}, ${str(s.origin) || null}, ${createdAt}, ${updatedAt}, ${s}::jsonb)
        ON CONFLICT (user_id, story_id) DO UPDATE SET
          title = EXCLUDED.title, kind = EXCLUDED.kind, origin = EXCLUDED.origin,
          created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at, data = EXCLUDED.data
        WHERE star_stories.updated_at IS NULL OR EXCLUDED.updated_at >= star_stories.updated_at
      `
      return res.status(200).json({ ok: true })
    }

    if (req.method === 'DELETE') {
      // Starting the library over. The seed accumulated across prompt versions
      // and left several stale answers to the same question, and no title-based
      // dedupe can merge one event worded three different ways -- so there has to
      // be a way back to empty.
      //
      // Gated on an explicit flag, never on a missing storyId: a client that
      // forgot to send the id would otherwise wipe the library silently, which is
      // exactly what per-record storage exists to prevent.
      if (req.body && req.body.all === true) {
        const gone = await sql`DELETE FROM star_stories WHERE user_id = ${uid}::uuid RETURNING story_id`
        return res.status(200).json({ ok: true, deleted: gone.length })
      }
      const id = req.body && str(req.body.storyId)
      if (!id) return res.status(400).json({ error: 'storyId is required' })
      await sql`DELETE FROM star_stories WHERE user_id = ${uid}::uuid AND story_id = ${id}`
      return res.status(200).json({ ok: true })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (err) {
    console.error('star-stories error:', err)
    return res.status(500).json({ error: 'Server error' })
  }
}

export default requireAuth(handler)
