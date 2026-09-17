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
// It reads the notes the same way, too, and for the same reason. Playbooks
// (and the savedNotes that ride on them) no longer live in the profile_state
// blob: the client stopped writing them there at Phase 3 of that migration --
// stateForSave in src/App.jsx does not carry savedPlaybooks, and the comment
// in api/profile/save.js says so outright -- so they are in the per-record
// saved_playbooks table. The first version of this scan read the blob
// directly and reported 0 notes on every account, including one whose
// opportunities visibly had notes in the product. getSavedPlaybooks is the
// same read api/coach.js performs every turn (table, union'd with whatever
// legacy blob rows remain), so the scan now sees exactly the records Coach
// sees.
//
// Auth: signed-in session + ADMIN_LOGIN_EMAILS (api/_lib/admin-auth.js), same
// as every other admin control. GET.

import { sql } from '../_lib/db.js'
import { checkAdminAuth, adminLoginEmailsMissing } from '../_lib/admin-auth.js'
import { summaryNamesOtherOpportunity, otherOpportunityNames } from '../coach.js'
import { getSavedPlaybooks } from '../_lib/saved-playbooks.js'

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
    // Narrow to accounts that could possibly match before doing any per-account
    // work: an account with no opportunity at all cannot cross-reference one.
    // Deliberately over-inclusive -- it asks for ANY door2 record rather than
    // two, because the real count is only known after getSavedPlaybooks unions
    // table and blob below, and it accepts archived rows because archivedAt on
    // the record itself (not the denormalized column) is what the scan filters
    // on. Over-including costs one extra table read per account and is checked
    // again in full; under-including would silently hide a finding.
    rows = await sql`
      SELECT u.id, u.email, u.profile_state
      FROM users u
      WHERE EXISTS (
              SELECT 1 FROM saved_playbooks sp
              WHERE sp.user_id = u.id AND sp.source = 'door2'
            )
         OR u.profile_state -> 'savedPlaybooks' @> '[{"source":"door2"}]'::jsonb
      ORDER BY u.email`
  } catch (err) {
    console.error('admin/note-scope-scan: read failed', err)
    return res.status(500).json({ error: 'Scan failed' })
  }

  const findings = []
  let accountsScanned = 0
  let notesScanned = 0

  for (const row of rows) {
    const state = row && row.profile_state && typeof row.profile_state === 'object' ? row.profile_state : null
    // The same read api/coach.js does: the saved_playbooks table, union'd with
    // any legacy blob record the table does not have. Reading state.savedPlaybooks
    // on its own is how this scan first reported zero notes everywhere.
    const saved = await getSavedPlaybooks(row.id, state && state.savedPlaybooks)
    const result = findCrossScopedNotes(saved)
    if (!result.eligible) continue
    accountsScanned += 1
    notesScanned += result.notesScanned
    for (const f of result.findings) findings.push({ email: row.email, ...f })
  }

  return res.status(200).json({
    // candidates is deliberately reported next to the other two. This scan's
    // first version returned notes: 0 and read as clean when it was reading the
    // wrong storage entirely. Seeing "40 accounts had an opportunity, 0 were
    // scanned" makes that shape of failure visible in the output instead of
    // indistinguishable from a genuinely clean result.
    scanned: { candidates: rows.length, accounts: accountsScanned, notes: notesScanned },
    findings,
    note: 'Read-only. Nothing was changed. A match means the note names another open opportunity, which is a signal to read it, not proof it is wrong.',
  })
}

// The matching itself, with no I/O, so a test can run the real thing rather
// than grep for it -- including against records shaped as they come back from
// the saved_playbooks table, since that is now where they come from and the
// source/archivedAt filters below have to hold on that shape as well as the
// legacy blob's. Returns { eligible, notesScanned, findings }; eligible is
// false for an account that cannot cross-reference anything.
export function findCrossScopedNotes(saved) {
  const active = (Array.isArray(saved) ? saved : []).filter(r => r && !r.archivedAt)
  // One opportunity cannot cross-reference anything.
  if (active.filter(r => r && r.source === 'door2').length < 2) {
    return { eligible: false, notesScanned: 0, findings: [] }
  }
  const findings = []
  let notesScanned = 0
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
  return { eligible: true, notesScanned, findings }
}
