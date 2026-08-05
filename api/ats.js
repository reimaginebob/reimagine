// Vercel serverless function: resolves a company's careers page and, where one
// can be confirmed, its current job openings from a public ATS feed. Runs
// server-side because the browser cannot call these boards directly (CORS), and
// because careers-page discovery needs to fetch the company's own site.
//
// Contract:
// - POST only. Body: { name: string, website: string }.
// - Origin check rejects hosts outside the Reimagine allowlist (same shape as
//   api/pb-checkin.js). No auth: this reads only public data.
// - Response: {
//     homepage, careersUrl,            // careersUrl === homepage when no careers page confirmed
//     platform, slug,                  // the confirmed ATS, or '' / ''
//     feedFound: boolean,              // true only when a corroborated, fetchable feed was identified
//     openings: [{ title, location, url }]   // capped; [] when feedFound is false or the board is empty
//   }
//
// Collision safety (the load-bearing rule). The consult proved raw name-guessing
// misattributes short names ("Carbon" -> a 3D-printing company's board, not
// Carbon Health). So a feed is accepted ONLY when corroborated:
//   1. FINGERPRINT: the ATS host is found in the HTML of the company's OWN site
//      (homepage / careers page). Being on the real domain is the corroboration.
//   2. EXACT DOMAIN-LABEL GUESS: a guessed slug is accepted only when it equals
//      the homepage's second-level domain label exactly (abridge.com -> "abridge").
//      "carbon" !== "carbonhealth", "quantum" !== "quantumhealth",
//      "gravity" !== "gravityrail" -> all rejected. Empty/wrong boards never pass.
// feedFound:false means "could not check" -> the caller shows the careers link
// with no claim about openings, never a fabricated "nothing open".

const ALLOWED_HOSTS = new Set([
  'reimagine2-two.vercel.app',
  'reimagine.career.club',
  'localhost:5173',
  'localhost:3000',
])

function isAllowedOrigin(rawOrigin) {
  if (!rawOrigin) return false
  try {
    const u = new URL(rawOrigin)
    const hostWithPort = u.port ? `${u.hostname}:${u.port}` : u.hostname
    if (ALLOWED_HOSTS.has(u.hostname) || ALLOWED_HOSTS.has(hostWithPort)) return true
    if (u.hostname.endsWith('.vercel.app') && u.hostname.includes('reimagine')) return true
    return false
  } catch {
    return false
  }
}

const UA = 'Mozilla/5.0 (compatible; ReimagineCareersBot/1.0; +https://reimagine.career.club)'
const OPENINGS_CAP = 40

// Fetch with a hard timeout; resolve to null on any failure (never throw).
async function safeFetch(url, { timeout = 7000, json = false } = {}) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeout)
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: json ? 'application/json' : 'text/html,*/*' }, redirect: 'follow', signal: ctrl.signal })
    if (!res.ok) return null
    return json ? await res.json() : await res.text()
  } catch {
    return null
  } finally {
    clearTimeout(t)
  }
}

// Second-level domain label, alphanumerics only: https://www.carbon-health.com/ -> "carbonhealth".
function domainLabel(homepage) {
  try {
    const h = new URL(homepage).hostname.replace(/^www\./, '')
    const parts = h.split('.')
    const sld = parts.length >= 2 ? parts[parts.length - 2] : parts[0]
    return sld.toLowerCase().replace(/[^a-z0-9]/g, '')
  } catch {
    return ''
  }
}

const FINGERPRINTS = [
  { platform: 'greenhouse', re: /(?:boards|job-boards)\.greenhouse\.io\/(?:embed\/job_board\?for=)?([a-z0-9]+)|boards-api\.greenhouse\.io\/v1\/boards\/([a-z0-9]+)/i },
  { platform: 'lever', re: /jobs\.lever\.co\/([a-z0-9\-]+)/i },
  { platform: 'ashby', re: /jobs\.ashbyhq\.com\/([a-z0-9\-]+)/i },
  { platform: 'workday', re: /([a-z0-9]+)\.(?:wd\d+\.)?myworkdayjobs\.com/i },
  { platform: 'smartrecruiters', re: /(?:careers|jobs)\.smartrecruiters\.com\/([A-Za-z0-9\-]+)/i },
]

function fingerprint(html) {
  if (!html) return null
  for (const { platform, re } of FINGERPRINTS) {
    const m = html.match(re)
    if (m) {
      const slug = (m[1] || m[2] || '').trim()
      if (slug) return { platform, slug }
    }
  }
  return null
}

// Fetch openings from a fetchable board. Returns { openings } or null when the
// platform is not fetchable (e.g. Workday) or the fetch failed.
async function fetchFeed(platform, slug) {
  if (platform === 'greenhouse') {
    const d = await safeFetch(`https://boards-api.greenhouse.io/v1/boards/${slug}/jobs`, { json: true })
    if (!d || !Array.isArray(d.jobs)) return null
    return { openings: d.jobs.map(j => ({ title: j.title || '', location: (j.location && j.location.name) || '', url: j.absolute_url || '' })) }
  }
  if (platform === 'lever') {
    const d = await safeFetch(`https://api.lever.co/v0/postings/${slug}?mode=json`, { json: true })
    if (!Array.isArray(d)) return null
    return { openings: d.map(j => ({ title: j.text || '', location: (j.categories && j.categories.location) || '', url: j.hostedUrl || j.applyUrl || '' })) }
  }
  if (platform === 'ashby') {
    const d = await safeFetch(`https://api.ashbyhq.com/posting-api/job-board/${slug}`, { json: true })
    if (!d || !Array.isArray(d.jobs)) return null
    return { openings: d.jobs.map(j => ({ title: j.title || '', location: j.location || '', url: j.jobUrl || j.applyUrl || '' })) }
  }
  if (platform === 'smartrecruiters') {
    const d = await safeFetch(`https://api.smartrecruiters.com/v1/companies/${slug}/postings`, { json: true })
    if (!d || !Array.isArray(d.content)) return null
    return { openings: d.content.map(j => ({ title: j.name || '', location: (j.location && [j.location.city, j.location.country].filter(Boolean).join(', ')) || '', url: `https://jobs.smartrecruiters.com/${slug}/${j.id}` })) }
  }
  return null // workday and anything else: not fetchable here
}

const CAREERS_PATHS = ['/careers', '/careers/', '/jobs', '/company/careers', '/about/careers', '/careers/jobs']

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const origin = req.headers.origin || req.headers.referer || ''
  if (!isAllowedOrigin(origin)) return res.status(403).json({ error: 'Forbidden' })

  const body = req.body || {}
  const website = typeof body.website === 'string' ? body.website.trim() : ''
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  let homepage = ''
  try {
    homepage = new URL(/^https?:\/\//i.test(website) ? website : `https://${website}`).origin
  } catch {
    return res.status(200).json({ homepage: '', careersUrl: '', platform: '', slug: '', feedFound: false, openings: [] })
  }

  const label = domainLabel(homepage)

  // 1. Fetch homepage + careers candidates. Pick the first careers path that
  //    loads as careersUrl; collect HTML from everything fetched for fingerprinting.
  let careersUrl = homepage
  const htmls = []
  const home = await safeFetch(homepage)
  if (home) htmls.push(home)
  for (const p of CAREERS_PATHS) {
    const html = await safeFetch(homepage + p)
    if (html) { careersUrl = homepage + p; htmls.push(html); break }
  }

  // 2. Corroborated ATS resolution.
  let platform = '', slug = ''
  const fp = fingerprint(htmls.join('\n'))
  if (fp) {
    platform = fp.platform; slug = fp.slug // fingerprint = on the real domain = corroborated
  } else if (label) {
    // Exact domain-label guess only. Probe each fetchable platform for label.
    for (const p of ['greenhouse', 'lever', 'ashby', 'smartrecruiters']) {
      const feed = await fetchFeed(p, label)
      if (feed && feed.openings.length > 0) { platform = p; slug = label; break }
    }
  }

  // 3. If a fetchable, corroborated board was identified, pull its openings.
  let feedFound = false
  let openings = []
  if (platform && slug) {
    const feed = await fetchFeed(platform, slug)
    if (feed) {
      feedFound = true // a real, corroborated feed answered (openings may still be [] = board empty)
      openings = feed.openings.filter(o => o.title).slice(0, OPENINGS_CAP)
    }
    // platform === 'workday' (or a failed fetch) leaves feedFound false: careers
    // link only, no openings claim — an honest "could not check".
  }

  return res.status(200).json({ homepage, careersUrl, platform, slug, feedFound, openings, company: name })
}
