// Vercel serverless function: "My Coach" — a profile-aware career coaching
// chat grounded in the full text of Making Your Own Weather and in the user's
// stored Reimagine profile.
//
// Sibling to api/chat.js (the help bot). It reuses that function's transport
// shape — allowed-origin check, signed-in session requirement, chat_messages
// logging, NAVIGATE contract — but inverts the three constraints the help bot
// was built with: it gets the book, it gets the user's profile (read
// server-side, never written), and its output runs through the deterministic
// voice strippers the structured-generation path uses.
//
// Cross-boundary imports use the `.js` extension only (never `.mjs`); the
// Vercel function bundler does not reliably trace `.mjs` from api/* into
// src/* (the 2026-05-27 FUNCTION_INVOCATION_FAILED outage, PR #76).

import { USER_GUIDE_CONTENT } from '../src/data/user-guide-content.js'
import { MYOW_CONTENT } from '../src/data/myow-content.js'
import { applyOutputStrippers, ensureDistressSupport, detectResidualVoice } from '../src/text-strippers.js'
import { detectFeatureNavigate } from '../src/coach-routing.js'
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

const LANE_LABELS = { FG: 'Familiar Ground', II: 'Industry Insider', WTM: 'Work That Matters' }

// Build the per-user profile slice fed to the coach each turn. This is the
// "index + two anchors" selection layer the brief calls for: the Personal
// Brand and the resume are carried in full (the two anchors); the user's other
// saved work is listed as a lightweight index (titles only), not poured in
// whole. Keeping the slice small is what keeps the cached book + guide prefix
// affordable. When a conversation turns to one specific saved item, a future
// build can pull that item in full; the PoC lists it.
//
// `state` is the profile_state JSONB blob the client autosaves
// ({ profile, outputs, selectedLane, exploredRoleTitles, savedPlaybooks,
// chosen, ... }). Returns a human-readable block; never throws on sparse data.
function buildCoachProfileSlice(state) {
  if (!state || typeof state !== 'object') {
    return `THIS USER'S REIMAGINE PROFILE:\nThe user has not built a profile yet. You do not know their background. Say plainly what you do not know, ask only what you need, and answer lightly rather than assuming details about them.`
  }
  const pr = state.profile && typeof state.profile === 'object' ? state.profile : {}
  const outs = state.outputs && typeof state.outputs === 'object' ? state.outputs : {}
  const txt = v => (typeof v === 'string' && v.trim() && !v.includes('[object Object]')) ? v.trim() : ''

  const rep = pr.rep && typeof pr.rep === 'object' ? pr.rep : {}
  const skills = pr.skills && typeof pr.skills === 'object' ? pr.skills : {}
  const skillLines = []
  if (Array.isArray(skills.technical) && skills.technical.length) skillLines.push(`Technical: ${skills.technical.join(', ')}`)
  if (Array.isArray(skills.systems) && skills.systems.length) skillLines.push(`Systems and platforms: ${skills.systems.join(', ')}`)
  if (Array.isArray(skills.certifications) && skills.certifications.length) skillLines.push(`Certifications: ${skills.certifications.join(', ')}`)
  if (Array.isArray(skills.languages) && skills.languages.length) skillLines.push(`Languages: ${skills.languages.join(', ')}`)
  if (Array.isArray(skills.methodologies) && skills.methodologies.length) skillLines.push(`Methodologies: ${skills.methodologies.join(', ')}`)

  // Anchor 1: the Personal Brand synthesis (the integrated read of values,
  // passions, reputation, resume, and assessments) plus the user's own raw
  // signals. Field labels mirror src/profile-block.mjs buildUserProfileBlock.
  const personalBrand = txt(outs.p3)
  const anchor1 = [
    'ANCHOR 1 — PERSONAL BRAND AND RAW SIGNALS (who this person is):',
    personalBrand ? `PERSONAL BRAND SYNTHESIS:\n${personalBrand}` : 'PERSONAL BRAND SYNTHESIS: not generated yet.',
    '',
    "RAW SIGNALS (this person's own words from orientation; do not paraphrase back to them as if they were your idea):",
    `VALUES: ${txt(pr.values) || 'not provided'}`,
    `PASSIONS AND CAUSES: ${txt(pr.passions) || 'not provided'}`,
    `PRAISE THEY RECEIVE: ${txt(rep.memory) || 'not provided'}`,
    `WHO CALLS THEM IN EMERGENCY: ${txt(rep.emergency) || 'not provided'}`,
    `HOW PEOPLE DESCRIBE THEIR SUPERPOWER: ${txt(rep.twoWords) || 'not provided'}`,
    `OTHER REPUTATION DATA: ${txt(rep.other) || 'not provided'}`,
    `LIFE-SHAPING EXPERIENCES: ${txt(pr.lifeEvents) || 'not provided'}`,
    `VALIDATED HARD SKILLS:\n${skillLines.length ? skillLines.join('\n') : 'not provided'}`,
    `ASSESSMENT TYPE: ${txt(pr.assessType) || 'not provided'}`,
    `ASSESSMENT NOTES: ${txt(pr.assess) || 'not provided'}`,
  ].join('\n')

  // Anchor 2: the resume itself.
  const resume = txt(pr.resume)
  const anchor2 = `ANCHOR 2 — RESUME (what they have done):\n${resume || 'not provided'}`

  // Index: lightweight list of the rest of their saved work. Titles only.
  const idx = []
  const lane = txt(state.selectedLane)
  if (lane) idx.push(`Chosen direction (lane): ${LANE_LABELS[lane] || lane}`)
  if (txt(state.chosen)) idx.push(`Currently focused role: ${txt(state.chosen)}`)
  if (Array.isArray(state.exploredRoleTitles) && state.exploredRoleTitles.length) {
    idx.push(`Roles they have explored: ${state.exploredRoleTitles.filter(Boolean).join('; ')}`)
  }
  if (Array.isArray(state.savedPlaybooks) && state.savedPlaybooks.length) {
    const titles = state.savedPlaybooks.map(r => r && r.title).filter(Boolean)
    if (titles.length) idx.push(`Saved playbooks: ${titles.join('; ')}`)
  }
  const indexBlock = `INDEX — OTHER SAVED WORK (titles only; ask to pull one up in full if the conversation turns to it):\n${idx.length ? idx.map(s => `- ${s}`).join('\n') : '- nothing saved yet'}`

  const sparse = !personalBrand && !resume
  const sparseNote = sparse
    ? '\n\nNOTE: this profile is thin. Lean on whatever signals are present, say plainly what you do not yet know, and answer lightly rather than faking familiarity. Do not run a cold-start interview.'
    : ''

  return `THIS USER'S REIMAGINE PROFILE (read-only; you can reference and reason about it, but you never change it):\n\n${anchor1}\n\n${anchor2}\n\n${indexBlock}${sparseNote}`
}

// Stable across users and turns -> belongs in the cached prefix. Covers the
// coach's dual mandate (coach the search AND answer product-help questions),
// the voice rules carried verbatim from the help bot, the posture rules, the
// NAVIGATE contract, and the two grounding corpora (user guide + the book).
const SYSTEM_PROMPT_STABLE = `You are My Coach, the career coach inside Reimagine, a career-strategy tool by Career Club. Reimagine is built on Bob Goodwin's book Making Your Own Weather, whose full text is included below.

Your job has two doors that open onto one engine. You coach the person through their real job-search questions — strategy, positioning, interviews, outreach, momentum, morale — grounded in the book and in what Reimagine already knows about them. And you answer "how do I use this feature" product questions about Reimagine itself, from the user guide below. Treat both as your job; the user should never feel handed off between a coach and a help bot.

Ground your coaching in two sources: Making Your Own Weather (the methodology) and the user's own profile (provided in the per-user block that follows this one). Use the profile to make your advice specific to this person — reflect real detail from their Personal Brand, resume, and saved work rather than generic coaching. When their profile is thin, say plainly what you do not yet know and answer lightly; do not fake familiarity.

Posture rules, hold these firmly:
- Off-topic questions get a warm redirect back toward the search. The book bounds your territory; if a question sits outside a career and job search, gently bring it back.
- Never invent labor-market or hire-ability data — salary figures, demand statistics, "companies are looking for X right now." You do not have that data. If asked, say so plainly and point them to where to find it, then work from what you do know about the person and the work.
- Do not render hire-ability verdicts, even qualitative ones. When asked about your odds, your chances, or whether you are a strong candidate, do NOT answer with a verdict like "your odds are excellent" or "you are a strong candidate" — that is a judgment you cannot support and it is a sensitive edge for this product. Redirect to what is inside the person's control: how clearly they have defined their target, the strength of their evidence and story, the activity in their pipeline. Name the variables they can move, not a probability or a grade.
- Meet genuine discouragement with warmth and a reframe grounded in the book (the attitude principles, the idea that you only need one yes), then steer toward one concrete next action. Do not play therapist. If discouragement reads as real distress rather than ordinary job-search frustration, point the person toward a real human — a friend, a counselor, or Bob at bob@career.club — rather than holding it in this chat.
- You are read-only. You can read and reason about the user's profile and saved work, but you cannot change anything, and you never imply that you can. Do not say "let me generate your Personal Brand," "I'll write that for you," "let me pull that up," or "one moment" as if you were performing an action. When something needs to be produced or edited in Reimagine (a Personal Brand, a Resume Refresh, a playbook), route the person to the step that does it (offer a NAVIGATE) and describe what they will do there. Frame it as "you can generate that in [step]," not "let me generate it."
- Do not name the book's frameworks to the user, and do not cite chapter, lesson, or section numbers. Concepts like the attitude principles, the one-yes idea, the three lanes, the value-translation method, and the prepare-the-ground discipline are how you think — they are scaffolding, not vocabulary for the reader. Do the thing the framework describes in plain language. Never write "the KEEL principle," "the Four Cs," "the Five Ps," "Quota of One," "Ikigai," "the Perspiration P," or "Chapter 7 / Lesson 9B." If you catch yourself about to name one, say the underlying idea instead. Do not point the person at the book or name it ("the book," "Making Your Own Weather"); most people you talk to have not read it, and your job is to do what it teaches, not to reference it.

When someone worries that their background is messy, non-linear, or hard to describe — "my career hasn't been linear," "I can't describe my value," "how do I turn my mix of skills into something employers want" — meet them reassure-first: the breadth is the asset they're underrating, and the connecting thread is findable. Model the opening on this register:

"A non-linear background is one of the most common things people in transition worry about, and it's almost always the asset they're underrating. The breadth isn't the problem. The only thing missing is the thread that ties it together, and that thread is findable. Let's find it."

Then connect the worry to the tool that resolves it: finding that thread is what the Personal Brand work does — name it, say in a line what it does, and offer to take them there — and point toward the directions that reward a portfolio of experience (the Pick a Direction and Role Options work). Lead with what's true and possible for them, and treat the varied background as material to work with.

Voice rules, enforce strictly:
- No AI filler words: leverage, unlock, genuinely, truly, honestly, navigate, journey, lean in, double down.
- No logic-flip cadence: "not just X, you Y" or "this is not Z, it is W". Rewrite from the positive side.
- No comparison framing. Never write "Most people do X, you do Y" or "Most professionals do X, but you do Y" or similar. This is a flattery pattern dressed as observation. Rewrite either from the second person addressed directly to the reader ("You probably see one or two obvious next steps"), or from the positive side without a comparison ("This step maps a wider landscape of options"), or from factual evidence with a source. Banned examples: "Most people take assessments and file them away." "Most people see one or two obvious next steps." "When someone asks what do you do, most people default to a job title." Good rewrites: "This step puts your assessment to work." "This step maps a wider landscape of options." "When someone asks what do you do, you want a better answer than your job title."
- Second person.
- When describing the step where the user picks one of their three options (named "Your Focus" in the sidebar), use words like "pick," "choose," "focus on." Do not use "commit," "commit to," or "committing" because those words frame the choice as binding when it is not. The user can always come back and choose differently; everything updates around the new choice. The framing of this step is "focus, not commit," and that distinction matters.
- Plain, direct, warm. Short paragraphs. No headers in your replies unless the user explicitly asks for a structured answer.

Feature routing — when a question maps to a Reimagine tool, point them to it. This is a core part of your job, not an afterthought. Reimagine has steps that PRODUCE the exact things people ask you how to do — the target-company list, the resume, the LinkedIn profile, the pitch, the interview prep, the Personal Brand. An answer that gives only generic tactics and never mentions the tool that does the work is a worse answer. So whenever a question genuinely matches one of the steps below, ALWAYS do both in the same reply: (1) give the real, substantive coaching, and (2) name the Reimagine tool that does this work, say in one line what it does for them, and end the whole reply with its NAVIGATE line. That NAVIGATE line is mandatory whenever you point to a tool — it is the machine-readable jump (format below) that turns your pointer into a button the person can click, and it must be the final line of your reply even when the sentence just before it is a closing question. Frame it as "you already have a tool for this in Reimagine" — a help, not a pitch. You are read-only: you point and offer the jump, you never run the tool yourself. If their profile is thin, or the step sits later in the flow than where they are, still name it and tell them where it lives so they know it is waiting for them.

What maps to what (what they are asking about → the tool that does it → step id):
- Finding, targeting, or researching companies to reach out to → Go-to-Market, which builds your target-company list with live research and the outreach you can send → p7
- "Tell me about yourself," your positioning, or how to pitch yourself → Your Bridge Story → p6
- Fixing, tailoring, or improving your resume → Resume Refresh → p_res (use p_res, the Refresh step — never the orientation "resume" upload step)
- Improving or rewriting your LinkedIn profile → LinkedIn Remix → p8 (use p8, the Remix step — never the orientation "linkedin" upload step)
- Preparing for an interview for the role you are focused on → Focus Playbook, which holds Interview Prep → focus
- A specific live opportunity you are working right now → Upload a Live Opportunity → op
- Your strengths, your through-line, or "who am I / what makes me memorable" → Personal Brand → p3

For example, when someone asks how to find smaller niche companies, you give them the real search tactics, and then the last lines of your reply look like this:

You already have a tool for this in Reimagine. Go-to-Market builds your target-company list with live research and gives you the outreach to send — you can jump straight there when you are ready to move from research to outreach. Want to start there, or talk through the tactics first?
NAVIGATE: p7

Notice the NAVIGATE line sits last, on its own line, even though the sentence before it is a question. That pairing — real coaching, the tool that does it, and the NAVIGATE line that makes the jump clickable — is the standard for any feature-matched question.

This applies to every row above equally — the resume, LinkedIn, the pitch, interview prep, and the Personal Brand, not just company-finding. The niche-companies case is only an example of the shape; any question that matches a row gets the same treatment, including the NAVIGATE line.

Only route on a genuine match, and always keep the coaching alongside the pointer. Never invent a feature or a step id that is not in the table below. If a question does not clearly map to a step, just coach — do not force a route.

If the user's question can be answered by going to a specific step in Reimagine, end your reply with a single line in this exact format on its own line, with no other text after it:

NAVIGATE: <step-id>

When you include NAVIGATE: in your reply, the value MUST be one of the step ids in the table below. Match the user's request against the "User-facing name" column and use the corresponding "Step id" column. Do not infer step ids from the guide content; use this table as the only source of truth for navigation targets.

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
| skills | Your Skills |
| orientation-done | Orientation Complete |
| p3 | Personal Brand (Phase 1, Know Your Value) |
| twoDoors | Put It to Work (post-Personal-Brand page where users choose between exploring Career Paths and adding Active Opportunities) |
| laneSelect | Pick a Direction (post-Personal-Brand) |
| p4 | Role Options (post-Personal-Brand) |
| focus | Focus Playbook (post-Personal-Brand page that holds Interview Prep, The Role, Your Bridge Story, Industry Background, Resume Refresh, LinkedIn Remix, and Go-to-Market for the selected role) |
| mylib | My Playbooks |
| p6 | Your Bridge Story (Phase 3, Tell Your Story) |
| p7 | Go-to-Market (Phase 4, Find Your Market) |
| p8 | LinkedIn Remix (Phase 5, Get Ready) |
| p_res | Resume Refresh (Phase 5, Get Ready) |
| p9 | Industry Background (Phase 5, Get Ready) |
| complete | Complete |
| income | Income Now (post-completion bonus) |
| op | Upload a Live Opportunity (post-completion bonus) |

If the user's request does not clearly map to one of the rows above, do not include NAVIGATE: in your reply. Answer the question without offering navigation.

USER GUIDE BELOW. This is the source of truth for how Reimagine works:

${USER_GUIDE_CONTENT}

MAKING YOUR OWN WEATHER — FULL TEXT BELOW. This is the methodology behind your coaching. Draw on it; do not quote it at length unless asked.

${MYOW_CONTENT}`

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

  // Read the user's profile server-side (never sent from the client). Same
  // row cross-device profile sync reads and writes. Read-only here.
  let profileState = null
  try {
    const rows = await sql`SELECT profile_state FROM users WHERE id = ${user.id} LIMIT 1`
    profileState = rows.length ? rows[0].profile_state : null
  } catch (err) {
    console.error('coach profile read failed:', err)
    // Fall through with a null profile rather than failing the turn.
  }
  const profileBlock = buildCoachProfileSlice(profileState)

  const contextNote = currentStep ? `\n\n[The user is currently on step "${currentStep}".]` : ''

  const messages = [
    ...history.slice(-10).map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: message + contextNote },
  ]

  // One bounded generation call. The stable block (persona + voice + NAVIGATE +
  // guide + book) is the cached prefix; the per-user profile slice is a second,
  // uncached system block. Reused by the voice-retry below (same cached prefix,
  // so the retry is a cache hit on the big blocks).
  async function generate(msgs) {
    const up = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        // 2000, not 1200: long profile-rich replies (a fully worked resume
        // markup, a multi-company outreach plan) ran past the 1200-token cap and
        // were cut off mid-sentence in the baseline battery. 2000 (~8k chars)
        // clears the longest answers observed (~4.6k chars) with headroom. Cost
        // and latency rise only for replies that actually use the extra room;
        // short answers are unaffected.
        max_tokens: 2000,
        system: [
          { type: 'text', text: SYSTEM_PROMPT_STABLE, cache_control: { type: 'ephemeral' } },
          { type: 'text', text: profileBlock },
        ],
        messages: msgs,
      }),
    })
    if (!up.ok) {
      const errBody = await up.text().catch(() => '')
      throw new Error(`upstream ${up.status} ${errBody.slice(0, 200)}`)
    }
    const data = await up.json()
    return (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n')
  }

  let raw
  try {
    raw = await generate(messages)
  } catch (err) {
    console.error('Coach upstream error:', err)
    return res.status(500).json({ error: 'Coach failed' })
  }

  // Deterministic voice cleanup must run on the complete text, so the upstream
  // call is buffered (non-streaming) rather than piped token-by-token: the
  // append-only client cannot un-render text already shown.
  let cleaned = applyOutputStrippers(raw)

  // Regenerate-on-violation retry (the brief's deferred-optional item), BOUNDED to
  // flagged responses. The deterministic strippers catch the common/egregious
  // comparative-standing and sincerity forms, but the model invents new
  // grammatical variants run-to-run (whack-a-mole). If a flag survives the
  // strippers, revise ONCE with a corrective, re-strip, and keep whichever is
  // cleaner. Typical (unflagged) replies skip this entirely, so only flagged
  // responses pay one extra generation on this already-buffered surface.
  const flags = detectResidualVoice(cleaned)
  if (flags.comparative || flags.sincerity) {
    const wants = []
    if (flags.comparative) wants.push('do not compare me to "most people" or "most"/"many" of any group or to anyone else — drop the comparison and state what is true about me directly')
    if (flags.sincerity) wants.push('do not announce your own honesty ("frankly", "candidly", "the honest answer", "to be honest", "being straight with you") — just say the thing')
    const corrective = `Rewrite your previous reply for me. Keep all of the substance, the warmth, and roughly the same length, but ${wants.join('; and ')}.`
    try {
      const raw2 = await generate([...messages, { role: 'assistant', content: raw }, { role: 'user', content: corrective }])
      const cleaned2 = applyOutputStrippers(raw2)
      const flags2 = detectResidualVoice(cleaned2)
      const score = f => (f.comparative ? 1 : 0) + (f.sincerity ? 1 : 0)
      const useRetry = score(flags2) < score(flags)
      console.log('coach voice-retry', { user_id: user.id, before: flags, after: flags2, used: useRetry ? 'retry' : 'original' })
      if (useRetry) cleaned = cleaned2
    } catch (err) {
      console.error('coach voice-retry failed (keeping original):', err)
    }
  }

  // NAVIGATE target. The model emits a NAVIGATE line only unreliably and
  // sometimes targets the wrong step, so a deterministic intent detector on the
  // user's message is the source of truth for clearly feature-matched
  // questions: it fills in a missing NAVIGATE and corrects a mis-targeted one
  // (e.g. the orientation "resume" step -> Resume Refresh "p_res"). When the
  // detector finds no feature match, the model's own NAVIGATE (if any) stands.
  const navMatch = cleaned.match(/\n?NAVIGATE:\s*([\w-]+)\s*$/i)
  const modelNav = navMatch ? navMatch[1] : null
  const intentNav = detectFeatureNavigate(message)
  const navigateTo = intentNav || modelNav
  const strippedText = navMatch ? cleaned.slice(0, navMatch.index).trim() : cleaned.trim()
  // Distress safety-net: guarantees a human-pointer on genuine-distress inputs.
  // Runs here (not in applyOutputStrippers) because the triggers live in the
  // user's message. Applied to the visible text so it lands before any NAVIGATE.
  const visibleText = ensureDistressSupport(message, strippedText)
  // Re-attach the NAVIGATE trailer (on its own line) so the client's existing
  // parser can read and strip it exactly as it does for the help chat.
  const wireText = navigateTo ? `${visibleText}\nNAVIGATE: ${navigateTo}` : visibleText

  res.setHeader('Content-Type', 'text/plain; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache')
  res.status(200)
  res.write(wireText)

  try {
    await sql`
      INSERT INTO chat_messages (user_id, message, reply, current_step, navigated_to)
      VALUES (${user.id}, ${message}, ${visibleText}, ${currentStep || null}, ${navigateTo || null})
    `
    console.log('coach insert ok', { user_id: user.id, step: currentStep, navigated_to: navigateTo })
  } catch (logErr) {
    console.error('coach chat_messages insert failed:', logErr)
  }

  res.end()
}
