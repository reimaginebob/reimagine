// Guards finding #4.7 from the 2026-09-07 My Coach diagnostic review: two
// openers could fire on the same My Coach arrival. openCoachWith(seed, true)
// mounts the embedded Chat, and the seed effect and the session-open effect
// both called send() in the same commit with loading===false in both
// closures (a same-commit stale-state race -- state updates from the first
// call's setLoading(true) are not visible to the second call's closure until
// the next render), producing two concurrent requests that both eventually
// tried to overwrite the same last message. The employment prompt separately
// did not check reimagine_session_recap_fired, so it could also fire
// alongside the session opener.
//
// Source-level for both halves: exercising the actual race needs a live
// browser session with two effects genuinely committing together.
import fs from 'node:fs'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

const CHAT = 'src/components/Chat.jsx'
const chat = fs.readFileSync(CHAT, 'utf8')

// sendLockRef is a ref (synchronous), not state -- the whole point is that it
// is visible to a second same-commit caller immediately, unlike `loading`.
check(chat.includes('const sendLockRef = useRef(false)'),
  `${CHAT}: sendLockRef is missing -- send() has no synchronous guard against two same-commit callers`)

// The guard must block a second concurrent call in both the silent-turn and
// normal-turn branches, and must be set before any async work starts (i.e.
// before the request that would let a second call race in underneath it).
const guardIdx = chat.indexOf('if (isSilentTurn) { if (loading || sendLockRef.current) return }')
check(guardIdx !== -1,
  `${CHAT}: send()'s silent-turn guard no longer checks sendLockRef.current -- a second same-commit silent send could still slip through`)
check(chat.includes('else if (!text || loading || sendLockRef.current) return'),
  `${CHAT}: send()'s normal-turn guard no longer checks sendLockRef.current`)
const lockSetIdx = chat.indexOf('sendLockRef.current = true')
check(lockSetIdx !== -1 && guardIdx !== -1 && lockSetIdx > guardIdx && lockSetIdx - guardIdx < 200,
  `${CHAT}: sendLockRef.current is not set to true immediately after the guard -- a gap there would leave the same race open`)

// The lock must release in send()'s finally block, alongside the existing
// abortRef/loading cleanup, so it can't get stuck true after an error or an
// early return further down.
const finallyIdx = chat.indexOf('} finally {\n      abortRef.current = null\n      setLoading(false)\n      sendLockRef.current = false')
check(finallyIdx !== -1,
  `${CHAT}: send()'s finally block no longer resets sendLockRef.current -- a failed or aborted send would leave the lock stuck true, permanently blocking every future send`)

// The employment prompt must yield to whichever of the session-open recap or
// pipeline check-in claimed the welcome-back slot first this session -- the
// same standing convention those two already use against each other.
const APP = 'src/App.jsx'
const app = fs.readFileSync(APP, 'utf8')

const promptIdx = app.indexOf("if(employmentStatus||seenEmploymentPrompt||employmentPromptFiredRef.current)return")
check(promptIdx !== -1, `${APP}: the employment prompt effect's early-return guard is missing`)
const promptBlock = promptIdx !== -1 ? app.slice(promptIdx, promptIdx + 1400) : ''

check(promptBlock.includes("sessionStorage.getItem('reimagine_session_recap_fired')==='1'"),
  `${APP}: the employment prompt no longer checks reimagine_session_recap_fired -- it could still fire alongside the session-open recap`)
check(promptBlock.includes("sessionStorage.getItem('reimagine_pipeline_checkin_fired')==='1'"),
  `${APP}: the employment prompt no longer checks reimagine_pipeline_checkin_fired -- it could still fire alongside the pipeline check-in opener`)

// The yield must actually gate the fire -- a check that computes the flag but
// never returns on it would be a no-op.
const sessionOpenerVarIdx = promptBlock.indexOf('sessionOpenerFired')
const returnAfterIdx = promptBlock.indexOf('if(sessionOpenerFired)return')
check(sessionOpenerVarIdx !== -1 && returnAfterIdx !== -1 && returnAfterIdx > sessionOpenerVarIdx,
  `${APP}: sessionOpenerFired is computed but never gates an early return -- the employment prompt would fire regardless`)

// The yield must run before the prompt actually fires (setChatMessages /
// employmentPromptMessage), or the guard is dead code sitting after the
// point of no return.
const fireIdx = app.indexOf('setChatMessages(m=>[...m,employmentPromptMessage()])')
check(fireIdx !== -1 && returnAfterIdx !== -1 && promptIdx !== -1 && (promptIdx + returnAfterIdx) < fireIdx,
  `${APP}: the sessionOpenerFired yield check runs after the prompt already fires -- it would never actually prevent the collision`)

// This is a per-session, not permanent, yield: employmentStatus/seenEmploymentPrompt
// are untouched by the early return, so the account is still eligible next session.
check(!/setSeenEmploymentPrompt\(true\)[\s\S]{0,40}sessionOpenerFired/.test(promptBlock),
  `${APP}: seenEmploymentPrompt must not be marked permanently seen on the yield path -- this should defer to next session, not skip the account for good`)

if (failures) {
  console.error(`test-coach-dedupe-openers: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-coach-dedupe-openers: OK (send() gains a synchronous sendLockRef guard against two same-commit callers, released in finally, and the employment prompt yields to whichever opener already claimed the welcome-back slot this session)')
}
