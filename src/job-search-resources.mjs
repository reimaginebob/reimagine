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

// City names come from a free-text field, so "cincinnati" and "los angeles" are
// as common as the capitalised forms, and both appear in a heading. Capitalise
// only words that are ENTIRELY lowercase: that fixes "los angeles" without
// breaking "Washington DC", "St. Louis" or anything the person capitalised
// themselves. Their own capitalisation always wins.
export function displayCity(city) {
  return String(city || '')
    .trim()
    .split(/(\s+|-)/)
    .map(part => (/^[a-z][a-z'’.]*$/.test(part) ? part.charAt(0).toUpperCase() + part.slice(1) : part))
    .join('')
}

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

// A hard slice cuts mid-word, and it showed: live output carried "sector-specific
// hi" and "funded through federal/p" on screen. Cut at the last sentence that
// fits, or failing that the last word, and mark the cut so a trailing fragment
// never reads as the end of the thought.
const clamp = (v, n) => {
  const s = String(v == null ? '' : v).trim()
  if (s.length <= n) return s
  const head = s.slice(0, n)
  const sentence = Math.max(head.lastIndexOf('. '), head.lastIndexOf('; '))
  if (sentence > n * 0.5) return head.slice(0, sentence + 1)
  const word = head.lastIndexOf(' ')
  return (word > 0 ? head.slice(0, word) : head).replace(/[\s,;:.—-]+$/, '') + '…'
}
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
    // Does this body serve THIS person's profession, as opposed to serving job
    // seekers generally. The single most important thing about a row, and the
    // reason SHRM outranks a library resume clinic for someone in HR even
    // though one charges dues and the other is free.
    fitsProfession: raw.fitsProfession === true,
    whyThisFits: stripAssertedDate(clamp(raw.whyThisFits, 300)),
    url,
    eventsUrl,
    sourceUrl,
    confidence: ['high', 'medium', 'low'].includes(raw.confidence) ? raw.confidence : 'low',
  }
}

// The institution a row belongs to, for the repeat guard below. Everything up to
// the first separator, which is where a programme name almost always begins:
// "Skokie Public Library Career Support Group" and "Skokie Public Library Job
// Seekers drop-in sessions" both reduce to the library.
export function institutionOf(name) {
  const head = String(name || '').split(/\s+[\u2014\u2013-]\s+|[,:(\/]/)[0]
  const words = head.trim().split(/\s+/)
  const stop = /^(library|college|university|partnership|church|ministry|chamber|association|society|institute|center|centre|department|foundation)$/i
  const cut = words.findIndex(w => stop.test(w.replace(/[^a-zA-Z]/g, '')))
  const kept = cut >= 0 ? words.slice(0, cut + 1) : words
  return kept.join(' ').toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim()
}

// Splits into what can be shown as sourced and what cannot. Never discards.
//
// Two guards, and the second was earned. Live output for a Chicago search came
// back with the same public library three times, which reads as a padded list
// and costs three of the few slots this card has. The prompt is told to return
// one row per organization; this enforces it, because an instruction is a draft
// and a detector is a fix. The FIRST row for an institution survives, and it is
// the highest-ranked one by the time this matters.
export function splitResources(arr) {
  const clean = (Array.isArray(arr) ? arr : []).map(normalizeResource).filter(Boolean)
  const seen = new Set()
  const institutions = new Set()
  const deduped = clean.filter(r => {
    const k = r.name.toLowerCase().replace(/[^a-z0-9]/g, '')
    if (seen.has(k)) return false
    seen.add(k)
    const inst = institutionOf(r.name)
    // Only guard on an institution name substantial enough to mean something;
    // a one-word leader like "Chicago" would collapse unrelated organizations.
    if (inst && inst.split(' ').length >= 2) {
      if (institutions.has(inst)) return false
      institutions.add(inst)
    }
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
  // FIT FIRST. Bob, 2026-09-01, on a Chicago list for a CHRO candidate that
  // returned a library resume clinic and two community-college career offices:
  // an HR person should always get SHRM and their local chapters, and those
  // cost money — "don't let that override the appropriateness".
  //
  // Cost used to be worth almost as much as fit here, which put every free
  // general service above every professional body and produced exactly that
  // list. Cost is now a tiebreaker between comparable rows and can no longer
  // push a body that serves this person's profession below one that does not.
  // It is still stated on every row, because a price should never be a surprise.
  if (r.fitsProfession) s += 50
  if (r.forPeopleInTransition) s += 22
  if (r.cost === 'free') s += 10
  else if (r.cost === 'invite-only') s += 9    // curated, and no fee
  else if (r.cost === 'dues') s += 5
  else if (r.cost === 'ticketed') s -= 4       // a conference is not a community
  if (r.kind === 'career network') s += 12
  else if (r.kind === 'professional body') s += 10
  else if (r.kind === 'job-search group' || r.kind === 'library program' || r.kind === 'public workforce') s += 8
  else if (r.kind === 'gated peer group') s += 4
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

// ── Groups for This Path: signature keying ──────────────────────────────────
// The role-scoped card appears in EVERY playbook, which is the point and also
// the cost: someone working five supply-chain opportunities would otherwise get
// the same list five times, generated five times, paid for five times, and
// stored five times inside savedPlaybooks.
//
// So the result is keyed on WHAT WAS SEARCHED, not on which playbook asked.
// Geography is deliberately excluded, exactly as recruitersSignatureFor excludes
// it: two opportunities in the same function and industry should share a list
// even when the offices are in different cities, and a geo-focused refinement
// must not thrash the key.
//
// The consequence to accept: this list is not company-specific and never
// pretends to be. Company-specific is what the three doors are for.
export function groupsSignatureFor(c) {
  if (!c) return ''
  return [c.function || '', c.industry || '', c.seniority || '']
    .map(s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, ''))
    .join('|')
}

export const GROUPS_STORAGE_KEY = 'reimagine_path_groups_v1'
// Which signature each playbook resolved to. Separate from the row store so two
// playbooks can point at one list rather than each holding a copy of it.
export const GROUPS_SLOTS_KEY = 'reimagine_path_group_slots_v1'
// One store shared by every playbook, holding a handful of signatures. Capped so
// a long search cannot grow it without bound; oldest signature falls off first.
export const GROUPS_MAX_SIGNATURES = 12

export function putGroups(store, signature, rows) {
  const base = store && typeof store === 'object' ? { ...store } : {}
  base[signature] = { rows: Array.isArray(rows) ? rows : [], savedAt: new Date().toISOString() }
  const keys = Object.keys(base)
  if (keys.length > GROUPS_MAX_SIGNATURES) {
    keys
      .sort((a, b) => String(base[a].savedAt || '').localeCompare(String(base[b].savedAt || '')))
      .slice(0, keys.length - GROUPS_MAX_SIGNATURES)
      .forEach(k => { delete base[k] })
  }
  return base
}

export function getGroups(store, signature) {
  if (!store || typeof store !== 'object' || !signature) return null
  const hit = store[signature]
  if (!hit || !Array.isArray(hit.rows)) return null
  const rows = hit.rows.map(normalizeResource).filter(Boolean)
  return { rows, savedAt: typeof hit.savedAt === 'string' ? hit.savedAt : '' }
}

export function unpackResources(raw, key) {
  if (!raw || typeof raw !== 'object') return null
  if (raw.key !== key) return null
  const rows = Array.isArray(raw.rows) ? raw.rows.map(normalizeResource).filter(Boolean) : []
  const uncited = Array.isArray(raw.uncited) ? raw.uncited.map(normalizeResource).filter(Boolean) : []
  return { rows, uncited, savedAt: typeof raw.savedAt === 'string' ? raw.savedAt : '' }
}
