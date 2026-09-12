// Coach-as-Concierge Phase 4 Part 2 (Output/handoff/2026-09-09_concierge-
// batch-and-phase4-brief.md, §2.2, Column 2, row 13): "Practice This
// Answer" -- the first of the eight Column 2 affordances folded into
// MOMENT_CATALOG. Delivery-adjacent: fires once delivery-p11 has already
// reacted for the current identity, offering to practice the interview
// answer that's weakest, tapping through to the same openCoachWith
// mechanism the existing per-question practice door already uses (that
// page-level door stays in place until this row has fired on Bob's account
// and passed his read -- CLAUDE.md's page-button removal rule).
import fs from 'node:fs'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

const MOMENTS = 'src/coach-moments.js'
const moments = fs.readFileSync(MOMENTS, 'utf8')
const APP = 'src/App.jsx'
const app = fs.readFileSync(APP, 'utf8')
const DOC = 'docs/concierge-moment-map.md'
const doc = fs.readFileSync(DOC, 'utf8')

// --- The catalog entry itself ---
check(moments.includes("key: 'practice-p11-weakest'"), `${MOMENTS}: the practice-p11-weakest entry is missing`)
const pIdx = moments.indexOf("key: 'practice-p11-weakest'")
const pBlock = pIdx !== -1 ? moments.slice(pIdx, moments.indexOf('\n  },', pIdx)) : ''
check(pBlock.includes("family: 'check'"), `${MOMENTS}: practice-p11-weakest is not tagged as the check family`)
check(pBlock.includes("screen: 'focus'"), `${MOMENTS}: practice-p11-weakest is not scoped to the 'focus' screen`)
check(pBlock.includes("significance: 'ordinary'"),
  `${MOMENTS}: practice-p11-weakest should be ordinary (Coach following up on its own initiative), not open`)
check(pBlock.includes('dismissible: true'), `${MOMENTS}: practice-p11-weakest is not marked dismissible`)
check(!pBlock.includes('generated: true'), `${MOMENTS}: practice-p11-weakest is a fixed invitation -- it should not be generated`)
check(pBlock.includes("promptCode: 'practice_p11_weakest'"), `${MOMENTS}: practice-p11-weakest's promptCode is missing or has drifted`)
check(pBlock.includes('eligible: (ctx) => !!ctx.hasOnboardingConcierge && !!ctx.practiceP11Target'),
  `${MOMENTS}: practice-p11-weakest's eligibility (flagged account + a resolved practiceP11Target) has drifted`)
check(pBlock.includes('dedupeKey: (ctx) => `${ctx.selectedLane}::${ctx.chosen}`'),
  `${MOMENTS}: practice-p11-weakest's dedupeKey (fire once per role identity) is missing or has drifted`)
check(pBlock.includes("message: 'Interview Prep is built. Want to practice the answer that\\'s weakest?'"),
  `${MOMENTS}: practice-p11-weakest's message has drifted from the already-shipped op-side phrasing it reuses`)
check(pBlock.includes("quickReplies: [{ label: 'Practice it', value: 'practice-p11-go' }]"),
  `${MOMENTS}: practice-p11-weakest's quickReplies has drifted`)
check(/onTap: \(value, ctx\) => \{\s*if \(value === 'practice-p11-go'\) ctx\.openCoachWith\(`I want to practice my interview answers for \$\{ctx\.chosen \|\| 'this role'\}\.`, false, 'p11'\)\s*return true\s*\}/.test(pBlock),
  `${MOMENTS}: practice-p11-weakest's onTap no longer calls ctx.openCoachWith with the expected seed`)

// --- practiceP11Target: anchored on delivery-p11 having already fired for
// the current identity, same shape nextMoveTarget uses for its own anchor
// ---
const targetIdx = app.indexOf('const practiceP11Target=(()=>{')
check(targetIdx !== -1, `${APP}: the practiceP11Target computation is missing from the Moments evaluator`)
const targetBlock = targetIdx !== -1 ? app.slice(targetIdx, targetIdx + 400) : ''
check(targetBlock.includes('if(!chosen||!(outputs&&outputs.p11))return null'),
  `${APP}: practiceP11Target does not require both a chosen role and a built p11`)
check(targetBlock.includes("coachMoments['delivery-p11']&&coachMoments['delivery-p11'][idKey]"),
  `${APP}: practiceP11Target no longer reads delivery-p11's own dedupe record to confirm it already fired for this identity`)

// --- ctx wiring: the evaluator's ctx carries practiceP11Target; the tap
// dispatch ctx carries chosen + openCoachWith so onTap can call it ---
check(app.includes('nextMoveTarget,genSec,stallEligible,stallTarget,practiceP11Target,savedPlaybooks,'),
  `${APP}: the evaluator's ctx no longer carries practiceP11Target -- the entry's eligible/dedupeKey could not read it`)
check(app.includes('if(entry&&entry.onTap)return entry.onTap(value,{markDone,addNewOpportunity,advance,genSec,isIndependent,savePursuit,chosen,openCoachWith,'),
  `${APP}: the moment tap handler no longer passes chosen and openCoachWith into onTap's ctx -- practice-p11-weakest's onTap could not run`)

// --- Prompt codes (derived from MOMENT_CATALOG -- check the real exported value) ---
const { PROMPT_CODES } = await import('../src/coach-prompt-codes.js')
check(PROMPT_CODES.includes('practice_p11_weakest'), `src/coach-prompt-codes.js: PROMPT_CODES is missing 'practice_p11_weakest'`)

// --- Doc: the machine-checked key list includes the new row (full
// doc/live-array equality is check-concierge-moment-map.mjs's job; this
// just confirms the row landed in the doc at all) ---
check(doc.includes('"practice-p11-weakest"'), `${DOC}: moment-catalog-keys block is missing practice-p11-weakest`)
check(doc.includes('**`practice-p11-weakest`**'), `${DOC}: Section 2.1's eligibility prose is missing an entry for practice-p11-weakest`)

if (failures) {
  console.error(`test-coach-moments-practice-p11: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-coach-moments-practice-p11: OK (practice-p11-weakest is a fixed, Delivery-adjacent invitation gated on delivery-p11 having already fired for the identity; its tap reuses the existing op-side practice mechanism verbatim; ctx wiring and derived PROMPT_CODES both cover it)')
}
