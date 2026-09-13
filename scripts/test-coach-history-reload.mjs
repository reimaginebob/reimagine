// Guards reloading Coach chat history from the server on sign-in (2026-09-13).
// Signing out clears reimagine_chat_history by design (clearAccountLocalState),
// but nothing repopulated it from the server's own copy on the next sign-in,
// so a real conversation looked lost. Two pieces:
//   1. api/coach-history.js -- a new requireAuth-wrapped GET returning this
//      user's last 25 real (turn_kind='user' or null) exchanges from
//      chat_messages, oldest first, mirroring api/profile/load.js's own
//      one-SELECT pattern exactly.
//   2. A hydration step appended to the existing /api/me -> /api/profile/load
//      chain (src/App.jsx) that calls the new endpoint and repopulates
//      chatMessages when the panel is still at its untouched [INTRO_MSG]
//      default -- gated twice (once on the mount-time snapshot before firing
//      the request, once inside the functional setChatMessages updater
//      against the live value) so a message that arrives while the request
//      is in flight is never clobbered by it resolving late.
import fs from 'node:fs'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

const ENDPOINT = 'api/coach-history.js'
const endpoint = fs.readFileSync(ENDPOINT, 'utf8')
const APP = 'src/App.jsx'
const app = fs.readFileSync(APP, 'utf8')

// --- The endpoint ---
check(endpoint.includes("import { sql } from './_lib/db.js'") && endpoint.includes("import { requireAuth } from './_lib/session.js'"),
  `${ENDPOINT}: does not import sql/requireAuth from the same _lib modules api/profile/load.js uses`)
check(endpoint.includes('export default requireAuth(handler)'),
  `${ENDPOINT}: handler is not wrapped in requireAuth -- would serve any user's chat history to anyone`)
check(/FROM\s+chat_messages/.test(endpoint) && endpoint.includes('WHERE user_id = ${req.user.id}'),
  `${ENDPOINT}: query is missing or no longer scoped to req.user.id`)
check(endpoint.includes("turn_kind = 'user' OR turn_kind IS NULL"),
  `${ENDPOINT}: no longer filters to real conversational turns (turn_kind='user'/null) -- would try to replay proactive-moment rows as plain exchanges`)
check(/LIMIT\s+25/.test(endpoint), `${ENDPOINT}: the 25-turn cap is missing or has drifted`)
check(endpoint.includes('rows.reverse()'),
  `${ENDPOINT}: rows are not reversed back to oldest-first after the DESC-ordered query`)
check(endpoint.includes("{ role: 'user', content: r.message }") && endpoint.includes("{ role: 'assistant', content: r.reply }"),
  `${ENDPOINT}: does not emit one user/assistant pair per row in the shape the client's chatMessages expects`)

// --- The client hydration step ---
const chainIdx = app.indexOf("fetch('/api/me'")
check(chainIdx !== -1, `${APP}: the /api/me sign-in hydration chain is missing`)
const chainBlock = chainIdx !== -1 ? app.slice(chainIdx, chainIdx + 6000) : ''
const historyFetchIdx = chainBlock.indexOf("fetch('/api/coach-history'")
check(historyFetchIdx !== -1, `${APP}: no fetch('/api/coach-history') found in the sign-in hydration chain`)

// It must be a SEPARATE .then() appended after the serverProfile-processing
// block, not nested inside it -- so a failure here can never block the
// profile hydration that already works. Checked by requiring the profile
// block's own closing brace comment to appear before the new fetch.
const profileBlockEndIdx = chainBlock.indexOf('2026-06-04_localstorage-account-scoping.md')
check(profileBlockEndIdx !== -1 && historyFetchIdx > profileBlockEndIdx,
  `${APP}: coach-history hydration is not appended as its own .then() after the serverProfile block -- it may have been nested inside it, which would let a failure here block profile hydration`)

// Still inside the SAME chain (before the shared .catch/.finally), not a
// second, disconnected effect.
const catchFinallyIdx = chainBlock.indexOf('.catch(()=>{}).finally(()=>{serverLoadDoneRef.current=true')
check(catchFinallyIdx !== -1 && historyFetchIdx < catchFinallyIdx,
  `${APP}: coach-history hydration is not inside the existing hydration chain (before its shared .catch/.finally)`)

// Outer gate: only fire the request when the panel was at its untouched
// default at mount (the exact "sign-out cleared local storage" case) --
// not just any array of length 1, and not INTRO_MSG-content-alone without
// checking role/banner (mirrors the existing INTRO_MSG-only check pattern
// at the "Ask My Coach about this" card, App.jsx ~9660).
check(chainBlock.includes("chatMessages.length===1&&chatMessages[0]&&chatMessages[0].role==='assistant'&&!chatMessages[0].banner&&chatMessages[0].content===INTRO_MSG.content"),
  `${APP}: coach-history hydration's outer gate is missing or does not match the established INTRO_MSG-only check shape`)

// Inner guard: the actual write re-checks the SAME condition against the
// LIVE value inside the functional setChatMessages updater, so a message
// that arrived while the request was in flight is never overwritten by a
// stale mount-time decision resolving late.
check(chainBlock.includes("setChatMessages(cur=>(cur.length===1&&cur[0]&&cur[0].role==='assistant'&&!cur[0].banner&&cur[0].content===INTRO_MSG.content)?[INTRO_MSG,...data.turns]:cur)"),
  `${APP}: coach-history hydration's write is not guarded with a functional setChatMessages check against the live value -- a message arriving mid-request could be silently discarded`)

// A failed/empty response must be a no-op, not an error or a reset to
// [INTRO_MSG] alone.
check(chainBlock.includes('data&&Array.isArray(data.turns)&&data.turns.length>0'),
  `${APP}: coach-history hydration does not guard against a missing/empty turns array before writing`)
check(chainBlock.slice(historyFetchIdx, historyFetchIdx + 500).includes('.catch(()=>{})'),
  `${APP}: the coach-history fetch has no .catch, so a network failure here could throw unhandled instead of silently no-opping`)

if (failures) {
  console.error(`test-coach-history-reload: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-coach-history-reload: OK (api/coach-history.js returns this user\'s last 25 real exchanges via the same requireAuth+single-SELECT pattern as api/profile/load.js; the sign-in hydration chain fetches it as its own trailing .then(), gated on the panel being untouched at mount and re-guarded against the live value at write time so an in-flight message is never clobbered)')
}
