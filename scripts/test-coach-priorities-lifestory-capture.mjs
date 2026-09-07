// Guards Priorities & Life Story capture (2026-09-06), the second half of
// the structured-capture gap audit: Bob caught that the original audit
// surfaced these two screens but I'd deferred both on an unverified guess
// (calling compFloor/workReq "structured/numeric fields a slider or
// dropdown sets" without checking -- they're plain text inputs) and an
// overcautious read of Life Story (assumed it might behave like a resume
// upload; the screen's own mic button already appends dictated speech onto
// it, proving the product treats it as an accumulating narrative, the same
// shape as Reputation's `other`). Both screens turned out to fit cleanly
// once actually checked.
//
// Three semantics on one screen (Priorities), because the fields are three
// different shapes: compFloor/workReq replace (single free-text answers,
// like Reputation's memory/emergency/twoWords); benefitsWeight/
// riskTolerance validate against the screen's own fixed segToggle values
// (same discipline as the assessType fix); dealBreakers merges rather than
// overwrites, built merge-safe from the start this time instead of needing
// a follow-up fix like Values did. Life Story is straightforward append,
// like Assessment.
//
// Gated on the same hasOrientationCapture flag as Reputation/Skills --
// same underlying idea (extending capture to another onboarding screen),
// not a new risk class needing its own flag.
import fs from 'node:fs'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

const COACH = 'api/coach.js'
const coach = fs.readFileSync(COACH, 'utf8')

// The two capture notes and their enums.
check(coach.includes('const BENEFITS_WEIGHT_VALUES = [\'Not much\', \'Somewhat\', \'A lot\']'),
  `${COACH}: BENEFITS_WEIGHT_VALUES is missing or has drifted from the Priorities screen's own segToggle options`)
check(coach.includes('const RISK_TOLERANCE_VALUES = [\'Stability\', \'Balanced\', \'Upside\']'),
  `${COACH}: RISK_TOLERANCE_VALUES is missing or has drifted from the Priorities screen's own segToggle options`)
check(coach.includes('const PRIORITIES_CAPTURE_NOTE ='),
  `${COACH}: PRIORITIES_CAPTURE_NOTE is missing`)
check(coach.includes('PRIORITIESCAPTURE: {"compFloor":'),
  `${COACH}: PRIORITIES_CAPTURE_NOTE's trailer contract is missing or has drifted`)
check(coach.includes('each REPLACES whatever is there, since a newly stated preference supersedes the old one rather than adding to it'),
  `${COACH}: PRIORITIES_CAPTURE_NOTE does not tell the model compFloor/workReq are single-answer replacements`)
check(coach.includes('omit the key entirely rather than guessing when it does not clearly match one of these'),
  `${COACH}: PRIORITIES_CAPTURE_NOTE does not tell the model to omit benefitsWeight/riskTolerance rather than force an unlisted value into the enum`)
check(coach.includes('write the COMPLETE current list -- what was already there plus what is new -- never just today'),
  `${COACH}: PRIORITIES_CAPTURE_NOTE's dealBreakers field does not require merging with existing content -- built merge-unsafe would repeat the exact Values bug`)

check(coach.includes('const LIFE_STORY_CAPTURE_NOTE ='),
  `${COACH}: LIFE_STORY_CAPTURE_NOTE is missing`)
check(coach.includes('LIFESTORYCAPTURE: {"text":'),
  `${COACH}: LIFE_STORY_CAPTURE_NOTE's trailer contract is missing or has drifted`)
check(coach.includes('appended to whatever is already there as a new paragraph, never overwriting it'),
  `${COACH}: LIFE_STORY_CAPTURE_NOTE does not tell the model this appends rather than replaces`)

// Gating: computed once, spliced into BOTH profile-slice templates.
check(coach.includes("const prioritiesCaptureNote = orientationCaptureOn ? PRIORITIES_CAPTURE_NOTE : ''"),
  `${COACH}: prioritiesCaptureNote is not gated on orientationCaptureOn`)
check(coach.includes("const lifeStoryCaptureNote = orientationCaptureOn ? LIFE_STORY_CAPTURE_NOTE : ''"),
  `${COACH}: lifeStoryCaptureNote is not gated on orientationCaptureOn`)
check(coach.includes('${reputationCaptureNote}${skillsCaptureNote}${prioritiesCaptureNote}${lifeStoryCaptureNote}`'),
  `${COACH}: prioritiesCaptureNote/lifeStoryCaptureNote are not appended in the empty-profile template`)
check(/\$\{reputationCaptureNote\}\$\{skillsCaptureNote\}\$\{prioritiesCaptureNote\}\$\{lifeStoryCaptureNote\}\$\{searchIntakeNoteThisTurn\}/.test(coach),
  `${COACH}: prioritiesCaptureNote/lifeStoryCaptureNote are not appended in the main profile-slice template`)

// Trailer parsing: validated and capped.
check(/const prioritiesMatch = strippedText\.match\(\/\^\\s\*PRIORITIESCAPTURE:/.test(coach),
  `${COACH}: the PRIORITIESCAPTURE trailer parser is missing`)
check(coach.includes('BENEFITS_WEIGHT_VALUES.includes(parsed && parsed.benefitsWeight)'),
  `${COACH}: benefitsWeight is not validated against BENEFITS_WEIGHT_VALUES before being shipped to the client`)
check(coach.includes('RISK_TOLERANCE_VALUES.includes(parsed && parsed.riskTolerance)'),
  `${COACH}: riskTolerance is not validated against RISK_TOLERANCE_VALUES before being shipped to the client`)
check(/const lifeStoryMatch = strippedText\.match\(\/\^\\s\*LIFESTORYCAPTURE:/.test(coach),
  `${COACH}: the LIFESTORYCAPTURE trailer parser is missing`)
check(coach.includes("res.setHeader('X-Coach-Priorities', prioritiesB64)"),
  `${COACH}: the X-Coach-Priorities response header is not emitted`)
check(coach.includes("res.setHeader('X-Coach-Life-Story', lifeStoryB64)"),
  `${COACH}: the X-Coach-Life-Story response header is not emitted`)

const CHAT = 'src/components/Chat.jsx'
const chat = fs.readFileSync(CHAT, 'utf8')

check(chat.includes('prioritiesCaptureActive = false, lifeStoryCaptureActive = false'),
  `${CHAT}: prioritiesCaptureActive/lifeStoryCaptureActive props are missing from Chat's destructured props`)
check(chat.includes("res.headers.get('X-Coach-Priorities')") && chat.includes("res.headers.get('X-Coach-Life-Story')"),
  `${CHAT}: Chat does not read both the X-Coach-Priorities and X-Coach-Life-Story headers`)
check(chat.includes("checkinKey: 'priorities-capture'") && chat.includes('It replaces whatever is in the'),
  `${CHAT}: the priorities-capture one-tap offer is missing or does not warn it replaces`)
check(chat.includes("checkinKey: 'life-story-capture'") && chat.includes("It adds a new paragraph to what's already there"),
  `${CHAT}: the life-story-capture one-tap offer is missing or does not say it adds a paragraph rather than replacing`)

const APP = 'src/App.jsx'
const app = fs.readFileSync(APP, 'utf8')

// Three mounts as of 2026-09-07 (myCoach embedded, the floating bubble, and
// the concierge orientation-flow embedded panel).
const prioritiesMountHits = (app.match(/prioritiesCaptureActive=\{!isDemo&&hasOrientationCapture\}/g) || []).length
check(prioritiesMountHits === 3,
  `${APP}: expected prioritiesCaptureActive={!isDemo&&hasOrientationCapture} at all three <Chat> mount sites, found ${prioritiesMountHits}`)
const lifeStoryMountHits = (app.match(/lifeStoryCaptureActive=\{!isDemo&&hasOrientationCapture\}/g) || []).length
check(lifeStoryMountHits === 3,
  `${APP}: expected lifeStoryCaptureActive={!isDemo&&hasOrientationCapture} at all three <Chat> mount sites, found ${lifeStoryMountHits}`)

const prioritiesBranchIdx = app.indexOf("checkinKey==='priorities-capture'")
check(prioritiesBranchIdx !== -1, `${APP}: the checkinKey==='priorities-capture' branch is missing from handleEmploymentQuickReply`)
if (prioritiesBranchIdx !== -1) {
  const branch = app.slice(prioritiesBranchIdx, prioritiesBranchIdx + 700)
  check(branch.includes("pr('compFloor',data.compFloor)") && branch.includes("pr('benefitsWeight',data.benefitsWeight)") && branch.includes("pr('dealBreakers',data.dealBreakers)"),
    `${APP}: the priorities-capture write does not route every field through pr(), the same setters the screen's own inputs use`)
}

const lifeStoryBranchIdx = app.indexOf("checkinKey==='life-story-capture'")
check(lifeStoryBranchIdx !== -1, `${APP}: the checkinKey==='life-story-capture' branch is missing from handleEmploymentQuickReply`)
if (lifeStoryBranchIdx !== -1) {
  const branch = app.slice(lifeStoryBranchIdx, lifeStoryBranchIdx + 400)
  check(branch.includes("const existing=profile.lifeEvents"),
    `${APP}: the life-story-capture write does not read the existing profile.lifeEvents value before writing -- it would overwrite instead of append`)
  check(/pr\('lifeEvents',existing\.trim\(\)\?existing\.trim\(\)\+'\\n\\n'\+text:text\)/.test(branch),
    `${APP}: the life-story-capture write does not append a new paragraph the same way the screen's own mic button does`)
}

if (failures) {
  console.error(`test-coach-priorities-lifestory-capture: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-coach-priorities-lifestory-capture: OK (three semantics on Priorities -- replace/enum/merge -- Life Story append, both gated on hasOrientationCapture in both profile-slice templates, trailer/header wired, client offers and write paths wired at both Chat mounts)')
}
