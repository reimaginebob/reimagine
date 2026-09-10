// Guards the "partnership, not self-interest" voice principle (2026-09-04)
// end to end: the in-prompt instruction in api/coach.js, and the wiring that
// lets Chat.jsx detect a hard violation in Coach's completed reply and
// report it up to App.jsx's telemetry pipe. api/coach.js's own Anthropic
// call is buffered, not streamed, and (as of 2026-09-05, see
// test-coach-voice-gate-retry.mjs) already gets a silent pre-display
// regenerate-on-violation retry against the full HARD_PATTERNS set before
// the reply ever reaches the client. This check here is the client-side
// backstop for whatever still slips through that retry -- detection +
// logging, not correction. Source-level for the same reason its siblings
// are: this needs a real signed-in browser session to exercise end to end.
import fs from 'node:fs'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

const COACH = 'api/coach.js'
const coach = fs.readFileSync(COACH, 'utf8')
check(/Speak as a partner, not a separate party with your own wants/.test(coach),
  `${COACH}: the partnership posture-rule bullet is missing from SYSTEM_PROMPT_STABLE`)
// "You are read-only" was retired by the live-side brief PR 2 posture-rule
// fix (2026-09-10, carry-over #1) -- Coach can now start a build/rework/
// capture via a real tap, so it is no longer categorically read-only.
// Anchored on the same bullet's new opening line instead.
check(coach.indexOf('Speak as a partner, not a separate party with your own wants') > coach.indexOf('You can offer to build, rework, or capture things for them'),
  `${COACH}: the partnership posture-rule bullet should sit alongside the other posture rules (after the build/rework/capture posture bullet)`)

const CHAT = 'src/components/Chat.jsx'
const chat = fs.readFileSync(CHAT, 'utf8')
check(/import\s*\{\s*detectVoiceViolations\s*\}\s*from\s*'\.\.\/voice-patterns\.js'/.test(chat),
  `${CHAT}: detectVoiceViolations is not imported from ../voice-patterns.js`)
check(/onVoiceViolation\s*=\s*null/.test(chat),
  `${CHAT}: onVoiceViolation prop (default null) is missing from Chat's destructured props`)
check(/detectVoiceViolations\(fullText,\s*\{\s*scope:\s*'runtime'\s*\}\)/.test(chat),
  `${CHAT}: send() no longer runs detectVoiceViolations against the completed streamed reply`)
check(/if\s*\(voiceViolations\.length\s*&&\s*onVoiceViolation\)\s*onVoiceViolation\(voiceViolations\)/.test(chat),
  `${CHAT}: send() no longer reports hard violations to onVoiceViolation`)
// The check must run on the completed reply (after the streaming while loop
// closes), not mid-stream on a partial fragment.
const streamLoopIdx = chat.indexOf('while (true) {')
const detectIdx = chat.indexOf('detectVoiceViolations(fullText')
check(streamLoopIdx >= 0 && detectIdx > streamLoopIdx,
  `${CHAT}: the voice-violation check must run after the streaming loop completes, not during it`)

const APP = 'src/App.jsx'
const app = fs.readFileSync(APP, 'utf8')
check(/const handleCoachVoiceViolation=\(violations\)=>\{/.test(app),
  `${APP}: handleCoachVoiceViolation is not defined`)
check(/logVoiceEvent\(\{step:'coach-chat',attempt:1,recovered:false,violations\}\)/.test(app),
  `${APP}: handleCoachVoiceViolation does not route into the existing logVoiceEvent telemetry pipe`)
// Three mounts as of 2026-09-07: the myCoach embedded panel, the floating
// bubble, and the concierge orientation-flow embedded panel.
const chatMountHits = (app.match(/onVoiceViolation=\{handleCoachVoiceViolation\}/g) || []).length
check(chatMountHits === 3,
  `${APP}: expected onVoiceViolation={handleCoachVoiceViolation} at all three <Chat> mount sites (embedded My Coach panel, floating bubble, concierge orientation panel), found ${chatMountHits}`)

if (failures) {
  console.error(`test-coach-voice-gate-wiring: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-coach-voice-gate-wiring: OK (partnership posture rule in api/coach.js; Chat.jsx detects hard violations post-stream and reports them; App.jsx logs via handleCoachVoiceViolation at both mount sites)')
}
