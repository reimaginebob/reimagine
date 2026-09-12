// Coach engine guardrails (2026-09-09, Output/handoff/2026-09-09_coach-
// engine-guardrails-brief.md): guards rules 1 (distress hold, hard), 2
// (discouragement hold, soft), and 4 (Situation placement confirmed +
// sampled token log). Rule 3 (snooze tightening) was dropped from this
// brief -- Bob's call, 2026-09-09: today's one-tap "I'm good for now"
// already quiets every family, which is already the quietest state the
// product can be in, so there is no first-stage partial quiet to build
// without also making the product more willing to interrupt someone who
// already asked to be left alone. Not covered here.
import fs from 'node:fs'
import { matchesDistressTrigger } from '../src/text-strippers.js'
import { parseMood } from '../src/coach-routing.js'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

const STRIPPERS = 'src/text-strippers.js'
const strippers = fs.readFileSync(STRIPPERS, 'utf8')
const ROUTING = 'src/coach-routing.js'
const routing = fs.readFileSync(ROUTING, 'utf8')
const COACH = 'api/coach.js'
const coach = fs.readFileSync(COACH, 'utf8')
const APP = 'src/App.jsx'
const app = fs.readFileSync(APP, 'utf8')
const CHAT = 'src/components/Chat.jsx'
const chat = fs.readFileSync(CHAT, 'utf8')

// --- Rule 1: matchesDistressTrigger, functional ---
check(matchesDistressTrigger('I want to end my life') === true,
  `${STRIPPERS}: matchesDistressTrigger does not match an explicit distress phrase`)
check(matchesDistressTrigger("I'm exhausted, I don't know if this is worth it") === false,
  `${STRIPPERS}: matchesDistressTrigger false-positives on ordinary search fatigue -- it must stay narrow, same as ensureDistressSupport`)
check(matchesDistressTrigger(null) === false && matchesDistressTrigger(undefined) === false,
  `${STRIPPERS}: matchesDistressTrigger does not fail safe on a non-string message`)
// Must be the SAME regex ensureDistressSupport uses -- a second, drifted
// copy would silently desync the hold from the pointer-sentence behavior.
check(strippers.includes('export function matchesDistressTrigger(userMessage) {') &&
  strippers.includes('return typeof userMessage === \'string\' && DISTRESS_TRIGGER_RE.test(userMessage)'),
  `${STRIPPERS}: matchesDistressTrigger is not a thin wrapper over the same DISTRESS_TRIGGER_RE ensureDistressSupport uses`)

// --- Rule 2: parseMood, functional ---
check(parseMood('Here is the coaching reply.\nMOOD: low').mood === 'low',
  `${ROUTING}: parseMood does not detect a bare MOOD: low trailer`)
check(parseMood('Here is the coaching reply.\nMOOD: low').text === 'Here is the coaching reply.',
  `${ROUTING}: parseMood does not strip the MOOD: low line from the visible text`)
check(parseMood('Just a normal coaching reply, no trailer.').mood === null,
  `${ROUTING}: parseMood should not invent a mood when no trailer is present`)
check(parseMood('reply\nMOOD: low | extra junk').mood === 'low',
  `${ROUTING}: parseMood does not tolerate trailing junk after the value, same as SELFCHECK_TOKEN_RE`)
check(parseMood('').mood === null && parseMood(null).text === '',
  `${ROUTING}: parseMood does not fail safe on empty/non-string input`)

// --- Server wiring ---
check(coach.includes("import { applyOutputStrippers, ensureDistressSupport, matchesDistressTrigger, detectResidualVoice } from '../src/text-strippers.js'"),
  `${COACH}: matchesDistressTrigger is not imported`)
check(coach.includes("import { parseSelfcheck, parseMood, parseWidenSearchHint } from '../src/coach-routing.js'"),
  `${COACH}: parseMood is not imported`)
check(coach.includes('const distressDetected = matchesDistressTrigger(message)'),
  `${COACH}: distressDetected is not computed from the user's own message`)
check(coach.includes("if (distressDetected) res.setHeader('X-Coach-Distress', '1')"),
  `${COACH}: the X-Coach-Distress response header is missing or has drifted`)
check(coach.includes('const { mood, text: moodStripped } = parseMood(selfcheckStripped)'),
  `${COACH}: MOOD: low is not parsed out of the reply right after SELFCHECK`)
check(coach.includes("if (mood === 'low') res.setHeader('X-Coach-Mood', 'low')"),
  `${COACH}: the X-Coach-Mood response header is missing or has drifted`)
check(coach.includes('mood })') && coach.includes("console.log('coach insert ok'"),
  `${COACH}: mood is not included in the coach insert ok log line`)
// The DISCOURAGEMENT trailer instruction: model-facing, conditional (never
// MOOD: none), placed right after the SELFCHECK instruction it mirrors.
check(coach.includes('If this reply used the DISCOURAGEMENT response above, add one more line, in the same bare plain form, after the SELFCHECK line: MOOD: low.'),
  `${COACH}: the MOOD: low trailer instruction is missing or has drifted from SYSTEM_PROMPT_HEAD`)
check(coach.includes('omit the line entirely otherwise, do not write MOOD: none'),
  `${COACH}: the trailer instruction no longer forbids an unconditional MOOD: none line`)

// --- Rule 4: Situation token logging ---
check(coach.includes('let situationBlockChars = 0'),
  `${COACH}: situationBlockChars is not tracked`)
check(coach.includes("if (expansion) { profileBlock += '\\n\\n' + expansion; situationBlockChars += expansion.length }"),
  `${COACH}: situationBlockChars does not accumulate the in-focus expansion's length`)
check(coach.includes('situationBlockChars += contextNote.length'),
  `${COACH}: situationBlockChars does not accumulate contextNote's length`)
check(/if \(Math\.random\(\) < 0\.05\) \{\s*console\.log\('coach situation-block size', \{ chars: situationBlockChars, estTokens: Math\.ceil\(situationBlockChars \/ 4\) \}\)/.test(coach),
  `${COACH}: the sampled (1-in-20) Situation-block size log is missing or has drifted`)

// --- Client: session-scoped hold state ---
check(app.includes('const[coachDistressHold,setCoachDistressHold]=useState(false)'),
  `${APP}: coachDistressHold state is missing`)
check(app.includes('const[coachMoodHold,setCoachMoodHold]=useState(false)'),
  `${APP}: coachMoodHold state is missing`)
check(app.includes('const handleCoachDistressDetected=()=>{setCoachDistressHold(true)}'),
  `${APP}: handleCoachDistressDetected does not set the hold`)
check(app.includes('const handleCoachMoodLow=()=>{setCoachMoodHold(true)}'),
  `${APP}: handleCoachMoodLow does not set the hold`)
check(app.includes('const handleCoachSessionOpen=()=>{setCoachDistressHold(false);setCoachMoodHold(false)}'),
  `${APP}: handleCoachSessionOpen does not clear both holds`)

// --- Client: the evaluator actually checks both holds ---
check(app.includes('if(coachDistressHold)return'),
  `${APP}: the evaluator does not check coachDistressHold`)
// Ordering: the distress check must come before the candidate list is even
// built, per the brief ("checks this flag before it builds the candidate
// list ... regardless of presence state") -- a hard hold should not depend
// on reaching any later line first. The quiet-state check this used to be
// measured against is retired (batch item 1.1.4, 2026-09-10); the loop that
// builds candidates is the next stable anchor.
const distressIdx = app.indexOf('if(coachDistressHold)return')
const loopIdx = app.indexOf('for(const entry of MOMENT_CATALOG){', distressIdx)
check(distressIdx !== -1 && loopIdx !== -1 && distressIdx < loopIdx,
  `${APP}: the distress hold check is not positioned before the evaluator builds its candidate list`)
check(app.includes("if(coachMoodHold&&entry.family!=='delivery'&&entry.family!=='choice')continue"),
  `${APP}: the evaluator does not hold every family except delivery/choice while coachMoodHold is set`)
// momentReevalTick appended 2026-09-10 (live-side brief PR 1, item 1).
// savedPlaybooks/activePlaybooks/pursuitStatus/connNetwork/connManual/
// connSearch appended by live-side brief PR 2, same day.
check(app.includes(',coachDistressHold,coachMoodHold,momentReevalTick,savedPlaybooks,activePlaybooks,pursuitStatus,pursuitStatusLoaded,connNetwork,connManual,connSearch,activeSectionTick,hydrationStable])'),
  `${APP}: the evaluator effect's dependency array does not include both new holds`)

// --- Client: all 3 Chat mount sites wired ---
const mountCount = (app.match(/onDistressDetected=\{handleCoachDistressDetected\} onMoodLow=\{handleCoachMoodLow\} onSessionOpen=\{handleCoachSessionOpen\}/g) || []).length
check(mountCount === 3, `${APP}: expected all 3 Chat mount sites wired with onDistressDetected/onMoodLow/onSessionOpen, found ${mountCount}`)

// --- Chat.jsx: reads the headers, calls the callbacks, fires onSessionOpen ---
check(chat.includes('onDistressDetected = null, onMoodLow = null, onSessionOpen = null }) {'),
  `${CHAT}: the three new props are missing from Chat's signature`)
check(chat.includes("const distressHeader = res.headers.get('X-Coach-Distress') || null"),
  `${CHAT}: distressHeader is not read from the response`)
check(chat.includes("const moodHeader = res.headers.get('X-Coach-Mood') || null"),
  `${CHAT}: moodHeader is not read from the response`)
check(chat.includes("if (distressHeader === '1' && onDistressDetected) onDistressDetected()"),
  `${CHAT}: the distress callback is not dispatched from the header`)
check(chat.includes("if (moodHeader === 'low' && onMoodLow) onMoodLow()"),
  `${CHAT}: the mood callback is not dispatched from the header`)
check(chat.includes('if (onSessionOpen) onSessionOpen()'),
  `${CHAT}: onSessionOpen is not fired on the actual session-open turn`)
// Must fire ONLY on a genuine new session (guarded by the existing
// sessionStorage check), not on every mount -- otherwise a hold would clear
// mid-session on a re-render.
const sessionOpenIdx = chat.indexOf('if (onSessionOpen) onSessionOpen()')
const alreadyGuardIdx = chat.indexOf('if (already) return', sessionOpenIdx - 450)
check(sessionOpenIdx !== -1 && alreadyGuardIdx !== -1 && alreadyGuardIdx < sessionOpenIdx,
  `${CHAT}: onSessionOpen is not gated behind the existing once-per-session guard`)

if (failures) {
  console.error(`test-coach-engine-guardrails: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-coach-engine-guardrails: OK (distress hold checked before the candidate list is built and blocks every family; mood hold blocks every family except delivery/choice; both clear only on a genuine new session; MOOD: low trailer parsed and stripped like SELFCHECK; Situation-block size sampled and logged 1-in-20)')
}
