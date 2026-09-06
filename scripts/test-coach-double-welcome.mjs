// Guards a live-caught bug (2026-09-06): the proactive pipeline check-in
// opener (App.jsx, pipelineCheckinOpener, ships to everyone) and the
// session-open recap (Chat.jsx, next_step pilot only) could both fire on
// the same visit. pipelineCheckinOpener force-opens the Coach bubble via
// openRequest on arrival at My Pipeline; Chat.jsx's own session-open effect
// treats ANY `open` transition to true as a real open, including that
// forced one, and fired its own "welcome back" recap right behind it --
// which already reports pipeline status itself, so the two messages landed
// back to back and the second one answered the question the first one had
// just asked ("has anything moved?" / "nothing's shifted"), reading as
// Coach greeting the person twice and contradicting itself in the same
// breath.
//
// Fixed with the same "whichever opener claims the welcome-back slot
// first, the other stands down" pattern already used for the Personal
// Brand delivery / check-in pair (test-onboarding-brand-delivery.mjs):
// each opener also checks the other's sessionStorage flag before firing.
// Source-level, like its sibling Coach tests: this needs a real signed-in
// session and a real next_step-pilot account to exercise end to end.
import fs from 'node:fs'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

const APP = 'src/App.jsx'
const app = fs.readFileSync(APP, 'utf8')
const pipelineEffectIdx = app.indexOf("if(step!=='pipeline'||!signedInUser)return")
check(pipelineEffectIdx !== -1, `${APP}: the pipeline check-in trigger effect is missing`)
const pipelineEffectBlock = pipelineEffectIdx !== -1 ? app.slice(pipelineEffectIdx, pipelineEffectIdx + 600) : ''
check(pipelineEffectBlock.includes("sessionStorage.getItem('reimagine_session_recap_fired')==='1'"),
  `${APP}: the pipeline check-in opener does not check reimagine_session_recap_fired before firing -- it can still stack behind a session-open recap that already fired on an earlier screen this session`)

const CHAT = 'src/components/Chat.jsx'
const chat = fs.readFileSync(CHAT, 'utf8')
const sessionOpenIdx = chat.indexOf("if (!sessionOpenEligible) return")
check(sessionOpenIdx !== -1, `${CHAT}: the session-open recap trigger effect is missing`)
const sessionOpenBlock = sessionOpenIdx !== -1 ? chat.slice(sessionOpenIdx, sessionOpenIdx + 400) : ''
check(sessionOpenBlock.includes("sessionStorage.getItem('reimagine_pipeline_checkin_fired') === '1'"),
  `${CHAT}: the session-open recap does not check reimagine_pipeline_checkin_fired before firing -- it can still fire right behind the pipeline check-in opener's own forced panel-open and repeat/contradict what it just said`)

if (failures) {
  console.error(`test-coach-double-welcome: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-coach-double-welcome: OK (pipeline check-in opener and session-open recap each stand down for the other, whichever claims the welcome-back slot first)')
}
