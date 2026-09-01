// Job Search Resources — pure helpers for the sidebar destination.
//
// Design brief: docs/networking-groups-brief.md. Two rules from it are enforced
// here rather than left to the prompt, because a prompt instruction is a draft
// and a detector is a fix (CLAUDE.md §3, the three enforcement layers):
//
// 1. NEVER ASSERT A DATE. Search returns dead event pages confidently — the top
//    "ASCM Charlotte events" result was a 2019 StarChapter page that still
//    ranks, and a query asking for 2026 led with a 2025 conference. We recommend
//    organizations and link their own events page. stripAssertedDate() removes a
//    specific date from any model-written line regardless of prompt compliance.
//    A recurring cadence ("every Monday", "third Tuesday") is NOT a date and is
//    deliberately kept: it describes the organization, not one event.
// 2. NO ROW WITHOUT A FIRST-PARTY LINK. A row with nothing to click cannot be
//    presented as sourced. Following the recruiter precedent, those are
//    SEPARATED into `uncited` rather than discarded.
//
// Plain `.mjs` and no JSX on purpose: importable by both App.jsx (Vite) and the
// Node test at scripts/test-job-search-resources.mjs. It is NOT imported across
// the api/src boundary — that is the .mjs case that caused the 2026-05-27
// outage (CLAUDE.md §8).

// ── Career Club Corner ──────────────────────────────────────────────────────
// SOURCE OF TRUTH: https://corner.career.club. This is a mirror of that page,
// not a rewrite of it, and not a summary of the book. Read 2026-09-01. If the
// day, time, or framing on that page changes, this constant is stale and must
// be updated by hand — never fetch it at runtime.
//
// The headline does both jobs the card needs in one line: "Job search is a team
// sport" is the support-group half (it is the title of Making Your Own Weather
// Lesson 2) and "This is your team" is the networking half. Do not paraphrase.
//
// The cadence is stated here and nowhere else in this feature. It is a recurring
// cadence from a page we own, not a dated event from a search result, so it does
// not violate the no-dates rule above.
export const CAREER_CLUB_CORNER = {
  id: 'career-club-corner',
  name: 'Career Club Corner',
  headline: 'Job search is a team sport. This is your team.',
  blurb: 'Join Bob Goodwin, a LinkedIn Top Voice, and dozens of fellow job seekers as we bring order to the chaos, build community with one another, and find encouragement.',
  kind: 'career network',
  howYouTakePart: 'Online, every Monday at 12:00 ET',
  cost: 'free',
  costNote: 'Free. Every session recorded, so a conflict on a Monday is not a reason to skip it.',
  forPeopleInTransition: true,
  url: 'https://corner.career.club',
  ctaLabel: 'Register for Career Club Corner',
}

// ── Deep links ──────────────────────────────────────────────────────────────
// Constructed rather than searched. These cannot go stale by construction: they
// resolve against the destination's own live index every time they are opened,
// which is the honest answer for everything the search could not verify.

const enc = (s) => encodeURIComponent(String(s || '').trim())

// Meetup slugs a US city as `us--<state>--<city>`, lowercased and hyphenated.
// Verified 2026-09-01 against Boise: meetup.com/find/us--id--boise/tech/.
// Falls back to Meetup's own keyword search when the city cannot be slugged,
// which is always better than a dead path.
export function meetupCitySlug(city, region) {
  const c = String(city || '').trim().toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-')
  const r = String(region || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '')
  if (!c) return ''
  return r && r.length === 2 ? `us--${r}--${c}` : ''
}

export function meetupUrl(city, region, topic) {
  const slug = meetupCitySlug(city, region)
  const t = String(topic || '').trim().toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-')
  if (slug) return `https://www.meetup.com/find/${slug}/${t || 'career-business'}/`
  const q = [topic, city].filter(Boolean).join(' ')
  return `https://www.meetup.com/find/?keywords=${enc(q)}`
}

// The Making Your Own Weather Lesson 2 method, as a live link. Lesson 2's "How
// to Find Your Community" tells the reader to search this exact string, and to
// run it on LinkedIn too. Both are one click here instead of one instruction.
export function jobSearchGroupSearchUrl(city) {
  return `https://www.google.com/search?q=${enc(`"job search group" ${city || ''}`)}`
}

export function linkedInJobSearchGroupUrl(city) {
  return `https://www.linkedin.com/search/results/all/?keywords=${enc(`job search group ${city || ''}`)}`
}

// American Job Centers — the public, WIOA-funded workforce system. Free
// everywhere in the US, and the entry point most job seekers do not know exists.
export const AMERICAN_JOB_CENTER_URL = 'https://www.careeronestop.org/LocalHelp/local-help.aspx'

// ── Dates ───────────────────────────────────────────────────────────────────
// A specific date is a claim that rots. A recurring cadence is a fact about the
// organization. Keep the second, remove the first.

const MONTHS = '(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)'
// A weekday preceded by a recurrence word is a cadence, not a date: "every
// Monday", "third Tuesday of the month", "meets Wednesdays". Those survive.
const CADENCE_RE = new RegExp(`\\b(every|each|weekly|monthly|first|second|third|fourth|last|alternate)\\b`, 'i')

export const DATE_PATTERNS = [
  new RegExp(`\\b${MONTHS}\\.?\\s+\\d{1,2}(?:st|nd|rd|th)?(?:,?\\s*\\d{4})?\\b`, 'gi'), // March 14, 2026
  new RegExp(`\\b\\d{1,2}\\s+${MONTHS}\\.?(?:,?\\s*\\d{4})?\\b`, 'gi'),                  // 14 March 2026
  /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g,                                                       // 3/14/26
  /\b(?:19|20)\d{2}\b/g,                                                                  // a bare year
]

export function hasAssertedDate(text) {
  const s = String(text || '')
  if (!s) return false
  if (CADENCE_RE.test(s) && !/\b(?:19|20)\d{2}\b/.test(s)) return false
  return DATE_PATTERNS.some(re => { re.lastIndex = 0; return re.test(s) })
}

// Removes asserted dates and tidies the punctuation they leave behind. Applied
// to every model-written string that reaches the screen.
export function stripAssertedDate(text) {
  let s = String(text || '')
  if (!s) return ''
  for (const re of DATE_PATTERNS) { re.lastIndex = 0; s = s.replace(re, '') }
  return s
    .replace(/\s*\bon\s*(?=[,.;]|$)/gi, '')
    .replace(/\s*\bsince\s*(?=[,.;]|$)/gi, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.;])/g, '$1')
    .replace(/([,;])\s*(?=[,.;])/g, '')
    .replace(/\(\s*\)/g, '')
    .replace(/^[\s,;.]+|[\s,;]+$/g, '')
    .trim()
}

// ── Row normalisation ───────────────────────────────────────────────────────

const clamp = (v, n) => String(v == null ? '' : v).slice(0, n)
const isUrl = (u) => typeof u === 'string' && /^https?:\/\//i.test(u)

export const RESOURCE_KINDS = [
  'career network', 'job-search group', 'professional body', 'public workforce',
  'library program', 'faith-based network', 'local meetup', 'online community',
  'gated peer group', 'outplacement',
]

export const COSTS = ['free', 'dues', 'invite-only', 'ticketed', 'unknown']

export function normalizeResource(raw) {
  if (!raw || typeof raw !== 'object') return null
  const name = clamp(raw.name, 140).trim()
  if (!name) return null
  const url = isUrl(raw.url) ? raw.url : ''
  const eventsUrl = isUrl(raw.eventsUrl) ? raw.eventsUrl : ''
  // sourceUrl is EVIDENCE, not a second link to the same place. A duplicate
  // reads as corroboration and is not one (the recruiter-card rule).
  const rawSource = isUrl(raw.sourceUrl) ? raw.sourceUrl : ''
  const sourceUrl = rawSource && rawSource !== url ? rawSource : ''
  return {
    name,
    kind: RESOURCE_KINDS.includes(raw.kind) ? raw.kind : 'job-search group',
    howYouTakePart: stripAssertedDate(clamp(raw.howYouTakePart, 160)),
    cost: COSTS.includes(raw.cost) ? raw.cost : 'unknown',
    costNote: stripAssertedDate(clamp(raw.costNote, 160)),
    forPeopleInTransition: raw.forPeopleInTransition === true,
    whyThisFits: stripAssertedDate(clamp(raw.whyThisFits, 300)),
    url,
    eventsUrl,
    sourceUrl,
    confidence: ['high', 'medium', 'low'].includes(raw.confidence) ? raw.confidence : 'low',
  }
}

// Splits into what can be shown as sourced and what cannot. Never discards.
export function splitResources(arr) {
  const clean = (Array.isArray(arr) ? arr : []).map(normalizeResource).filter(Boolean)
  const seen = new Set()
  const deduped = clean.filter(r => {
    const k = r.name.toLowerCase().replace(/[^a-z0-9]/g, '')
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
  return {
    rows: deduped.filter(r => r.url || r.eventsUrl),
    uncited: deduped.filter(r => !(r.url || r.eventsUrl)),
  }
}

// ── Ranking ─────────────────────────────────────────────────────────────────
// The TALK case defines this. For a talent-acquisition professional, TALK Talent
// — free, 80 North American chapters, practitioner-run, TA-specific — came back
// NINTH of nine on a generic query, and the model's own prose summary omitted it
// entirely while naming six others. Retrieval was not the failure; ranking and
// summarising were. So ordering is computed here, deterministically, and never
// left to the order the model happened to return.
//
// "Invite-only" is NOT a demotion on its own: TALK is curated, invite-only AND
// free, and that combination is a quality signal. Only price demotes.
export function resourceScore(r) {
  if (!r) return 0
  let s = 0
  if (r.forPeopleInTransition) s += 40         // exists to help people in transition
  if (r.cost === 'free') s += 30               // free beats paid
  else if (r.cost === 'invite-only') s += 20   // curated, not costly
  else if (r.cost === 'dues') s += 8
  else if (r.cost === 'ticketed') s -= 10      // a conference is not a community
  if (r.kind === 'career network') s += 14
  if (r.kind === 'job-search group' || r.kind === 'library program' || r.kind === 'public workforce') s += 12
  if (r.kind === 'gated peer group') s += 4
  if (/\bchapter|local|meets in person\b/i.test(r.howYouTakePart)) s += 10 // local presence
  if (r.confidence === 'high') s += 6
  else if (r.confidence === 'low') s -= 4
  if (r.sourceUrl) s += 3                      // carries evidence, not just a link
  return s
}

export function rankResources(rows) {
  return [...(Array.isArray(rows) ? rows : [])]
    .map((r, i) => ({ r, i }))
    .sort((a, b) => (resourceScore(b.r) - resourceScore(a.r)) || (a.i - b.i))
    .map(x => x.r)
}

// ── Local cache ─────────────────────────────────────────────────────────────
// Keyed on the city so a move re-runs the search, and held in localStorage
// rather than profile_state on purpose: profile_state autosaves the whole blob
// and has both a known whole-blob clobber path and a 1MB cap that has already
// silently broken saves for an account. Nothing here is worth that risk.
export const RESOURCES_STORAGE_KEY = 'reimagine_job_resources_v1'

export function resourcesCacheKey(city, region) {
  return [city, region].map(s => String(s || '').trim().toLowerCase()).filter(Boolean).join('|') || 'anywhere'
}

export function packResources(key, rows, uncited) {
  return { key, rows: Array.isArray(rows) ? rows : [], uncited: Array.isArray(uncited) ? uncited : [], savedAt: new Date().toISOString() }
}

export function unpackResources(raw, key) {
  if (!raw || typeof raw !== 'object') return null
  if (raw.key !== key) return null
  const rows = Array.isArray(raw.rows) ? raw.rows.map(normalizeResource).filter(Boolean) : []
  const uncited = Array.isArray(raw.uncited) ? raw.uncited.map(normalizeResource).filter(Boolean) : []
  return { rows, uncited, savedAt: typeof raw.savedAt === 'string' ? raw.savedAt : '' }
}
