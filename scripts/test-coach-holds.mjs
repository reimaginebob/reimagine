// Coach distress/mood holds surviving a reload (Output/handoff/2026-09-16_
// four-my-coach-breaks-brief.md, item C). Pure module test: coach-holds.js
// wraps sessionStorage, which does not exist in Node by default, so this
// stands up a minimal in-memory mock before exercising the module -- the
// same shape sessionStorage.getItem/setItem/removeItem expose in a browser.
import { readCoachHolds, writeCoachHold, clearCoachHolds } from '../src/coach-holds.js'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

function makeSessionStorageMock() {
  const store = new Map()
  return {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)) },
    removeItem: (k) => { store.delete(k) },
  }
}

// --- Normal path: a browser-like sessionStorage is present ---
globalThis.sessionStorage = makeSessionStorageMock()

check(readCoachHolds().distress === false && readCoachHolds().mood === false,
  'both holds start clear with nothing written yet')

writeCoachHold('distress')
check(readCoachHolds().distress === true, 'writeCoachHold(distress) sets the distress hold')
check(readCoachHolds().mood === false, 'writing the distress hold does not touch the mood hold')

writeCoachHold('mood')
check(readCoachHolds().mood === true, 'writeCoachHold(mood) sets the mood hold')
check(readCoachHolds().distress === true, 'writing the mood hold does not clear an existing distress hold')

// This is the actual regression: a hold set before a reload must still
// read back true afterward. readCoachHolds() reading straight from
// sessionStorage (rather than from React state initialized to false) is
// what a reload can no longer silently drop.
check(readCoachHolds().distress === true && readCoachHolds().mood === true,
  'both holds independently persist across a simulated reload (re-reading sessionStorage fresh)')

clearCoachHolds()
check(readCoachHolds().distress === false && readCoachHolds().mood === false,
  'clearCoachHolds() clears both holds at once, as called from handleCoachSessionOpen and clearAccountLocalState')

// --- Defensive path: no sessionStorage (private-window / blocked site
// data) must not throw -- every accessor is wrapped in try/catch. ---
delete globalThis.sessionStorage
check(readCoachHolds().distress === false && readCoachHolds().mood === false,
  'readCoachHolds() degrades to false/false, not a throw, when sessionStorage is unavailable')
try {
  writeCoachHold('distress')
  clearCoachHolds()
  check(true, 'writeCoachHold/clearCoachHolds do not throw when sessionStorage is unavailable')
} catch {
  check(false, 'writeCoachHold/clearCoachHolds do not throw when sessionStorage is unavailable')
}

if (failures) {
  console.error(`test-coach-holds: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-coach-holds: OK (distress and mood holds read/write/clear correctly and survive a simulated reload, and degrade safely with no sessionStorage)')
}
