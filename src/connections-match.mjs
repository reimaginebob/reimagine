// src/connections-match.mjs
// "Who You Know Here" — parse a LinkedIn Connections.csv and match its rows
// against the company on an Opportunity Playbook.
//
// Pure and dependency-free so scripts/test-connections-match.mjs can exercise it
// under plain node (the local dev preview serves stale bundles, so the browser is
// not a reliable place to verify this logic).
//
// WHAT THE FILE IS. LinkedIn's own "Download your data" article documents the
// Connections export as: first name, last name, public profile URL, email
// address, company, position, and connection date, for 1st degree connections
// only. Email is present only when that connection allowed it in their privacy
// settings, so a large share of rows have none — nothing here may depend on it.
// LinkedIn states plainly that they never export other members' data, which is
// why second-degree matching is impossible by design and is handed off to a
// search link instead (see linkedInSecondDegreeUrl below).
//
// The file is read in the browser and never uploaded. Only the handful of people
// the user chooses to save reach the server, on the opportunity record.

// ── CSV ──────────────────────────────────────────────────────────────────────

// RFC4180-ish parse. Company names carry commas ("Ameriprise Financial Services,
// Inc.") and titles carry quotes, so a split(',') would corrupt real rows.
export function parseCsv(text) {
  const rows = []
  let row = [], field = '', quoted = false, i = 0
  const s = String(text || '').replace(/^﻿/, '')
  while (i < s.length) {
    const ch = s[i]
    if (quoted) {
      if (ch === '"') {
        if (s[i + 1] === '"') { field += '"'; i += 2; continue }
        quoted = false; i++; continue
      }
      field += ch; i++; continue
    }
    if (ch === '"') { quoted = true; i++; continue }
    if (ch === ',') { row.push(field); field = ''; i++; continue }
    if (ch === '\r') { i++; continue }
    if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; continue }
    field += ch; i++
  }
  if (field.length || row.length) { row.push(field); rows.push(row) }
  return rows
}

// LinkedIn puts a "Notes:" preamble above the real header, and has changed how
// many lines it runs to. Rather than skipping a fixed count, find the header row
// by what it contains — that survives the preamble growing or going away.
function findHeader(rows) {
  for (let i = 0; i < Math.min(rows.length, 25); i++) {
    const lower = rows[i].map(c => String(c || '').trim().toLowerCase())
    if (lower.includes('first name') && lower.includes('last name')) return i
  }
  return -1
}

const HEADER_ALIASES = {
  'first name': 'first',
  'last name': 'last',
  'url': 'url',
  'email address': 'email',
  'company': 'company',
  'position': 'position',
  'connected on': 'connectedOn',
}

/**
 * Parse a LinkedIn Connections.csv into compact records.
 * Returns { people, skipped, error }. `people` use short keys because this is
 * held in browser storage, where a few thousand rows of long keys is real weight.
 */
export function parseConnectionsCsv(text) {
  const rows = parseCsv(text).filter(r => r.some(c => String(c || '').trim() !== ''))
  const h = findHeader(rows)
  if (h === -1) {
    return { people: [], skipped: 0, error: 'no-header' }
  }
  const cols = rows[h].map(c => HEADER_ALIASES[String(c || '').trim().toLowerCase()] || null)
  if (!cols.includes('first') || !cols.includes('company')) {
    return { people: [], skipped: 0, error: 'no-header' }
  }
  const people = []
  let skipped = 0
  for (let i = h + 1; i < rows.length; i++) {
    const r = rows[i]
    const rec = {}
    for (let c = 0; c < cols.length; c++) {
      if (cols[c]) rec[cols[c]] = String(r[c] == null ? '' : r[c]).trim()
    }
    const name = [rec.first, rec.last].filter(Boolean).join(' ').trim()
    // A row with no name is unusable; a row with no company can never match an
    // opportunity, so it is dropped rather than carried in storage forever.
    if (!name || !String(rec.company || '').trim()) { skipped++; continue }
    people.push({
      n: name,
      c: String(rec.company).trim(),
      t: String(rec.position || '').trim(),
      u: String(rec.url || '').trim(),
      d: String(rec.connectedOn || '').trim(),
      // Present only when that connection allowed email export in their own
      // privacy settings, so most rows have none. Kept because Making Your Own
      // Weather prefers email over a LinkedIn message, and knowing whether we
      // already have the address decides which draft the card leads with.
      e: String(rec.email || '').trim(),
    })
  }
  return { people, skipped, error: people.length ? null : 'no-rows' }
}

// ── Company matching ─────────────────────────────────────────────────────────

// Dropped before comparison: they carry no identity, and leaving them in means
// "Ameriprise Financial Services, Inc." never matches "Ameriprise Financial".
const LEGAL_SUFFIXES = new Set([
  'inc', 'incorporated', 'llc', 'llp', 'lp', 'ltd', 'limited', 'co', 'corp',
  'corporation', 'company', 'plc', 'gmbh', 'ag', 'sa', 'nv', 'bv', 'ab', 'as',
  'oy', 'pty', 'pte', 'srl', 'spa',
])

// Words too generic to carry a match on their own. A connection at "First
// National Bank" must not match an opportunity at "First Republic" just because
// both start with "first".
const WEAK_FIRST_TOKENS = new Set([
  'the', 'first', 'national', 'general', 'american', 'united', 'global',
  'international', 'federal', 'standard', 'premier', 'advanced', 'allied',
  'universal', 'central', 'northern', 'southern', 'eastern', 'western', 'new',
])

export function normalizeCompany(raw) {
  const base = String(raw || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
  if (!base) return { key: '', tokens: [] }
  const tokens = base.split(' ').filter(t => t && !LEGAL_SUFFIXES.has(t))
  return { key: tokens.join(' '), tokens }
}

function isPrefixOf(short, long) {
  if (!short.length || short.length >= long.length) return false
  for (let i = 0; i < short.length; i++) if (short[i] !== long[i]) return false
  return true
}

/**
 * Does this connection's employer refer to the same company as the opportunity?
 * Returns null, 'exact', or 'likely'. 'likely' is a leading-token-run match
 * ("Ameriprise" vs "Ameriprise Financial Services"), which is only trusted when
 * the shared leading token is distinctive enough to mean something.
 */
export function companyMatch(connectionCompany, targetCompany) {
  return matchNormalized(normalizeCompany(connectionCompany), normalizeCompany(targetCompany))
}

// The comparison itself, against already-normalized pairs. matchConnections
// normalizes the target ONCE and then walks the list — at a few thousand
// connections, re-normalizing the target per row was the whole cost of a render.
function matchNormalized(a, b) {
  if (!a.key || !b.key) return null
  if (a.key === b.key) return 'exact'
  const short = a.tokens.length <= b.tokens.length ? a.tokens : b.tokens
  const long = short === a.tokens ? b.tokens : a.tokens
  if (!isPrefixOf(short, long)) return null
  // One weak token ("united", "first") is not identity. Two or more leading
  // tokens in common is, even when each alone is generic.
  if (short.length === 1 && WEAK_FIRST_TOKENS.has(short[0])) return null
  return 'likely'
}

/**
 * Everyone in `people` who appears to work at `targetCompany`.
 * Exact matches first, then likely ones; alphabetical inside each group so the
 * order does not shuffle between renders.
 */
export function matchConnections(people, targetCompany) {
  if (!targetCompany || !Array.isArray(people) || !people.length) return []
  const target = normalizeCompany(targetCompany)
  if (!target.key) return []
  const out = []
  for (const p of people) {
    const m = matchNormalized(normalizeCompany(p.c), target)
    if (m) out.push({ ...p, match: m })
  }
  return out.sort((x, y) =>
    x.match !== y.match ? (x.match === 'exact' ? -1 : 1) : x.n.localeCompare(y.n))
}

// ── LinkedIn hand-off ────────────────────────────────────────────────────────

// The ONE place a LinkedIn search URL is constructed. Their search parameters
// are an internal product surface, not a published interface, so they can change
// without notice — when this breaks it is a one-line fix here. The failure is
// soft by design: if `network` stops being honored the user still lands on a
// LinkedIn people search for the company, which beats starting from scratch.
//
// BY KEYWORD, NOT BY LINKEDIN'S "CURRENT COMPANIES" FACET, AND ON PURPOSE. The
// facet needs the company's internal LinkedIn id, which we do not have — but
// even given the id the keyword is the better search here:
//
//   - It matches anywhere on a profile, so it returns FORMER employees as well
//     as current ones. An alumnus is usually the most candid conversation
//     available about why a seat is open and who really fills it, because they
//     are no longer protecting a relationship. The facet drops every one of
//     them. Our own matcher cannot find them either — LinkedIn's export carries
//     only each connection's CURRENT employer, no history — so this search is
//     the only place they surface at all.
//   - It survives a company trading under several entities, which is the common
//     case rather than the exception. Checked live on 2026-08-30: LinkedIn's
//     Current companies filter for "Imerys" offers Imerys, Imerys British
//     Lithium, Gimpex Imerys India, Imerys Performance Minerals, Imerys Fused
//     Minerals Salto, Imerys Unidade Ipixuna do Pará and imerys samrec
//     vermiculite, with more below the scroll — and "Imerys USA, Inc.", where
//     one of the actual results worked, was not among them. Picking any single
//     entity drops most of the people worth reaching.
//
// The cost is noise when the company's name is a common word, which is the one
// case worth narrowing — so the card points at LinkedIn's own filters for it
// rather than guessing on the user's behalf.
export function linkedInSecondDegreeUrl(company) {
  const q = String(company || '').trim()
  if (!q) return 'https://www.linkedin.com/search/results/people/'
  return 'https://www.linkedin.com/search/results/people/?keywords=' +
    encodeURIComponent(q) + '&network=' + encodeURIComponent('["S"]')
}

// Deep link straight to the export page, which skips the four-step menu walk
// (Me -> Settings & Privacy -> Data Privacy -> Download your data). Verified
// 2026-08-30: signed out this redirects to login and returns here afterward.
// What the LinkedIn search actually asks for: the company, plus anything the
// user added to narrow it. Kept separate from the company itself because the
// extra terms steer the SEARCH only — they never touch which of the user's own
// connections are matched, and the card says so.
export function searchQuery(company, extra) {
  return [String(company || '').trim(), String(extra || '').trim()].filter(Boolean).join(' ')
}

export const SEARCH_STORAGE_KEY = 'reimagine_conn_search_v1'

// The company this card matches and searches on, and any narrowing terms. Falls
// back to the company Reimagine pulled off the posting, which is right almost
// always — this exists for when it is not, or when the user wants a parent, a
// subsidiary, or a former name instead.
export function resolveSearch(override, recordCompany) {
  const o = override && typeof override === 'object' ? override : {}
  const company = typeof o.company === 'string' && o.company.trim() ? o.company.trim() : String(recordCompany || '').trim()
  const extra = typeof o.extra === 'string' ? o.extra.trim() : ''
  const edited = company !== String(recordCompany || '').trim() || !!extra
  return { company, extra, edited }
}

export const LINKEDIN_DOWNLOAD_URL = 'https://www.linkedin.com/mypreferences/d/download-my-data'
export const LINKEDIN_HELP_URL = 'https://www.linkedin.com/help/linkedin/answer/a1339364'

// ── Stored network ───────────────────────────────────────────────────────────

export const NETWORK_STORAGE_KEY = 'reimagine_connections_v1'

// A guard against someone dropping in the wrong export (Messages.csv runs to
// hundreds of thousands of rows). Well above any real connection count.
export const MAX_CONNECTIONS = 30000

export function packNetwork(people, loadedAtIso) {
  return { v: 1, loadedAt: loadedAtIso, people }
}

export function unpackNetwork(raw) {
  if (!raw || typeof raw !== 'object') return null
  if (raw.v !== 1 || !Array.isArray(raw.people)) return null
  return { loadedAt: typeof raw.loadedAt === 'string' ? raw.loadedAt : null, people: raw.people }
}

// Days since the file was loaded — the only staleness signal available. The CSV
// carries no export date, so we never claim to know when LinkedIn generated it.
export function daysSince(iso, nowMs) {
  if (!iso) return null
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return null
  return Math.floor((nowMs - t) / 86400000)
}

export const STALE_AFTER_DAYS = 90

// ── Outreach drafts ──────────────────────────────────────────────────────────

// Drafts live beside the network, on the device, for the same reason the network
// does: the file itself is never uploaded, so what is derived from it stays with
// it. Keyed by opportunity and by person.
//
// The recipient's name IS sent when a draft is generated. It is on a public
// LinkedIn profile, and the user is about to send this very person a message —
// the relationship is the premise of the action, not a secret. An earlier build
// wrote the greeting as a {{NAME}} token and substituted it in the browser; that
// bought nothing real and cost a placeholder that could leak into a sent message.
export const OUTREACH_STORAGE_KEY = 'reimagine_outreach_v1'

export function outreachKey(recordId, person) {
  const who = (person && (person.u || person.n)) || ''
  return `${recordId || ''}::${who}`
}

export const firstNameOf = (full) => String(full || '').trim().split(/\s+/)[0] || ''

// ── Working out an address we were not given ─────────────────────────────────

// Most corporate mail follows a handful of conventions off one domain, so with
// the domain supplied by the USER we can lay out the likely forms rather than
// invent one. These are candidates to verify, never "their address" — the UI
// must never present one as known, and nothing here is ever sent anywhere.
export const HUNTER_URL = 'https://hunter.io'

// Accepts "ameriprise.com", "@ameriprise.com", or a pasted URL, and returns the
// bare domain. Returns '' for anything that is not plausibly one.
export function cleanDomain(raw) {
  let s = String(raw || '').trim().toLowerCase()
  if (!s) return ''
  s = s.replace(/^mailto:/, '').replace(/^https?:\/\//, '').replace(/^www\./, '')
  s = s.split('/')[0].split('?')[0]
  const at = s.lastIndexOf('@')
  if (at !== -1) s = s.slice(at + 1)
  s = s.replace(/^[^a-z0-9]+/, '').replace(/[^a-z0-9.-]+$/, '')
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(s)) return ''
  if (!s.includes('.')) return ''
  return s
}

const asciiPart = (s) => String(s || '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[^a-z]/g, '')

/**
 * The likely address forms for a name at a domain, most common first.
 * Empty when either input is missing or the name has no usable letters.
 */
export function emailGuesses(fullName, domain) {
  const d = cleanDomain(domain)
  if (!d) return []
  const parts = String(fullName || '').trim().split(/\s+/).map(asciiPart).filter(Boolean)
  if (!parts.length) return []
  const first = parts[0]
  const last = parts.length > 1 ? parts[parts.length - 1] : ''
  const forms = last
    ? [`${first}.${last}`, `${first}${last}`, `${first[0]}${last}`, `${first}_${last}`, `${first}`]
    : [first]
  const seen = new Set()
  return forms.filter(f => f && !seen.has(f) && seen.add(f)).map(f => `${f}@${d}`)
}

export const DOMAIN_STORAGE_KEY = 'reimagine_conn_domains_v1'

export function mailtoUrl(email, subject, body) {
  const to = String(email || '').trim()
  if (!to) return null
  const q = []
  if (subject) q.push('subject=' + encodeURIComponent(subject))
  if (body) q.push('body=' + encodeURIComponent(body))
  return 'mailto:' + encodeURIComponent(to).replace(/%40/g, '@') + (q.length ? '?' + q.join('&') : '')
}
