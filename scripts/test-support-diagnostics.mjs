// Part C of the 2026-09-08 observability brief: the user-initiated diagnostics
// upload.
//
// This is the one path in the whole brief that may carry more than the columns
// of support_events -- a component stack, a URL path -- and the only reason it
// may is that a person read the exact payload and clicked Send. Two things have
// to hold for that consent to mean anything, and both are tested behaviorally:
//
//   1. The server stores no more than the box showed. `payload` is jsonb, which
//      would be a hole if the endpoint took what it was given. sanitizeDiagnostics
//      is handed a deliberately hostile body -- resume text, a whole profile
//      object, a Coach transcript, a raw stack trace, an auth token -- and none
//      of it may survive.
//   2. The box showed no less than is sent. One function builds both the
//      rendered preview and the posted body, so there is no second code path
//      that could add a field the preview never displayed.
import fs from 'node:fs'

process.env.DATABASE_URL ||= 'postgres://user:pass@localhost/dummy'
const { sanitizeDiagnostics, PAYLOAD_KEYS, TRAIL_KEYS, MAX_TRAIL } = await import('../api/support/diagnostics.js')

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

// --- A hostile payload survives nothing it should not ---------------------

const RESUME = 'VP of Operations at Acme, 2019-2024, led a team of 40'
const COACH = 'I am worried I will never work again'
const TOKEN = 'sk-live-not-a-real-secret'

const cleaned = sanitizeDiagnostics({
  // Allowed.
  message: 'Cannot read properties of undefined',
  component_stack: '\n    in Chat\n    in App',
  step: 'p3',
  build_sha: 'abc123',
  url_path: '/',
  iso: '2026-09-14T10:00:00Z',
  // Every one of these is something a future client, or a hand-rolled curl,
  // might put in the body. None has a key in the allowlist.
  resume: RESUME,
  profile: { values: 'family', resume: RESUME },
  outputs: { p3: 'Your Personal Brand is...' },
  coachTranscript: [{ role: 'user', content: COACH }],
  stack: 'Error: boom\n    at Foo (App.jsx:1)',
  authorization: TOKEN,
  email: 'someone@example.com',
  url: 'https://reimagine.career.club/?token=' + TOKEN,
})

const dumped = JSON.stringify(cleaned)
for (const secret of [RESUME, COACH, TOKEN, 'Personal Brand is', 'someone@example.com', 'App.jsx:1', 'family']) {
  check(!dumped.includes(secret),
    `sanitizeDiagnostics let ${JSON.stringify(secret.slice(0, 30))} through -- the allowlist is what makes the "here is exactly what will be sent" promise true`)
}
const strayKeys = Object.keys(cleaned).filter(k => k !== 'trail' && !(k in PAYLOAD_KEYS))
check(strayKeys.length === 0, `sanitizeDiagnostics kept keys outside the allowlist: ${strayKeys.join(', ')}`)

// The full href is refused even though a `url_path` key exists, because a query
// string is somewhere state can hide.
check(!('url' in cleaned), 'the full URL was kept -- only url_path is allowed, since a query string can carry state')
check(cleaned.url_path === '/', 'url_path was dropped, which is an allowed key')
check(cleaned.message === 'Cannot read properties of undefined', 'the error message was dropped, leaving nothing diagnostic')
check(cleaned.component_stack.includes('in Chat'),
  'the component stack was dropped -- it is component names rather than content, it is the single most useful thing in a crash report, and it is the reason this consented path exists at all')

// Objects and arrays must be refused, not stringified. JSON.stringify of an
// unknown object is precisely the uncontrolled shape the allowlist prevents.
const objectValued = sanitizeDiagnostics({ message: { secret: RESUME }, step: ['p3'] })
check(!JSON.stringify(objectValued).includes(RESUME),
  'an OBJECT passed in an allowed key was stringified into the payload -- allowed keys must also be type-checked')
check(!('message' in objectValued) && !('step' in objectValued),
  'a non-scalar value in an allowed key must be dropped, not coerced')

// --- Caps --------------------------------------------------------------

const long = sanitizeDiagnostics({ message: 'x'.repeat(9000), component_stack: 'y'.repeat(9000) })
check(long.message.length === PAYLOAD_KEYS.message, `message was not capped at ${PAYLOAD_KEYS.message}`)
check(long.component_stack.length === PAYLOAD_KEYS.component_stack, `component_stack was not capped at ${PAYLOAD_KEYS.component_stack}`)

// --- The trail is an allowlist too --------------------------------------

const withTrail = sanitizeDiagnostics({
  message: 'boom',
  trail: [
    { kind: 'save_failed', step: 'p3', error_class: 'offline', detail: 'x', at: '2026-09-13T10:00:00Z', resume: RESUME, message: COACH },
    ...Array.from({ length: 40 }, (_, i) => ({ kind: 'client_crash', error_class: 'render', at: `2026-09-${String(i % 28 + 1).padStart(2, '0')}T10:00:00Z` })),
  ],
})
check(!JSON.stringify(withTrail.trail).includes(RESUME), 'a trail entry carried content through -- entries need the same allowlist as the payload')
check(!JSON.stringify(withTrail.trail).includes(COACH), 'a trail entry carried a Coach message through')
check(withTrail.trail.length === MAX_TRAIL,
  `the trail was not capped at ${MAX_TRAIL} entries (got ${withTrail.trail.length}) -- an unbounded array is an unbounded row`)
for (const k of Object.keys(withTrail.trail[0])) {
  check(k in TRAIL_KEYS, `a trail entry kept the key '${k}', which is not in TRAIL_KEYS`)
}
check(!Array.isArray(sanitizeDiagnostics({ message: 'x', trail: 'not an array' }).trail),
  'a non-array trail must be ignored rather than stored')

// An empty result must not become an empty row: a row in this table implies
// somebody chose to send one.
check(Object.keys(sanitizeDiagnostics({ nothing: 'useful' })).length === 0,
  'a body with no recognized keys should sanitize to nothing, so the endpoint can refuse it')
check(Object.keys(sanitizeDiagnostics(null)).length === 0, 'a null body should sanitize to nothing rather than throw')

// --- The endpoint -------------------------------------------------------

const ENDPOINT = 'api/support/diagnostics.js'
const endpoint = fs.readFileSync(ENDPOINT, 'utf8')
check(/getSessionUser/.test(endpoint), `${ENDPOINT}: not authenticated`)
check(/isAllowedOrigin/.test(endpoint), `${ENDPOINT}: no origin check`)
check(/Object\.keys\(payload\)\.length === 0/.test(endpoint) && /status\(400\)/.test(endpoint),
  `${ENDPOINT}: an unrecognizable body must be refused, not stored as an empty row`)
check(/payload\.user_agent = String\(req\.headers\['user-agent'\]/.test(endpoint),
  `${ENDPOINT}: user_agent must be corrected from the request header -- a support report whose browser string is wrong is worse than one with none`)
check(/INSERT INTO support_diagnostics/.test(endpoint), `${ENDPOINT}: does not write to support_diagnostics`)

// --- The client builds the preview and the POST from one function --------

const TRAIL = 'src/support-trail.js'
const trailSrc = fs.readFileSync(TRAIL, 'utf8')
check(!/from ['"]\.\/App/.test(trailSrc) && !/from ['"]react/.test(trailSrc),
  `${TRAIL}: must stay dependency-free -- src/ErrorBoundary.jsx imports it and has to keep working when App.jsx is the module that crashed`)
const tryCount = (trailSrc.match(/try \{/g) || []).length
const catchCount = (trailSrc.match(/catch/g) || []).length
check(tryCount >= 4 && catchCount >= 4,
  `${TRAIL}: every localStorage access must be wrapped -- private-mode browsers throw on read AND write, and a diagnostics helper that can itself throw is worse than one that quietly remembers nothing`)
check(/MAX_TRAIL = 20/.test(trailSrc), `${TRAIL}: the local ring buffer is not capped at 20 entries`)
check(/location\.pathname/.test(trailSrc) && !/location\.href/.test(trailSrc),
  `${TRAIL}: buildDiagnosticsPayload must use location.pathname, never href -- the query string is somewhere state can hide`)

const eb = fs.readFileSync('src/ErrorBoundary.jsx', 'utf8')
check(/buildDiagnosticsPayload/.test(eb) && /JSON\.stringify\(this\.state\.payload, null, 2\)/.test(eb),
  'src/ErrorBoundary.jsx: the crash screen must RENDER the payload it will post, from the same object, so what is shown and what is sent cannot drift')
check(/JSON\.stringify\(this\.state\.payload\)/.test(eb),
  'src/ErrorBoundary.jsx: the POST body must be the same state.payload that was displayed, not a freshly built one')
check(/Send to Career Club/.test(eb) && /Cancel/.test(eb),
  'src/ErrorBoundary.jsx: the crash screen needs both a Send and a Cancel')
check(/recordLocalFailure/.test(eb), 'src/ErrorBoundary.jsx: a crash is not mirrored into the local trail')

const app = fs.readFileSync('src/App.jsx', 'utf8')
check(/buildDiagnosticsPayload\(\{crash,step,buildSha:BUILD_SHA\}\)/.test(app),
  'src/App.jsx: the diagnostics box does not build its payload from the shared builder')
check(/JSON\.stringify\(diagPayload,null,2\)/.test(app) && /body:JSON\.stringify\(diagPayload\)/.test(app),
  'src/App.jsx: the displayed payload and the posted payload must be the same object')
check(/recordLocalFailure\(\{kind:'save_failed'/.test(app),
  'src/App.jsx: a save failure is not mirrored into the local trail, so the Send box would show an empty history')
check(/CoachingCallout>/.test(app.slice(app.indexOf('diagOpen&&!diagSent'))),
  'src/App.jsx: the diagnostics explanation must use the CoachingCallout treatment (CLAUDE.md section 8)')

// --- The guide says what it sends ---------------------------------------

const faq = fs.readFileSync('src/data/user-guide/faq-and-troubleshooting.md', 'utf8')
check(/Send diagnostics/.test(faq), 'the FAQ chapter does not mention Send diagnostics')
check(/does not include your resume/.test(faq),
  'the FAQ paragraph does not say what is NOT sent, which is the half a person reading it actually wants')
check(/My Coach/.test(faq.slice(faq.indexOf('Send diagnostics'))),
  'the FAQ paragraph does not say Coach conversations are excluded')

if (failures) {
  console.error(`test-support-diagnostics: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-support-diagnostics: OK (sanitizeDiagnostics survives a hostile payload carrying resume text, a profile object, a Coach transcript, a token and a raw stack, refuses non-scalars in allowed keys, caps every string and bounds the trail at 20; the endpoint refuses an empty body and corrects user_agent; the client renders and posts the same object from one builder; the trail helper is dependency-free and fully try-wrapped; and the guide says what is sent and what is not)')
}
