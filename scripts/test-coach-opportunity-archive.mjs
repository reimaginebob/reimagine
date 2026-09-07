// Guards opportunity archive-via-chat (2026-09-06, deletion/retraction Tier
// 1, item 3). Deliberately NOT a new delete path -- routes through
// deleteFromSavedSet, the exact function src/App.jsx's own "Remove from
// pipeline" button calls, so a chat-driven archive is exactly as reversible
// (90-day Archived hold, restorable) as the screen's own version of the same
// action. This is also a distinct action from an OPPORTUNITYUPDATE
// stage:"closed" -- closed tracks an OUTCOME, archive is a VISIBILITY
// action that can apply even to a still-open opportunity someone simply
// does not want to see anymore.
//
// Gated on hasPipelineCapture, the same flag as OPPORTUNITYUPDATE and
// OPPORTUNITYCONTEXT -- same underlying idea (opportunity data via chat),
// not a new risk class.
import fs from 'node:fs'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

const COACH = 'api/coach.js'
const coach = fs.readFileSync(COACH, 'utf8')

check(coach.includes('const OPPORTUNITY_ARCHIVE_CAPTURE_NOTE ='),
  `${COACH}: OPPORTUNITY_ARCHIVE_CAPTURE_NOTE is missing`)
check(coach.includes('OPPORTUNITYARCHIVE: {"opportunity":'),
  `${COACH}: OPPORTUNITY_ARCHIVE_CAPTURE_NOTE's trailer contract is missing or has drifted`)
check(coach.includes('never inferred from a stage change or a quiet mention alone, only from an actual ask to remove or stop tracking it'),
  `${COACH}: OPPORTUNITY_ARCHIVE_CAPTURE_NOTE does not restrict itself to an explicit request -- archiving must never be a judgment call the model volunteers`)
check(coach.includes('This does not delete anything: it archives the opportunity, and it stays recoverable from their Archived list for 90 days'),
  `${COACH}: OPPORTUNITY_ARCHIVE_CAPTURE_NOTE does not tell the model to be honest that this is reversible, not a delete`)
check(coach.includes('NEVER SAY YOU HAVE REMOVED OR ARCHIVED IT'),
  `${COACH}: OPPORTUNITY_ARCHIVE_CAPTURE_NOTE does not forbid claiming the action before the tap`)

check(coach.includes("const opportunityArchiveNote = hasPipelineCapture({ feature_flags: featureFlags, email: userEmail }) ? OPPORTUNITY_ARCHIVE_CAPTURE_NOTE : ''"),
  `${COACH}: opportunityArchiveNote is not gated on hasPipelineCapture, the same flag as its opportunity-data siblings`)
check(coach.includes('${opportunityUpdateNote}${opportunityContextNote}${opportunityArchiveNote}${closeReasonNote}${opCardReworkNote}'),
  `${COACH}: opportunityArchiveNote is not spliced into the profile-slice template alongside its siblings`)

check(/const oaMatch = strippedText\.match\(\/\^\\s\*OPPORTUNITYARCHIVE:/.test(coach),
  `${COACH}: the OPPORTUNITYARCHIVE trailer parser is missing`)
check(coach.includes("res.setHeader('X-Coach-Opportunity-Archive', opportunityArchiveB64)"),
  `${COACH}: the X-Coach-Opportunity-Archive response header is not emitted`)

const CHAT = 'src/components/Chat.jsx'
const chat = fs.readFileSync(CHAT, 'utf8')

check(chat.includes('opportunityArchiveCaptureActive = false'),
  `${CHAT}: opportunityArchiveCaptureActive prop is missing from Chat's destructured props`)
check(chat.includes("const oaHeader = res.headers.get('X-Coach-Opportunity-Archive')"),
  `${CHAT}: Chat does not read the X-Coach-Opportunity-Archive header`)
check(chat.includes("checkinKey: 'opportunity-archive'"),
  `${CHAT}: the opportunity-archive one-tap offer is missing`)
check(chat.includes('It moves to Archived, not gone — you can restore it any time in the next 90 days'),
  `${CHAT}: the opportunity-archive offer does not tell the person this is reversible before they tap`)

const APP = 'src/App.jsx'
const app = fs.readFileSync(APP, 'utf8')

const mountHits = (app.match(/opportunityArchiveCaptureActive=\{hasPipeline&&!isIndependent&&hasPipelineCapture\}/g) || []).length
check(mountHits === 2,
  `${APP}: expected opportunityArchiveCaptureActive={hasPipeline&&!isIndependent&&hasPipelineCapture} at both <Chat> mount sites, found ${mountHits}`)

const branchIdx = app.indexOf("checkinKey==='opportunity-archive'")
check(branchIdx !== -1, `${APP}: the checkinKey==='opportunity-archive' branch is missing from handleEmploymentQuickReply`)
if (branchIdx !== -1) {
  const branch = app.slice(branchIdx, branchIdx + 500)
  check(branch.includes("value==='dismiss'"),
    `${APP}: the opportunity-archive branch does not handle a decline ('Not now') as a no-op`)
  check(branch.includes('if(!resolved.match)return false'),
    `${APP}: an opportunity title that does not resolve to a real record does not fail safely`)
  // The write itself lives in execOpportunityArchive (2026-09-07, same-name
  // opportunity resolution fix) -- extracted out of this branch so a
  // disambiguation tap can call the same code a unique-match tap does.
  const execIdx = app.indexOf('const execOpportunityArchive=')
  check(execIdx !== -1, `${APP}: execOpportunityArchive is missing -- the opportunity-archive write logic should live in its own function, shared with the disambiguation-tap path`)
  const execBlock = execIdx !== -1 ? app.slice(execIdx, execIdx + 200) : ''
  check(execBlock.includes('deleteFromSavedSet(targetId)'),
    `${APP}: the opportunity-archive write does not route through deleteFromSavedSet -- the same reversible archive the screen's own "Remove from pipeline" button uses`)
}

if (failures) {
  console.error(`test-coach-opportunity-archive: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-coach-opportunity-archive: OK (own trailer distinct from stage:closed, gated on hasPipelineCapture, request-only, honest about reversibility, routes through the existing deleteFromSavedSet archive rather than a new delete path)')
}
