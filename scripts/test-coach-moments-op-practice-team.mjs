// Coach-as-Concierge Phase 4 Part 2 (Output/handoff/2026-09-09_concierge-
// batch-and-phase4-brief.md, §2.2, Column 2 rows 14/15): the two per-seat
// Interview Team doors (renderInterviewPrep's 'Practice with My Coach'/
// 'Prep with My Coach' buttons) share one underlying mechanism --
// onPrepWithCoach -- so this is one proactive row, op-practice-interview-
// team, mirroring practice-p11-weakest's Focus-side shape on the
// Opportunity Playbook.
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
check(moments.includes("key: 'op-practice-interview-team'"), `${MOMENTS}: the op-practice-interview-team entry is missing`)
const pIdx = moments.indexOf("key: 'op-practice-interview-team'")
const pBlock = pIdx !== -1 ? moments.slice(pIdx, moments.indexOf('\n  },', pIdx)) : ''
check(pBlock.includes("family: 'check'"), `${MOMENTS}: op-practice-interview-team is not tagged as the check family`)
check(pBlock.includes("screen: 'op'"), `${MOMENTS}: op-practice-interview-team is not scoped to the 'op' screen`)
check(pBlock.includes("significance: 'ordinary'"),
  `${MOMENTS}: op-practice-interview-team should be ordinary (Coach following up on its own initiative), not open`)
check(pBlock.includes('dismissible: true'), `${MOMENTS}: op-practice-interview-team is not marked dismissible`)
check(!pBlock.includes('generated: true'), `${MOMENTS}: op-practice-interview-team is a fixed invitation -- it should not be generated`)
check(pBlock.includes("promptCode: 'op_practice_interview_team'"), `${MOMENTS}: op-practice-interview-team's promptCode is missing or has drifted`)
check(pBlock.includes('eligible: (ctx) => !!ctx.hasOnboardingConcierge && !!ctx.opPracticeTeamEligible'),
  `${MOMENTS}: op-practice-interview-team's eligibility (flagged account + a resolved opPracticeTeamEligible) has drifted`)
check(pBlock.includes('dedupeKey: (ctx) => ctx.opRecord.id'),
  `${MOMENTS}: op-practice-interview-team's dedupeKey (fire once per record) is missing or has drifted`)
check(pBlock.includes('message: (ctx) => `Your interview team for ${ctx.opRecord.company} is mapped out. Want to prep with My Coach?`'),
  `${MOMENTS}: op-practice-interview-team's message has drifted`)
check(pBlock.includes("quickReplies: (ctx) => [{ label: 'Let\\'s prep for it', value: `op-practice-team-go:${ctx.opRecord.id}` }]"),
  `${MOMENTS}: op-practice-interview-team's quickReplies has drifted`)
check(/onTap: \(value, ctx\) => \{\s*if \(value\.startsWith\('op-practice-team-go:'\)\) ctx\.opPracticeTeamOnTap\(value\.slice\('op-practice-team-go:'\.length\)\)\s*return true\s*\}/.test(pBlock),
  `${MOMENTS}: op-practice-interview-team's onTap no longer parses the record id and calls ctx.opPracticeTeamOnTap with it`)

// --- opRecord.hasInterviewTeam: parsed once from the built p11 card,
// checking for the same ip.people/ip.panel shapes renderInterviewPrep
// itself branches on ---
const teamFlagIdx = app.indexOf('const hasInterviewTeam=')
check(teamFlagIdx !== -1, `${APP}: opRecord's hasInterviewTeam computation is missing`)
const teamFlagBlock = teamFlagIdx !== -1 ? app.slice(app.indexOf('const p11Ip=', teamFlagIdx - 400), teamFlagIdx + 250) : ''
check(teamFlagBlock.includes("const p11Ip=cardBuilt('p11')?parseInterviewPrepJSON(cardText('p11')):null"),
  `${APP}: opRecord's p11Ip parse (feeding hasInterviewTeam) is missing or has drifted`)
check(teamFlagBlock.includes('Array.isArray(p11Ip.people)&&p11Ip.people.length'),
  `${APP}: hasInterviewTeam no longer checks the ip.people shape`)
check(teamFlagBlock.includes('Array.isArray(p11Ip.panel)&&p11Ip.panel.length'),
  `${APP}: hasInterviewTeam no longer checks the ip.panel shape`)
check(app.includes('arrivalTarget,arrivalPick:pick,hasInterviewTeam,arrivalCopy:'),
  `${APP}: hasInterviewTeam is not returned from the opRecord IIFE`)

// --- opPracticeTeamEligible: anchored on delivery-op-p11 having already
// fired for this record, same shape practiceP11Target uses on the Focus
// side ---
const eligIdx = app.indexOf('const opPracticeTeamEligible=')
check(eligIdx !== -1, `${APP}: the opPracticeTeamEligible computation is missing from the Moments evaluator`)
const eligBlock = eligIdx !== -1 ? app.slice(eligIdx, eligIdx + 250) : ''
check(eligBlock.includes("opRecord.hasInterviewTeam&&coachMoments['delivery-op-p11']&&coachMoments['delivery-op-p11'][opRecord.id]"),
  `${APP}: opPracticeTeamEligible no longer requires both hasInterviewTeam and delivery-op-p11's own dedupe record for this record`)

// --- ctx wiring: the evaluator's ctx carries opPracticeTeamEligible; the
// tap dispatch ctx carries opPracticeTeamOnTap so onTap can call it ---
check(app.includes('opNextMoveTarget,opInterviewCloseTarget,opResumeJumpTarget,opPracticeTeamEligible,opPipelineReadEligible,opOpportunityReadTarget,widenSearchTarget,viewedSection,'),
  `${APP}: the evaluator's ctx no longer carries opPracticeTeamEligible -- the entry's eligible could not read it`)
check(app.includes('opPracticeTeamOnTap:(recId)=>{'),
  `${APP}: the moment tap handler no longer defines opPracticeTeamOnTap -- op-practice-interview-team's onTap could not run`)
const tapFnIdx = app.indexOf('opPracticeTeamOnTap:(recId)=>{')
const tapFnBlock = tapFnIdx !== -1 ? app.slice(tapFnIdx, tapFnIdx + 700) : ''
check(tapFnBlock.includes('const rec=savedPlaybooks.find(r=>r&&r.id===recId);if(!rec)return'),
  `${APP}: opPracticeTeamOnTap does not resolve the record fresh at tap time`)
check(tapFnBlock.includes("openCoachWith(`I want to practice my interview answers for ${rec.company||rec.title||'this opportunity'}."),
  `${APP}: opPracticeTeamOnTap no longer calls openCoachWith with the expected practice seed`)
check(tapFnBlock.includes('if(alreadyOpen)act();else{restoreFromSavedSlot(rec);setTimeout(act,250)}'),
  `${APP}: opPracticeTeamOnTap does not open the record first when it isn't already the open one, same as opInterviewCloseOnTap`)

// --- Prompt codes (derived from MOMENT_CATALOG -- check the real exported value) ---
const { PROMPT_CODES } = await import('../src/coach-prompt-codes.js')
check(PROMPT_CODES.includes('op_practice_interview_team'), `src/coach-prompt-codes.js: PROMPT_CODES is missing 'op_practice_interview_team'`)

// --- Doc: the machine-checked key list includes the new row ---
check(doc.includes('"op-practice-interview-team"'), `${DOC}: moment-catalog-keys block is missing op-practice-interview-team`)
check(doc.includes('**`op-practice-interview-team`**'), `${DOC}: Section 2.1's eligibility prose is missing an entry for op-practice-interview-team`)

if (failures) {
  console.error(`test-coach-moments-op-practice-team: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-coach-moments-op-practice-team: OK (op-practice-interview-team is a fixed, Delivery-adjacent invitation gated on delivery-op-p11 already firing AND a real per-person team being built; its tap reuses the existing openCoachWith practice mechanism; ctx wiring and derived PROMPT_CODES both cover it)')
}
