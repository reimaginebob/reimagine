// Part B of the 2026-09-08 observability brief: the per-account support view.
//
// The check that matters most here is a NEGATIVE one, and it is run
// behaviorally rather than grepped. buildTimeline is handed rows that DO carry
// `message` and `reply` text -- which is exactly what a careless future SELECT
// would hand it -- and the whole serialized output is then searched for that
// text. The query-level exclusion in api/admin/support-timeline.js is the real
// guarantee; this is the second layer, and it is the one that would still catch
// someone adding `message` to the SELECT six months from now.
//
// Why it matters: src/legalDocs.js line 56 permits review of coaching content
// only DE-IDENTIFIED -- name, email and account identifiers removed before
// anyone reads it. This view is keyed BY identity, so carrying content would
// put it outside that promise. Staff access to a named person's transcript is a
// policy decision pending with legal, not something to arrive here by accident.
import fs from 'node:fs'

process.env.DATABASE_URL ||= 'postgres://user:pass@localhost/dummy'
const { buildTimeline, parseDays, DEFAULT_DAYS, MAX_DAYS } = await import('../api/admin/support-timeline.js')

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

// --- The reducer drops content even when it is handed content -------------

const SECRET_MESSAGE = 'I am worried I will never work again'
const SECRET_REPLY = 'Here is what your Personal Brand says about that'

const timeline = buildTimeline({
  supportEvents: [
    { kind: 'generation_failed', step: 'p3', error_class: 'overloaded', http_status: 529, duration_ms: 4200, build_sha: 'abc123', detail: 'upstream overloaded', created_at: '2026-09-10T10:00:00Z' },
  ],
  generations: [
    { kind: 'p3', model: 'claude-sonnet-5', cost_usd: '0.1234', created_at: '2026-09-10T09:00:00Z' },
  ],
  stages: [{ stage: 'brand_built', source: 'observed', recorded_at: '2026-09-09T08:00:00Z' }],
  pursuits: [{ stage: 'interview', outcome: null, prev_stage: 'applied', created_at: '2026-09-08T08:00:00Z' }],
  signIns: [{ created_at: '2026-09-07T08:00:00Z', last_used_at: '2026-09-07T09:00:00Z', user_agent: 'Mozilla/5.0' }],
  coachTurns: [
    // The hostile case: rows that carry exactly what must never come out.
    { current_step: 'p3', turn_kind: 'user', rating: 1, created_at: '2026-09-11T08:00:00Z', message: SECRET_MESSAGE, reply: SECRET_REPLY },
    { current_step: 'op', turn_kind: 'session_open', rating: null, created_at: '2026-09-06T08:00:00Z', message: SECRET_MESSAGE, reply: SECRET_REPLY },
  ],
})

const dumped = JSON.stringify(timeline)
check(!dumped.includes(SECRET_MESSAGE),
  'buildTimeline carried a Coach MESSAGE through into the timeline -- this view is keyed by identity and legalDocs line 56 permits content review only de-identified')
check(!dumped.includes(SECRET_REPLY),
  'buildTimeline carried a Coach REPLY through into the timeline')
check(!dumped.includes('message') && !dumped.includes('reply'),
  'a timeline entry has a `message` or `reply` key at all -- even empty, it is an invitation for a future change to fill it')

// What it SHOULD carry from a coach turn.
const coachEntries = timeline.filter(e => e.type === 'coach')
check(coachEntries.length === 2, `expected 2 coach entries, got ${coachEntries.length}`)
check(coachEntries.some(e => e.step === 'p3' && e.rating === 1),
  'the coach entry lost its step or rating, which is the whole of what this view is allowed to show about a turn')
check(coachEntries.some(e => e.turn_kind === 'session_open'),
  'turn_kind is not carried -- without it, the app\'s own silent instructions read as questions the person typed')

// A row with turn_kind NULL predates the 2026-09-08 migration and every other
// reader treats it as 'user'. This one must agree, or the same account reads
// differently here than on the insight dashboard.
const legacy = buildTimeline({ coachTurns: [{ current_step: 'p3', turn_kind: null, rating: null, created_at: '2026-09-01T08:00:00Z' }] })
check(legacy[0].turn_kind === 'user',
  "a NULL turn_kind must default to 'user' -- that is how every other reader treats rows written before the turn_kind migration")

// --- Ordering and the other entry types -----------------------------------

const times = timeline.map(e => new Date(e.at).getTime())
check(times.every((t, i) => i === 0 || times[i - 1] >= t),
  'the timeline is not sorted newest-first -- a support conversation starts from what just happened')

const types = new Set(timeline.map(e => e.type))
for (const t of ['failure', 'generation', 'coach', 'stage', 'pursuit', 'session']) {
  check(types.has(t), `the ${t} source is missing from the merged timeline`)
}

const failure = timeline.find(e => e.type === 'failure')
for (const f of ['kind', 'step', 'error_class', 'http_status', 'duration_ms', 'build_sha', 'detail']) {
  check(failure[f] !== undefined, `the failure entry dropped ${f}, which is the diagnostic content of the row`)
}

// cost_usd arrives from the driver as a numeric string. Left as-is it would
// render as "$0.1234".toFixed -> a crash, or silently as a string.
const gen = timeline.find(e => e.type === 'generation')
check(typeof gen.cost_usd === 'number' && Math.abs(gen.cost_usd - 0.1234) < 1e-9,
  `cost_usd came through as ${JSON.stringify(gen.cost_usd)} rather than a number -- Postgres numeric arrives as a string`)

check(buildTimeline({}).length === 0, 'buildTimeline({}) should be an empty timeline, not a throw')

// --- The window is bounded by the retention ceiling -----------------------

check(parseDays(undefined) === DEFAULT_DAYS, `an absent days param should default to ${DEFAULT_DAYS}`)
check(parseDays('junk') === DEFAULT_DAYS, 'a non-numeric days param should fall back to the default')
check(parseDays(7) === 7, 'a valid days param should pass through')
check(parseDays(5000) === MAX_DAYS,
  `days must clamp to ${MAX_DAYS} -- support_events is pruned at 90 days, so a wider window would silently return less and read as data loss`)
check(parseDays(0) === 1 && parseDays(-5) === 1, 'days must clamp up to at least 1')
check(MAX_DAYS === 90, `MAX_DAYS is ${MAX_DAYS}; it must match the retention window the cleanup cron enforces`)

// --- The endpoint: exclusion at the query level ---------------------------

const ENDPOINT = 'api/admin/support-timeline.js'
const endpoint = fs.readFileSync(ENDPOINT, 'utf8')
// Comments stripped before these checks. This file EXPLAINS at length why it
// does not read message, reply or analytics_events, and a naive grep would
// match the explanation and report the opposite of the truth.
const endpointCode = endpoint.split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n')

const chatQuery = endpointCode.slice(endpointCode.indexOf('FROM chat_messages') - 400, endpointCode.indexOf('FROM chat_messages'))
check(!/\bmessage\b/.test(chatQuery) && !/\breply\b/.test(chatQuery),
  `${ENDPOINT}: the chat_messages SELECT names message or reply. The exclusion must live in the QUERY, not the UI -- then there is no rendering mistake, console inspection or future refactor that can surface them`)
check(/SELECT current_step, turn_kind, rating, created_at/.test(endpoint),
  `${ENDPOINT}: the chat_messages SELECT has drifted from the four non-content columns this view is allowed to read`)

check(/checkAdminAuth\(req, res\)\)/.test(endpoint),
  `${ENDPOINT}: admin auth is missing or is passing options`)
check(!/allowAnalyst/.test(endpoint),
  `${ENDPOINT}: analysts must NOT be admitted -- every other analyst-readable endpoint is aggregate across accounts, and this one is a single named person's activity`)
check(/adminLoginEmailsMissing/.test(endpoint),
  `${ENDPOINT}: an unconfigured ADMIN_LOGIN_EMAILS should 500 as a misconfiguration, not 403 as a failed credential`)
check(!/analytics_events/.test(endpointCode),
  `${ENDPOINT}: reads the anonymous analytics stream -- that one is anonymous by policy (legalDocs line 40) and reading it by identity breaks the promise regardless of what is done with the result`)

// --- The page -------------------------------------------------------------

const VIEW = 'src/components/SupportView.jsx'
check(fs.existsSync(VIEW),
  `${VIEW}: missing. Note the path: new UI files live in src/components/ so check-fontsize and check-btn-prominence actually scan them (CLAUDE.md section 8)`)
const view = fs.readFileSync(VIEW, 'utf8')
check(!/\.message\b|\.reply\b/.test(view),
  `${VIEW}: renders a message or reply field -- the endpoint does not send one, so this could only ever render undefined, but the reference itself is the start of the mistake`)
check(/borderLeft: `3px solid \$\{C\.gold\}`/.test(view),
  `${VIEW}: the guidance block does not use the gold-accent treatment -- instructions must be distinguishable from data at a glance (CLAUDE.md section 8)`)
check(/overflowX: 'auto'/.test(view),
  `${VIEW}: a table is not in an overflow-x container, so the page body will scroll horizontally on a narrow screen`)

const app = fs.readFileSync('src/App.jsx', 'utf8')
check(/const SupportView = lazy\(\(\) => import\("\.\/components\/SupportView"\)\)/.test(app),
  'src/App.jsx: SupportView is not lazy-loaded, so a staff-only screen ships in the bundle every account downloads')
check(/lazy, Suspense/.test(app), 'src/App.jsx: lazy/Suspense are not imported from react')
check(/_path==='\/admin\/support'/.test(app), 'src/App.jsx: the /admin/support route is not registered')

const rewrites = JSON.parse(fs.readFileSync('vercel.json', 'utf8')).rewrites || []
check(rewrites.some(r => r.source === '/admin/support' && r.destination === '/index.html'),
  'vercel.json: /admin/support has no rewrite, so a direct visit or a refresh 404s instead of reaching the SPA')

if (failures) {
  console.error(`test-support-timeline: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-support-timeline: OK (buildTimeline drops Coach message and reply text even when handed rows that carry it, merges all six sources newest-first, coerces numeric cost and defaults a NULL turn_kind to user; the window clamps to the 90-day retention ceiling; the endpoint excludes content at the query level and admits admins only; and the page is lazy-loaded, routed and rewritten)')
}
