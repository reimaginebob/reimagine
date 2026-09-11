// Vercel serverless function: verify that a job-posting URL the Go-to-Market
// openings sweep found is a real, live, single posting BEFORE the card shows
// a green badge for it.
//
// Why (Output/handoff/2026-09-11_gtm-openings-verification.md): the sweep's
// web-search call finds a URL near the company name; at two searches and low
// effort it does not read the page it found. On a 2026-09-10 build, six of
// six companies got the badge and five links were dead ends -- two HTTP 404s,
// two list pages with an invented title, one four-month-old LinkedIn posting
// marked "no longer accepting applications." The browser cannot fetch a
// third-party job page cross-origin, so the check has to live here.
//
// POST { url, title } -> 200 { ok, status, reason }
//   ok      true only when: the URL is an http(s) URL on a host we can read,
//           not a list/index/search page, fetches 200 (following up to
//           MAX_REDIRECTS same-host redirects), the page text contains the
//           title (case-insensitive, punctuation- and whitespace-normalized),
//           and the page does not carry a closed-posting phrase.
//   status  the final HTTP status seen (0 when no fetch happened)
//   reason  a short machine token saying why ('verified', 'http_404',
//           'title_absent', 'closed', 'list_page', 'unverifiable_host',
//           'fetch_failed', ...). Logged client-side for the runtime gate;
//           never shown to the user as-is.
//
// A fetch failure is a 200 { ok:false } and never a 5xx: the caller's contract
// is "keep the match only on ok:true," so a timeout has to read as "not
// verified," not as an outage that the sweep's safe-default would swallow the
// same way anyway.
//
// Auth: cookie session + origin allowlist, same shape as api/claude.js (the
// sweep itself already needs a session to run, so a demo/anonymous caller
// never reaches here). Per-user rate limit over the shared auth_ip_events
// log, keyed 'user:<id>' -- the table's key column is named ip_address but
// is plain text, and the one COUNT query it exists for does not care what
// the key is.
//
// SSRF: the URL comes from the model, via the browser, so it is untrusted
// input that names a host this function will connect to. Only http(s); the
// hostname must resolve to a public address (no loopback, link-local,
// private-range, or v4-mapped equivalents) and must not be one of our own
// hosts; every redirect hop is re-checked. Response bodies are capped.

import dns from 'node:dns/promises'
import net from 'node:net'
import { sql } from './_lib/db.js'
import { getSessionUser } from './_lib/session.js'
import { isAllowedOrigin, isAllowedHost } from './_lib/allowed-hosts.js'
import { checkIpRateLimit, logIpEvent } from './_lib/auth-rate-limit.js'
import { isUnverifiableHost, isListPageUrl } from './_lib/posting-hosts.js'

// sql is imported so this function shares api/claude.js's import topology
// (db -> session) and so api/health.js's mirror still covers it; the rate
// limiter and session helper are what actually use the connection.
void sql

export const config = {
  maxDuration: 15,
}

export const FETCH_TIMEOUT_MS = 6000
export const MAX_REDIRECTS = 3
export const MAX_BODY_BYTES = 1_500_000
export const MAX_TITLE_CHARS = 200
export const MAX_URL_CHARS = 2048

// Per user per hour. A Go-to-Market list is up to ~10 companies, a "Find 10
// More" batch adds ten, and each company verifies at most a handful of
// matches; a Re-check tap is one more. 120 covers a heavy session several
// times over and still bounds a script hammering the endpoint.
export const VERIFY_RATE = { windowMinutes: 60, limit: 120 }

// A page that returns 200 and still says the role is gone. Matched against
// the normalized page text (lowercase, punctuation collapsed to spaces), so
// each phrase is written the same way.
export const CLOSED_PHRASES = [
  'no longer accepting applications',
  'this job is no longer available',
  'this job is no longer active',
  'this position is no longer available',
  'this position is no longer open',
  'position has been filled',
  'this position has been filled',
  'job has expired',
  'this job has expired',
  'this posting has expired',
  'this job posting has expired',
  'job is closed',
  'this role is no longer available',
  'this opening is no longer available',
]

const UA = 'Mozilla/5.0 (compatible; ReimagineBot/1.0; +https://reimagine.career.club)'

// ── Pure helpers (exported for scripts/test-openings-verify.mjs) ───────────

// Lowercase, every run of non-alphanumerics to one space, trimmed. Applied to
// both the title and the page so an en dash, an ampersand entity, a line
// break, or a doubled space cannot hide a title that is actually there.
export function normalizeText(s) {
  if (typeof s !== 'string') return ''
  return s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

const NAMED_ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '-', mdash: '-', hellip: '...', rsquo: "'", lsquo: "'", rdquo: '"', ldquo: '"' }

function decodeEntities(s) {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => { const n = parseInt(h, 16); return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : ' ' })
    .replace(/&#(\d+);/g, (_, d) => { const n = parseInt(d, 10); return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : ' ' })
    .replace(/&([a-z]+);/gi, (m, name) => (Object.prototype.hasOwnProperty.call(NAMED_ENTITIES, name.toLowerCase()) ? NAMED_ENTITIES[name.toLowerCase()] : ' '))
}

// HTML -> the text a reader would see, plus the bits a posting's title tends
// to hide in: <title>, meta content= (og:title, description), and JSON-LD
// (Greenhouse, Lever, Workday all emit a JobPosting block with the title).
// Other <script> and <style> bodies are dropped so a JS bundle's strings
// cannot satisfy the title check.
export function htmlToText(html) {
  if (typeof html !== 'string') return ''
  let s = html
  const ldJson = []
  s = s.replace(/<script\b[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi, (_, body) => { ldJson.push(body); return ' ' })
  s = s.replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
  s = s.replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
  s = s.replace(/<!--[\s\S]*?-->/g, ' ')
  const meta = []
  s = s.replace(/<meta\b[^>]*\bcontent\s*=\s*("([^"]*)"|'([^']*)')[^>]*>/gi, (_, __, dq, sq) => { meta.push(dq != null ? dq : (sq || '')); return ' ' })
  s = s.replace(/<[^>]+>/g, ' ')
  return decodeEntities([s, ...meta, ...ldJson].join(' '))
}

// The decision, given what the fetch saw. Pure so the six real-world shapes
// from the field report can be replayed as fixtures without a network.
export function judgePostingPage({ status, html, title }) {
  if (status !== 200) return { ok: false, reason: 'http_' + (status || 0) }
  const t = normalizeText(title)
  if (!t) return { ok: false, reason: 'no_title' }
  const text = normalizeText(htmlToText(html))
  if (!text) return { ok: false, reason: 'empty_page' }
  for (const phrase of CLOSED_PHRASES) {
    if (text.includes(phrase)) return { ok: false, reason: 'closed' }
  }
  if (!text.includes(t)) return { ok: false, reason: 'title_absent' }
  return { ok: true, reason: 'verified' }
}

// What to do with a URL before any network: 'empty' | 'invalid' |
// 'unverifiable' | 'list' | 'fetch'. Mirrors the browser-side order in
// src/App.jsx findOpeningMatches, so the two never disagree on a URL.
export function classifyPostingUrl(url) {
  if (typeof url !== 'string' || !url.trim()) return { kind: 'empty' }
  const raw = url.trim()
  if (raw.length > MAX_URL_CHARS) return { kind: 'invalid' }
  let u
  try { u = new URL(raw) } catch { return { kind: 'invalid' } }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return { kind: 'invalid' }
  if (u.username || u.password) return { kind: 'invalid' }
  if (isUnverifiableHost(raw)) return { kind: 'unverifiable', url: u.href }
  if (isListPageUrl(raw)) return { kind: 'list', url: u.href }
  return { kind: 'fetch', url: u.href }
}

// ── Network guard ──────────────────────────────────────────────────────────

export function isPrivateIp(ip) {
  if (typeof ip !== 'string') return true
  const v = net.isIP(ip)
  if (v === 4) {
    const p = ip.split('.').map(Number)
    if (p[0] === 0 || p[0] === 10 || p[0] === 127) return true
    if (p[0] === 169 && p[1] === 254) return true
    if (p[0] === 172 && p[1] >= 16 && p[1] <= 31) return true
    if (p[0] === 192 && p[1] === 168) return true
    if (p[0] === 100 && p[1] >= 64 && p[1] <= 127) return true
    if (p[0] >= 224) return true
    return false
  }
  if (v === 6) {
    const lower = ip.toLowerCase()
    if (lower === '::' || lower === '::1') return true
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true
    if (lower.startsWith('fe8') || lower.startsWith('fe9') || lower.startsWith('fea') || lower.startsWith('feb')) return true
    const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
    if (mapped) return isPrivateIp(mapped[1])
    return false
  }
  return true
}

// A hostname this function may connect to: not one of ours, not a literal
// private address, and every address it resolves to is public.
export async function isPublicHost(hostname, { lookup = dns.lookup } = {}) {
  const h = (hostname || '').toLowerCase().replace(/\.$/, '')
  if (!h) return false
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal') || h.endsWith('.arpa')) return false
  if (isAllowedHost(h)) return false
  const literal = h.startsWith('[') && h.endsWith(']') ? h.slice(1, -1) : h
  if (net.isIP(literal)) return !isPrivateIp(literal)
  let addrs
  try {
    addrs = await lookup(h, { all: true })
  } catch {
    return false
  }
  if (!Array.isArray(addrs) || addrs.length === 0) return false
  return addrs.every(a => a && typeof a.address === 'string' && !isPrivateIp(a.address))
}

function sameSite(a, b) {
  const strip = h => (h || '').toLowerCase().replace(/^www\./, '')
  return strip(a) === strip(b)
}

async function readCapped(res) {
  if (!res.body || typeof res.body.getReader !== 'function') {
    const t = await res.text()
    return t.length > MAX_BODY_BYTES ? t.slice(0, MAX_BODY_BYTES) : t
  }
  const reader = res.body.getReader()
  const chunks = []
  let total = 0
  try {
    while (total < MAX_BODY_BYTES) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
      total += value.byteLength
    }
  } finally {
    try { await reader.cancel() } catch { /* already closed */ }
  }
  return Buffer.concat(chunks.map(c => Buffer.from(c))).toString('utf8')
}

// Fetch the page, following up to MAX_REDIRECTS redirects that stay on the
// same site (www. variance allowed), re-checking the host at every hop.
// Resolves to { status, html, finalUrl }; a network failure or timeout
// rejects.
export async function fetchPostingPage(url, { fetchImpl = fetch, lookup, timeoutMs = FETCH_TIMEOUT_MS } = {}) {
  let current = new URL(url)
  const origin = current.hostname
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      if (!(await isPublicHost(current.hostname, lookup ? { lookup } : {}))) {
        return { status: 0, html: '', finalUrl: current.href, reason: 'blocked_host' }
      }
      const res = await fetchImpl(current.href, {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          'User-Agent': UA,
          'Accept': 'text/html,application/xhtml+xml,application/json;q=0.8,*/*;q=0.5',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      })
      const status = res.status
      if ([301, 302, 303, 307, 308].includes(status)) {
        const loc = res.headers && res.headers.get ? res.headers.get('location') : null
        if (!loc) return { status, html: '', finalUrl: current.href, reason: 'redirect_no_location' }
        let next
        try { next = new URL(loc, current.href) } catch { return { status, html: '', finalUrl: current.href, reason: 'redirect_invalid' } }
        if (next.protocol !== 'http:' && next.protocol !== 'https:') return { status, html: '', finalUrl: current.href, reason: 'redirect_invalid' }
        if (!sameSite(next.hostname, origin)) return { status, html: '', finalUrl: next.href, reason: 'redirect_offsite' }
        try { if (res.body && typeof res.body.cancel === 'function') await res.body.cancel() } catch { /* ignore */ }
        current = next
        continue
      }
      const ctype = ((res.headers && res.headers.get && res.headers.get('content-type')) || '').toLowerCase()
      if (status === 200 && ctype && !/text|html|xml|json/.test(ctype)) {
        try { if (res.body && typeof res.body.cancel === 'function') await res.body.cancel() } catch { /* ignore */ }
        return { status, html: '', finalUrl: current.href, reason: 'not_html' }
      }
      const html = status === 200 ? await readCapped(res) : ''
      return { status, html, finalUrl: current.href }
    }
    return { status: 0, html: '', finalUrl: current.href, reason: 'too_many_redirects' }
  } finally {
    clearTimeout(timer)
  }
}

// The whole check for one (url, title), network included. Never throws.
export async function verifyPosting(url, title, deps = {}) {
  const c = classifyPostingUrl(url)
  if (c.kind === 'empty') return { ok: false, status: 0, reason: 'empty_url' }
  if (c.kind === 'invalid') return { ok: false, status: 0, reason: 'invalid_url' }
  if (c.kind === 'unverifiable') return { ok: false, status: 0, reason: 'unverifiable_host' }
  if (c.kind === 'list') return { ok: false, status: 0, reason: 'list_page' }
  let page
  try {
    page = await fetchPostingPage(c.url, deps)
  } catch (e) {
    const aborted = e && (e.name === 'AbortError' || /abort/i.test(String(e.message)))
    return { ok: false, status: 0, reason: aborted ? 'timeout' : 'fetch_failed' }
  }
  if (page.reason) return { ok: false, status: page.status || 0, reason: page.reason }
  // The final URL after redirects has to be a posting too: a dead slug that
  // 302s to the careers home would otherwise pass the status check and fail
  // only on the title, which is right but slower to read in the logs.
  if (page.status === 200 && isListPageUrl(page.finalUrl)) return { ok: false, status: 200, reason: 'redirected_to_list' }
  const judged = judgePostingPage({ status: page.status, html: page.html, title })
  return { ok: judged.ok, status: page.status, reason: judged.reason }
}

// ── Handler ────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  const origin = req.headers.origin || req.headers.referer || ''
  if (!isAllowedOrigin(origin)) {
    return res.status(403).json({ error: 'Forbidden' })
  }
  let user = null
  try { user = await getSessionUser(req, res) } catch { /* no/failed session */ }
  if (!user || !user.id) {
    return res.status(401).json({ error: 'Not authenticated' })
  }
  if (user.suspended_at) {
    return res.status(403).json({ error: 'account_suspended' })
  }

  const rateKey = 'user:' + user.id
  const rl = await checkIpRateLimit('verify-posting', rateKey, VERIFY_RATE)
  if (rl.limited) {
    return res.status(429).json({ error: 'Too many checks right now. Try again in a little while.' })
  }
  await logIpEvent('verify-posting', rateKey)

  const body = req.body || {}
  const url = typeof body.url === 'string' ? body.url.trim() : ''
  const title = typeof body.title === 'string' ? body.title.trim().slice(0, MAX_TITLE_CHARS) : ''
  if (!title) {
    return res.status(400).json({ error: 'title required' })
  }
  const result = await verifyPosting(url, title)
  return res.status(200).json(result)
}
