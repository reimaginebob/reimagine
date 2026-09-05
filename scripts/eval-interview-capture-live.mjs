#!/usr/bin/env node
// LIVE model probe, NOT a build gate. Reproduces the exact exchange Bob hit
// live on 2026-09-05: a pipeline stale-check-in reply that both names a new
// interviewer AND reports a scheduled interview, with no date given yet.
//
// The question under test: does the model, given INTERVIEW_TEAM_CAPTURE_NOTE
// + PIPELINE_CAPTURE_NOTE + STAGE_MOVE_FOLLOWTHROUGH_NOTE all active at once
// (the real, fully-loaded condition on that account), actually emit the
// INTERVIEWTEAM: trailer INTERVIEW_TEAM_CAPTURE_NOTE's own text requires
// ("emit the line the moment you have a name -- then, in the same reply,
// ask... for whatever is still missing") -- or does it only ask the
// follow-up question (the STAGE_MOVE_FOLLOWTHROUGH_NOTE behavior) and drop
// the capture line, which is what the live transcript showed: a natural
// question, no offer, nothing to tap.
//
// The three capture-note constants below are extracted VERBATIM from
// api/coach.js at run time (not hand-copied) so this always tests the
// wording actually shipping, never a stale duplicate. The system prompt
// here is a condensed stand-in for SYSTEM_PROMPT_STABLE (persona + voice
// rules + the capture notes), not a byte-identical copy -- SYSTEM_PROMPT_STABLE
// also carries the full Making Your Own Weather text, the user guide, and
// the generated Coach nav map, none of which bears on whether a capture
// trailer gets emitted. Flag this if the live behavior does not reproduce:
// it would mean the extra bulk itself is part of the failure mode.
//
// Usage: ANTHROPIC_API_KEY=sk-... node scripts/eval-interview-capture-live.mjs

import fs from 'node:fs'

function extractConst(src, name) {
  const line = src.split('\n').find(l => l.startsWith(`const ${name} =`))
  if (!line) throw new Error(`Could not find ${name} in api/coach.js -- has it been renamed?`)
  const scope = {}
  new Function('scope', `${line}\nscope.value = ${name}`)(scope)
  return scope.value
}

const coachSrc = fs.readFileSync(new URL('../api/coach.js', import.meta.url), 'utf8')
const INTERVIEW_TEAM_CAPTURE_NOTE = extractConst(coachSrc, 'INTERVIEW_TEAM_CAPTURE_NOTE')
const PIPELINE_CAPTURE_NOTE = extractConst(coachSrc, 'PIPELINE_CAPTURE_NOTE')
const STAGE_MOVE_FOLLOWTHROUGH_NOTE = extractConst(coachSrc, 'STAGE_MOVE_FOLLOWTHROUGH_NOTE')

const TODAY = new Date().toISOString().slice(0, 10)

const SYSTEM_PROMPT = `You are My Coach, the career coach inside Reimagine, a career-strategy tool. Speak as a partner, not a separate party with your own wants. Never say you have saved, logged, added, or noted something the person has not confirmed with a tap -- the app writes only when they tap a one-tap offer under your reply, never because you said something back to them. Ask like a person would: one natural question at a time, never a checklist or a form. Plain English, no jargon, no coaching register.

TODAY'S DATE: ${TODAY}

ANCHOR 1 -- this person's saved work relevant to this conversation:
- Opportunity: "Deloitte, Senior Manager" (saved on My Pipeline, stage: interviewing)
- Interview team roster for this opportunity: EMPTY -- nobody has been added yet.
${INTERVIEW_TEAM_CAPTURE_NOTE}${PIPELINE_CAPTURE_NOTE}${STAGE_MOVE_FOLLOWTHROUGH_NOTE}`

const messages = [
  { role: 'assistant', content: "Your Deloitte opportunity hasn't moved in a couple weeks — has anything happened on it?" },
  { role: 'user', content: "yes, I've got an interview scheduled with Sally Smith from talent acquisition" },
]

const INTERVIEWTEAM_RE = /^\s*INTERVIEWTEAM:\s*(\{[\s\S]*?\})\s*$/im
const PIPELINE_RE = /^\s*PIPELINE:\s*(\{[\s\S]*?\})\s*$/im

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY is not set. This is a live model call and needs a real key:')
    console.error('  ANTHROPIC_API_KEY=sk-... node scripts/eval-interview-capture-live.mjs')
    process.exit(1)
  }

  const RUNS = 5
  let sawInterviewTeam = 0
  let sawPipeline = 0
  let sawQuestion = 0

  for (let i = 1; i <= RUNS; i++) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 2000,
        output_config: { effort: 'medium' },
        system: [{ type: 'text', text: SYSTEM_PROMPT }],
        messages,
      }),
    })
    if (!res.ok) {
      console.error(`Run ${i}: API error ${res.status}`, await res.text())
      process.exit(1)
    }
    const data = await res.json()
    const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('')
    const hasIT = INTERVIEWTEAM_RE.test(text)
    const hasPL = PIPELINE_RE.test(text)
    const hasQ = /\?\s*$/m.test(text.replace(/^\s*(INTERVIEWTEAM|PIPELINE):.*$/gim, '').trim())
    if (hasIT) sawInterviewTeam++
    if (hasPL) sawPipeline++
    if (hasQ) sawQuestion++
    console.log(`\n=== Run ${i} ===`)
    console.log(text)
    console.log(`--- INTERVIEWTEAM emitted: ${hasIT} | PIPELINE emitted: ${hasPL} | ends with a question: ${hasQ} ---`)
  }

  console.log(`\n=== Summary over ${RUNS} runs ===`)
  console.log(`INTERVIEWTEAM trailer emitted: ${sawInterviewTeam}/${RUNS}`)
  console.log(`PIPELINE trailer emitted (should be 0 -- no date was given): ${sawPipeline}/${RUNS}`)
  console.log(`Reply asks a follow-up question: ${sawQuestion}/${RUNS}`)
  if (sawInterviewTeam < RUNS) {
    console.log(`\nCONFIRMED: the model does not reliably emit INTERVIEWTEAM: even though a name and an opportunity were both clearly given. INTERVIEW_TEAM_CAPTURE_NOTE's own instruction ("emit the line the moment you have a name") is not being followed under this instruction load.`)
  } else {
    console.log(`\nDid NOT reproduce: the model emitted INTERVIEWTEAM: every time in this reduced repro. The live failure may depend on the fuller SYSTEM_PROMPT_STABLE (book/guide/nav-map bulk) or on something specific to that account/session not captured here.`)
  }
}

main()
