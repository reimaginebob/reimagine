// Coach-as-Concierge Phase 4 Part 2 (Output/handoff/2026-09-09_concierge-
// batch-and-phase4-brief.md, §2.6): the widen-the-search engine -- snooze
// dates, pacing, rotation, and the twenty-one-day "Not for me" retirement.
// Pure module, no App.jsx/catalog wiring yet (that's the next PR); this
// only has to prove the machinery itself is correct.
import {
  WIDEN_SNOOZE_DAYS,
  WIDEN_RETIRE_DAYS,
  emptyWidenSearchState,
  isWidenSearchRowSnoozed,
  isWidenSearchRowRetired,
  isWidenSearchRowEligible,
  snoozeWidenSearchRow,
  retireWidenSearchRow,
  pickNextWidenSearchRow,
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

if (failures) {
  console.error(`test-widen-search: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-widen-search: OK (snooze floor, retirement window, direct-hint override of snooze/pacing but not retirement, per-session pacing, and set rotation all behave per brief §2.6)')
}
