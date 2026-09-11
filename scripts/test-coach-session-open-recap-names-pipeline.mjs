// F1 twenty-minute session, item 2: the session-open recap went stateless on
// a flagged account with three pipeline records. Observed: "Hi Lindsey — how
// are you doing today? Is there something specific you want to dig into, or
// would you like me to point to what's live in your search right now?" --
// naming none of the three records. Root cause: sessionOpenNote's own
// instruction, when nothing had changed since the last session
// (!delta.hasMaterialChange), told the model to "skip a status line
// entirely" -- correct when the pipeline itself is empty, wrong when it has
// real records sitting there unmentioned. The target shape (already
// produced elsewhere) is "Nothing's changed in your pipeline since we last
// talked, so HOPE, Deloitte, and Imerys are all right where you left them."
//
// Fix: computeSessionDelta (src/step-position.js) now also returns
// openTitles -- the currently-open opportunities' titles, independent of
// whether anything changed. sessionOpenNote (api/coach.js) adds them to the
// facts block and, in the no-material-change branch, instructs the model to
// name them instead of skipping the status line -- reserving "skip
// entirely" for the one case where there is genuinely nothing open to name.
import fs from 'node:fs'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

const NOW = Date.parse('2026-09-11T12:00:00Z')
const ago = (days) => new Date(NOW - days * 86400000).toISOString()
const sinceT = ago(3)

const { computeSessionDelta } = await import('../src/step-position.js')

const opp = (id, title, extra = {}) => ({ id, title, source: 'door2', createdAt: ago(30), ...extra })
const row = (id, extra = {}) => ({ record_id: id, stage: 'researching', updated_at: ago(30), ...extra })

// 1. Behavioral: three long-standing, unchanged opportunities -- the exact
// shape of the production report (HOPE, Deloitte, Imerys, nothing moved).
{
  const state = { savedPlaybooks: [opp('a', 'HOPE'), opp('b', 'Deloitte'), opp('c', 'Imerys')] }
  const rows = [row('a'), row('b'), row('c')]
  const d = computeSessionDelta(state, rows, [], sinceT, NOW)
  check(d.hasMaterialChange === false, 'computeSessionDelta: three unchanged opportunities should not read as a material change')
  check(Array.isArray(d.openTitles) && d.openTitles.length === 3, `computeSessionDelta: openTitles should list all 3 currently-open opportunities regardless of whether anything changed (got ${JSON.stringify(d.openTitles)})`)
  check(['HOPE', 'Deloitte', 'Imerys'].every(t => d.openTitles.includes(t)),
    `computeSessionDelta: openTitles should name HOPE, Deloitte, and Imerys specifically (got ${JSON.stringify(d.openTitles)})`)
}

// 2. Behavioral: a genuinely empty pipeline has nothing to name.
{
  const state = { savedPlaybooks: [] }
  const d = computeSessionDelta(state, [], [], sinceT, NOW)
  check(Array.isArray(d.openTitles) && d.openTitles.length === 0, 'computeSessionDelta: an empty pipeline should return an empty openTitles list, not throw or fabricate one')
}

// 3. Wiring: sessionOpenNote (api/coach.js) actually uses openTitles and no
// longer unconditionally tells the model to skip the status line whenever
// nothing changed.
const COACH = 'api/coach.js'
const coach = fs.readFileSync(COACH, 'utf8')
const noteIdx = coach.indexOf('const sessionOpenNote = (sightOn && sessionOpenRequested)')
check(noteIdx !== -1, `${COACH}: could not find sessionOpenNote`)
const noteBlock = noteIdx !== -1 ? coach.slice(noteIdx, noteIdx + 3200) : ''
check(noteBlock.includes('delta.openTitles.length'),
  `${COACH}: sessionOpenNote no longer branches on delta.openTitles.length`)
check(noteBlock.includes('Currently open, unchanged since last time:'),
  `${COACH}: sessionOpenNote no longer adds the currently-open-unchanged line to the facts block`)
check(noteBlock.includes('name what is still open, by name'),
  `${COACH}: sessionOpenNote no longer instructs the model to name the open records when nothing changed`)
// The old unconditional "skip a status line entirely" for EVERY no-material-
// change case must be gone -- it must now be reachable only when openTitles
// is also empty (nothing open at all).
check(!/hasMaterialChange \? [^:]+ : 'Nothing changed, so skip a status line entirely/.test(noteBlock),
  `${COACH}: the old unconditional "skip a status line entirely" branch (fired even with real, unchanged records in the pipeline) is still present`)
check(noteBlock.includes("Nothing is open yet either, so skip a status line entirely"),
  `${COACH}: the genuinely-empty-pipeline case should still skip the status line -- there is nothing to name there`)

if (failures) {
  console.error(`test-coach-session-open-recap-names-pipeline: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-coach-session-open-recap-names-pipeline: OK (computeSessionDelta names the currently-open pipeline regardless of whether anything changed, and sessionOpenNote now names those records in the recap instead of going stateless -- reserving silence for a genuinely empty pipeline)')
}
