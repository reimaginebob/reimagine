// Fix 1 from Bob's production test on 268a812: the SITUATION block named the
// wrong Focus Playbook section -- twice on the same session, the section
// Coach reported never matched the one actually clicked/in view. Two root
// causes, both in src/App.jsx:
//
// 1. visibleSectionRef (set by the IntersectionObserver that tracks scroll
//    position) was never cleared on leaving the Focus/Opportunity Playbook,
//    so a value from a PREVIOUS visit could survive navigating away (e.g.
//    Personal Brand -> My Pipeline) and back, and get reported as if it
//    were current.
// 2. Clicking a section (scrollToOutput) only ever nudged the browser to
//    scroll there -- it never set visibleSectionRef itself, so the actual
//    "which section" value depended entirely on the IntersectionObserver's
//    async callback catching up with the smooth-scroll animation. Typing
//    "Where am I?" in that window could catch the observer still reporting
//    whatever section it was passing over mid-scroll.
//
// Fix: scrollToOutput sets visibleSectionRef synchronously and immediately
// (a click is authoritative the instant it happens); the observer's own
// effect clears the ref to null on leaving 'focus'/'op' instead of leaving
// a stale value behind. The observer continues to update the ref normally
// for free scrolling once a visit is under way -- it is the fallback for
// scrolling, not the only source of truth.
import fs from 'node:fs'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

const APP = 'src/App.jsx'
const app = fs.readFileSync(APP, 'utf8')

check(app.includes('const scrollToOutput=(key)=>{visibleSectionRef.current=key;requestAnimationFrame(()=>{const el=document.getElementById(`section-${key}`);if(el&&el.scrollIntoView)el.scrollIntoView({block:\'start\',behavior:\'smooth\'})})}'),
  `${APP}: scrollToOutput no longer sets visibleSectionRef synchronously on every click-driven jump`)

const effectIdx = app.indexOf('const visibleSectionRef=useRef(null)')
check(effectIdx !== -1, `${APP}: visibleSectionRef is missing`)
const effectBlock = effectIdx !== -1 ? app.slice(effectIdx, effectIdx + 900) : ''
check(effectBlock.includes("if(step!=='focus'&&step!=='op'){visibleSectionRef.current=null;return}"),
  `${APP}: the observer effect no longer clears visibleSectionRef on leaving the Focus/Opportunity Playbook -- a stale value from a previous visit could survive navigating away and back`)
check(effectBlock.includes('const observer=new IntersectionObserver(entries=>{'),
  `${APP}: the IntersectionObserver itself is missing -- it is still needed as the fallback for free scrolling`)
check(effectBlock.includes("if(visible.length)visibleSectionRef.current=visible[0].target.id.replace(/^section-/,'')"),
  `${APP}: the observer no longer updates visibleSectionRef from the most-visible section -- scrolling without a click would stop updating Situation`)

// computeSituation still reads the ref directly -- the fix is entirely in
// keeping the ref accurate, not in how it is consumed.
check(app.includes('section:visibleSectionRef.current||null'),
  `${APP}: computeSituation no longer reads section from visibleSectionRef`)

if (failures) {
  console.error(`test-situation-section-fix: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-situation-section-fix: OK (a click sets visibleSectionRef synchronously and immediately, ahead of the IntersectionObserver\'s async fallback; the ref clears on leaving the Focus/Opportunity Playbook instead of leaking a stale value across navigation)')
}
