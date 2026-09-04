// Guards the "partnership, not self-interest" voice principle (2026-09-04)
// end to end: the in-prompt instruction in api/coach.js, and the wiring that
// lets Chat.jsx detect a hard violation in Coach's own streamed reply and
// report it up to App.jsx's telemetry pipe. Coach's live chat replies stream
// token-by-token straight into the visible UI, so unlike generated sections
// (callClaudeWithVoiceGate) there is no silent pre-display retry here --
// this is detection + logging, not correction. Source-level for the same
// reason its siblings are: this needs a real signed-in browser session to
// exercise end to end.
import fs from 'node:fs'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

const COACH = 'api/coach.js'
const coach = fs.readFileSync(COACH, 'utf8')
check(/Speak as a partner, not a separate party with your own wants/.test(coach),
  `${COACH}: the partnership posture-rule bullet is missing from SYSTEM_PROMPT_STABLE`)
check(coach.indexOf('Speak as a partner, not a separate party with your own wants') > coach.indexOf('You are read-only'),
  `${COACH}: the partnership posture-rule bullet should sit alongside the other posture rules (after "You are read-only")`)

const CHAT = 'src/components/Chat.jsx'
const chat = fs.readFileSync(CHAT, 'utf8')
check(/import\s*\{\s*detectVoiceViolations\s*\}\s*from\s*'\.\.\/voice-patterns\.mjs'/.test(chat),
  `${CHAT}: detectVoiceViolations is not imported from ../voice-patterns.mjs`)
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
const chatMountHits = (app.match(/onVoiceViolation=\{handleCoachVoiceViolation\}/g) || []).length
check(chatMountHits === 2,
  `${APP}: expected onVoiceViolation={handleCoachVoiceViolation} at both <Chat> mount sites (embedded My Coach panel + floating bubble), found ${chatMountHits}`)

if (failures) {
  console.error(`test-coach-voice-gate-wiring: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-coach-voice-gate-wiring: OK (partnership posture rule in api/coach.js; Chat.jsx detects hard violations post-stream and reports them; App.jsx logs via handleCoachVoiceViolation at both mount sites)')
}
