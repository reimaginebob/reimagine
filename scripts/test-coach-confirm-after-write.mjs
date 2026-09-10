// Guards finding #1 from the 2026-09-07 My Coach review (Fable brief,
// independently verified before this fix): every quick-reply confirmation
// used to be pushed BEFORE the write was attempted, so a handler returning
// false (target not found, JSON malformed, nothing new to add) could not
// retract an already-shown "Saved."/"Updated."/"Archived." -- a resolver
// miss read as data loss. Also guards finding #3: nine capture keys had no
// explicit `dismiss` branch, so declining fell into JSON.parse('dismiss'),
// threw, and silently posted a pb-checkin row with an answer that table
// does not even accept.
import fs from 'node:fs'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

const CHAT = 'src/components/Chat.jsx'
const chat = fs.readFileSync(CHAT, 'utf8')
const APP = 'src/App.jsx'
const app = fs.readFileSync(APP, 'utf8')

// Fix 1: tapQuickReply no longer pushes the user turn + followUp together
// before awaiting onQuickReply -- the followUp push moved into a branch
// gated on handled===true, after the await.
const tapIdx = chat.indexOf('const tapQuickReply = async (idx, opt, checkinKey) => {')
check(tapIdx !== -1, `${CHAT}: could not find tapQuickReply`)
// Widened for batch item 17 (2026-09-10): the "fold Saved into the coaching
// turn's own bubble via prefixText" comment on the opportunity-update branch
// pushed everything after it past the old 4400-char edge.
const tapBlock = tapIdx !== -1 ? chat.slice(tapIdx, tapIdx + 5100) : ''
check(!tapBlock.slice(0, tapBlock.indexOf('await onQuickReply')).includes("if (opt.followUp) c.push"),
  `${CHAT}: opt.followUp is still pushed before onQuickReply is awaited -- this is the exact false-confirmation bug being fixed`)
check(tapBlock.includes('} else if (handled === true) {') && tapBlock.includes('if (opt.followUp) setMessages(m => [...m, { role: \'assistant\', content: opt.followUp, synthetic: true }])'),
  `${CHAT}: followUp is no longer shown only when handled === true (a plain successful write with nothing more to say)`)
check(tapBlock.includes("nothing matched, so nothing changed"),
  `${CHAT}: a genuine resolver miss (handled === false) no longer says so honestly instead of silently logging to pb-checkin`)
check(tapBlock.includes("if (!r.ok && opt.value !== 'dismiss')"),
  `${CHAT}: the pb-checkin fallback's honest-miss message is not gated correctly against the legitimate dismiss/generic-checkin path`)

// Handlers that already return a message object (opportunity-update,
// close-reason) no longer carry a redundant followUp on their trigger
// button -- that followUp was dead code at best, a contradictory double
// confirmation at worst (e.g. "Saved." from the button, then "That did not
// save..." from the handler's own real failure message).
check(!chat.includes("followUp: 'Updated.'"),
  `${CHAT}: the opportunity-update button still carries a redundant followUp -- execOpportunityUpdate always returns an object or false, never plain true`)
check(!chat.includes("followUp: 'Saved.'"),
  `${CHAT}: the close-reason button still carries a redundant followUp -- execCloseReason always returns an object, never plain true`)

// Fix 3: dismiss guard added to the 9 capture keys that lacked one.
const DISMISS_KEYS = [
  'opportunity-context', 'interview-team', 'values-capture', 'reputation-capture',
  'skills-capture', 'priorities-capture', 'life-story-capture', 'assessment-capture',
  'pursuit-stage',
]
for (const key of DISMISS_KEYS) {
  const idx = app.indexOf(`checkinKey==='${key}'){`)
  check(idx !== -1, `${APP}: could not find the ${key} branch`)
  const block = idx !== -1 ? app.slice(idx, idx + 120) : ''
  check(block.includes("if(value==='dismiss')return true"),
    `${APP}: ${key} still has no dismiss guard -- "Not now" would fall through to JSON.parse('dismiss') and throw`)
}

if (failures) {
  console.error(`test-coach-confirm-after-write: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-coach-confirm-after-write: OK (confirmations show only after a write actually lands, resolver misses say so honestly, redundant followUps removed, all 9 capture keys handle dismiss explicitly)')
}
