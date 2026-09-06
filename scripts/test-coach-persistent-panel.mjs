// Guards the coach persistent/resizable panel fix (2026-09-06), from Cowork's
// research consult on My Coach disappearing across navigation. Chat.jsx's
// floating panel used to hold `open` (and would have held `maximized`) as
// local state -- fine while the component stays mounted, but the dedicated
// My Coach step fully unmounts the floating <Chat> (App.jsx gates it on
// `step!=='myCoach'`), which reset that state to its initial value on every
// remount. Bob's own diagnosis: leaving My Coach for another screen always
// handed back a closed, default-size panel, no matter what was open when he
// left. Fixed by lifting `open`/`maximized` to App.jsx, mirroring the
// messages/setMessages lift that already existed for the same reason.
//
// Also guards the maximize/restore size toggle: a reversible size change on
// the SAME floating panel (not a second My Coach destination), sized so the
// 260px nav rail can never be covered -- staying visible is what keeps it
// reading as part of the workspace rather than a takeover.
import fs from 'node:fs'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

const CHAT = 'src/components/Chat.jsx'
const chat = fs.readFileSync(CHAT, 'utf8')

// Chat() must accept open/setOpen/maximized/setMaximized as controlled props,
// with a local-state fallback so it stays safe as an uncontrolled component
// if a future caller omits them (the embedded mount does not pass any of
// these, since it never reads `open` meaningfully -- see the "always open"
// comments already in this file).
check(/open: openProp = false, setOpen: setOpenProp = null, maximized = false, setMaximized = null/.test(chat),
  `${CHAT}: Chat() no longer accepts open/setOpen/maximized/setMaximized as controlled props`)
check(chat.includes('const open = setOpenProp ? openProp : localOpen'),
  `${CHAT}: open no longer prefers the controlled prop over local state`)
check(chat.includes('const isMaximized = setMaximized ? maximized : localMaximized'),
  `${CHAT}: isMaximized no longer prefers the controlled prop over local state`)
check(!/const \[open, setOpen\] = useState\(false\)/.test(chat),
  `${CHAT}: open is still declared as bare local state -- this is exactly what reset on every remount through the My Coach step boundary`)

// The maximize toggle: reversible, hidden on mobile (already a near-full-screen
// bottom sheet by design), and sized so the nav rail can never be covered.
check(chat.includes("onClick={() => setIsMaximized(!isMaximized)}"),
  `${CHAT}: the maximize toggle is missing or is not a simple reversible flip`)
check(chat.includes('{!isMobile && (') && chat.includes("{isMaximized ? 'Restore' : 'Expand'}"),
  `${CHAT}: the Expand/Restore toggle is not gated to desktop or does not label both directions`)
check(chat.includes("width: isMaximized ? 'min(70vw, 1040px)' : 'min(44vw, 620px)'"),
  `${CHAT}: the maximized width is missing or no longer distinct from the default`)
check(chat.includes("maxWidth: isMaximized ? 'calc(100vw - 300px)' : 'calc(100vw - 24px)'"),
  `${CHAT}: the maximized maxWidth no longer reserves 300px -- that reserve is what guarantees the 260px nav rail (src/App.jsx Sidebar, railBase width:260) stays visible even at the largest size, the property that keeps this a panel over the workspace rather than a takeover`)

const APP = 'src/App.jsx'
const app = fs.readFileSync(APP, 'utf8')

check(app.includes('const[coachOpen,setCoachOpen]=useState(false)') && app.includes('const[coachMaximized,setCoachMaximized]=useState(false)'),
  `${APP}: coachOpen/coachMaximized are not lifted to App.jsx state`)
check(app.includes("useEffect(()=>{if(step==='myCoach')setCoachOpen(true)},[step])"),
  `${APP}: arriving at the dedicated My Coach step does not mark the coach open -- without this, someone who reached My Coach without ever opening the floating bubble would still lose the coach in reverse on the way out`)
check(app.includes('open={coachOpen} setOpen={setCoachOpen} maximized={coachMaximized} setMaximized={setCoachMaximized}'),
  `${APP}: the floating <Chat> mount does not receive the lifted open/maximized state and setters`)

// The embedded mount (inside case'myCoach') must NOT also receive these --
// it never reads `open` meaningfully (there is an early `if (embedded)`
// return before the open/bubble branch), and passing them there would be
// dead weight suggesting the two mounts share more than they do.
const embeddedMountIdx = app.indexOf('<Chat embedded currentStep={step}')
check(embeddedMountIdx !== -1, `${APP}: the embedded <Chat> mount is missing`)
const embeddedMountLine = embeddedMountIdx !== -1 ? app.slice(embeddedMountIdx, app.indexOf('\n', embeddedMountIdx)) : ''
check(!embeddedMountLine.includes('setCoachOpen'),
  `${APP}: the embedded <Chat> mount now passes coach open/maximized state it has no use for -- these belong only on the floating mount`)

if (failures) {
  console.error(`test-coach-persistent-panel: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-coach-persistent-panel: OK (open/maximized lifted to App.jsx and survive the My Coach unmount boundary, arriving at My Coach marks the coach open, maximize is a reversible desktop-only size toggle that reserves room for the nav rail, embedded mount untouched)')
}
