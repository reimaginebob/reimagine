// Guards Interview Team removal (2026-09-06, deletion/retraction Tier 1).
// OPPORTUNITY_UPDATE_CAPTURE_NOTE's own comment used to say plainly that
// removing someone already on the Interview Team "is not something you can
// capture this way" -- an explicitly documented, deliberate gap. This closes
// it by extending the SAME trailer (OPPORTUNITYUPDATE) with a `removePeople`
// array of names rather than inventing a sibling mechanism, matching the
// trailer's own founding reason for existing: "one classifier and one
// trailer covering everything that can change an opportunity card."
//
// Existence is checked against the REAL current roster at write time
// (src/App.jsx), not assumed from the model's own recall of it -- a
// hallucinated or mismatched name simply removes nothing rather than
// erroring or silently claiming success. Editing an existing person (as
// opposed to removing them) is still explicitly out of scope.
import fs from 'node:fs'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

const COACH = 'api/coach.js'
const coach = fs.readFileSync(COACH, 'utf8')

check(coach.includes('"removePeople":["Full Name Already On The Roster"]'),
  `${COACH}: OPPORTUNITY_UPDATE_CAPTURE_NOTE's example trailer no longer shows removePeople`)
check(coach.includes('include their full name, exactly as already listed in the roster shown to you above, in a `removePeople` array'),
  `${COACH}: OPPORTUNITY_UPDATE_CAPTURE_NOTE does not tell the model how to name someone for removal`)
check(coach.includes('never inferred from a stage change or a quiet mention, only from an actual ask'),
  `${COACH}: OPPORTUNITY_UPDATE_CAPTURE_NOTE does not restrict removal to an explicit request -- deletion must never be a judgment call the model volunteers`)
check(coach.includes('Editing an existing person') && coach.includes('role, title, or note (as opposed to removing them entirely) is still not something you can capture this way'),
  `${COACH}: OPPORTUNITY_UPDATE_CAPTURE_NOTE no longer declines to handle editing an existing interviewer -- that remains deliberately out of scope`)

// Server-side parsing: sanitized (length/shape), not validated against real
// content -- that check happens client-side where the real roster lives.
check(coach.includes("const removePeople = (parsed && Array.isArray(parsed.removePeople) ? parsed.removePeople : [])"),
  `${COACH}: removePeople is not parsed from the OPPORTUNITYUPDATE trailer`)
check(coach.includes('if (stage || move || meeting || people.length || removePeople.length) {'),
  `${COACH}: removePeople alone (with no other field) does not trigger the header payload -- a pure removal request would produce no offer`)
check(coach.includes('removePeople,\n        })).toString(\'base64\')'),
  `${COACH}: removePeople is not included in the response header payload`)

const CHAT = 'src/components/Chat.jsx'
const chat = fs.readFileSync(CHAT, 'utf8')

check(chat.includes("const removePeople = (data && Array.isArray(data.removePeople) ? data.removePeople : []).filter(n => typeof n === 'string' && n.trim())"),
  `${CHAT}: the opportunity-update offer does not read removePeople from the header payload`)
check(chat.includes('Remove from Interview Team: '),
  `${CHAT}: the opportunity-update recap does not show pending removals before the tap, unlike every other part of this offer`)
check(/stage \|\| move \|\| meeting \|\| people\.length \|\| removePeople\.length/.test(chat),
  `${CHAT}: a pure removal (no other field) does not trigger the offer to render at all`)

const APP = 'src/App.jsx'
const app = fs.readFileSync(APP, 'utf8')

const writeIdx = app.indexOf("if(checkinKey==='opportunity-update'){")
check(writeIdx !== -1, `${APP}: the opportunity-update write path is missing`)
if (writeIdx !== -1) {
  const block = app.slice(writeIdx, writeIdx + 900)
  check(block.includes("const removePeople=data&&Array.isArray(data.removePeople)?data.removePeople.filter(n=>typeof n==='string'&&n.trim()):[]"),
    `${APP}: the write path does not parse removePeople from the tapped payload`)
  // The actual removal logic lives in execOpportunityUpdate (2026-09-07,
  // same-name opportunity resolution fix) -- extracted out of this branch so
  // both a unique-match tap AND a disambiguation-tap can call the same write
  // code.
  const execIdx = app.indexOf('const execOpportunityUpdate=')
  check(execIdx !== -1, `${APP}: execOpportunityUpdate is missing -- the opportunity-update write logic should live in its own function, shared with the disambiguation-tap path`)
  const execBlock = execIdx !== -1 ? app.slice(execIdx, execIdx + 3200) : ''
  check(/const hit=removePeople\.some\(n=>n\.trim\(\)\.toLowerCase\(\)===String\(iv\.name\|\|''\)\.trim\(\)\.toLowerCase\(\)\)/.test(execBlock),
    `${APP}: removal is not matched case-insensitively against each interviewer's REAL current name -- this is the actual existence check named people are validated against`)
  check(execBlock.includes('if(hit)removed.push(iv.name)'),
    `${APP}: removed names are not tracked separately from the roster filter, so the confirmation message could not report what actually changed`)
  check(execBlock.includes('Interview Team no longer includes'),
    `${APP}: the confirmation message does not report a completed removal`)
  check(execBlock.includes('if(!landed.length)return false'),
    `${APP}: a removal that matched nobody (all names hallucinated or already gone) does not fail safely -- it would show an empty confirmation claiming something happened`)
}

if (failures) {
  console.error(`test-coach-interview-team-removal: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-coach-interview-team-removal: OK (removePeople added to the existing OPPORTUNITYUPDATE trailer rather than a new mechanism, request-only, recapped before the tap, matched case-insensitively against the real roster at write time, editing still out of scope, safe no-op when nothing matches)')
}
