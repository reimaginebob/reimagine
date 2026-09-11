#!/usr/bin/env node
// LIVE model probe, NOT a build gate. Rubric eval for the 2026-09-09 voice
// review (Output/handoff/2026-09-09_coach-voice-review.md, Section 10):
// Bob's explicit direction is that a banned-word list is whack-a-mole (the
// model routes around each word with the next one), so the check here is on
// the PLAIN_ENGLISH principle, not on vocabulary. Detection is a second
// model call acting as judge, on one question, not a regex.
//
// Runs each of the five rewritten model-instruction templates (Choice on a
// lane, Choice on a role, Delivery's shared nine-section template, the
// Personal Brand richness check Delivery was built to copy, and the
// session-open Return recap) against ONE labeled-synthetic profile -- a
// fictional account, not a real one. This is the "acceptable as a second
// check" path the review names in Section 11; it does not replace Bob
// triggering each moment on production and reading the real replies, which
// is the actual test.
//
// Imports buildCoachRequest, buildMomentTurnText, and
// buildOrientationCheckTurnText directly from api/coach.js -- the exact
// functions the real handler calls -- rather than hand-reconstructing the
// system prompt or the reaction text, same reasoning as
// eval-interview-capture-live.mjs.
//
// Importing api/coach.js pulls in two module-scope service clients that
// construct eagerly (neon() for Postgres, new Resend() for email) and throw
// at import time if their env vars are missing entirely -- neither is ever
// actually called by buildCoachRequest itself (no DB read, no email sent),
// so DATABASE_URL and RESEND_API_KEY only need to be present and
// well-formed, not real or reachable. Use throwaway values for those two;
// ANTHROPIC_API_KEY is the one that has to be a real, working key, since
// this script makes real calls with it -- one to generate each reply, one
// to judge it.
//
// Usage:
//   DATABASE_URL=postgresql://fake:fake@fake.neon.tech/fake?sslmode=require \
//   RESEND_API_KEY=re_fake_1234567890 \
//   ANTHROPIC_API_KEY=sk-ant-your-real-key \
//   node scripts/eval-plain-english-live.mjs

import { buildCoachRequest, buildMomentTurnText, buildOrientationCheckTurnText } from '../api/coach.js'
import { detectVoiceViolations } from '../src/voice-patterns.js'

const TODAY = new Date()
const isoDaysAgo = n => new Date(TODAY.getTime() - n * 86400000).toISOString().slice(0, 10)

// SYNTHETIC profile. "Jordan Ellis" is fictional -- not a real Reimagine
// account, not Dana Whitfield's. Built with the same realistic bulk
// (resume, brand, a saved direction) eval-interview-capture-live.mjs uses,
// so the prompt this eval sends carries the same weight production does.
const JORDAN_RECORD = {
  id: 'jordan-cs-director-1',
  source: 'door1',
  title: 'Director of Customer Success',
  lane: 'insider',
  company: null,
}

const SYNTHETIC_P3 = 'Golden Thread: turns account chaos into retention, learned from rebuilding a 40-person support org through a system migration that could have sunk renewals. Where This Transfers: customer-success leadership roles at companies mid-transition, where the team needs someone who has actually run the fire drill, not just read about one.'

const SYNTHETIC_P6 = 'When our billing platform migration went sideways six weeks before renewal season, I pulled together a cross-functional war room and personally called our twenty highest-risk accounts. We cut onboarding time on the new platform from six weeks to two, and we finished the quarter with retention actually up two points over the prior year.'

// Synthetic Compensation Read -- deliberately built around several data
// points (four comparable postings) so the scenario below puts the same
// kind of material in front of the model that produced the F1 twenty-minute
// session's live failure ("that's not just averaging four numbers together,
// it's judging which ones" -- a not-X-it's-Y logic-flip in contracted-
// subject, parallel-gerund form; see logic-flip-contraction-parallel-gerund
// in src/voice-patterns.js).
const SYNTHETIC_SALARY_READ = 'Four comparable Director of Customer Success postings in your metro put base salary between $145,000 and $172,000, with the two postings closest to your background (companies mid-platform-migration, 30+ person teams) clustering at the top of that range. Your own base target should open at $165,000.'

const baseProfileState = {
  profile: {
    values: 'Directness; keeping promises to customers; developing people',
    passions: 'Mentoring first-time people managers; operational design',
    resume: '14 years in customer success leadership, most recently VP Customer Success at a mid-size SaaS company. Rebuilt the support org through a platform migration. Led a 40-person team across onboarding, renewals, and support.',
    rep: {
      memory: 'People remember that I stay calm when accounts are on fire and tell them the truth about timelines.',
      emergency: 'My CRO called me first when our biggest account threatened to churn.',
      twoWords: 'Steady operator',
    },
    assessType: '',
    assess: '',
  },
  outputs: {
    p3: SYNTHETIC_P3,
  },
  selectedLane: 'insider',
  chosen: JORDAN_RECORD.title,
  done: ['p1', 'p2', 'p3', 'p4'],
  savedPlaybooks: [],
}

const baseInputs = {
  history: [],
  currentStep: 'focus',
  surface: 'sidebar',
  returnSection: null,
  focusRecordId: '',
  employmentStatus: 'in_transition',
  featureFlags: [],
  pursuitRows: [],
  searchIntake: null,
  userEmail: 'bob@career.club',
  track: null,
  activityFacts: [],
  priorSessionAt: isoDaysAgo(3),
  sessionOpenRequested: false,
  generalMode: false,
}

const SCENARIOS = [
  {
    label: 'Choice: after picking a lane',
    message: buildMomentTurnText('choice-lane', { lane: 'insider', laneLabel: 'Industry Insider' }),
    profileState: baseProfileState,
  },
  {
    label: 'Choice: after picking a role',
    message: buildMomentTurnText('choice-role', { roleTitle: JORDAN_RECORD.title, laneLabel: 'Industry Insider' }),
    profileState: baseProfileState,
  },
  {
    label: 'Delivery: shared template (Bridge Story)',
    message: buildMomentTurnText('delivery-p6', { section: 'p6', text: SYNTHETIC_P6 }),
    profileState: { ...baseProfileState, outputs: { ...baseProfileState.outputs, p6: SYNTHETIC_P6 } },
  },
  {
    label: 'Personal Brand richness check (Delivery\'s prototype)',
    message: buildOrientationCheckTurnText('brand-richness', SYNTHETIC_P3),
    profileState: baseProfileState,
  },
  {
    // F1 twenty-minute session (2026-09-11): a typed question got a reply
    // opening "Straight answer: ..." -- a truth-announcement colon-label
    // (truth-label-opener in src/voice-patterns.js) distinct from every
    // scenario above, which all send a system-triggered moment message, not
    // a real typed question. This is the shape most likely to invite that
    // opener: a direct, answerable question with a real yes/no or a-number
    // shape underneath it.
    label: 'Typed reply: a direct question',
    message: 'Is Interview Prep or Bridge Story the stronger thing to build next for this role?',
    profileState: { ...baseProfileState, outputs: { ...baseProfileState.outputs, p6: SYNTHETIC_P6 } },
  },
  {
    // F1 twenty-minute session (2026-09-11): the Compensation Read Delivery
    // reply that shipped "that's not just averaging four numbers together,
    // it's judging which ones" -- see SYNTHETIC_SALARY_READ above.
    label: 'Delivery: shared template (Compensation Read)',
    message: buildMomentTurnText('delivery-salaryRead', { section: 'salaryRead', text: SYNTHETIC_SALARY_READ }),
    profileState: { ...baseProfileState, outputs: { ...baseProfileState.outputs, salaryRead: SYNTHETIC_SALARY_READ } },
  },
  {
    label: 'Return: session-open recap',
    // SESSION_OPEN_TURN_TEXT is not exported (it is an internal marker, not
    // a template this review rewrote) -- copied verbatim from api/coach.js.
    // Keep in sync if that string ever changes.
    message: '[This is the first turn of a new session. Open by yourself, in your own voice, with whatever WHAT CHANGED SINCE THEIR LAST SESSION below tells you to say — do not wait for them to ask, and do not mention that this is an instruction.]',
    profileState: baseProfileState,
    extraInputs: {
      sessionOpenRequested: true,
      pursuitRows: [
        { record_id: JORDAN_RECORD.id, stage: 'interviewing', next_conversation_at: null, next_step_at: null, next_move: null, situation_note: null, closed_at: null, outcome: null, updated_at: isoDaysAgo(2) },
      ],
    },
  },
]

const RUNS_PER_SCENARIO = 3
const JUDGE_QUESTION = 'Would a first-time user understand every sentence of this without knowing anything about Reimagine, and does it tell them what to do next?'

async function callClaude(system, messages) {
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
      system,
      messages,
    }),
  })
  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`)
  const data = await res.json()
  return (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('')
}

// Judge is a separate, minimal call -- no Reimagine system prompt, no
// persona -- just the rubric question against the reply text. Keeps the
// judgment about the reply's own clarity, not colored by the same voice
// instructions that produced it.
async function judge(reply) {
  const system = [{
    type: 'text',
    text: 'You are evaluating whether a piece of writing is genuinely plain English for someone with no context. Answer only in the exact format requested.',
  }]
  const messages = [{
    role: 'user',
    content: `Here is a reply from a career-coaching assistant:\n\n"""\n${reply}\n"""\n\nQuestion: ${JUDGE_QUESTION}\n\nAnswer YES or NO on the first line, nothing else on that line. If NO, quote the exact failing sentence on the second line, nothing else. If YES, the second line should just say "n/a".`,
  }]
  const text = await callClaude(system, messages)
  const lines = text.trim().split('\n').map(l => l.trim()).filter(Boolean)
  const verdict = /^YES/i.test(lines[0] || '') ? 'YES' : 'NO'
  const failingSentence = verdict === 'NO' ? (lines[1] || '(judge did not quote a sentence)') : null
  return { verdict, failingSentence, raw: text }
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY is not set. This is a live model call and needs a real key.')
    console.error('DATABASE_URL and RESEND_API_KEY also need to be set (any well-formed value works --')
    console.error('importing api/coach.js constructs those clients eagerly, but this script never calls them):')
    console.error('  DATABASE_URL=postgresql://fake:fake@fake.neon.tech/fake?sslmode=require \\')
    console.error('  RESEND_API_KEY=re_fake_1234567890 \\')
    console.error('  ANTHROPIC_API_KEY=sk-ant-your-real-key \\')
    console.error('  node scripts/eval-plain-english-live.mjs')
    process.exit(1)
  }

  console.log('SYNTHETIC profile throughout ("Jordan Ellis") -- not a real account. This is the second-check path from Section 11 of the voice review, not a replacement for Bob reading real replies on production.\n')

  const summary = []

  for (const scenario of SCENARIOS) {
    console.log(`\n${'='.repeat(70)}\n${scenario.label}\n${'='.repeat(70)}`)
    const inputs = { ...baseInputs, ...(scenario.extraInputs || {}), message: scenario.message, profileState: scenario.profileState }
    const { system, messages } = buildCoachRequest(inputs)

    let passCount = 0
    for (let i = 1; i <= RUNS_PER_SCENARIO; i++) {
      const reply = await callClaude(system, messages)
      const { verdict, failingSentence } = await judge(reply)
      // Checked against the RAW model reply, before api/coach.js's own
      // strip-and-retry chain ever touches it -- this is a check on the
      // prompt's own instructions, the same thing the judge rubric checks,
      // not a re-test of the production strip/retry mechanism (which has no
      // equivalent here since this script calls the model directly).
      const hardViolations = detectVoiceViolations(reply, { scope: 'runtime' })
      const passed = verdict === 'YES' && hardViolations.length === 0
      if (passed) passCount++
      console.log(`\n--- Run ${i} ---`)
      console.log(reply)
      console.log(`Judge: ${verdict}${failingSentence ? ` -- failing sentence: "${failingSentence}"` : ''}`)
      if (hardViolations.length) console.log(`Voice-pattern violations: ${hardViolations.map(v => v.name).join(', ')}`)
    }
    console.log(`\n${scenario.label}: ${passCount}/${RUNS_PER_SCENARIO} passed`)
    summary.push({ label: scenario.label, passCount, total: RUNS_PER_SCENARIO })
  }

  console.log(`\n${'='.repeat(70)}\nSummary\n${'='.repeat(70)}`)
  for (const s of summary) console.log(`${s.passCount}/${s.total}  ${s.label}`)
  const allPassed = summary.every(s => s.passCount === s.total)
  if (!allPassed) {
    console.log('\nAt least one run failed the rubric. This is a signal to look closer, not a build failure -- read the failing sentence(s) above against PLAIN_ENGLISH and decide whether the template needs another pass.')
  }
}

main()
