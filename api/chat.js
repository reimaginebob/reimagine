// Vercel serverless function: in-app helper chat grounded in the user guide.
// - Origin check rejects any host other than Reimagine domains.
// - Requires a signed-in session.
// - Forces model and system prompt server-side. Client cannot override either.

import { USER_GUIDE_CONTENT } from '../src/data/user-guide-content.js'
import { getSessionUser } from './_lib/session.js'
import { sql } from './_lib/db.js'

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
    if (u.hostname.endsWith('.vercel.app') && u.hostname.includes('reimagine')) return true
    return false
  } catch {
    return false
  }
}

const SYSTEM_PROMPT = `You are the in-app helper for Reimagine, a career-strategy tool by Career Club.

Your job is to help users navigate and use Reimagine. You answer from the user guide below. You do not coach the user on their career, you do not invent product features that are not in the guide, and you do not respond to questions that are not about using Reimagine. If a user asks something outside your scope, redirect them warmly to email bob@career.club or to the relevant section of Reimagine.

Voice rules, enforce strictly:
- No em dashes anywhere. Use commas, periods, colons, or parentheses.
- No AI filler words: leverage, unlock, genuinely, truly, honestly, navigate, journey, lean in, double down.
- No logic-flip cadence: "not just X, you Y" or "this is not Z, it is W". Rewrite from the positive side.
- Second person.
- Plain, direct, warm. Short paragraphs. No headers in your replies unless the user explicitly asks for a structured answer.

If the user's question can be answered by going to a specific step in Reimagine, end your reply with a single line in this exact format on its own line, with no other text after it:

NAVIGATE: <step-id>

When you include NAVIGATE: in your reply, the value MUST be one of the step ids in the table below. Match the user's request against the "User-facing name" column and use the corresponding "Step id" column. Do not infer step ids from the user guide content; use this table as the only source of truth for navigation targets.

| Step id | User-facing name (use these to match user intent) |
|---|---|
| welcome | Welcome |
| location | Location & Work |
| resume | Your Resume |
| assessment | Assessments |
| values | Values, Passions & Causes |
| reputation | Reputation |
| p1 | Resume Analysis (Phase 1, Know Your Value) |
| p2 | Wiring & Compass (Phase 1, Know Your Value) |
| p3 | Brand Synthesis (Phase 1, Know Your Value) |
| p4 | The Wide View (Phase 2, Explore Options) |
| p5 | The Deep Dive (Phase 2, Explore Options) |
| decision | Your Decision (Phase 2, Explore Options) |
| p6 | Your Bridge Story (Phase 3, Tell Your Story) |
| p7 | Go-to-Market (Phase 4, Find Your Market) |
| p8 | LinkedIn Remix (Phase 5, Get Ready) |
| p_res | Resume Refresh (Phase 5, Get Ready) |
| p9 | Your Playbook (Phase 5, Get Ready) |
| complete | Complete |
| income | Income Now (post-completion bonus) |
| op | Upload a Live Opportunity (post-completion bonus) |

If the user's request does not clearly map to one of the rows above, do not include NAVIGATE: in your reply. Answer the question without offering navigation.

USER GUIDE BELOW. This is the source of truth for everything about Reimagine:

${USER_GUIDE_CONTENT}`

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const origin = req.headers.origin || req.headers.referer || ''
  if (!isAllowedOrigin(origin)) return res.status(403).json({ error: 'Forbidden' })

  const user = await getSessionUser(req, res)
  if (!user) return res.status(401).json({ error: 'Not signed in' })

  const { message, history = [], currentStep } = req.body || {}
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'message required' })
  }

  const contextNote = currentStep ? `\n\n[The user is currently on step "${currentStep}".]` : ''

  const messages = [
    ...history.slice(-10).map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: message + contextNote },
  ]

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1000,
        system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
        messages,
      }),
    })

    if (!response.ok) {
      const errBody = await response.text()
      console.error('Chat upstream error', response.status, errBody)
      return res.status(500).json({ error: 'Chat failed' })
    }

    const data = await response.json()
    const text = data?.content?.[0]?.text || ''

    const navMatch = text.match(/\n?NAVIGATE:\s*(\w+)\s*$/i)
    const navigateTo = navMatch ? navMatch[1] : null
    const cleanText = navMatch ? text.slice(0, navMatch.index).trim() : text.trim()

    // Best-effort log to chat_messages. Failure does not break the response.
    try {
      await sql`
        INSERT INTO chat_messages (user_id, message, reply, current_step, navigated_to)
        VALUES (${user.id}, ${message}, ${cleanText}, ${currentStep || null}, ${navigateTo || null})
      `
      console.log('chat insert ok', { user_id: user.id, step: currentStep, navigated_to: navigateTo })
    } catch (logErr) {
      console.error('chat_messages insert failed:', logErr)
    }

    return res.status(200).json({ reply: cleanText, navigateTo })
  } catch (err) {
    console.error('Chat error:', err)
    return res.status(500).json({ error: 'Chat failed' })
  }
}
