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
// The fix is to hold the PUT until the load has settled. serverLoadDone is set
// in the chain's .finally, so it settles on failure too and a dead /api/me can
// never wedge saving permanently.

/**
 * @param {object}  s
 * @param {boolean} s.signedIn       a signed-in user is present (server sync is on)
 * @param {boolean} s.serverLoadDone the /api/me -> /api/profile/load chain has settled
 * @param {boolean} s.deleting       a Start Fresh account delete is in flight
 * @returns {boolean} true when the autosave may PUT to /api/profile/save
 */
export function canPushProfile({ signedIn, serverLoadDone, deleting }) {
  if (deleting) return false
  if (!signedIn) return false
  return serverLoadDone === true
}

/**
 * Why a push was withheld. Used for the save-status indicator and for test
 * readability; 'ok' means the push is allowed.
 * @returns {'ok'|'deleting'|'anonymous'|'awaiting-server-load'}
 */
export function pushProfileVerdict({ signedIn, serverLoadDone, deleting }) {
  if (deleting) return 'deleting'
  if (!signedIn) return 'anonymous'
  if (serverLoadDone !== true) return 'awaiting-server-load'
  return 'ok'
}
