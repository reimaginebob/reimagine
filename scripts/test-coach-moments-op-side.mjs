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
import { DEV_URL, VIEWPORT, RAIL, INPUT, dismissCookieBanner, clickRailSection } from './browser-tests/page-helpers.mjs'
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

    // --- Scenario 2: Delivery on an Opportunity card fires (once the person
    // scrolls to it -- production fix, Bob's read on Imerys/Lindsey,
    // 2026-09-10: Delivery no longer fires for a pre-existing build merely
    // because the playbook is open) and its request to /api/coach names
    // both the record (via situation.record) and the card (via
    // moment.section/sectionLabel). op-playbook-arrival is pre-seeded as
    // already fired so only Delivery is eligible on this load. ---
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
      await page.waitForTimeout(300)
      check(!deliveryRequestBody, 'Delivery does not fire for a built card before it comes into view')
      await clickRailSection(page, 'Where you fit')

      await page.locator(ASSISTANT_MSG).filter({ hasText: 'DELIVERY_OP_P5_REPLY' }).first().waitFor({ state: 'attached', timeout: 10000 })
      check(!!deliveryRequestBody, 'Delivery on an Opportunity card fired once scrolled into view (op-playbook-arrival was pre-dedupe\'d, so only Delivery could)')
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

    // --- Scenario 6 (production fix, Bob's first read of #861 on production,
    // Imerys playbook, Lindsey account, 2026-09-10): reproduces the exact
    // reported bug -- opening a playbook with six built cards used to fire a
    // Delivery read for every one of them at once (six reads, six model
    // calls) before the person could act, and the arrival message itself
    // rendered AFTER those reads with duplicated-company, run-on "and...
    // and... and" copy and no tap for the one card that fit the stage. This
    // asserts the fixed shape end to end: one arrival message, first, with
    // corrected copy and its own tap; zero Delivery reads until a card is
    // actually scrolled into view; then exactly one Delivery read for the
    // card actually viewed, none for the other five. ---
    {
      const rec = opRecord({
        title: 'Imerys · Human Resources Vice President',
        company: 'Imerys',
        sections: {
          companyRead: { content: 'Built About This Company.', builtAt: '2026-09-10T12:00:00.000Z' },
          salaryRead: { content: 'Built Compensation.', builtAt: '2026-09-10T12:00:00.000Z' },
          p5: { content: 'Built Where You Fit.', builtAt: '2026-09-10T12:00:00.000Z' },
          p6: '',
          p_res: { content: 'Built Resume Refresh.', builtAt: '2026-09-10T12:00:00.000Z' },
          p_cover: { content: 'Built Cover Letter.', builtAt: '2026-09-10T12:00:00.000Z' },
          p11: { content: 'Built Interview Prep.', builtAt: '2026-09-10T12:00:00.000Z' },
          offerNegotiation: { content: '', builtAt: null },
        },
      })
      const pursuitStatusRows = [{ record_id: rec.id, stage: 'final_round' }]
      // No coachMoments pre-seeded at all -- this is a first-ever open of a
      // playbook that already has six cards built, the exact shape of Bob's
      // report ("Opening a playbook with existing builds").
      const { context, page } = await openPage(browser, { step: 'op', savedPlaybooksOverride: [DOOR1_RECORD, rec], chosenOverride: rec.title, pursuitStatusRows })

      const momentLog = []
      await page.route('**/api/coach', async route => {
        let body = null
        try { body = route.request().postDataJSON() } catch {}
        const key = body && body.moment && body.moment.key
        momentLog.push({ key, at: Date.now() })
        const stub = key === 'op-playbook-arrival' ? undefined : (key ? `${key.toUpperCase().replace(/-/g, '_')}_REPLY` : 'Got it.')
        await route.fulfill({ status: 200, contentType: 'text/plain', body: stub || 'Got it.' })
      })
      await page.goto(DEV_URL)
      await page.locator(RAIL).waitFor({ state: 'visible', timeout: 30000 })
      await page.locator(INPUT).waitFor({ state: 'visible', timeout: 10000 })

      const arrivalMsg = page.locator(ASSISTANT_MSG).filter({ hasText: 'This is your playbook for' }).first()
      await arrivalMsg.waitFor({ state: 'visible', timeout: 10000 })
      // Give the evaluator every chance to have wrongly fired all six
      // Delivery reads if the viewedSection gate were broken, rather than
      // passing by accident on a race.
      await page.waitForTimeout(500)

      // Not asserting an exact total message count here -- this account's
      // fixture also carries the unrelated onboarding-welcome framing seed
      // (App.jsx's own welcome-framing effect, a static first-visit message
      // orthogonal to the Moments catalog), which this test does not
      // control and is not what's under test. What issue #1/#2 actually
      // require -- no Delivery reads before the arrival, and the arrival
      // itself carrying corrected copy and its own tap -- is asserted
      // directly below instead.
      const deliveryReadsBeforeViewing = momentLog.filter(m => m.key && m.key.startsWith('delivery-op-'))
      check(deliveryReadsBeforeViewing.length === 0,
        `Zero Delivery reads fire on arrival for six pre-existing built cards (found: ${JSON.stringify(deliveryReadsBeforeViewing.map(m => m.key))})`)

      const arrivalText = (await arrivalMsg.textContent()) || ''
      check((arrivalText.match(/Imerys/g) || []).length === 1,
        `The company is named once, not duplicated (title already names it) (got: ${JSON.stringify(arrivalText.slice(0, 240))})`)
      check(arrivalText.includes('About This Company, Compensation, Where you fit, Resume Refresh, Cover Letter, and Interview Prep are built.'),
        `Built cards are listed with commas and one "and", not "A and B and C..." (got: ${JSON.stringify(arrivalText.slice(0, 240))})`)
      check(arrivalText.includes('Interview Prep is built') && arrivalText.includes('practice the answer'),
        `The missing half of the row is present: the one card that fits a final-round stage (Interview Prep already built) names practicing the weakest answer (got: ${JSON.stringify(arrivalText.slice(0, 320))})`)
      check(await arrivalMsg.locator('button', { hasText: 'Practice it' }).isVisible(),
        'The arrival row carries the tap for the card that fits the stage ("Practice it"), not just the copy naming it')

      // Now scroll one built card into view -- only THIS card's Delivery
      // read may fire, once, and only now.
      await clickRailSection(page, 'About This Company')
      await page.locator(ASSISTANT_MSG).filter({ hasText: 'DELIVERY_OP_COMPANYREAD_REPLY' }).first().waitFor({ state: 'attached', timeout: 10000 })
      await page.waitForTimeout(300)
      const deliveryReadsAfterViewing = momentLog.filter(m => m.key && m.key.startsWith('delivery-op-'))
      check(deliveryReadsAfterViewing.length === 1 && deliveryReadsAfterViewing[0].key === 'delivery-op-companyRead',
        `Exactly one Delivery read fires, for the one card actually scrolled into view, and none for the other five still-unviewed built cards (found: ${JSON.stringify(deliveryReadsAfterViewing.map(m => m.key))})`)

      // The arrival must render BEFORE this (now-fired) Delivery reply, not
      // after it -- the exact ordering half of issue #2's report.
      const finalTexts = await page.locator(ASSISTANT_MSG).allTextContents()
      const finalArrivalIdx = finalTexts.findIndex(t => t.includes('This is your playbook for'))
      const finalDeliveryIdx = finalTexts.findIndex(t => t.includes('DELIVERY_OP_COMPANYREAD_REPLY'))
      check(finalArrivalIdx !== -1 && finalDeliveryIdx !== -1 && finalArrivalIdx < finalDeliveryIdx,
        `The arrival message renders before Delivery's, not after (arrivalIdx=${finalArrivalIdx}, deliveryIdx=${finalDeliveryIdx})`)

      await context.close()
    }
  } finally {
    await browser.close()
  }

  if (failures) {
    console.error(`test-coach-moments-op-side: ${failures} check(s) failed`)
    process.exit(1)
  } else {
    console.log('test-coach-moments-op-side: OK (Opportunity Playbook arrival names the record; Delivery only fires once its card is scrolled into view and names both the record via Situation and the card via moment.section/sectionLabel; Next move picks the target by stage and built-state, not display order; Interview-close fires once per interview date and respects a reloaded dedupe record; offer-stage + Offer & Negotiation built offers Trade-off considerations, seeding the card\'s own trade-off dialogue; a six-built-card playbook opens to one arrival message with corrected copy and its own tap, zero Delivery reads until a card is actually viewed, then exactly one)')
  }
}

run().catch(e => { console.error(e); process.exit(1) })
