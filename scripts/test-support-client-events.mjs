// Part B of the 2026-09-08 observability brief: the half of the error trail the
// server cannot see. A render crash and the two save failures where the request
// never arrived (offline, device_full) happen entirely inside the browser, and
// until this shipped they never left it -- src/ErrorBoundary.jsx wrote a record
// to localStorage and stopped there, so every crash nobody bothered to copy and
// paste into an email simply never happened as far as we knew.
//
// Three things here are worth a gate rather than a comment, because each has a
// quiet failure mode that no other check would catch:
//
//   1. The client must NOT post the failures the server already records. Doing
//      so double-counts every 413/409/500 and makes the trail lie about how
//      often saving breaks.
//   2. The client must not be able to post a server-side KIND at all. A browser
//      that could post generation_failed could invent failures the server never
//      observed.
//   3. The crash report must not carry the stack or the component stack. Those
//      are strings whose contents we do not control, and the consented
//      diagnostics upload (PR 4) is where the fuller record belongs -- behind a
//      click, with the payload shown first.
import fs from 'node:fs'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

// --- The endpoint ---------------------------------------------------------

const ENDPOINT = 'api/support/client-event.js'
check(fs.existsSync(ENDPOINT), `${ENDPOINT}: file is missing`)
const endpoint = fs.readFileSync(ENDPOINT, 'utf8')

check(/from '\.\.\/_lib\/support-events\.js'/.test(endpoint),
  `${ENDPOINT}: must import from _lib/support-events.js with the .js extension -- a .mjs import across the api/src boundary is the 2026-05-27 FUNCTION_INVOCATION_FAILED outage`)
check(/CLIENT_SUPPORT_EVENT_KINDS\.includes\(kind\)/.test(endpoint),
  `${ENDPOINT}: the kind is not checked against CLIENT_SUPPORT_EVENT_KINDS -- without it a browser could post generation_failed or coach_failed and fabricate failures the server never observed`)
check(/getSessionUser/.test(endpoint),
  `${ENDPOINT}: the endpoint is not authenticated -- every row is keyed to an account, and an unauthenticated writer could fill the table`)
check(/isAllowedOrigin/.test(endpoint),
  `${ENDPOINT}: the origin check is missing on a browser-facing write endpoint`)
check(/clientEventRateLimited/.test(endpoint),
  `${ENDPOINT}: no per-user rate limit -- a component that throws on every render would write a row per render forever`)

// user_agent is a fact about the connection. Taking the client's word for it
// would turn one of the few reliably-true columns into one that is not.
check(/user_agent: req\.headers\['user-agent'\]/.test(endpoint),
  `${ENDPOINT}: user_agent must come from the request header, never from the body`)
check(!/user_agent: body\./.test(endpoint),
  `${ENDPOINT}: user_agent is being read from the request body`)

// Everything that reaches recordSupportEvent from the body must be a
// support_events column. The sanitizer would drop anything else anyway; this
// asserts the endpoint does not even try.
const recordCall = endpoint.slice(endpoint.indexOf('await recordSupportEvent('))
const bodyReads = [...recordCall.matchAll(/body\.(\w+)/g)].map(m => m[1])
const allowed = ['step', 'error_class', 'http_status', 'duration_ms', 'build_sha', 'detail']
const stray = bodyReads.filter(f => !allowed.includes(f))
check(stray.length === 0,
  `${ENDPOINT}: reads ${stray.join(', ')} off the request body into the event -- only ${allowed.join('/')} are support_events columns`)

// A signed-out crash has no account to hang off. It must not 401 into a broken
// screen; there is simply nothing to write.
check(/if \(!user\) return res\.status\(204\)/.test(endpoint),
  `${ENDPOINT}: a signed-out caller should get a quiet 204, not an error response on a screen that has already failed`)

// --- ErrorBoundary: what it sends, and what it must not ------------------

const EB = 'src/ErrorBoundary.jsx'
const eb = fs.readFileSync(EB, 'utf8')

check(/\/api\/support\/client-event/.test(eb),
  `${EB}: the crash is still never reported -- localStorage plus a clipboard copy was the whole outbound path`)
check(/kind: 'client_crash'/.test(eb), `${EB}: the posted kind is not client_crash`)
check(/error_class: 'render'/.test(eb), `${EB}: the crash is not classed as a render error`)

const post = eb.slice(eb.indexOf('reportCrash(record)'), eb.indexOf('copyDiagnostic'))
const postBody = post.slice(post.indexOf('body: JSON.stringify('), post.indexOf('keepalive'))
for (const forbidden of ['stack', 'componentStack', 'record.url', 'url:']) {
  check(!postBody.includes(forbidden),
    `${EB}: the crash POST carries ${forbidden} -- stack strings and the URL are not support_events columns, and the fuller record belongs in the consented diagnostics upload where the user reads it first`)
}
check(/record\.message/.test(postBody), `${EB}: the crash POST carries no error message, which leaves the row with nothing diagnostic in it`)
check(/record\.build/.test(postBody), `${EB}: the crash POST carries no build SHA -- "one user hit something odd" and "the build that shipped an hour ago is crashing" then look identical`)

// The boundary runs on a screen that has already failed. An unhandled rejection
// here would be a second error on top of the first.
check(/\.catch\(\(\) => \{\}\)/.test(post),
  `${EB}: the crash POST's promise rejection is not swallowed -- an unhandled rejection on an already-broken screen is a second failure`)
check(/try \{[\s\S]*fetch\(/.test(post) && /\} catch \{\}/.test(post),
  `${EB}: the crash POST is not wrapped in try/catch`)
check(!/await fetch/.test(post),
  `${EB}: the crash POST is awaited -- reporting must never delay the fallback UI the user is waiting to see`)

// The original outbound path stays. The upload is an addition, not a
// replacement: a user who cannot reach the network still has the copy button.
check(/copyDiagnostic/.test(eb) && /clipboard\.writeText/.test(eb),
  `${EB}: the Copy diagnostic path was removed -- it is the fallback for a user who cannot reach the network at all`)
check(/localStorage\.setItem\(STORAGE_KEY/.test(eb),
  `${EB}: the local diagnostic record is no longer written, which the Copy button and PR 4's upload both read`)

// --- App.jsx: only the two the server never sees ------------------------

const APP = 'src/App.jsx'
const app = fs.readFileSync(APP, 'utf8')

const helper = app.slice(app.indexOf('const reportSaveFailure='), app.indexOf('const[toast,setToast]'))
check(helper.length > 0, `${APP}: reportSaveFailure is missing`)
check(/if\(reason!=='offline'&&reason!=='device_full'\)return/.test(helper),
  `${APP}: reportSaveFailure does not restrict itself to 'offline' and 'device_full'. api/profile/save.js records 413/409/500 server-side, so posting those from here too double-counts every one of them, and 'paused'/'signed_out' are not save-machinery failures at all`)
check(/lastReportedSaveFailureRef\.current===reason/.test(helper),
  `${APP}: a repeated identical failure is not deduped -- the autosave effect reschedules on every state change, so someone typing through an offline stretch would post a row every few seconds`)
check(/lastReportedSaveFailureRef\.current=null/.test(app),
  `${APP}: the dedupe ref is never cleared on a successful save, so a failure that comes back after a recovery would go unreported`)
check(/\.catch\(\(\)=>\{\}\)/.test(helper),
  `${APP}: reportSaveFailure's rejection is not swallowed -- on the 'offline' path this POST is itself expected to fail, and it must never surface a second error to someone whose work is already not saving`)

// Both failure sites call it.
check(/setSaveError\(reason\);reportSaveFailure\(reason\)/.test(app),
  `${APP}: the server-response save-failure path does not report`)
check(/setSaveError\('device_full'\);reportSaveFailure\('device_full'\)/.test(app),
  `${APP}: the localStorage-failure path does not report`)

// --- The build SHA reaches every surface that can record a failure -------

check(/"x-reimagine-build":BUILD_SHA/.test(app),
  `${APP}: callClaude does not stamp the build header, so every generation_failed row lands with a null build_sha`)
const coachHeaders = (app.match(/'x-reimagine-build':BUILD_SHA/g) || []).length
check(coachHeaders >= 3,
  `${APP}: expected the build header on both coach fetches and the profile save PUT (found ${coachHeaders}) -- a save_failed row recorded server-side needs it just as much as a generation does`)

const chat = fs.readFileSync('src/components/Chat.jsx', 'utf8')
check(/import \{ BUILD_SHA \} from '\.\.\/build-meta\.js'/.test(chat),
  'src/components/Chat.jsx: BUILD_SHA is not imported')
check(/'x-reimagine-build': BUILD_SHA/.test(chat),
  'src/components/Chat.jsx: the main Coach fetch does not stamp the build header, so coach_failed rows from real conversations land with a null build_sha')

if (failures) {
  console.error(`test-support-client-events: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-support-client-events: OK (the client-event endpoint is authenticated, origin-checked, rate-limited and accepts only the two browser-postable kinds; ErrorBoundary reports a crash without its stack strings or URL and never delays or breaks the fallback screen; App.jsx reports only the two save failures the server never sees, deduped and fail-silent; and every surface that can record a failure stamps the build it was running)')
}
