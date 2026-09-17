// Shared PayPal REST helpers for api/paypal/create-order.js,
// api/paypal/capture-order.js and api/webhooks/paypal.js. See
// Output/handoff/2026-09-17_paypal-commerce-integration.md.
//
// Sandbox/Live switching: derived from VERCEL_ENV (already how
// scripts/deploy-migrate.mjs decides whether to auto-apply migrations),
// not a second set of suffixed env vars. Preview deployments run Sandbox,
// Production runs Live, Bob never has to tell the code which one it is --
// only PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET / PAYPAL_WEBHOOK_ID need to
// hold different values per Vercel environment (Vercel scopes env vars per
// environment already; this is the same mechanism CLAUDE.md documents for
// ADMIN_LOGIN_EMAILS).
export const PAYPAL_API_BASE = process.env.VERCEL_ENV === 'production'
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com'

export const asText = v => (typeof v === 'string' && v.trim() ? v.trim() : null)
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Cached across warm invocations of the same function instance. PayPal
// client-credentials tokens last ~9 hours; refetching on every request
// would be a needless round trip on every donation click. A cold start
// (or a token that expired mid-instance-lifetime) just refetches.
let cachedToken = null
let cachedTokenExpiresAt = 0

export async function getAccessToken() {
  if (cachedToken && Date.now() < cachedTokenExpiresAt) return cachedToken

  const clientId = process.env.PAYPAL_CLIENT_ID
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error('PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET not configured')
  }

  const res = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })
  if (!res.ok) {
    throw new Error(`PayPal token request failed: ${res.status}`)
  }
  const data = await res.json()
  cachedToken = data.access_token
  // Refresh a little early (60s) rather than racing the exact expiry.
  cachedTokenExpiresAt = Date.now() + (Number(data.expires_in) || 0) * 1000 - 60_000
  return cachedToken
}

export async function paypalFetch(path, { method = 'GET', body, headers } = {}) {
  const token = await getAccessToken()
  const res = await fetch(`${PAYPAL_API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let json = null
  try { json = text ? JSON.parse(text) : null } catch { /* leave null, ok reflects failure */ }
  return { ok: res.ok, status: res.status, json }
}
