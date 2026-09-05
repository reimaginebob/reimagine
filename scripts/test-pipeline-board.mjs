// Guards the pipeline board (2026-09-05, pilot: pipeline_board) -- the
// equal-width, gold-intensity-gradient summary rendered above the existing
// editable My Pipeline list. Source-level: this needs a real signed-in
// browser session to exercise end to end.
import fs from 'node:fs'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

const FLAGS = 'api/_lib/feature-flags.js'
const flags = fs.readFileSync(FLAGS, 'utf8')
check(flags.includes("export const PIPELINE_BOARD_FLAG = 'pipeline_board'"),
  `${FLAGS}: PIPELINE_BOARD_FLAG is missing`)
check(/export function hasPipelineBoard\(user\) \{\s*if \(isInternalAccount\(user\)\) return true/.test(flags),
  `${FLAGS}: hasPipelineBoard is missing or does not auto-grant internal (@career.club) accounts`)
check(flags.includes('[PIPELINE_BOARD_FLAG]: { label:'),
  `${FLAGS}: PIPELINE_BOARD_FLAG is not listed in GRANTABLE_FLAGS -- an outside tester could never be granted it from the admin dashboard`)

const APP = 'src/App.jsx'
const app = fs.readFileSync(APP, 'utf8')

// Client-side mirror: same internal-email regex + feature_flags check as its
// siblings (hasNextStep, hasOnboardingConcierge), not a server round-trip.
check(app.includes("signedInUser.feature_flags.includes('pipeline_board')"),
  `${APP}: the client-side hasPipelineBoard mirror is missing`)

// The board itself: gated on the flag, additive (never replaces the existing
// list), grouped into the six stage columns (closed excluded), each card a
// click-through to the same record-opening path the rest of the screen uses.
check(app.includes('const boardEl=(hasPipelineBoard&&activeList.length)'),
  `${APP}: the pipeline board is not gated on hasPipelineBoard and a non-empty active pipeline`)
const boardColsIdx = app.indexOf('const boardCols=[')
check(boardColsIdx !== -1, `${APP}: boardCols (the six stage columns) is missing`)
const boardColsBlock = boardColsIdx !== -1 ? app.slice(boardColsIdx, boardColsIdx + 700) : ''
for (const stage of ['researching', 'applied', 'phone_screen', 'interviewing', 'final_round', 'offer']) {
  check(boardColsBlock.includes(`value:'${stage}'`), `${APP}: boardCols is missing the ${stage} column`)
}
check(!boardColsBlock.includes("value:'closed'"),
  `${APP}: boardCols should not include a closed column -- the board shows live opportunities only`)
check(app.includes("onClick={()=>openPursuitRecord(rec,'op')}") ,
  `${APP}: the board's cards no longer open the record via openPursuitRecord, the same path the rest of the screen uses`)
check(app.includes('Nothing here yet'),
  `${APP}: an empty board column lost its placeholder`)
check(app.includes("{boardEl}"),
  `${APP}: boardEl is computed but never spliced into mySearchPanel's returned JSX`)

if (failures) {
  console.error(`test-pipeline-board: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-pipeline-board: OK (flag + GRANTABLE_FLAGS entry, client mirror, six-column board gated and wired, cards open via the existing record path)')
}
