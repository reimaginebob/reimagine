#!/usr/bin/env node
// LIVE model probe, NOT a build gate. Tests the one thing MILESTONE_PROMPT_NOTE
// (api/coach.js) actually relies on to avoid nagging, since it deliberately has
// no persisted "already mentioned" flag: an instruction telling the model not
// to repeat a milestone suggestion within one conversation, trusting the
// model's own view of its prior turns. That trust has a hard edge -- the
// server only ever sends the last 50 messages (history.slice(-50), raised
// from 10 on 2026-09-06) -- so a mention old enough to fall outside that
// window is, structurally, invisible to the model making the next reply.
//
// Two scenarios, same underlying fact (an Acme Corp opportunity past the
// applied stage with no Cover Letter built), same final probe message:
//
//   A. IN-WINDOW  -- Coach's own prior "you could build a Cover Letter for
//      this" mention sits early in a SHORT history, comfortably inside the
//      50-message slice. Tests whether the "never twice in this
//      conversation" instruction actually holds when the model CAN see it
//      already said this.
//   B. OUT-OF-WINDOW -- the identical prior mention sits at the very start of
//      a LONG history, past position 50, so slice(-50) drops it before the
//      model ever sees it this turn. Tests the known gap directly instead of
//      only reasoning about it.
//
// Importing api/coach.js pulls in two module-scope service clients that
// construct eagerly (neon() for Postgres, new Resend() for email) and throw
// at import time if their env vars are missing entirely -- neither is ever
// actually called by buildCoachRequest itself, so DATABASE_URL and
// RESEND_API_KEY only need to be present and well-formed, not real.
// ANTHROPIC_API_KEY has to be a real, working key, since this script makes
// real calls with it.
//
// Usage:
//   DATABASE_URL=postgresql://fake:fake@fake.neon.tech/fake?sslmode=require \
//   RESEND_API_KEY=re_fake_1234567890 \
//   ANTHROPIC_API_KEY=sk-ant-your-real-key \
//   node scripts/eval-milestone-repeat-live.mjs

import { buildCoachRequest } from '../api/coach.js'

const TODAY = new Date()
const isoDaysAgo = n => new Date(TODAY.getTime() - n * 86400000).toISOString().slice(0, 10)

// Applied, no Cover Letter -- milestone #1 from the confirmed four-item list.
// p_res is given content deliberately, so only the Cover Letter gap can
// trigger the instruction; nothing here should read as an interview
// confirmation or an offer signal, so milestones #2-4 stay silent and any
// mention of Cover Letter in the reply is attributable to this one condition.
const ACME_RECORD = {
  id: 'acme-pm-1',
  source: 'door2',
  title: 'Acme Corp, Program Manager',
  company: 'Acme Corp',
  jd: 'Program Manager, Customer Operations. Own the roadmap for a cross-functional operations program, partner with Sales and Support leadership, and report progress to the VP of Operations.',
  panel: { opportunity_context: '', interviewers: [] },
  sections: {
    p_res: { content: 'Repositioned Summary: operations leader who has run cross-functional programs end to end...', builtAt: isoDaysAgo(5) },
  },
}

const profileState = {
  profile: {
    values: 'Follow-through; clarity; steady hands under pressure',
    passions: 'Process design; mentoring new PMs',
    resume: '11 years in program and operations management across two SaaS companies. Ran the cross-functional rollout of a new support ticketing system end to end.',
    rep: {
      memory: 'People say I make chaos boring -- in a good way.',
      emergency: 'My VP called me first when a client escalation blew up over a holiday weekend.',
      twoWords: 'Steady hands',
    },
    assessType: '',
    assess: '',
  },
  outputs: {
    p3: 'Golden Thread: turns cross-functional chaos into a program that runs itself. Where This Transfers: operations roles that need someone who has actually run the program, not just managed the plan.',
  },
  selectedLane: 'specific',
  chosen: 'Operations & Program Management',
  done: ['p1', 'p2', 'p3', 'p4', 'p5'],
  savedPlaybooks: [ACME_RECORD],
}

const pursuitRows = [
  { record_id: ACME_RECORD.id, stage: 'applied', next_conversation_at: null, next_step_at: null, next_move: null, situation_note: null, closed_at: null, outcome: null, updated_at: isoDaysAgo(9) },
]

const COACH_COVER_LETTER_MENTION = "Since you're past applied on Acme now, building a Cover Letter for this one could be worth doing when you have a few minutes -- want to take a look at that sometime?"

// Filler exchanges: ordinary, unrelated coaching turns, long enough in total
// (with COUNT set per scenario below) to push the Cover Letter mention out of
// a 50-message window without the padding itself looking synthetic or
// leading. Cycles through a few different unrelated topics.
const FILLER_TOPICS = [
  ['Can we work on my LinkedIn headline?', "Sure -- what's the headline say right now, and what do you want someone to conclude about you in the two seconds they spend reading it?"],
  ['I also have a Northwind Traders opportunity, still researching it.', "Good to know -- when you're ready to dig into Northwind, the About This Company card is the fastest way to get a real read before you invest more time."],
  ['How should I talk about the support ticketing rollout in an interview?', 'Start with the decision that was actually hard, not the outcome -- what did you have to choose between, and why did you choose what you chose?'],
  ["I'm not sure my resume leads with the right story.", "What's the first accomplishment it lists right now, and is that the one you'd actually pick if you could only tell one story?"],
  ['Someone told me my LinkedIn About section is too long.', "Long isn't automatically bad -- what's it doing in the first two sentences? That's the part that decides whether the rest gets read."],
]

function buildFillerMessages(pairCount) {
  const out = []
  for (let i = 0; i < pairCount; i++) {
    const [u, a] = FILLER_TOPICS[i % FILLER_TOPICS.length]
    out.push({ role: 'user', content: u })
    out.push({ role: 'assistant', content: a })
  }
  return out
}

// A natural way back into the Acme conversation that does NOT itself ask
// about the Cover Letter -- so any mention of it in the reply is Coach
// volunteering the milestone suggestion again, not just answering a direct
// question about it.
const PROBE_MESSAGE = "Okay, switching back to Acme -- how should I answer if they ask why I want to work there specifically?"

function buildScenario(pairCountBeforeMention, pairCountAfterMention) {
  const before = buildFillerMessages(pairCountBeforeMention)
  const mentionIndex = before.length // index of the "I applied..." user turn
  const messages = [
    ...before,
    { role: 'user', content: "I applied to the Acme Corp Program Manager role last week." },
    { role: 'assistant', content: COACH_COVER_LETTER_MENTION },
    { role: 'user', content: "Maybe later -- can we talk about something else for now?" },
    ...buildFillerMessages(pairCountAfterMention),
  ]
  return { messages, mentionIndex }
}

// IN-WINDOW: mention + a handful of filler pairs, total history well under 50
// -- the mention is still inside slice(-50) when the probe is sent.
const HISTORY_IN_WINDOW = buildScenario(1, 6)
// OUT-OF-WINDOW: same mention, but pushed behind ~30 filler pairs (60+
// messages) so slice(-50) drops everything up to and including the mention.
const HISTORY_OUT_OF_WINDOW = buildScenario(1, 30)

const baseInputs = {
  currentStep: 'myCoach',
  surface: 'help',
  returnSection: null,
  focusRecordId: ACME_RECORD.id,
  profileState,
  employmentStatus: 'in_transition',
  // @career.club auto-grants every pilot flag (isInternalAccount), including
  // milestone_prompt -- the same real gate a flagged account is checked
  // against, not a hand-picked featureFlags list.
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

const COVER_LETTER_RE = /cover letter/i

async function runScenario(label, { messages: history, mentionIndex }) {
  const { system, messages } = buildCoachRequest({ ...baseInputs, history, message: PROBE_MESSAGE })
  const sentHistoryCount = messages.length - 1 // minus the probe turn itself
  const droppedCount = history.length - sentHistoryCount
  // The Cover Letter mention itself is at mentionIndex + 1 (the assistant
  // turn right after the "I applied..." user turn); it survives slice(-50)
  // iff that index is at or past what got dropped from the front.
  const mentionSurvives = (mentionIndex + 1) >= droppedCount
  console.log(`\n### ${label} ###`)
  console.log(`Full synthetic history: ${history.length} messages. Sent to the model after slice(-50): ${sentHistoryCount}. Prior Cover Letter mention still in what's sent: ${mentionSurvives ? 'yes' : 'no -- dropped by the window'}`)

  const RUNS = 5
  let mentioned = 0
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
        max_tokens: 4000,
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
    const hit = COVER_LETTER_RE.test(text)
    if (hit) mentioned++
    console.log(`\n--- Run ${i} (${hit ? 'REPEATED Cover Letter mention' : 'no repeat'}) ---`)
    console.log(text)
  }
  console.log(`\n${label} summary: repeated the Cover Letter suggestion in ${mentioned}/${RUNS} runs.`)
  return mentioned
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY is not set. This is a live model call and needs a real key.')
    console.error('DATABASE_URL and RESEND_API_KEY also need to be set (any well-formed value works --')
    console.error('importing api/coach.js constructs those clients eagerly, but this script never calls them):')
    console.error('  DATABASE_URL=postgresql://fake:fake@fake.neon.tech/fake?sslmode=require \\')
    console.error('  RESEND_API_KEY=re_fake_1234567890 \\')
    console.error('  ANTHROPIC_API_KEY=sk-ant-your-real-key \\')
    console.error('  node scripts/eval-milestone-repeat-live.mjs')
    process.exit(1)
  }

  const inWindowHits = await runScenario('A. IN-WINDOW (mention should still be visible)', HISTORY_IN_WINDOW)
  const outOfWindowHits = await runScenario('B. OUT-OF-WINDOW (mention pushed past the 50-message slice)', HISTORY_OUT_OF_WINDOW)

  console.log('\n=== Overall ===')
  console.log(`In-window repeats:     ${inWindowHits}/5`)
  console.log(`Out-of-window repeats: ${outOfWindowHits}/5`)
  if (inWindowHits > 0) {
    console.log('\nThe "never twice in this conversation" instruction did NOT reliably hold even with the prior mention still visible in what was sent -- this is a real compliance gap, not just the known window limitation, and is worth tightening in MILESTONE_PROMPT_NOTE directly.')
  } else if (outOfWindowHits > inWindowHits) {
    console.log('\nExpected pattern: the instruction holds when the model can actually see its own prior turn, and repeats once that turn falls outside the window. This confirms the window is the mechanism, not a flaw in the instruction itself -- the fix for THIS gap is durable memory (a persisted flag or structured capture), not a stricter prompt.')
  } else {
    console.log('\nOut-of-window did not show more repeats than in-window at this sample size -- five runs per scenario is a small sample; worth more runs before concluding either way.')
  }
}

main()
