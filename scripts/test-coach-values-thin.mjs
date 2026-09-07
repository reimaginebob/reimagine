// Guards Values thinness (2026-09-07): the "next gap" after brand richness
// shipped, deliberately scoped lighter than Life Events' own thinness
// treatment. The reasoning, not just the mechanism: brand richness (shipped
// just before this) already gives Values a post-synthesis backstop as part
// of its differentiation-axis read, which Life Events did not have when its
// own three-trigger build (hub_arrival + two topic-close signals) shipped.
// So this only gets the on-screen floor + nudge every other high-value
// field already has, plus the single one-shot hub_arrival chat prompt --
// deliberately NOT the topic-close-tap/topic_close_language signals.
import fs from 'node:fs'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

const APP = 'src/App.jsx'
const app = fs.readFileSync(APP, 'utf8')

// The floor itself, and that it is combined across Values + Passions --
// matching the precedent Reputation and the orientation quality check
// already set for a multi-field combined check, not two separate floors.
check(app.includes('const THIN_MIN={resume:60,assess:25,life:12,rep:12,values:12,priorities:12}'),
  `${APP}: THIN_MIN is missing the values floor, or an existing floor drifted`)

// The on-screen nudge: combined word count, same ThinNudge component every
// other high-value field uses.
const nudgeIdx = app.indexOf("wc([profile.values,profile.passions].filter(Boolean).join(' '))<THIN_MIN.values")
check(nudgeIdx !== -1, `${APP}: the on-screen Values/Passions thinness nudge is missing`)
const nudgeBlock = nudgeIdx !== -1 ? app.slice(nudgeIdx, nudgeIdx + 250) : ''
check(nudgeBlock.includes('<ThinNudge'),
  `${APP}: the Values/Passions thinness check does not render the standard ThinNudge component`)

// The chat prompt message: only ONE checkinKey (hub_arrival), unlike Life
// Events' three-key family -- confirms this shipped deliberately lighter,
// not as a copy-paste of the Life Events build.
check(app.includes("checkinKey:'values-thin-hub'"),
  `${APP}: valuesThinPromptMessage does not use the values-thin-hub checkinKey`)
check(!app.includes("'values-thin-tap'") && !app.includes("'values-thin-lang'"),
  `${APP}: found topic-close-style checkinKeys for Values -- this was scoped to hub_arrival only, since brand richness already covers the repeatable-catch job Life Events needed a dedicated mechanism for`)
const msgIdx = app.indexOf('const valuesThinPromptMessage=')
check(msgIdx !== -1, `${APP}: valuesThinPromptMessage is missing`)
const msgBlock = msgIdx !== -1 ? app.slice(msgIdx, msgIdx + 500) : ''
check(msgBlock.includes("{label:'Sure, let\\'s add one'") && msgBlock.includes("{label:'Not now',value:'dismiss'}"),
  `${APP}: valuesThinPromptMessage does not offer a real accept/decline choice`)

// Engagement logging: bounded prompt_code, same vocabulary as everything
// else this week.
const CODES = 'src/coach-prompt-codes.js'
const codes = fs.readFileSync(CODES, 'utf8')
check(codes.includes("'values_thin',"), `${CODES}: PROMPT_CODES is missing 'values_thin'`)
check(app.includes("'values-thin-hub':{code:'values_thin',trigger:'hub_arrival'}"),
  `${APP}: PROMPT_ENGAGEMENT_META_BY_CHECKIN is missing or has drifted for values-thin-hub`)

// State + both hydration paths + autosave blob/deps -- the established
// one-time-disclosure wiring pattern, same as every other hub_arrival prompt.
check(app.includes('const[seenValuesThinHub,setSeenValuesThinHub]=useState(false)'),
  `${APP}: seenValuesThinHub useState declaration is missing`)
const hydrationHits = (app.match(/if\(d\.seenValuesThinHub\)setSeenValuesThinHub\(true\)/g) || []).length
check(hydrationHits === 2, `${APP}: expected seenValuesThinHub hydration in both hydration paths, found ${hydrationHits}`)
const saveBlobIdx = app.indexOf('const blob=JSON.stringify(')
check(app.slice(saveBlobIdx, saveBlobIdx + 900).includes('seenValuesThinHub'),
  `${APP}: seenValuesThinHub is missing from the autosave blob's JSON.stringify`)
const saveDepsIdx = app.indexOf('saveRef.current=save')
check(app.slice(saveDepsIdx, saveDepsIdx + 900).includes('seenValuesThinHub'),
  `${APP}: seenValuesThinHub is missing from the autosave effect's dependency array`)

// The firing effect: gated correctly, and critically -- yields to
// life-events-thin specifically, on top of the full established priority
// chain (employment, search-intake, pbCheckin, notes, close-reason).
// Without the life-events yield, the two newest hub_arrival prompts could
// stack on the same visit.
const fireIdx = app.indexOf('valuesThinHubFiredRef.current=true')
check(fireIdx !== -1, `${APP}: the values-thin-hub firing effect is missing`)
const fireBlock = fireIdx !== -1 ? app.slice(fireIdx - 900, fireIdx + 300) : ''
check(fireBlock.includes('if(!hasOnboardingConcierge)return'),
  `${APP}: values-thin-hub is not gated on hasOnboardingConcierge`)
check(fireBlock.includes("wc([profile.values,profile.passions].filter(Boolean).join(' '))>=THIN_MIN.values||seenValuesThinHub||valuesThinHubFiredRef.current"),
  `${APP}: values-thin-hub's thinness/one-shot guard is missing or has drifted`)
check(fireBlock.includes('employmentPromptFiredRef.current||(!employmentStatus&&!seenEmploymentPrompt)') && fireBlock.includes('searchIntakePromptFiredRef.current||(!searchGoingWell&&!searchFocus&&!seenSearchIntakePrompt)'),
  `${APP}: values-thin-hub does not yield to the employment/search-intake prompts in the established priority order`)
check(fireBlock.includes('notesCapabilityFiredRef.current||closeReasonMentionFiredRef.current'),
  `${APP}: values-thin-hub does not yield to the Notes/close-reason disclosures`)
check(fireBlock.includes('lifeEventsThinHubFiredRef.current||(wc(profile.lifeEvents)<THIN_MIN.life&&!seenLifeEventsThinHub)'),
  `${APP}: values-thin-hub does not yield to life-events-thin specifically -- the two newest hub_arrival prompts could stack on the same visit without this`)
check(fireBlock.includes("logPromptEngagement('values_thin','hub_arrival','shown')"),
  `${APP}: values-thin-hub does not log its own 'shown' event`)

// Write path: nothing to persist on 'accept' -- same as life-events-thin,
// the actual value gets captured through the existing VALUES_CAPTURE_NOTE
// once they say it, not through this tap.
check(app.includes("if(checkinKey==='values-thin-hub')return true"),
  `${APP}: the values-thin-hub write-path branch is missing from handleEmploymentQuickReply`)

if (failures) {
  console.error(`test-coach-values-thin: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-coach-values-thin: OK (on-screen floor + nudge matching the existing high-value-field pattern, single hub_arrival chat prompt deliberately without topic-close signals, yields to the full established priority chain including life-events-thin specifically, engagement logged, state/hydration/autosave wired, write path defers to the existing capture mechanism)')
}
