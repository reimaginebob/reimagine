// Resend contact + segment membership, shared by the "all registered users"
// backfill (api/admin/reimagine-segment.js) and account creation
// (api/auth/verify.js).
//
// Deliberately import-free. api/auth/verify.js imports this, and a module that
// fails to load there breaks every sign-in, not just the segment sync.

// "Reimagine — All Registered Users". Not a secret — account configuration.
// Distinct from the "General" segment api/admin/corner-segment.js fills, which
// is reserved for Corner people WITHOUT an account; never cross the two.
export const ALL_USERS_SEGMENT_ID = '75a3b678-44c9-473e-b082-b5add5a1d12d'

const API = 'https://api.resend.com'
const REQUEST_TIMEOUT_MS = 10_000
const MAX_429_RETRIES = 3

// Same parsing as api/admin/send-campaign.js: these operator addresses are
// excluded from anything that reaches users' inboxes.
export function parseAdminEmails(envValue) {
  if (typeof envValue !== 'string') return []
  return envValue.split(',').map(e => e.trim().toLowerCase()).filter(e => e.length > 0)
}

const sleep = ms => new Promise(r => setTimeout(r, ms))

// Resend rate-limits per team; a backfill of a couple hundred contacts will hit
// it. Honour retry-after on 429 rather than pacing every call.
async function resendFetch(apiKey, path, { method = 'GET', body } = {}) {
  for (let attempt = 0; ; attempt++) {
    const resp = await fetch(`${API}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
    if (resp.status !== 429 || attempt >= MAX_429_RETRIES) return resp
    const retryAfter = Number(resp.headers.get('retry-after'))
    await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter, 5) * 1000 : 1000 * (attempt + 1))
  }
}

async function failText(resp) {
  const t = await resp.text().catch(() => '')
  return `${resp.status} ${t.slice(0, 200)}`
}

// PATCH first, POST on 404 — same order as api/admin/send-campaign.js. An empty
// PATCH leaves an existing contact's name, segments and unsubscribe choice
// untouched; this must never overwrite somebody's subscription preferences.
// Returns the contact id when Resend reports one, so the segment add does not
// depend on the path accepting an email in place of an id.
export async function ensureContact(apiKey, { email, firstName, lastName }) {
  const patch = await resendFetch(apiKey, `/contacts/${encodeURIComponent(email)}`, { method: 'PATCH', body: {} })
  if (patch.ok) {
    const json = await patch.json().catch(() => ({}))
    return { id: json.id || null, created: false }
  }
  if (patch.status !== 404) throw new Error(`contact lookup failed ${await failText(patch)}`)
  const create = await resendFetch(apiKey, '/contacts', {
    method: 'POST',
    body: { email, first_name: firstName || undefined, last_name: lastName || undefined },
  })
  if (!create.ok) throw new Error(`contact create failed ${await failText(create)}`)
  const json = await create.json().catch(() => ({}))
  return { id: json.id || null, created: true }
}

// Adding a contact that is already a member is harmless, so this is idempotent.
export async function addContactToSegment(apiKey, contactIdOrEmail, segmentId) {
  const resp = await resendFetch(
    apiKey,
    `/contacts/${encodeURIComponent(contactIdOrEmail)}/segments/${segmentId}`,
    { method: 'POST' },
  )
  if (!resp.ok) throw new Error(`segment add failed ${await failText(resp)}`)
}

export async function addToAllUsersSegment(apiKey, { email, firstName, lastName }) {
  const contact = await ensureContact(apiKey, { email, firstName, lastName })
  await addContactToSegment(apiKey, contact.id || email, ALL_USERS_SEGMENT_ID)
  return contact
}

export async function listSegmentContacts(apiKey, segmentId) {
  const out = []
  let after = null
  // Bounded rather than while(true): a paging bug that never terminates would
  // burn the function's whole budget and rate-limit the account.
  for (let page = 0; page < 50; page++) {
    const qs = new URLSearchParams({ limit: '100' })
    if (after) qs.set('after', after)
    const resp = await resendFetch(apiKey, `/segments/${segmentId}/contacts?${qs}`)
    if (!resp.ok) throw new Error(`segment contacts ${await failText(resp)}`)
    const json = await resp.json()
    const data = Array.isArray(json.data) ? json.data : []
    out.push(...data)
    if (!json.has_more || data.length === 0) break
    after = data[data.length - 1].id
  }
  return out
}

// For the new-account branch of api/auth/verify.js. Synchronous, never throws,
// never delays the sign-in redirect. On Vercel the work is handed to the
// request context's waitUntil (what @vercel/functions' waitUntil reads, without
// pulling that package and its dependency tree into the sign-in function), so
// it finishes after the response is sent. Anything missed here is picked up by
// re-running POST /api/admin/reimagine-segment.
export function syncNewUserToAllUsersSegment({ email, firstName, lastName }) {
  try {
    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey || !email) return
    if (parseAdminEmails(process.env.ADMIN_EMAILS).includes(String(email).trim().toLowerCase())) return

    const work = addToAllUsersSegment(apiKey, { email, firstName, lastName }).catch(err => {
      console.error('resend-segments: new-account segment sync failed', err && err.message)
    })
    const ctx = globalThis[Symbol.for('@vercel/request-context')]?.get?.()
    if (ctx && typeof ctx.waitUntil === 'function') ctx.waitUntil(work)
  } catch (err) {
    console.error('resend-segments: new-account segment sync not started', err && err.message)
  }
}
