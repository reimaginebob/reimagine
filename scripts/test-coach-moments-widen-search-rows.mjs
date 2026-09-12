// Coach-as-Concierge Phase 4 Part 2, widen-the-search PR2 (Output/handoff/
// 2026-09-09_concierge-batch-and-phase4-brief.md, §2.6): the five catalog
// rows themselves -- Recruiters for This Path, Load your LinkedIn contacts,
// Networking Groups, Career Club Corner, Income Now -- built on top of
// PR1's engine (src/widen-search.js). Unlike every other Check-family row,
// eligibility here is NOT a profile-state condition: it is entirely
// "am I the one ctx.widenSearchTarget picked", computed once in the
// evaluator from the pure engine.
import fs from 'node:fs'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

const MOMENTS = 'src/coach-moments.js'
const moments = fs.readFileSync(MOMENTS, 'utf8')
const APP = 'src/App.jsx'
const app = fs.readFileSync(APP, 'utf8')
const CODES = 'src/coach-prompt-codes.js'
const codes = fs.readFileSync(CODES, 'utf8')
const DOC = 'docs/concierge-moment-map.md'
const doc = fs.readFileSync(DOC, 'utf8')

// --- WIDEN_SEARCH_ROW_KEYS: canonical rotation order, brief's own listing ---
check(moments.includes("export const WIDEN_SEARCH_ROW_KEYS = ["), `${MOMENTS}: WIDEN_SEARCH_ROW_KEYS is missing`)
const keysIdx = moments.indexOf('export const WIDEN_SEARCH_ROW_KEYS = [')
const keysBlock = keysIdx !== -1 ? moments.slice(keysIdx, moments.indexOf(']', keysIdx)) : ''
for (const key of ['widen-recruiters', 'widen-linkedin-contacts', 'widen-networking-groups', 'widen-career-club-corner', 'widen-income-now']) {
  check(keysBlock.includes(`'${key}'`), `${MOMENTS}: WIDEN_SEARCH_ROW_KEYS is missing '${key}'`)
}

// --- Shared machinery: three taps, shared onTap dispatch, fresh dedupeValue ---
check(moments.includes("{ label: 'Do it now', value: `widen-do-it:${rowKey}` }"), `${MOMENTS}: widenSearchQuickReplies is missing the 'Do it now' tap`)
check(moments.includes("{ label: 'Remind me later', value: `widen-remind-later:${rowKey}` }"), `${MOMENTS}: widenSearchQuickReplies is missing the 'Remind me later' tap`)
check(moments.includes("{ label: 'Not for me', value: `widen-not-for-me:${rowKey}` }"), `${MOMENTS}: widenSearchQuickReplies is missing the 'Not for me' tap`)
check(moments.includes('const widenSearchDedupeValue = () => new Date().toISOString()'),
  `${MOMENTS}: widenSearchDedupeValue no longer returns a fresh timestamp -- without it, the default 'fire once ever' dedupe semantics would permanently block these rows after their first fire`)

// --- Each of the five rows: family, screen, dismissible:false (own taps,
// not the shared Remind-later/Minimize pair), priority, eligible gated on
// ctx.widenSearchTarget, shownOutcome, dedupeValue ---
const ROW_SPECS = [
  { key: 'widen-recruiters', promptCode: 'widen_recruiters', needsChosen: true },
  { key: 'widen-linkedin-contacts', promptCode: 'widen_linkedin_contacts', needsChosen: false },
  { key: 'widen-networking-groups', promptCode: 'widen_networking_groups', needsChosen: true },
  { key: 'widen-career-club-corner', promptCode: 'widen_career_club_corner', needsChosen: false },
  { key: 'widen-income-now', promptCode: 'widen_income_now', needsChosen: true },
]
for (const spec of ROW_SPECS) {
  const idx = moments.indexOf(`key: '${spec.key}'`)
  check(idx !== -1, `${MOMENTS}: the ${spec.key} entry is missing`)
  const block = idx !== -1 ? moments.slice(idx, moments.indexOf('\n  },', idx)) : ''
  check(block.includes("family: 'check'"), `${MOMENTS}: ${spec.key} is not tagged as the check family`)
  check(block.includes("significance: 'ordinary'"), `${MOMENTS}: ${spec.key} should be ordinary (self-initiated, not reactive)`)
  check(block.includes('dismissible: false'), `${MOMENTS}: ${spec.key} should opt out of the shared Remind-me-later/Minimize pair -- brief §2.6's three taps are a hard rule, not an addition to the default pair`)
  check(block.includes('priority: 1'), `${MOMENTS}: ${spec.key}'s priority has drifted`)
  check(block.includes(`promptCode: '${spec.promptCode}'`), `${MOMENTS}: ${spec.key}'s promptCode is missing or has drifted`)
  check(block.includes(`ctx.widenSearchTarget === '${spec.key}'`), `${MOMENTS}: ${spec.key}'s eligibility does not check ctx.widenSearchTarget -- it could fire alongside another row in the set`)
  if (spec.needsChosen) {
    check(block.includes('!!ctx.chosen'), `${MOMENTS}: ${spec.key} builds a Focus section via genSec, which needs a chosen direction -- its eligible() should require ctx.chosen`)
  }
  check(block.includes("shownOutcome: () => 'offer made'"), `${MOMENTS}: ${spec.key} does not log 'offer made' (decision d08) on fire`)
  check(block.includes('dedupeValue: widenSearchDedupeValue'), `${MOMENTS}: ${spec.key} does not use the fresh-timestamp dedupeValue -- it would only ever fire once, ever`)
  check(block.includes(`quickReplies: () => widenSearchQuickReplies('${spec.key}')`), `${MOMENTS}: ${spec.key}'s quickReplies does not use the shared three-tap helper`)
  check(block.includes('onTap: widenSearchOnTap'), `${MOMENTS}: ${spec.key}'s onTap does not use the shared dispatcher`)
}

// --- Career Club Corner: APPROVED verbatim copy (brief §2.6, Bob's own words) ---
check(moments.includes("There's a free community that meets every Monday called Career Club Corner."),
  `${MOMENTS}: widen-career-club-corner's message has drifted from Bob's approved verbatim paragraph`)
check(moments.includes('Nobody is selling you anything. Want the link?'),
  `${MOMENTS}: widen-career-club-corner's message is missing its approved closing lines`)

// --- App.jsx: widenSearchTarget computed once, gating all five rows to
// mutual exclusivity, and wired into the evaluator's ctx ---
check(app.includes("const widenSearchCandidateKeys=chosen?WIDEN_SEARCH_ROW_KEYS:WIDEN_SEARCH_ROW_KEYS.filter(k=>k==='widen-linkedin-contacts'||k==='widen-career-club-corner')"),
  `${APP}: widenSearchCandidateKeys does not exclude the three direction-needing rows when chosen is unset -- rotation with no lastOfferedKey would get stuck re-offering widen-recruiters forever instead of ever reaching the two direction-free rows`)
check(app.includes('const widenSearchTarget=hasOnboardingConcierge?pickNextWidenSearchRow(widenSearchCandidateKeys,widenSearchState,'),
  `${APP}: widenSearchTarget is not computed via pickNextWidenSearchRow over widenSearchCandidateKeys -- the five rows could not stay mutually exclusive`)
check(app.includes('offeredThisSession:widenSearchOfferedThisSessionRef.current'),
  `${APP}: widenSearchTarget's pacing input does not read the session-only ref from PR1`)
check(app.includes('opOpportunityReadTarget,widenSearchTarget,viewedSection'),
  `${APP}: the evaluator's ctx no longer carries widenSearchTarget -- the five rows' eligible() could not read it`)
check(app.includes('if(WIDEN_SEARCH_ROW_KEYS.includes(entry.key)){\n      widenSearchOfferedThisSessionRef.current=true'),
  `${APP}: firing a widen-the-search row does not flip the session pacing ref -- more than one could fire in the same session`)
check(app.includes("import { MOMENT_CATALOG, WIDEN_SEARCH_ROW_KEYS } from \"./coach-moments.js\""),
  `${APP}: WIDEN_SEARCH_ROW_KEYS is not imported from coach-moments.js`)
check(app.includes("import { pickNextWidenSearchRow, snoozeWidenSearchRow, retireWidenSearchRow } from \"./widen-search.js\""),
  `${APP}: the widen-search engine functions are not imported`)

// --- shownOutcome plumbing in fireStaticEntryMessage ---
check(app.includes("logPromptEngagement(entry.promptCode,'hub_arrival',entry.shownOutcome?entry.shownOutcome(ctx):'shown')"),
  `${APP}: fireStaticEntryMessage does not support an entry-level shownOutcome override`)

// --- Tap dispatch: widenSearchRemindLater/widenSearchNotForMe/widenSearchDoIt ---
check(app.includes('widenSearchRemindLater:(rowKey)=>{'), `${APP}: the moment tap handler is missing widenSearchRemindLater`)
check(app.includes('widenSearchNotForMe:(rowKey)=>{'), `${APP}: the moment tap handler is missing widenSearchNotForMe`)
check(app.includes('widenSearchDoIt:(rowKey)=>{'), `${APP}: the moment tap handler is missing widenSearchDoIt`)
const remindIdx = app.indexOf('widenSearchRemindLater:(rowKey)=>{')
const remindBlock = remindIdx !== -1 ? app.slice(remindIdx, remindIdx + 300) : ''
check(remindBlock.includes('setWidenSearchState(s=>snoozeWidenSearchRow(s,rowKey,new Date()))'),
  `${APP}: widenSearchRemindLater does not call snoozeWidenSearchRow`)
check(remindBlock.includes("logPromptEngagement(code,'topic_close_tap','remind later')"),
  `${APP}: widenSearchRemindLater does not log the 'remind later' outcome (decision d08)`)
const notForMeIdx = app.indexOf('widenSearchNotForMe:(rowKey)=>{')
const notForMeBlock = notForMeIdx !== -1 ? app.slice(notForMeIdx, notForMeIdx + 300) : ''
check(notForMeBlock.includes('setWidenSearchState(s=>retireWidenSearchRow(s,rowKey,new Date()))'),
  `${APP}: widenSearchNotForMe does not call retireWidenSearchRow`)
check(notForMeBlock.includes("logPromptEngagement(code,'topic_close_tap','not for me')"),
  `${APP}: widenSearchNotForMe does not log the 'not for me' outcome (decision d08)`)
const doItIdx = app.indexOf('widenSearchDoIt:(rowKey)=>{')
const doItBlock = doItIdx !== -1 ? app.slice(doItIdx, doItIdx + 1400) : ''
check(doItBlock.includes("logPromptEngagement(code,'topic_close_tap','do it now')"),
  `${APP}: widenSearchDoIt does not log the 'do it now' outcome (decision d08)`)
check(doItBlock.includes("if(rowKey==='widen-recruiters')return genSec('recruiters')"),
  `${APP}: widenSearchDoIt's Recruiters action does not build the recruiters Focus section`)
check(doItBlock.includes("if(rowKey==='widen-networking-groups')return genSec('groups')"),
  `${APP}: widenSearchDoIt's Networking Groups action does not build the groups Focus section`)
check(doItBlock.includes("if(rowKey==='widen-income-now')return genSec('income')"),
  `${APP}: widenSearchDoIt's Income Now action does not build the income Focus section`)
check(doItBlock.includes("window.open(CAREER_CLUB_CORNER.url,'_blank','noopener,noreferrer')"),
  `${APP}: widenSearchDoIt's Career Club Corner action does not open the real corner.career.club link`)
check(doItBlock.includes("openCoachWith('I want to load my LinkedIn contacts so Who You Know Here and Known Contacts can start finding matches.',false)"),
  `${APP}: widenSearchDoIt's LinkedIn contacts fallback does not guide the person via Coach when no opportunity is open`)

// --- Session pacing survives a reload (production fix, 2026-09-12 live QA):
// sessionStorage, not a bare useRef(false), and cleared on Start Fresh/Sign
// Out (clearAccountLocalState) so a new account in the same tab isn't
// silently suppressed by the old account's pacing. ---
check(app.includes("try{return sessionStorage.getItem('pe_widen_search_offered_session')==='true'}catch{return false}"),
  `${APP}: widenSearchOfferedThisSessionRef no longer seeds from sessionStorage -- a reload would restart widen-the-search pacing from zero`)
check(app.includes("try{sessionStorage.setItem('pe_widen_search_offered_session','true')}catch{}"),
  `${APP}: firing a widen-the-search row no longer writes the sessionStorage flag -- a reload would not see this session's offer`)
const clearIdx = app.indexOf('const clearAccountLocalState=()=>{')
const clearBlock = clearIdx !== -1 ? app.slice(clearIdx, clearIdx + 900) : ''
check(clearBlock.includes("sessionStorage.removeItem('pe_widen_search_offered_session')"),
  `${APP}: clearAccountLocalState (Start Fresh / Sign Out) does not clear the widen-the-search session flag -- a new account in the same tab would inherit the old one's pacing`)

// --- Prompt codes (derived from MOMENT_CATALOG) ---
const { PROMPT_CODES } = await import('../src/coach-prompt-codes.js')
for (const spec of ROW_SPECS) {
  check(PROMPT_CODES.includes(spec.promptCode), `src/coach-prompt-codes.js: PROMPT_CODES is missing '${spec.promptCode}'`)
}

// --- Dashboard vocabulary (decision d08): additive to shown/accepted/declined ---
check(codes.includes("'offer made'") && codes.includes("'do it now'") && codes.includes("'remind later'") && codes.includes("'not for me'") && codes.includes("'answered'"),
  `${CODES}: PROMPT_OUTCOMES is missing the widen-the-search set's own vocabulary (decision d08)`)
check(codes.includes("'shown'") && codes.includes("'accepted'") && codes.includes("'declined'"),
  `${CODES}: PROMPT_OUTCOMES dropped the pre-existing shown/accepted/declined triple -- every row that shipped before this PR still uses it`)

// --- Doc: the machine-checked key list + prose cover all five rows ---
for (const spec of ROW_SPECS) {
  check(doc.includes(`"${spec.key}"`), `${DOC}: moment-catalog-keys block is missing ${spec.key}`)
  check(doc.includes(`**\`${spec.key}\`**`), `${DOC}: Section 2.1's eligibility prose is missing an entry for ${spec.key}`)
}

if (failures) {
  console.error(`test-coach-moments-widen-search-rows: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-coach-moments-widen-search-rows: OK (all five widen-the-search rows are mutually exclusive via ctx.widenSearchTarget, carry the brief\'s three-tap hard rule instead of the shared decline pair, refire correctly via a fresh dedupeValue, log the decision-d08 vocabulary, and each Do it now action reaches the right destination)')
}
