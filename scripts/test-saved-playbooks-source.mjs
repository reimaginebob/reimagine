// Guards finding #2.7 from the 2026-09-08 prelaunch audit: the
// savedPlaybooks migration was half-landed. Phase 3 stopped the client from
// writing savedPlaybooks into the profile_state JSONB blob (src/App.jsx's
// autosave blob no longer carries it -- see finding #2.5's own PR), but six
// server-side readers kept reading profile_state->'savedPlaybooks' from that
// now-permanently-stale blob: the abuse watchdog's ≥15-playbooks/hour
// threshold, three admin dashboards (analytics, growth, dormant), the
// lifecycle stage classifier (user-stages), and the daily stage-snapshot
// cron. Each went blind account by account as its blob copy stopped
// updating. Fixed by pointing all six at the saved_playbooks table (the
// actual source of truth since Phase 1), and the now-dead merge-on-save
// shim in api/profile/save.js (which protected the blob's copy against a
// stale overwrite, for a field no current client has sent since Phase 3)
// was removed.
//
// SOURCE-PRESENCE ONLY, no behavioral layer: this fix is entirely a set of
// SQL query rewrites (JSONB-array-unrolling to a JOIN or correlated
// subquery against saved_playbooks) with no new pure JS logic to extract --
// unlike the DB-dependent parts of earlier PRs in this batch (the Coach
// turn cap in PR3, checkAdminAuth in PR6), there is no pure function this
// PR introduces that source-presence would otherwise be substituting for.
// The actual query correctness can only be verified against a live
// Postgres connection, which this sandbox does not have.
//
// What these checks pin down: (1) none of the six files still read the
// stale JSONB path, (2) each reads saved_playbooks instead, (3) the dead
// merge shim and its dedicated SELECT are gone from profile/save.js, and
// (4) no archived_at filter was introduced anywhere -- the blob-based
// queries never filtered archived playbooks out, and adding that filter
// now would be a silent, undocumented behavior change rather than a
// straight table swap.
import fs from 'node:fs'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

const SIX_FILES = [
  'api/admin/activity-watchdog.js',
  'api/admin/analytics.js',
  'api/admin/growth.js',
  'api/admin/dormant.js',
  'api/admin/user-stages.js',
  'api/admin/stage-snapshot.js',
]

for (const file of SIX_FILES) {
  const src = fs.readFileSync(file, 'utf8')
  // Strip line comments before checking for the buggy pattern, so an
  // explanatory comment mentioning the old path (for context) doesn't
  // false-positive against the actual fix.
  const codeOnly = src.split('\n').map(l => l.replace(/\/\/.*$/, '')).join('\n')
  check(!/jsonb_array_elements\(COALESCE\([^)]*savedPlaybooks/.test(codeOnly) && !codeOnly.includes("savedPlaybooks') = 'array'"),
    `${file}: still unrolls the savedPlaybooks JSONB array instead of joining saved_playbooks`)
  check(/saved_playbooks/.test(src), `${file}: does not reference the saved_playbooks table at all`)
  check(!/archived_at\s+IS\s+NULL/i.test(codeOnly) && !/\bsp\.archived_at\b/.test(codeOnly),
    `${file}: a saved_playbooks query appears to filter on archived_at -- this would silently change behavior versus the never-filtered blob queries, and was deliberately not added`)
}

// growth.js has six separate savedPlaybooks-reading sites (per the audit and
// the pre-flight research); confirm the rewrite touched all of them, not
// just the first one found.
{
  const growth = fs.readFileSync('api/admin/growth.js', 'utf8')
  const joinOrSubqueryCount = (growth.match(/saved_playbooks/g) || []).length
  check(joinOrSubqueryCount >= 6,
    `api/admin/growth.js: expected at least 6 references to saved_playbooks (one per query site the audit named), found ${joinOrSubqueryCount} -- a site may have been missed`)
}

// stage-snapshot.js: both stage gates (opportunity, career_paths) each have
// a qualifying EXISTS/gate AND a MIN(created_at) dating subquery -- four
// sites total, all against the table now.
{
  const snapshot = fs.readFileSync('api/admin/stage-snapshot.js', 'utf8')
  check((snapshot.match(/FROM saved_playbooks sp/g) || []).length >= 4,
    `api/admin/stage-snapshot.js: expected at least 4 saved_playbooks reads (2 gates + 2 MIN(created_at) subqueries), found fewer`)
}

// --- api/profile/save.js: the dead merge shim is gone -----------------------

const SAVE = 'api/profile/save.js'
const save = fs.readFileSync(SAVE, 'utf8')
check(!save.includes('mergeSavedPlaybooks'), `${SAVE}: the dead merge-on-save shim function survives`)
check(!save.includes("SELECT profile_state->'savedPlaybooks'"), `${SAVE}: still runs the per-save SELECT the shim used to guard`)
check(!save.includes('profile.savedPlaybooks'), `${SAVE}: still branches on an incoming profile.savedPlaybooks array`)
// parseIncomingUpdatedAt (finding #2.5) must survive untouched -- this PR
// should not have collaterally damaged the previous PR's fix.
check(save.includes('export function parseIncomingUpdatedAt(raw)'), `${SAVE}: parseIncomingUpdatedAt (finding #2.5) no longer present -- unrelated regression`)
check(save.includes('RETURNING profile_updated_at'), `${SAVE}: the staleness-precondition UPDATE (finding #2.5) no longer present -- unrelated regression`)

if (failures) {
  console.error(`test-saved-playbooks-source: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-saved-playbooks-source: OK (all 6 admin/watchdog/cron files read saved_playbooks instead of the stale profile_state JSONB blob, no archived_at filter was silently introduced, and the dead merge-on-save shim is gone from profile/save.js without disturbing finding #2.5\'s own fix in the same file)')
}
