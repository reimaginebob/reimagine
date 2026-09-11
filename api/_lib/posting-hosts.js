// One definition of "which job-posting URLs can we stand behind," shared by
// the browser-side classifier (src/App.jsx findOpeningMatches) and the
// server-side fetch (api/verify-posting.js). Sits beside allowed-hosts.js on
// purpose: the same one-list-of-hosts pattern, so the answer to "why did this
// link get dropped" is always in one file rather than in two drifting copies.
//
// Why this exists (Output/handoff/2026-09-11_gtm-openings-verification.md):
// on a 2026-09-10 Go-to-Market build, six of six companies got the green
// "role open right now" badge and five of the six links were dead ends. Three
// distinct failure modes, and two of them are decidable from the URL alone
// before any fetch happens:
//
//   1. A LIST PAGE passed off as a posting. An Indeed search-results page
//      (indeed.com/q-west-monroe-l-illinois-jobs.html) and a Built In company
//      jobs index (builtinnyc.com/company/marsh-mclennan/jobs) both came back
//      with an invented title attached. A list page is never a posting, so
//      LIST_PAGE_PATTERNS drops these outright.
//   2. A host we cannot read. LinkedIn refuses automated fetches (robots.txt,
//      and a 999 on anything that gets through), so a linkedin.com/jobs/view
//      link can never be verified server-side. UNVERIFIABLE_HOSTS keeps these
//      out of the green badge; the card shows them as a possible fit the
//      person has to open themselves. Glassdoor blocks the same way.
//
// The third failure mode (a dead URL, or a stale posting on a readable host)
// needs the fetch, and that lives in api/verify-posting.js.
//
// No imports. This file has to bundle into the Vite client AND load inside a
// Vercel function, so it stays dependency-free and plain ES module.

// Hosts whose pages we cannot fetch and read, matched on the registrable
// domain (any subdomain counts: www.linkedin.com, uk.linkedin.com). A match
// is not a drop: the link still renders, under a line that says the person
// has to open it to confirm it is still accepting applications.
export const UNVERIFIABLE_HOSTS = [
  'linkedin.com',
  'glassdoor.com',
  'glassdoor.co.uk',
  'glassdoor.ca',
]

// Path shapes that are a list, an index, or a search, never a single posting.
// Tested against the URL's pathname with any trailing slash removed. Each
// pattern is anchored at the END of the path so a posting that lives under a
// jobs directory (greenhouse's /company/jobs/4012345, workday's
// /careers/job/City/Title_R12345, rgp.com/careers/job-openings/<slug>) is
// left alone -- only a path that STOPS at the list segment is a list.
export const LIST_PAGE_PATTERNS = [
  // Indeed search results: /q-west-monroe-l-illinois-jobs.html
  /^\/q-[^/]+-jobs(?:\.html)?$/i,
  // Indeed's other search shape (/jobs?q=...) and Indeed mobile (/m/jobs)
  /^\/(?:m\/)?jobs$/i,
  // Built In / Glassdoor-style company jobs index: /company/<slug>/jobs
  /^\/company\/[^/]+\/jobs$/i,
  /^\/companies?\/[^/]+\/(?:jobs|careers|openings)$/i,
  // Any path that ends at a careers home, jobs index, openings list, or search.
  // Singular "/job" is deliberately NOT here: iCIMS posting URLs end in it
  // (careers-acme.icims.com/jobs/12345/director-of-people/job).
  /\/(?:careers|career|jobs|job-openings|openings|open-positions|positions|vacancies|opportunities|search|job-search|search-jobs|all-jobs)$/i,
  // A bare homepage is never a posting
  /^\/?$/,
]

// Query strings that mark a search-results page even when the path looks
// like a posting root (e.g. /jobs/search?q=). Only consulted when the path
// itself is not already a list.
const SEARCH_QUERY_KEYS = ['q', 'query', 'keywords', 'keyword', 'search']

function parseUrl(url) {
  if (typeof url !== 'string' || !url.trim()) return null
  try {
    const u = new URL(url.trim())
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    return u
  } catch {
    return null
  }
}

// Hostname of a URL, lowercased, or '' when the string is not an http(s) URL.
export function hostOf(url) {
  const u = parseUrl(url)
  return u ? u.hostname.toLowerCase() : ''
}

function hostMatches(hostname, domain) {
  return hostname === domain || hostname.endsWith('.' + domain)
}

export function isUnverifiableHost(url) {
  const h = hostOf(url)
  if (!h) return false
  return UNVERIFIABLE_HOSTS.some(d => hostMatches(h, d))
}

// The name the card uses for an unverifiable host ("LinkedIn shows a
// possible fit"). '' for anything else, so a caller can fall back.
export function unverifiableHostLabel(url) {
  const h = hostOf(url)
  if (!h) return ''
  if (hostMatches(h, 'linkedin.com')) return 'LinkedIn'
  if (h.includes('glassdoor')) return 'Glassdoor'
  return ''
}

// True when the URL is a careers home, a jobs index, a search-results page,
// or an aggregator's company page -- anything that lists roles rather than
// being one. Also true for a string that is not an http(s) URL at all, since
// the only reason to ask is "may this render as a posting link," and the
// answer for a non-URL is no.
export function isListPageUrl(url) {
  const u = parseUrl(url)
  if (!u) return true
  const path = u.pathname.replace(/\/+$/, '')
  if (LIST_PAGE_PATTERNS.some(re => re.test(path))) return true
  // /jobs/search?q=director or /careers/search?keywords=... : the path already
  // matched above; this catches a posting-root path that carries a search query.
  if (/\/(?:jobs|careers|search)(?:\/[^/]*)?$/i.test(path)) {
    for (const k of SEARCH_QUERY_KEYS) if (u.searchParams.has(k)) return true
  }
  return false
}
