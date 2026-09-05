// Guards focus-return on close (2026-09-05 accessibility audit, Gap 3): a
// keyboard or screen-reader user who opens the floating coach and closes it
// should land back on the trigger bubble, not <body>. Source-level for the
// same reason its siblings are: this needs a real signed-in browser session
// to exercise end to end.
import fs from 'node:fs'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

const CHAT = 'src/components/Chat.jsx'
const chat = fs.readFileSync(CHAT, 'utf8')

check(chat.includes('const bubbleBtnRef = useRef(null)'),
  `${CHAT}: bubbleBtnRef is missing`)
check(chat.includes('const wasOpenRef = useRef(false)'),
  `${CHAT}: wasOpenRef is missing -- without it the effect would steal focus onto the bubble on initial page load, before anything was ever opened`)

// The bubble button itself must carry the ref, or there is nothing to focus.
check(chat.includes("ref={bubbleBtnRef}\n                onClick={() => { setOpen(true); if (onDismissPulse) onDismissPulse() }}"),
  `${CHAT}: the trigger bubble button lost its bubbleBtnRef -- focus-return would have nothing to focus`)

// The effect condition: all four guards must be present together. Losing any
// one reopens a real failure mode -- embedded would try to focus a bubble
// that does not exist, no wasOpenRef guard would steal focus on first mount,
// no bubbleBtnRef.current guard would throw on a null ref, and no !open
// guard would fire while the panel is still open.
check(chat.includes('if (!embedded && !open && wasOpenRef.current && bubbleBtnRef.current) bubbleBtnRef.current.focus()'),
  `${CHAT}: the focus-return effect's guard condition changed -- confirm it still checks !embedded, !open, wasOpenRef.current, and bubbleBtnRef.current together before calling .focus()`)
check(chat.includes('wasOpenRef.current = open\n  }, [open, embedded])'),
  `${CHAT}: the focus-return effect no longer updates wasOpenRef every run or lost its [open, embedded] dependency array`)

if (failures) {
  console.error(`test-coach-focus-return: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-coach-focus-return: OK (bubbleBtnRef wired to the trigger button, focus-return effect guards against first-mount steal, the embedded variant, and a still-open panel)')
}
