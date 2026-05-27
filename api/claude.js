// Vercel serverless function: locked-down proxy to the Anthropic Messages API.
// - Origin check rejects requests from any host other than the Reimagine domains.
// - The system prompt and model are forced server-side. Anything the client sends
//   for those fields is overridden. This makes the endpoint useless to anyone
//   trying to repurpose it as a free Claude API.
// - Accepts both the legacy client format ({model, messages, system, ...}) and
//   a simplified format ({prompt, webSearch, highTemp, maxTokens}). Either way,
//   the server forces SYS and model. Existing clients keep working without changes.

// Vercel Pro ceiling. The handler is non-streaming (await fetch + await
// response.json), so it holds the connection open for the full Anthropic
// generation. Heaviest prompts (p8 LinkedIn Remix, the Phase 1 chain p1-p2-p3,
// p11 Interview Prep, p_res Resume Refresh) regularly run 90-150 seconds
// against the larger profile shapes; without an explicit cap the function
// was hitting the platform default and returning a `---` status (Vercel's
// tell for a function that never returned). Streaming is the proper fix
// and lives in its own follow-up brief; this raises the ceiling so heavy
// generations have headroom in the meantime.
export const config = {
  maxDuration: 300,
};

// Single source of truth for SYS. Lives in src/system-prompt.mjs and is
// imported by both this server function and src/App.jsx so client and
// server cannot drift. Server still overrides any client-supplied system
// field per the PR #22 lesson; the import just guarantees both sides hold
// an identical string before the override.
import { SYS } from '../src/system-prompt.mjs'

const ALLOWED_HOSTS = new Set([
  'reimagine2-two.vercel.app',
  'reimagine.career.club',
  'localhost:5173',
  'localhost:3000'
])

function isAllowedOrigin(rawOrigin) {
  if (!rawOrigin) return false
  try {
    const u = new URL(rawOrigin)
    const hostWithPort = u.port ? `${u.hostname}:${u.port}` : u.hostname
    if (ALLOWED_HOSTS.has(u.hostname) || ALLOWED_HOSTS.has(hostWithPort)) return true
    // Allow Vercel preview deploys for this project
    if (u.hostname.endsWith('.vercel.app') && u.hostname.includes('reimagine')) return true
    return false
  } catch {
    return false
  }
}

function clampTokens(value) {
  const n = parseInt(value, 10)
  if (!Number.isFinite(n)) return 4000
  return Math.min(Math.max(n, 100), 8000)
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Origin check. Falls back to Referer if Origin is missing (some browsers do not send it on same-origin POSTs).
  const origin = req.headers.origin || req.headers.referer || ''
  if (!isAllowedOrigin(origin)) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  const reqBody = req.body || {}
  let anthropicBody

  if (typeof reqBody.prompt === 'string') {
    // Simplified format: client sends just the user prompt and a few flags.
    if (reqBody.prompt.length === 0 || reqBody.prompt.length > 100000) {
      return res.status(400).json({ error: 'Invalid prompt' })
    }
    anthropicBody = {
      model: 'claude-sonnet-4-5',
      max_tokens: clampTokens(reqBody.maxTokens),
      temperature: reqBody.highTemp ? 1.0 : 0.7,
      system: [{ type: 'text', text: SYS, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: reqBody.prompt }],
      ...(reqBody.webSearch ? { tools: [{ type: 'web_search_20250305', name: 'web_search' }] } : {})
    }
  } else if (Array.isArray(reqBody.messages)) {
    // Legacy format: client sent the full Anthropic body.
    // Force model and system prompt server-side; clamp max_tokens.
    anthropicBody = {
      ...reqBody,
      model: 'claude-sonnet-4-5',
      max_tokens: clampTokens(reqBody.max_tokens),
      system: [{ type: 'text', text: SYS, cache_control: { type: 'ephemeral' } }]
    }
  } else {
    return res.status(400).json({ error: 'Invalid request format' })
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'web-search-2025-03-05'
      },
      body: JSON.stringify(anthropicBody)
    })
    const data = await response.json()
    return res.status(response.status).json(data)
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
}
