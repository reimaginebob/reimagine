// Coach-as-Concierge Phase 4 Part 2 (Output/handoff/2026-09-09_concierge-
// batch-and-phase4-brief.md, §2.6): the widen-the-search engine -- snooze
// dates, pacing, rotation, and the twenty-one-day "Not for me" retirement.
// Pure module, no App.jsx/catalog wiring yet (that's the next PR); this
// only has to prove the machinery itself is correct.
import {
  WIDEN_SNOOZE_DAYS,
  WIDEN_RETIRE_DAYS,
  WIDEN_ORDER_DEFAULT,
  WIDEN_ORDER_THIN,
  emptyWidenSearchState,
  isWidenSearchRowSnoozed,
  isWidenSearchRowRetired,
  isWidenSearchRowEligible,
  snoozeWidenSearchRow,
  retireWidenSearchRow,
  pickNextWidenSearchRow,
  pickWidenSearchRowForPipeline,
  widenSearchCandidateKeys,
} from '../src/widen-search.js'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

const ROWS = ['recruiters', 'linkedin-contacts', 'networking-groups', 'career-club-corner', 'income-now']
const NOW = new Date('2026-09-12T12:00:00.000Z')
const days = (n) => n * 86400000

check(WIDEN_SNOOZE_DAYS === 5, 'WIDEN_SNOOZE_DAYS is the five-day floor from §2.6')
check(WIDEN_RETIRE_DAYS === 21, 'WIDEN_RETIRE_DAYS is the twenty-one-day retirement from §2.6')
check(Object.keys(emptyWidenSearchState()).length === 0, 'emptyWidenSearchState starts empty')

// --- Snooze: five days, a floor not a ceiling (still blocks an
// unprompted pick, but the row keeps its own identity in state rather
// than disappearing) ---
{
  let state = emptyWidenSearchState()
  check(!isWidenSearchRowSnoozed(state, 'recruiters', NOW), 'an untouched row is not snoozed')
  state = snoozeWidenSearchRow(state, 'recruiters', NOW)
  check(isWidenSearchRowSnoozed(state, 'recruiters', NOW), 'snoozing a row marks it snoozed at the moment of the tap')
  check(isWidenSearchRowSnoozed(state, 'recruiters', new Date(NOW.getTime() + days(4))), 'still snoozed four days in (under the five-day floor)')
  check(!isWidenSearchRowSnoozed(state, 'recruiters', new Date(NOW.getTime() + days(6))), 'no longer snoozed six days in (past the five-day floor)')
  check(!isWidenSearchRowSnoozed(state, 'networking-groups', NOW), 'snoozing one row does not touch another')
}

// --- Retirement: twenty-one days, then eligible once more ---
{
  let state = emptyWidenSearchState()
  state = retireWidenSearchRow(state, 'career-club-corner', NOW)
  check(isWidenSearchRowRetired(state, 'career-club-corner', NOW), 'retiring a row marks it retired at the moment of the tap')
  check(isWidenSearchRowRetired(state, 'career-club-corner', new Date(NOW.getTime() + days(20))), 'still retired twenty days in (under the twenty-one-day window)')
  check(!isWidenSearchRowRetired(state, 'career-club-corner', new Date(NOW.getTime() + days(22))), 'no longer retired twenty-two days in -- may be raised once more')
}

// --- A direct hint overrides snooze and pacing, never retirement ---
{
  let state = snoozeWidenSearchRow(emptyWidenSearchState(), 'recruiters', NOW)
  check(!isWidenSearchRowEligible(state, 'recruiters', NOW), 'a snoozed row is ineligible for an unprompted offer')
  check(isWidenSearchRowEligible(state, 'recruiters', NOW, { isDirectHint: true }), 'a direct hint overrides the snooze (§2.6: overrides pacing and snooze)')

  state = retireWidenSearchRow(emptyWidenSearchState(), 'income-now', NOW)
  check(!isWidenSearchRowEligible(state, 'income-now', NOW), 'a retired row is ineligible for an unprompted offer')
  check(!isWidenSearchRowEligible(state, 'income-now', NOW, { isDirectHint: true }), 'a direct hint does NOT override a "Not for me" retirement (§2.6: "not a Not for me retirement")')
}

// --- Pacing: at most one unprompted offer per session ---
{
  const state = emptyWidenSearchState()
  check(pickNextWidenSearchRow(ROWS, state, { offeredThisSession: false, now: NOW }) !== null, 'a pick is available when nothing has been offered yet this session')
  check(pickNextWidenSearchRow(ROWS, state, { offeredThisSession: true, now: NOW }) === null, 'pacing caps unprompted picks at one per session')
  check(pickNextWidenSearchRow(ROWS, state, { offeredThisSession: true, now: NOW, isDirectHint: true }) !== null, 'a direct hint is exempt from the per-session pacing cap')
}

// --- Rotation: walks forward from lastOfferedKey so the same row isn't
// repeated ahead of the others in the set ---
{
  const state = emptyWidenSearchState()
  check(pickNextWidenSearchRow(ROWS, state, { lastOfferedKey: 'recruiters', now: NOW }) === 'linkedin-contacts',
    'rotation picks the row immediately after the last-offered one')
  check(pickNextWidenSearchRow(ROWS, state, { lastOfferedKey: 'income-now', now: NOW }) === 'recruiters',
    'rotation wraps back to the front of the set')
  check(pickNextWidenSearchRow(ROWS, state, { now: NOW }) === ROWS[0],
    'with no prior offer, rotation starts at the front of the set')
}

// --- Rotation skips rows that are snoozed or retired, still honoring
// order (a person who snoozed recruiters hears about groups next, per
// §2.6's own example, not linkedin-contacts a second time) ---
{
  let state = emptyWidenSearchState()
  state = snoozeWidenSearchRow(state, 'linkedin-contacts', NOW)
  const picked = pickNextWidenSearchRow(ROWS, state, { lastOfferedKey: 'recruiters', now: NOW })
  check(picked === 'networking-groups', 'rotation steps past a snoozed row to the next eligible one in order')
}

// --- All eligible rows exhausted (every row snoozed or retired): no pick,
// not a crash or a repeat ---
{
  let state = emptyWidenSearchState()
  for (const key of ROWS) state = snoozeWidenSearchRow(state, key, NOW)
  check(pickNextWidenSearchRow(ROWS, state, { now: NOW }) === null, 'no pick when every row in the set is currently snoozed')
}

// --- pickWidenSearchRowForPipeline (2026-09-16, pipeline-aware rotation):
// a healthy pipeline still rotates through WIDEN_ORDER_DEFAULT the same
// way pickNextWidenSearchRow always has; a thin one is a PRIORITY list
// over WIDEN_ORDER_THIN, not a rotation -- the front of that order wins
// every time, independent of lastOfferedKey. ---
check(WIDEN_ORDER_DEFAULT[0] === 'widen-go-to-market' && WIDEN_ORDER_DEFAULT.length === 7,
  'WIDEN_ORDER_DEFAULT leads with direct company contact and covers all seven rows')
check(WIDEN_ORDER_THIN[0] === 'widen-go-to-market' && WIDEN_ORDER_THIN[1] === 'widen-networking-groups' && WIDEN_ORDER_THIN.length === 7,
  'WIDEN_ORDER_THIN leads with Go-to-Market, then the network-widening rows, before circling back to the rest')

{
  const state = emptyWidenSearchState()
  check(pickWidenSearchRowForPipeline(WIDEN_ORDER_DEFAULT, state, { pipelineThin: false, lastOfferedKey: 'widen-go-to-market', now: NOW }) === 'widen-recruiters',
    'a healthy pipeline rotates to the row immediately after the last-offered one, same as pickNextWidenSearchRow')
}

// A thin pipeline always leads with Go-to-Market when it is a candidate --
// even right after Go-to-Market itself was the last one offered, since a
// priority list has no notion of "already had its turn."
{
  const state = emptyWidenSearchState()
  check(pickWidenSearchRowForPipeline(WIDEN_ORDER_DEFAULT, state, { pipelineThin: true, lastOfferedKey: 'widen-go-to-market', now: NOW }) === 'widen-go-to-market',
    'a thin pipeline returns widen-go-to-market even when it was the row just offered')
  check(pickWidenSearchRowForPipeline(WIDEN_ORDER_DEFAULT, state, { pipelineThin: true, lastOfferedKey: 'widen-income-now', now: NOW }) === 'widen-go-to-market',
    'a thin pipeline returns widen-go-to-market regardless of which row fired last')
}

// Thin, with Go-to-Market snoozed: falls through to the next row in
// WIDEN_ORDER_THIN, not back into rotation logic.
{
  let state = snoozeWidenSearchRow(emptyWidenSearchState(), 'widen-go-to-market', NOW)
  check(pickWidenSearchRowForPipeline(WIDEN_ORDER_DEFAULT, state, { pipelineThin: true, now: NOW }) === 'widen-networking-groups',
    'thin with Go-to-Market snoozed returns widen-networking-groups next')
}

// Thin, with Go-to-Market, Networking Groups, and Job Search Resources all
// retired: falls through past all three network-widening rows to
// Recruiters, the next one in WIDEN_ORDER_THIN.
{
  let state = emptyWidenSearchState()
  for (const k of ['widen-go-to-market', 'widen-networking-groups', 'widen-job-search-resources']) state = retireWidenSearchRow(state, k, NOW)
  check(pickWidenSearchRowForPipeline(WIDEN_ORDER_DEFAULT, state, { pipelineThin: true, now: NOW }) === 'widen-recruiters',
    'thin with Go-to-Market, Networking Groups, and Job Search Resources all retired returns widen-recruiters')
}

// offeredThisSession caps at one unprompted offer regardless of mode.
{
  const state = emptyWidenSearchState()
  check(pickWidenSearchRowForPipeline(WIDEN_ORDER_DEFAULT, state, { pipelineThin: false, offeredThisSession: true, now: NOW }) === null,
    'offeredThisSession caps a healthy-pipeline pick at one per session')
  check(pickWidenSearchRowForPipeline(WIDEN_ORDER_DEFAULT, state, { pipelineThin: true, offeredThisSession: true, now: NOW }) === null,
    'offeredThisSession caps a thin-pipeline pick at one per session too')
}

// Candidate filtering: App.jsx's job, not this function's, but the picker
// must only ever pick from the candidate list it is handed -- a built
// section's key simply is not in candidateKeys.
{
  const state = emptyWidenSearchState()
  const candidatesWithoutGoToMarket = WIDEN_ORDER_DEFAULT.filter(k => k !== 'widen-go-to-market')
  check(pickWidenSearchRowForPipeline(candidatesWithoutGoToMarket, state, { pipelineThin: true, now: NOW }) === 'widen-networking-groups',
    'a candidate list with widen-go-to-market already filtered out (e.g. its section already built) is never picked, even in thin mode')
}

// --- widenSearchCandidateKeys (2026-09-16): the behavioral evaluator-logic
// test the brief calls for -- a fixture with a section already built (or a
// missing Bridge Story) never yields the row that builds it, end to end
// through the real filter App.jsx calls, not just a string check on its
// source. ---
{
  const withRecruitersBuilt = widenSearchCandidateKeys(WIDEN_ORDER_DEFAULT, {
    hasDirection: true, bridgeBuilt: true, goToMarketBuilt: false,
    recruitersBuilt: true, groupsBuilt: false, incomeBuilt: false,
  })
  check(!withRecruitersBuilt.includes('widen-recruiters'),
    'a fixture with outputs.recruiters already built never yields widen-recruiters as a candidate')
  check(withRecruitersBuilt.includes('widen-go-to-market') && withRecruitersBuilt.includes('widen-networking-groups'),
    'excluding a built section does not also exclude unrelated candidates')

  const withoutBridge = widenSearchCandidateKeys(WIDEN_ORDER_DEFAULT, {
    hasDirection: true, bridgeBuilt: false, goToMarketBuilt: false,
    recruitersBuilt: false, groupsBuilt: false, incomeBuilt: false,
  })
  check(!withoutBridge.includes('widen-go-to-market'),
    'a fixture with no Bridge Story built never yields widen-go-to-market as a candidate, even with a direction chosen')
  check(withoutBridge.includes('widen-recruiters'),
    'the missing Bridge Story only excludes Go-to-Market, not the other direction-needing rows')

  const withGoToMarketAlreadyBuilt = widenSearchCandidateKeys(WIDEN_ORDER_DEFAULT, {
    hasDirection: true, bridgeBuilt: true, goToMarketBuilt: true,
    recruitersBuilt: false, groupsBuilt: false, incomeBuilt: false,
  })
  check(!withGoToMarketAlreadyBuilt.includes('widen-go-to-market'),
    'a fixture with Go-to-Market itself already built never yields it as a candidate even once the Bridge Story exists')

  const noDirection = widenSearchCandidateKeys(WIDEN_ORDER_DEFAULT, { hasDirection: false })
  check(noDirection.length === 3 && noDirection.includes('widen-linkedin-contacts') && noDirection.includes('widen-job-search-resources') && noDirection.includes('widen-career-club-corner'),
    'with no direction chosen, only the three direction-free rows are candidates')
}

if (failures) {
  console.error(`test-widen-search: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-widen-search: OK (snooze floor, retirement window, direct-hint override of snooze/pacing but not retirement, per-session pacing, set rotation, the pipeline-aware picker, and candidate-key filtering all behave per brief §2.6 and the 2026-09-16 rotation update)')
}
