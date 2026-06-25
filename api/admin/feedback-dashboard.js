// Admin read endpoint for the feedback dashboard (/admin/dashboard -> Feedback
// tab). Returns the six views as pre-aggregated JSON, all derived from a single
// read of feedback_event so every total reconciles to the table.
//
// Auth mirrors api/admin/coach-insights.js: ADMIN_TOKEN as Authorization: Bearer
// <token> OR ?t=<token>; missing env -> 500, neither credential -> 403. CORS
// block so the same-origin admin page can read it.
//
// PRIVACY: body, email, and user_id are NEVER read into the response. Only
// non-identifying fields ride to the client: source, surface, lane, sentiment,
// themes, native metric, created_at, commit_sha, and the model summary line.

import { sql } from '../_lib/db.js'
import {
  SOURCE_CODES, SOURCE_LABELS, SURFACE_CODES, SURFACE_LABELS,
  CONCERN_CODES, CONCERN_LABELS, SENTIMENT_CODES,
} from '../../src/feedback-taxonomy.js'

const RECURRING_MIN = 5 // a concern is "recurring" at >= this many events

function emptySplit() {
  return { positive: 0, negative: 0, neutral: 0, mixed: 0, total: 0, withSentiment: 0 }
}
function addSentiment(split, s) {
  split.total += 1
  if (SENTIMENT_CODES.includes(s)) { split[s] += 1; split.withSentiment += 1 }
}
function themeLabel(code) {
  if (CONCERN_LABELS[code]) return CONCERN_LABELS[code]
  if (typeof code === 'string' && code.startsWith('candidate:')) return code.slice('candidate:'.length).replace(/-/g, ' ')
  return code
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const expected = process.env.ADMIN_TOKEN
  if (!expected) {
    console.error('admin/feedback-dashboard: ADMIN_TOKEN not configured')
    return res.status(500).json({ error: 'Server misconfigured' })
  }
  const auth = req.headers.authorization || ''
  const headerOk = auth === `Bearer ${expected}`
  const queryToken = (req.query && typeof req.query.t === 'string') ? req.query.t : ''
  const queryOk = queryToken !== '' && queryToken === expected.trim()
  if (!headerOk && !queryOk) return res.status(403).json({ error: 'Forbidden' })

  let events
  try {
    events = await sql`
      SELECT id, source, surface, lane, sentiment, themes, native_type, native_value,
             created_at, commit_sha, summary, status
      FROM feedback_event
      ORDER BY created_at DESC NULLS LAST
    `
  } catch (err) {
    console.error('admin/feedback-dashboard: query failed', err && err.message)
    return res.status(500).json({ error: 'Query failed' })
  }

  const total = events.length

  // --- KPI: NPS over nps-survey events -------------------------------------
  const npsVals = events
    .filter(e => e.source === 'nps-survey' && e.native_type === 'nps' && e.native_value != null)
    .map(e => Number(e.native_value))
  const promoters = npsVals.filter(v => v >= 9).length
  const detractors = npsVals.filter(v => v <= 6).length
  const nps = npsVals.length ? Math.round(((promoters - detractors) / npsVals.length) * 100) : null

  // --- KPI: negative share over events that have a sentiment ---------------
  const withSentiment = events.filter(e => SENTIMENT_CODES.includes(e.sentiment))
  const negativeCount = withSentiment.filter(e => e.sentiment === 'negative').length
  const negativeShare = withSentiment.length ? negativeCount / withSentiment.length : null

  // --- By channel -----------------------------------------------------------
  const byChannel = SOURCE_CODES.map(src => {
    const rows = events.filter(e => e.source === src)
    const split = emptySplit()
    for (const e of rows) addSentiment(split, e.sentiment)
    let native = null
    if (src === 'nps-survey') {
      const vals = rows.filter(e => e.native_value != null).map(e => Number(e.native_value))
      const p = vals.filter(v => v >= 9).length, d = vals.filter(v => v <= 6).length
      native = {
        type: 'nps',
        nps: vals.length ? Math.round(((p - d) / vals.length) * 100) : null,
        avg: vals.length ? +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : null,
        promoters: p, passives: vals.length - p - d, detractors: d, responses: vals.length,
      }
    } else if (src === 'coach-reply') {
      const up = rows.filter(e => Number(e.native_value) > 0).length
      const down = rows.filter(e => Number(e.native_value) < 0).length
      native = { type: 'thumb', up, down, net: up - down }
    }
    return { source: src, label: SOURCE_LABELS[src], volume: rows.length, native, sentiment: split }
  })

  // --- By theme (stacked by sentiment) + theme x channel matrix -------------
  const themeMap = new Map()   // theme -> sentiment split
  const themeChannel = new Map() // theme -> { source -> count }
  for (const e of events) {
    const themes = Array.isArray(e.themes) ? e.themes : []
    for (const t of themes) {
      if (!themeMap.has(t)) { themeMap.set(t, emptySplit()); themeChannel.set(t, {}) }
      addSentiment(themeMap.get(t), e.sentiment)
      const tc = themeChannel.get(t)
      tc[e.source] = (tc[e.source] || 0) + 1
    }
  }
  const orderTheme = (a, b) => {
    const ia = CONCERN_CODES.indexOf(a), ib = CONCERN_CODES.indexOf(b)
    if (ia !== -1 && ib !== -1) return ia - ib
    if (ia !== -1) return -1
    if (ib !== -1) return 1
    return a.localeCompare(b)
  }
  const themeKeys = [...themeMap.keys()].sort(orderTheme)
  const byTheme = themeKeys.map(t => ({ theme: t, label: themeLabel(t), ...themeMap.get(t) }))
  const matrix = {
    themes: themeKeys.map(t => ({ theme: t, label: themeLabel(t) })),
    channels: SOURCE_CODES.map(s => ({ source: s, label: SOURCE_LABELS[s] })),
    cells: themeKeys.map(t => ({ theme: t, counts: SOURCE_CODES.map(s => themeChannel.get(t)[s] || 0) })),
  }

  // --- Surface x sentiment table -------------------------------------------
  // Seed every taxonomy surface up front so all product areas always render —
  // a zero-count area (e.g. Personal Brand before any feedback lands there) is a
  // visible coverage gap, not an absent row. '(none)' is added only if there are
  // events with no surface.
  const surfaceMap = new Map()
  for (const code of SURFACE_CODES) surfaceMap.set(code, emptySplit())
  for (const e of events) {
    const key = e.surface || '(none)'
    if (!surfaceMap.has(key)) surfaceMap.set(key, emptySplit())
    addSentiment(surfaceMap.get(key), e.sentiment)
  }
  const surfaceOrder = [...SURFACE_CODES, '(none)']
  const surfaceSentiment = [...surfaceMap.keys()]
    .sort((a, b) => surfaceOrder.indexOf(a) - surfaceOrder.indexOf(b))
    .map(s => ({ surface: s, label: s === '(none)' ? '(no surface)' : (SURFACE_LABELS[s] || s), ...surfaceMap.get(s) }))

  // --- Recurring concerns: count >= RECURRING_MIN and negative-leaning ------
  const recurringConcerns = byTheme
    .filter(t => t.total >= RECURRING_MIN && t.negative >= t.positive && t.negative > 0)
    .map(t => ({ theme: t.theme, label: t.label, total: t.total, negative: t.negative, positive: t.positive }))

  // --- Feed (no PII) --------------------------------------------------------
  const feed = events.map(e => ({
    id: e.id,
    source: e.source,
    sourceLabel: SOURCE_LABELS[e.source] || e.source,
    surface: e.surface,
    surfaceLabel: e.surface ? (SURFACE_LABELS[e.surface] || e.surface) : null,
    themes: (Array.isArray(e.themes) ? e.themes : []).map(t => ({ code: t, label: themeLabel(t) })),
    sentiment: e.sentiment,
    nativeType: e.native_type,
    nativeValue: e.native_value != null ? Number(e.native_value) : null,
    createdAt: e.created_at,
    commitSha: e.commit_sha,
    summary: e.summary,
    status: e.status,
  }))

  return res.status(200).json({
    generatedAt: new Date().toISOString(),
    kpis: {
      totalEvents: total,
      nps,
      negativeShare,
      negativeCount,
      withSentiment: withSentiment.length,
      recurringConcernCount: recurringConcerns.length,
    },
    byChannel,
    byTheme,
    matrix,
    surfaceSentiment,
    recurringConcerns,
    feed,
  })
}
