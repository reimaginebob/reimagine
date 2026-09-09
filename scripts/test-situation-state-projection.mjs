// Replaces the patch from PR #838 (scripts/test-situation-section-fix.mjs,
// now retired -- its assertions describe the superseded implementation) with
// coverage of the PRINCIPLE behind it, per CLAUDE.md sec. 8's new "Situation
// is a projection of app state, never a measurement of the DOM" rule.
//
// Two more failures on c0b6f0a after #838's own fix: clicking Compensation
// Read (unbuilt, short) reported Interview Prep; clicking Networking Groups
// (unbuilt, short) reported Recruiters. Both times the clicked heading sat
// under the sticky chrome while the NEXT section's heading was fully
// visible, and the old observer -- which watched the <h2> HEADING, not the
// section's container, and picked by raw intersection ratio with no regard
// for what the app had just done -- reported that next section instead.
//
// This file checks the source-level shape of the fix: activeSectionRef as
// the one write-many/read-one source of truth, the click-is-authoritative
// write happening synchronously wherever a section navigation happens (not
// just scrollToOutput -- the three places that were bypassing it, now
// routed through it), the observer demoted to a locked fallback that only
// picks once a genuine user scroll gesture proves the person has moved on,
// its reading-line-over-sticky-chrome pick logic, containers (not headings)
// carrying the id the whole mechanism keys off, and the stall timer
// counting a scroll as activity. The end-to-end browser behavior --
// clicking each of the eleven Focus Playbook sections and confirming the
// request body's situation.section matches -- is scripts/test-browser-
// situation-tracking.mjs, a real headless-browser run against the actual
// DOM and timing, which this source-presence file cannot substitute for.
import fs from 'node:fs'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

const APP = 'src/App.jsx'
const CLAUDE = 'CLAUDE.md'
const app = fs.readFileSync(APP, 'utf8')
const claudeMd = fs.readFileSync(CLAUDE, 'utf8')

// --- CLAUDE.md carries the principle ---
check(claudeMd.includes('Situation is a projection of app state, never a measurement of the DOM'),
  `${CLAUDE}: the state-projection principle is missing from section 8`)

// --- activeSectionRef is the one source of truth; the old ref is fully gone ---
check(app.includes('const activeSectionRef=useRef(null)'), `${APP}: activeSectionRef is missing`)
check(app.includes('const sectionLockRef=useRef(false)'), `${APP}: sectionLockRef is missing`)
check(app.includes('const scrollSettledRef=useRef(true)'), `${APP}: scrollSettledRef is missing`)
check(!app.includes('visibleSectionRef'), `${APP}: the old visibleSectionRef name survives somewhere -- it should be fully renamed/replaced, not left alongside the new mechanism`)
check(app.includes('section:activeSectionRef.current||null'), `${APP}: computeSituation must read the section from activeSectionRef, not a stale prop or a different ref`)

// --- scrollToOutput: click is authoritative, synchronously, and locks the observer out ---
check(app.includes('const scrollToOutput=(key)=>{activeSectionRef.current=key;sectionLockRef.current=true;scrollSettledRef.current=false;requestAnimationFrame'),
  `${APP}: scrollToOutput no longer sets activeSectionRef + locks the observer synchronously on every click-driven jump`)

// --- The three bypasses found by grepping every getElementById('section-...')
// + scrollIntoView call site are routed through activeSectionRef too, each
// gated on the target actually existing (opSectionBuilding can be 'p6' while
// viewing an Opportunity Playbook, where the Bridge Story has no container of
// its own -- nothing to claim there). ---
check(app.includes("useEffect(()=>{const k=opSectionBuilding;if(!k)return;requestAnimationFrame(()=>{const el=document.getElementById(`section-${k}`);if(el&&el.scrollIntoView){activeSectionRef.current=k;sectionLockRef.current=true;scrollSettledRef.current=false;el.scrollIntoView"),
  `${APP}: the opSectionBuilding build-start scroll effect no longer claims activeSectionRef once its target is confirmed to exist`)
check(app.includes("useEffect(()=>{const k=generatingSection;if(!k)return;requestAnimationFrame(()=>{const el=document.getElementById(`section-${k}`);if(el&&el.scrollIntoView){activeSectionRef.current=k;sectionLockRef.current=true;scrollSettledRef.current=false;el.scrollIntoView"),
  `${APP}: the generatingSection build-start scroll effect no longer claims activeSectionRef once its target is confirmed to exist`)
check(app.includes("if(el&&el.scrollIntoView){activeSectionRef.current='companyRead';sectionLockRef.current=true;scrollSettledRef.current=false;el.scrollIntoView"),
  `${APP}: the auto-build companyRead scroll effect no longer claims activeSectionRef once its target is confirmed to exist`)

// --- The observer: locked out until a genuine user gesture releases it, then
// prefers the container spanning the reading line over raw ratio, never a
// bare timer as the release itself ---
check(app.includes('if(sectionLockRef.current)return'), `${APP}: the observer callback no longer checks the lock before picking a section`)
check(app.includes("regions.forEach(el=>{const b=el.getBoundingClientRect().bottom;if(b>h)h=b})"),
  `${APP}: sticky-stack height is no longer measured at runtime from data-sticky-region elements`)
check(app.includes('r.top<=readingLine&&r.bottom>=readingLine'), `${APP}: the observer no longer prefers the container that spans the reading line`)
check(app.includes("target=spanning||[...ratios.entries()]"), `${APP}: the observer no longer falls back to highest-ratio when nothing spans the reading line`)
check(app.includes("onWheel=()=>release()") && app.includes("onTouchMove=()=>release()"),
  `${APP}: wheel/touchmove no longer release the section lock immediately`)
check(app.includes("['ArrowUp','ArrowDown','PageUp','PageDown','Home','End',' '].includes(e.key)"),
  `${APP}: keyboard scroll keys no longer release the section lock`)
check(app.includes("if(isEditable())return"), `${APP}: the keyboard release no longer guards against typing in a text field`)
check(app.includes("if(scrollSettledRef.current&&sectionLockRef.current)release()"),
  `${APP}: a plain scroll event after the programmatic scroll has settled no longer releases the lock`)
check(app.includes("scrollSettleTimer=setTimeout(()=>{scrollSettledRef.current=true},150)"),
  `${APP}: the debounced-quiet scrollend fallback is missing -- release must never depend on scrollend alone in browsers that lack it`)
check(app.includes("if('onscrollend'in window)window.addEventListener('scrollend',onScrollEnd)"),
  `${APP}: the native scrollend listener is missing`)

// --- Containers, not headings, carry the id the whole mechanism keys off ---
check(app.includes("return <section key={id} id={`section-${id}`} style={{marginTop:32,scrollMarginTop:80}}>"),
  `${APP}: the Focus Playbook's renderSection no longer puts the section id on the <section> container (it must not be back on the <h2> heading)`)
check(app.includes('<section id="section-groups" style={{marginTop:32,scrollMarginTop:80}}>'),
  `${APP}: Networking Groups' id is not on its <section> container`)
check(app.includes('<section id="section-recruiters" style={{marginTop:32,scrollMarginTop:80}}>'),
  `${APP}: Recruiters' id is not on its <section> container`)
check(app.includes("return <div id=\"section-income\" style={{scrollMarginTop:80}}>"),
  `${APP}: Income Now's id is not on its content root`)
check(app.includes('data-sticky-region'), `${APP}: no element carries data-sticky-region -- the runtime sticky-height measurement has nothing to read`)

// --- Reading is not stalling: a scroll resets the idle clock too ---
check(app.includes("const onActivity=()=>{if(stallTimerRef.current)clearTimeout(stallTimerRef.current);arm()}") &&
  app.includes("window.addEventListener('scroll',onActivity"),
  `${APP}: the Stall idle timer no longer resets on a scroll gesture`)

if (failures) {
  console.error(`test-situation-state-projection: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-situation-state-projection: OK (activeSectionRef is the single, ref-based source of truth for section-in-view, written synchronously by every section-navigation path -- not just scrollToOutput -- and read live at send time; the IntersectionObserver is a locked-out fallback released only by a genuine user scroll gesture, never a timer, and prefers the container spanning the reading line over raw intersection ratio; section ids live on containers, not headings; the Stall idle timer counts scrolling as activity; CLAUDE.md carries the principle)')
}
