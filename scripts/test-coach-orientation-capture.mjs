// Guards Orientation field capture (2026-09-06): the structured-capture gap
// audit's items #1 and #2 -- Reputation and Skills are onboarding screens
// people naturally talk about mid-conversation ("my manager calls me first
// when something's on fire," "I'm also Six Sigma certified"), but Coach had
// no way to write either from chat, only to react to what was already on
// the screen. Same one-tap capture contract as every other capture note in
// api/coach.js: the model proposes on a hidden trailer, the server validates
// and ships it on a header, the client shows exactly what will be
// saved/added, the person taps, the tap writes.
//
// Gated behind a new flag rather than shipped ungated like their closest
// siblings (VALUES_CAPTURE_NOTE, ASSESSMENT_CAPTURE_NOTE): those two predate
// CLAUDE.md's current "every new capability ships behind a flag, Bob sees it
// first, no exceptions" rule. This test does not check for that exemption.
import fs from 'node:fs'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

const FLAGS = 'api/_lib/feature-flags.js'
const flags = fs.readFileSync(FLAGS, 'utf8')

check(flags.includes("export const ORIENTATION_CAPTURE_FLAG = 'orientation_capture'"),
  `${FLAGS}: ORIENTATION_CAPTURE_FLAG is missing`)
check(/export function hasOrientationCapture\(user\) \{\s*if \(isInternalAccount\(user\)\) return true/.test(flags),
  `${FLAGS}: hasOrientationCapture does not auto-grant internal accounts like its sibling pilot flags`)
check(flags.includes("[ORIENTATION_CAPTURE_FLAG]: { label:"),
  `${FLAGS}: ORIENTATION_CAPTURE_FLAG has no GRANTABLE_FLAGS entry, so it cannot be granted to a named outside tester from the admin dashboard`)

const COACH = 'api/coach.js'
const coach = fs.readFileSync(COACH, 'utf8')

check(/import \{[^}]*hasOrientationCapture[^}]*\} from '\.\/_lib\/feature-flags\.js'/.test(coach),
  `${COACH}: hasOrientationCapture is not imported`)

// The two capture notes themselves: Reputation replaces for its three
// single-fact fields (memory/emergency/twoWords), but merges rather than
// drops for `other`, which can accumulate like Values' lists (2026-09-06
// merge-not-overwrite fix). Skills appends (like Assessment -- resume/
// LinkedIn extraction may already hold real chips this conversation never
// mentioned).
check(coach.includes('const REPUTATION_CAPTURE_NOTE ='),
  `${COACH}: REPUTATION_CAPTURE_NOTE is missing`)
check(coach.includes('REPUTATIONCAPTURE: {"memory":'),
  `${COACH}: REPUTATION_CAPTURE_NOTE's trailer contract is missing or has drifted from the four Reputation fields`)
check(coach.includes('write the new answer alone once they have clearly landed on it, since it is meant to supersede whatever was there before'),
  `${COACH}: REPUTATION_CAPTURE_NOTE does not tell the model memory/emergency/twoWords are single-answer replacements`)
check(coach.includes('write the COMPLETE list -- what was already there plus what is new -- never just today'),
  `${COACH}: REPUTATION_CAPTURE_NOTE's \`other\` field does not require merging with existing content -- a person adding a second reputation note could lose the first`)

check(coach.includes('const SKILLS_CAPTURE_NOTE ='),
  `${COACH}: SKILLS_CAPTURE_NOTE is missing`)
check(coach.includes('SKILLSCAPTURE: {"technical":["SQL","Tableau"]'),
  `${COACH}: SKILLS_CAPTURE_NOTE's trailer contract is missing or has drifted`)
check(coach.includes('the tap ADDS to what is already there, never replaces it'),
  `${COACH}: SKILLS_CAPTURE_NOTE does not tell the model this adds rather than replaces -- resume/LinkedIn extraction may already hold real chips`)

// Gating: computed once from the flag, spliced into BOTH profile-slice
// templates (empty-profile and main), same as VALUES/ASSESSMENT above it.
check(coach.includes('const orientationCaptureOn = hasOrientationCapture({ feature_flags: featureFlags, email: userEmail })'),
  `${COACH}: orientationCaptureOn is not computed from hasOrientationCapture`)
check(coach.includes("const reputationCaptureNote = orientationCaptureOn ? REPUTATION_CAPTURE_NOTE : ''"),
  `${COACH}: reputationCaptureNote is not gated on orientationCaptureOn`)
check(coach.includes("const skillsCaptureNote = orientationCaptureOn ? SKILLS_CAPTURE_NOTE : ''"),
  `${COACH}: skillsCaptureNote is not gated on orientationCaptureOn`)
check(coach.includes('${VALUES_CAPTURE_NOTE}${ASSESSMENT_CAPTURE_NOTE}${reputationCaptureNote}${skillsCaptureNote}${prioritiesCaptureNote}${lifeStoryCaptureNote}${ORIENTATION_LISTENING_NOTE}`'),
  `${COACH}: reputationCaptureNote/skillsCaptureNote are not appended in the empty-profile template`)
check(/\$\{VALUES_CAPTURE_NOTE\}\$\{ASSESSMENT_CAPTURE_NOTE\}\$\{reputationCaptureNote\}\$\{skillsCaptureNote\}\$\{prioritiesCaptureNote\}\$\{lifeStoryCaptureNote\}\$\{searchIntakeNoteThisTurn\}/.test(coach),
  `${COACH}: reputationCaptureNote/skillsCaptureNote are not appended in the main profile-slice template`)

// Trailer parsing: validated and capped, same discipline as every sibling.
check(coach.includes("extractTrailer(strippedText, 'REPUTATIONCAPTURE')"),
  `${COACH}: the REPUTATIONCAPTURE trailer parser is missing`)
check(coach.includes("extractTrailer(strippedText, 'SKILLSCAPTURE')"),
  `${COACH}: the SKILLSCAPTURE trailer parser is missing`)
check(coach.includes("for (const cat of ['technical', 'systems', 'certifications', 'languages', 'methodologies']) {"),
  `${COACH}: the SKILLSCAPTURE parser does not validate against the fixed five-category enum`)
check(coach.includes("res.setHeader('X-Coach-Reputation', reputationB64)"),
  `${COACH}: the X-Coach-Reputation response header is not emitted`)
check(coach.includes("res.setHeader('X-Coach-Skills', skillsB64)"),
  `${COACH}: the X-Coach-Skills response header is not emitted`)

const CHAT = 'src/components/Chat.jsx'
const chat = fs.readFileSync(CHAT, 'utf8')

check(chat.includes('reputationCaptureActive = false, skillsCaptureActive = false'),
  `${CHAT}: reputationCaptureActive/skillsCaptureActive props are missing from Chat's destructured props`)
check(chat.includes("res.headers.get('X-Coach-Reputation')") && chat.includes("res.headers.get('X-Coach-Skills')"),
  `${CHAT}: Chat does not read both the X-Coach-Reputation and X-Coach-Skills headers`)
// Batch item 17 (2026-09-10): merged onto the reply's own bubble via
// mergeOfferOntoReply(content, checkinKey, quickReplies); checkinKey is the
// second positional argument now, not an object key.
check(chat.includes("'reputation-capture', [") && chat.includes('It replaces whatever is in the'),
  `${CHAT}: the reputation-capture one-tap offer is missing or does not warn it replaces`)
check(chat.includes("'skills-capture', [") && chat.includes('It adds to whatever is already there'),
  `${CHAT}: the skills-capture one-tap offer is missing or does not say it adds rather than replaces`)

const APP = 'src/App.jsx'
const app = fs.readFileSync(APP, 'utf8')

check(/const hasOrientationCapture=/.test(app),
  `${APP}: hasOrientationCapture client-side flag mirror is missing`)
// Three mounts as of 2026-09-07 (myCoach embedded, the floating bubble, and
// the concierge orientation-flow embedded panel).
const reputationMountHits = (app.match(/reputationCaptureActive=\{!isDemo&&hasOrientationCapture\}/g) || []).length
check(reputationMountHits === 3,
  `${APP}: expected reputationCaptureActive={!isDemo&&hasOrientationCapture} at all three <Chat> mount sites, found ${reputationMountHits}`)
const skillsMountHits = (app.match(/skillsCaptureActive=\{!isDemo&&hasOrientationCapture\}/g) || []).length
check(skillsMountHits === 3,
  `${APP}: expected skillsCaptureActive={!isDemo&&hasOrientationCapture} at all three <Chat> mount sites, found ${skillsMountHits}`)

const repBranchIdx = app.indexOf("checkinKey==='reputation-capture'")
check(repBranchIdx !== -1, `${APP}: the checkinKey==='reputation-capture' branch is missing from handleEmploymentQuickReply`)
if (repBranchIdx !== -1) {
  const branch = app.slice(repBranchIdx, repBranchIdx + 500)
  check(branch.includes("rep('memory',data.memory)") && branch.includes("rep('twoWords',data.twoWords)"),
    `${APP}: the reputation-capture write does not route through rep(), the same setter the Reputation screen's own inputs use`)
  check(branch.includes('if(!isDemo&&outputs.p3&&!pbNeedsUpdate)setPbNeedsUpdate(true)'),
    `${APP}: the reputation-capture write does not set the Personal Brand staleness nudge, unlike its Values sibling which feeds the same RAW SIGNALS block`)
}

const skillsBranchIdx = app.indexOf("checkinKey==='skills-capture'")
check(skillsBranchIdx !== -1, `${APP}: the checkinKey==='skills-capture' branch is missing from handleEmploymentQuickReply`)
if (skillsBranchIdx !== -1) {
  const branch = app.slice(skillsBranchIdx, skillsBranchIdx + 900)
  check(branch.includes("const base=profile.skills||{technical:[],systems:[],certifications:[],languages:[],methodologies:[]}"),
    `${APP}: the skills-capture write does not fall back to the same empty-category shape the Skills screen itself uses`)
  check(/merged\.some\(e=>e\.toLowerCase\(\)===v\.toLowerCase\(\)\)/.test(branch),
    `${APP}: the skills-capture write does not de-dup case-insensitively -- a skill already listed could be added a second time with different casing`)
  check(branch.includes("pr('skills',next)"),
    `${APP}: the skills-capture write does not call pr('skills', ...) to persist the merged categories`)
}

if (failures) {
  console.error(`test-coach-orientation-capture: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-coach-orientation-capture: OK (flag + GRANTABLE_FLAGS entry, Reputation replace / Skills append semantics, trailer/header wired for both, gated in both profile-slice templates, client offers wired at both Chat mounts, write paths route through rep()/pr(\'skills\') with case-insensitive de-dup)')
}
