#!/usr/bin/env node
// LIVE model probe, NOT a build gate. Reproduces the exact exchange Bob hit
// live on 2026-09-05: a pipeline stale-check-in reply that both names a new
// interviewer AND reports a scheduled interview, with no date given yet.
//
// v2 (2026-09-05): imports buildCoachRequest directly from api/coach.js --
// the exact function the real handler calls to assemble {system, messages}
// -- instead of a hand-reconstructed stand-in system prompt. v1's reduced
// repro (persona + the 3 relevant capture notes only) got INTERVIEWTEAM: on
// 5/5 runs, which did NOT reproduce the live failure; the working theory is
// that the real prompt's much greater bulk and instruction density (the full
// Making Your Own Weather text, the user guide, the Coach nav map, and
// several OTHER simultaneously-active capture notes this repro left out --
// Values, Assessment, Activity, Coach Notes, Your Next Step's own block) is
// itself part of why compliance drops. This version tests against that real
// bulk directly, with a synthetic-but-realistic profile standing in for a DB
// row, rather than guessing at it by hand a second time.
//
// Importing api/coach.js pulls in two module-scope service clients that
// construct eagerly (neon() for Postgres, new Resend() for email) and throw
// at import time if their env vars are missing entirely -- neither is ever
// actually called by buildCoachRequest itself (no DB read, no email sent),
// so DATABASE_URL and RESEND_API_KEY only need to be present and
// well-formed, not real or reachable. Use throwaway values for those two;
// ANTHROPIC_API_KEY is the one that has to be a real, working key, since
// this script makes real calls with it.
//
// Usage:
//   DATABASE_URL=postgresql://fake:fake@fake.neon.tech/fake?sslmode=require \
//   RESEND_API_KEY=re_fake_1234567890 \
//   ANTHROPIC_API_KEY=sk-ant-your-real-key \
//   node scripts/eval-interview-capture-live.mjs

import { buildCoachRequest } from '../api/coach.js'

const TODAY = new Date()
const isoDaysAgo = n => new Date(TODAY.getTime() - n * 86400000).toISOString().slice(0, 10)

// Realistic-but-synthetic profile: a built Personal Brand and resume (so the
// prompt carries the same bulk a real, established account's does), a
// Deloitte opportunity added via "Add an Opportunity" (door2, so it carries a
// JD and an empty interview panel -- Sally has never been added), staged at
// "interviewing" on My Pipeline.
const DELOITTE_RECORD = {
  id: 'deloitte-sr-mgr-1',
  source: 'door2',
  title: 'Deloitte, Senior Manager',
  company: 'Deloitte',
  jd: 'Senior Manager, Human Capital Advisory. Lead client engagements advising HR and Talent leaders through organizational transformation, workforce strategy, and change management. Partner with client executives to translate business strategy into people strategy. Manage engagement teams and client relationships across the deal lifecycle.',
  panel: { opportunity_context: '', interviewers: [] },
  sections: {},
}

const profileState = {
  profile: {
    values: 'Directness; building things that last; developing people',
    passions: 'Mentoring early-career HR professionals; organizational design',
    resume: '17 years in HR leadership, most recently VP People at a mid-size healthcare company. Built the HR function from the ground up through two acquisitions. Led a 40-person team across talent, total rewards, and HRBP.',
    rep: {
      memory: 'People remember that I make hard calls fast and explain my reasoning.',
      emergency: 'My CHRO called me first during the acquisition integration.',
      twoWords: 'Calm operator',
    },
    assessType: '',
    assess: '',
  },
  outputs: {
    p3: 'Golden Thread: translates operational chaos into durable people systems, learned from standing up HR through two acquisitions in five years. Where This Transfers: management consulting engagements that need someone who has actually run the function they are advising on, not just studied it.',
  },
  selectedLane: 'consulting',
  chosen: 'Management Consulting, HR/People Strategy',
  done: ['p1', 'p2', 'p3', 'p4', 'p5'],
  savedPlaybooks: [DELOITTE_RECORD],
}

const pursuitRows = [
  { record_id: DELOITTE_RECORD.id, stage: 'interviewing', next_conversation_at: null, next_step_at: null, next_move: null, situation_note: null, closed_at: null, outcome: null, updated_at: isoDaysAgo(16) },
]

const baseInputs = {
  history: [
    { role: 'assistant', content: "Your Deloitte opportunity hasn't moved in a couple weeks — has anything happened on it?" },
  ],
  message: "yes, I've got an interview scheduled with Sally Smith from talent acquisition",
  currentStep: 'myCoach',
  surface: 'help',
  returnSection: null,
  focusRecordId: DELOITTE_RECORD.id,
  profileState,
  employmentStatus: 'in_transition',
  // @career.club is auto-granted every pilot (isInternalAccount) -- the same
  // real gate every capture note in this prompt is checked against, so this
  // reproduces a real fully-flagged account rather than special-casing
  // featureFlags by hand.
  featureFlags: [],
  pursuitRows,
  searchIntake: null,
  userEmail: 'bob@career.club',
  track: null,
  activityFacts: [],
  priorSessionAt: isoDaysAgo(3),
  sessionOpenRequested: false,
  generalMode: false,
}

const INTERVIEWTEAM_RE = /^\s*INTERVIEWTEAM:\s*(\{[\s\S]*?\})\s*$/im
const PIPELINE_RE = /^\s*PIPELINE:\s*(\{[\s\S]*?\})\s*$/im

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY is not set. This is a live model call and needs a real key.')
    console.error('DATABASE_URL and RESEND_API_KEY also need to be set (any well-formed value works --')
    console.error('importing api/coach.js constructs those clients eagerly, but this script never calls them):')
    console.error('  DATABASE_URL=postgresql://fake:fake@fake.neon.tech/fake?sslmode=require \\')
    console.error('  RESEND_API_KEY=re_fake_1234567890 \\')
    console.error('  ANTHROPIC_API_KEY=sk-ant-your-real-key \\')
    console.error('  node scripts/eval-interview-capture-live.mjs')
    process.exit(1)
  }

  const { system, messages } = buildCoachRequest(baseInputs)
  const totalChars = system.reduce((n, b) => n + b.text.length, 0)
  console.log(`Built real system prompt: ${system.length} block(s), ${totalChars.toLocaleString()} chars total (this is what the live account actually sends -- v1's reduced repro was a few thousand chars).`)

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
        max_tokens: 8000,
        output_config: { effort: 'medium' },
        system,
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

  console.log(`\n=== Summary over ${RUNS} runs (real prompt assembly, real bulk) ===`)
  console.log(`INTERVIEWTEAM trailer emitted: ${sawInterviewTeam}/${RUNS}`)
  console.log(`PIPELINE trailer emitted (should be 0 -- no date was given): ${sawPipeline}/${RUNS}`)
  console.log(`Reply asks a follow-up question: ${sawQuestion}/${RUNS}`)
  if (sawInterviewTeam < RUNS) {
    console.log(`\nREPRODUCED (at least partially): under the real prompt's full bulk, the model does not reliably emit INTERVIEWTEAM: even though a name and an opportunity were both clearly given. This supports the instruction-density theory over pure one-off sampling noise.`)
  } else {
    console.log(`\nStill did NOT reproduce at 5/5. Either the live failure needs an even longer conversation history than this, or something about that specific account/session (not modeled here) was the actual cause -- worth trying more runs, or a longer synthetic history, before concluding it is unreproducible.`)
  }
}

main()
