// Two levels of admin credential.
//
// ADMIN_TOKEN is a master key: it unlocks every admin endpoint, including the
// ones that change state — suspending an account, granting beta access,
// recording who is paying. It should stay with Bob.
//
// ANALYST_TOKEN is read-only. It exists so a collaborator can pull the data
// this workstream needs without being handed the ability to suspend a user's
// account. It is accepted only where a route explicitly opts in, and only on
// GET; no write path in this codebase should ever call this with
// allowAnalyst: true.
//
// Least privilege on purpose: the analyst token opens the three endpoints that
// serve the lifecycle-email work (user stages, growth, dormant accounts,
// generation attempts) and nothing else. Economics is financial, analytics carries playbook titles, the
// suspend and pipeline routes write — those stay master-key only. Widening this
// later is one flag on one route; narrowing it after a token has been shared is
// a rotation.
//
// Returns 'admin' | 'analyst' | null. Callers translate null into a 403 rather
// than this helper doing it, so each route keeps its own error shape.

export function checkAdminAuth(req, { allowAnalyst = false } = {}) {
  const auth = req.headers.authorization || ''
  if (!auth.startsWith('Bearer ')) return null

  const admin = process.env.ADMIN_TOKEN
  if (admin && auth === `Bearer ${admin}`) return 'admin'

  // An analyst token is only ever a read credential. The method check is
  // belt-and-braces alongside allowAnalyst: a route that later grows a POST
  // handler cannot silently start accepting it.
  if (allowAnalyst && req.method === 'GET') {
    const analyst = process.env.ANALYST_TOKEN
    if (analyst && auth === `Bearer ${analyst}`) return 'analyst'
  }

  return null
}

// True when ADMIN_TOKEN is absent, which is a server misconfiguration rather
// than a failed credential and should be a 500, not a 403. ANALYST_TOKEN being
// unset is not an error — it just means nobody has been issued one.
export function adminTokenMissing() {
  return !process.env.ADMIN_TOKEN
}
