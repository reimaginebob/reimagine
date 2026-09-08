// The rule that decides whether the debounced profile autosave is allowed to
// PUT to the server yet. Extracted into its own module so the invariant is
// executable (scripts/test-autosave-gate.mjs) instead of living only as a
// condition buried in a 10k-line component.
//
// THE RACE THIS EXISTS TO CLOSE
//
// On load, two effects in App.jsx populate profile state:
//
//   1. the pe_v4 localStorage hydrate — synchronous, at mount
//   2. the /api/me -> /api/profile/load chain — async, two sequential round
//      trips, either of which can hit a cold serverless function
//
// setSignedInUser fires inside the SAME .then() that kicks off (2). Because
// signedInUser is a dependency of the autosave effect, that setter re-runs the
// effect and schedules a PUT 800ms later, carrying whatever came out of
// localStorage. If /api/profile/load takes longer than 800ms, that older local
// state reaches the server BEFORE the newer server state reaches the client.
//
// api/profile/save.js writes profile_state as a whole-column jsonb replace, so
// the overwrite is total rather than a merge. savedPlaybooks makes it worst:
// it is populated ONLY by the server-load branch, so a device that has not
// finished loading holds [] and writes [] over every saved Opportunity
// Playbook the user has. Silent, and on the second device rather than the one
// doing the damage.
//
// SUCCEED, NOT MERELY SETTLE (finding #2.5, 2026-09-08 prelaunch audit). An
// earlier version of this gate keyed on App.jsx's serverLoadDone, which its
// .finally sets on BOTH success and failure so the one-shot LANDING decision
// elsewhere in App.jsx is never stuck waiting on a dead network. Reused here,
// that same forgiveness was the bug: a laptop with weeks-old local state,
// signing in during a Neon hiccup, sailed through this gate the instant the
// FAILED load settled and overwrote whatever newer work existed on the
// server. This gate now keys on serverLoadOk, which App.jsx sets ONLY when
// /api/profile/load actually returns 2xx. A load that fails or never settles
// leaves autosave holding the device's edits in localStorage for the rest of
// the session rather than risking an unverified overwrite — losing a save is
// recoverable, a silent overwrite is not.
//
// This gate alone does not cover every stale-write path (two tabs racing after
// BOTH have loaded successfully, for instance) — that half of finding #2.5 is
// the profile_updated_at precondition api/profile/save.js checks server-side.

/**
 * @param {object}  s
 * @param {boolean} s.signedIn      a signed-in user is present (server sync is on)
 * @param {boolean} s.serverLoadOk  /api/profile/load has actually SUCCEEDED this
 *                                  session (not merely settled — a failed or
 *                                  still-pending load must not unlock the PUT)
 * @param {boolean} s.deleting      a Start Fresh account delete is in flight
 * @returns {boolean} true when the autosave may PUT to /api/profile/save
 */
export function canPushProfile({ signedIn, serverLoadOk, deleting }) {
  if (deleting) return false
  if (!signedIn) return false
  return serverLoadOk === true
}

/**
 * Why a push was withheld. Used for the save-status indicator and for test
 * readability; 'ok' means the push is allowed.
 * @returns {'ok'|'deleting'|'anonymous'|'awaiting-server-load'}
 */
export function pushProfileVerdict({ signedIn, serverLoadOk, deleting }) {
  if (deleting) return 'deleting'
  if (!signedIn) return 'anonymous'
  if (serverLoadOk !== true) return 'awaiting-server-load'
  return 'ok'
}
