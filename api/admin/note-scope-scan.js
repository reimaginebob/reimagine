// One-time (re-runnable) read-only scan for notes that talk about the wrong
// opportunity.
//
// Why this exists: between COACHSUMMARY going GA (#979, 2026-09-17 16:28 UTC)
// and the cross-opportunity scope fix (#983, the same evening), a summary
// written while one Coach conversation spanned two opportunities could be
// filed against one of them while describing the other. One such note was
// found live on an internal account -- it opened on a different company's
// travel requirement and named that company's contacts. The fix stops NEW
// notes going wrong; it does nothing about notes already written.
//
// The conditions were narrow (two or more open opportunities, both discussed
// in one session with no Clear, a summary offered or asked for, and the Save
// tap -- inside a few hours), so the honest expectation is zero or very few.
// This answers that with data instead of an estimate.
//
// READ-ONLY, and deliberately so. It reports; it never edits or deletes. A
// saved note is content this person accepted with a tap, a match here is a
// signal rather than a verdict (the same detector runs at reply time, where
// it is tuned to favour precision but is not infallible), and an automated
// delete of the wrong row cannot be undone. What to do about each note is
// Bob's call, made by reading it.
//
// Reuses summaryNamesOtherOpportunity and otherOpportunityNames from
// api/coach.js -- the exact functions that now gate this at write time, so
// the scan and the guard can never drift into disagreeing about what counts.
//
// Auth: signed-in session + ADMIN_LOGIN_EMAILS (api/_lib/admin-auth.js), same
// as every other admin control. GET.

import { sql } from '../_lib/db.js'
import { checkAdminAuth, adminLoginEmailsMissing } from '../_lib/admin-auth.js'
import { summaryNamesOtherOpportunity, otherOpportunityNames } from '../coach.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  if (adminLoginEmailsMissing()) {
    console.error('admin/note-scope-scan: ADMIN_LOGIN_EMAILS not configured')
    return res.status(500).json({ error: 'Server misconfigured' })
  }
  if ((await checkAdminAuth(req, res)) !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' })
  }

  let rows = []
  try {
    // Only accounts that could possibly match: a saved note lives inside
    // profile_state, and an account with none has nothing to scan.
    rows = await sql`
      SELECT id, email, profile_state
      FROM users
      WHERE profile_state IS NOT NULL
      ORDER BY email`
  } catch (err) {
    console.error('admin/note-scope-scan: read failed', err)
    return res.status(500).json({ error: 'Scan failed' })
  }

  const findings = []
  let accountsScanned = 0
  let notesScanned = 0

  for (const row of rows) {
    const state = row && row.profile_state && typeof row.profile_state === 'object' ? row.profile_state : null
    const saved = state && Array.isArray(state.savedPlaybooks) ? state.savedPlaybooks : []
    const active = saved.filter(r => r && !r.archivedAt)
    // One opportunity cannot cross-reference anything.
    if (active.filter(r => r && r.source === 'door2').length < 2) continue
    accountsScanned += 1
    for (const rec of active) {
      if (!rec || rec.source !== 'door2') continue
      const notes = Array.isArray(rec.savedNotes) ? rec.savedNotes : []
      if (!notes.length) continue
      const others = otherOpportunityNames(active, rec)
      if (!others.length) continue
      for (const note of notes) {
        const text = (note && typeof note.text === 'string') ? note.text : ''
        if (!text.trim()) continue
        notesScanned += 1
        const named = summaryNamesOtherOpportunity(text, others)
        if (!named) continue
        findings.push({
          email: row.email,
          filed_under: rec.title || rec.id,
          names_instead: named,
          note_id: (note && note.id) || null,
          note_source: (note && note.source) || null,
          created_at: (note && note.createdAt) || null,
          // Enough to find and judge the note in the UI without reproducing
          // its body in an admin response.
          preview: text.trim().replace(/\s+/g, ' ').slice(0, 160),
        })
      }
    }
  }

  return res.status(200).json({
    scanned: { accounts: accountsScanned, notes: notesScanned },
    findings,
    note: 'Read-only. Nothing was changed. A match means the note names another open opportunity, which is a signal to read it, not proof it is wrong.',
  })
}
