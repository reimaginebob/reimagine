// Guards the "Reimagine — All Registered Users" Resend segment: the shared
// helper (api/_lib/resend-segments.js), the backfill endpoint
// (api/admin/reimagine-segment.js), and the new-account hook in
// api/auth/verify.js.
//
// BEHAVIORAL for the helper, with fetch stubbed. SOURCE-PRESENCE for the
// endpoint and verify.js, which need a DB and a session to run.
import fs from 'node:fs'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

const SEGMENT = '75a3b678-44c9-473e-b082-b5add5a1d12d'
const GENERAL = '29138278-5ee9-4c27-821b-64a3581a297a'

const seg = await import('../api/_lib/resend-segments.js')

let calls = []
function stubFetch(responder) {
  calls = []
  globalThis.fetch = async (url, init = {}) => {
    const call = { url: String(url), method: init.method || 'GET', body: init.body ? JSON.parse(init.body) : undefined }
    calls.push(call)
    const r = await responder(call, calls.length)
    return new Response(r.body === undefined ? '' : JSON.stringify(r.body), { status: r.status, headers: r.headers || {} })
  }
}

check(seg.ALL_USERS_SEGMENT_ID === SEGMENT, 'segment id is not the All Registered Users segment')

// --- ensureContact ------------------------------------------------------------
stubFetch(() => ({ status: 200, body: { object: 'contact', id: 'c-existing' } }))
let r = await seg.ensureContact('k', { email: 'A@x.com', firstName: 'A', lastName: 'B' })
check(r.id === 'c-existing' && r.created === false, 'existing contact did not resolve to its id')
check(calls.length === 1 && calls[0].method === 'PATCH' && calls[0].body && Object.keys(calls[0].body).length === 0,
  'existing contact was not an empty PATCH (would overwrite preferences)')

stubFetch((c) => c.method === 'PATCH' ? { status: 404, body: {} } : { status: 200, body: { id: 'c-new' } })
r = await seg.ensureContact('k', { email: 'n@x.com', firstName: 'N', lastName: '' })
check(r.id === 'c-new' && r.created === true, 'new contact not created')
check(calls[1].method === 'POST' && calls[1].url.endsWith('/contacts') && calls[1].body.email === 'n@x.com' && calls[1].body.first_name === 'N',
  'contact create body wrong')

stubFetch(() => ({ status: 500, body: { message: 'boom' } }))
let threw = false
try { await seg.ensureContact('k', { email: 'e@x.com' }) } catch { threw = true }
check(threw, 'non-404 PATCH failure did not throw')

// --- addToAllUsersSegment -----------------------------------------------------
stubFetch(() => ({ status: 200, body: { id: 'c-1' } }))
await seg.addToAllUsersSegment('k', { email: 'a@x.com' })
check(calls.length === 2 && calls[1].method === 'POST' && calls[1].url === `https://api.resend.com/contacts/c-1/segments/${SEGMENT}`,
  'segment add did not target the contact id and All Registered Users segment')
check(!calls.some(c => c.url.includes(GENERAL)), 'touched the Corner "General" segment')

stubFetch((c) => c.method === 'PATCH' ? { status: 200, body: {} } : { status: 200, body: {} })
await seg.addToAllUsersSegment('k', { email: 'no-id@x.com' })
check(calls[1].url === `https://api.resend.com/contacts/no-id%40x.com/segments/${SEGMENT}`, 'no-id fallback did not use the email')

stubFetch((c, n) => n === 1 ? { status: 429, body: {}, headers: { 'retry-after': '0.01' } } : { status: 200, body: { id: 'c-r' } })
await seg.addToAllUsersSegment('k', { email: 'r@x.com' })
check(calls.length === 3 && calls[0].method === 'PATCH' && calls[1].method === 'PATCH', 'a 429 was not retried')

stubFetch((c) => c.method === 'PATCH' ? { status: 200, body: { id: 'c' } } : { status: 422, body: { message: 'bad' } })
threw = false
try { await seg.addToAllUsersSegment('k', { email: 'f@x.com' }) } catch { threw = true }
check(threw, 'segment add failure did not throw')

// --- listSegmentContacts paging ---------------------------------------------
stubFetch((c, n) => n === 1
  ? { status: 200, body: { data: [{ id: 'p1', email: 'a@x.com' }], has_more: true } }
  : { status: 200, body: { data: [{ id: 'p2', email: 'b@x.com' }], has_more: false } })
const listed = await seg.listSegmentContacts('k', SEGMENT)
check(listed.length === 2 && calls[1].url.includes('after=p1'), 'segment contact paging broken')

// --- parseAdminEmails ---------------------------------------------------------
const admins = seg.parseAdminEmails(' Bob@Career.club , ,x@y.com')
check(admins.length === 2 && admins[0] === 'bob@career.club', 'parseAdminEmails does not trim/lowercase/drop blanks')
check(seg.parseAdminEmails(undefined).length === 0, 'parseAdminEmails(undefined) not empty')

// --- syncNewUserToAllUsersSegment: never throws, never blocks -----------------
const CTX = Symbol.for('@vercel/request-context')
const flush = () => new Promise(r => setTimeout(r, 30))
const origError = console.error
let errors = []
console.error = (...a) => { errors.push(a.join(' ')) }

process.env.RESEND_API_KEY = 'k'
process.env.ADMIN_EMAILS = 'ops@career.club'

let waited = []
globalThis[CTX] = { get: () => ({ waitUntil: p => { waited.push(p) } }) }
stubFetch(() => ({ status: 200, body: { id: 'c-sync' } }))
let ret = seg.syncNewUserToAllUsersSegment({ email: 'new@x.com', firstName: 'N' })
check(ret === undefined, 'sync returned something the caller might await')
check(waited.length === 1, 'sync did not hand its work to waitUntil')
await Promise.all(waited)
check(calls.length === 2 && calls[1].url.endsWith(`/segments/${SEGMENT}`), 'sync did not add the new user to the segment')

waited = []
stubFetch(() => ({ status: 200, body: {} }))
seg.syncNewUserToAllUsersSegment({ email: 'OPS@career.club' })
await flush()
check(calls.length === 0 && waited.length === 0, 'an ADMIN_EMAILS address was synced')

delete process.env.RESEND_API_KEY
seg.syncNewUserToAllUsersSegment({ email: 'nokey@x.com' })
await flush()
check(calls.length === 0, 'sync ran without RESEND_API_KEY')
process.env.RESEND_API_KEY = 'k'

errors = []
globalThis.fetch = async () => { throw new Error('network down') }
let syncThrew = false
try { seg.syncNewUserToAllUsersSegment({ email: 'down@x.com' }) } catch { syncThrew = true }
await Promise.all(waited); await flush()
check(!syncThrew, 'sync threw when Resend was unreachable')
check(errors.some(e => e.includes('segment sync failed')), 'a failed sync was not logged')

globalThis[CTX] = { get: () => { throw new Error('context broken') } }
errors = []
syncThrew = false
try { seg.syncNewUserToAllUsersSegment({ email: 'ctx@x.com' }) } catch { syncThrew = true }
check(!syncThrew, 'sync threw when the request context was broken')

delete globalThis[CTX]
syncThrew = false
stubFetch(() => ({ status: 200, body: { id: 'c-local' } }))
try { seg.syncNewUserToAllUsersSegment({ email: 'local@x.com' }) } catch { syncThrew = true }
await flush()
check(!syncThrew && calls.length === 2, 'sync did not run outside Vercel (no request context)')
console.error = origError

// --- source presence ----------------------------------------------------------
const helperSrc = fs.readFileSync(new URL('../api/_lib/resend-segments.js', import.meta.url), 'utf8')
check(!/^\s*import\s/m.test(helperSrc), 'resend-segments.js gained an import (a load failure there breaks sign-in)')

const verifySrc = fs.readFileSync(new URL('../api/auth/verify.js', import.meta.url), 'utf8')
const createdIdx = verifySrc.indexOf('userId = created[0].id')
const syncIdx = verifySrc.indexOf('syncNewUserToAllUsersSegment(')
const elseIdx = verifySrc.indexOf('} else {')
check(createdIdx > 0 && syncIdx > createdIdx, 'verify.js does not sync right after the new user row is created')
check(syncIdx > elseIdx && syncIdx < verifySrc.indexOf('createSession(userId'), 'verify.js sync is outside the new-account branch')
check(!/await\s+syncNewUserToAllUsersSegment/.test(verifySrc), 'verify.js awaits the segment sync (would delay the redirect)')
check((verifySrc.match(/syncNewUserToAllUsersSegment\(/g) || []).length === 1, 'verify.js syncs in more than one place (existing users would re-sync every login)')

const endpointSrc = fs.readFileSync(new URL('../api/admin/reimagine-segment.js', import.meta.url), 'utf8')
check(/checkAdminAuth\(req, res\)\)\s*!==\s*'admin'/.test(endpointSrc), 'endpoint is not admin-only')
check(!/allowAnalyst/.test(endpointSrc), 'endpoint allows analyst access')
check(/body\.dryRun !== false/.test(endpointSrc), 'endpoint does not default to dry run')
check(/suspended_at IS NULL/.test(endpointSrc) && /LOWER\(email\) <> ALL\(\$\{adminEmails\}::text\[\]\)/.test(endpointSrc),
  'endpoint eligibility lost the suspended / internal exclusions')
check(!endpointSrc.includes(GENERAL), 'endpoint references the Corner "General" segment')
check(!/RECENT_ACTIVITY|last_at|14 days/.test(endpointSrc), 'endpoint picked up send-campaign\'s recent-activity exclusion')
check(!/api\.resend\.com\/(emails|broadcasts)|['"`]\/(emails|broadcasts)/.test(endpointSrc), 'endpoint sends mail; it must only manage membership')

if (failures) { console.error(`test-reimagine-segment: ${failures} failure(s)`); process.exit(1) }
console.log('test-reimagine-segment: ok')
