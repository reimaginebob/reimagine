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
export function linkedInSecondDegreeUrl(company) {
  const q = String(company || '').trim()
  if (!q) return 'https://www.linkedin.com/search/results/people/'
  return 'https://www.linkedin.com/search/results/people/?keywords=' +
    encodeURIComponent(q) + '&network=' + encodeURIComponent('["S"]')
}

// Deep link straight to the export page, which skips the four-step menu walk
// (Me -> Settings & Privacy -> Data Privacy -> Download your data). Verified
// 2026-08-30: signed out this redirects to login and returns here afterward.
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
