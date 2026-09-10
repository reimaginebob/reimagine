// Guards Assessment capture: someone who does not have a full assessment
// report often still remembers real pieces of it (CliftonStrengths themes, a
// type, specific traits). Before this, the only thing Coach could do with
// that was tell them to go retype it themselves into the field on the
// Assessment screen -- the same redirect-instead-of-act gap the brand-rework
// bridge closed for Personal Brand. Reported live, caught for this field too.
// Same one-tap capture contract as its siblings (Values, Pipeline, Interview
// Team, Activity): model proposes on a hidden trailer, server validates and
// ships it on a header, client shows exactly what will be added, the person
// taps, the tap writes. Source-level for the same reason its siblings are.
import fs from 'node:fs'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

const COACH = 'api/coach.js'
const coach = fs.readFileSync(COACH, 'utf8')

check(coach.includes('const ASSESSMENT_CAPTURE_NOTE ='),
  `${COACH}: ASSESSMENT_CAPTURE_NOTE is missing`)
check(coach.includes('never your interpretation or elaboration of what those results mean'),
  `${COACH}: ASSESSMENT_CAPTURE_NOTE lost its guard against writing interpretation into the saved text -- the reply can interpret, but what gets saved must stay factual`)
check(coach.includes('never for a vague self-description with no named instrument or result'),
  `${COACH}: ASSESSMENT_CAPTURE_NOTE lost its guard against capturing an unfounded self-description ("I think I am strategic" alone)`)
check(coach.includes('appended to whatever is already in the field, never overwriting it'),
  `${COACH}: ASSESSMENT_CAPTURE_NOTE no longer tells the model the offer adds rather than replaces -- someone may already have real assessment content saved`)

// assessType fix (2026-09-06): the capture wrote prose into pr.assess but
// never set pr.assessType even when the model named the instrument, so the
// screen showed "no assessment named" next to text that clearly named one.
// ASSESSMENT_TYPES must be the Assessment screen's own dropdown values
// verbatim (src/App.jsx:13529), since a validated value drops straight into
// the <select> with no separate mapping step.
check(coach.includes("const ASSESSMENT_TYPES = ['Affintus', 'CliftonStrengths', 'DiSC', 'Myers-Briggs (MBTI)', 'Hogan', 'Predictive Index', 'Enneagram', 'Other']"),
  `${COACH}: ASSESSMENT_TYPES is missing or has drifted from the Assessment screen's own dropdown options`)
check(coach.includes('"text":"CliftonStrengths (remembered, not full report): Strategic, Belief, Activator","assessType":"CliftonStrengths"'),
  `${COACH}: ASSESSMENT_CAPTURE_NOTE's example trailer no longer shows the model the assessType field`)
check(coach.includes('omit the key entirely rather than guessing when it does not clearly match one of these'),
  `${COACH}: ASSESSMENT_CAPTURE_NOTE does not tell the model to omit assessType rather than force an unlisted instrument into the enum`)

// Unflagged, like its direct siblings (Values, Pipeline, Interview Team,
// Activity) -- this is a one-tap convenience on a field the person could
// already edit directly themselves, not a new surface needing Bob's QC
// before wider rollout.
check(coach.includes('${VALUES_CAPTURE_NOTE}${ASSESSMENT_CAPTURE_NOTE}'),
  `${COACH}: ASSESSMENT_CAPTURE_NOTE is not appended in the main profile-slice template beside VALUES_CAPTURE_NOTE`)
check(coach.includes('clicking to it.${VALUES_CAPTURE_NOTE}${ASSESSMENT_CAPTURE_NOTE}'),
  `${COACH}: ASSESSMENT_CAPTURE_NOTE is not appended in the no-profile-yet template as well -- someone on Assessment before Personal Brand exists would get no instruction at all`)

check(coach.includes("extractTrailer(strippedText, 'ASSESSMENTCAPTURE')"),
  `${COACH}: the ASSESSMENTCAPTURE: trailer parser is missing`)
check(coach.includes('const assessType = ASSESSMENT_TYPES.includes(parsed && parsed.assessType) ? parsed.assessType : \'\''),
  `${COACH}: the assessType value is not validated against ASSESSMENT_TYPES before being shipped to the client -- an invented value could reach the dropdown`)
check(coach.includes("assessmentB64 = Buffer.from(JSON.stringify({ text, assessType })).toString('base64')"),
  `${COACH}: assessType is not included in the assessment-capture header payload`)
check(coach.includes("res.setHeader('X-Coach-Assessment', assessmentB64)"),
  `${COACH}: the X-Coach-Assessment response header is no longer emitted`)

const CHAT = 'src/components/Chat.jsx'
const chat = fs.readFileSync(CHAT, 'utf8')

check(chat.includes('assessmentCaptureActive = false'),
  `${CHAT}: the assessmentCaptureActive prop is missing from Chat's destructured props`)
check(chat.includes("res.headers.get('X-Coach-Assessment')"),
  `${CHAT}: Chat no longer reads the X-Coach-Assessment header`)
// Batch item 17 (2026-09-10): merged onto the reply's own bubble via
// mergeOfferOntoReply(content, checkinKey, quickReplies); checkinKey is the
// second positional argument now, not an object key.
check(chat.includes("'assessment-capture', [") && chat.includes("label: 'Add it'"),
  `${CHAT}: the assessment-capture one-tap offer (checkinKey + confirm button) is missing`)
check(chat.includes('It adds to whatever is already there'),
  `${CHAT}: the assessment-capture offer no longer tells the person it adds rather than replaces`)

const APP = 'src/App.jsx'
const app = fs.readFileSync(APP, 'utf8')

// All three <Chat> mount points must pass the prop, or the capture works on
// some surfaces and silently not others. Three as of 2026-09-07: the
// embedded myCoach panel, the floating bubble, and the concierge
// orientation-flow embedded panel.
const mountHits = (app.match(/assessmentCaptureActive=\{!isDemo\}/g) || []).length
check(mountHits === 3,
  `${APP}: expected assessmentCaptureActive={!isDemo} passed at all three <Chat> call sites -- found ${mountHits}`)

// The write path: mirrors the exact divider shape the "+ Add another
// assessment" button and the file-upload path on that screen already use
// (both start from profile.assess, trim, append a "=== label ===" divider
// only when there is existing content), so a chat-captured entry reads as
// one more item in the same list, not a different mechanism. And it must
// APPEND (pr('assess', existing + ... + text)), never call pr('assess', text)
// alone, which would silently overwrite real assessment content already
// there.
const branchIdx = app.indexOf("checkinKey==='assessment-capture'")
check(branchIdx !== -1, `${APP}: the checkinKey==='assessment-capture' branch is missing from handleEmploymentQuickReply`)
const branchBlock = app.slice(branchIdx, branchIdx + 550)
check(branchBlock.includes('const existing=profile.assess'),
  `${APP}: the assessment-capture write no longer reads the existing profile.assess value before writing -- it would overwrite instead of append`)
check(branchBlock.includes("pr('assess',(existing.trim()?existing.trim()+divider:divider.trimStart())+text)"),
  `${APP}: the assessment-capture write no longer appends with the same trim/divider shape as the screen's own "+ Add another assessment" button`)
check(branchBlock.includes("if(data.assessType&&!profile.assessType)pr('assessType',data.assessType)"),
  `${APP}: the assessment-capture write does not set assessType -- or does not guard against overriding a value the person already chose themselves`)

if (failures) {
  console.error(`test-assessment-capture: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-assessment-capture: OK (capture note unflagged like its siblings and present in both profile-slice templates, factual-not-interpretive guard, trailer/header wired, one-tap offer names the add-not-replace behavior, write path appends using the screen\'s own divider shape at both Chat mounts)')
}
