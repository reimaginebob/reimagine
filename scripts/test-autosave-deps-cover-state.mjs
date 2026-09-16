// Guards the whole bug class behind the 2026-09-16 widen-search snooze/
// retire persistence fix (Output/handoff/2026-09-16_four-my-coach-breaks-
// brief.md, item B), not just the one missing key. The autosave effect's
// stateForSave object (src/App.jsx) is what actually gets written to
// localStorage and PUT to the server; the SAME effect's dependency array is
// what decides whether a state change re-runs it at all. widenSearchState
// was in stateForSave but missing from the dependency array, so a snoozed
// or retired widen-the-search offer never reached the server or
// localStorage until some OTHER listed state happened to change. This test
// parses both lists straight out of the source and fails if any
// stateForSave key is absent from the dependencies -- so the next field
// someone adds to stateForSave without also adding it to the deps array
// fails the build instead of shipping a silent, hard-to-reproduce bug.
import fs from 'node:fs'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

const APP = 'src/App.jsx'
const app = fs.readFileSync(APP, 'utf8')

const STATE_MARKER = 'const stateForSave={'
const stateForSaveIdx = app.indexOf(STATE_MARKER)
check(stateForSaveIdx !== -1, `${APP}: could not find "${STATE_MARKER}"`)

const stateForSaveEnd = stateForSaveIdx !== -1 ? app.indexOf('}', stateForSaveIdx) : -1
const stateForSaveBody = stateForSaveIdx !== -1 ? app.slice(stateForSaveIdx + STATE_MARKER.length, stateForSaveEnd) : ''
const stateForSaveKeys = stateForSaveBody.split(',').map(s => s.trim()).filter(Boolean)
// A sanity floor, not a magic number -- this object carries ~28 fields today.
// If parsing found far fewer, the marker has drifted and every check below is
// silently vacuous rather than actually guarding anything.
check(stateForSaveKeys.length >= 20,
  `${APP}: stateForSave parsed only ${stateForSaveKeys.length} keys -- the marker or object shape may have drifted`)

// The exact tail of the async save() function, immediately followed by the
// effect's own dependency array -- distinguishes THIS effect's deps from any
// other array literal that happens to be nearby.
const DEPS_MARKER = '};saveRef.current=save;const t=setTimeout(save,800);return()=>clearTimeout(t)},['
const depsIdx = app.indexOf(DEPS_MARKER)
check(depsIdx !== -1, `${APP}: could not find the autosave effect's own dependency-array marker -- has the save() function's tail changed shape?`)

const depsStart = depsIdx !== -1 ? depsIdx + DEPS_MARKER.length : -1
const depsEnd = depsIdx !== -1 ? app.indexOf('])', depsStart) : -1
const depsBody = depsIdx !== -1 ? app.slice(depsStart, depsEnd) : ''
const deps = depsBody.split(',').map(s => s.trim()).filter(Boolean)
check(deps.length >= 20, `${APP}: the autosave effect's dependency array parsed only ${deps.length} entries -- likely a marker/parsing drift`)

for (const key of stateForSaveKeys) {
  check(deps.includes(key),
    `${APP}: stateForSave key "${key}" is missing from the autosave effect's dependency array -- a change to it alone will not trigger a save`)
}

// The specific regression this brief fixed, named explicitly so a future
// reader sees at a glance which key this test was written over.
check(deps.includes('widenSearchState'),
  `${APP}: widenSearchState is missing from the autosave effect's dependency array -- Remind me later / Not for me taps will not persist`)

if (failures) {
  console.error(`test-autosave-deps-cover-state: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log(`test-autosave-deps-cover-state: OK (all ${stateForSaveKeys.length} stateForSave keys, including widenSearchState, are present in the autosave effect's own dependency array)`)
}
