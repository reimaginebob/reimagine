// Guards list-item removal (2026-09-06, deletion/retraction Tier 1) --
// Values, Passions, Reputation's `other`, and dealBreakers all reuse their
// EXISTING "reconstruct the complete list" trailer with one more
// instruction (write the complete list minus the named item, on an explicit
// ask only); no new trailer, no new parsing, no new client code for those
// four, since the mechanism already treats the whole field as a replace.
//
// Skills is different and gets a genuinely separate SKILLSREMOVE trailer:
// the add path is deliberately append-only (resume/LinkedIn extraction may
// hold chips this conversation never mentioned, so the model is never asked
// to reconstruct a whole category), which means removal needs its own path
// that names exact items and filters the real array, rather than trusting
// a full reconstruction.
//
// Every removal is request-only -- never inferred from silence or a topic
// change, only from an explicit ask -- the same discipline this session's
// deletion scoping set as a cross-cutting rule for all of Tier 1.
import fs from 'node:fs'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

const COACH = 'api/coach.js'
const coach = fs.readFileSync(COACH, 'utf8')

// Values/Passions: reused trailer, instruction-only addition.
check(coach.includes('If they explicitly ask you to take one out ("drop Independence, that') && coach.includes('not really me anymore," "take Family off that list") — never inferred from silence or a change of subject, only from an actual ask to remove it — write the complete list without it, the same way you would write it with a new addition folded in.'),
  `${COACH}: VALUES_CAPTURE_NOTE does not support explicit, request-only list-item removal`)

// Reputation's `other`.
check(coach.includes('If they explicitly ask you to take one out of `other` -- never inferred, only from an actual ask -- write the complete list without it, same as VALUES CAPTURE.'),
  `${COACH}: REPUTATION_CAPTURE_NOTE's \`other\` field does not support explicit, request-only removal`)

// dealBreakers.
check(coach.includes('If they explicitly ask you to take one off the list -- never inferred, only from an actual ask -- write the complete list without it, same as VALUES CAPTURE.'),
  `${COACH}: PRIORITIES_CAPTURE_NOTE's dealBreakers field does not support explicit, request-only removal`)

// Skills: a real, separate mechanism.
check(coach.includes('If they explicitly ask you to take a skill off the list ("take Excel off my skills," "I let that certification lapse, remove it") -- never inferred, only from an actual ask -- end your reply instead with a final line exactly like SKILLSREMOVE:'),
  `${COACH}: SKILLS_CAPTURE_NOTE does not describe the SKILLSREMOVE trailer`)
check(coach.includes('Never emit both SKILLSCAPTURE and SKILLSREMOVE in the same reply.'),
  `${COACH}: SKILLS_CAPTURE_NOTE does not forbid emitting both trailers in one reply`)
check(/const skillsRemoveMatch = strippedText\.match\(\/\^\\s\*SKILLSREMOVE:/.test(coach),
  `${COACH}: the SKILLSREMOVE trailer parser is missing`)
check(coach.includes("res.setHeader('X-Coach-Skills-Remove', skillsRemoveB64)"),
  `${COACH}: the X-Coach-Skills-Remove response header is not emitted`)

const CHAT = 'src/components/Chat.jsx'
const chat = fs.readFileSync(CHAT, 'utf8')

check(chat.includes("const skillsRemoveHeader = res.headers.get('X-Coach-Skills-Remove') || null"),
  `${CHAT}: Chat does not read the X-Coach-Skills-Remove header`)
check(chat.includes("checkinKey: 'skills-remove'") && chat.includes("label: 'Remove it'"),
  `${CHAT}: the skills-remove one-tap offer (checkinKey + confirm button) is missing`)
// Deliberately reuses the SAME gate as the add offer -- one account
// eligibility governs both directions, not a separate prop.
check(/if \(skillsCaptureActive && skillsRemoveHeader\)/.test(chat),
  `${CHAT}: skills-remove is not gated on the same skillsCaptureActive prop the add offer uses`)

const APP = 'src/App.jsx'
const app = fs.readFileSync(APP, 'utf8')

const branchIdx = app.indexOf("checkinKey==='skills-remove'")
check(branchIdx !== -1, `${APP}: the checkinKey==='skills-remove' branch is missing from handleEmploymentQuickReply`)
if (branchIdx !== -1) {
  const branch = app.slice(branchIdx, branchIdx + 900)
  check(/const kept=existing\.filter\(e=>!remove\.includes\(String\(e\)\.trim\(\)\.toLowerCase\(\)\)\)/.test(branch),
    `${APP}: skills-remove does not filter the REAL current array case-insensitively -- this is the actual existence check named skills are validated against`)
  check(branch.includes('if(!changed)return false'),
    `${APP}: a removal that matched nothing does not fail safely`)
  check(branch.includes("pr('skills',next)"),
    `${APP}: the skills-remove write does not persist the filtered categories`)
}

if (failures) {
  console.error(`test-coach-list-removal: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-coach-list-removal: OK (Values/Reputation.other/dealBreakers removal reuses the existing merge trailers with a request-only instruction addition; Skills gets its own SKILLSREMOVE trailer, gated on the same flag as its add sibling, filtered case-insensitively against the real array, safe no-op when nothing matches)')
}
