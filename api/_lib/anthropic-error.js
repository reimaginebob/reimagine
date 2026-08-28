// One place that decides what an Anthropic failure means, and what the user is
// told about it.
//
// 2026-08-15 incident: the monthly spend cap on the Anthropic account was
// reached, and the raw upstream string — "You have reached your specified API
// usage limits. You will regain access on 2026-09-01 at 00:00 UTC" — was
// rendered verbatim to users on Where You Fit. Two other sections surfaced the
// downstream "we couldn't identify the company" message instead, which read as
// a problem with the job description the user had pasted.
//
// That string is wrong on both counts. It reads to the user as something they
// did, and it discloses the reset date of an internal budget. Every surface
// that talks to api.anthropic.com now routes its non-2xx responses through
// classifyAnthropicError and returns SYSTEM_ERROR_MESSAGE. The upstream text is
// logged for the operator and never sent to a browser.
//
// Cross-boundary note (CLAUDE.md section 8): this lives under api/ and is
// imported with a .js extension, the same as ./db.js and ./usage-cost.js.

// What a user sees when the model cannot be reached, whatever the reason.
// Deliberately one message for every upstream failure class: the distinctions
// that matter (spend cap, rate limit, overload, bad key) are operator
// distinctions, and none of them change what the user should do next.
export const SYSTEM_ERROR_MESSAGE = 'Reimagine is temporarily unable to generate new content. This is on us, not you. Try again in a few minutes; if it keeps happening, email bob@career.club.'

// Machine-readable tag on the error body. The client uses it to tell a system
// outage from a content-level failure (a job description it genuinely cannot
// read) without matching on prose.
export const SYSTEM_ERROR_TYPE = 'system_unavailable'

// HTTP status the proxy returns for any upstream failure. 503 rather than
// passing the upstream status through: the upstream 400/429/529 describes
// Reimagine's relationship with Anthropic, not the browser's request.
export const SYSTEM_ERROR_STATUS = 503

// The response body every surface returns on an upstream failure.
export function systemErrorPayload() {
  return { error: { type: SYSTEM_ERROR_TYPE, message: SYSTEM_ERROR_MESSAGE } }
}

// Pull the upstream message out of whatever shape came back. Anthropic returns
// {type:'error', error:{type, message}}; a proxy or a gateway in front of it may
// return text. Capped, because this goes into a log line and an operator email.
function upstreamMessage(body) {
  if (!body) return ''
  if (typeof body === 'string') return body.trim().slice(0, 400)
  const e = body.error
  if (e && typeof e === 'object' && typeof e.message === 'string') return e.message.trim().slice(0, 400)
  if (typeof e === 'string') return e.trim().slice(0, 400)
  return ''
}

function upstreamType(body) {
  const e = body && typeof body === 'object' ? body.error : null
  return (e && typeof e === 'object' && typeof e.type === 'string') ? e.type : ''
}

// Phrases Anthropic uses when the ACCOUNT is out of money or over its
// configured spend limit, as opposed to over a per-minute rate limit. Matched
// on message text because the status code alone does not separate them: a spend
// cap has surfaced as a 429 rate_limit_error, and a drained balance as a 400.
const SPEND_PATTERNS = [
  /specified api usage limits/i,
  /usage limits?/i,
  /credit balance/i,
  /spend(ing)? limit/i,
  /quota (has been )?exceeded/i,
  /billing/i,
]

// classifyAnthropicError: what went wrong, in operator terms.
//
//   status  HTTP status from the upstream call, or 0 for a network-level throw
//   body    parsed response body (or the raw text, or the thrown Error)
//
// Returns { kind, detail, page } where `page` marks the classes that mean
// somebody has to do something — the account is out of budget, or the key is
// wrong. Rate limits and overloads clear on their own and are not paged.
export function classifyAnthropicError(status, body) {
  const code = Number(status) || 0
  const message = body instanceof Error ? String(body.message || '').slice(0, 400) : upstreamMessage(body)
  const type = body instanceof Error ? '' : upstreamType(body)
  const looksLikeSpend = SPEND_PATTERNS.some((re) => re.test(message)) || type === 'billing_error'

  let kind
  if (looksLikeSpend) kind = 'spend_limit'
  else if (code === 401 || type === 'authentication_error') kind = 'auth'
  else if (code === 403 || type === 'permission_error') kind = 'permission'
  else if (code === 429 || type === 'rate_limit_error') kind = 'rate_limit'
  else if (code === 529 || type === 'overloaded_error') kind = 'overloaded'
  else if (code >= 500) kind = 'upstream'
  else if (code === 0) kind = 'network'
  else kind = 'request'

  return {
    kind,
    status: code,
    detail: message || `HTTP ${code || 'network error'}`,
    // A bad key and an exhausted budget both stay broken until a human acts.
    // A malformed request means a bug shipped, which is also worth knowing
    // about promptly — it fails every call on that surface until it is fixed.
    page: kind === 'spend_limit' || kind === 'auth' || kind === 'permission' || kind === 'request',
    // Whether EVERY generation is failing, or only the caller that sent this
    // one. An exhausted budget or a rejected key stops the whole product; a
    // request the API would not accept stops whatever sent it, which may be a
    // shipped surface or may be one script. The alert has to say which, because
    // an operator who is paged with "generation is DOWN" for a single bad
    // request learns to skim the next one.
    blanket: kind === 'spend_limit' || kind === 'auth' || kind === 'permission',
  }
}

// Subject line for the alert email, built here rather than at each call site so
// the two surfaces that page cannot drift apart on how loudly they shout.
export function operatorSubject(c) {
  if (c.kind === 'spend_limit') return 'Reimagine: generation is DOWN — Anthropic spend limit reached'
  if (c.blanket) return `Reimagine: generation is DOWN — Anthropic ${c.kind}`
  return `Reimagine: a generation request was REJECTED — Anthropic ${c.status || 'error'}`
}

// The line under operatorLine that says who is affected. Only a blanket failure
// justifies telling the operator that users are seeing the outage message.
export function operatorImpactLine(c) {
  return c.blanket
    ? 'Every generation is failing. Users are being told Reimagine is temporarily unable to generate new content, and to email bob@career.club if it persists.'
    : 'This is one rejected request, not an outage: anything else generating right now is unaffected. The caller that sent it saw the "temporarily unable to generate" message and will keep seeing it until the request is fixed.'
}

// Operator-facing one-liner for the alert email. Says what to go and check.
export function operatorLine(surface, c) {
  const where = surface ? `${surface}: ` : ''
  if (c.kind === 'spend_limit') {
    return `${where}Anthropic is refusing calls on a spend or usage limit. Users are seeing the "temporarily unable to generate" message on every generation. Raise the limit in the Anthropic console, then confirm a generation succeeds. Upstream said: "${c.detail}"`
  }
  if (c.kind === 'auth') {
    return `${where}Anthropic rejected the API key (HTTP ${c.status}). Every generation is failing. Check ANTHROPIC_API_KEY in Vercel, and redeploy production if you change it — env is injected at build time. Upstream said: "${c.detail}"`
  }
  if (c.kind === 'permission') {
    return `${where}Anthropic returned a permission error (HTTP ${c.status}). Check the key's workspace and model access. Upstream said: "${c.detail}"`
  }
  if (c.kind === 'request') {
    return `${where}Anthropic rejected the request itself (HTTP ${c.status}) — a field it does not accept, or a body it could not read. Nothing is wrong with the account or the key. If the surface named above is a shipped code path, every call on it fails until the field is fixed; if it came from a script or a one-off caller, nothing else is affected. Upstream said: "${c.detail}"`
  }
  return `${where}Anthropic returned HTTP ${c.status} (${c.kind}). Upstream said: "${c.detail}"`
}
