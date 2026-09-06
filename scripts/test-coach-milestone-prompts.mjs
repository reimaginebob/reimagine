// Guards Milestone Prompts (2026-09-06), Phase 3 of
// Output/handoff/2026-09-06_coach-opportunity-playbook-proactive-signals.md.
// The only one of the three phases that captures nothing -- no trailer, no
// header, no tap -- because there is no content to write. Coach is told a
// bounded, four-item list of milestones (confirmed by Bob) and may mention
// the relevant unbuilt card once, in prose, when discussing a specific
// opportunity.
//
// Gated on its OWN flag (milestone_prompt), not a reuse of an existing one --
// unlike Phases 1/2, this is pure model judgment with no data write to check
// against, the riskiest of the three, so it gets its own rollout rather than
// riding along on an existing flag's staff-only pass/fail.
//
// v1 deliberately did NOT persist a cross-session "already mentioned" flag --
// that would have been the first mechanism in this system where a model
// signal writes state with no user tap behind it -- and instead told the
// model not to repeat itself within one conversation (it can see its own
// prior turns), accepting that a fresh conversation, or the same one once the
// history window drops the prior mention, might raise the same still-real gap
// again. This test guards that the in-conversation instruction below is still
// present; it does not assert the ABSENCE of durable memory, since
// scripts/eval-milestone-repeat-live.mjs went on to show the window gap was
// real and scripts/test-coach-milestone-durable-memory.mjs now guards the v2
// fix for it (a silent, DB-backed MILESTONEMENTIONED flag).
import fs from 'node:fs'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

const FLAGS = 'api/_lib/feature-flags.js'
const flags = fs.readFileSync(FLAGS, 'utf8')

check(flags.includes("export const MILESTONE_PROMPT_FLAG = 'milestone_prompt'"),
  `${FLAGS}: MILESTONE_PROMPT_FLAG is missing`)
check(/export function hasMilestonePrompt\(user\) \{\s*if \(isInternalAccount\(user\)\) return true/.test(flags),
  `${FLAGS}: hasMilestonePrompt does not auto-grant internal accounts like its sibling pilot flags`)
check(flags.includes("[MILESTONE_PROMPT_FLAG]: { label: 'Coach milestone prompts' }"),
  `${FLAGS}: MILESTONE_PROMPT_FLAG has no GRANTABLE_FLAGS entry, so it cannot be granted to a named outside tester from the admin dashboard`)

const COACH = 'api/coach.js'
const coach = fs.readFileSync(COACH, 'utf8')

check(/import \{[^}]*hasMilestonePrompt[^}]*\} from '\.\/_lib\/feature-flags\.js'/.test(coach),
  `${COACH}: hasMilestonePrompt is not imported`)

// The data gap this phase needed fixed: offerNegotiation (the generated
// analysis card) was invisible to Coach's WHAT IS BUILT listing -- a
// different field from offerStage.offer (the raw terms), which LOGGED
// OFFERS already covers.
check(/door2: \[.*'offerNegotiation'.*\]/.test(coach),
  `${COACH}: FOCUS_SECTIONS.door2 does not include offerNegotiation -- milestone #4 (offer imminent, no Offer & Negotiation content) has no data to check against without it`)
check(coach.includes("offerNegotiation: 'OFFER & NEGOTIATION'"),
  `${COACH}: SECTION_NAME has no label for offerNegotiation -- it would render as a raw key in WHAT IS BUILT ON THIS PLAYBOOK`)

// The instruction itself: the four confirmed conditions, bounded (not
// open-ended "watch for milestones"), real card names, and the in-conversation
// non-repeat instruction standing in for a persisted dismissal flag.
check(coach.includes('const MILESTONE_PROMPT_NOTE ='),
  `${COACH}: MILESTONE_PROMPT_NOTE is missing`)
const milestoneConditions = [
  'Cover Letter is not built',
  'Resume Refresh is not built',
  'Interview Prep is not built',
  'Offer & Negotiation has no content yet',
]
for (const cond of milestoneConditions) {
  check(coach.includes(cond), `${COACH}: MILESTONE_PROMPT_NOTE is missing the confirmed condition "${cond}"`)
}
check(coach.includes('never twice in this same conversation once you have already brought one up'),
  `${COACH}: MILESTONE_PROMPT_NOTE does not tell the model to avoid repeating itself within a conversation -- with no persisted dismissal flag, this is the only thing preventing it from mentioning the same gap every turn`)
check(coach.includes('never more than one in a single reply'),
  `${COACH}: MILESTONE_PROMPT_NOTE does not cap itself to one suggestion per reply, unlike every other capture note's "at most once per reply" discipline`)
check(coach.includes('You cannot build these for them or take them there yourself'),
  `${COACH}: MILESTONE_PROMPT_NOTE does not reaffirm that Coach stays prose-only (no NAVIGATE mechanism, CLAUDE.md §6)`)

// Gating: its own flag, computed and spliced the same shape as the other
// capture notes -- NOT gated on sightOn (hasNextStep), which is a different,
// unrelated pilot flag that happens to share this function; its data
// dependency (WHAT IS BUILT ON THIS PLAYBOOK) comes from the in-focus record
// via buildPlaybookExpansion, not from sightOn's own focusData/myStatusData.
check(/const milestonePromptNote = hasMilestonePrompt\(\{ feature_flags: featureFlags, email: userEmail \}\) \? MILESTONE_PROMPT_NOTE : ''/.test(coach),
  `${COACH}: milestonePromptNote is not gated on hasMilestonePrompt alone -- it must not depend on sightOn (hasNextStep), a different pilot's flag`)
const profileTemplateMatch = coach.match(/return `THIS USER'S REIMAGINE PROFILE[\s\S]*?`\n\}/)
check(!!profileTemplateMatch && profileTemplateMatch[0].includes('${milestonePromptNote}'),
  `${COACH}: milestonePromptNote is not spliced into the profile block template`)

// No client-side surface at all: this phase captures nothing, so nothing in
// Chat.jsx or App.jsx should reference it.
const CHAT = fs.readFileSync('src/components/Chat.jsx', 'utf8')
const APP = fs.readFileSync('src/App.jsx', 'utf8')
check(!CHAT.includes('milestone') && !CHAT.toLowerCase().includes('milestoneprompt'),
  'src/components/Chat.jsx: should not reference milestone prompts -- this phase has no trailer, no header, and no tap to render')
check(!APP.includes('MILESTONEPROMPT') && !/checkinKey==='milestone/.test(APP),
  'src/App.jsx: should not have a milestone-prompt quick-reply handler -- this phase has no data write')

if (failures) {
  console.error(`test-coach-milestone-prompts: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-coach-milestone-prompts: OK (own flag with dashboard entry, offerNegotiation visibility gap fixed, all 4 confirmed conditions present, bounded and prose-only with no persisted state, gated correctly and independent of the unrelated sightOn/hasNextStep flag)')
}
