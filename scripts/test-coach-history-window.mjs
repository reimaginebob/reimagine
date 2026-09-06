// Guards the coach history window fix (2026-09-06). The server only ever fed
// the model the last 10 messages of a conversation regardless of how much the
// browser actually kept -- App.jsx persists up to the last 50
// (localStorage.setItem('reimagine_chat_history', ...chatMessages.slice(-50))).
// That mismatch meant Coach could lose track of something said just a few
// exchanges ago, well within one active sitting on a product meant to be
// leaned on throughout the whole session. Raised to match the client's own
// cap; no rationale for the original 10 was ever documented (checked git
// history before changing it).
import fs from 'node:fs'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

const COACH = 'api/coach.js'
const coach = fs.readFileSync(COACH, 'utf8')

check(coach.includes('...history.slice(-50).map(m => ({ role: m.role, content: m.content }))'),
  `${COACH}: history window is not raised to 50 messages`)
check(!coach.includes('history.slice(-10)'),
  `${COACH}: the old 10-message cap is still present somewhere`)

const APP = 'src/App.jsx'
const app = fs.readFileSync(APP, 'utf8')
check(app.includes("chatMessages.slice(-50)"),
  `${APP}: the client's own persistence cap changed -- re-check that it still matches the server's history window (both should raise together, not drift apart again)`)

if (failures) {
  console.error(`test-coach-history-window: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-coach-history-window: OK (server history window matches the client\'s 50-message persistence cap, old 10-message cap removed)')
}
