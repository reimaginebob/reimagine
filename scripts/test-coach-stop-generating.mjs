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
check(chat.includes('if (last && last.role === \'assistant\' && !last.content) return m.slice(0, -1)'),
  `${CHAT}: the abort branch no longer cleans up an empty placeholder -- stopping before any text streamed back would leave a blank bubble forever`)
check(chat.includes("} else if (!silent) {\n        // A silent open never pushed a placeholder"),
  `${CHAT}: the real-failure branch (the pre-existing fallback message) is no longer gated behind the AbortError check`)
check(chat.includes('abortRef.current = null\n      setLoading(false)'),
  `${CHAT}: the finally block no longer clears abortRef.current -- a stale controller could be aborted again on a later, unrelated send`)

// The Send button becomes a Stop button while loading -- same slot, not a
// second control -- and the abort call is guarded against a null ref.
check(chat.includes('onClick={loading ? () => { if (abortRef.current) abortRef.current.abort() } : send}'),
  `${CHAT}: the input-row button no longer toggles between Stop (calling abortRef.current.abort()) and send() based on loading`)
check(chat.includes("{loading ? 'Stop' : 'Send'}"),
  `${CHAT}: the button label no longer switches to "Stop" while loading`)
check(chat.includes('disabled={!loading && !input.trim()}'),
  `${CHAT}: the button is no longer enabled while loading (it needs to stay clickable so Stop actually works, unlike the old disabled={loading || !input.trim()})`)

if (failures) {
  console.error(`test-coach-stop-generating: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-coach-stop-generating: OK (AbortController wired into the request, Send/Stop toggle in one slot, user-initiated abort never mistaken for a failure, empty placeholder cleaned up on an early stop)')
}
