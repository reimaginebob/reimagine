// Guards the interview-team follow-through brief (2026-09-05): "let Coach ask
// what it doesn't know when something moves on your pipeline." Source-level
// rather than a live-call test, same reasoning as its siblings: this needs a
// real signed-in browser session and a real model call to exercise end to
// end. Pins down the pieces a refactor could silently break.
import fs from 'node:fs'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

const COACH = 'api/coach.js'
const coach = fs.readFileSync(COACH, 'utf8')

// The roster check: Coach already sees the full existing roster every turn,
// so the capture instruction must actually use it before offering to add
// someone again -- the original, narrower gap this brief closes.
check(coach.includes('first check the interview team roster already shown to you above for this opportunity'),
  `${COACH}: INTERVIEW_TEAM_CAPTURE_NOTE no longer instructs Coach to check the existing roster before offering to add someone`)
check(coach.includes('do not re-offer to add them'),
  `${COACH}: INTERVIEW_TEAM_CAPTURE_NOTE lost the guard against re-offering someone already on the roster`)

// Name vs. role branching: the missing piece can be either, not always role.
check(coach.includes('A name is what a capture record needs to exist at all'),
  `${COACH}: INTERVIEW_TEAM_CAPTURE_NOTE no longer branches on name-missing vs. role-missing`)
check(coach.includes('do not emit a capture line -- ask for the name first'),
  `${COACH}: INTERVIEW_TEAM_CAPTURE_NOTE no longer withholds the capture line when only a role/title is known with no name`)
check(coach.includes('A one-tap add should never wait on anything else'),
  `${COACH}: INTERVIEW_TEAM_CAPTURE_NOTE no longer captures the name immediately once known, rather than waiting on role/prep detail`)

// The old passive "omit role" instruction must actually be gone -- the whole
// point is an active ask, not a bug fix layered on top of the old behavior.
check(!coach.includes('If they did not say how the person fits, omit role'),
  `${COACH}: the old passive "omit role" instruction is still present alongside the new active ask`)

// The new optional `note` key on the capture JSON, and the active ask for it.
check(coach.includes('"note":"something substantive they told you about this person, else omit note"'),
  `${COACH}: INTERVIEW_TEAM_CAPTURE_NOTE's JSON schema lost the optional note key`)
check(coach.includes('anything else you have picked up about them that would help me prep you for this one'),
  `${COACH}: INTERVIEW_TEAM_CAPTURE_NOTE no longer actively asks what would help shape interview prep`)

// STAGE MOVE FOLLOW-THROUGH: ties stage-move, date, and interviewer capture
// into one natural conversation, gated the same way as PIPELINE_CAPTURE_NOTE
// since it references the same next-conversation/meeting concepts.
check(coach.includes('const STAGE_MOVE_FOLLOWTHROUGH_NOTE ='),
  `${COACH}: STAGE_MOVE_FOLLOWTHROUGH_NOTE is missing`)
check(coach.includes('treat it as an opening to learn more, not just a fact to log'),
  `${COACH}: STAGE_MOVE_FOLLOWTHROUGH_NOTE lost its core instruction`)
check(/const pipelineNote = hasPipelineCapture\(\{ feature_flags: featureFlags, email: userEmail \}\) \? PIPELINE_CAPTURE_NOTE \+ STAGE_MOVE_FOLLOWTHROUGH_NOTE : ''/.test(coach),
  `${COACH}: STAGE_MOVE_FOLLOWTHROUGH_NOTE is not wired into pipelineNote alongside PIPELINE_CAPTURE_NOTE`)

const APP = 'src/App.jsx'
const app = fs.readFileSync(APP, 'utf8')

// The write-path fix: learned_note must actually thread through from the
// capture JSON's new `note` field instead of being hardcoded empty --
// otherwise the note round-trips through Coach's confirmation and then
// silently vanishes on save, the exact defect this brief exists to close.
const interviewTeamWriteIdx = app.indexOf("if(checkinKey==='interview-team'){")
check(interviewTeamWriteIdx !== -1, `${APP}: the interview-team quick-reply branch is missing`)
const interviewTeamWriteBlock = interviewTeamWriteIdx !== -1 ? app.slice(interviewTeamWriteIdx, interviewTeamWriteIdx + 900) : ''
check(!interviewTeamWriteBlock.includes("learned_note:''"),
  `${APP}: the interview-team write path still hardcodes learned_note empty`)
check(interviewTeamWriteBlock.includes('learned_note:String(pe.note||\'\')'),
  `${APP}: the interview-team write path does not thread the captured note through as learned_note`)

// The proactive opener: once per login session (sessionStorage), not a
// profile-blob "seen" flag -- worth asking again every time they return.
check(app.includes("const pipelineCheckinOpener=()=>({role:'assistant',content:"),
  `${APP}: pipelineCheckinOpener is missing`)
check(app.includes("checkinKey:'pipeline-checkin-opener'"),
  `${APP}: pipelineCheckinOpener lost its checkinKey`)
check(app.includes("sessionStorage.getItem('reimagine_pipeline_checkin_fired')==='1'") && app.includes("sessionStorage.setItem('reimagine_pipeline_checkin_fired','1')"),
  `${APP}: the pipeline check-in opener is not capped via sessionStorage (once per login session) -- a profile-blob flag here would only ever ask once, ever`)
check(/if\(step!=='pipeline'\|\|!signedInUser\)return/.test(app),
  `${APP}: the pipeline check-in trigger is not gated on arrival at the My Pipeline step`)
check(/if\(isDemo\|\|isTest\|\|isIndependent\)return\s*\n\s*if\(step!=='pipeline'/.test(app),
  `${APP}: the pipeline check-in trigger no longer skips demo/test/independent accounts`)
check(app.includes("if(!activePlaybooks.some(r=>r&&r.source==='door2'))return"),
  `${APP}: the pipeline check-in trigger no longer requires at least one live opportunity before firing`)

if (failures) {
  console.error(`test-coach-pipeline-checkin: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-coach-pipeline-checkin: OK (roster check, name/role branching, note field + active ask, STAGE MOVE FOLLOW-THROUGH wired, learned_note write-path fix, once-per-session proactive opener all present)')
}
