// Named feature flags, so a gate's MEANING lives in code rather than only in the
// values sitting in users.feature_flags.
//
// Background: My Pipeline shipped in August 2026 behind a per-user flag literally
// named `my_search`, granted and revoked from the admin dashboard. Turning a
// pilot into GA was therefore a database action with no commit behind it —
// nothing in the repo changed, so no review happened, no gate fired, and the
// docs-currency rule in CLAUDE.md §8 never had a PR to attach itself to. The
// constant below is the fix: opening or narrowing a gated surface is now an edit
// to this file and to the call sites, which means a PR, which means the guide and
// the Coach catalog get updated in the same breath.
//
// My Pipeline itself went GA on 2026-08-30 and no longer reads any flag. The flag
// VALUE is unchanged (`my_search`, still what the rows hold and what
// api/admin/pipeline-access.js writes) but its MEANING narrowed to one thing:
// the assistant connector. A DB rename would have bought a nicer string in
// exchange for a migration across live rows, live OAuth grants, and live push
// tokens; the name is worth less than that risk. Read every use of it as
// "connector beta", never as "My Pipeline".
//
// What CONNECTOR_BETA_FLAG still gates:
//   api/oauth/authorize.js   who may grant an OAuth client access
//   api/mcp.js               who may call the MCP endpoint
//   api/push-token.js        who may mint a bearer token for their assistant
//   api/pursuit-status.js    the BEARER path only; the browser path is GA
//
// These stay gated because they are a different risk class from a screen in the
// app: an outside assistant holding a long-lived credential, writing to a user's
// pipeline unattended, with no browser session and no origin check.
export const CONNECTOR_BETA_FLAG = 'my_search'

// True iff this user row may use the assistant connector. Accepts the row shape
// every caller already has (getSessionUser, or a direct users SELECT that
// includes feature_flags).
export function hasConnectorBeta(user) {
  const flags = user && Array.isArray(user.feature_flags) ? user.feature_flags : []
  return flags.includes(CONNECTOR_BETA_FLAG)
}
