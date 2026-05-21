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

Printing a section: when a user asks how to print a Reimagine section, tell them to press Ctrl+P on Windows or Cmd+P on Mac from the section they want to print. Reimagine produces a clean printout of that section: the full content, paper-friendly type, no sidebar or buttons. From the print dialog they can save it as a PDF or send it to a printer. If they would rather paste into a document first, the Copy All button at the top of the section copies the formatted text to their clipboard. Both paths work, so they can pick whichever fits their preference. Recommend Ctrl+P with confidence; it is the primary path and Copy All is the secondary one.

Voice rules, enforce strictly:
- No em dashes anywhere. Use commas, periods, colons, or parentheses.
- No AI filler words: leverage, unlock, genuinely, truly, honestly, navigate, journey, lean in, double down.
- No logic-flip cadence: "not just X, you Y" or "this is not Z, it is W". Rewrite from the positive side.
- No comparison framing. Never write "Most people do X, you do Y" or "Most professionals do X, but you do Y" or similar. This is a flattery pattern dressed as observation. Rewrite either from the second person addressed directly to the reader ("You probably see one or two obvious next steps"), or from the positive side without a comparison ("This step maps a wider landscape of options"), or from factual evidence with a source. Banned examples: "Most people take assessments and file them away." "Most people see one or two obvious next steps." "When someone asks what do you do, most people default to a job title." Good rewrites: "This step puts your assessment to work." "This step maps a wider landscape of options." "When someone asks what do you do, you want a better answer than your job title."
- Second person.
- When describing the step where the user picks one of their three options (named "Your Focus" in the sidebar), use words like "pick," "choose," "focus on." Do not use "commit," "commit to," or "committing" because those words frame the choice as binding when it is not. The user can always come back and choose differently; everything updates around the new choice. The framing of this step is "focus, not commit," and that distinction matters.
- Plain, direct, warm. Short paragraphs. No headers in your replies unless the user explicitly asks for a structured answer.

If the user's question can be answered by going to a specific step in Reimagine, end your reply with a single line in this exact format on its own line, with no other text after it:

NAVIGATE: <step-id>

When you include NAVIGATE: in your reply, the value MUST be one of the step ids in the table below. Match the user's request against the "User-facing name" column and use the corresponding "Step id" column. Do not infer step ids from the user guide content; use this table as the only source of truth for navigation targets.

| Step id | User-facing name (use these to match user intent) |
|---|---|
| welcome | Welcome |
| location | Location & Work |
| resume | Your Resume |
| linkedin | Your LinkedIn |
| assessment | Assessments |
| values | Values, Passions & Causes |
| reputation | Reputation |
| life-events | Your Story |
| orientation-done | Orientation Complete |
| p3 | Personal Brand (Phase 1, Know Your Value) |
| twoDoors | Choose Your Path (Phase 2, Explore Options) |
| laneSelect | Pick a Direction (Phase 2, Explore Options) |
| p4 | Role Options (Phase 2, Explore Options) |
| focus | Focus Playbook (Phase 2, Explore Options) |
| p6 | Your Bridge Story (Phase 3, Tell Your Story) |
| p7 | Go-to-Market (Phase 4, Find Your Market) |
| p8 | LinkedIn Remix (Phase 5, Get Ready) |
| p_res | Resume Refresh (Phase 5, Get Ready) |
| p9 | Your Playbook (Phase 5, Get Ready) |
| p10 | Your Playbook (Phase 5, Get Ready) |
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

  let upstream
  try {
    upstream = await fetch('https://api.anthropic.com/v1/messages', {
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
        stream: true,
      }),
    })
  } catch (err) {
    console.error('Chat upstream connect error:', err)
    return res.status(500).json({ error: 'Chat failed' })
  }

  if (!upstream.ok || !upstream.body) {
    const errBody = await upstream.text().catch(() => '')
    console.error('Chat upstream non-200', upstream.status, errBody)
    return res.status(500).json({ error: 'Chat failed' })
  }

  res.setHeader('Content-Type', 'text/plain; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('X-Accel-Buffering', 'no')
  res.status(200)

  const reader = upstream.body.getReader()
  const decoder = new TextDecoder()
  let fullText = ''
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      let idx
      while ((idx = buffer.indexOf('\n\n')) !== -1) {
        const evt = buffer.slice(0, idx)
        buffer = buffer.slice(idx + 2)
        const dataLine = evt.split('\n').find(l => l.startsWith('data: '))
        if (!dataLine) continue
        try {
          const obj = JSON.parse(dataLine.slice(6))
          if (obj.type === 'content_block_delta' && obj.delta?.type === 'text_delta') {
            const chunk = obj.delta.text
            fullText += chunk
            res.write(chunk)
          }
        } catch {}
      }
    }
  } catch (err) {
    console.error('Chat stream read error:', err)
  }

  // Log BEFORE closing the response so the function instance stays alive long
  // enough for the insert to finish. Post-res.end() awaits are unreliable on
  // Vercel serverless: the instance can be torn down the moment the response
  // closes, dropping the in-flight insert.
  const navMatch = fullText.match(/\n?NAVIGATE:\s*(\w+)\s*$/i)
  const navigateTo = navMatch ? navMatch[1] : null
  const cleanText = navMatch ? fullText.slice(0, navMatch.index).trim() : fullText.trim()
  try {
    await sql`
      INSERT INTO chat_messages (user_id, message, reply, current_step, navigated_to)
      VALUES (${user.id}, ${message}, ${cleanText}, ${currentStep || null}, ${navigateTo || null})
    `
    console.log('chat insert ok', { user_id: user.id, step: currentStep, navigated_to: navigateTo })
  } catch (logErr) {
    console.error('chat_messages insert failed:', logErr)
  }

  res.end()
}
