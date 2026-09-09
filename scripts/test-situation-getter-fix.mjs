// Fix #838 (the SITUATION section-in-view bug) corrected how visibleSectionRef
// itself gets set -- a click sets it synchronously, the observer's effect
// clears it on leaving the Focus/Opportunity Playbook -- but it did not close
// the separate bug this fix addresses: Bob's production test on 0cf129c still
// reported the wrong section (Interview Prep, both times) after clicking The
// Role and then Your Bridge Story on a Focus Playbook and typing "Where am
// I?" after each.
//
// Root cause: computeSituation() was called at App's own render time --
// `situation={computeSituation()}` -- producing a plain snapshot OBJECT that
// gets passed down and closed over by Chat's own `send`. visibleSectionRef is
// a ref: clicking a section or scrolling updates it directly, with NO
// re-render of App, so the snapshot could be one exchange stale by the time
// someone actually asked "where am I?" -- exactly the failure mode reported.
//
// Fix: App passes the FUNCTION itself (getSituation={computeSituation}), and
// Chat calls it inline, at the instant its own fetch body is built, so the
// value read is always whatever visibleSectionRef.current holds right then --
// never a value stored from an earlier render.
//
// Second, independent change: the SECTION IN VIEW note (api/coach.js) used to
// render the raw section id verbatim ("p6"), which the model cannot translate
// and which leaked into a live reply as-is. It now resolves the user-facing
// label and the section's 1-indexed position in the numbered sequence the
// person actually scrolls and clicks through (Focus or Opportunity Playbook,
// whichever screen they are on), phrased as authoritative over anything said
// earlier in the conversation.
import fs from 'node:fs'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

const APP = 'src/App.jsx'
const CHAT = 'src/components/Chat.jsx'
const COACH = 'api/coach.js'
const PLAYBOOK = 'src/playbook-sections.js'
const app = fs.readFileSync(APP, 'utf8')
const chat = fs.readFileSync(CHAT, 'utf8')
const coach = fs.readFileSync(COACH, 'utf8')
const playbook = fs.readFileSync(PLAYBOOK, 'utf8')

// --- App.jsx: passes the getter, not a render-time snapshot ---
check(!app.includes('situation={computeSituation()}'),
  `${APP}: a <Chat> mount still evaluates computeSituation() at render time -- reintroduces the stale-snapshot bug`)
const getterMountCount = (app.match(/getSituation=\{computeSituation\}/g) || []).length
check(getterMountCount === 3, `${APP}: expected all 3 <Chat> mounts to pass getSituation={computeSituation}, found ${getterMountCount}`)
// fireMoment (App.jsx) is a separate, already-correct call site: it calls
// computeSituation() inline, inside its own async fetch construction, at the
// moment the request is actually built -- never stored as a snapshot value
// across a render boundary the way the <Chat> prop was. Verified during this
// fix's own investigation; explicitly checking it stays that way rather than
// getting "fixed" into something it never needed.
check(app.includes('situation:computeSituation()'),
  `${APP}: fireMoment's own inline computeSituation() call (already correct) has changed -- it should not have been touched`)

// --- Chat.jsx: calls the getter at send time, inside the fetch body ---
check(chat.includes('coachSaveTarget = null, getSituation = null,'), `${CHAT}: getSituation prop is missing from Chat's destructure`)
check(chat.includes("situation: typeof getSituation === 'function' ? getSituation() : null,"),
  `${CHAT}: send()'s fetch body must call getSituation() inline, at send time`)
check(!chat.includes('\n          situation,\n'), `${CHAT}: the old bare "situation," shorthand survives -- it would send the stale prop instead of the getter's live read`)

// --- api/coach.js: SECTION IN VIEW renders a label + ordinal, never the raw id ---
check(!coach.includes('They are currently looking at the "${situationSection}" section.'),
  `${COACH}: the section-in-view note still renders the raw section id -- the exact leak Bob's report caught`)
check(coach.includes("import { describeSections, focusSectionPosition, opSectionPosition } from '../src/playbook-sections.js'"),
  `${COACH}: focusSectionPosition/opSectionPosition are not imported`)
check(coach.includes("currentStep === 'op' ? opSectionPosition(situationSection) : currentStep === 'focus' ? focusSectionPosition(situationSection, isIndependentTrack) : null"),
  `${COACH}: situationSectionPos must resolve via the Opportunity or Focus Playbook's own ordered list depending on the current screen`)
check(coach.includes('SECTION IN VIEW: ${situationSectionPos.label} (section ${situationSectionPos.index} of ${situationSectionPos.total} in this ${currentStep'),
  `${COACH}: the note is not rendering the resolved label with its ordinal position out of the total`)
check(coach.includes('overrides anything earlier in the conversation about which section they were looking at'),
  `${COACH}: the note must phrase itself as authoritative over a stale earlier mention`)

// --- playbook-sections.js: the new ordered lookup exists and is exported ---
check(playbook.includes('export function focusOrderSections(independent = false)'), `${PLAYBOOK}: focusOrderSections is missing`)
check(playbook.includes('export function focusSectionPosition(key, independent = false)'), `${PLAYBOOK}: focusSectionPosition is missing`)
check(playbook.includes('export function opSectionPosition(key)'), `${PLAYBOOK}: opSectionPosition is missing`)

if (failures) {
  console.error(`test-situation-getter-fix: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-situation-getter-fix: OK (App passes the computeSituation function itself rather than its render-time call result; Chat calls it inline at send time so the section read is always live; fireMoment\'s own already-correct inline call is untouched; the SECTION IN VIEW note resolves a user-facing label and ordinal position instead of leaking the raw section id)')
}
