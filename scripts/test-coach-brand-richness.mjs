// Guards brand richness (2026-09-07): replaces the old static "take a look,
// tell me how it reads" Personal Brand delivery line with a real judged read
// of the finished brand, using Bob's relevance x differentiation framework
// rather than a presence checklist. Grounded in the same encouragement/
// challenge consult and the CLAUDE.md Positive Framing clarification that
// shipped just before this: naming what's thin is an observation, not a
// correction, as long as what follows opens a door.
//
// Mechanically reuses the existing orientation-check infrastructure
// (orientationCheckFields' dedupe/fire/retry loop) rather than inventing new
// plumbing -- 'brand-richness' is just a 10th entry in that same array, keyed
// on the built brand text instead of a profile field, which is also what
// makes the "loop" (react again after someone acts on a suggestion) work for
// free: a rebuild produces a new brand string, which is a new combined
// value, which the existing dedupe fires on again automatically.
//
// Rubric wording rewritten 2026-09-09 by the voice review (Output/handoff/
// 2026-09-09_coach-voice-review.md, Section 6) -- RELEVANCE/DIFFERENTIATION
// product shorthand became two plain questions, the illustrative "gasoline"
// metaphor was dropped, and the agency phrasing moved to "If you want, we
// could add..." to match Choice/Delivery. Checks below assert the new
// wording and the same structural guarantees, not the old literal strings.
import fs from 'node:fs'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

const COACH = 'api/coach.js'
const coach = fs.readFileSync(COACH, 'utf8')

check(coach.includes("'brand-richness': 'Personal Brand',"),
  `${COACH}: ORIENTATION_CHECK_LABELS is missing the brand-richness entry -- the shape-validation allowlist would 400 every request for this step`)
check(coach.includes("if (step === 'brand-richness') return buildBrandRichnessCheckText(text)"),
  `${COACH}: buildOrientationCheckTurnText does not dispatch brand-richness to its own builder`)

check(coach.includes('function buildBrandRichnessCheckText(text) {'),
  `${COACH}: buildBrandRichnessCheckText is missing`)
const fnIdx = coach.indexOf('function buildBrandRichnessCheckText(text) {')
const fnBlock = fnIdx !== -1 ? coach.slice(fnIdx, fnIdx + 3500) : ''

// The two-axis rubric itself -- not a presence checklist. Wording tightened
// 2026-09-09 by the voice review (Output/handoff/2026-09-09_coach-voice-
// review.md, Section 6): RELEVANCE/DIFFERENTIATION (product-internal
// shorthand) replaced by the two plain questions the rubric now asks in the
// user's own words.
check(fnBlock.includes('Does it show you can do the job?') && fnBlock.includes('Does it show who you are, not just what you\'ve done?'),
  `${COACH}: buildBrandRichnessCheckText does not name both plain-language questions explicitly`)
// The illustrative "gasoline" metaphor (one of the AI-speak examples Bob
// flagged) was deliberately removed by the rewrite -- there is no substring
// equivalent by design. The structural guarantee that either axis can
// legitimately be the thinner one is what this checks instead.
check(fnBlock.includes('Decide which of the two questions the brand answers less well'),
  `${COACH}: the rubric no longer lets either plain question be the thinner one -- this was the point of the two-axis framework, just without the removed "gasoline" illustration`)
check(fnBlock.includes('Never invent a gap.'),
  `${COACH}: the rubric does not forbid manufacturing a gap when the material does not show one`)

// The "genuinely strong, say so, stop" branch -- mirrors
// buildReflectiveDepthCheckText's own proven discipline rather than always
// forcing a suggestion. The explicit "do not manufacture" caveat was
// dropped by the rewrite in favor of the branch just structurally ending in
// "stop" -- same outcome, plainer words.
check(fnBlock.includes('If it answers both well') && fnBlock.includes('say it works, and stop'),
  `${COACH}: the rubric is missing the branch for a genuinely strong brand -- without it, this always forces a suggestion, which is exactly the "grading homework" failure mode this feature was designed to avoid`)

// ONE-thread discipline, reused from the reflective-depth check rather than
// re-litigated: one real suggestion, two at most, not padded to a fixed count.
check(fnBlock.includes('(two at most)'),
  `${COACH}: the rubric does not cap suggestions -- risks padding to a fixed count instead of following the actual substance`)

// Agency-preserving voice. Reworded 2026-09-09 by the voice review to the
// same "If you want, we could add..." offer shape the Choice and Delivery
// templates now use consistently, replacing Bob's earlier "if you'd like"
// draft phrasing.
check(fnBlock.includes('If you want, we could add...'),
  `${COACH}: the suggestion is not framed with the agency-preserving "If you want, we could add..." offer shape`)
check(fnBlock.includes('Never say something is missing or wrong.'),
  `${COACH}: the suggestion framing does not explicitly forbid reading as a correction`)

// The six-fields-capture-here vs three-fields-honest-pointer distinction.
for (const field of ['Values', 'passions', 'reputation', 'skills', 'priorities', 'life story']) {
  check(fnBlock.toLowerCase().includes(field.toLowerCase()),
    `${COACH}: buildBrandRichnessCheckText does not name ${field} among the fields that capture directly through chat`)
}
check(fnBlock.includes('Resume or LinkedIn screens, or in Where You Think You Fit') && fnBlock.includes('do not imply it can be added by telling you'),
  `${COACH}: buildBrandRichnessCheckText does not honestly distinguish Resume/LinkedIn/Fit (no chat-capture yet) from the six fields that do`)

// The closing invitation that replaces the old static delivery line -- both
// affordances (reply here, or the Does this feel right box) still get said,
// just as part of a real reaction instead of a fixed message.
check(fnBlock.includes('update the brand') && fnBlock.includes('Does this feel right?'),
  `${COACH}: buildBrandRichnessCheckText no longer closes by naming both ways to act on the reaction -- this was real discoverability the old static line carried`)

// Rebuild awareness: honest, not a fabricated before/after.
check(fnBlock.includes('return visit'),
  `${COACH}: buildBrandRichnessCheckText does not acknowledge a return-visit framing at all`)

const APP = 'src/App.jsx'
const app = fs.readFileSync(APP, 'utf8')

// The orientationCheckFields entry: keyed on the brand text itself (not a
// profile field), which is what makes a rebuild re-fire this for free.
const entryIdx = app.indexOf("{step:'brand-richness'")
check(entryIdx !== -1, `${APP}: the brand-richness entry is missing from orientationCheckFields`)
const entryBlock = entryIdx !== -1 ? app.slice(entryIdx, entryIdx + 900) : ''
check(entryBlock.includes('done:!!(outputs&&outputs.p3)'),
  `${APP}: brand-richness is not gated on a built brand actually existing`)
check(entryBlock.includes("combined:(outputs&&outputs.p3?outputs.p3:'').trim()"),
  `${APP}: brand-richness is not keyed on the built brand text -- without this, a rebuild would not re-fire the reaction`)
check(entryBlock.includes("qualityCheckedFields['brand-richness']?"),
  `${APP}: brand-richness does not tell the prompt whether this is a first look or a return visit`)
check(entryBlock.includes('Raw material this was built from'),
  `${APP}: brand-richness does not send the raw profile signals alongside the brand text -- the rubric cannot judge which axis is thin without them`)

// The delivery-moment effect no longer pushes a static message, but still
// opens the panel on the big reveal.
const deliveryIdx = app.indexOf("if(step!=='p3'||loading)return")
const deliveryBlock = deliveryIdx !== -1 ? app.slice(deliveryIdx, deliveryIdx + 900) : ''
check(!deliveryBlock.includes('Your story just came together above'),
  `${APP}: the delivery-moment effect still pushes the old static line instead of deferring to the brand-richness reaction`)
check(deliveryBlock.includes('setPbCheckinOpenReq(x=>x+1)'),
  `${APP}: the delivery-moment effect no longer opens the coach panel`)

// Analytics: logged through the same coach_prompt_engagement vocabulary as
// the rest of this week's work, with a new bounded code.
const CODES = 'src/coach-prompt-codes.js'
const codes = fs.readFileSync(CODES, 'utf8')
check(codes.includes("'brand_richness',"),
  `${CODES}: PROMPT_CODES is missing 'brand_richness'`)
check(app.includes("if(stepId==='brand-richness'&&reply)logPromptEngagement('brand_richness','hub_arrival',qualityCheckedFields[stepId]?'accepted':'shown')"),
  `${APP}: the orientation-check firing loop does not log brand-richness engagement, or the shown/accepted branch has drifted`)

if (failures) {
  console.error(`test-coach-brand-richness: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-coach-brand-richness: OK (two-axis relevance/differentiation rubric with an honest genuinely-strong branch, ONE-thread suggestion cap, agency-preserving voice, honest chat-capture-vs-screen-pointer split across the nine orientation fields, rebuild re-fires for free via the existing orientationCheckFields dedupe keyed on the brand text, old static delivery line replaced not duplicated, engagement logged with shown/accepted derived from return-visit state)')
}
