// Three more concierge items, Cowork's live run 2026-09-11 evening, item 1:
// "Delivery and Next move never fire on a newly added opportunity." Repro
// given: Add an Opportunity with a pasted JD, let the auto-build (About This
// Company, Compensation Read, The Role) finish, then hand-build Cover
// Letter. Reported: nothing after three hand builds (Cover Letter, Resume
// Refresh, Interview Prep), no /api/coach moment request made at all.
//
// The report asked to check two things first. Both were verified against
// current code (main at 97d63bd):
//
// 1. The op Delivery dedupe key DOES carry the record id. Every delivery-
//    op-* entry (src/coach-moments.js) sets `dedupeKey: ctx => ctx.opRecord.
//    id`, and the evaluator (src/App.jsx) stores the fired record nested as
//    coachMoments[entry.key][subKey] -- entry.key is already one literal
//    per card ('delivery-op-companyRead', 'delivery-op-p_cover', ...), and
//    subKey is the record id on top of that. A card type already delivered
//    on one record cannot suppress the same card type on a different
//    record; this test's two independent fresh records (each building
//    Cover Letter) confirm it directly.
//
// 2. Delivery does NOT gate on stage at all -- eligible() reads only
//    cardBuilt/viewedSection/opArrivalFired. Next move DOES: opNextMoveTarget
//    (App.jsx) resolves via opPickByStage(stage, ...), which returns null
//    for every stage value outside {'applied','interviewing','final_round',
//    'offer'} -- unset/'' included, along with 'researching'/'phone_screen'/
//    'closed'. A freshly added opportunity has no stage
//    (pursuitStatusFor(id) has no row yet), so op-next-move can never
//    become eligible until a stage exists. That is a real, confirmed defect
//    -- but it is the SAME root cause as item 3 ("a fresh record has no
//    stage, and Next move picks by stage"), and item 3's fix (prompting for
//    a stage right after arrival/the first Delivery) is what unblocks it;
//    duplicating that logic here would just be guessing a stage-driven pick
//    without the stage the app is actually missing, which is exactly the
//    kind of invented value CLAUDE.md's Situation-is-a-projection rule
//    warns against. See test-op-stage-prompt-browser.mjs (item 3) for the
//    fix and its own coverage.
//
// No code change was needed for Delivery's own gating: this file locks in,
// as regression coverage, that a genuinely fresh record (no coachMoments
// pre-seeded, arrival has to fire live) still delivers correctly once a
// card is hand-built, and that a second independent fresh record building
// the SAME card key fires its own Delivery too -- proving the dedupe key
// is scoped per record, not consumed globally by card type. Per CLAUDE.md's
// "reproduce to the symptom first" rule, this is a premise-verification
// finding, not a patch for a guessed mechanism that turned out not to be
// broken. (Item 2, shipped separately, changes how Delivery interacts with
// the auto-build sequence specifically -- see test-op-arrival-waits-for-
// autobuild-browser.mjs and test-coach-moments-op-side.mjs for that.)
//
// Test: fresh record, build one card, assert a moment request is made and
// the Delivery names that record and card; then a second fresh record, same
// card, assert it fires again.
import { chromium } from 'playwright'
import { existsSync } from 'node:fs'
import { DEV_URL, RAIL, INPUT, VIEWPORT, dismissCookieBanner } from './browser-tests/page-helpers.mjs'
import { mockBackend } from './browser-tests/mock-backend.mjs'
import { DOOR1_RECORD, DOOR2_RECORD } from './browser-tests/fixtures.mjs'

const EXECUTABLE_PATH = existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome')
  ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
  : undefined

const ASSISTANT_MSG = '[data-message-role="assistant"]'
const EMPTY_SECTIONS = {
  companyRead: { content: '', builtAt: null },
  salaryRead: { content: '', builtAt: null },
  p5: { content: '', builtAt: null },
  p6: '',
  p_res: { content: '', builtAt: null },
  p_cover: { content: '', builtAt: null },
  p11: { content: '', builtAt: null },
  offerNegotiation: { content: '', builtAt: null },
}
const COVER_LETTER_TEXT = 'Dear Hiring Team,\n\nI am writing to apply for this role. My background in logistics operations lines up directly with what this posting asks for, and I would welcome the chance to talk through the fit.\n\nThank you for your consideration.'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } else { console.log(`  ok   ${msg}`) } }

function freshRecord(id) {
  return { ...DOOR2_RECORD, id, title: `Director of Logistics, ${id}`, company: 'Meridian Freight', sections: { ...EMPTY_SECTIONS } }
}

// Drives one genuinely fresh record: no coachMoments pre-seeded at all, so
// the arrival has to fire live before Delivery can become eligible (the
// same ordering the real evaluator enforces) -- then hand-builds Cover
// Letter through a real click (mocked /api/claude, not a pre-seeded
// sections blob) and confirms Delivery fires for it.
async function runScenario(browser, recordId) {
  const rec = freshRecord(recordId)
  const context = await browser.newContext({ viewport: VIEWPORT })
  const page = await context.newPage()
  await dismissCookieBanner(page)
  await mockBackend(page, { flagged: true, onboardingConcierge: true, step: 'op', savedPlaybooksOverride: [DOOR1_RECORD, rec], chosenOverride: rec.title })

  await page.route('**/api/claude', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ content: [{ type: 'text', text: COVER_LETTER_TEXT }] }),
  }))

  const momentLog = []
  await page.route('**/api/coach', async route => {
    let body = null
    try { body = route.request().postDataJSON() } catch {}
    const key = body && body.moment && body.moment.key
    momentLog.push({ key, body })
    const stub = key === 'delivery-op-p_cover' ? 'DELIVERY_OP_P_COVER_REPLY' : 'Got it.'
    await route.fulfill({ status: 200, contentType: 'text/plain', body: stub })
  })

  await page.goto(DEV_URL)
  await page.locator(RAIL).waitFor({ state: 'visible', timeout: 30000 })
  await page.locator(INPUT).waitFor({ state: 'visible', timeout: 10000 })

  // Confirm the arrival fires live on a genuinely fresh record before
  // anything is built -- matches the reported account's own first message.
  const arrivalMsg = page.locator(ASSISTANT_MSG).filter({ hasText: 'This is your playbook for' }).first()
  await arrivalMsg.waitFor({ state: 'visible', timeout: 10000 })

  // Hand-build Cover Letter through a real click.
  const buildBtn = page.locator('#section-p_cover button', { hasText: 'Build' })
  await buildBtn.waitFor({ state: 'visible', timeout: 10000 })
  await buildBtn.click()

  const deliveryMsg = page.locator(ASSISTANT_MSG).filter({ hasText: 'DELIVERY_OP_P_COVER_REPLY' }).first()
  await deliveryMsg.waitFor({ state: 'attached', timeout: 10000 })

  const deliveryReq = momentLog.find(m => m.key === 'delivery-op-p_cover')
  check(!!deliveryReq, `[${recordId}] a delivery-op-p_cover /api/coach request was made after the hand build finished`)
  check(!!deliveryReq && deliveryReq.body.situation && deliveryReq.body.situation.record && deliveryReq.body.situation.record.id === rec.id,
    `[${recordId}] Delivery's request names this exact record via Situation (got: ${JSON.stringify(deliveryReq && deliveryReq.body.situation && deliveryReq.body.situation.record)})`)
  check(!!deliveryReq && deliveryReq.body.moment && deliveryReq.body.moment.section === 'p_cover',
    `[${recordId}] Delivery's request names the Cover Letter card (got moment: ${JSON.stringify(deliveryReq && deliveryReq.body.moment)})`)

  await context.close()
}

async function run() {
  const browser = await chromium.launch({ executablePath: EXECUTABLE_PATH, args: ['--disable-features=Translate,AutofillServerCommunication'] })
  try {
    // Scenario 1: first fresh record.
    await runScenario(browser, 'test-fresh-op-001')
    // Scenario 2: a SECOND fresh record, same card key (p_cover) -- proves
    // the dedupe key is genuinely scoped per record, not consumed globally
    // by the first record's own Cover Letter delivery.
    await runScenario(browser, 'test-fresh-op-002')
  } finally {
    await browser.close()
  }

  if (failures) {
    console.error(`test-op-fresh-record-delivery-browser: ${failures} check(s) failed`)
    process.exit(1)
  } else {
    console.log('test-op-fresh-record-delivery-browser: OK (a fresh, unseeded opportunity record fires its arrival live, then Delivery fires for a hand-built card and names the record and the card; a second fresh record with the same card key fires Delivery again, confirming the dedupe key is scoped per record)')
  }
}

run().catch(e => { console.error(e); process.exit(1) })
