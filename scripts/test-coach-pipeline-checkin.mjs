// Guards two things that happen to live in the same file:
//
// 1. OPPORTUNITY UPDATE CAPTURE (2026-09-06): the merged mechanism that
//    replaced three separate capture notes -- INTERVIEW_TEAM_CAPTURE_NOTE,
//    PIPELINE_CAPTURE_NOTE, and STAGE_MOVE_FOLLOWTHROUGH_NOTE (the
//    interview-team follow-through brief this file used to guard, 2026-09-05)
//    -- with one classifier and one OPPORTUNITYUPDATE: trailer. Live testing
//    (scripts/eval-interview-capture-live.mjs) found the old, narrower notes
//    firing reliably in isolation but only ~60% of the time under Coach's
//    actual, fully-loaded prompt; the fix was fewer, broader instructions
//    rather than one more narrow patch. Source-level rather than a live-call
//    test, same reasoning as its siblings: this needs a real signed-in
//    browser session and a real model call to exercise end to end.
//
// 2. The proactive "has anything moved on your pipeline" opener, unrelated to
//    the capture-note merge and untouched by it -- still guarded here since
//    it was added by the same brief.
import fs from 'node:fs'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

const COACH = 'api/coach.js'
const coach = fs.readFileSync(COACH, 'utf8')

check(coach.includes("const OPPORTUNITY_UPDATE_CAPTURE_NOTE ="),
  `${COACH}: OPPORTUNITY_UPDATE_CAPTURE_NOTE is missing`)
check(!coach.includes('const INTERVIEW_TEAM_CAPTURE_NOTE =') && !coach.includes('const PIPELINE_CAPTURE_NOTE =') && !coach.includes('const STAGE_MOVE_FOLLOWTHROUGH_NOTE ='),
  `${COACH}: the old three separate capture-note constants are still defined alongside the merged one`)

// The roster check survived the merge: Coach already sees the full existing
// roster every turn, so the capture instruction must still use it before
// offering to add someone again.
check(coach.includes('First check the interview team roster already shown to you above for this opportunity'),
  `${COACH}: OPPORTUNITY_UPDATE_CAPTURE_NOTE no longer instructs Coach to check the existing roster before offering to add someone`)
check(coach.includes('do not re-add them'),
  `${COACH}: OPPORTUNITY_UPDATE_CAPTURE_NOTE lost the guard against re-adding someone already on the roster`)

// The bugfix folded into the merge: the old INTERVIEWTEAM: trailer's `note`
// field was asked for and consumed by the client write path, but never
// actually extracted server-side -- silently dropped every time.
check(coach.includes('"note":"something substantive they told you about this person"'),
  `${COACH}: OPPORTUNITY_UPDATE_CAPTURE_NOTE's JSON schema lost the note key`)
check(/note: String\(\(p && p\.note\) \|\| ''\)\.slice\(0, 300\)/.test(coach),
  `${COACH}: the OPPORTUNITYUPDATE parser still drops the note field the bugfix was supposed to fix`)

// Live-caught (2026-09-06): asked afterward "did that update automatically?",
// Coach answered "no extra step needed on your end" -- false, and exactly
// backwards from the one-tap-is-the-only-write design this whole mechanism
// depends on. The person's own tap is what wrote it; the model must credit
// that when asked, not describe the write as having happened on its own.
check(coach.includes('Never say no extra step was needed or that it happened on its own'),
  `${COACH}: OPPORTUNITY_UPDATE_CAPTURE_NOTE no longer corrects the model when asked how an update happened -- it could again describe a tap-gated write as fully automatic`)

// One trailer, one gate: stage/move/meeting/people all land in the same
// OPPORTUNITYUPDATE: line, gated the same way PIPELINE_CAPTURE_NOTE was.
check(coach.includes("extractTrailer(strippedText, 'OPPORTUNITYUPDATE')"),
  `${COACH}: the merged OPPORTUNITYUPDATE: trailer parser is missing`)
check(!coach.includes('INTERVIEWTEAM_RE') && !/strippedText0?\.match\(\/\^\\s\*INTERVIEWTEAM:/.test(coach),
  `${COACH}: the old INTERVIEWTEAM: trailer parser is still present alongside the merged one`)
check(!/strippedText\.match\(\/\^\\s\*PIPELINE:/.test(coach),
  `${COACH}: the old PIPELINE: trailer parser is still present alongside the merged one`)
check(/const opportunityUpdateNote = hasPipelineCapture\(\{ feature_flags: featureFlags, email: userEmail \}\) \? OPPORTUNITY_UPDATE_CAPTURE_NOTE : ''/.test(coach),
  `${COACH}: OPPORTUNITY_UPDATE_CAPTURE_NOTE is not gated on hasPipelineCapture`)
check(coach.includes("res.setHeader('X-Coach-Opportunity-Update', opportunityUpdateB64)"),
  `${COACH}: the merged X-Coach-Opportunity-Update response header is missing`)
check(!coach.includes("X-Coach-Interviewers'") && !coach.includes("X-Coach-Pipeline',"),
  `${COACH}: the old X-Coach-Interviewers/X-Coach-Pipeline headers are still emitted alongside the merged one`)

// Removal was added 2026-09-06 (deletion/retraction Tier 1) -- guarded in
// scripts/test-coach-interview-team-removal.mjs. Editing a person already on
// the roster (as opposed to removing them entirely) is still explicitly out
// of scope -- higher stakes, deferred deliberately.
check(coach.includes('Editing an existing person') && coach.includes('role, title, or note (as opposed to removing them entirely) is still not something you can capture this way'),
  `${COACH}: OPPORTUNITY_UPDATE_CAPTURE_NOTE no longer declines to handle editing an existing interviewer`)

// The recap-and-invite confirmation is client-built, never model-phrased --
// the model must not also verbally ask "should I update this" itself.
check(coach.includes('do not separately ask "should I update this" yourself'),
  `${COACH}: OPPORTUNITY_UPDATE_CAPTURE_NOTE no longer tells the model to leave the confirmation question to the client-built offer`)
check(coach.includes('NEVER SAY YOU HAVE SAVED, ADDED, LOGGED, MOVED, OR UPDATED ANYTHING'),
  `${COACH}: OPPORTUNITY_UPDATE_CAPTURE_NOTE lost the guard against claiming a save it cannot perform`)

// Amendment supersedes, not stacks: a person adding a missed detail after
// Coach's own prior offer should get one fresh, complete trailer next turn.
check(coach.includes('capture everything from before together with the new detail in one fresh line'),
  `${COACH}: OPPORTUNITY_UPDATE_CAPTURE_NOTE no longer instructs a superseding trailer on amendment rather than a second partial one`)

const CHAT = 'src/components/Chat.jsx'
const chat = fs.readFileSync(CHAT, 'utf8')

check(chat.includes("opportunityUpdateCaptureActive = false"),
  `${CHAT}: Chat no longer accepts an opportunityUpdateCaptureActive prop`)

// Live-caught regression (2026-09-06): the merge carried over pipeline
// capture's `!!coachSaveTarget()` requirement onto the WHOLE merged
// mechanism, including the interview-team half that never had it --
// interview-team capture used to resolve its target purely by title match
// against saved opportunities (App.jsx's write path still does exactly
// that, coachSaveTarget is only its fallback), so it used to work from any
// screen, not just from inside a specifically-focused opportunity. Adding
// the requirement silently meant a Coach reply about ANY opportunity not
// currently open produced no offer at all, even when the model correctly
// emitted the trailer and the header carried real data -- exactly what
// happened live on a real Deloitte conversation the day this shipped.
for (const app of ['src/App.jsx']) {
  const src = fs.readFileSync(app, 'utf8')
  const propOccurrences = (src.match(/opportunityUpdateCaptureActive=\{[^}]*\}/g) || [])
  check(propOccurrences.length === 2, `${app}: expected opportunityUpdateCaptureActive on both <Chat> mounts, found ${propOccurrences.length}`)
  for (const occ of propOccurrences) {
    check(!occ.includes('coachSaveTarget'),
      `${app}: ${occ} still requires coachSaveTarget() -- this narrows the merged mechanism to only fire inside a focused opportunity, a real regression from interview-team capture's old (broader) title-match-only gating`)
  }
}
check(chat.includes("res.headers.get('X-Coach-Opportunity-Update')"),
  `${CHAT}: Chat no longer reads the merged X-Coach-Opportunity-Update header`)
check(!chat.includes("X-Coach-Interviewers") && !chat.includes("X-Coach-Pipeline"),
  `${CHAT}: Chat still reads one of the old X-Coach-Interviewers/X-Coach-Pipeline headers`)
check(chat.includes("checkinKey: 'opportunity-update'"),
  `${CHAT}: Chat's merged offer no longer uses the opportunity-update checkinKey`)
// Locked-in UX: a recap of what was heard, then a question that names the one
// detectable gap (a move with no date) or asks generically -- never a flat
// yes/no, since a person who gave four updates and had three caught is going
// to say "wait, you forgot..." rather than "no."
check(chat.includes("Here's what I heard"),
  `${CHAT}: the opportunity-update offer no longer recaps what Coach heard before asking`)
check(chat.includes("Anything else, or is that everything?"),
  `${CHAT}: the opportunity-update offer lost its generic "anything else" invitation`)
check(chat.includes("I didn't catch a date for that"),
  `${CHAT}: the opportunity-update offer no longer names the one detectable gap (a move with no date)`)
check(chat.includes("PURSUIT_STAGE_LABELS[stage]"),
  `${CHAT}: the opportunity-update recap does not render the stage using the shared render-true label map`)

const APP = 'src/App.jsx'
const app = fs.readFileSync(APP, 'utf8')

check(app.includes("import { PURSUIT_STAGES, PURSUIT_STAGE_LABELS } from \"./pursuit-stages.js\""),
  `${APP}: App.jsx no longer imports the shared pursuit-stage vocabulary`)

const opportunityUpdateWriteIdx = app.indexOf("if(checkinKey==='opportunity-update'){")
check(opportunityUpdateWriteIdx !== -1, `${APP}: the opportunity-update quick-reply write path is missing`)
// The actual write logic lives in execOpportunityUpdate (2026-09-07,
// same-name opportunity resolution fix) -- extracted out of this branch so
// both a unique-match tap AND a disambiguation-tap can call the same write
// code. The checkinKey branch itself now only resolves the name and hands
// off; this is where to look for what the write actually does.
const execOpportunityUpdateIdx = app.indexOf('const execOpportunityUpdate=')
check(execOpportunityUpdateIdx !== -1, `${APP}: execOpportunityUpdate is missing -- the opportunity-update write logic should live in its own function, shared with the disambiguation-tap path`)
const opportunityUpdateWriteBlock = execOpportunityUpdateIdx !== -1 ? app.slice(execOpportunityUpdateIdx, execOpportunityUpdateIdx + 3200) : ''
// The learned_note fix must survive the merge: threading the captured note
// through as learned_note instead of hardcoding it empty.
check(!opportunityUpdateWriteBlock.includes("learned_note:''"),
  `${APP}: the opportunity-update write path hardcodes learned_note empty`)
check(opportunityUpdateWriteBlock.includes('learned_note:String(pe.note||\'\')'),
  `${APP}: the opportunity-update write path does not thread the captured note through as learned_note`)
// Same read-merge-write contract as every other pipeline write path: only
// the fields this offer actually carried are sent, so an absent key never
// clears a value already on the card.
check(opportunityUpdateWriteBlock.includes("if(stage){patch.stage=stage"),
  `${APP}: the opportunity-update write path does not apply a captured stage move`)
check(opportunityUpdateWriteBlock.includes("if(move)patch.next_move=move"),
  `${APP}: the opportunity-update write path does not apply a captured next move`)
check(opportunityUpdateWriteBlock.includes("if(meeting)patch.next_conversation_at="),
  `${APP}: the opportunity-update write path does not apply a captured scheduled meeting`)

// Old write paths (pursuit-update, interview-team) are deliberately left in
// place, not deleted -- a pre-existing unactioned offer already sitting in
// someone's persisted chat history from before this merge must still work if
// tapped, even though the server stops emitting the headers that produce new
// ones of them.
check(app.includes("if(checkinKey==='pursuit-update'){"),
  `${APP}: the old pursuit-update write path was removed -- a stale persisted offer from before the merge would now silently no-op`)
check(app.includes("if(checkinKey==='interview-team'){"),
  `${APP}: the old interview-team write path was removed -- a stale persisted offer from before the merge would now silently no-op`)

// The proactive opener: once per login session (sessionStorage), not a
// profile-blob "seen" flag -- worth asking again every time they return.
// Unrelated to the capture-note merge above; untouched by it.
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
  console.log('test-coach-pipeline-checkin: OK (merged OPPORTUNITYUPDATE capture note + trailer + header, client recap-and-invite offer, opportunity-update write path, old write paths preserved for stale offers, once-per-session proactive opener all present)')
}
