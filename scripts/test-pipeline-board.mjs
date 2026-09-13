// Guards the pipeline board (2026-09-05, pilot: pipeline_board) -- the
// equal-width, gold-intensity-gradient summary rendered above the existing
// editable My Pipeline list. Source-level: this needs a real signed-in
// browser session to exercise end to end.
import fs from 'node:fs'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

const FLAGS = 'api/_lib/feature-flags.js'
const flags = fs.readFileSync(FLAGS, 'utf8')
check(!flags.includes('PIPELINE_BOARD_FLAG'),
  `${FLAGS}: PIPELINE_BOARD_FLAG should be gone -- this pilot went GA 2026-09-13`)
check(/export function hasPipelineBoard\(user\) \{\s*return !!user\s*\}/.test(flags),
  `${FLAGS}: hasPipelineBoard should be a plain !!user check post-GA`)
check(!flags.includes("[PIPELINE_BOARD_FLAG]"),
  `${FLAGS}: GRANTABLE_FLAGS should no longer carry an entry for the pipeline board -- it is not a grantable pilot anymore`)

const APP = 'src/App.jsx'
const app = fs.readFileSync(APP, 'utf8')

// Post-GA: plain signed-in check, no feature_flags round-trip, same pattern
// as hasPipeline's own GA (2026-08-30).
check(app.includes('const hasPipelineBoard=!!signedInUser'),
  `${APP}: the client-side hasPipelineBoard mirror should be a plain !!signedInUser check post-GA`)

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
