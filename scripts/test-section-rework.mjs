#!/usr/bin/env node
// Guards the 2026-09-05 generalization of the Personal Brand correction
// bridge (brand-rework) to the single-target Focus Playbook sections:
// Bridge Story (p6), Resume Refresh (p_res), Industry Background (p9), and
// Income Now (income) -- extended 2026-09-06 to Go-to-Market (p7) and
// LinkedIn Remix (p8), the two sections the structured-capture gap audit
// found with no chat-driven rework path in either door. Unlike p3, these
// share one generic 'focus' step, so the mechanism only activates when the
// conversation started from that section's own "Ask My Coach about this"
// button (returnSection, threaded from coachReturn) -- never from a cold
// reply on the always-on floating bubble, where there would be no reliable
// way to know which section a correction is about.
import fs from 'node:fs'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

const FLAGS = 'api/_lib/feature-flags.js'
const flags = fs.readFileSync(FLAGS, 'utf8')
check(/export const SECTION_REWORK_FLAG = 'section_rework'/.test(flags),
  `${FLAGS}: SECTION_REWORK_FLAG is missing`)
check(/export function hasSectionRework\(user\)/.test(flags),
  `${FLAGS}: hasSectionRework predicate is missing`)
check(/\[SECTION_REWORK_FLAG\]:\s*\{\s*label:/.test(flags),
  `${FLAGS}: SECTION_REWORK_FLAG has no GRANTABLE_FLAGS entry -- it could not be granted to a named tester from the admin dashboard`)

const COACH = 'api/coach.js'
const coach = fs.readFileSync(COACH, 'utf8')
check(/import \{[^}]*hasSectionRework[^}]*\} from '\.\/_lib\/feature-flags\.js'/.test(coach),
  `${COACH}: hasSectionRework is not imported`)
check(/returnSection/.test(coach) && /req\.body \|\| \{\}/.test(coach),
  `${COACH}: returnSection is not destructured from the request body`)
check(/const SECTION_REWORK_LABELS = \{ p6: NAV_LABELS\.p6, p_res: NAV_LABELS\.p_res, p9: NAV_LABELS\.p9, income: NAV_LABELS\.income, p7: NAV_LABELS\.p7, p8: NAV_LABELS\.p8 \}/.test(coach),
  `${COACH}: SECTION_REWORK_LABELS is missing p7/p8 or no longer keyed off NAV_LABELS -- a label rename would silently desync`)
check(/SECTIONREWORK: \{"note":/.test(coach),
  `${COACH}: sectionReworkCaptureNote lost the exact SECTIONREWORK trailer contract`)
check(/const sectionReworkLabel = SECTION_REWORK_LABELS\[returnSection\]/.test(coach),
  `${COACH}: sectionReworkLabel is not resolved from returnSection`)
check(/if \(sectionReworkLabel && _hasText\(_poutputs\[returnSection\]\) && hasSectionRework\(/.test(coach),
  `${COACH}: the section-rework note is no longer gated on a resolved label, the section actually having built content, and hasSectionRework -- it would leak to an unbuilt section or a non-flagged account`)
check(/profileBlock \+= sectionReworkCaptureNote\(sectionReworkLabel\)/.test(coach),
  `${COACH}: the gated section-rework note is no longer appended to profileBlock -- the instruction would never reach the model`)
check(/const secMatch = strippedText\.match\(\/\^\\s\*SECTIONREWORK:/.test(coach),
  `${COACH}: the SECTIONREWORK trailer parser is missing`)
check(/JSON\.stringify\(\{ note, section: returnSection \}\)/.test(coach),
  `${COACH}: the section-rework header payload no longer embeds the section server-side from returnSection -- trusting a section named by the model instead would let a malformed reply target the wrong section`)
check(/res\.setHeader\('X-Coach-Section-Rework', sectionReworkB64\)/.test(coach),
  `${COACH}: the X-Coach-Section-Rework response header is not emitted`)

const CHAT = 'src/components/Chat.jsx'
const chat = fs.readFileSync(CHAT, 'utf8')
check(/sectionReworkTarget = null/.test(chat),
  `${CHAT}: sectionReworkTarget prop (default null) is missing from Chat's destructured props`)
check(/returnSection: sectionReworkTarget \|\| undefined/.test(chat),
  `${CHAT}: returnSection is not threaded into the /api/coach request body`)
check(/const secHeader = res\.headers\.get\('X-Coach-Section-Rework'\)/.test(chat),
  `${CHAT}: X-Coach-Section-Rework response header is not read`)
check(chat.includes("checkinKey: 'section-rework'") && chat.includes("label: 'Yes, rework it'"),
  `${CHAT}: the section-rework one-tap offer (checkinKey + confirm button) is missing`)
check(/if \(sectionReworkTarget && secHeader\)/.test(chat),
  `${CHAT}: the section-rework offer is not gated on sectionReworkTarget being active`)

const APP = 'src/App.jsx'
const app = fs.readFileSync(APP, 'utf8')
check(/const hasSectionRework=/.test(app),
  `${APP}: hasSectionRework client-side flag mirror is missing`)
check(/const sectionReworkTarget=hasSectionRework&&coachReturn&&coachReturn\.step==='focus'&&\['p6','p_res','p9','income','p7','p8'\]\.includes\(coachReturn\.section\)\?coachReturn\.section:null/.test(app),
  `${APP}: sectionReworkTarget is not derived from coachReturn, scoped to the six known sections, and gated on hasSectionRework`)
const mountHits = (app.match(/sectionReworkTarget=\{sectionReworkTarget\}/g) || []).length
check(mountHits === 2,
  `${APP}: expected sectionReworkTarget={sectionReworkTarget} at both <Chat> mount sites, found ${mountHits}`)
const branchIdx = app.indexOf("checkinKey==='section-rework'")
check(branchIdx !== -1, `${APP}: the checkinKey==='section-rework' branch is missing from handleEmploymentQuickReply`)
if (branchIdx !== -1) {
  const branch = app.slice(branchIdx, branchIdx + 1900)
  check(/if\(!note\|\|!\['p6','p_res','p9','income','p7','p8'\]\.includes\(section\)\)return false/.test(branch),
    `${APP}: the section-rework branch does not validate the section against the known allow-list before acting -- a malformed or unexpected value could reach a generation call`)
  check(/submitCorrection\(section,note,\(\)=>\{/.test(branch),
    `${APP}: the section-rework write no longer routes through submitCorrection with a proceed callback -- calling generateSection/generateP6 directly would skip the conflict-detection guard the RefineBox itself gets`)
  check(/if\(section==='p6'\)\{generateP6\(\{refine:note\}\);return\}/.test(branch),
    `${APP}: the section-rework branch no longer special-cases p6 through generateP6 -- the generic generateSection path has no 'p6' case (this is the exact bug class the brand-rework bridge's own test guards against for p3/refineSec)`)
  check(/generateSection\(section,\(\)=>promptText\+`\\n\\nNEW CORRECTION FROM THIS SECTION: \$\{note\}`,opts\)/.test(branch),
    `${APP}: the non-p6 branches no longer call generateSection with the section id, an appended correction note, and per-section opts`)
  check(/value==='dismiss'\)return true/.test(branch),
    `${APP}: the section-rework branch no longer handles a decline ('Not now') as a no-op`)
}

if (failures) {
  console.error(`test-section-rework: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-section-rework: OK (flag + GRANTABLE_FLAGS entry, label map keyed off NAV_LABELS incl. p7/p8, trailer/header wired with section embedded server-side, client offer wired, write path validates the section and routes p6 through generateP6 / others through generateSection, all under submitCorrection\'s conflict guard)')
}
