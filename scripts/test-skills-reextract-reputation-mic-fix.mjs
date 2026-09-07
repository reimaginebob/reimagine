// Guards two data-loss-shaped bugs from the 2026-09-07 full-orientation-
// codebase review (findings #3 and #4, fixed after the Build-brand race and
// framing-line fixes in PR #780):
//
// 1. The Skills screen's "Re-extract from my resume and LinkedIn" button
//    cleared profile.skills to empty arrays on the assumption that the
//    extraction effect (deps [step]) would notice and re-fire. Effects only
//    re-run when something in their OWN dependency array changes, and the
//    button never touched `step` -- so the button just wiped every skill
//    and never called the model again. Fixed with a bump counter
//    (skillsExtractReq) the effect now actually depends on, matching the
//    coachOpenTick/pbCheckinOpenReq pattern already used elsewhere in this
//    file.
//
// 2. The Reputation screen's mic button, on all four fields (memory,
//    emergency, twoWords, other/Additional Feedback), replaced the field's
//    entire contents with the new transcript instead of appending -- the
//    same class of silent data loss as the 2026-09-06 Values merge bug.
//    Every other SpeechBtn onResult in this file (Values, Life Events,
//    dealBreakers, Opportunity Context, Coach Notes, resumeDelta, search
//    intake) appends; Reputation was the outlier.
import fs from 'node:fs'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

const APP = 'src/App.jsx'
const app = fs.readFileSync(APP, 'utf8')

// Fix 1: Skills re-extract button.
check(app.includes("const[skillsExtractReq,setSkillsExtractReq]=useState(0)"),
  `${APP}: skillsExtractReq bump-counter state is missing`)

const effectIdx = app.indexOf("if(step!=='skills')return")
check(effectIdx !== -1, `${APP}: could not find the skills-extraction effect`)
const effectBlock = effectIdx !== -1 ? app.slice(Math.max(0, effectIdx - 700), effectIdx + 1400) : ''
check(effectBlock.includes('const[skillsExtractReq,setSkillsExtractReq]=useState(0)'),
  `${APP}: the skillsExtractReq state is not declared right before the skills-extraction effect`)
check(app.includes("},[step,skillsExtractReq])"),
  `${APP}: the skills-extraction effect is not keyed on [step,skillsExtractReq] -- the Re-extract button could not force it to re-run`)

check(app.includes("pr('skills',{technical:[],systems:[],certifications:[],languages:[],methodologies:[]});setSkillsExtractReq(x=>x+1)"),
  `${APP}: the Re-extract button no longer clears skills AND bumps skillsExtractReq in the same click -- clearing alone (the original bug) would wipe skills with nothing to repopulate them`)

// Fix 2: Reputation mic appends on all four fields, not just some.
check(!app.includes('{hasSpeech&&<SpeechBtn onResult={t=>rep(f,t)}/>}'),
  `${APP}: the Reputation mic still replaces the field outright instead of appending -- this is the exact live data-loss bug being fixed`)
check(app.includes("{hasSpeech&&<SpeechBtn onResult={t=>rep(f,(profile.rep[f]||'')+t)}/>}"),
  `${APP}: the Reputation mic's onResult does not append to the field's existing text via rep(f,(profile.rep[f]||'')+t)`)

if (failures) {
  console.error(`test-skills-reextract-reputation-mic-fix: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-skills-reextract-reputation-mic-fix: OK (Skills Re-extract button now actually re-fires the extraction effect instead of only wiping skills, Reputation mic appends on all four fields instead of replacing)')
}
