// Guards Stop-generating (2026-09-05 accessibility/UX audit, Gap 1): the
// Send button doubles as Stop while a reply streams, backed by an
// AbortController, and a user-initiated stop is never mistaken for a real
// failure. Source-level for the same reason its siblings are: this needs a
// real signed-in browser session to exercise end to end.
import fs from 'node:fs'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

const CHAT = 'src/components/Chat.jsx'
const chat = fs.readFileSync(CHAT, 'utf8')

check(chat.includes('const abortRef = useRef(null)'),
  `${CHAT}: abortRef is missing`)
check(chat.includes("const controller = new AbortController()\n    abortRef.current = controller"),
  `${CHAT}: send() no longer creates and stores an AbortController before the fetch`)
check(chat.includes('signal: controller.signal,'),
  `${CHAT}: the fetch to /api/coach no longer passes the abort signal -- Stop would have nothing to cancel`)

// The catch block must distinguish a user-initiated abort from a real
// failure. Losing this would make clicking Stop look exactly like a dropped
// connection and overwrite the partial reply with an apology.
check(chat.includes("} catch (err) {\n      if (err && err.name === 'AbortError') {"),
  `${CHAT}: the catch block no longer distinguishes AbortError from a real failure`)
// Addressed by turnId since 2026-09-17 (the conversation-hold PR): dropping
// "the last message" would delete an unprompted Coach message that happened to
// arrive between the Stop click and this cleanup, instead of this turn's own
// empty bubble. See scripts/test-coach-conversation-hold.mjs.
check(chat.includes("const i = m.findIndex(x => x && x.turnId === turnId)\n          if (i === -1) return m\n          const last = m[i]\n          if (last.role === 'assistant' && !last.content) return [...m.slice(0, i), ...m.slice(i + 1)]"),
  `${CHAT}: the abort branch no longer cleans up its own empty placeholder by turnId -- stopping before any text streamed back would leave a blank bubble forever, or would drop somebody else's message`)
check(chat.includes("} else if (!isSilentTurn) {\n        // A silent turn (session-open or post-capture) never pushed a"),
  `${CHAT}: the real-failure branch (the pre-existing fallback message) is no longer gated behind the AbortError check`)
check(chat.includes('abortRef.current = null\n      setLoading(false)'),
  `${CHAT}: the finally block no longer clears abortRef.current -- a stale controller could be aborted again on a later, unrelated send`)

// The composer's send/mic slot becomes a Stop button while loading (2026-09-18,
// composer polish pass: the slot is now adaptive -- mic/Send/Stop share one
// position rather than Send/Stop alone -- so the check moves from one ternary
// to the `loading ?` branch of that slot) -- and the abort call is guarded
// against a null ref.
const stopSlotStart = chat.indexOf('{loading ? (\n        <button\n          onClick={() => { if (abortRef.current) abortRef.current.abort() }}')
check(stopSlotStart !== -1,
  `${CHAT}: the composer slot no longer renders a Stop button (calling abortRef.current.abort()) while loading`)
const stopSlotClose = stopSlotStart === -1 ? -1 : chat.indexOf('</button>', stopSlotStart)
const stopSlotBlock = stopSlotStart === -1 ? '' : chat.slice(stopSlotStart, stopSlotClose)
check(stopSlotBlock.includes('\n          Stop\n        '),
  `${CHAT}: the Stop button's label is missing while loading`)
check(!stopSlotBlock.includes('disabled'),
  `${CHAT}: a disabled prop was added to the Stop button -- it must stay unconditionally clickable while loading, unlike the old disabled={loading || !input.trim()}`)

if (failures) {
  console.error(`test-coach-stop-generating: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-coach-stop-generating: OK (AbortController wired into the request, Send/Stop toggle in one slot, user-initiated abort never mistaken for a failure, empty placeholder cleaned up on an early stop)')
}
