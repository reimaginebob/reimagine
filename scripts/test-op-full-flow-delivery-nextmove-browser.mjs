// Concierge moment engine audit, PR 3 (2026-09-12): resolve the Delivery/
// Next-move contradiction between PR #898's "already works" finding (a
// fixture record, hand-build one card, done -- no auto-build, no stage) and
// Cowork's live run showing three hand builds in a row (Cover Letter,
// Resume Refresh, Interview Prep) producing NOTHING -- no /api/coach moment
// request at all.
//
// The gap PR #898's own test never covered: it built a card on a bare
// fresh record with no auto-build and no stage ever set. This test drives
// the live report's actual, longer path instead -- Add an Opportunity
// (auto-build runs to completion), the #899 stage picker sets a stage,
// THEN a card is built by hand, through the real submitOpRole flow and the
// real stage-picker tap, not a pre-seeded fixture with a stage or a
// pre-built card already in place.
//
// What this found: Cover Letter and Resume Refresh both deliver correctly
// through this exact path -- PR 1's map's own description of Delivery's
// eligibility (cardBuilt + viewedSection + opArrivalFired) holds. Interview
// Prep did not, and root-causing it (not just re-testing until it passed)
// turned up a real, previously-undiscovered bug one hop earlier than the
// Moments engine: P.p11's own prompt template (src/App.jsx) read
// `pr.resume.substring(0,1500)` with no fallback, unlike every sibling
// prompt in the same file, which all guard the identical field with
// `pr.resume||'not provided'` (e.g. P's lane-options builder). Any account
// whose profile has no resume text throws synchronously the instant
// Interview Prep is built -- before any network call -- so
// sections.p11.builtAt never gets set, delivery-op-p11 can never become
// eligible (cardBuilt('p11') stays false forever), and any Next-move chain
// waiting on it goes silent with zero /api/coach traffic. That is exactly
// the reported symptom's shape: "no /api/coach moment request was made at
// all, so client-side eligibility is false." The map's own eligible()
// description for Delivery was accurate; the actual defect was upstream of
// it, in what makes cardBuilt() true in the first place. Fixed with a
// one-line `(pr.resume||'')` guard matching the established sibling
// pattern -- no change to Delivery/Next-move's own logic was needed.
import { chromium } from 'playwright'
import { existsSync } from 'node:fs'
import { DEV_URL, INPUT, VIEWPORT, dismissCookieBanner } from './browser-tests/page-helpers.mjs'
import { mockBackend } from './browser-tests/mock-backend.mjs'
import { DOOR1_RECORD } from './browser-tests/fixtures.mjs'

const EXECUTABLE_PATH = existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome')
  ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
  : undefined

const JD = 'We are hiring a Director of Logistics to own carrier relationships, lead a team of coordinators, and modernize our routing systems.'
const ASSISTANT_MSG = '[data-message-role="assistant"]'
const COVER_LETTER_TEXT = 'Dear Hiring Manager,\nMy background in logistics operations lines up directly with what this posting asks for.\n\nThank you for your consideration.'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } else { console.log(`  ok   ${msg}`) } }

async function run() {
  const browser = await chromium.launch({ executablePath: EXECUTABLE_PATH, args: ['--disable-features=Translate,AutofillServerCommunication'] })
  try {
    const context = await browser.newContext({ viewport: VIEWPORT })
    const page = await context.newPage()
    await dismissCookieBanner(page)
    // Deliberately NOT setting profile.resume -- fixtures.mjs's shared
    // profile shape never has (grep confirms it), which is exactly the
    // state that used to crash P.p11 before this PR's fix. Every other
    // browser test that touches p11 pre-seeds sections.p11 directly and
    // never drives a real build, which is how this went uncaught.
    await mockBackend(page, { flagged: true, onboardingConcierge: true, step: 'op', savedPlaybooksOverride: [DOOR1_RECORD], chosenOverride: '' })

    await page.route('**/api/claude', async route => {
      let body = null
      try { body = route.request().postDataJSON() } catch {}
      const step = body && body.step
      let text = 'Generic plain text content, long enough to read as built for this test.'
      if (step === 'jd-metadata') text = '{"company":"Ferrovia Freight","role":"Director of Logistics","location":"Remote"}'
      else if (step === 'lane-infer') text = '{"value":"FG","confidence":"high","reasoning":"Fits familiar ground."}'
      else if (step === 'industry-infer') text = '{"industry":"default"}'
      else if (step === 'op-company-read') text = 'About This Company: a growing logistics operator expanding its carrier network.'
      else if (step === 'op-salary-read') text = 'Compensation Read: this role typically pays between one hundred ten and one hundred forty thousand dollars.'
      else if (step === 'p5') text = 'Where You Fit: your carrier-relationship and routing background lines up directly with this posting.'
      else if (step === 'op-cover-letter' || step === 'p_cover') text = COVER_LETTER_TEXT
      else if (step === 'p_res') text = '{"summary":"Repositioned Summary text for Director of Logistics.","accomplishments":["Cut carrier costs 12% through renegotiated contracts."]}'
      // p11 (Interview Prep) parses strict JSON via parseInterviewPrepJSON
      // (App.jsx) -- role_context.target_role + a questions array, at
      // minimum. Shaped correctly here so the ONLY thing that could still
      // block sections.p11 from being marked built is the real defect this
      // test is checking for, not a malformed test fixture.
      else if (step === 'p11') text = JSON.stringify({ role_context: { target_role: 'Director of Logistics' }, questions: [{ question: 'Tell me about a time you renegotiated a carrier contract under pressure.', star: { situation: 'Costs were rising on a key lane.', task: 'Bring the contract back in line.', action: 'Renegotiated terms with the carrier.', result: 'Cut costs 12%.' } }] })
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content: [{ type: 'text', text }] }) })
    })

    const coachRequests = []
    await page.route('**/api/coach', async route => {
      let body = null
      try { body = route.request().postDataJSON() } catch {}
      coachRequests.push(body)
      const key = body && body.moment && body.moment.key
      const stub = key ? `${key.toUpperCase().replace(/-/g, '_')}_REPLY` : 'Got it.'
      await route.fulfill({ status: 200, contentType: 'text/plain', body: stub })
    })

    // Override mockBackend's own generic (GET-and-PUT-alike) pursuit-status
    // route so a PUT (the stage-picker tap) is captured and answered
    // distinctly from a GET (the initial load, which stays empty -- a
    // genuinely fresh record). Playwright runs the LAST-registered matching
    // handler first, so this takes precedence over mockBackend's own.
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
    await page.locator(INPUT).waitFor({ state: 'visible', timeout: 15000 })

    // Step 1: Add an Opportunity, real submitOpRole flow -- auto-build runs
    // top-down (About This Company, Compensation Read, The Role).
    const jdBox = page.locator('textarea[placeholder="Paste the full job description here..."]')
    await jdBox.waitFor({ state: 'visible', timeout: 10000 })
    await jdBox.fill(JD)
    await page.locator('button', { hasText: 'Build My Playbook' }).click()

    const arrivalMsg = page.locator(ASSISTANT_MSG).filter({ hasText: 'This is your playbook for' }).first()
    await arrivalMsg.waitFor({ state: 'visible', timeout: 15000 })
    const arrivalText = (await arrivalMsg.textContent()) || ''
    check(arrivalText.includes('Ferrovia Freight'), `the arrival fires once auto-build finishes, naming the company (got: ${JSON.stringify(arrivalText.slice(0, 200))})`)
    check(arrivalText.includes('Where does this stand right now?'), 'the arrival asks where the fresh record stands, since no stage is set yet')

    // Step 2: the #899 stage picker -- tap Applied, the real write path.
    const appliedTap = arrivalMsg.locator('button', { hasText: 'Applied' })
    await appliedTap.waitFor({ state: 'visible', timeout: 5000 })
    await appliedTap.click()
    await page.waitForTimeout(400)
    check(!!pursuitPutBody, 'tapping Applied writes through the real PUT /api/pursuit-status endpoint')
    check(!!pursuitPutBody && pursuitPutBody.stage === 'applied', `the write sets stage to applied (got: ${JSON.stringify(pursuitPutBody)})`)

    // Step 3, 4, 5: build all three cards from the live report BY HAND, one
    // at a time, waiting for each to actually finish (its own Build button
    // relabels to Rebuild, the real "done" signal the UI itself uses --
    // App.jsx's _head renderer) before moving to the next and checking its
    // Delivery fired. A brief, realistic settle between "built" and
    // checking mirrors a person reading the card before clicking on; this
    // loop tests whether Delivery gets a chance to fire per card, not
    // whether it can win a race against zero wall-clock time.
    for (const [key, selector, momentSection] of [
      ['p_cover', '#section-p_cover', 'p_cover'],
      ['p_res', '#section-p_res', 'p_res'],
      ['p11', '#section-p11', 'p11'],
    ]) {
      const before = coachRequests.length
      const btn = page.locator(`${selector} button`, { hasText: /Build/ })
      await btn.waitFor({ state: 'visible', timeout: 10000 })
      await btn.first().click()
      await page.locator(`${selector} button`, { hasText: /Rebuild/ }).waitFor({ state: 'visible', timeout: 15000 })
      await page.waitForTimeout(600)
      const req = coachRequests.slice(before).find(r => r && r.moment && r.moment.key === `delivery-op-${key}`)
      check(!!req, `a delivery-op-${key} /api/coach request was made after this hand build finished (requests since this build: ${JSON.stringify(coachRequests.slice(before).map(r => r && r.moment && r.moment.key))})`)
      if (req) check(req.moment.section === momentSection, `Delivery names the right card for ${key} (got: ${JSON.stringify(req.moment)})`)
    }

    // Step 6: with a stage set (applied) and no known contacts matched
    // (this fixture has none), opPickByStage resolves 'knownContacts' --
    // different from the most recently delivered anchor -- so op-next-move
    // should follow, offering Who You Know Here.
    const nextMoveMsg = page.locator(ASSISTANT_MSG).filter({ hasText: 'OP_NEXT_MOVE_REPLY' })
    await nextMoveMsg.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {})
    check(await nextMoveMsg.count() > 0, 'op-next-move follows Delivery once a stage is set and all three cards have been hand-built')

    await context.close()
  } finally {
    await browser.close()
  }

  if (failures) {
    console.error(`test-op-full-flow-delivery-nextmove-browser: ${failures} check(s) failed`)
    process.exit(1)
  } else {
    console.log('test-op-full-flow-delivery-nextmove-browser: OK (through the real Add-an-Opportunity -> auto-build -> stage-pick -> hand-build path, Delivery fires for all three hand-built cards -- Cover Letter, Resume Refresh, Interview Prep -- and Next move follows once a stage is set)')
  }
}

run().catch(e => { console.error(e); process.exit(1) })
