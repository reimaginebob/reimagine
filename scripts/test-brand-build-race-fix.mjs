// Guards two fixes from a code-sweep + live-QA session (2026-09-07):
//
// 1. Coach's opening framing message told every new signup "Let's start
//    with your resume," but the real first step (both tracks) is Your
//    Current Situation (or, for the independent track, the purely
//    informational orientation-intro screen, whose own button already
//    correctly reads "Start with where you are"). @career.club accounts
//    auto-get this message, so Bob would hit the contradiction on every
//    fresh-signup test. Fixed to match the real flow, and the field list
//    in the same message -- which omitted Current Situation and LinkedIn
//    entirely -- was completed at the same time.
//
// 2. "Build My Personal Brand" and "Build with what I have" called
//    generateChain() in the SAME click as advance('orientation-done','p3'),
//    racing advance()'s own deferral: when Life Story's background
//    quality-check reaction (coachThinkingCount) was still in flight, the
//    step change was HELD (pendingAdvance) but the multi-minute generation
//    started anyway, running while the screen still showed the static
//    "Orientation complete" page with no spinner, nothing disabled, no
//    sign anything was happening -- case'orientation-done' never reads
//    loading/generatingSection, only case'p3' does. Worse, a genuine
//    generation failure during that window got silently wiped by
//    doAdvance's own setErr(null) the instant the deferred navigation
//    finally landed, before the person ever saw case'p3''s ErrBox. Fixed
//    by decoupling the click from the generation start: both buttons now
//    only set pendingBrandGenerate and call advance(); a new effect fires
//    generateChain() once step has actually become 'p3', whatever it took
//    to get there.
import fs from 'node:fs'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

const APP = 'src/App.jsx'
const app = fs.readFileSync(APP, 'utf8')

// Fix 1: the framing message.
check(!app.includes("Let's start with your resume."),
  `${APP}: the old, wrong "let's start with your resume" line is still present -- the real first step is Your Current Situation, not Resume`)
check(app.includes("Let's start with where you are right now."),
  `${APP}: the framing message's closing line was not corrected to match the real first step`)
check(app.includes('where things stand for you right now, your resume, your LinkedIn, an assessment if you have one'),
  `${APP}: the framing message's field list still omits Your Current Situation and LinkedIn`)

// Fix 2: pendingBrandGenerate state, decoupled from the click.
check(app.includes('const[pendingBrandGenerate,setPendingBrandGenerate]=useState(false)'),
  `${APP}: pendingBrandGenerate state is missing`)

// Both buttons must set the flag and call advance(), and must NOT call
// generateChain() directly in the click handler any more -- that direct
// call is exactly what raced the deferral.
const mainButtonIdx = app.indexOf("advance('orientation-done','p3');setPendingBrandGenerate(true)}}}>Build My Personal Brand")
check(mainButtonIdx !== -1,
  `${APP}: the main "Build My Personal Brand" button no longer sets pendingBrandGenerate instead of calling generateChain() directly`)
const bareButtonIdx = app.indexOf("setBareInputModal(false);advance('orientation-done','p3');setPendingBrandGenerate(true)}}>Build with what I have")
check(bareButtonIdx !== -1,
  `${APP}: the bare-input modal's "Build with what I have" button no longer sets pendingBrandGenerate instead of calling generateChain() directly`)
check(!/advance\('orientation-done','p3'\);generateChain\(\)/.test(app),
  `${APP}: a button still calls generateChain() in the same click as advance() -- this is the exact race the fix removes`)

// The release effect: fires generateChain() once step actually becomes
// 'p3' AND the flag is set, whether that took one render or several.
const releaseIdx = app.indexOf("if(step!=='p3'||!pendingBrandGenerate)return")
check(releaseIdx !== -1, `${APP}: the pendingBrandGenerate release effect is missing`)
const releaseBlock = releaseIdx !== -1 ? app.slice(releaseIdx, releaseIdx + 200) : ''
check(releaseBlock.includes('setPendingBrandGenerate(false)') && releaseBlock.includes('generateChain()'),
  `${APP}: the release effect no longer clears pendingBrandGenerate and calls generateChain() once step is 'p3'`)
check(app.includes("},[step,pendingBrandGenerate])"),
  `${APP}: the release effect is not keyed on [step,pendingBrandGenerate] -- it would not fire when step actually changes`)

if (failures) {
  console.error(`test-brand-build-race-fix: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-brand-build-race-fix: OK (framing message names the real first step and lists every orientation field, Build buttons no longer race advance()\'s deferral -- generation now starts only once step has actually become p3)')
}
