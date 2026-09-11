// Guards Output/handoff/2026-09-11_gtm-openings-verification.md: the
// Go-to-Market "role open right now" badge rendered whatever URL the model
// returned. On a 2026-09-10 build, six of six companies got the badge and
// five of the six links were dead ends. The fixtures below are those six
// URLs with their status codes and page shapes captured, NOT live-fetched:
// CI must not depend on six third-party job pages staying the way they were
// on the evening they were checked.
//
// Three halves:
//   1. api/_lib/posting-hosts.js -- the URL-only classification the browser
//      and the server share (list page? host we cannot read?).
//   2. api/verify-posting.js -- the page judgment (pure) and the fetch path
//      (with an injected fetchImpl + DNS lookup, so redirects, timeouts and
//      the SSRF guard are exercised without a network).
//   3. src/App.jsx wiring -- App.jsx is JSX and cannot be imported here, so
//      the call-site facts (effort, the verify hop, the badge copy, the cache
//      expiry) are source-checked.
import fs from 'node:fs'

process.env.DATABASE_URL ||= 'postgres://user:pass@localhost/dummy'
process.env.ANTHROPIC_API_KEY ||= 'dummy'
process.env.RESEND_API_KEY ||= 'dummy'

const hosts = await import('../api/_lib/posting-hosts.js')
const vp = await import('../api/verify-posting.js')

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

// ── The six cards from the field report ──────────────────────────────────

const WEST_MONROE = 'https://www.indeed.com/q-west-monroe-l-illinois-jobs.html'
const ALIGHT = 'https://www.themuse.com/jobs/alightsolutionsllc/hr-mergers-acquisitions-leader'
const MARSH = 'https://www.builtinnyc.com/company/marsh-mclennan/jobs'
const WTW = 'https://careers.wtwco.com/jobs/senior-director-hr-mergers-acquisitions-ff1365dc-1234-5678-9abc-def012345678'
const RGP = 'https://rgp.com/careers/job-openings/director-ma-integration/'
const LHH = 'https://www.linkedin.com/jobs/view/director-people-operations-total-rewards-at-lhh-4407044825'

// ── 1. posting-hosts: list pages and unreadable hosts ─────────────────────

check(hosts.isListPageUrl(WEST_MONROE), 'West Monroe: an Indeed search-results page (/q-...-jobs.html) must classify as a list page')
check(hosts.isListPageUrl(MARSH), 'Marsh McLennan: a Built In company jobs index (/company/<slug>/jobs) must classify as a list page')
check(hosts.isListPageUrl('https://www.westmonroe.com/careers'), 'a careers home (/careers) is a list page')
check(hosts.isListPageUrl('https://www.westmonroe.com/careers/'), 'a careers home with a trailing slash is a list page')
check(hosts.isListPageUrl('https://acme.com/jobs'), 'a jobs index (/jobs) is a list page')
check(hosts.isListPageUrl('https://acme.com/careers/job-openings'), 'a job-openings index is a list page')
check(hosts.isListPageUrl('https://acme.com/careers/search?q=director'), 'a search page (/search) is a list page')
check(hosts.isListPageUrl('https://acme.com/jobs?q=director'), 'a search query on the jobs root is a list page')
check(hosts.isListPageUrl('https://acme.com/'), 'a bare homepage is a list page, never a posting')
check(hosts.isListPageUrl(''), 'an empty string is treated as a list page (it can never render as a posting link)')
check(hosts.isListPageUrl('not a url'), 'a non-URL is treated as a list page')

check(!hosts.isListPageUrl(ALIGHT), 'Alight: a Muse posting page with its own slug is NOT a list page')
check(!hosts.isListPageUrl(WTW), 'WTW: a posting under /jobs/<slug-id> is NOT a list page (the fetch decides it)')
check(!hosts.isListPageUrl(RGP), 'RGP: a posting under /careers/job-openings/<slug>/ is NOT a list page (the fetch decides it)')
check(!hosts.isListPageUrl('https://boards.greenhouse.io/acme/jobs/4012345'), 'a Greenhouse posting (/jobs/<id>) is not a list page')
check(!hosts.isListPageUrl('https://acme.wd5.myworkdayjobs.com/en-US/Careers/job/Chicago/Director-HR-MA_R12345'), 'a Workday posting (/Careers/job/<city>/<title>) is not a list page')
check(!hosts.isListPageUrl('https://jobs.lever.co/acme/1b2c3d4e-0000-1111-2222-333344445555'), 'a Lever posting is not a list page')
check(!hosts.isListPageUrl('https://www.indeed.com/viewjob?jk=abc123'), 'an Indeed single posting (/viewjob) is not a list page')
check(!hosts.isListPageUrl('https://careers-acme.icims.com/jobs/12345/director-of-people/job'), 'an iCIMS posting (ends in singular /job) is not a list page')
check(!hosts.isListPageUrl('https://jobs.smartrecruiters.com/Acme/743999-director-of-people'), 'a SmartRecruiters posting is not a list page')
check(!hosts.isListPageUrl('https://apply.workable.com/acme/j/ABC123/'), 'a Workable posting is not a list page')

check(hosts.isUnverifiableHost(LHH), 'LHH: a linkedin.com/jobs/view link is on a host we cannot read')
check(hosts.isUnverifiableHost('https://uk.linkedin.com/jobs/view/123'), 'any linkedin.com subdomain is unverifiable')
check(hosts.isUnverifiableHost('https://www.glassdoor.com/job-listing/x'), 'glassdoor.com is unverifiable')
check(!hosts.isUnverifiableHost(ALIGHT), 'themuse.com is readable, not unverifiable')
check(!hosts.isUnverifiableHost('https://notlinkedin.com/jobs/1'), 'a host that merely ends with the same letters is not a match (suffix match must be on a dot boundary)')
check(hosts.unverifiableHostLabel(LHH) === 'LinkedIn', 'the card label for a LinkedIn link is "LinkedIn"')
check(hosts.unverifiableHostLabel('https://www.glassdoor.com/x') === 'Glassdoor', 'the card label for a Glassdoor link is "Glassdoor"')
check(hosts.unverifiableHostLabel(ALIGHT) === '', 'a readable host has no unverifiable label')

// ── 2a. judgePostingPage: the pure decision ───────────────────────────────

const alightHtml = `<!doctype html><html><head><title>HR Mergers &amp; Acquisitions Leader at Alight Solutions LLC | The Muse</title>
<meta property="og:title" content="HR Mergers &amp; Acquisitions Leader"></head>
<body><h1>HR Mergers &amp; Acquisitions Leader</h1><p>Alight Solutions LLC · Job ID Alight-R-34005</p>
<script>window.__bundle = "Senior Director - Something Else"</script>
<p>Apply now</p></body></html>`
check(vp.judgePostingPage({ status: 200, html: alightHtml, title: 'HR Mergers & Acquisitions Leader' }).ok === true,
  'Alight: a 200 page whose text carries the title (with &amp; entity-encoded) must verify')
check(vp.judgePostingPage({ status: 200, html: alightHtml, title: 'HR Mergers – Acquisitions Leader' }).ok === true,
  'punctuation in the title (an en dash for the ampersand) must not hide a match -- both sides are punctuation-normalized')
check(vp.judgePostingPage({ status: 200, html: alightHtml, title: 'hr   mergers & acquisitions LEADER' }).ok === true,
  'case and doubled whitespace in the title must not hide a match')

check(vp.judgePostingPage({ status: 404, html: '', title: 'Senior Director - HR Mergers & Acquisitions' }).reason === 'http_404',
  'WTW: an HTTP 404 fails with reason http_404')
check(vp.judgePostingPage({ status: 404, html: '<html>Not found</html>', title: 'Director, M&A Integration' }).ok === false,
  'RGP: an HTTP 404 fails verification')

const westMonroeListHtml = `<html><head><title>West Monroe Jobs, Employment in Illinois | Indeed</title></head>
<body><h1>97 jobs</h1><ul><li>Senior Consultant, Healthcare</li><li>Manager, Technology</li></ul></body></html>`
check(vp.judgePostingPage({ status: 200, html: westMonroeListHtml, title: 'HR M&A Integration Director' }).reason === 'title_absent',
  'West Monroe: a 200 list page whose text does not carry the invented title fails with title_absent')
const marshListHtml = `<html><head><title>Marsh McLennan Jobs | Built In NYC</title></head>
<body><h2>103 jobs</h2><div>Senior Actuary</div><div>Data Engineer</div></body></html>`
check(vp.judgePostingPage({ status: 200, html: marshListHtml, title: 'HR M&A Due Diligence & Integration role' }).reason === 'title_absent',
  'Marsh McLennan: a Built In index page that never mentions the title fails with title_absent')

const closedHtml = `<html><body><h1>Director, People Operations &amp; Total Rewards</h1>
<p class="closed-job">No longer accepting applications</p></body></html>`
const closedVerdict = vp.judgePostingPage({ status: 200, html: closedHtml, title: 'Director, People Operations & Total Rewards' })
check(closedVerdict.ok === false && closedVerdict.reason === 'closed',
  'a 200 page that carries the title AND "no longer accepting applications" fails with reason closed (the LHH shape, had the host been readable)')
for (const phrase of ['This job is no longer available', 'This position has been filled', 'This job has expired']) {
  const v = vp.judgePostingPage({ status: 200, html: `<html><body><h1>Some Title</h1><p>${phrase}.</p></body></html>`, title: 'Some Title' })
  check(v.reason === 'closed', `closed-posting phrase "${phrase}" must fail verification even at 200`)
}

check(vp.judgePostingPage({ status: 200, html: '<html><body><h1>Director</h1></body></html>', title: '' }).reason === 'no_title',
  'a blank title cannot verify anything')
check(vp.judgePostingPage({ status: 200, html: '<html><body><p>Careers at Acme</p><script>var t="Hidden Director Title"</script></body></html>', title: 'Hidden Director Title' }).reason === 'title_absent',
  'a title that appears only inside a plain <script> body does not count (a JS bundle string is not the page)')
const ldJsonHtml = `<html><head><script type="application/ld+json">{"@type":"JobPosting","title":"Director, M&A Integration"}</script></head><body><div id="app"></div></body></html>`
check(vp.judgePostingPage({ status: 200, html: ldJsonHtml, title: 'Director, M&A Integration' }).ok === true,
  'a title carried only in a JSON-LD JobPosting block (the ATS shell-page shape) does count')

// ── 2b. classifyPostingUrl mirrors the browser-side order ─────────────────

check(vp.classifyPostingUrl('').kind === 'empty', 'an empty url classifies as empty')
check(vp.classifyPostingUrl('   ').kind === 'empty', 'a whitespace url classifies as empty')
check(vp.classifyPostingUrl('ftp://acme.com/jobs/1').kind === 'invalid', 'a non-http(s) scheme is invalid')
check(vp.classifyPostingUrl('javascript:alert(1)').kind === 'invalid', 'a javascript: url is invalid')
check(vp.classifyPostingUrl('https://user:pw@acme.com/jobs/1').kind === 'invalid', 'credentials in the url are invalid')
check(vp.classifyPostingUrl(LHH).kind === 'unverifiable', 'LHH classifies as unverifiable before any fetch')
check(vp.classifyPostingUrl(WEST_MONROE).kind === 'list', 'West Monroe classifies as a list page before any fetch')
check(vp.classifyPostingUrl(MARSH).kind === 'list', 'Marsh McLennan classifies as a list page before any fetch')
check(vp.classifyPostingUrl(ALIGHT).kind === 'fetch', 'Alight goes to the fetch')
check(vp.classifyPostingUrl(WTW).kind === 'fetch', 'WTW goes to the fetch (and 404s there)')
check(vp.classifyPostingUrl(RGP).kind === 'fetch', 'RGP goes to the fetch (and 404s there)')

// ── 2c. verifyPosting end to end with an injected fetch ───────────────────

const publicLookup = async () => [{ address: '93.184.216.34', family: 4 }]
const privateLookup = async () => [{ address: '10.0.0.5', family: 4 }]
const mkRes = (status, body = '', headers = {}) => ({
  status,
  headers: { get: (k) => headers[k.toLowerCase()] ?? null },
  body: null,
  text: async () => body,
})
const fixtures = {
  [ALIGHT]: mkRes(200, alightHtml, { 'content-type': 'text/html; charset=utf-8' }),
  [WTW]: mkRes(404, '<html><body>Page not found</body></html>', { 'content-type': 'text/html' }),
  [RGP]: mkRes(404, '<html><body>404</body></html>', { 'content-type': 'text/html' }),
  'https://acme.com/careers/job/12345': mkRes(302, '', { location: '/careers' }),
  'https://acme.com/careers': mkRes(200, '<html><body><h1>Careers</h1><p>Director of People</p></body></html>', { 'content-type': 'text/html' }),
  'https://acme.com/careers/job/offsite': mkRes(302, '', { location: 'https://evil.example/steal' }),
  'https://acme.com/careers/job/www-hop': mkRes(301, '', { location: 'https://www.acme.com/careers/job/final' }),
  'https://www.acme.com/careers/job/final': mkRes(200, '<html><body><h1>Director of People</h1></body></html>', { 'content-type': 'text/html' }),
  'https://acme.com/careers/job/pdf': mkRes(200, '%PDF-1.4 Director of People', { 'content-type': 'application/pdf' }),
  'https://acme.com/careers/job/closed': mkRes(200, closedHtml, { 'content-type': 'text/html' }),
}
const calls = []
const fetchImpl = async (url, opts) => {
  calls.push(url)
  check(opts && opts.redirect === 'manual', 'the fetch must use redirect:manual so every hop is host-checked')
  const r = fixtures[url]
  if (!r) throw new Error('unexpected fetch ' + url)
  return r
}
const deps = { fetchImpl, lookup: publicLookup }

let r = await vp.verifyPosting(ALIGHT, 'HR Mergers & Acquisitions Leader', deps)
check(r.ok === true && r.status === 200 && r.reason === 'verified', `Alight end to end must verify (got ${JSON.stringify(r)})`)
r = await vp.verifyPosting(WTW, 'Senior Director - HR Mergers & Acquisitions', deps)
check(r.ok === false && r.status === 404 && r.reason === 'http_404', `WTW end to end must fail http_404 (got ${JSON.stringify(r)})`)
r = await vp.verifyPosting(RGP, 'Director, M&A Integration', deps)
check(r.ok === false && r.reason === 'http_404', `RGP end to end must fail http_404 (got ${JSON.stringify(r)})`)
calls.length = 0
r = await vp.verifyPosting(WEST_MONROE, 'HR M&A Integration Director', deps)
check(r.ok === false && r.reason === 'list_page' && calls.length === 0, `West Monroe must be dropped as list_page with NO fetch (got ${JSON.stringify(r)}, fetches ${calls.length})`)
r = await vp.verifyPosting(MARSH, 'HR M&A Due Diligence & Integration role', deps)
check(r.ok === false && r.reason === 'list_page' && calls.length === 0, `Marsh McLennan must be dropped as list_page with NO fetch (got ${JSON.stringify(r)})`)
r = await vp.verifyPosting(LHH, 'Director, People Operations & Total Rewards', deps)
check(r.ok === false && r.reason === 'unverifiable_host' && calls.length === 0, `LHH must come back unverifiable_host with NO fetch (LinkedIn refuses automated reads) (got ${JSON.stringify(r)})`)
r = await vp.verifyPosting('', 'Director of People', deps)
check(r.ok === false && r.reason === 'empty_url', `an empty url must fail empty_url (got ${JSON.stringify(r)})`)

r = await vp.verifyPosting('https://acme.com/careers/job/12345', 'Director of People', deps)
check(r.ok === false && r.reason === 'redirected_to_list', `a dead slug that 302s to the careers home must fail redirected_to_list even though the home page mentions the title (got ${JSON.stringify(r)})`)
r = await vp.verifyPosting('https://acme.com/careers/job/offsite', 'Director of People', deps)
check(r.ok === false && r.reason === 'redirect_offsite', `a redirect to another site is not followed (got ${JSON.stringify(r)})`)
r = await vp.verifyPosting('https://acme.com/careers/job/www-hop', 'Director of People', deps)
check(r.ok === true, `a redirect to the www. variant of the same site IS followed (got ${JSON.stringify(r)})`)
r = await vp.verifyPosting('https://acme.com/careers/job/pdf', 'Director of People', deps)
check(r.ok === false && r.reason === 'not_html', `a non-HTML body is not read (got ${JSON.stringify(r)})`)
r = await vp.verifyPosting('https://acme.com/careers/job/closed', 'Director, People Operations & Total Rewards', deps)
check(r.ok === false && r.reason === 'closed', `a 200 page saying no longer accepting applications fails closed end to end (got ${JSON.stringify(r)})`)

calls.length = 0
r = await vp.verifyPosting('https://internal.acme.com/careers/job/1', 'Director of People', { fetchImpl, lookup: privateLookup })
check(r.ok === false && r.reason === 'blocked_host' && calls.length === 0, `a host resolving to a private address is never fetched (got ${JSON.stringify(r)}, fetches ${calls.length})`)
r = await vp.verifyPosting('https://127.0.0.1/careers/job/1', 'Director of People', deps)
check(r.ok === false && r.reason === 'blocked_host', 'a loopback literal is never fetched')
r = await vp.verifyPosting('https://reimagine.career.club/api/me', 'Director of People', deps)
check(r.ok === false && r.reason === 'blocked_host', 'our own host is never fetched')
r = await vp.verifyPosting('https://[::1]/careers/job/1', 'Director of People', deps)
check(r.ok === false && r.reason === 'blocked_host', 'an IPv6 loopback literal is never fetched')

const slowFetch = (url, opts) => new Promise((_, reject) => {
  opts.signal.addEventListener('abort', () => { const e = new Error('aborted'); e.name = 'AbortError'; reject(e) })
})
r = await vp.verifyPosting('https://acme.com/careers/job/slow', 'Director of People', { fetchImpl: slowFetch, lookup: publicLookup, timeoutMs: 20 })
check(r.ok === false && r.reason === 'timeout', `a fetch that outlives the timeout fails timeout, never hangs (got ${JSON.stringify(r)})`)
r = await vp.verifyPosting('https://acme.com/careers/job/boom', 'Director of People', { fetchImpl: async () => { throw new Error('ECONNRESET') }, lookup: publicLookup })
check(r.ok === false && r.reason === 'fetch_failed', 'a network error fails fetch_failed and never throws')

check(vp.isPrivateIp('192.168.1.1') && vp.isPrivateIp('172.16.0.1') && vp.isPrivateIp('169.254.169.254') && vp.isPrivateIp('::ffff:10.0.0.1') && vp.isPrivateIp('fd00::1'),
  'private / link-local / v4-mapped / ULA addresses are all private')
check(!vp.isPrivateIp('93.184.216.34') && !vp.isPrivateIp('2606:2800:220:1:248:1893:25c8:1946'), 'public v4 and v6 addresses are not private')

// ── 2d. handler surface ───────────────────────────────────────────────────

const src = fs.readFileSync(new URL('../api/verify-posting.js', import.meta.url), 'utf8')
check(/isAllowedOrigin\(origin\)/.test(src) && /getSessionUser\(req, res\)/.test(src), 'the handler checks origin and requires a session, same shape as api/claude.js')
check(/checkIpRateLimit\('verify-posting'/.test(src) && /logIpEvent\('verify-posting'/.test(src), 'the handler is rate-limited per user over auth_ip_events')
check(/status\(429\)/.test(src), 'a rate-limited caller gets a 429')
check(/export const config = \{\s*maxDuration: 15/.test(src), 'the function declares a maxDuration that covers the 6s fetch plus redirects')
check(/from '\.\/_lib\/posting-hosts\.js'/.test(src), 'the server imports the shared host lists rather than carrying its own copy')

// ── 3. src/App.jsx wiring ─────────────────────────────────────────────────

const app = fs.readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')
check(/from "\.\.\/api\/_lib\/posting-hosts\.js"/.test(app), 'App.jsx imports the shared host lists (one definition, browser and server)')
check(/effort:'medium',step:'openings-match'/.test(app), 'the openings-match call runs at effort medium (was low: two searches at low effort found a URL and never read it)')
check(!/effort:'low',step:'openings-match'/.test(app), 'no openings-match call is left at effort low')
check(/fetch\('\/api\/verify-posting'/.test(app), 'findOpeningMatches verifies through /api/verify-posting before anything renders')
check(/Only return a match if you OPENED the posting page itself/.test(app), 'the prompt requires the model to have opened the posting page')
check(/"source":"first-party" or "aggregator"/.test(app), 'the per-match JSON shape carries source')
check(/OPENINGS_CONFIDENCE\.has\(obj\.confidence\)/.test(app), 'the parser keeps confidence instead of discarding it')
check(/if\(confidence==='low'\)return/.test(app), 'low-confidence results are dropped')
check(/isUnverifiableHost\(m\.url\)/.test(app) && /isListPageUrl\(m\.url\)/.test(app), 'the browser classifies unverifiable hosts and list pages before the fetch, in that order')
const badgeIdx = app.indexOf('function GtmOpeningMatch(')
const badgeSrc = app.slice(badgeIdx, app.indexOf('\n}\n', badgeIdx))
check(badgeIdx > 0 && !/open right now/.test(badgeSrc), 'the badge no longer asserts "open right now"')
check(/We found a posting that fits/.test(badgeSrc) && /postings that fit/.test(badgeSrc), 'the badge copy is the dated, hedged claim')
check(/A posting that may fit/.test(badgeSrc), 'a verified medium-confidence match renders under the quieter line')
check(/shows a possible fit; open it to confirm it is still accepting applications/.test(badgeSrc), 'an unverifiable-host match renders under the LinkedIn line')
check(/!oc\.verifiedAt\)return null/.test(badgeSrc), 'a cached result that never went through verification does not render')
check(/Re-check/.test(badgeSrc) && /onRecheck/.test(badgeSrc), 'the badge carries a Re-check tap')
check(/verifiedAt:now/.test(app), 'sweepOneOpening stamps verifiedAt on the result')
check(/OPENINGS_TTL_MS=7\*24\*60\*60\*1000/.test(app), 'the cache expires after 7 days')
check(/s\.done=new Set\(\[\.\.\.keys\]\.filter\(k=>openingsEntryFresh\(persisted\[k\]\)\)\)/.test(app), 'ensureOpeningsSweep seeds done only from fresh, verified entries')
check(/const recheckOpening=\(company\)=>/.test(app) && (app.match(/onRecheck=\{\(\)=>recheckOpening\(company\)\}/g) || []).length === 2, 'both GTM card render sites pass a Re-check handler')
check(/status:'checking'/.test(app), 'a Re-check shows a checking state in place of the old result')

const guide = fs.readFileSync(new URL('../src/data/user-guide/focus-playbook.md', import.meta.url), 'utf8')
check(/Re-check/.test(guide) && /again after a week/.test(guide), 'the user guide says what the badge means, that it re-checks weekly, and that Re-check runs it now')
check(!/"A role that fits is open right now\."/.test(guide), 'the user guide no longer quotes the retired badge label')

if (failures) { console.error(`test-openings-verify: ${failures} failure(s)`); process.exit(1) }
console.log('test-openings-verify: ok')
