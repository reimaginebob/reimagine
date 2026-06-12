// Nightly classifier for the My Coach question-insight foundation. Fills
// coach_message_tags from chat_messages.message using a Haiku-class model.
//
// Auth/shape mirrors api/survey/daily-digest.js exactly: GET only, Vercel
// attaches Authorization: Bearer <CRON_SECRET> to cron-triggered requests; we
// compare strictly (mismatch -> 403, missing env -> 500). Scheduled by a second
// entry in vercel.json crons. sql comes from ../_lib/db.js.
//
// Incremental + idempotent: tags only rows that lack a coach_message_tags row at
// the CURRENT TAXONOMY_VERSION, and upserts on (message_id, taxonomy_version).
// Bumping TAXONOMY_VERSION (in api/_lib/coach-taxonomy.js) makes all history
// eligible again on the next run, so a re-tag is "bump the constant + wait one
// night" with no backfill script.
//
// Privacy: the classifier reads ONLY message (+ current_step, lane) and writes
// categorical buckets. It never reads or stores reply, and the taxonomy prompt
// forbids extracting identifying detail. attributes is JSONB of enum values only.

import { sql } from '../_lib/db.js'
import { TAXONOMY_VERSION, TAG_SCHEMA, ATTRIBUTE_KEYS, CATEGORIES, CLASSIFIER_SYSTEM } from '../_lib/coach-taxonomy.js'

const MODEL = 'claude-haiku-4-5'
const CHUNK = 25            // rows fetched per DB round
const CONCURRENCY = 6       // parallel model calls within a chunk
const TIME_BUDGET_MS = 240000 // stop fetching new chunks past this (function cap is 300s)
const MAX_MESSAGE_CHARS = 4000
const CALL_TIMEOUT_MS = 30000

// One model call: question (+ light context) in, validated attribute object out
// (or null on any failure, so the row is retried on the next run rather than
// marked done with garbage).
async function classifyOne(row) {
  const ctx = []
  if (row.current_step) ctx.push(`App step: ${row.current_step}`)
  if (row.lane) ctx.push(`Chosen lane: ${row.lane}`)
  const userContent =
    (ctx.length ? `CONTEXT (not part of the question): ${ctx.join('; ')}\n\n` : '') +
    `USER QUESTION:\n${String(row.message).slice(0, MAX_MESSAGE_CHARS)}`

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
        output_config: { format: { type: 'json_schema', schema: TAG_SCHEMA } },
        messages: [{ role: 'user', content: userContent }],
      }),
    })
    if (!up.ok) { console.error('classify-coach: model HTTP', up.status); return null }
    const data = await up.json()
    const text = Array.isArray(data.content) ? (data.content.find(b => b.type === 'text') || {}).text : null
    if (!text) return null
    let obj
    try { obj = JSON.parse(text) } catch { return null }
    return sanitize(obj)
  } catch (err) {
    console.error('classify-coach: call failed', err && err.message)
    return null
  } finally {
    clearTimeout(timer)
  }
}

// Keep only known keys with allowed values (or null). Defends against drift even
// though the schema constrains the model; never persists an off-taxonomy value.
function sanitize(obj) {
  if (!obj || typeof obj !== 'object') return null
  const out = {}
  for (const k of ATTRIBUTE_KEYS) {
    const v = obj[k]
    out[k] = (typeof v === 'string' && CATEGORIES[k].includes(v)) ? v : null
  }
  return out
}

async function upsertTag(messageId, attributes) {
  await sql`
    INSERT INTO coach_message_tags (message_id, taxonomy_version, attributes)
    VALUES (${messageId}, ${TAXONOMY_VERSION}, ${JSON.stringify(attributes)}::jsonb)
    ON CONFLICT (message_id, taxonomy_version)
    DO UPDATE SET attributes = EXCLUDED.attributes, classified_at = NOW()
  `
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  const expected = process.env.CRON_SECRET
  if (!expected) {
    console.error('classify-coach: CRON_SECRET not configured')
    return res.status(500).json({ error: 'Server misconfigured' })
  }
  const auth = req.headers.authorization || ''
  if (auth !== `Bearer ${expected}`) {
    return res.status(403).json({ error: 'Forbidden' })
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('classify-coach: ANTHROPIC_API_KEY not configured')
    return res.status(500).json({ error: 'Server misconfigured' })
  }

  const started = Date.now()
  let tagged = 0
  let failed = 0
  let rounds = 0

  try {
    while (Date.now() - started < TIME_BUDGET_MS) {
      // Rows with no tag at the current taxonomy version, newest first.
      const rows = await sql`
        SELECT c.id, c.message, c.current_step, c.lane
        FROM chat_messages c
        LEFT JOIN coach_message_tags t
          ON t.message_id = c.id AND t.taxonomy_version = ${TAXONOMY_VERSION}
        WHERE t.message_id IS NULL
          AND c.message IS NOT NULL
        ORDER BY c.created_at DESC
        LIMIT ${CHUNK}
      `
      if (rows.length === 0) break
      rounds++

      // Bounded-concurrency classify within the chunk.
      for (let i = 0; i < rows.length; i += CONCURRENCY) {
        const slice = rows.slice(i, i + CONCURRENCY)
        const results = await Promise.all(slice.map(r => classifyOne(r).then(a => ({ r, a }))))
        for (const { r, a } of results) {
          if (!a) { failed++; continue }
          try { await upsertTag(r.id, a); tagged++ } catch (e) { failed++; console.error('classify-coach: upsert failed', e && e.message) }
        }
        if (Date.now() - started >= TIME_BUDGET_MS) break
      }
      // If the chunk was short, there is nothing left to fetch.
      if (rows.length < CHUNK) break
    }
  } catch (err) {
    console.error('classify-coach: run failed', err && err.message)
    return res.status(500).json({ error: 'Classifier run failed', tagged, failed })
  }

  const ms = Date.now() - started
  console.log('classify-coach: done', { taxonomy_version: TAXONOMY_VERSION, tagged, failed, rounds, ms })
  return res.status(200).json({ ok: true, taxonomy_version: TAXONOMY_VERSION, tagged, failed, rounds, ms })
}
