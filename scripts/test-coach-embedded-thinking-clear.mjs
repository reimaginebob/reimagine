// Guards two gaps found in an adversarial code sweep (2026-09-07) of the
// concierge embedded panel (PR #776), run while Bob was live-testing the same
// build: neither was visible until the embedded panel became the sole Coach
// surface for the whole orientation flow.
//
// 1. The "Coach is thinking" indicator (built 2026-09-04 specifically so a
//    silent background reaction -- src/App.jsx's orientationCheck POSTs --
//    never arrives with zero warning it was coming) only ever rendered in
//    the floating, closed-bubble branch. The embedded branch returns before
//    that code is reached, so it went dark for exactly the surface that
//    generates the most of those reactions.
// 2. "Clear conversation" was confined to the dedicated My Coach page before
//    the embedded panel expanded to cover all of orientation. Exposed on
//    every orientation screen with no confirmation, one stray tap silently
//    wipes the whole conversation -- every narration line, every reaction --
//    with no undo.
import fs from 'node:fs'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

const CHAT = 'src/components/Chat.jsx'
const chat = fs.readFileSync(CHAT, 'utf8')

const embeddedIdx = chat.indexOf('if (embedded) {')
check(embeddedIdx !== -1, `${CHAT}: the embedded branch is missing`)
// 3600, not 3300: the composer-visible structural fix (2026-09-09) replaced
// the panel's JS-measured maxHeight with a flex:'1 1 auto' sizing comment
// explaining the CSS containment strategy it replaced -- legitimate new
// content ahead of Clear in the window this check already reads, not creep
// to paper over.
const embeddedBlock = embeddedIdx !== -1 ? chat.slice(embeddedIdx, embeddedIdx + 3600) : ''

// Thinking indicator: its own keyframe injection (the closed-bubble branch's
// copy is unreachable from here) and a visible dot + status text gated on
// the `thinking` prop.
check(embeddedBlock.includes('{thinking && <style>{"@keyframes pe-chat-thinking-dot'),
  `${CHAT}: the embedded branch does not inject its own copy of the thinking-dot keyframe -- the closed-bubble branch's copy is unreachable when embedded`)
check(embeddedBlock.includes('role="status"') && embeddedBlock.includes('Coach is thinking'),
  `${CHAT}: the embedded panel has no visible/announced indicator while thinking is true`)
check(embeddedBlock.includes("animation: 'pe-chat-thinking-dot 1.1s ease-in-out infinite'"),
  `${CHAT}: the embedded thinking indicator lost its pulse animation`)

// Clear conversation: still reachable, but now behind a confirm, matching
// the app's own established pattern for an irreversible action (Start
// Fresh's window.confirm in src/App.jsx).
check(embeddedBlock.includes("aria-label=\"Clear conversation\""),
  `${CHAT}: the Clear conversation button is missing from the embedded panel`)
check(/onClick=\{\(\) => \{ if \(window\.confirm\('This clears your entire conversation with Coach/.test(embeddedBlock),
  `${CHAT}: Clear no longer confirms before wiping -- one stray tap during orientation would silently erase the whole conversation with no undo`)
check(embeddedBlock.includes('This cannot be undone.') ,
  `${CHAT}: the Clear confirmation does not say the action is irreversible`)
check(embeddedBlock.includes('setMessages([INTRO_MSG])'),
  `${CHAT}: Clear no longer actually resets messages to the seed intro`)

if (failures) {
  console.error(`test-coach-embedded-thinking-clear: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-coach-embedded-thinking-clear: OK (embedded panel now shows its own thinking indicator with an announced status, Clear conversation confirms before wiping, matching the app\'s established irreversible-action pattern)')
}
