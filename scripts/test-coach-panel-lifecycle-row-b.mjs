// Batch item, Phase 4 §2.3 Row B (Output/handoff/2026-09-09_concierge-batch-
// and-phase4-brief.md, Part 2): "I'm right up here..." fires once, ever,
// the first time the person minimizes Coach. Unlike every MOMENT_CATALOG
// entry before it, this one has no "screen" to belong to -- it's a panel-
// lifecycle event, not a screen arrival -- so it never goes through the
// screen-scoped evaluator loop at all (screen: null never matches a real
// step). Source-level coverage here; scripts/test-coach-panel-lifecycle-
// row-b-browser.mjs covers the real minimize transition live.
import fs from 'node:fs'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

const MOMENTS = 'src/coach-moments.js'
const moments = fs.readFileSync(MOMENTS, 'utf8')

const idx = moments.indexOf("key: 'coach-minimize-intro'")
check(idx !== -1, `${MOMENTS}: the 'coach-minimize-intro' catalog entry (Row B) is missing`)
const block = idx !== -1 ? moments.slice(idx, idx + 1200) : ''

check(block.includes('screen: null'),
  `${MOMENTS}: coach-minimize-intro must not carry a real screen -- it would (wrongly) become reachable through the screen-scoped evaluator loop`)
check(block.includes("significance: 'ordinary'"),
  `${MOMENTS}: coach-minimize-intro is not 'ordinary' -- it must never force the panel back open, which would contradict the minimize the person just did`)
check(block.includes('dismissible: false'),
  `${MOMENTS}: coach-minimize-intro should not be dismissible -- a decline option on "where Coach went" makes no sense`)
check(block.includes("!!ctx.hasOnboardingConcierge"),
  `${MOMENTS}: coach-minimize-intro lost its hasOnboardingConcierge gate`)
check(block.includes('I\\\'m right up here. Click me anytime and we pick up where we left off.'),
  `${MOMENTS}: coach-minimize-intro's copy has drifted from the brief's approved Row B text`)

const APP = 'src/App.jsx'
const app = fs.readFileSync(APP, 'utf8')

// The shared static-fire helper Row B (and the main evaluator's own static
// branch) both call.
check(app.includes('const fireStaticEntryMessage=(entry,ctx)=>{'),
  `${APP}: fireStaticEntryMessage is missing`)
check(app.includes('const fireStaticEntry=(entry,ctx,subKey,dedupeValue)=>{'),
  `${APP}: fireStaticEntry (dedupe-write + fire, for callers outside the main evaluator loop) is missing`)
const fireStaticEntryIdx = app.indexOf('const fireStaticEntry=(entry,ctx,subKey,dedupeValue)=>{')
const fireStaticEntryBlock = fireStaticEntryIdx !== -1 ? app.slice(fireStaticEntryIdx, fireStaticEntryIdx + 300) : ''
check(fireStaticEntryBlock.includes('momentFiredRef.current.add(`${entry.key}:${subKey}`)') && fireStaticEntryBlock.includes('fireStaticEntryMessage(entry,ctx)'),
  `${APP}: fireStaticEntry no longer writes the dedupe record before firing`)

// fireCoachMinimizeIntroOnce: the eligibility + dedupe + fire wrapper both
// transition-watchers call.
const onceIdx = app.indexOf('const fireCoachMinimizeIntroOnce=()=>{')
check(onceIdx !== -1, `${APP}: fireCoachMinimizeIntroOnce is missing`)
const onceBlock = onceIdx !== -1 ? app.slice(onceIdx, onceIdx + 700) : ''
check(onceBlock.includes('isDemo||isTest||!signedInUser||!hasOnboardingConcierge'),
  `${APP}: fireCoachMinimizeIntroOnce lost one of its guard conditions`)
check(onceBlock.includes("e.key==='coach-minimize-intro'"),
  `${APP}: fireCoachMinimizeIntroOnce no longer looks up the coach-minimize-intro entry`)
check(onceBlock.includes('momentFiredRef.current.has'),
  `${APP}: fireCoachMinimizeIntroOnce lost its same-render double-fire guard`)
check(onceBlock.includes('stored&&stored.value===dedupeValue'),
  `${APP}: fireCoachMinimizeIntroOnce lost its durable coachMoments dedupe check`)

// Two independent transition-watchers -- embedded panel (coachPresence)
// and floating bubble (coachOpen) -- rather than one effect switching on
// conciergeEmbedded, which can itself flip between renders for the same
// account (it's a function of `step`).
check(app.includes("const prevCoachPresenceForMinimizeRef=useRef(coachPresence)"),
  `${APP}: the embedded-panel minimize-transition watcher (coachPresence) is missing`)
check(app.includes("if(was==='open'&&coachPresence==='minimized')fireCoachMinimizeIntroOnce()"),
  `${APP}: the embedded-panel watcher no longer fires on the open->minimized edge specifically`)
check(app.includes("const prevCoachOpenForMinimizeRef=useRef(coachOpen)"),
  `${APP}: the floating-bubble minimize-transition watcher (coachOpen) is missing`)
check(app.includes("if(was===true&&coachOpen===false)fireCoachMinimizeIntroOnce()"),
  `${APP}: the floating-bubble watcher no longer fires on the true->false edge specifically`)

if (failures) {
  console.error(`test-coach-panel-lifecycle-row-b: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-coach-panel-lifecycle-row-b: OK (coach-minimize-intro is a screen-null, ordinary, non-dismissible catalog entry with the approved copy; fireStaticEntryMessage/fireStaticEntry are the shared static-fire helpers; fireCoachMinimizeIntroOnce carries the full eligibility/dedupe guard; two independent transition-watchers cover the embedded panel and the floating bubble, sharing one dedupe record)')
}
