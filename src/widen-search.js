// Coach-as-Concierge Phase 4 Part 2, widen-the-search set (brief
// Output/handoff/2026-09-09_concierge-batch-and-phase4-brief.md, §2.6).
// Engine only: the two things a model is bad at remembering -- snooze
// dates and pacing -- kept separate from the five rows themselves (their
// copy, taps, and condition sentences land in a later PR) and from the
// SYSTEM_PROMPT_STABLE principle that lets a direct hint override this
// machinery (a later PR too). This module has no opinion on which rows
// exist; callers pass their own ordered rowKeys.
//
// Plain `.js`, no JSX, so it stays safe to import from either src/* or
// api/* later without tripping the `.mjs` cross-boundary bundler failure
// (CLAUDE.md section 8; PR #76 / 940557b).

// §2.6: "Remind me later" snoozes a row for five days -- a floor on Coach
// raising it unprompted again, not a ceiling.
export const WIDEN_SNOOZE_DAYS = 5

// §2.6: "Not for me" retires a row for twenty-one days, then it may be
// raised once more (handled here by simply becoming eligible again once
// the retirement window passes -- a second "Not for me" retires it again,
// the same machinery, not a special-cased permanent stop the brief never
// asked for).
export const WIDEN_RETIRE_DAYS = 21

export function emptyWidenSearchState() {
  return {}
}

function entryFor(state, rowKey) {
  return (state && state[rowKey]) || null
}

function isFuture(iso, now) {
  return !!iso && new Date(iso).getTime() > now.getTime()
}

export function isWidenSearchRowSnoozed(state, rowKey, now) {
  return isFuture(entryFor(state, rowKey)?.snoozedUntil, now)
}

export function isWidenSearchRowRetired(state, rowKey, now) {
  return isFuture(entryFor(state, rowKey)?.retiredUntil, now)
}

// §2.6: "a direct hint from the person overrides the pacing and the
// snooze (not a 'Not for me' retirement), because answering what someone
// just said is a reply, not an unprompted offer." So a hint bypasses
// isWidenSearchRowSnoozed but never isWidenSearchRowRetired.
export function isWidenSearchRowEligible(state, rowKey, now, { isDirectHint = false } = {}) {
  if (isWidenSearchRowRetired(state, rowKey, now)) return false
  if (!isDirectHint && isWidenSearchRowSnoozed(state, rowKey, now)) return false
  return true
}

export function snoozeWidenSearchRow(state, rowKey, now) {
  return { ...state, [rowKey]: { ...entryFor(state, rowKey), snoozedUntil: new Date(now.getTime() + WIDEN_SNOOZE_DAYS * 86400000).toISOString() } }
}

export function retireWidenSearchRow(state, rowKey, now) {
  return { ...state, [rowKey]: { ...entryFor(state, rowKey), retiredUntil: new Date(now.getTime() + WIDEN_RETIRE_DAYS * 86400000).toISOString() } }
}

// §2.6: "at most one widen-the-search offer per session unprompted...
// rotation through the set so a person who snoozed recruiters hears about
// groups next time." rowKeys is the caller's fixed offer order; rotation
// walks forward from lastOfferedKey so the same row isn't repeated ahead
// of the others. isDirectHint bypasses the per-session pacing cap the
// same way it bypasses snooze, for the same reason (a reply, not an
// unprompted offer) -- it still has to pass isWidenSearchRowEligible, so
// a retired row stays off the table either way.
export function pickNextWidenSearchRow(rowKeys, state, { lastOfferedKey = null, offeredThisSession = false, now = new Date(), isDirectHint = false } = {}) {
  if (!rowKeys || !rowKeys.length) return null
  if (!isDirectHint && offeredThisSession) return null
  const startIdx = lastOfferedKey ? rowKeys.indexOf(lastOfferedKey) : -1
  for (let i = 1; i <= rowKeys.length; i++) {
    const key = rowKeys[(startIdx + i + rowKeys.length) % rowKeys.length]
    if (isWidenSearchRowEligible(state, key, now, { isDirectHint })) return key
  }
  return null
}

// Pipeline-aware ordering (Bob, 2026-09-16): a healthy pipeline still
// rotates through the whole set, direct company contact first, because
// that channel is the heart of Making Your Own Weather. A thin pipeline
// (App.jsx's pipelineThin -- fewer than two live opportunities, or
// fourteen-plus days quiet on every one of them, per step-position.js)
// leads instead with what widens the person's network before circling
// back to the rest.
export const WIDEN_ORDER_DEFAULT = ['widen-go-to-market', 'widen-recruiters', 'widen-linkedin-contacts', 'widen-networking-groups', 'widen-job-search-resources', 'widen-career-club-corner', 'widen-income-now']
export const WIDEN_ORDER_THIN = ['widen-go-to-market', 'widen-networking-groups', 'widen-job-search-resources', 'widen-recruiters', 'widen-linkedin-contacts', 'widen-career-club-corner', 'widen-income-now']

// candidateKeys is the caller's already-filtered pool (direction needed,
// section not already built -- App.jsx's job, not this module's). A
// healthy pipeline still rotates through it in order; a thin one does not
// rotate at all -- it is a priority list, so the first eligible row in the
// thin order wins every time, even right after that same row was the one
// just offered. Passing the candidate list's own last key as
// lastOfferedKey is what buys that: pickNextWidenSearchRow's walk starts
// one past lastOfferedKey, so starting one past the END of the thin-
// ordered list lands back on its front.
export function pickWidenSearchRowForPipeline(candidateKeys, state, { pipelineThin = false, lastOfferedKey = null, offeredThisSession = false, now = new Date() } = {}) {
  const order = pipelineThin ? WIDEN_ORDER_THIN : WIDEN_ORDER_DEFAULT
  const keys = order.filter(k => candidateKeys.includes(k))
  if (!pipelineThin) return pickNextWidenSearchRow(keys, state, { lastOfferedKey, offeredThisSession, now })
  return pickNextWidenSearchRow(keys, state, { lastOfferedKey: keys[keys.length - 1] || null, offeredThisSession, now })
}

const WIDEN_DIRECTION_KEYS = ['widen-go-to-market', 'widen-recruiters', 'widen-networking-groups', 'widen-income-now']

// Which of the seven rows are even in play before snooze/retirement/
// pacing/pipeline ever enter it: a direction-needing row is off the table
// with no chosen direction yet, and a row whose own Focus section is
// already built is off the table too -- offering to build something that
// already exists reads as Coach not paying attention. Go-to-Market
// additionally needs the Bridge Story built (the guide places it late in
// the Focus Playbook on purpose, since it runs live research and is the
// most expensive section, and the Bridge Story is the voice template its
// outreach draws on).
//
// Pure and decoupled from App.jsx's `outputs` shape on purpose -- the
// caller (App.jsx) reduces its own state to these plain booleans, so this
// stays testable with a fixture rather than a live component instance.
export function widenSearchCandidateKeys(rowKeys, { hasDirection = false, bridgeBuilt = false, goToMarketBuilt = false, recruitersBuilt = false, groupsBuilt = false, incomeBuilt = false } = {}) {
  return rowKeys.filter(k => {
    if (WIDEN_DIRECTION_KEYS.includes(k) && !hasDirection) return false
    if (k === 'widen-go-to-market') return bridgeBuilt && !goToMarketBuilt
    if (k === 'widen-recruiters') return !recruitersBuilt
    if (k === 'widen-networking-groups') return !groupsBuilt
    if (k === 'widen-income-now') return !incomeBuilt
    return true
  })
}
