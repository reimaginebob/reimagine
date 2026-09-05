// Guards the 2026-09-05 stage-vocabulary rename (In Conversation retired for
// Phone Screen / Final Round) across all six places the vocabulary is
// independently duplicated, plus the one-time backfill migration for
// existing In Conversation rows. Source-level: this needs a real DB and a
// real build to exercise end to end.
import fs from 'node:fs'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

const NEW_STAGES = ['researching', 'applied', 'phone_screen', 'interviewing', 'final_round', 'offer', 'closed']

// 1. src/App.jsx -- PURSUIT_STAGES, the source of truth for the dropdown and
// the quick-reply labels (both derived from it, so no separate check needed).
const APP = 'src/App.jsx'
const app = fs.readFileSync(APP, 'utf8')
check(!app.includes("{value:'in_conversation'"),
  `${APP}: PURSUIT_STAGES still carries the retired in_conversation stage`)
check(app.includes("{value:'phone_screen',label:'Phone Screen'}") && app.includes("{value:'final_round',label:'Final Round'}"),
  `${APP}: PURSUIT_STAGES is missing phone_screen and/or final_round`)

// 2. src/step-position.js -- STAGE_STEP, mapping a stage onto the Staircase.
const STEP = 'src/step-position.js'
const step = fs.readFileSync(STEP, 'utf8')
check(!step.includes('in_conversation'),
  `${STEP}: STAGE_STEP still references the retired in_conversation stage`)
check(/const STAGE_STEP = \{[^}]*phone_screen: 3[^}]*\}/.test(step) && /const STAGE_STEP = \{[^}]*final_round: 4[^}]*\}/.test(step),
  `${STEP}: STAGE_STEP is missing phone_screen:3 and/or final_round:4`)

// 3. api/coach.js -- the STAGE label map Coach's own prose reads from.
const COACH = 'api/coach.js'
const coach = fs.readFileSync(COACH, 'utf8')
check(!coach.includes('in_conversation'),
  `${COACH}: the STAGE label map still references the retired in_conversation stage`)
check(coach.includes("phone_screen: 'Phone Screen'") && coach.includes("final_round: 'Final Round'"),
  `${COACH}: the STAGE label map is missing Phone Screen and/or Final Round`)

// 4 & 5. api/pursuit-status.js and api/mcp.js -- the two independently
// duplicated write-validation sets. Both must move together or one write
// path silently accepts a stage the other rejects.
for (const f of ['api/pursuit-status.js', 'api/mcp.js']) {
  const src = fs.readFileSync(f, 'utf8')
  check(!src.includes('in_conversation'),
    `${f}: VALID_STAGES still references the retired in_conversation stage`)
  check(NEW_STAGES.every(s => src.includes(`'${s}'`)),
    `${f}: VALID_STAGES is missing one or more of the current stage values`)
}

// 6. src/GrowthDashboard.jsx -- Bob's own admin Growth tab.
const GROWTH = 'src/GrowthDashboard.jsx'
const growth = fs.readFileSync(GROWTH, 'utf8')
check(!growth.includes('in_conversation'),
  `${GROWTH}: STAGE_LABELS/STAGE_LADDER still reference the retired in_conversation stage`)
check(growth.includes('phone_screen: "Phone Screen"') && growth.includes('final_round: "Final Round"'),
  `${GROWTH}: STAGE_LABELS is missing Phone Screen and/or Final Round`)
check(/const STAGE_LADDER = \[[^\]]*"phone_screen"[^\]]*"final_round"[^\]]*\]/.test(growth),
  `${GROWTH}: STAGE_LADDER is missing phone_screen and/or final_round, or they are out of order`)

// The backfill migration: forward-only, idempotent, and dated after every
// other pursuit_status migration so it actually runs after the table exists.
const MIGRATIONS_DIR = 'migrations'
const migrationFiles = fs.readdirSync(MIGRATIONS_DIR).filter(f => f.endsWith('.sql'))
const backfill = migrationFiles.find(f => f.includes('pursuit-stage-vocabulary'))
check(!!backfill, `${MIGRATIONS_DIR}: the in_conversation backfill migration is missing`)
if (backfill) {
  const sql = fs.readFileSync(`${MIGRATIONS_DIR}/${backfill}`, 'utf8')
  check(/UPDATE pursuit_status SET stage = 'applied'.*WHERE stage = 'in_conversation'/s.test(sql),
    `${MIGRATIONS_DIR}/${backfill}: does not backfill in_conversation rows to applied`)
}

if (failures) {
  console.error(`test-pipeline-stage-vocabulary: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-pipeline-stage-vocabulary: OK (all six vocabulary sites renamed consistently, backfill migration present)')
}
