// Live-side brief PR 2 (Output/handoff/2026-09-10_concierge-live-side-brief.md):
// browser coverage for the op-side Moments catalog rows against the flagged
// (coach_presence + onboarding_concierge) fixture -- Opportunity Playbook
// arrival, Delivery, Next move (picked by stage, not section display order),
// and Interview-close (fires once per interview date, not again on a later
// visit once the dedupe record has been saved and reloaded).
//
// Each scenario is its own page load rather than a single long-lived session
// driving live generations -- there is no real backend here (mockBackend
// stubs everything), so "Build Where You Fit" and "the next visit" are both
// simulated the same way PR1's own ordering test simulates a returning
// session: coachMoments pre-seeded through the real hydration path
// (buildProfileLoadResponse -> normalizeProfileState -> setCoachMoments),
// not by driving an actual generation click-through.
import { chromium } from 'playwright'
import { existsSync } from 'node:fs'
import { DEV_URL, VIEWPORT, RAIL, INPUT, dismissCookieBanner } from './browser-tests/page-helpers.mjs'
import { mockBackend } from './browser-tests/mock-backend.mjs'
import { DOOR1_RECORD, DOOR2_RECORD, DOOR2_TITLE } from './browser-tests/fixtures.mjs'

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

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } else { console.log(`  ok   ${msg}`) } }

// A fresh door2 record, cloned per scenario rather than sharing DOOR2_RECORD
// (which other tests in this suite also rely on staying in its own short-
// then-long shape). company/title match what the op-playbook-arrival and
// Delivery/Next-move copy is expected to name.
function opRecord(overrides = {}) {
  return { ...DOOR2_RECORD, id: 'test-op-side-001', title: DOOR2_TITLE, company: 'Meridian Freight', sections: { ...EMPTY_SECTIONS }, ...overrides }
}

async function openPage(browser, opts) {
  const context = await browser.newContext({ viewport: VIEWPORT })
  const page = await context.newPage()
  await dismissCookieBanner(page)
  await mockBackend(page, { flagged: true, onboardingConcierge: true, ...opts })
  return { context, page }
}

async function run() {
  const browser = await chromium.launch({ executablePath: EXECUTABLE_PATH, args: ['--disable-features=Translate,AutofillServerCommunication'] })
  try {
    // --- Scenario 1: Opportunity Playbook arrival names the record (nothing
    // built yet, so no arrival target and no build tap). ---
    {
      const rec = opRecord()
      const { context, page } = await openPage(browser, { step: 'op', savedPlaybooksOverride: [DOOR1_RECORD, rec], chosenOverride: rec.title })
      await page.goto(DEV_URL)
      await page.locator(RAIL).waitFor({ state: 'visible', timeout: 30000 })
      await page.locator(INPUT).waitFor({ state: 'visible', timeout: 10000 })

      const arrivalMsg = page.locator(ASSISTANT_MSG).filter({ hasText: 'This is your playbook for' }).first()
      await arrivalMsg.waitFor({ state: 'visible', timeout: 10000 })
      const arrivalText = (await arrivalMsg.textContent()) || ''
      check(arrivalText.includes('Meridian Freight'), `Opportunity Playbook arrival names the company on screen (got: ${JSON.stringify(arrivalText.slice(0, 200))})`)
      check(arrivalText.includes('Nothing is built on it yet'), 'Opportunity Playbook arrival says nothing is built yet, matching the fixture')
      await context.close()
    }

    // --- Scenario 2: Delivery on an Opportunity card fires and its request
    // to /api/coach names both the record (via situation.record) and the
    // card (via moment.section/sectionLabel). op-playbook-arrival is pre-
    // seeded as already fired so only Delivery is eligible on this load. ---
    {
      const rec = opRecord({ sections: { ...EMPTY_SECTIONS, p5: { content: 'Five paragraphs of Where You Fit content, long enough to read as genuinely built.', builtAt: '2026-09-10T12:00:00.000Z' } } })
      const coachMoments = { 'op-playbook-arrival': { [rec.id]: { value: 'fired', firedAt: '2026-09-01T12:00:00.000Z' } } }
      const { context, page } = await openPage(browser, { step: 'op', savedPlaybooksOverride: [DOOR1_RECORD, rec], chosenOverride: rec.title, coachMoments })

      let deliveryRequestBody = null
      await page.route('**/api/coach', async route => {
        let body = null
        try { body = route.request().postDataJSON() } catch {}
        const key = body && body.moment && body.moment.key
        if (key === 'delivery-op-p5') { deliveryRequestBody = body; await route.fulfill({ status: 200, contentType: 'text/plain', body: 'DELIVERY_OP_P5_REPLY' }) }
        else await route.fulfill({ status: 200, contentType: 'text/plain', body: 'Got it.' })
      })
      await page.goto(DEV_URL)
      await page.locator(RAIL).waitFor({ state: 'visible', timeout: 30000 })
      await page.locator(INPUT).waitFor({ state: 'visible', timeout: 10000 })

      await page.locator(ASSISTANT_MSG).filter({ hasText: 'DELIVERY_OP_P5_REPLY' }).first().waitFor({ state: 'attached', timeout: 10000 })
      check(!!deliveryRequestBody, 'Delivery on an Opportunity card fired (op-playbook-arrival was pre-dedupe\'d, so only Delivery could)')
      check(!!deliveryRequestBody && deliveryRequestBody.situation && deliveryRequestBody.situation.record && deliveryRequestBody.situation.record.id === rec.id,
        `Delivery's request names the record via Situation (got record: ${JSON.stringify(deliveryRequestBody && deliveryRequestBody.situation && deliveryRequestBody.situation.record)})`)
      check(!!deliveryRequestBody && deliveryRequestBody.moment && deliveryRequestBody.moment.section === 'p5' && deliveryRequestBody.moment.sectionLabel === 'Where you fit',
        `Delivery's request names the card (got moment: ${JSON.stringify(deliveryRequestBody && deliveryRequestBody.moment)})`)
      await context.close()
    }

    // --- Scenario 3: Next move picks by stage, not by build order --
    // interviewing + Interview Prep unbuilt offers Interview Prep, even
    // though About This Company/Compensation are also unbuilt and would
    // come first in the card's own display order. ---
    {
      const rec = opRecord({ sections: { ...EMPTY_SECTIONS, p5: { content: 'Built Where You Fit content.', builtAt: '2026-09-10T12:00:00.000Z' } } })
      const coachMoments = {
        'op-playbook-arrival': { [rec.id]: { value: 'fired', firedAt: '2026-09-01T12:00:00.000Z' } },
        // The anchor Next move reasons from -- delivery-op-p5 already fired
        // and dedupe-recorded, same shape App.jsx's evaluator itself writes.
        'delivery-op-p5': { [rec.id]: { value: 'Built Where You Fit content.', firedAt: '2026-09-01T12:05:00.000Z' } },
      }
      const pursuitStatusRows = [{ record_id: rec.id, stage: 'interviewing' }]
      const { context, page } = await openPage(browser, { step: 'op', savedPlaybooksOverride: [DOOR1_RECORD, rec], chosenOverride: rec.title, coachMoments, pursuitStatusRows })
      await page.route('**/api/coach', async route => {
        let body = null
        try { body = route.request().postDataJSON() } catch {}
        const key = body && body.moment && body.moment.key
        if (key === 'op-next-move') await route.fulfill({ status: 200, contentType: 'text/plain', body: 'NEXT_MOVE_OP_REPLY' })
        else await route.fulfill({ status: 200, contentType: 'text/plain', body: 'Got it.' })
      })
      await page.goto(DEV_URL)
      await page.locator(RAIL).waitFor({ state: 'visible', timeout: 30000 })
      await page.locator(INPUT).waitFor({ state: 'visible', timeout: 10000 })

      const nextMoveMsg = page.locator(ASSISTANT_MSG).filter({ hasText: 'NEXT_MOVE_OP_REPLY' }).first()
      await nextMoveMsg.waitFor({ state: 'attached', timeout: 10000 })
      check(await nextMoveMsg.locator('button', { hasText: 'Build Interview Prep' }).isVisible(),
        'Next move picked Interview Prep for an interviewing-stage record with Interview Prep unbuilt, not About This Company or Compensation (both also unbuilt but earlier in display order)')
      await context.close()
    }

    // --- Scenario 4: Interview is close fires once for a record with an
    // interview inside 3 days, and does not fire again on a later visit
    // once the dedupe record from the first visit has been saved and
    // reloaded (simulated: the second page load's own coachMoments already
    // carries it, the same way a real returning session's profile/load
    // would). ---
    {
      const inTwoDays = new Date(Date.now() + 2 * 86400000).toISOString()
      const rec = opRecord()
      const pursuitStatusRows = [{ record_id: rec.id, stage: 'interviewing', next_step_at: inTwoDays }]

      // First visit: the check should fire.
      {
        const { context, page } = await openPage(browser, { step: 'pipeline', savedPlaybooksOverride: [DOOR1_RECORD, rec], pursuitStatusRows })
        await page.goto(DEV_URL)
        // My Pipeline has no section rail (RAIL is Focus/Opportunity Playbook-
        // only) -- the embedded coach input is the load signal here.
        await page.locator(INPUT).waitFor({ state: 'visible', timeout: 30000 })
        // op-pipeline-arrival (priority 1) is also eligible here and fires
        // first on this same load -- opInterviewCloseTarget depends on
        // pursuitStatus, which only resolves after its own async fetch
        // settles, so the arrival (eligible from render 1) beats the check
        // (eligible only once pursuitStatus lands) to the evaluator's first
        // pass. Both fire; this only waits for the check's own message.
        const checkMsg = page.locator(ASSISTANT_MSG).filter({ hasText: "Interview Prep isn't built" }).first()
        await checkMsg.waitFor({ state: 'visible', timeout: 10000 })
        const checkText = (await checkMsg.textContent()) || ''
        check(checkText.includes("Interview Prep isn't built"), `Interview-close names the unbuilt Interview Prep card on first visit (got: ${JSON.stringify(checkText.slice(0, 200))})`)
        await context.close()
      }

      // Second visit: coachMoments already carries the dedupe record a real
      // save/reload would have produced (same value shape the evaluator
      // itself writes: dedupeKey=recordId, dedupeValue=the interview date).
      {
        const coachMoments = { 'op-interview-close': { [rec.id]: { value: inTwoDays, firedAt: new Date().toISOString() } } }
        const { context, page } = await openPage(browser, { step: 'pipeline', savedPlaybooksOverride: [DOOR1_RECORD, rec], pursuitStatusRows, coachMoments })
        await page.goto(DEV_URL)
        await page.locator(INPUT).waitFor({ state: 'visible', timeout: 30000 })
        // Give the evaluator a real chance to fire if the dedupe check were
        // broken, rather than passing by accident on a race.
        await page.waitForTimeout(500)
        const checkMsgCount = await page.locator(ASSISTANT_MSG).filter({ hasText: "Interview Prep isn't built" }).count()
        check(checkMsgCount === 0, `Interview-close does not fire again on a later visit once its dedupe record (this interview date) has been saved and reloaded (found ${checkMsgCount} matching messages)`)
        await context.close()
      }
    }

    // --- Scenario 5 (live-side brief PR 2 fix, 2026-09-10): offer stage with
    // Offer & Negotiation already built offers "Trade-off considerations",
    // not silence -- and the tap seeds My Coach with the exact same dialogue
    // the Offer & Negotiation card's own "Talk through the trade-offs with
    // My Coach" button sends. ---
    {
      const rec = opRecord({ sections: { ...EMPTY_SECTIONS, p5: { content: 'Built Where You Fit content.', builtAt: '2026-09-10T12:00:00.000Z' }, offerNegotiation: { content: 'Built Offer & Negotiation analysis.', builtAt: '2026-09-10T12:00:00.000Z' } } })
      const coachMoments = {
        'op-playbook-arrival': { [rec.id]: { value: 'fired', firedAt: '2026-09-01T12:00:00.000Z' } },
        'delivery-op-p5': { [rec.id]: { value: 'Built Where You Fit content.', firedAt: '2026-09-01T12:05:00.000Z' } },
      }
      const pursuitStatusRows = [{ record_id: rec.id, stage: 'offer' }]
      const { context, page } = await openPage(browser, { step: 'op', savedPlaybooksOverride: [DOOR1_RECORD, rec], chosenOverride: rec.title, coachMoments, pursuitStatusRows })
      await page.route('**/api/coach', async route => {
        let body = null
        try { body = route.request().postDataJSON() } catch {}
        const key = body && body.moment && body.moment.key
        if (key === 'op-next-move') await route.fulfill({ status: 200, contentType: 'text/plain', body: 'NEXT_MOVE_TRADEOFF_REPLY' })
        else await route.fulfill({ status: 200, contentType: 'text/plain', body: 'Got it.' })
      })
      await page.goto(DEV_URL)
      await page.locator(RAIL).waitFor({ state: 'visible', timeout: 30000 })
      await page.locator(INPUT).waitFor({ state: 'visible', timeout: 10000 })

      const nextMoveMsg = page.locator(ASSISTANT_MSG).filter({ hasText: 'NEXT_MOVE_TRADEOFF_REPLY' }).first()
      await nextMoveMsg.waitFor({ state: 'attached', timeout: 10000 })
      const tradeoffTap = nextMoveMsg.locator('button', { hasText: 'Trade-off considerations' })
      check(await tradeoffTap.isVisible(), 'Next move offers "Trade-off considerations" for an offer-stage record with Offer & Negotiation already built, not silence')
      await tradeoffTap.click()
      await page.locator(INPUT).waitFor({ state: 'visible', timeout: 10000 })
      const seeded = await page.locator(INPUT).inputValue()
      check(seeded.includes('key trade-offs') && seeded.includes(rec.title), `Tapping it seeds My Coach with the Offer & Negotiation card's own trade-off dialogue, naming this opportunity (got: ${JSON.stringify(seeded.slice(0, 160))})`)
      await context.close()
    }
  } finally {
    await browser.close()
  }

  if (failures) {
    console.error(`test-coach-moments-op-side: ${failures} check(s) failed`)
    process.exit(1)
  } else {
    console.log('test-coach-moments-op-side: OK (Opportunity Playbook arrival names the record; Delivery\'s request names both the record via Situation and the card via moment.section/sectionLabel; Next move picks the target by stage and built-state, not display order; Interview-close fires once per interview date and respects a reloaded dedupe record; offer-stage + Offer & Negotiation built offers Trade-off considerations, seeding the card\'s own trade-off dialogue)')
  }
}

run().catch(e => { console.error(e); process.exit(1) })
