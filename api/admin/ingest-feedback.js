// Ingestion + classification cron for the unified feedback store. Maps source
// rows from the three Neon channels into feedback_event, then classifies the
// text-bearing ones with a Haiku-class model. Running it once over a fresh table
// IS the backfill; running it nightly keeps the table current.
//
// Auth/shape mirrors api/admin/classify-coach.js: GET only, Vercel attaches
// Authorization: Bearer <CRON_SECRET>; mismatch -> 403, missing env -> 500.
// Scheduled by an entry in vercel.json crons.
//
// Idempotent: Pass A upserts on (source, source_record). share-feedback and
// nps-survey insert only new rows (NOT EXISTS filter); coach-reply re-processes
// every rated row so the upsert refreshes its mapping-derived surface/lane/extras
// on each run. ON CONFLICT updates ONLY surface/lane/extras, never the
// classification fields, so no dupes and no clobbering of sentiment/themes/
// summary/status. Pass B classifies status='pending' rows and is safe to re-run
// (a transient model failure leaves the row 'pending' to be retried next run).
//
// PRIVACY: the classifier reads the feedback body (+ light surface/lane context)
// and writes back enum sentiment, taxonomy theme codes, and a short summary. No
// user_id/email is ever sent to the model.

import { sql as defaultSql } from '../_lib/db.js'
import {
  CONCERN_CODES, CONCERN_LABELS, VALUABLE_TO_SURFACE,
  normalizeThemes, sentimentFromNative, stepToSurface, CHECKIN_ANSWER_VALUE,
} from '../../src/feedback-taxonomy.js'

const MODEL = 'claude-haiku-4-5'
const CALL_TIMEOUT_MS = 30000
const MAX_BODY_CHARS = 4000
const CLASSIFY_CONCURRENCY = 6

const CLASSIFY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    sentiment: { type: 'string', enum: ['positive', 'negative', 'neutral', 'mixed'] },
    themes: { type: 'array', items: { type: 'string' }, minItems: 1 },
    summary: { type: 'string' },
  },
  required: ['sentiment', 'themes', 'summary'],
}

const CLASSIFIER_SYSTEM = [
  'You classify a single piece of user feedback about Reimagine, a career-strategy web app.',
  'Return exactly three things:',
  '1) sentiment: one of positive | negative | neutral | mixed.',
  '2) themes: one or more concern-theme codes describing what the feedback is ABOUT.',
  '   Use ONLY these codes:',
  ...CONCERN_CODES.map(c => `   - ${c}: ${CONCERN_LABELS[c]}`),
  '   If and only if none of the codes fit, emit a single code of the form',
  '   candidate:<short-kebab-label> describing the new theme.',
  '3) summary: one neutral line (max ~15 words) capturing the point. No names, no PII.',
  'Judge sentiment from the text itself. Be literal; do not flatter or soften.',
].join('\n')

// One model call: feedback body (+ light context) in, validated {sentiment,
// themes, summary} out, or null on any failure so the row is retried next run.
async function classifyText(ev) {
  const ctx = []
  if (ev.surface) ctx.push(`Surface: ${ev.surface}`)
  if (ev.lane) ctx.push(`Lane: ${ev.lane}`)
  if (ev.native_type === 'nps' && ev.native_value != null) ctx.push(`NPS score: ${ev.native_value}`)
  if (ev.native_type === 'thumb' && ev.native_value != null) ctx.push(`Coach thumb: ${Number(ev.native_value) > 0 ? 'up' : 'down'}`)
  const userContent =
    (ctx.length ? `CONTEXT (not the feedback): ${ctx.join('; ')}\n\n` : '') +
    `FEEDBACK:\n${String(ev.body).slice(0, MAX_BODY_CHARS)}`

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), CALL_TIMEOUT_MS)
  try {
    const up = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 400,
        system: [{ type: 'text', text: CLASSIFIER_SYSTEM, cache_control: { type: 'ephemeral' } }],
        output_config: { format: { type: 'json_schema', schema: CLASSIFY_SCHEMA } },
        messages: [{ role: 'user', content: userContent }],
      }),
    })
    if (!up.ok) { console.error('ingest-feedback: model HTTP', up.status); return null }
    const data = await up.json()
    const text = Array.isArray(data.content) ? (data.content.find(b => b.type === 'text') || {}).text : null
    if (!text) return null
    let obj
    try { obj = JSON.parse(text) } catch { return null }
    const sentiment = ['positive', 'negative', 'neutral', 'mixed'].includes(obj.sentiment) ? obj.sentiment : null
    const themes = normalizeThemes(obj.themes)
    const summary = typeof obj.summary === 'string' ? obj.summary.trim().slice(0, 280) : null
    if (!sentiment) return null
    return { sentiment, themes, summary }
  } catch (err) {
    console.error('ingest-feedback: classify call failed', err && err.message)
    return null
  } finally {
    clearTimeout(timer)
  }
}

function hasText(v) { return typeof v === 'string' && v.trim().length > 0 }

// ---- Pass A: map un-ingested source rows into feedback_event ----------------

async function insertEvent(sql, e) {
  const textBearing = hasText(e.body)
  const status = textBearing ? 'pending' : 'native'
  const sentiment = textBearing ? null : sentimentFromNative(e.native_type, e.native_value)
  const themes = textBearing ? null : []
  const extras = (e.extras && Object.keys(e.extras).length) ? JSON.stringify(e.extras) : null
  await sql`
    INSERT INTO feedback_event
      (id, source, source_record, user_id, email, created_at, body, native_type,
       native_value, surface, lane, output_ref, commit_sha, sentiment, themes, summary, status, extras, solicited)
    VALUES
      (${e.id}, ${e.source}, ${e.source_record}, ${e.user_id ?? null}, ${e.email ?? null},
       ${e.created_at ?? null}, ${textBearing ? e.body : null}, ${e.native_type ?? null},
       ${e.native_value ?? null}, ${e.surface ?? null}, ${e.lane ?? null}, ${e.output_ref ?? null},
       ${e.commit_sha ?? null}, ${sentiment}, ${themes}, ${null}, ${status}, ${extras}::jsonb, ${e.solicited === true})
    ON CONFLICT (source, source_record) DO UPDATE SET
      surface = EXCLUDED.surface,
      lane    = EXCLUDED.lane,
      extras  = EXCLUDED.extras
  `
  // ON CONFLICT updates ONLY the mapping-derived fields (surface/lane/extras),
  // so a re-ingest refreshes the product-area surface and raw context without
  // clobbering sentiment/themes/summary/status — those are owned by the
  // classification pass. The other INSERT values (body/native_*/created_at) are
  // source-static, so leaving them unchanged on conflict is correct.
}

async function ingestShareFeedback(sql) {
  const rows = await sql`
    SELECT g.id, g.user_id, g.email, g.body, g.surface, g.selected_lane, g.context_ref, g.commit_sha, g.created_at
    FROM general_feedback g
    WHERE NOT EXISTS (SELECT 1 FROM feedback_event f WHERE f.source = 'share-feedback' AND f.source_record = g.id::text)
  `
  let n = 0
  for (const r of rows) {
    await insertEvent(sql, {
      id: `share-feedback:${r.id}`, source: 'share-feedback', source_record: String(r.id),
      user_id: r.user_id, email: r.email, created_at: r.created_at, body: r.body,
      native_type: null, native_value: null, surface: stepToSurface(r.surface), lane: r.selected_lane,
      output_ref: r.context_ref, commit_sha: r.commit_sha,
    })
    n++
  }
  return n
}

async function ingestNpsSurvey(sql) {
  const rows = await sql`
    SELECT s.id, s.user_id, u.email, s.open_text, s.nps_score, s.most_valuable,
           s.confidence, s.accuracy, s.created_at
    FROM survey_responses s
    LEFT JOIN users u ON u.id = s.user_id
    WHERE NOT EXISTS (SELECT 1 FROM feedback_event f WHERE f.source = 'nps-survey' AND f.source_record = s.id::text)
  `
  let n = 0
  for (const r of rows) {
    // Survey answers with no dedicated column ride in extras so they are not
    // dropped. 'capture' is the accuracy question ("how well did Reimagine
    // capture who you are"). most_valuable is already represented as surface.
    const extras = {}
    if (r.confidence != null) extras.confidence = r.confidence
    if (r.accuracy != null) extras.capture = r.accuracy
    await insertEvent(sql, {
      id: `nps-survey:${r.id}`, source: 'nps-survey', source_record: String(r.id),
      user_id: r.user_id ? String(r.user_id) : null, email: r.email, created_at: r.created_at,
      body: r.open_text, native_type: 'nps', native_value: r.nps_score,
      surface: VALUABLE_TO_SURFACE[r.most_valuable] || null, lane: null, output_ref: null, commit_sha: null,
      extras,
    })
    n++
  }
  return n
}

async function ingestCoachReply(sql) {
  // No NOT EXISTS filter here (unlike the other channels): coach-reply re-processes
  // every rated row each run so the upsert refreshes surface/lane/extras from the
  // current map — that is how already-ingested rows pick up the product-area
  // surface. New rows insert fresh; classification fields are untouched on conflict.
  const rows = await sql`
    SELECT c.id, c.user_id, u.email, c.rating_comment, c.rating, c.rated_at, c.lane,
           c.current_step, c.entry_point
    FROM chat_messages c
    LEFT JOIN users u ON u.id = c.user_id
    WHERE c.rating IS NOT NULL
  `
  let n = 0
  for (const r of rows) {
    // Slice coach ratings by the product area the user was working on when they
    // chatted: current_step -> surface code, falling back to 'my-coach' when they
    // were on the coach page itself (current_step 'myCoach' maps there) or it is
    // null/unmapped. Raw step/lane/entry_point ride in extras for auditing.
    const extras = {}
    if (r.current_step != null) extras.current_step = r.current_step
    if (r.lane != null) extras.lane = r.lane
    if (r.entry_point != null) extras.entry_point = r.entry_point
    await insertEvent(sql, {
      id: `coach-reply:${r.id}`, source: 'coach-reply', source_record: String(r.id),
      user_id: r.user_id ? String(r.user_id) : null, email: r.email, created_at: r.rated_at,
      body: r.rating_comment, native_type: 'thumb', native_value: r.rating,
      surface: stepToSurface(r.current_step) || 'my-coach', lane: r.lane, output_ref: String(r.id), commit_sha: null,
      extras,
    })
    n++
  }
  return n
}

async function ingestPbCheckin(sql) {
  const rows = await sql`
    SELECT id, user_id, email, checkin_key, answer, created_at
    FROM coach_checkin_responses
    WHERE NOT EXISTS (SELECT 1 FROM feedback_event f WHERE f.source = 'pb-checkin' AND f.source_record = coach_checkin_responses.id::text)
  `
  let n = 0
  for (const r of rows) {
    // The Personal Brand check-in is ALWAYS filed under personal-brand and marked
    // solicited — it fires on the twoDoors screen, so the screen's surface
    // (navigation-ia) would mis-file it. Text-less: sentiment derives from the tap.
    await insertEvent(sql, {
      id: `pb-checkin:${r.id}`, source: 'pb-checkin', source_record: String(r.id),
      user_id: r.user_id ? String(r.user_id) : null, email: r.email, created_at: r.created_at,
      body: null, native_type: 'checkin', native_value: CHECKIN_ANSWER_VALUE[r.answer] ?? 0,
      surface: 'personal-brand', lane: null, output_ref: r.checkin_key, commit_sha: null,
      solicited: true, extras: { answer: r.answer, checkin: r.checkin_key },
    })
    n++
  }
  return n
}

// ---- Pass B: classify pending (text-bearing) events -------------------------

async function classifyPending(sql, classify) {
  const rows = await sql`
    SELECT id, body, surface, lane, native_type, native_value
    FROM feedback_event
    WHERE status = 'pending' AND body IS NOT NULL
    ORDER BY created_at DESC NULLS LAST
  `
  let classified = 0, failed = 0
  for (let i = 0; i < rows.length; i += CLASSIFY_CONCURRENCY) {
    const slice = rows.slice(i, i + CLASSIFY_CONCURRENCY)
    const results = await Promise.all(slice.map(r => classify(r).then(c => ({ r, c }))))
    for (const { r, c } of results) {
      if (!c) { failed++; continue }
      try {
        await sql`
          UPDATE feedback_event
          SET sentiment = ${c.sentiment}, themes = ${c.themes}, summary = ${c.summary}, status = 'classified'
          WHERE id = ${r.id}
        `
        classified++
      } catch (e) { failed++; console.error('ingest-feedback: update failed', e && e.message) }
    }
  }
  return { classified, failed }
}

// Core run, callable from the cron handler and from a backfill runner.
// opts.classify lets a runner inject a classifier; opts.skipClassify ingests
// only (text-bearing rows stay 'pending') when no model key is available.
export async function ingestAll(sql = defaultSql, opts = {}) {
  const ingested = {
    'share-feedback': await ingestShareFeedback(sql),
    'nps-survey': await ingestNpsSurvey(sql),
    'coach-reply': await ingestCoachReply(sql),
    'pb-checkin': await ingestPbCheckin(sql),
  }
  let classification = { classified: 0, failed: 0, skipped: true }
  if (!opts.skipClassify) {
    classification = { ...(await classifyPending(sql, opts.classify || classifyText)), skipped: false }
  }
  return { ingested, classification }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  const expected = process.env.CRON_SECRET
  if (!expected) {
    console.error('ingest-feedback: CRON_SECRET not configured')
    return res.status(500).json({ error: 'Server misconfigured' })
  }
  const auth = req.headers.authorization || ''
  if (auth !== `Bearer ${expected}`) return res.status(403).json({ error: 'Forbidden' })
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ingest-feedback: ANTHROPIC_API_KEY not configured')
    return res.status(500).json({ error: 'Server misconfigured' })
  }

  const started = Date.now()
  try {
    const result = await ingestAll(defaultSql)
    const ms = Date.now() - started
    console.log('ingest-feedback: done', { ...result, ms })
    return res.status(200).json({ ok: true, ...result, ms })
  } catch (err) {
    console.error('ingest-feedback: run failed', err && err.message)
    return res.status(500).json({ error: 'Ingest run failed' })
  }
}
