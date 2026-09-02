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

function isRunWithin(short, long) {
  if (!short.length || short.length >= long.length) return false
  for (let i = 0; i + short.length <= long.length; i++) {
    let hit = true
    for (let j = 0; j < short.length; j++) if (long[i + j] !== short[j]) { hit = false; break }
    if (hit) return true
  }
  return false
}

/**
 * A weaker signal than companyMatch: the company name appears SOMEWHERE in the
 * employer rather than at the front. "Gimpex Imerys India" and "British Lithium
 * (an Imerys company)" are real entities of a real parent, and a strict
 * leading-token match drops both.
 *
 * Deliberately not folded into companyMatch. Matching mid-string is loose enough
 * to catch coincidence, so these are surfaced as "worth a look" when a search
 * comes back empty, never mixed into the confident list.
 */
export function looseMatch(connectionCompany, targetCompany) {
  const a = normalizeCompany(connectionCompany)
  const b = normalizeCompany(targetCompany)
  if (!a.key || !b.key) return false
  if (matchNormalized(a, b)) return false
  const short = a.tokens.length <= b.tokens.length ? a.tokens : b.tokens
  const long = short === a.tokens ? b.tokens : a.tokens
  if (short.length === 1 && WEAK_FIRST_TOKENS.has(short[0])) return false
  return isRunWithin(short, long)
}

/** Everyone whose employer merely mentions the company. Alphabetical. */
export function looseMatchConnections(people, targetCompany) {
  if (!targetCompany || !Array.isArray(people) || !people.length) return []
  return people
    .filter(p => looseMatch(p.c, targetCompany))
    .sort((x, y) => x.n.localeCompare(y.n))
}

/**
 * Everyone in `people` who appears to work at `targetCompany`.
 * Exact matches first, then likely ones; alphabetical inside each group so the
 * order does not shuffle between renders.
 */
// TRANCHES: an order to work through, not a verdict on each person.
//
// The match sorts exact-before-loose then alphabetically, which is a phone book.
// At 34 people in one company that answers nothing, so the list groups by the
// seniority in their titles and leads with the most senior.
//
// GROUPING IS NOT ADVICE. An earlier version of this named what each band was
// worth asking -- these are the people to ask for a good word, these are the
// people who will tell you what it is like. That was wrong, and wrong in a way
// worth guarding against: a title says nothing about the relationship. A partner
// may be someone they met once at a conference; an analyst may be a former
// direct report who would vouch for them tomorrow. Only the user knows that, and
// the card already asks each person what they want from that contact. The bands
// order the list. The user picks the ask.
//
// What the export gives us per person is name, company, title, profile URL and
// connection date. So seniority reads off the title and warmth off the date.
// Location does NOT exist in Connections.csv, so "same country" is not
// available at all -- it would need a profile visit each.
//
// Function is deliberately NOT a band. Titles carry it inconsistently ("Senior
// Manager" says nothing, "Tax Senior Manager" says plenty), so a function
// grouping would come out half-empty and read as broken rather than partial.

// Matched against the LOWERCASED title, longest-first inside each band so
// "senior manager" is not eaten by "manager". Rank 0 is most senior.
const SENIORITY_BANDS = [
  { rank: 0, id: 'leadership', label: 'Most senior',
    terms: ['chief', 'chairman', 'chairwoman', 'president', 'partner', 'managing director',
            'principal', 'general manager', 'head of', 'c-suite', 'cxo', 'ceo', 'cfo', 'coo',
            'cto', 'chro', 'cmo', 'evp', 'svp', 'executive vice president', 'senior vice president'] },
  { rank: 1, id: 'senior', label: 'Senior',
    terms: ['vice president', 'vp', 'director', 'senior manager', 'sr manager', 'sr. manager'] },
  { rank: 2, id: 'peer', label: 'Managers and specialists',
    terms: ['manager', 'lead', 'senior', 'sr', 'staff', 'consultant', 'engineer', 'analyst',
            'associate', 'specialist', 'advisor', 'accountant', 'recruiter', 'coordinator',
            'principal', 'scientist', 'architect', 'researcher', 'developer', 'designer'] },
]

const UNBANDED = { rank: 3, id: 'other', label: 'Titles that do not say much' }

/**
 * Which seniority band a title falls in.
 *
 * A title we cannot read lands in `other` rather than being guessed into a band.
 * A wrong band would put someone in the wrong place in the queue, and the fix for
 * an unreadable title is to say so rather than to invent a rank.
 */
// "Principal" alone is partner-equivalent at a firm like Deloitte, but
// "Principal Scientist" or "Principal Engineer" is an individual contributor, and
// the two belong in different places in the list. Followed by a role noun it is
// seniority within a craft; alone, or followed by a comma, "at" or "of", it is
// the rank.
const PRINCIPAL_IC = /(^|[^a-z])principal\s+(?!at\b|of\b)[a-z]/

export function seniorityBand(title) {
  const t = String(title || '').toLowerCase()
  if (!t.trim()) return UNBANDED.id
  const principalIsCraft = PRINCIPAL_IC.test(t)
  for (const b of SENIORITY_BANDS) {
    for (const term of b.terms) {
      if (term === 'principal' && principalIsCraft) continue
      // Word-ish boundaries, so "vp" does not match inside another word and
      // "director" still matches "Managing Director of Tax".
      const re = new RegExp('(^|[^a-z])' + term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([^a-z]|$)')
      if (re.test(t)) return b.id
    }
  }
  return UNBANDED.id
}

/** Years since the connection was made, or null when the date is missing or unreadable. */
export function yearsConnected(connectedOn, now) {
  const raw = String(connectedOn || '').trim()
  if (!raw) return null
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return null
  const ms = (now instanceof Date ? now : new Date(now)).getTime() - d.getTime()
  if (!Number.isFinite(ms) || ms < 0) return null
  return ms / (365.25 * 24 * 60 * 60 * 1000)
}

/**
 * The matches grouped into tranches, most senior first, empty bands dropped.
 *
 * Inside a band the most recently connected come first: someone met eight months
 * ago and someone met in 2011 need different opening lines, and the recent one is
 * usually the easier note to write.
 */
export function tranches(hits, now) {
  const list = Array.isArray(hits) ? hits : []
  const bands = SENIORITY_BANDS.concat([UNBANDED])
  const when = now || new Date()
  return bands
    .map(b => ({
      id: b.id,
      label: b.label,
      people: list
        .filter(h => seniorityBand(h && h.t) === b.id)
        .sort((x, y) => {
          const a = yearsConnected(x && x.d, when)
          const c = yearsConnected(y && y.d, when)
          if (a === null && c === null) return String(x.n || '').localeCompare(String(y.n || ''))
          if (a === null) return 1
          if (c === null) return -1
          return a - c
        }),
    }))
    .filter(b => b.people.length > 0)
}

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
function peopleSearchUrl(company, degrees) {
  const q = String(company || '').trim()
  if (!q) return 'https://www.linkedin.com/search/results/people/'
  return 'https://www.linkedin.com/search/results/people/?keywords=' +
    encodeURIComponent(q) + '&network=' + encodeURIComponent(JSON.stringify(degrees))
}

// THE THIRD DOOR: alumni of your school who work there.
//
// The first door is someone you already know, out of the Connections file. The
// second is someone who knows someone, through LinkedIn's own search. This is
// for the case both come up empty and you still need a reason for a stranger to
// take your call. A shared school is one of the few that reliably works.
//
// Checked live on 2026-09-01 against a real account. Three things this settles:
//
//   - The alumni page takes a company as PLAIN TEXT: /school/<slug>/people/
//     ?keywords=Imerys returns alumni matching it. Selecting the company from
//     the page's own filter instead produces ?facetCurrentCompany=1038 -- an
//     internal id we cannot know from a job description, the same wall that made
//     the company facet unusable for the second-degree search. The keyword form
//     is the one we can build.
//   - It covers every degree at once and labels each row 1st / 2nd / 3rd+, and
//     it names mutual connections inline on the second-degree rows, so the
//     introduction path is on the same line as the reason to reach out.
//   - Keyword matching is loose. "Imerys" returned 26 alumni of whom 7 actually
//     worked there; the rest matched some other way. The page's own "Where they
//     work" panel shows the true count and narrows to it in one click, so the
//     card sends people there rather than pretending the raw number is the
//     answer.
//
// What it cannot do: LinkedIn dropped the graduation-year filter, and the rows
// carry no years, so "same era" cannot be filtered or even seen without opening
// profiles. Worth saying rather than implying the tie is stronger than it is.

/**
 * LinkedIn's slug for a school name.
 *
 * Verified: "University of Tennessee, Knoxville" -> university-of-tennessee-knoxville.
 * An ampersand is dropped rather than spelled out, since LinkedIn writes Texas
 * A&M as texas-a-m-university.
 * Lossy by nature, since the slug is LinkedIn's own and a school can be listed
 * under a name nobody types. A miss lands on a LinkedIn 404 rather than anything
 * destructive, and the card says what to do about it.
 */
export function schoolSlug(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, '-')
}

/** The alumni-of-this-school-who-work-there page, or '' without both parts. */
export function linkedInAlumniUrl(school, company) {
  const slug = schoolSlug(school)
  const q = String(company || '').trim()
  if (!slug || !q) return ''
  return 'https://www.linkedin.com/school/' + slug + '/people/?keywords=' + encodeURIComponent(q)
}

export function linkedInSecondDegreeUrl(company) {
  return peopleSearchUrl(company, ['S'])
}

// The first-degree version of the same search, which makes an empty result
// checkable instead of something the user has to take on faith. If LinkedIn
// shows people this card did not, the file is stale or the match is wrong, and
// either way the user should be able to find that out in one click.
export function linkedInFirstDegreeUrl(company) {
  return peopleSearchUrl(company, ['F'])
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

// ── People added by hand ─────────────────────────────────────────────────────

// Someone the user knows about but the file does not: a connection made since
// the export, a person who changed jobs after it, or a name they got from
// outside LinkedIn entirely. Kept in their own store rather than folded into the
// parsed network, so replacing the connections file does not delete them.
export const MANUAL_STORAGE_KEY = 'reimagine_conn_manual_v1'

export function manualPerson({ name, company, title, url }) {
  const n = String(name || '').trim()
  const c = String(company || '').trim()
  if (!n || !c) return null
  return { n, c, t: String(title || '').trim(), u: String(url || '').trim(), d: '', e: '', m: 1 }
}

// The file is the better source when it has the same person, since it carries
// the connection date and sometimes an address. Matching on profile URL where
// there is one, otherwise on name within the same employer.
function samePerson(a, b) {
  if (a.u && b.u) return a.u.trim().toLowerCase() === b.u.trim().toLowerCase()
  // Company compared with companyMatch rather than by exact key, so a person
  // recorded by hand at "Imerys" is recognised as the same one the next export
  // lists at "Imerys Financial" instead of appearing twice.
  return a.n.trim().toLowerCase() === b.n.trim().toLowerCase() && !!companyMatch(a.c, b.c)
}

/** The parsed file plus anyone added by hand the file does not already hold. */
export function withManual(people, manual) {
  const base = Array.isArray(people) ? people : []
  const extra = Array.isArray(manual) ? manual : []
  const kept = extra.filter(m => m && m.n && m.c && !base.some(p => samePerson(p, m)))
  return kept.length ? base.concat(kept) : base
}

/** Drop one hand-added person. Anything not held by hand is left alone. */
export function withoutManual(manual, person) {
  const list = Array.isArray(manual) ? manual : []
  return list.filter(m => !samePerson(m, person))
}

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
