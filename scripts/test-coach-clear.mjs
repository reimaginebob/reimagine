// My Coach's "Clear" button (2026-09-16, PR D of the four-fixes batch --
// Bob approved the confirmation copy verbatim after the other three PRs
// (redact-pii, widenSearchState autosave, coach holds surviving reload)
// shipped). Two things were wrong before this: the confirmation text
// claimed clearing wiped "everything [Coach] has noticed about you", which
// is not true (saved profile/playbook fields are untouched, and Coach's
// own prompt still draws on them regardless of chat history); and the
// clear itself never left the browser tab that tapped it, so the text's
// own "on every device where you're signed in" promise did not hold --
// a reload, sign-out/sign-in, or a second device rehydrated the full
// transcript again via GET /api/coach-history.
//
// The fix is a display boundary (users.chat_cleared_at), not a delete:
// chat_messages rows are untouched (still there for the admin coach-
// insights dashboard, generation billing, and support diagnostics), and
// only the one rehydration read (api/coach-history.js) respects the cut --
// covered by scripts/test-coach-history-reload.mjs's own chat_cleared_at
// check, not duplicated here.
import fs from 'node:fs'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

const EXPECTED_TEXT = "This clears your conversation with Coach on every device where you're signed in. Anything you've saved to your profile or playbooks stays, and Coach still knows it. This can't be undone. Continue?"

// --- The migration: a display boundary, never a delete --------------------

const MIGRATION = 'migrations/2026-09-16_coach-chat-clear.sql'
check(fs.existsSync(MIGRATION), `${MIGRATION}: file is missing`)
const migration = fs.existsSync(MIGRATION) ? fs.readFileSync(MIGRATION, 'utf8') : ''
check(/ALTER TABLE users ADD COLUMN IF NOT EXISTS chat_cleared_at TIMESTAMPTZ/.test(migration),
  `${MIGRATION}: the chat_cleared_at column add is missing or not idempotent (IF NOT EXISTS) -- migrations auto-apply on every production deploy and must re-run as a no-op`)
check(!/DROP\s|DELETE\s+FROM|TRUNCATE/i.test(migration),
  `${MIGRATION}: contains a drop/delete/truncate -- Clear is a display boundary on read, never a data delete`)

// --- The endpoint: POST-only, session-scoped, updates one column ----------

const ENDPOINT = 'api/coach-clear.js'
check(fs.existsSync(ENDPOINT), `${ENDPOINT}: file is missing`)
const endpoint = fs.existsSync(ENDPOINT) ? fs.readFileSync(ENDPOINT, 'utf8') : ''
check(endpoint.includes("import { sql } from './_lib/db.js'") && endpoint.includes("import { requireAuth } from './_lib/session.js'"),
  `${ENDPOINT}: does not import sql/requireAuth from the same _lib modules the other Coach endpoints use`)
check(endpoint.includes('export default requireAuth(handler)'),
  `${ENDPOINT}: handler is not wrapped in requireAuth -- would let anyone clear any account's chat history`)
check(endpoint.includes("if (req.method !== 'POST')"),
  `${ENDPOINT}: missing the POST-only method guard`)
check(/UPDATE users\s+SET chat_cleared_at = NOW\(\)\s+WHERE id = \$\{req\.user\.id\}/.test(endpoint),
  `${ENDPOINT}: the write is missing, no longer stamps NOW(), or is not scoped to req.user.id -- any of those would either do nothing or clear the wrong account`)
check(!/DELETE\s+FROM\s+chat_messages/i.test(endpoint),
  `${ENDPOINT}: deletes from chat_messages -- Clear must never touch the stored rows, only the display boundary`)

// --- Chat.jsx: the approved copy, at both Clear buttons --------------------

const CHAT = 'src/components/Chat.jsx'
const chat = fs.readFileSync(CHAT, 'utf8')

check(chat.includes(`const CLEAR_CONFIRM_TEXT = ${JSON.stringify(EXPECTED_TEXT)}`),
  `${CHAT}: CLEAR_CONFIRM_TEXT does not match Bob's approved verbatim copy exactly`)

const confirmCallCount = (chat.match(/window\.confirm\(CLEAR_CONFIRM_TEXT\)/g) || []).length
check(confirmCallCount === 2,
  `${CHAT}: expected both Clear buttons (embedded panel, floating/maximized panel) to confirm with CLEAR_CONFIRM_TEXT -- found ${confirmCallCount}`)

// No stray inline confirm copy left over from before the shared constant --
// this is what would catch a THIRD Clear button added later that forgot to
// reuse CLEAR_CONFIRM_TEXT.
const inlineClearConfirms = (chat.match(/window\.confirm\(['"]This clears/g) || []).length
check(inlineClearConfirms === 0,
  `${CHAT}: found a Clear confirm still using an inline string instead of the shared CLEAR_CONFIRM_TEXT constant`)

// Both Clear taps must call the server-side clear (clearChatServerSide)
// alongside the local reset -- a local-only reset is what silently broke
// the "on every device" promise before this PR.
const clearSiteCount = (chat.match(/clearChatServerSide\(\); setMessages\(\[INTRO_MSG\]\)/g) || []).length
check(clearSiteCount === 2,
  `${CHAT}: expected both Clear buttons to call clearChatServerSide() alongside the local setMessages reset -- found ${clearSiteCount}`)

check(chat.includes("fetch('/api/coach-clear', { method: 'POST', credentials: 'include' })"),
  `${CHAT}: clearChatServerSide does not POST to /api/coach-clear with credentials`)

if (failures) {
  console.error(`test-coach-clear: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-coach-clear: OK (Bob\'s approved copy is used verbatim at both Clear buttons, each pairs the local reset with a real server-side chat_cleared_at write so the clear holds on every signed-in device, and the underlying chat_messages rows are never deleted)')
}
