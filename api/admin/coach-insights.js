// Admin read endpoint for the My Coach question-insight dashboard.
//
// Auth mirrors api/admin/analytics.js exactly: ADMIN_TOKEN, accepted as either
// Authorization: Bearer <token> OR ?t=<token> (browser convenience); missing env
// -> 500, neither credential -> 403. Same CORS block so a same-origin browser
// page (src/CoachInsights.jsx) can read it. ADMIN_EMAILS, if set, are excluded
// from the aggregates (so the operator's own test turns don't skew the picture).
//
// PRIVACY: this endpoint aggregates over NON-PII only. reply, user_id, and email
// NEVER leave the server (email is used only in a WHERE to exclude admins). The
// only place raw question text appears is the unmetQuestions list, and even there
// it returns message + current_step + created_at + attributes only — never the
// reply or any identity. Requires the selfcheck columns (2026-06-10 migration)
// and the insight columns/table (2026-06-12 migration) to be live.

import { sql } from '../_lib/db.js'
import { TAXONOMY_VERSION, CATEGORIES, ATTRIBUTE_KEYS } from '../_lib/coach-taxonomy.js'

const DEFAULT_DAYS = 14
const MAX_DAYS = 90
const UNMET_CAP = 200

function parseAdminEmails(raw) {
  return (raw || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
}

function tally(rows, key) {
  const out = {}
  for (const r of rows) {
    const v = (r.attributes && typeof r.attributes === 'object') ? r.attributes[key] : null
    const label = (typeof v === 'string' && CATEGORIES[key].includes(v)) ? v : '(null)'
    out[label] = (out[label] || 0) + 1
  }
  return out
}

export default async function handler(req, res) {
  // CORS — same posture as analytics.js: wildcard origin is safe because the
  // ADMIN_TOKEN gate below is unchanged and a wildcard cannot ride credentialed
  // (cookie) requests, so no ambient authority is exposed.
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const expected = process.env.ADMIN_TOKEN
  if (!expected) {
    console.error('admin/coach-insights: ADMIN_TOKEN not configured')
    return res.status(500).json({ error: 'Server misconfigured' })
  }
  const auth = req.headers.authorization || ''
  const headerOk = auth === `Bearer ${expected}`
  const queryToken = (req.query && typeof req.query.t === 'string') ? req.query.t : ''
  const queryOk = queryToken !== '' && queryToken === expected.trim()
  if (!headerOk && !queryOk) return res.status(403).json({ error: 'Forbidden' })

  // Window (?days=, capped) and attribute filters (?topic=, ?stage=, ...),
  // validated against the taxonomy so nothing untrusted reaches SQL.
  let days = parseInt((req.query && req.query.days) || '', 10)
  if (!Number.isInteger(days) || days < 1) days = DEFAULT_DAYS
  if (days > MAX_DAYS) days = MAX_DAYS

  const filter = {}
  for (const k of ATTRIBUTE_KEYS) {
    const v = req.query && typeof req.query[k] === 'string' ? req.query[k] : ''
    if (v && CATEGORIES[k].includes(v)) filter[k] = v
  }
  const hasFilter = Object.keys(filter).length > 0
  const filterJson = JSON.stringify(filter)
  const adminJson = JSON.stringify(parseAdminEmails(process.env.ADMIN_EMAILS))
  const V = TAXONOMY_VERSION

  try {
    // 1. Totals + verdict breakdown over all messages in the window (admin-
    //    excluded, attribute-filtered). LEFT JOIN so untagged rows still count
    //    toward totals/verdict; the attribute filter, when present, requires a tag.
    const totalsRows = await sql`
      SELECT
        count(*)::int AS total,
        count(t.message_id)::int AS tagged,
        count(*) FILTER (WHERE c.selfcheck_verdict = 'matched')::int AS matched,
        count(*) FILTER (WHERE c.selfcheck_verdict = 'none')::int AS none_count,
        count(*) FILTER (WHERE c.selfcheck_verdict IS NULL)::int AS unset
      FROM chat_messages c
      LEFT JOIN coach_message_tags t ON t.message_id = c.id AND t.taxonomy_version = ${V}
      WHERE c.created_at >= NOW() - (${days} * INTERVAL '1 day')
        AND (${hasFilter} = false OR t.attributes @> ${filterJson}::jsonb)
        AND NOT EXISTS (
          SELECT 1 FROM users u WHERE u.id = c.user_id
            AND lower(u.email) IN (SELECT lower(jsonb_array_elements_text(${adminJson}::jsonb)))
        )
    `
    const tr = totalsRows[0] || { total: 0, tagged: 0, matched: 0, none_count: 0, unset: 0 }
    const verdictTotal = tr.matched + tr.none_count + tr.unset
    const verdictBreakdown = {
      matched: tr.matched,
      none: tr.none_count,
      null: tr.unset,
      nonePct: verdictTotal > 0 ? Math.round((tr.none_count / verdictTotal) * 1000) / 10 : 0,
    }

    // 2. Attribute distributions — pull the categorical attributes of tagged rows
    //    and tally per key in JS (non-PII; cheap at beta scale).
    const tagRows = await sql`
      SELECT t.attributes AS attributes
      FROM chat_messages c
      JOIN coach_message_tags t ON t.message_id = c.id AND t.taxonomy_version = ${V}
      WHERE c.created_at >= NOW() - (${days} * INTERVAL '1 day')
        AND (${hasFilter} = false OR t.attributes @> ${filterJson}::jsonb)
        AND NOT EXISTS (
          SELECT 1 FROM users u WHERE u.id = c.user_id
            AND lower(u.email) IN (SELECT lower(jsonb_array_elements_text(${adminJson}::jsonb)))
        )
    `
    const distribution = {}
    for (const k of ATTRIBUTE_KEYS) distribution[k] = tally(tagRows, k)

    // 3. Feature breakdown among matched turns.
    const featureRows = await sql`
      SELECT c.selfcheck_feature AS feature, count(*)::int AS n
      FROM chat_messages c
      LEFT JOIN coach_message_tags t ON t.message_id = c.id AND t.taxonomy_version = ${V}
      WHERE c.created_at >= NOW() - (${days} * INTERVAL '1 day')
        AND c.selfcheck_verdict = 'matched' AND c.selfcheck_feature IS NOT NULL
        AND (${hasFilter} = false OR t.attributes @> ${filterJson}::jsonb)
        AND NOT EXISTS (
          SELECT 1 FROM users u WHERE u.id = c.user_id
            AND lower(u.email) IN (SELECT lower(jsonb_array_elements_text(${adminJson}::jsonb)))
        )
      GROUP BY c.selfcheck_feature
      ORDER BY n DESC
    `
    const featureBreakdown = featureRows.map(r => ({ feature: r.feature, n: r.n }))

    // 4. Unmet-need questions: verdict='none'. Message text + step + date + tags
    //    ONLY. Never user_id / email / reply.
    const unmetRows = await sql`
      SELECT c.message AS message, c.current_step AS current_step, c.created_at AS created_at, t.attributes AS attributes
      FROM chat_messages c
      LEFT JOIN coach_message_tags t ON t.message_id = c.id AND t.taxonomy_version = ${V}
      WHERE c.created_at >= NOW() - (${days} * INTERVAL '1 day')
        AND c.selfcheck_verdict = 'none'
        AND (${hasFilter} = false OR t.attributes @> ${filterJson}::jsonb)
        AND NOT EXISTS (
          SELECT 1 FROM users u WHERE u.id = c.user_id
            AND lower(u.email) IN (SELECT lower(jsonb_array_elements_text(${adminJson}::jsonb)))
        )
      ORDER BY c.created_at DESC
      LIMIT ${UNMET_CAP}
    `
    const unmetQuestions = unmetRows.map(r => ({
      message: r.message,
      current_step: r.current_step,
      created_at: r.created_at,
      attributes: r.attributes || null,
    }))

    return res.status(200).json({
      ok: true,
      generatedAt: new Date().toISOString(),
      taxonomyVersion: V,
      days,
      filter,
      categories: CATEGORIES,
      totals: { messages: tr.total, tagged: tr.tagged },
      verdictBreakdown,
      distribution,
      featureBreakdown,
      unmetQuestions,
    })
  } catch (err) {
    console.error('admin/coach-insights: query failed', err && err.message)
    return res.status(500).json({ error: 'Query failed' })
  }
}
