// Guards Close Reason capture (2026-09-07) -- the account-level signal
// this session's deletion/retraction/close-flow conversation converged on:
// when an opportunity ends, Coach may ask once whether the person has any
// read on why, and log it as a bounded category plus their own words.
//
// The whole design turns on ONE split: `reason_code` is a fixed key from
// src/pursuit-close-reasons.js, the only thing this system is ever meant to
// look at in aggregate, across every account, on a later date (a
// deliberately separate build, not this one). `detail` is their own words,
// always per-account, never touched by that later aggregate. This test
// checks that split is real everywhere it needs to be, not just described
// in a comment.
//
// Gated on its OWN flag (close_reason_capture), not hasPipelineCapture --
// a materially different privacy posture than any other opportunity-data
// capture in this file, per hasCloseReasonCapture's own comment.
import fs from 'node:fs'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

// --- Taxonomy module ---
const TAXONOMY = 'src/pursuit-close-reasons.js'
const taxonomy = fs.readFileSync(TAXONOMY, 'utf8')

check(taxonomy.includes('export const CLOSE_REASON_CODES = ['),
  `${TAXONOMY}: CLOSE_REASON_CODES is missing`)
check(taxonomy.includes("export const INITIATED_BY_VALUES = ['employer', 'candidate', 'external', 'mutual', 'unknown']"),
  `${TAXONOMY}: INITIATED_BY_VALUES is missing or has drifted`)
// The final, confirmed 27-code list -- every code Bob and Cowork settled on
// across the taxonomy-design rounds, including the resolved near-duplicate
// splits and the renamed direction-ambiguous code.
const EXPECTED_CODES = [
  'insufficient_tenure', 'insufficient_domain_experience', 'insufficient_technical_depth',
  'overqualified', 'weak_interview_performance', 'failed_assessment_or_test',
  'compensation_mismatch', 'work_arrangement', 'relocation_required', 'start_date_or_notice_period_mismatch',
  'culture_or_team_fit', 'background_check_failed', 'reference_check_failed',
  'credential_or_certification_missing', 'work_authorization_or_visa',
  'role_filled_internally', 'internal_candidate_preferred', 'role_paused_or_cancelled', 'hiring_freeze',
  'lost_to_another_candidate', 'pursuing_other_opportunities', 'accepted_another_offer',
  'not_selected_no_reason_given', 'withdrew_no_reason_given',
  'ghosted', 'employer_non_responsive', 'other',
]
for (const code of EXPECTED_CODES) {
  check(taxonomy.includes(`'${code}'`), `${TAXONOMY}: missing expected code '${code}'`)
}
check(!taxonomy.includes("'declined_no_reason_given'"),
  `${TAXONOMY}: the old direction-ambiguous code (declined_no_reason_given) should have been renamed to not_selected_no_reason_given / withdrew_no_reason_given`)
check(!taxonomy.includes("'ghosted_no_response'") && taxonomy.includes("'ghosted'") && taxonomy.includes("'employer_non_responsive'"),
  `${TAXONOMY}: ghosted and employer_non_responsive should both exist as distinct codes`)
check(taxonomy.includes('export const CLOSE_REASON_LABEL'),
  `${TAXONOMY}: CLOSE_REASON_LABEL (used by the one-tap offer's confirmation text) is missing`)

// --- Migration ---
const migFile = fs.readdirSync('migrations').find(f => f.includes('pursuit-close-reasons'))
check(!!migFile, 'migrations/: no pursuit-close-reasons migration found')
if (migFile) {
  const mig = fs.readFileSync(`migrations/${migFile}`, 'utf8')
  check(/CREATE TABLE IF NOT EXISTS pursuit_close_reasons/.test(mig),
    `migrations/${migFile}: does not create pursuit_close_reasons`)
  check(/PRIMARY KEY \(user_id, record_id\)/.test(mig),
    `migrations/${migFile}: primary key is not (user_id, record_id) -- one row per opportunity is the design`)
  check(/REFERENCES users\(id\) ON DELETE CASCADE/.test(mig),
    `migrations/${migFile}: user_id should FK to users(id) ON DELETE CASCADE`)
  check(mig.includes("initiated_by") && mig.includes("DEFAULT 'unknown'"),
    `migrations/${migFile}: initiated_by should default to 'unknown', not NULL, so an aggregate query never special-cases a missing value`)
}

// --- Feature flag ---
const FLAGS = 'api/_lib/feature-flags.js'
const flags = fs.readFileSync(FLAGS, 'utf8')
check(flags.includes("export const CLOSE_REASON_CAPTURE_FLAG = 'close_reason_capture'"),
  `${FLAGS}: CLOSE_REASON_CAPTURE_FLAG is missing`)
check(/export function hasCloseReasonCapture\(user\) \{\s*if \(isInternalAccount\(user\)\) return true/.test(flags),
  `${FLAGS}: hasCloseReasonCapture does not auto-grant internal accounts like its sibling pilot flags`)
check(flags.includes('[CLOSE_REASON_CAPTURE_FLAG]: { label:'),
  `${FLAGS}: CLOSE_REASON_CAPTURE_FLAG has no GRANTABLE_FLAGS entry`)

// --- API endpoint ---
const ENDPOINT = 'api/pursuit-close-reason.js'
const endpoint = fs.readFileSync(ENDPOINT, 'utf8')
check(endpoint.includes("import { hasCloseReasonCapture } from './_lib/feature-flags.js'"),
  `${ENDPOINT}: does not import hasCloseReasonCapture`)
check(endpoint.includes('if (!hasCloseReasonCapture(user))'),
  `${ENDPOINT}: does not gate the write on hasCloseReasonCapture`)
check(endpoint.includes('CLOSE_REASON_CODES.includes(reasonCode)'),
  `${ENDPOINT}: does not validate reasonCode against the fixed taxonomy before writing -- an invented code would store cleanly and be read by nothing`)
check(endpoint.includes("INITIATED_BY_VALUES.includes(initiatedByRaw) ? initiatedByRaw : 'unknown'"),
  `${ENDPOINT}: does not default an invalid/missing initiatedBy to 'unknown'`)
check(/ON CONFLICT \(user_id, record_id\) DO UPDATE/.test(endpoint),
  `${ENDPOINT}: the upsert is not keyed on (user_id, record_id) -- a second close on the same opportunity should update, not duplicate or error`)
check(endpoint.includes("req.method !== 'PUT'"),
  `${ENDPOINT}: does not restrict to PUT`)

// --- api/coach.js ---
const COACH = 'api/coach.js'
const coach = fs.readFileSync(COACH, 'utf8')

check(coach.includes("import { CLOSE_REASON_CODES, INITIATED_BY_VALUES } from '../src/pursuit-close-reasons.js'"),
  `${COACH}: does not import the shared taxonomy`)
check(/import \{[^}]*hasCloseReasonCapture[^}]*\} from '\.\/_lib\/feature-flags\.js'/.test(coach),
  `${COACH}: hasCloseReasonCapture is not imported`)

check(coach.includes('const CLOSE_REASON_CAPTURE_NOTE ='),
  `${COACH}: CLOSE_REASON_CAPTURE_NOTE is missing`)
check(coach.includes('you may ask, once, gently, whether they have any read on why, even just a guess'),
  `${COACH}: CLOSE_REASON_CAPTURE_NOTE does not ask gently and only once`)
check(coach.includes('Frame it as something that helps THEM sharpen their story and positioning going forward, never as something you are collecting for its own sake'),
  `${COACH}: CLOSE_REASON_CAPTURE_NOTE does not frame the question around the person, not the product -- partnership, not self-interest`)
check(coach.includes('Never press: if they do not know, do not want to say, or change the subject, drop it'),
  `${COACH}: CLOSE_REASON_CAPTURE_NOTE does not tell the model to drop it rather than press -- this is a harder moment than most captures and needs that guard explicitly`)
check(coach.includes('CLOSEREASON: {"opportunity":'),
  `${COACH}: CLOSE_REASON_CAPTURE_NOTE's trailer contract is missing or has drifted`)
check(coach.includes('NEVER SAY YOU HAVE SAVED OR LOGGED IT'),
  `${COACH}: CLOSE_REASON_CAPTURE_NOTE does not forbid claiming the save before the tap`)

check(coach.includes('function buildCloseReasonAlreadyLoggedBlock(recordId, closeReasons)'),
  `${COACH}: buildCloseReasonAlreadyLoggedBlock is missing`)
check(/profileBlock \+= buildCloseReasonAlreadyLoggedBlock\(inFocus\.id, closeReasons\)/.test(coach),
  `${COACH}: the in-focus block does not splice the already-logged suppression in`)
check(coach.includes("CLOSE REASON ALREADY LOGGED FOR THIS OPPORTUNITY"),
  `${COACH}: the suppression text is missing or has drifted`)

check(coach.includes("const closeReasonNote = hasCloseReasonCapture({ feature_flags: featureFlags, email: userEmail }) ? CLOSE_REASON_CAPTURE_NOTE : ''"),
  `${COACH}: closeReasonNote is not gated on hasCloseReasonCapture (its own flag, not hasPipelineCapture)`)
check(coach.includes('${opportunityArchiveNote}${closeReasonNote}${opCardReworkNote}'),
  `${COACH}: closeReasonNote is not spliced into the profile-slice template`)

check(/export function buildCoachRequest\(\{[\s\S]{0,600}milestoneMentions, closeReasons,\s*\}\) \{/.test(coach),
  `${COACH}: buildCoachRequest does not accept closeReasons as a parameter`)
check(/closeReasons = await sql`SELECT record_id FROM pursuit_close_reasons WHERE user_id = \$\{user\.id\}`/.test(coach),
  `${COACH}: closeReasons is not read from pursuit_close_reasons, gated on hasCloseReasonCapture`)
check(/generalMode, milestoneMentions, closeReasons,\s*\}\)/.test(coach),
  `${COACH}: closeReasons is not passed into the buildCoachRequest call site`)

check(/const crMatch = strippedText\.match\(\/\^\\s\*CLOSEREASON:/.test(coach),
  `${COACH}: the CLOSEREASON trailer parser is missing`)
check(coach.includes('CLOSE_REASON_CODES.includes(parsed && parsed.reasonCode) ? parsed.reasonCode'),
  `${COACH}: a parsed reasonCode is not validated against CLOSE_REASON_CODES before being shipped to the client`)
check(coach.includes("res.setHeader('X-Coach-Close-Reason', closeReasonB64)"),
  `${COACH}: the X-Coach-Close-Reason response header is not emitted`)

// --- Chat.jsx ---
const CHAT = 'src/components/Chat.jsx'
const chat = fs.readFileSync(CHAT, 'utf8')
check(chat.includes("import { CLOSE_REASON_LABEL } from '../pursuit-close-reasons.js'"),
  `${CHAT}: does not import CLOSE_REASON_LABEL for the confirmation text`)
check(chat.includes('closeReasonCaptureActive = false'),
  `${CHAT}: closeReasonCaptureActive prop is missing from Chat's destructured props`)
check(chat.includes("const crHeader = res.headers.get('X-Coach-Close-Reason')"),
  `${CHAT}: Chat does not read the X-Coach-Close-Reason header`)
check(chat.includes("checkinKey: 'close-reason'"),
  `${CHAT}: the close-reason one-tap offer is missing`)
check(chat.includes('Category: ${label}') || chat.includes('Category: ') ,
  `${CHAT}: the close-reason offer does not show the category before the tap`)

// --- App.jsx ---
const APP = 'src/App.jsx'
const app = fs.readFileSync(APP, 'utf8')

check(/const hasCloseReasonCapture=/.test(app),
  `${APP}: hasCloseReasonCapture client-side flag mirror is missing`)
const mountHits = (app.match(/closeReasonCaptureActive=\{hasPipeline&&!isIndependent&&hasCloseReasonCapture\}/g) || []).length
check(mountHits === 2,
  `${APP}: expected closeReasonCaptureActive={hasPipeline&&!isIndependent&&hasCloseReasonCapture} at both <Chat> mount sites, found ${mountHits}`)

// One-time disclosure: state+ref pair, both hydration paths, autosave blob
// + dep array, and a distinct message from Notes' own disclosure.
check(app.includes('const[seenCloseReasonMention,setSeenCloseReasonMention]=useState(false)') && app.includes('const closeReasonMentionFiredRef=useRef(false)'),
  `${APP}: seenCloseReasonMention state/ref pair is missing`)
const hydrationHits = (app.match(/if\(d\.seenCloseReasonMention\)setSeenCloseReasonMention\(true\)/g) || []).length
check(hydrationHits === 2,
  `${APP}: seenCloseReasonMention is not threaded through both hydration paths (localStorage + server sync), found ${hydrationHits}`)
// Substring checks against the blob/deps neighborhood, not an exact-
// adjacency string -- later additions insert their own fields between
// these names, which would break a literal match anchored on today's
// exact ordering.
const crSaveBlobIdx = app.indexOf('const blob=JSON.stringify(')
check(app.slice(crSaveBlobIdx, crSaveBlobIdx + 700).includes('seenCloseReasonMention'),
  `${APP}: seenCloseReasonMention is missing from the autosave blob's JSON.stringify`)
const crSaveDepsIdx = app.indexOf('saveRef.current=save')
check(app.slice(crSaveDepsIdx, crSaveDepsIdx + 700).includes('seenCloseReasonMention'),
  `${APP}: seenCloseReasonMention is missing from the autosave effect's dependency array`)
check(app.includes('const closeReasonCapabilityMessage='),
  `${APP}: closeReasonCapabilityMessage is missing -- this needs its own disclosure text, distinct from Notes' "so you can find it again" framing`)
check(app.includes("doesn't work out, I may ask if you have any read on why, even just a guess"),
  `${APP}: the close-reason disclosure text is missing or has drifted`)

// The write path: awaits a real round trip and reports failure explicitly,
// same discipline as activity-facts -- a silent failure here would look
// exactly like a successful save.
const branchIdx = app.indexOf("checkinKey==='close-reason'")
check(branchIdx !== -1, `${APP}: the checkinKey==='close-reason' branch is missing from handleEmploymentQuickReply`)
if (branchIdx !== -1) {
  // The write itself lives in execCloseReason (2026-09-07, same-name
  // opportunity resolution fix) -- extracted out of this branch so a
  // disambiguation tap can call the same code a unique-match tap does.
  const execIdx = app.indexOf('const execCloseReason=')
  check(execIdx !== -1, `${APP}: execCloseReason is missing -- the close-reason write logic should live in its own function, shared with the disambiguation-tap path`)
  const branch = execIdx !== -1 ? app.slice(execIdx, execIdx + 900) : ''
  check(branch.includes("await fetch('/api/pursuit-close-reason'"),
    `${APP}: the close-reason write does not call the dedicated endpoint`)
  check(branch.includes("method:'PUT'"),
    `${APP}: the close-reason write is not a PUT`)
  check(branch.includes('if(!r.ok)throw new Error'),
    `${APP}: the close-reason write does not check response status -- a failed write could be reported as a success`)
  check(branch.includes('That did not save, so I have not recorded it'),
    `${APP}: the close-reason write does not report failure explicitly on a failed round trip`)
}

if (failures) {
  console.error(`test-coach-close-reason: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-coach-close-reason: OK (27-code taxonomy with the resolved near-duplicate splits and renamed ambiguous code, dedicated table + endpoint + own flag, request-adjacent capture note that frames the ask around the person and never presses, already-logged suppression, its own one-time disclosure distinct from Notes threaded through both hydration paths and the autosave blob, write path awaits and reports failure explicitly)')
}
