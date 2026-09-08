// Guards finding #4.6 from the 2026-09-07 My Coach diagnostic review:
// offers stacked with no arbitration (a turn that settled Values AND a
// Life Story detail AND a new skill produced three quick-reply bubbles
// behind one reply) and pending offers survived a reload (a days-old
// values-capture offer could still be tapped, replacing the field with
// stale text).
//
// BEHAVIORAL for arbitrateOffers (per finding #5.1): imports api/coach.js
// with dummy env vars and calls the real function. The reload-expiry fix
// (src/App.jsx, chatMessages hydration) is source-checked, since it needs a
// live browser session to exercise end to end.
import fs from 'node:fs'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

process.env.DATABASE_URL ||= 'postgres://user:pass@localhost/dummy'
process.env.RESEND_API_KEY ||= 'dummy'
process.env.ANTHROPIC_API_KEY ||= 'dummy'

const { arbitrateOffers, OFFER_ARBITRATION_ORDER } = await import('../api/coach.js')

// A turn that settled three fields at once keeps only the highest-priority
// one -- the exact shape reported live (values + life-story + a skill).
{
  const vars = { valuesB64: 'v', lifeStoryB64: 'ls', skillsB64: 'sk' }
  const out = arbitrateOffers(vars, OFFER_ARBITRATION_ORDER)
  check(out.valuesB64 === 'v', 'the highest-priority offer among several present should survive')
  check(out.lifeStoryB64 === null && out.skillsB64 === null,
    'lower-priority offers present alongside a higher one should be cleared, not left to stack into separate bubbles')
}

// Only one offer present: untouched.
{
  const vars = { valuesB64: 'v', lifeStoryB64: null, skillsB64: null }
  const out = arbitrateOffers(vars, OFFER_ARBITRATION_ORDER)
  check(out.valuesB64 === 'v', 'a single present offer should survive arbitration unchanged')
}

// No offers present: a clean no-op, nothing thrown.
{
  const vars = { valuesB64: null, lifeStoryB64: null, skillsB64: null }
  const out = arbitrateOffers(vars, OFFER_ARBITRATION_ORDER)
  check(!out.valuesB64 && !out.lifeStoryB64 && !out.skillsB64, 'no offers present should remain a clean no-op')
}

// coachNoteOffer is boolean-shaped (unlike every other offer, which is a
// base64 string or null) -- clearing it must preserve that type as `false`,
// never `null`, so downstream `if (coachNoteOffer)` checks keep working the
// same way regardless of which offer won arbitration.
{
  const vars = { opportunityUpdateB64: 'ou', coachNoteOffer: true }
  const out = arbitrateOffers(vars, OFFER_ARBITRATION_ORDER)
  check(out.opportunityUpdateB64 === 'ou', 'opportunityUpdateB64 should outrank coachNoteOffer per the priority order')
  check(out.coachNoteOffer === false, 'a cleared coachNoteOffer should become false, not null -- it is boolean-shaped, unlike every other offer')
}
{
  const vars = { coachNoteOffer: true, activityB64: 'act' }
  const out = arbitrateOffers(vars, OFFER_ARBITRATION_ORDER)
  check(out.coachNoteOffer === true, 'coachNoteOffer should outrank activityB64 per the priority order')
  check(out.activityB64 === null, 'activityB64 should be cleared when coachNoteOffer wins')
}

// Priority order matches the review's own tiers: pipeline update > close
// reason > archive > rework > profile fields > activity > intake.
{
  const idx = k => OFFER_ARBITRATION_ORDER.indexOf(k)
  check(idx('opportunityUpdateB64') < idx('closeReasonB64'), 'pipeline update should outrank close reason')
  check(idx('closeReasonB64') < idx('opportunityArchiveB64'), 'close reason should outrank archive')
  check(idx('opportunityArchiveB64') < idx('brandReworkB64'), 'archive should outrank rework')
  check(idx('opCardReworkB64') < idx('valuesB64'), 'rework should outrank profile fields')
  check(idx('assessmentB64') < idx('activityB64'), 'profile fields should outrank activity')
  check(idx('activityB64') < idx('searchIntakeB64'), 'activity should outrank intake')
}

// arbitrateOffers is pure: it must not mutate its input.
{
  const vars = { valuesB64: 'v', lifeStoryB64: 'ls' }
  const snapshot = { ...vars }
  arbitrateOffers(vars, OFFER_ARBITRATION_ORDER)
  check(vars.valuesB64 === snapshot.valuesB64 && vars.lifeStoryB64 === snapshot.lifeStoryB64,
    'arbitrateOffers must not mutate the vars object it is given')
}

// The handler actually routes every offer variable through arbitrateOffers
// before any X-Coach-* header is set -- a partial wiring would leave some
// protocols still able to stack.
const COACH = 'api/coach.js'
const coach = fs.readFileSync(COACH, 'utf8')
const arbIdx = coach.indexOf('arbitrateOffers({')
const firstHeaderIdx = coach.indexOf("res.setHeader('X-Coach-Message-Id'")
check(arbIdx !== -1 && firstHeaderIdx !== -1 && arbIdx < firstHeaderIdx,
  `${COACH}: arbitrateOffers is not called before the response headers are set`)
for (const key of ['valuesB64', 'reputationB64', 'skillsB64', 'skillsRemoveB64', 'prioritiesB64', 'lifeStoryB64', 'assessmentB64', 'brandReworkB64', 'sectionReworkB64', 'opCardReworkB64', 'opportunityContextB64', 'opportunityArchiveB64', 'closeReasonB64', 'opportunityUpdateB64', 'coachNoteOffer', 'activityB64', 'searchIntakeB64']) {
  check(coach.slice(arbIdx, firstHeaderIdx).includes(key),
    `${COACH}: ${key} is not threaded through the arbitration reassignment -- it could still ship alongside a higher-priority offer`)
}

// Expiry on reload: chatMessages hydration strips quickReplies from any
// restored message, so a pending offer surviving into a new session can no
// longer be tapped.
const APP = 'src/App.jsx'
const app = fs.readFileSync(APP, 'utf8')
const hydrationIdx = app.indexOf("const[chatMessages,setChatMessages]=useState(()=>{")
check(hydrationIdx !== -1, `${APP}: chatMessages hydration is missing`)
const hydrationBlock = hydrationIdx !== -1 ? app.slice(hydrationIdx, hydrationIdx + 500) : ''
check(hydrationBlock.includes("(m&&m.quickReplies)?{...m,quickReplies:null}:m"),
  `${APP}: chatMessages hydration no longer strips quickReplies from a message restored from a previous session -- a pending offer would survive a reload and could still be tapped, writing stale data`)

if (failures) {
  console.error(`test-coach-offer-arbitration: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-coach-offer-arbitration: OK (arbitrateOffers keeps only the highest-priority offer present, is pure, preserves coachNoteOffer\'s boolean shape when cleared, priority order matches the review\'s tiers, every offer variable is threaded through arbitration before headers are set, and pending offers are stripped of their quick replies on reload)')
}
