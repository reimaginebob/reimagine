// Guards finding #4.2 from the 2026-09-07 My Coach diagnostic review
// (independently verified before this fix): execOpportunityUpdate computed
// `removed` INSIDE the updater function passed to updateOpPanel, which is a
// setSavedPlaybooks(prev=>...) call -- React defers running that updater
// past this function's own synchronous return, so `removed`, read
// immediately after calling updateOpPanel to build the confirmation
// message, was always still empty. "Interview Team no longer includes X"
// could never render, and a removal-only payload (no other patch fields)
// made `landed` empty, so the function incorrectly returned false even
// though the removal itself was queued and would apply on the next render.
import fs from 'node:fs'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

const APP = 'src/App.jsx'
const app = fs.readFileSync(APP, 'utf8')

const fnIdx = app.indexOf('const execOpportunityUpdate=(data,targetId)=>{')
check(fnIdx !== -1, `${APP}: could not find execOpportunityUpdate`)
const fnBlock = fnIdx !== -1 ? app.slice(fnIdx, fnIdx + 2200) : ''

// `removed` must be computed BEFORE the updateOpPanel call, against the
// record already in hand -- not inside the deferred updater.
const removedIdx = fnBlock.indexOf('const removed=')
const updateOpPanelIdx = fnBlock.indexOf('updateOpPanel(targetId,p=>{')
check(removedIdx !== -1 && updateOpPanelIdx !== -1 && removedIdx < updateOpPanelIdx,
  `${APP}: execOpportunityUpdate no longer computes \`removed\` synchronously before calling updateOpPanel`)
check(fnBlock.includes('const currentInterviewers=getOpPanel(savedRec).interviewers'),
  `${APP}: \`removed\` is not computed against the current record via getOpPanel(savedRec) -- this is what makes it synchronous`)
check(!fnBlock.includes('let removed=[]') && !fnBlock.slice(updateOpPanelIdx, updateOpPanelIdx + 300).includes('removed.push'),
  `${APP}: execOpportunityUpdate still mutates \`removed\` inside updateOpPanel's deferred updater -- this is the exact bug being fixed`)

// savedRec (needed for getOpPanel) must be looked up before it's used for
// currentInterviewers, i.e. before the removed computation.
const savedRecIdx = fnBlock.indexOf('const savedRec=activePlaybooks.find')
check(savedRecIdx !== -1 && savedRecIdx < removedIdx,
  `${APP}: savedRec is not looked up before it is used to compute \`removed\``)

// The updater itself now filters using the precomputed removeKeys rather
// than re-deriving hit/removed state inline.
check(fnBlock.includes('const removeKeys=removePeople.map(n=>n.trim().toLowerCase())'),
  `${APP}: removeKeys is missing -- both the removed-name lookup and the updater's filter should share one lowercase-name set`)
check(fnBlock.slice(updateOpPanelIdx, updateOpPanelIdx + 300).includes('!removeKeys.includes(String(iv.name||\'\').trim().toLowerCase())'),
  `${APP}: the updateOpPanel updater no longer filters interviewers using the precomputed removeKeys`)

if (failures) {
  console.error(`test-coach-opportunity-update-removal-fix: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-coach-opportunity-update-removal-fix: OK (removed names are computed synchronously against the current record, so a removal-only update can confirm and "Interview Team no longer includes X" can actually render)')
}
