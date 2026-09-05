// Guards the session-open recap wiring (Coach-as-Concierge Phase 1, item 2):
// the returning-session opener the coach speaks on its own, gated behind the
// next_step pilot flag. Source-level rather than a live-call test for the
// same reason test-coach-cache-blocks.mjs is: hitting the real endpoint costs
// money and needs a live key and a real session, and cannot be run here. This
// pins down the pieces a refactor could silently break: the server-side gate
// and short-circuit, the profile-slice threading, and the client's silent
// send path (in particular, that a thrown fetch error on a silent open never
// clobbers the transcript's real last message with an error bubble).
import fs from 'node:fs'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

const COACH = 'api/coach.js'
const coach = fs.readFileSync(COACH, 'utf8')

check(/import\s*\{[^}]*computeSessionDelta[^}]*\}\s*from\s*'\.\.\/src\/step-position\.js'/.test(coach),
  `${COACH}: computeSessionDelta is not imported from src/step-position.js`)

// The authoritative gate: sessionOpen is only ever honored for a real,
// non-general-mode account that actually holds the next_step pilot -- never
// on the client's say-so alone.
check(/const sessionOpenRequested = sessionOpen === true && !generalMode && hasNextStep\(/.test(coach),
  `${COACH}: sessionOpenRequested does not re-check hasNextStep server-side -- an unflagged account could reach the recap path`)

// No prior session to diff against (first-ever login) must short-circuit
// BEFORE any model call -- there is nothing to recap, and the pilot's own
// contract (computeSessionDelta's null return) says so.
check(/if \(sessionOpenRequested && !user\.prior_session_at\) \{/.test(coach),
  `${COACH}: lost the guard that skips the model call entirely when this account has no prior_session_at`)
check(/res\.status\(204\)\.end\(\)/.test(coach),
  `${COACH}: lost the 204 short-circuit for a session-open request with nothing to recap`)

// buildCoachProfileSlice must actually receive the two new arguments -- a
// silent regression here would leave the note permanently empty.
check(/buildCoachProfileSlice\([^)]*user\.prior_session_at,\s*sessionOpenRequested\)/.test(coach),
  `${COACH}: the buildCoachProfileSlice call site no longer threads user.prior_session_at / sessionOpenRequested`)

// The note itself must be gated on BOTH the pilot flag and this specific
// turn being the session's opener -- never on an ordinary mid-conversation
// turn, which would drag "since your last session" into an unrelated reply.
check(/const sessionOpenNote = \(sightOn && sessionOpenRequested\)/.test(coach),
  `${COACH}: sessionOpenNote is not gated on (sightOn && sessionOpenRequested)`)
check(coach.includes('${sessionOpenNote}'),
  `${COACH}: sessionOpenNote is computed but never spliced into the returned profile block`)

const CHAT = 'src/components/Chat.jsx'
const chat = fs.readFileSync(CHAT, 'utf8')

check(/const send = async \(explicit, \{ silent = false \} = \{\}\) =>/.test(chat),
  `${CHAT}: send() lost its silent option -- the session-open trigger calls send(null, { silent: true })`)
check(chat.includes('sessionOpen: true'),
  `${CHAT}: send() no longer sends sessionOpen: true on a silent turn`)
check(/silent && res\.status === 204/.test(chat),
  `${CHAT}: send() no longer special-cases a 204 (nothing to recap) on the silent path`)
// The bug this guards: on a normal send the optimistic placeholder is always
// pushed before the fetch, so `copy[copy.length - 1]` in the catch block is
// safely that placeholder. A silent open pushes nothing until a real,
// non-204 response is in hand -- so if fetch itself throws, that same line
// would overwrite the transcript's actual last message with an error bubble
// unless the catch block is guarded. (2026-09-05, Gap 1: the catch block now
// branches on AbortError first -- a user-initiated Stop -- before reaching
// this !silent-gated fallback; see test-coach-stop-generating.mjs for that.)
check(/\}\s*else if \(!silent\) \{\s*\/\//.test(chat),
  `${CHAT}: the outer catch block's fallback message is not guarded on !silent -- a network error during a silent open would clobber a real message in the transcript`)
check(chat.includes('sessionOpenEligible = false'),
  `${CHAT}: Chat no longer accepts a sessionOpenEligible prop`)
check(/if \(!sessionOpenEligible\) return/.test(chat),
  `${CHAT}: the session-open trigger effect lost its sessionOpenEligible guard`)
check(chat.includes("sessionStorage.getItem('reimagine_session_recap_fired')") && chat.includes("sessionStorage.setItem('reimagine_session_recap_fired', '1')"),
  `${CHAT}: the once-per-login-session guard (sessionStorage, not localStorage) is missing -- localStorage's persisted transcript spans every login and cannot tell a new session from a reopened one`)

const APP = 'src/App.jsx'
const app = fs.readFileSync(APP, 'utf8')
const sessionOpenPropCount = (app.match(/sessionOpenEligible=\{hasNextStep\}/g) || []).length
check(sessionOpenPropCount === 2,
  `${APP}: expected sessionOpenEligible={hasNextStep} on both <Chat> mounts (floating + embedded), found ${sessionOpenPropCount}`)

if (failures) {
  console.error(`test-coach-session-open: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-coach-session-open: OK (server gate, 204 short-circuit, profile-slice threading, client silent-send path all present)')
}
