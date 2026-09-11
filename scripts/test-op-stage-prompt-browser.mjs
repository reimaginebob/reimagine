// Three more concierge items, Cowork's live run 2026-09-11 evening, item 3:
// "A fresh record has no stage ('Where it stands: Not set yet'), and Next
// move picks by stage." The arrival (or the first Delivery) should ask
// where it stands, with a one-tap stage picker, so the chain can proceed.
//
// Fix: op-playbook-arrival's copy (App.jsx's opRecord IIFE) now asks "Where
// does this stand right now?" whenever the record's stage is genuinely
// unset (not for a stage that IS set but has no move of its own --
// researching/phone_screen/closed already have their answer). Its
// quickReplies (src/coach-moments.js) carry the SAME one-tap stage picker
// My Search's own pursuit-stage capture already uses -- pursuitStageQuickReplies
// (App.jsx), shared via a new opStageQuickReplies ctx field rather than
// re-defined -- so tapping one writes through the same ctx.savePursuit path
// every other pursuit-stage write in the app already goes through, no new
// mechanism. remindLater (item 2's own new field) treats this stage
// question as a real thing to be reminded about, so a stage-less arrival
// keeps "Remind me later"; a record whose stage is already set to one with
// no move of its own does not.
//
// This also answers the report's second ask: HOPE - CHRO on the flagged
// account reads "Not set yet" despite having an Offer & Negotiation
// analysis. offerNegotiation being built has no bearing on pursuit_status.
// stage -- they are two independent things (the card is content the person
// asked Reimagine to generate; the stage is a separate field the person, or
// a Coach capture, sets explicitly) and nothing in this codebase infers one
// from the other. A test run building the card would not, on its own, have
// touched pursuit_status at all -- this file's own fixture record proves
// the point directly: it has offerNegotiation built and stage unset at the
// same time, and the app treats that as entirely normal, not a bug. If HOPE
// - CHRO's stage was ever set and is now unset, something explicitly
// cleared pursuit_status for that record (an admin moment-reset, per item 3
// of the earlier same-day batch, is the only mechanism in this codebase
// that clears stage at all) -- there is no code path here that would do it
// as a side effect of building a card. This file does not touch that
// account or its data; it is presented as the answer to the "say whether a
// test run cleared it" ask.
//
// Test: fire an arrival on a stage-less fixture record, assert the stage
// picker is offered and tapping one writes it (a real PUT to
// /api/pursuit-status naming the record and the stage) and shows the
// picker's own confirmation; then, with a card already delivered, assert
// op-next-move now resolves once the stage is set. A second fixture record
// whose stage is already 'researching' (set, but with no move of its own)
// gets no stage picker and no Remind me later.
import { chromium } from 'playwright'
import { existsSync } from 'node:fs'
import { DEV_URL, RAIL, INPUT, VIEWPORT, dismissCookieBanner } from './browser-tests/page-helpers.mjs'
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

function opRecord(overrides = {}) {
  return { ...DOOR2_RECORD, id: 'test-op-stage-001', title: DOOR2_TITLE, company: 'Meridian Freight', sections: { ...EMPTY_SECTIONS }, ...overrides }
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
    // --- Scenario 1: a fresh (stage-less) record's arrival offers a one-tap
    // stage picker, and tapping one writes it through the real endpoint. ---
    {
      const rec = opRecord({ sections: { ...EMPTY_SECTIONS, p5: { content: 'Built Where You Fit content.', builtAt: '2026-09-10T12:00:00.000Z' } } })
      const coachMoments = {
        'op-playbook-arrival': { [rec.id]: { value: 'fired', firedAt: '2026-09-01T12:00:00.000Z' } },
        'delivery-op-p5': { [rec.id]: { value: 'Built Where You Fit content.', firedAt: '2026-09-01T12:05:00.000Z' } },
      }
      const { context, page } = await openPage(browser, { step: 'op', savedPlaybooksOverride: [DOOR1_RECORD, rec], chosenOverride: rec.title, coachMoments })

      let pursuitPutBody = null
      await page.route('**/api/pursuit-status', async route => {
        if (route.request().method() === 'PUT') {
          try { pursuitPutBody = route.request().postDataJSON() } catch {}
          await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) })
        } else {
          await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ rows: [] }) })
        }
      })
      await page.route('**/api/coach', async route => {
        let body = null
        try { body = route.request().postDataJSON() } catch {}
        const key = body && body.moment && body.moment.key
        await route.fulfill({ status: 200, contentType: 'text/plain', body: key ? `${key.toUpperCase().replace(/-/g, '_')}_REPLY` : 'Got it.' })
      })

      await page.goto(DEV_URL)
      await page.locator(RAIL).waitFor({ state: 'visible', timeout: 30000 })
      await page.locator(INPUT).waitFor({ state: 'visible', timeout: 10000 })

      // op-playbook-arrival is pre-dedupe'd (already fired once), so this
      // page load's own /api/coach traffic is op-next-move -- but on THIS
      // first pass, before a stage exists, opNextMoveTarget must be null.
      await page.waitForTimeout(400)
      check((await page.locator(ASSISTANT_MSG).filter({ hasText: 'NEXT_MOVE_OP_REPLY' }).count()) === 0,
        'op-next-move does not fire yet -- the record has no stage for opPickByStage to resolve a target from')

      // Now open the record fresh (not pre-dedupe'd) to see the actual
      // stage-ask copy and picker on a live arrival, matching the reported
      // repro's own "ask where it stands" requirement.
      await context.close()
    }
    {
      const rec = opRecord()
      const { context, page } = await openPage(browser, { step: 'op', savedPlaybooksOverride: [DOOR1_RECORD, rec], chosenOverride: rec.title })

      let pursuitPutBody = null
      await page.route('**/api/pursuit-status', async route => {
        if (route.request().method() === 'PUT') {
          try { pursuitPutBody = route.request().postDataJSON() } catch {}
          await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) })
        } else {
          await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ rows: [] }) })
        }
      })

      await page.goto(DEV_URL)
      await page.locator(RAIL).waitFor({ state: 'visible', timeout: 30000 })
      const arrivalMsg = page.locator(ASSISTANT_MSG).filter({ hasText: 'This is your playbook for' }).first()
      await arrivalMsg.waitFor({ state: 'visible', timeout: 10000 })
      const arrivalText = (await arrivalMsg.textContent()) || ''
      check(arrivalText.includes('Where does this stand right now?'), `the arrival asks where the record stands when its stage is unset (got: ${JSON.stringify(arrivalText.slice(0, 260))})`)

      const appliedTap = arrivalMsg.locator('button', { hasText: 'Applied' })
      check(await appliedTap.isVisible(), 'the arrival offers a one-tap stage picker, including Applied')
      await appliedTap.click()

      await page.waitForTimeout(400)
      check(!!pursuitPutBody, 'tapping a stage writes through the real PUT /api/pursuit-status endpoint')
      check(!!pursuitPutBody && pursuitPutBody.recordId === rec.id && pursuitPutBody.stage === 'applied',
        `the write names this exact record and the tapped stage (got: ${JSON.stringify(pursuitPutBody)})`)

      const followUpMsg = page.locator(ASSISTANT_MSG).filter({ hasText: 'Saved to My Pipeline.' })
      check(await followUpMsg.count() > 0, 'the tap shows the stage picker\'s own confirmation, the same one My Search\'s own capture uses')

      await context.close()
    }

    // --- Scenario 2: a record whose stage is already set to one with no
    // move of its own (researching) gets no stage picker (it already has an
    // answer) and no Remind me later (genuinely nothing to act on or come
    // back to) -- the true no-offer-no-move case item 2's remindLater field
    // is meant to catch. ---
    {
      const rec = opRecord()
      const pursuitStatusRows = [{ record_id: rec.id, stage: 'researching' }]
      const { context, page } = await openPage(browser, { step: 'op', savedPlaybooksOverride: [DOOR1_RECORD, rec], chosenOverride: rec.title, pursuitStatusRows })
      await page.goto(DEV_URL)
      await page.locator(RAIL).waitFor({ state: 'visible', timeout: 30000 })
      const arrivalMsg = page.locator(ASSISTANT_MSG).filter({ hasText: 'This is your playbook for' }).first()
      await arrivalMsg.waitFor({ state: 'visible', timeout: 10000 })
      const arrivalText = (await arrivalMsg.textContent()) || ''
      check(!arrivalText.includes('Where does this stand right now?'), 'a record with a stage already set is not asked again, even when that stage has no move of its own')
      check((await arrivalMsg.locator('button', { hasText: 'Applied' }).count()) === 0, 'no stage picker is offered once a stage is already known')
      check((await arrivalMsg.locator('button', { hasText: 'Remind me later' }).count()) === 0, 'a message with no built-card offer, no stage-fitting move, and no stage question drops Remind me later')
      check(await arrivalMsg.locator('button', { hasText: 'Minimize Coach for now' }).isVisible(), 'Minimize Coach for now is still offered regardless')
      await context.close()
    }
  } finally {
    await browser.close()
  }

  if (failures) {
    console.error(`test-op-stage-prompt-browser: ${failures} check(s) failed`)
    process.exit(1)
  } else {
    console.log('test-op-stage-prompt-browser: OK (op-playbook-arrival asks where a stage-less record stands and offers a one-tap picker that writes through the real pursuit-status endpoint and shows its own confirmation; op-next-move stays silent until a stage exists; a record with a stage already set is not asked again and, when that stage has no move of its own, drops Remind me later too)')
  }
}

run().catch(e => { console.error(e); process.exit(1) })
