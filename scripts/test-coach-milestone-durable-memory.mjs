// Guards Milestone Prompts v2 (2026-09-06): the durable "already mentioned"
// memory added after scripts/eval-milestone-repeat-live.mjs (PR #758/#759)
// showed the v1 in-conversation-only instruction failed exactly at the edge
// its own comment predicted -- 0/5 repeats while the model's prior mention
// was still inside the 50-message history window, 5/5 once it aged out.
//
// v2 is a fully silent, server-only mechanism: no client capture, no header,
// no tap (scripts/test-coach-milestone-prompts.mjs already guards that
// Chat.jsx/App.jsx stay untouched). A MILESTONEMENTIONED: <key> trailer is
// parsed and stripped like SELFCHECK, then written to a dedicated table; the
// next request for that opportunity -- this conversation or a new one --
// reads it back and folds it into the prompt as a suppression block.
import fs from 'node:fs'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

const MIGRATIONS = fs.readdirSync('migrations').filter(f => f.endsWith('.sql'))
const migrationFile = MIGRATIONS.find(f => f.includes('coach-milestone-mentions'))
check(!!migrationFile, 'migrations/: no coach-milestone-mentions migration found')
if (migrationFile) {
  const mig = fs.readFileSync(`migrations/${migrationFile}`, 'utf8')
  check(/CREATE TABLE IF NOT EXISTS coach_milestone_mentions/.test(mig),
    `migrations/${migrationFile}: does not create coach_milestone_mentions`)
  check(/PRIMARY KEY \(user_id, record_id, milestone\)/.test(mig),
    `migrations/${migrationFile}: primary key is not (user_id, record_id, milestone) -- one row per opportunity per milestone is the whole point`)
  check(/REFERENCES users\(id\) ON DELETE CASCADE/.test(mig),
    `migrations/${migrationFile}: user_id should FK to users(id) ON DELETE CASCADE, matching pursuit_status and user_activity_facts`)
}

const COACH = 'api/coach.js'
const coach = fs.readFileSync(COACH, 'utf8')

// The four-key enum, used both to build the ALREADY GIVEN block and to
// validate the trailer before it is ever written.
check(coach.includes("const MILESTONE_KEYS = ['coverLetter', 'resumeRefresh', 'interviewPrep', 'offerNegotiation']"),
  `${COACH}: MILESTONE_KEYS enum is missing or has drifted from the four confirmed milestones`)
check(coach.includes('coverLetter: \'Cover Letter\'') || coach.includes('coverLetter: "Cover Letter"'),
  `${COACH}: MILESTONE_LABEL map is missing`)

// The instruction: tells the model to check the ALREADY GIVEN block and to
// emit the silent trailer whenever it raises one of the four.
check(coach.includes('MILESTONE PROMPTS ALREADY GIVEN'),
  `${COACH}: MILESTONE_PROMPT_NOTE does not reference the ALREADY GIVEN suppression block`)
check(coach.includes('never raise one listed there again, in this conversation or any later one, unless they ask about it directly'),
  `${COACH}: MILESTONE_PROMPT_NOTE does not tell the model the ALREADY GIVEN list applies beyond just this conversation`)
check(coach.includes('MILESTONEMENTIONED: coverLetter'),
  `${COACH}: MILESTONE_PROMPT_NOTE does not show the model the MILESTONEMENTIONED trailer shape`)
check(coach.includes('This line is never shown to them, never mentioned, and writes nothing they need to confirm'),
  `${COACH}: MILESTONE_PROMPT_NOTE does not tell the model this trailer is fully silent (no tap, unlike every other capture note)`)

// buildAlreadyMentionedBlock: renders the per-record suppression text fed
// back into the prompt.
check(coach.includes('function buildAlreadyMentionedBlock(recordId, milestoneMentions)'),
  `${COACH}: buildAlreadyMentionedBlock is missing`)
check(/profileBlock \+= buildAlreadyMentionedBlock\(inFocus\.id, milestoneMentions\)/.test(coach),
  `${COACH}: the in-focus block does not splice buildAlreadyMentionedBlock's output into profileBlock`)

// buildCoachRequest: accepts milestoneMentions in, returns inFocusRecordId out
// -- both needed by the handler to read history in and write a new mention
// back out, scoped to the SAME record the prompt was actually built for
// (not re-derived, which could drift from what buildCoachRequest resolved).
check(/export function buildCoachRequest\(\{[\s\S]{0,400}generalMode, milestoneMentions,[\s\S]{0,60}\}\) \{/.test(coach),
  `${COACH}: buildCoachRequest does not accept milestoneMentions as a parameter`)
check(coach.includes("return { system, messages, hasPersonalBrand, hasResume, lane, sectionReworkLabel, inFocusRecordId }"),
  `${COACH}: buildCoachRequest does not return inFocusRecordId`)
check(/let inFocusRecordId = null[\s\S]{0,600}inFocusRecordId = inFocus\.id/.test(coach),
  `${COACH}: inFocusRecordId is not set from the resolved in-focus record`)

// Handler: reads existing mentions gated on the same flag as the note itself,
// passes them into buildCoachRequest, and writes a new one back after the
// reply is sent.
check(/hasMilestonePrompt\(\{ feature_flags: featureFlags, email: user\.email \}\)\) \{\s*try \{\s*milestoneMentions = await sql`SELECT record_id, milestone FROM coach_milestone_mentions WHERE user_id = \$\{user\.id\}`/.test(coach),
  `${COACH}: milestoneMentions is not read from coach_milestone_mentions, gated on hasMilestonePrompt`)
check(/generalMode, milestoneMentions,[\s\S]{0,30}\}\)/.test(coach),
  `${COACH}: milestoneMentions is not passed into the buildCoachRequest call site`)
check(/const mmMatch = strippedText\.match\(\/\^\\s\*MILESTONEMENTIONED:\\s\*\(\\w\+\)\\s\*\$\/im\)/.test(coach),
  `${COACH}: the MILESTONEMENTIONED trailer is not parsed`)
check(coach.includes('if (MILESTONE_KEYS.includes(mmMatch[1])) milestoneMentionedKey = mmMatch[1]'),
  `${COACH}: a parsed MILESTONEMENTIONED value is not validated against MILESTONE_KEYS before use`)
check(/if \(milestoneMentionedKey && inFocusRecordId\) \{\s*try \{\s*await sql`\s*INSERT INTO coach_milestone_mentions/.test(coach),
  `${COACH}: a validated MILESTONEMENTIONED key is not persisted to coach_milestone_mentions`)
check(coach.includes('ON CONFLICT (user_id, record_id, milestone) DO NOTHING'),
  `${COACH}: the milestone-mention insert is not idempotent (ON CONFLICT DO NOTHING) -- a repeated trailer for something already logged should not error`)

// Still fully silent -- no client-side surface, same invariant
// test-coach-milestone-prompts.mjs already checks for v1, re-asserted here
// since this is the file most likely to grow one by accident.
const CHAT = fs.readFileSync('src/components/Chat.jsx', 'utf8')
const APP = fs.readFileSync('src/App.jsx', 'utf8')
check(!CHAT.toLowerCase().includes('milestonementioned'),
  'src/components/Chat.jsx: should not reference MILESTONEMENTIONED -- this is a server-only, silent trailer with no client capture')
check(!APP.toLowerCase().includes('milestonementioned'),
  'src/App.jsx: should not reference MILESTONEMENTIONED -- this is a server-only, silent trailer with no client capture')

if (failures) {
  console.error(`test-coach-milestone-durable-memory: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-coach-milestone-durable-memory: OK (coach_milestone_mentions migration present, silent trailer parsed and validated against the 4-key enum, persisted idempotently, read back and fed in as a per-opportunity suppression block, no client-side surface)')
}
