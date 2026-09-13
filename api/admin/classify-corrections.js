// Batch-classifies unthemed corrections into the recurring patterns Bob asked
// to see: which prompts are getting a fact wrong, which are hallucinating,
// where the system isn't actually accepting a correction, and where the
// output reads as AI-written. Manually triggered from the admin dashboard
// (POST) rather than a cron -- at this volume (~100/month) there's no need
// for it to run itself, and a human deciding when to spend the tokens is
// simpler than a schedule to maintain.
//
// Model: claude-sonnet-5, matching every other Anthropic call in this repo
// (api/claude.js, api/coach.js) rather than this task's own merits alone --
// one model choice for the whole app is one thing to reason about, and
// classification is exactly the kind of workload that doesn't need a bigger
// model (low effort, no multi-step reasoning). Raw fetch against the Messages
// API, matching the existing convention in this codebase (no
// @anthropic-ai/sdk dependency exists here yet).
//
// Forced tool use with strict:true guarantees schema-valid JSON back for the
// whole batch in one call -- no free-text parsing, no partial/malformed JSON
// to recover from.
//
// Auth: session + ADMIN_LOGIN_EMAILS (admin only, not analyst -- this spends
// real API budget).

import { sql } from '../_lib/db.js'
import { checkAdminAuth, adminLoginEmailsMissing } from '../_lib/admin-auth.js'

const MODEL = 'claude-sonnet-5'
const BATCH_SIZE = 25 // bounded per invocation; call again for the next batch

const THEMES = ['wrong_fact', 'hallucination', 'wont_accept_correction', 'ai_voice', 'other']

const SYSTEM_PROMPT = `You are classifying user corrections submitted on Reimagine, a career-strategy tool that generates written career analysis from a user's inputs. Each correction is a short note a user typed after reading generated output, explaining what to fix.

Classify each correction into exactly one theme:
- wrong_fact: the output stated a concrete fact about the user incorrectly (a number, a title, a company name, a timeframe, a location) -- something that should have come from the user's own inputs but didn't match them.
- hallucination: the output asserted something with no basis in anything the user provided -- invented, not just misremembered.
- wont_accept_correction: the correction itself describes the system not actually applying a fix, repeating a mistake, or ignoring something the user already said (e.g. "I already told you this," "this is still wrong after I fixed it," "you keep adding this back").
- ai_voice: the correction complains the output sounds generic, robotic, like a template, or "like AI wrote this" -- about how it reads, not what it says.
- other: doesn't clearly fit above (formatting/layout preferences, scope requests, anything ambiguous).

Call classify_corrections with one entry per correction, in the same order given. Keep notes to a short phrase or leave it empty -- it's a one-line rationale, not a summary.`

const TOOL = {
  name: 'classify_corrections',
  description: 'Record the theme classification for each correction in the batch.',
  input_schema: {
    type: 'object',
    properties: {
      classifications: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'The correction id, copied exactly from the input.' },
            theme: { type: 'string', enum: THEMES },
            notes: { type: 'string', description: 'Optional short rationale, a phrase not a sentence.' },
          },
          required: ['id', 'theme'],
          additionalProperties: false,
        },
      },
    },
    required: ['classifications'],
    additionalProperties: false,
  },
  strict: true,
}

async function classifyBatch(rows) {
  const payload = rows.map((r) => ({ id: r.id, step: r.step, correction: r.correction_text }))
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 8000,
      output_config: { effort: 'low' },
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: JSON.stringify(payload) }],
      tools: [TOOL],
      tool_choice: { type: 'tool', name: 'classify_corrections' },
    }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Anthropic API ${res.status}: ${body.slice(0, 500)}`)
  }
  const data = await res.json()
  const toolUse = (data.content || []).find((b) => b.type === 'tool_use' && b.name === 'classify_corrections')
  if (!toolUse) throw new Error('No classify_corrections tool call in response')
  const classifications = Array.isArray(toolUse.input && toolUse.input.classifications) ? toolUse.input.classifications : []
  return classifications
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  if (adminLoginEmailsMissing()) {
    console.error('admin/classify-corrections: ADMIN_LOGIN_EMAILS not configured')
    return res.status(500).json({ error: 'Server misconfigured' })
  }
  if (!(await checkAdminAuth(req, res))) {
    return res.status(403).json({ error: 'Forbidden' })
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('admin/classify-corrections: ANTHROPIC_API_KEY not configured')
    return res.status(500).json({ error: 'Server misconfigured' })
  }

  let rows
  try {
    rows = await sql`
      SELECT id, step, correction_text
      FROM corrections
      WHERE theme IS NULL
      ORDER BY created_at ASC NULLS LAST
      LIMIT ${BATCH_SIZE}
    `
  } catch (err) {
    console.error('admin/classify-corrections: select failed', err && err.message)
    return res.status(500).json({ error: 'Query failed' })
  }

  if (rows.length === 0) {
    return res.status(200).json({ ok: true, classified: 0, remaining: 0 })
  }

  let classifications
  try {
    classifications = await classifyBatch(rows)
  } catch (err) {
    console.error('admin/classify-corrections: classification call failed', err && err.message)
    return res.status(502).json({ error: 'Classification failed', message: err && err.message })
  }

  const byId = new Map(classifications.map((c) => [c.id, c]))
  let written = 0
  try {
    for (const r of rows) {
      const c = byId.get(r.id)
      const theme = c && THEMES.includes(c.theme) ? c.theme : 'other'
      const notes = c && typeof c.notes === 'string' ? c.notes.slice(0, 500) : null
      await sql`
        UPDATE corrections
        SET theme = ${theme}, theme_notes = ${notes}, theme_classified_at = NOW()
        WHERE id = ${r.id}
      `
      written += 1
    }
  } catch (err) {
    console.error('admin/classify-corrections: write failed', err && err.message)
    return res.status(500).json({ error: 'Write failed', classified: written })
  }

  let remaining
  try {
    const r = await sql`SELECT count(*)::int AS n FROM corrections WHERE theme IS NULL`
    remaining = r[0].n
  } catch {
    remaining = null
  }

  return res.status(200).json({ ok: true, classified: written, remaining })
}
