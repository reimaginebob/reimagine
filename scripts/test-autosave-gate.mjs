// Tests for the sign-in profile-clobber guard (src/autosave-gate.js).
// Run by `npm test` and the prebuild gate.
//
// Two layers. The first is the decision rule in isolation. The second replays
// the actual sign-in race on a clock — local hydrate, setSignedInUser, the
// 800ms debounce, a slow /api/profile/load — and asserts that no PUT carrying
// pre-load state ever reaches the server, which is the property that matters.
// Before the fix, the second layer fails: the PUT lands at t=800 with an empty
// savedPlaybooks and the server's real playbooks are gone.
import { canPushProfile, pushProfileVerdict } from '../src/autosave-gate.js'

let pass = 0, fail = 0
function ok(label, cond, detail) {
  if (cond) pass++
  else { fail++; console.error(`FAIL: ${label}${detail ? `\n   ${detail}` : ''}`) }
}
const eq = (label, got, want) =>
  ok(label, JSON.stringify(got) === JSON.stringify(want), `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`)

// --- layer 1: the rule ------------------------------------------------------
ok('signed in + load settled -> push',
  canPushProfile({ signedIn: true, serverLoadDone: true, deleting: false }) === true)
ok('signed in + load NOT settled -> hold (the bug)',
  canPushProfile({ signedIn: true, serverLoadDone: false, deleting: false }) === false)
ok('anonymous -> never push',
  canPushProfile({ signedIn: false, serverLoadDone: true, deleting: false }) === false)
ok('delete in flight outranks everything',
  canPushProfile({ signedIn: true, serverLoadDone: true, deleting: true }) === false)
ok('undefined serverLoadDone is treated as not-settled, not as truthy-ish',
  canPushProfile({ signedIn: true, serverLoadDone: undefined, deleting: false }) === false)

eq('verdict: awaiting', pushProfileVerdict({ signedIn: true, serverLoadDone: false, deleting: false }), 'awaiting-server-load')
eq('verdict: anonymous', pushProfileVerdict({ signedIn: false, serverLoadDone: false, deleting: false }), 'anonymous')
eq('verdict: deleting', pushProfileVerdict({ signedIn: true, serverLoadDone: true, deleting: true }), 'deleting')
eq('verdict: ok', pushProfileVerdict({ signedIn: true, serverLoadDone: true, deleting: false }), 'ok')

// --- layer 2: replay the race on a clock ------------------------------------
// Models the two App.jsx effects and the 800ms debounce. `guarded` toggles the
// fix so the test proves the guard is what changes the outcome, rather than the
// simulation being rigged to pass.
function runSignInRace({ guarded, loadLatencyMs, loadNeverSettles = false }) {
  const DEBOUNCE = 800
  const server = { savedPlaybooks: ['sp_real_1', 'sp_real_2'], step: 'p11' } // other device's work
  let client = { savedPlaybooks: [], step: 'p3' }                             // this device, from localStorage
  let signedIn = false
  let serverLoadDone = false
  let deleting = false
  const puts = []
  const timers = []
  const schedule = (at, fn) => timers.push({ at, fn })

  const scheduleSave = t => schedule(t + DEBOUNCE, now => {
    if (!guarded) {
      if (signedIn) puts.push({ at: now, body: { ...client } })
      return
    }
    if (canPushProfile({ signedIn, serverLoadDone, deleting })) puts.push({ at: now, body: { ...client } })
  })

  // t=0 local hydrate completes -> state change -> a save is scheduled
  scheduleSave(0)
  // t=10 /api/me resolves: setSignedInUser fires here, in the same .then() that
  // kicks off /api/profile/load. signedInUser is an autosave dependency, so the
  // effect re-runs and schedules another save immediately.
  schedule(10, () => { signedIn = true; scheduleSave(10) })
  // /api/profile/load resolves later: server state lands, .finally flips the flag,
  // and (because serverLoadDone is a dependency) the effect reschedules a save.
  if (!loadNeverSettles) {
    schedule(10 + loadLatencyMs, now => { client = { ...server }; serverLoadDone = true; if (guarded) scheduleSave(now) })
  }

  for (let guard = 0; guard < 100 && timers.length; guard++) {
    timers.sort((a, b) => a.at - b.at)
    const next = timers.shift()
    next.fn(next.at)
  }
  return puts
}

// Slow load (1500ms) — two cold round trips. This is the failure case.
const unguardedSlow = runSignInRace({ guarded: false, loadLatencyMs: 1500 })
ok('WITHOUT the guard, a slow load lets pre-load state reach the server',
  unguardedSlow.some(p => p.body.savedPlaybooks.length === 0),
  `puts: ${JSON.stringify(unguardedSlow)}`)

const guardedSlow = runSignInRace({ guarded: true, loadLatencyMs: 1500 })
ok('WITH the guard, nothing is PUT before the load settles',
  guardedSlow.every(p => p.at >= 1510),
  `puts: ${JSON.stringify(guardedSlow)}`)
ok('WITH the guard, no PUT ever carries an empty savedPlaybooks',
  guardedSlow.every(p => p.body.savedPlaybooks.length === 2),
  `puts: ${JSON.stringify(guardedSlow)}`)
ok('WITH the guard, the profile still reaches the server (not merely blocked)',
  guardedSlow.length >= 1,
  `puts: ${JSON.stringify(guardedSlow)}`)

// Fast load (200ms) — already safe before the fix; must stay safe and still save.
const guardedFast = runSignInRace({ guarded: true, loadLatencyMs: 200 })
ok('fast load still saves, and only server-merged state',
  guardedFast.length >= 1 && guardedFast.every(p => p.body.savedPlaybooks.length === 2),
  `puts: ${JSON.stringify(guardedFast)}`)

// Pathological case: a load that never settles at all. The guard should hold
// the PUT rather than ship pre-load state — losing a save is recoverable, an
// overwrite is not. This cannot happen in App.jsx, where the flag is flipped in
// the chain's .finally so a rejection still releases the guard; the case is here
// to pin the direction the guard fails in.
const neverSettles = runSignInRace({ guarded: true, loadNeverSettles: true })
ok('a load that never settles holds the PUT rather than sending stale state',
  neverSettles.length === 0,
  `puts: ${JSON.stringify(neverSettles)}`)
const unguardedNeverSettles = runSignInRace({ guarded: false, loadNeverSettles: true })
ok('without the guard, that same case ships stale state',
  unguardedNeverSettles.some(p => p.body.savedPlaybooks.length === 0),
  `puts: ${JSON.stringify(unguardedNeverSettles)}`)

console.log(`test-autosave-gate: ${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
