// Tests for the sign-in profile-clobber guard (src/autosave-gate.js).
// Run by `npm test` and the prebuild gate.
//
// Two layers. The first is the decision rule in isolation. The second replays
// the actual sign-in race on a clock — local hydrate, setSignedInUser, the
// 800ms debounce, a slow /api/profile/load — and asserts that no PUT carrying
// pre-load state ever reaches the server, which is the property that matters.
// Before the original fix, the second layer fails: the PUT lands at t=800
// with an empty savedPlaybooks and the server's real playbooks are gone.
//
// Updated for finding #2.5 (2026-09-08 prelaunch audit): the gate now keys on
// serverLoadOk (settles true ONLY on an actual 2xx load), not serverLoadDone
// (which settles on both success and failure, correct for the separate
// landing-decision effect but the exact bug for this gate — a FAILED load
// used to unlock the PUT just as readily as a successful one). The race
// replay below adds a load-fails case alongside the pre-existing slow-load
// and never-settles cases to prove the new distinction actually holds.
import { canPushProfile, pushProfileVerdict } from '../src/autosave-gate.js'

let pass = 0, fail = 0
function ok(label, cond, detail) {
  if (cond) pass++
  else { fail++; console.error(`FAIL: ${label}${detail ? `\n   ${detail}` : ''}`) }
}
const eq = (label, got, want) =>
  ok(label, JSON.stringify(got) === JSON.stringify(want), `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`)

// --- layer 1: the rule ------------------------------------------------------
ok('signed in + load actually succeeded -> push',
  canPushProfile({ signedIn: true, serverLoadOk: true, deleting: false }) === true)
ok('signed in + load NOT yet succeeded -> hold (still pending)',
  canPushProfile({ signedIn: true, serverLoadOk: false, deleting: false }) === false)
ok('anonymous -> never push',
  canPushProfile({ signedIn: false, serverLoadOk: true, deleting: false }) === false)
ok('delete in flight outranks everything',
  canPushProfile({ signedIn: true, serverLoadOk: true, deleting: true }) === false)
ok('undefined serverLoadOk is treated as not-succeeded, not as truthy-ish',
  canPushProfile({ signedIn: true, serverLoadOk: undefined, deleting: false }) === false)

eq('verdict: awaiting', pushProfileVerdict({ signedIn: true, serverLoadOk: false, deleting: false }), 'awaiting-server-load')
eq('verdict: anonymous', pushProfileVerdict({ signedIn: false, serverLoadOk: false, deleting: false }), 'anonymous')
eq('verdict: deleting', pushProfileVerdict({ signedIn: true, serverLoadOk: true, deleting: true }), 'deleting')
eq('verdict: ok', pushProfileVerdict({ signedIn: true, serverLoadOk: true, deleting: false }), 'ok')

// --- layer 2: replay the race on a clock ------------------------------------
// Models the two App.jsx effects and the 800ms debounce. `guarded` toggles the
// fix so the test proves the guard is what changes the outcome, rather than the
// simulation being rigged to pass.
function runSignInRace({ guarded, loadLatencyMs, loadNeverSettles = false, loadFails = false }) {
  const DEBOUNCE = 800
  const server = { savedPlaybooks: ['sp_real_1', 'sp_real_2'], step: 'p11' } // other device's work
  let client = { savedPlaybooks: [], step: 'p3' }                             // this device, from localStorage
  let signedIn = false
  let serverLoadOk = false
  let deleting = false
  const puts = []
  const timers = []
  const schedule = (at, fn) => timers.push({ at, fn })

  const scheduleSave = t => schedule(t + DEBOUNCE, now => {
    if (!guarded) {
      if (signedIn) puts.push({ at: now, body: { ...client } })
      return
    }
    if (canPushProfile({ signedIn, serverLoadOk, deleting })) puts.push({ at: now, body: { ...client } })
  })

  // t=0 local hydrate completes -> state change -> a save is scheduled
  scheduleSave(0)
  // t=10 /api/me resolves: setSignedInUser fires here, in the same .then() that
  // kicks off /api/profile/load. signedInUser is an autosave dependency, so the
  // effect re-runs and schedules another save immediately.
  schedule(10, () => { signedIn = true; scheduleSave(10) })
  // /api/profile/load resolves later. A successful load lands server state and
  // flips serverLoadOk; a FAILED load (non-2xx, or a thrown network error caught
  // by the chain's .catch) settles the chain but must NOT flip serverLoadOk --
  // that is finding #2.5. Neither case re-schedules a save when unguarded, since
  // the unguarded path never looks at serverLoadOk at all.
  if (!loadNeverSettles) {
    schedule(10 + loadLatencyMs, now => {
      if (loadFails) { if (guarded) scheduleSave(now); return } // settles, but stays unsuccessful
      client = { ...server }; serverLoadOk = true; if (guarded) scheduleSave(now)
    })
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
ok('WITH the guard, nothing is PUT before the load succeeds',
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
// overwrite is not.
const neverSettles = runSignInRace({ guarded: true, loadNeverSettles: true })
ok('a load that never settles holds the PUT rather than sending stale state',
  neverSettles.length === 0,
  `puts: ${JSON.stringify(neverSettles)}`)
const unguardedNeverSettles = runSignInRace({ guarded: false, loadNeverSettles: true })
ok('without the guard, that same case ships stale state',
  unguardedNeverSettles.some(p => p.body.savedPlaybooks.length === 0),
  `puts: ${JSON.stringify(unguardedNeverSettles)}`)

// The finding #2.5 case: a load that SETTLES but FAILS (a Neon hiccup, a cold
// function timing out with a non-2xx). This is exactly the scenario the audit
// names -- "a laptop with weeks-old local state signs in during a Neon hiccup
// and replaces the work the person did on their phone" -- and it is reachable
// in the real App.jsx (unlike the never-settles case above, which is there
// only to pin the failure direction). With the OLD serverLoadDone-keyed gate
// this settled-but-failed load would have unlocked the PUT exactly like a
// success would; the new serverLoadOk-keyed gate must not.
const guardedLoadFails = runSignInRace({ guarded: true, loadLatencyMs: 1500, loadFails: true })
ok('WITH the guard, a load that settles but FAILS still holds the PUT for the rest of the session',
  guardedLoadFails.length === 0,
  `puts: ${JSON.stringify(guardedLoadFails)}`)
const unguardedLoadFails = runSignInRace({ guarded: false, loadLatencyMs: 1500, loadFails: true })
ok('without the guard, a failed load still ships stale local state (what finding #2.5 flagged)',
  unguardedLoadFails.some(p => p.body.savedPlaybooks.length === 0),
  `puts: ${JSON.stringify(unguardedLoadFails)}`)

console.log(`test-autosave-gate: ${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
