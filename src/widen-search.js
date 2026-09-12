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
