import { sql } from './db.js'

// Section ids a "view" can be recorded against -- generated-content
// destinations only, matched to the step ids NAV_LABELS (src/nav-labels.js)
// renders under those names, plus 'focus' for reopening a saved Focus
// Playbook as a whole (its own sections render together on one page --
// see src/App.jsx's restoreFromSavedSlot). Kept as its own list rather than
// importing NAV_LABELS: that map also carries orientation and structural
// step ids ('welcome', 'resume', ...) that are never a "view" of generated
// content.
export const VIEWABLE_SECTION_IDS = Object.freeze([
  'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9', 'p11', 'p_res', 'income', 'op', 'focus',
])

// Best-effort, same convention as api/claude.js's logGeneration and
// api/_lib/support-events.js's recordSupportEvent: a logging failure must
// never become a user-visible failure on a page that just rendered fine.
export async function recordViewEvent(userId, section) {
  if (!userId) return
  const s = typeof section === 'string' ? section.trim() : ''
  if (!VIEWABLE_SECTION_IDS.includes(s)) return
  try {
    await sql`INSERT INTO view_events (user_id, section) VALUES (${userId}, ${s})`
  } catch (err) {
    console.error('view-events: insert failed', { section: s, message: (err && err.message) || String(err) })
  }
}
