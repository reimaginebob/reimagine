// Coach-as-Concierge Phase 4 Part 2 (Output/handoff/2026-09-09_concierge-
// batch-and-phase4-brief.md, §2.2, Column 2, PR3): the four remaining
// affordances -- the weakness question (row 16), the routed interview-
// question row (row 17, one row with a parameter, not five), the pipeline
// read (row 23), and the opportunity read (row 24). Row 21 (the offer &
// negotiation trade-off drill) is not built here: premise-verification
// found it already substantively covered by the pre-existing op-playbook-
// arrival/op-next-move 'tradeoff' pseudo-key routing (opPickByStage,
// App.jsx), which predates this batch -- see the PR description for the
// full finding.
import fs from 'node:fs'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

const MOMENTS = 'src/coach-moments.js'
const moments = fs.readFileSync(MOMENTS, 'utf8')
const APP = 'src/App.jsx'
const app = fs.readFileSync(APP, 'utf8')
const DOC = 'docs/concierge-moment-map.md'
const doc = fs.readFileSync(DOC, 'utf8')

function entryBlock(key) {
  const idx = moments.indexOf(`key: '${key}'`)
  if (idx === -1) return ''
  return moments.slice(idx, moments.indexOf('\n  },', idx))
}

// --- Row 16: weakness-question-coach ---
{
  const b = entryBlock('weakness-question-coach')
  check(!!b, `${MOMENTS}: the weakness-question-coach entry is missing`)
  check(b.includes("family: 'check'"), `${MOMENTS}: weakness-question-coach is not tagged as the check family`)
  check(b.includes("screen: 'stories'"), `${MOMENTS}: weakness-question-coach is not scoped to the 'stories' screen`)
  check(b.includes("significance: 'ordinary'"), `${MOMENTS}: weakness-question-coach should be ordinary`)
  check(!b.includes('generated: true'), `${MOMENTS}: weakness-question-coach is a fixed invitation -- it should not be generated`)
  check(b.includes("promptCode: 'weakness_question_coach'"), `${MOMENTS}: weakness-question-coach's promptCode is missing or has drifted`)
  check(b.includes('eligible: (ctx) => !!ctx.hasOnboardingConcierge && !ctx.hasWeaknessEvidenceNow'),
    `${MOMENTS}: weakness-question-coach's eligibility has drifted`)
  check(!/dedupeKey:/.test(b), `${MOMENTS}: weakness-question-coach should fire once per account ever (no dedupeKey)`)
  check(/onTap: \(value, ctx\) => \{\s*if \(value === 'weakness-question-go'\) ctx\.weaknessQuestionOnTap\(\)\s*return true\s*\}/.test(b),
    `${MOMENTS}: weakness-question-coach's onTap no longer calls ctx.weaknessQuestionOnTap`)
}
check(app.includes("weaknessQuestionOnTap:()=>openCoachWith(WEAKNESS_QUESTION.coach,true,'stories')"),
  `${APP}: weaknessQuestionOnTap no longer reuses WEAKNESS_QUESTION.coach unchanged (autoSend true, returnSection 'stories'), matching WeaknessPanel's own page door`)

// --- Row 17: routed-question-coach ---
{
  const b = entryBlock('routed-question-coach')
  check(!!b, `${MOMENTS}: the routed-question-coach entry is missing`)
  check(b.includes("family: 'check'"), `${MOMENTS}: routed-question-coach is not tagged as the check family`)
  check(b.includes("screen: 'stories'"), `${MOMENTS}: routed-question-coach is not scoped to the 'stories' screen`)
  check(!b.includes('generated: true'), `${MOMENTS}: routed-question-coach is a fixed invitation -- it should not be generated`)
  check(b.includes("promptCode: 'routed_question_coach'"), `${MOMENTS}: routed-question-coach's promptCode is missing or has drifted`)
  check(b.includes('eligible: (ctx) => !!ctx.hasOnboardingConcierge && !!ctx.routedQuestionTarget'),
    `${MOMENTS}: routed-question-coach's eligibility has drifted`)
  check(b.includes('dedupeKey: (ctx) => ctx.routedQuestionTarget.id'),
    `${MOMENTS}: routed-question-coach's dedupeKey should be the question's own id, not a role/lane identity`)
  check(/onTap: \(value, ctx\) => \{\s*if \(value\.startsWith\('routed-question-go:'\)\) ctx\.routedQuestionOnTap\(value\.slice\('routed-question-go:'\.length\)\)\s*return true\s*\}/.test(b),
    `${MOMENTS}: routed-question-coach's onTap no longer parses the question id and calls ctx.routedQuestionOnTap with it`)
}
check(app.includes("routedQuestionOnTap:(qid)=>{\n          const q=ROUTED_QUESTIONS.find(x=>x&&x.id===qid)\n          if(q&&q.coach)openCoachWith(q.coach,true,'stories')\n        }"),
  `${APP}: routedQuestionOnTap no longer looks up the question fresh and reuses its own .coach seed unchanged`)
const targetIdx = app.indexOf('const routedQuestionTarget=(()=>{')
check(targetIdx !== -1, `${APP}: the routedQuestionTarget computation is missing from the Moments evaluator`)
const targetBlock = targetIdx !== -1 ? app.slice(targetIdx, targetIdx + 300) : ''
check(targetBlock.includes("if(coachMoments['routed-question-coach']&&coachMoments['routed-question-coach'][q.id])continue"),
  `${APP}: routedQuestionTarget no longer skips questions already offered for this account`)

// --- Row 23: op-pipeline-read ---
{
  const b = entryBlock('op-pipeline-read')
  check(!!b, `${MOMENTS}: the op-pipeline-read entry is missing`)
  check(b.includes("family: 'check'"), `${MOMENTS}: op-pipeline-read is not tagged as the check family`)
  check(b.includes("screen: 'pipeline'"), `${MOMENTS}: op-pipeline-read is not scoped to the 'pipeline' screen`)
  check(!b.includes('generated: true'), `${MOMENTS}: op-pipeline-read is a fixed invitation -- it should not be generated`)
  check(b.includes("promptCode: 'op_pipeline_read'"), `${MOMENTS}: op-pipeline-read's promptCode is missing or has drifted`)
  check(b.includes('eligible: (ctx) => !!ctx.hasOnboardingConcierge && !!ctx.opPipelineReadEligible'),
    `${MOMENTS}: op-pipeline-read's eligibility has drifted`)
  check(/onTap: \(value, ctx\) => \{\s*if \(value === 'op-pipeline-read-go'\) ctx\.opPipelineReadOnTap\(\)\s*return true\s*\}/.test(b),
    `${MOMENTS}: op-pipeline-read's onTap no longer calls ctx.opPipelineReadOnTap`)
}
check(app.includes('opPipelineReadOnTap:()=>openCoachWith(`Step back and look at my whole pipeline. How is my search going overall — where am I building momentum and where am I stalling — and where should I focus my energy right now?`,true)'),
  `${APP}: opPipelineReadOnTap no longer reuses the pipeline board's own "Get My Coach's read on your pipeline" seed unchanged`)
check(app.includes("const opPipelineReadEligible=!!(opActiveRecords.length>=2&&coachMoments['op-pipeline-arrival']&&coachMoments['op-pipeline-arrival']['_'])"),
  `${APP}: opPipelineReadEligible no longer requires both 2+ active opportunities and op-pipeline-arrival having already fired`)

// --- Row 24: op-opportunity-read ---
{
  const b = entryBlock('op-opportunity-read')
  check(!!b, `${MOMENTS}: the op-opportunity-read entry is missing`)
  check(b.includes("family: 'check'"), `${MOMENTS}: op-opportunity-read is not tagged as the check family`)
  check(b.includes("screen: 'pipeline'"), `${MOMENTS}: op-opportunity-read is not scoped to the 'pipeline' screen`)
  check(!b.includes('generated: true'), `${MOMENTS}: op-opportunity-read is a fixed invitation -- it should not be generated`)
  check(b.includes("promptCode: 'op_opportunity_read'"), `${MOMENTS}: op-opportunity-read's promptCode is missing or has drifted`)
  check(b.includes('eligible: (ctx) => !!ctx.hasOnboardingConcierge && !!ctx.opOpportunityReadTarget'),
    `${MOMENTS}: op-opportunity-read's eligibility has drifted`)
  check(b.includes('dedupeKey: (ctx) => ctx.opOpportunityReadTarget.id'),
    `${MOMENTS}: op-opportunity-read's dedupeKey should re-fire if the nearest record changes`)
  check(/onTap: \(value, ctx\) => \{\s*if \(value\.startsWith\('op-opportunity-read-go:'\)\) ctx\.opOpportunityReadOnTap\(value\.slice\('op-opportunity-read-go:'\.length\)\)\s*return true\s*\}/.test(b),
    `${MOMENTS}: op-opportunity-read's onTap no longer parses the record id and calls ctx.opOpportunityReadOnTap with it`)
}
check(app.includes("const opOpportunityReadTarget=(coachMoments['op-pipeline-arrival']&&coachMoments['op-pipeline-arrival']['_']&&opNearestRecord)?opNearestRecord:null"),
  `${APP}: opOpportunityReadTarget no longer reuses opNearestRecord gated on op-pipeline-arrival having fired`)
const oorFnIdx = app.indexOf('opOpportunityReadOnTap:(recId)=>{')
check(oorFnIdx !== -1, `${APP}: opOpportunityReadOnTap is missing from the moment tap handler`)
const oorFnBlock = oorFnIdx !== -1 ? app.slice(oorFnIdx, oorFnIdx + 350) : ''
check(oorFnBlock.includes('const rec=savedPlaybooks.find(r=>r&&r.id===recId);if(!rec)return'),
  `${APP}: opOpportunityReadOnTap does not resolve the record fresh at tap time`)
check(oorFnBlock.includes("const title=rec.title||rec.company||'Opportunity'"),
  `${APP}: opOpportunityReadOnTap no longer matches the pipeline board's own per-record title fallback`)
check(oorFnBlock.includes("Give me your read on where my ${title} opportunity stands right now"),
  `${APP}: opOpportunityReadOnTap no longer reuses the per-record page door's exact seed text`)
check(!oorFnBlock.includes('restoreFromSavedSlot'),
  `${APP}: opOpportunityReadOnTap should NOT restore/pin currentSavedSlotIdRef, matching the page door it reuses (the read does not require navigating in)`)

// --- ctx wiring: the evaluator's ctx carries all four new fields; the tap
// dispatch ctx carries all four new onTap functions ---
check(app.includes('nextMoveTarget,genSec,stallEligible,stallTarget,practiceP11Target,hasWeaknessEvidenceNow,routedQuestionTarget,savedPlaybooks,'),
  `${APP}: the evaluator's ctx no longer carries hasWeaknessEvidenceNow/routedQuestionTarget`)
check(app.includes('opPracticeTeamEligible,opPipelineReadEligible,opOpportunityReadTarget,viewedSection,'),
  `${APP}: the evaluator's ctx no longer carries opPipelineReadEligible/opOpportunityReadTarget`)

// --- Prompt codes (derived from MOMENT_CATALOG) ---
const { PROMPT_CODES } = await import('../src/coach-prompt-codes.js')
for (const code of ['weakness_question_coach', 'routed_question_coach', 'op_pipeline_read', 'op_opportunity_read']) {
  check(PROMPT_CODES.includes(code), `src/coach-prompt-codes.js: PROMPT_CODES is missing '${code}'`)
}

// --- Doc: all four rows landed in the machine-checked key list and prose ---
for (const key of ['weakness-question-coach', 'routed-question-coach', 'op-pipeline-read', 'op-opportunity-read']) {
  check(doc.includes(`"${key}"`), `${DOC}: moment-catalog-keys block is missing ${key}`)
  check(doc.includes(`**\`${key}\`**`), `${DOC}: Section 2.1's eligibility prose is missing an entry for ${key}`)
}

if (failures) {
  console.error(`test-coach-moments-column2-pr3: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-coach-moments-column2-pr3: OK (weakness-question-coach, routed-question-coach, op-pipeline-read, and op-opportunity-read all reuse their existing page doors\' exact seeds; routed-question-coach cycles through the five coach-enabled ROUTED_QUESTIONS one at a time; op-opportunity-read reuses op-pipeline-arrival\'s own nearest-record pick and correctly does not restore/pin currentSavedSlotIdRef; ctx wiring and derived PROMPT_CODES all cover the four new rows)')
}
