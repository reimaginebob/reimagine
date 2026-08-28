// Rebuilding a playbook's stale sections, in the order their dependencies
// require, one at a time.
//
// Why an order at all: Interview Prep and LinkedIn Remix are built from the
// Bridge Story, and Income Now from LinkedIn Remix. When an upstream is stale,
// sanitizeUpstreamForSection replaces its text in the prompt with a placeholder
// -- "[Your Bridge Story is being refreshed and is intentionally left out
// here]" -- so a section refreshed ahead of its upstream is built WITHOUT it and
// still looks finished. Clicking Refresh on each card by hand offers no
// protection from that, and nothing on screen says it happened.
//
// Why one module for two surfaces: Focus and Opportunity rebuild a section
// through different functions, but the sequencing, the ordering, the progress
// and the what-happens-when-one-fails are the same question in both places. The
// caller passes a `rebuild` function; everything else lives here, tested once.

// Dependency order. Bridge Story first because two sections read it; Income Now
// last because it reads LinkedIn Remix. Everything between is independent of its
// neighbours, so the order within that middle group only affects what the person
// watches finish first.
export const REFRESH_ORDER = ['p6', 'p5', 'p7', 'p_res', 'p8', 'p11', 'p_cover', 'income']

// Sort the sections to rebuild into dependency order. Anything unrecognised goes
// last in the order it arrived, so a section added later still runs rather than
// being silently dropped.
export function orderForRefresh(ids, order = REFRESH_ORDER) {
  const known = []
  const unknown = []
  for (const id of Array.isArray(ids) ? ids : []) {
    if (order.includes(id)) known.push(id)
    else unknown.push(id)
  }
  known.sort((a, b) => order.indexOf(a) - order.indexOf(b))
  return [...known, ...unknown]
}

// Rebuild each section in turn.
//
//   ids       sections to rebuild, in any order
//   rebuild   async (id) => void; whatever this surface does for that section
//   onStep    optional ({ id, index, total, phase }) for the progress display
//
// Sequential rather than parallel, deliberately: a later section reads an
// earlier one's output, and firing them together would hand the same stale text
// to everything downstream. One failure does not stop the rest -- the remaining
// sections do not depend on the failed one having been REBUILT, only on it
// existing, and it still does. The caller is told what did not make it.
export async function runRefresh(ids, rebuild, { onStep } = {}) {
  const queue = orderForRefresh(ids)
  const done = []
  const failed = []
  for (let i = 0; i < queue.length; i++) {
    const id = queue[i]
    if (typeof onStep === 'function') {
      try { onStep({ id, index: i, total: queue.length, phase: 'start' }) } catch { /* progress must never break the run */ }
    }
    try {
      await rebuild(id)
      done.push(id)
    } catch (e) {
      failed.push({ id, message: (e && e.message) ? String(e.message) : 'Generation failed' })
    }
    if (typeof onStep === 'function') {
      try { onStep({ id, index: i, total: queue.length, phase: 'end' }) } catch { /* as above */ }
    }
  }
  return { done, failed, total: queue.length }
}
