// Nightly backup snapshot of every account's profile_state (finding #2.6,
// 2026-09-08 prelaunch audit). Runs on a cron (daily -- see vercel.json).
//
// Combined with finding #2.5 (the autosave staleness precondition, which
// narrows how a stale device can overwrite newer work going forward), this
// is the per-user fallback for a corrupted or accidentally-emptied save:
// pull the most recent row from profile_state_snapshots for that account
// rather than requesting a full Neon point-in-time restore, which restores
// the WHOLE database to one moment and is an operation, not a per-user undo.
//
// One row per user per run, unconditional -- not a diff, not deduped
// against yesterday's snapshot. At 145 accounts and typical profile_state
// sizes this is cheap; a pruning/retention policy is deliberately deferred
// (finding #3.10, before-launch tier) rather than bundled into this fix.
//
// Auth: CRON_SECRET as a Bearer token (Vercel cron sends it). Mirrors the
// pattern in api/admin/stage-snapshot.js and the other cron endpoints.

import { sql } from '../_lib/db.js'

export default async function handler(req, res) {
  const expected = process.env.CRON_SECRET
  if (!expected) {
    console.error('admin/profile-snapshot: CRON_SECRET not configured')
    return res.status(500).json({ error: 'Server misconfigured' })
  }
  if ((req.headers.authorization || '') !== `Bearer ${expected}`) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  try {
    const rows = await sql`
      INSERT INTO profile_state_snapshots (user_id, profile_state, source_updated_at)
      SELECT id, profile_state, profile_updated_at
      FROM users
      RETURNING id
    `
    console.log('admin/profile-snapshot', { snapshotted: rows.length })
    return res.status(200).json({ ok: true, snapshotted: rows.length })
  } catch (err) {
    console.error('admin/profile-snapshot: failed', err && err.message)
    return res.status(500).json({ error: 'Snapshot failed' })
  }
}
