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

// PILOT — My Coach next-step capture, 2026-09-02. Gates one thing: whether the
// Coach is told it may propose a next move and a date for an opportunity. The
// WRITE it proposes is not gated and does not need to be — it goes through the
// same PUT /api/pursuit-status the card editor uses, and it only happens when
// the person taps. What the flag controls is whether the instruction is in the
// prompt at all, which is also why a non-flagged account cannot produce the
// trailer even by asking for it.
export const PIPELINE_CAPTURE_FLAG = 'pipeline_capture'

// Internal accounts. Reimagine already treats an @career.club address as staff
// in three places (api/claude.js cost accounting, api/coach.js general mode, and
// the client's general-mode prop), so this codifies a rule the codebase was
// already applying rather than inventing a new one.
const INTERNAL_EMAIL_RE = /@career\.club$/i

export function isInternalAccount(user) {
  return !!(user && typeof user.email === 'string' && INTERNAL_EMAIL_RE.test(user.email))
}

// A pilot is on for an account that holds the flag OR for anyone on the team.
// Bob quality-controls every pilot before a real user sees it (CLAUDE.md §8), and
// making him grant himself access by email each time was friction with no safety
// in it -- the dashboard grant is for named outside testers, which is the case
// that actually needs a record.
//
// Deliberately NOT applied to hasConnectorBeta. That gate is a different risk
// class: it decides who may mint a long-lived bearer token and let an outside
// assistant write to a pipeline unattended. Issuing a credential should stay an
// explicit, per-account act with a row behind it, staff or not.
export function hasPipelineCapture(user) {
  if (isInternalAccount(user)) return true
  const flags = user && Array.isArray(user.feature_flags) ? user.feature_flags : []
  return flags.includes(PIPELINE_CAPTURE_FLAG)
}

// The flags the admin dashboard may grant and revoke by email. A flag that is
// not in here cannot be set from the dashboard at all, so a typo in the request
// body is a 400 rather than a row carrying a string nothing reads. `label` is
// what the dashboard shows; keep it the user-facing name of the surface.
//
// Adding an entry here is how a pilot becomes grantable, and it is deliberately
// an edit to this file — see the header above for why a flag whose meaning
// lives only in the database is the failure mode this file exists to prevent.
export const GRANTABLE_FLAGS = {
  [CONNECTOR_BETA_FLAG]: { label: 'Assistant connector' },
  [PIPELINE_CAPTURE_FLAG]: { label: 'Coach next-step capture' },
}
