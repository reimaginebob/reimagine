// Admin read endpoint for Coach moment engagement (/admin/dashboard ->
// Feedback tab, "Coach moments" panel). Answers exactly what the 2026-09-09
// production test plan's moment-engagement check asks for: shown / accepted
// / declined rows, grouped by moment family, with a per-moment-key
// breakdown underneath so a tester can match specific firings against what
// they saw on screen.
//
// Reads coach_prompt_engagement (migrations/2026-09-07_coach-prompt-
// engagement.sql) -- the table every catalog-driven moment already logs
// into via logPromptEngagement (src/App.jsx). A 2026-09-13 dashboard review
// found the writes were landing with no admin view reading them back. This
// endpoint is that missing read.
//
// Family comes from src/coach-prompt-codes.js's PROMPT_CODE_FAMILY, derived
// from MOMENT_CATALOG the same way PROMPT_CODES itself is derived -- a new
// catalog row is covered automatically. Codes outside the catalog
// (employment_status, search_intake, and the other NON_CATALOG_PROMPT_CODES)
// have no family and roll up under 'other'.
//
// Auth mirrors api/admin/feedback-dashboard.js: signed-in session +
// ADMIN_LOGIN_EMAILS (api/_lib/admin-auth.js); missing env -> 500, no
// session or wrong account -> 403. Same-origin only, no CORS block.
//
// PRIVACY: user_id is read for nothing but COUNT(*) -- no user_id, email, or
// other per-account field ever rides into the response.

import { sql } from '../_lib/db.js'
import { PROMPT_CODE_FAMILY } from '../../src/coach-prompt-codes.js'
import { checkAdminAuth, adminLoginEmailsMissing } from '../_lib/admin-auth.js'

const FAMILY_LABELS = {
  arrival: 'Arrival',
  panel: 'Panel',
  choice: 'Choice',
  delivery: 'Delivery',
  check: 'Check-in',
  next_move: 'Next move',
  stall: 'Stall',
  other: 'Other (pre-catalog checks)',
}
const FAMILY_ORDER = ['arrival', 'panel', 'choice', 'delivery', 'check', 'next_move', 'stall', 'other']

// Same vocabulary and mapping as api/admin/feedback-dashboard.js so the
// shared range pills on /admin/dashboard mean the same thing on every tab.
function rangeToInterval(range) {
  switch (range) {
    case '24h': return '24 hours'
    case '7d':  return '7 days'
    case '30d': return '30 days'
    case 'all':
    default:    return null
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  if (adminLoginEmailsMissing()) {
    console.error('admin/moment-engagement: ADMIN_LOGIN_EMAILS not configured')
    return res.status(500).json({ error: 'Server misconfigured' })
  }
  if (!(await checkAdminAuth(req, res))) return res.status(403).json({ error: 'Forbidden' })

  const rawRange = (req.query && typeof req.query.range === 'string') ? req.query.range : 'all'
  const range = ['24h', '7d', '30d', 'all'].includes(rawRange) ? rawRange : 'all'
  const rangeInterval = rangeToInterval(range)

  let rows
  try {
    rows = rangeInterval === null
      ? await sql`
          SELECT prompt_code, outcome, COUNT(*)::int AS n
          FROM coach_prompt_engagement
          GROUP BY 1, 2
        `
      : await sql`
          SELECT prompt_code, outcome, COUNT(*)::int AS n
          FROM coach_prompt_engagement
          WHERE created_at >= NOW() - (${rangeInterval})::interval
          GROUP BY 1, 2
        `
  } catch (err) {
    console.error('admin/moment-engagement: query failed', err && err.message)
    return res.status(500).json({ error: 'Query failed' })
  }

  // --- Per prompt-code rollup: shown / accepted / declined / other outcomes -
  const byCode = new Map() // promptCode -> { shown, accepted, declined, otherOutcomes }
  for (const r of rows) {
    const code = r.prompt_code
    if (!byCode.has(code)) byCode.set(code, { shown: 0, accepted: 0, declined: 0, otherOutcomes: 0 })
    const bucket = byCode.get(code)
    if (r.outcome === 'shown') bucket.shown += r.n
    else if (r.outcome === 'accepted') bucket.accepted += r.n
    else if (r.outcome === 'declined') bucket.declined += r.n
    else bucket.otherOutcomes += r.n // the widen-search set's own vocabulary (offer made / do it now / ...)
  }

  const byPromptCode = [...byCode.entries()].map(([promptCode, counts]) => {
    const family = PROMPT_CODE_FAMILY[promptCode] || 'other'
    const noResponse = Math.max(0, counts.shown - counts.accepted - counts.declined)
    return { promptCode, family, familyLabel: FAMILY_LABELS[family] || family, ...counts, noResponse }
  }).sort((a, b) => a.family.localeCompare(b.family) || a.promptCode.localeCompare(b.promptCode))

  // --- Rolled up by family ---------------------------------------------------
  const familyMap = new Map()
  for (const code of byPromptCode) {
    if (!familyMap.has(code.family)) familyMap.set(code.family, { shown: 0, accepted: 0, declined: 0, noResponse: 0, otherOutcomes: 0, codes: 0 })
    const f = familyMap.get(code.family)
    f.shown += code.shown
    f.accepted += code.accepted
    f.declined += code.declined
    f.noResponse += code.noResponse
    f.otherOutcomes += code.otherOutcomes
    f.codes += 1
  }
  const byFamily = FAMILY_ORDER
    .filter(f => familyMap.has(f))
    .map(f => ({ family: f, label: FAMILY_LABELS[f] || f, ...familyMap.get(f) }))

  const totalShown = byPromptCode.reduce((sum, c) => sum + c.shown, 0)

  return res.status(200).json({
    generatedAt: new Date().toISOString(),
    range,
    totalShown,
    byFamily,
    byPromptCode,
  })
}
