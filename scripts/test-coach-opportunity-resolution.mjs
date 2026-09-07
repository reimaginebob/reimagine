// Guards the same-name opportunity resolution fix (2026-09-07). Every chat
// mechanism that resolves a spoken opportunity name against activePlaybooks
// used to call activePlaybooks.find directly -- first substring match wins,
// silently, with no signal a second match even existed. Confirmed present
// across all seven call sites that do this (opportunity-update, op-card-
// rework, opportunity-context, opportunity-archive, close-reason,
// interview-team, pursuit-update) before this fix -- a silent-wrong-answer
// class of bug, not a missing-feature one: two opportunities that both
// contain "acme" meant a confident-sounding wrong answer, never an error.
//
// The fix: one shared resolver (unique / ambiguous / absent) instead of each
// site's own .find, a one-tap disambiguation offer on 'ambiguous' instead of
// guessing, and the actual write logic for each of the seven mechanisms
// pulled out into its own execX function so BOTH a unique-match tap and a
// disambiguation tap can call the exact same code -- never two copies of
// the same write drifting apart.
import fs from 'node:fs'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

const APP = 'src/App.jsx'
const app = fs.readFileSync(APP, 'utf8')

// The resolver itself: three-state contract, not a boolean.
check(app.includes('function resolveOpportunityByName(activePlaybooks,oppName){'),
  `${APP}: resolveOpportunityByName is missing`)
const resolverIdx = app.indexOf('function resolveOpportunityByName(')
const resolverBlock = resolverIdx !== -1 ? app.slice(resolverIdx, resolverIdx + 700) : ''
check(resolverBlock.includes("return{status:'absent',matches:[]}"),
  `${APP}: resolveOpportunityByName does not return an 'absent' state for no matches`)
check(resolverBlock.includes("return{status:'unique',matches,match:matches[0]}"),
  `${APP}: resolveOpportunityByName does not return a 'unique' state with a concrete match for exactly one hit`)
check(resolverBlock.includes("return{status:'ambiguous',matches}"),
  `${APP}: resolveOpportunityByName does not return an 'ambiguous' state for more than one hit -- this is the actual fix; without it, two matches silently pick the first`)
check(resolverBlock.includes("r&&r.source==='door2'"),
  `${APP}: resolveOpportunityByName no longer scopes matches to source==='door2', same scope every call site used before`)

// The disambiguation offer builder: carries the original action forward.
check(app.includes('function buildDisambiguationOffer(originalCheckinKey,data,matches){'),
  `${APP}: buildDisambiguationOffer is missing`)
const offerIdx = app.indexOf('function buildDisambiguationOffer(')
const offerBlock = offerIdx !== -1 ? app.slice(offerIdx, offerIdx + 700) : ''
check(offerBlock.includes("checkinKey:'opportunity-disambiguate'"),
  `${APP}: the disambiguation offer does not use the opportunity-disambiguate checkinKey`)
check(offerBlock.includes('JSON.stringify({originalCheckinKey,data,targetId:m.id})'),
  `${APP}: each disambiguation button does not carry the original checkinKey, the original data payload, and a concrete targetId forward -- without all three the tap could not replay the blocked action`)
check(offerBlock.includes("{label:'Never mind',value:'dismiss'}"),
  `${APP}: the disambiguation offer has no graceful way to bail out`)

// All seven mechanisms call the shared resolver and handle 'ambiguous' --
// not just resolve differently, but actually branch on the new state.
for (const key of ['pursuit-update','opportunity-update','op-card-rework','opportunity-context','opportunity-archive','close-reason','interview-team']) {
  const branchIdx = app.indexOf(`if(checkinKey==='${key}'){`)
  check(branchIdx !== -1, `${APP}: the checkinKey==='${key}' branch is missing`)
  const branch = branchIdx !== -1 ? app.slice(branchIdx, branchIdx + 1000) : ''
  check(branch.includes('resolveOpportunityByName(activePlaybooks,data.opportunity)'),
    `${APP}: ${key} does not resolve through the shared resolveOpportunityByName`)
  check(new RegExp(`if\\(resolved\\.status==='ambiguous'\\)return buildDisambiguationOffer\\('${key}',data,resolved\\.matches\\)`).test(branch),
    `${APP}: ${key} does not return a disambiguation offer on an ambiguous resolution -- it would fall through to guessing`)
}

// opportunity-archive is the one deliberate exception to the "fall back to
// whatever's on screen" pattern the other six use on 'absent' -- guessing
// which opportunity to ARCHIVE is worse than doing nothing. This asymmetry
// existed before the fix and must survive it.
const archiveIdx = app.indexOf("if(checkinKey==='opportunity-archive'){")
const archiveBlock = archiveIdx !== -1 ? app.slice(archiveIdx, archiveIdx + 400) : ''
check(archiveBlock.includes('if(!resolved.match)return false') && !archiveBlock.includes('coachSaveTarget()'),
  `${APP}: opportunity-archive should not fall back to coachSaveTarget() on an unresolved name -- archiving the wrong open opportunity by accident is worse than doing nothing`)

// The six mechanisms that DO fall back to whatever's currently on screen
// when a name genuinely didn't resolve -- unchanged behavior, just now
// reading resolved.match instead of a raw .find() result.
for (const key of ['pursuit-update','opportunity-update','opportunity-context','close-reason','interview-team']) {
  const branchIdx = app.indexOf(`if(checkinKey==='${key}'){`)
  const branch = branchIdx !== -1 ? app.slice(branchIdx, branchIdx + 1200) : ''
  check(branch.includes('(resolved.match&&resolved.match.id)||(tgt&&tgt.id)||null'),
    `${APP}: ${key} no longer falls back to coachSaveTarget() when the name does not resolve to anything -- this changes existing, intentional behavior`)
}
const reworkIdx = app.indexOf("if(checkinKey==='op-card-rework'){")
const reworkBranch = reworkIdx !== -1 ? app.slice(reworkIdx, reworkIdx + 2000) : ''
check(reworkBranch.includes("resolved.match||(tgt&&activePlaybooks.find(r=>r&&r.id===tgt.id))||null"),
  `${APP}: op-card-rework no longer falls back to coachSaveTarget() when the name does not resolve to anything`)

// Each mechanism's write logic lives in its own execX function -- the actual
// point of the refactor, since it is what lets a disambiguation tap replay
// the exact same write a unique-match tap would have made.
for (const fn of ['execPursuitUpdate','execOpportunityUpdate','execOpCardRework','execOpportunityContext','execOpportunityArchive','execCloseReason','execInterviewTeam']) {
  check(app.includes(`const ${fn}=`), `${APP}: ${fn} is missing`)
}

// The lookup table the disambiguation branch dispatches through, and the
// branch itself.
check(app.includes('const EXEC_BY_CHECKIN_KEY={'),
  `${APP}: EXEC_BY_CHECKIN_KEY is missing`)
const tableIdx = app.indexOf('const EXEC_BY_CHECKIN_KEY={')
const tableBlock = tableIdx !== -1 ? app.slice(tableIdx, tableIdx + 400) : ''
for (const [key, fn] of [
  ['pursuit-update','execPursuitUpdate'],
  ['opportunity-update','execOpportunityUpdate'],
  ['op-card-rework','execOpCardRework'],
  ['opportunity-context','execOpportunityContext'],
  ['opportunity-archive','execOpportunityArchive'],
  ['close-reason','execCloseReason'],
  ['interview-team','execInterviewTeam'],
]) {
  check(tableBlock.includes(`'${key}':${fn},`), `${APP}: EXEC_BY_CHECKIN_KEY is missing '${key}':${fn}`)
}

const disambigIdx = app.indexOf("if(checkinKey==='opportunity-disambiguate'){")
check(disambigIdx !== -1, `${APP}: the opportunity-disambiguate branch is missing`)
const disambigBlock = disambigIdx !== -1 ? app.slice(disambigIdx, disambigIdx + 400) : ''
check(disambigBlock.includes("if(value==='dismiss')return true"),
  `${APP}: opportunity-disambiguate does not handle 'Never mind' as a plain dismiss`)
check(disambigBlock.includes('let payload;try{payload=JSON.parse(value)}catch{return false}'),
  `${APP}: opportunity-disambiguate does not fail safely on a malformed payload`)
check(disambigBlock.includes("const fn=EXEC_BY_CHECKIN_KEY[payload&&payload.originalCheckinKey]") && disambigBlock.includes('if(!fn||!payload.targetId)return false'),
  `${APP}: opportunity-disambiguate does not validate the original checkinKey and targetId before dispatching -- an unrecognized key or missing id should fail safely, not throw`)
check(disambigBlock.includes('return await fn(payload.data,payload.targetId)'),
  `${APP}: opportunity-disambiguate does not dispatch to the resolved exec function with a known targetId`)

if (failures) {
  console.error(`test-coach-opportunity-resolution: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-coach-opportunity-resolution: OK (shared 3-state resolver replaces first-match .find() at all 7 call sites, ambiguous resolution offers a one-tap disambiguation rather than guessing, opportunity-archive keeps its no-fallback exception, the other 6 keep their coachSaveTarget() fallback, each mechanism\'s write logic lives in one execX function shared by both the unique-match and disambiguation-tap paths)')
}
