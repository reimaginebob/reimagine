// Three more concierge items, Cowork's live run 2026-09-11 evening, item 2:
// "Playbook arrival fires during the auto-build." Observed: "This is your
// playbook for Vice President, Human Resources. Nothing is built on it
// yet." with taps [Remind me later] [Minimize Coach for now], shown while
// the three auto-built cards were still building, never updated after they
// finished.
//
// Root cause: op-playbook-arrival's eligibility (src/coach-moments.js) only
// ever checked hasOnboardingConcierge/opRecord/pursuitStatusLoaded -- opRecord
// exists the instant a fresh opportunity is created, well before the top-
// down auto-build (About This Company, Compensation Read, The Role) has
// built anything, and arrival's dedupeValue is the fixed literal 'fired'
// (fire once, ever), so whatever it locked in at that first instant never
// corrected itself. That also explains the missing company: record.company
// is populated by inferJdMetadata, which is still an in-flight fire-and-
// forget call at record-creation time.
//
// Fix: a new opAutoBuildActive (App.jsx, computed in the Moments evaluator)
// is true from the moment the auto-build sequence is queued through the
// moment its last card (The Role) finishes building, and op-playbook-
// arrival's eligible() now requires it to be false. A message with no
// built-card offer and no stage-fitting move (arrivalTarget/arrivalPick
// both null -- true of a fresh record with no stage yet) now also drops the
// "Remind me later" tap via a new remindLater entry field (App.jsx's
// fireStaticEntryMessage); Minimize is unaffected.
//
// Test: fresh record, assert no arrival while a build is in progress,
// assert the arrival names the company and at least one built card and
// offers one card. Also asserts the no-move case drops Remind me later,
// which the reported repro's own screenshot shows was still attached to a
// message with nothing to act on.
import { chromium } from 'playwright'
import { existsSync } from 'node:fs'
import { DEV_URL, INPUT, VIEWPORT, dismissCookieBanner } from './browser-tests/page-helpers.mjs'
import { mockBackend } from './browser-tests/mock-backend.mjs'
import { DOOR1_RECORD } from './browser-tests/fixtures.mjs'

const EXECUTABLE_PATH = existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome')
  ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
  : undefined

const JD = 'We are hiring a Vice President of Human Resources to lead the people function, own the executive relationship with the CEO, and build out the HR business partner team across the organization.'
const ASSISTANT_MSG = '[data-message-role="assistant"]'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } else { console.log(`  ok   ${msg}`) } }

async function run() {
  const browser = await chromium.launch({ executablePath: EXECUTABLE_PATH, args: ['--disable-features=Translate,AutofillServerCommunication'] })
  try {
    const context = await browser.newContext({ viewport: VIEWPORT })
    const page = await context.newPage()
    await dismissCookieBanner(page)
    await mockBackend(page, { flagged: true, onboardingConcierge: true, step: 'op', savedPlaybooksOverride: [DOOR1_RECORD], chosenOverride: '' })

    // Slow the auto-build's own calls down slightly so the test has a real
    // window to check "no arrival yet" mid-cascade, rather than racing a
    // near-instant mock.
    await page.route('**/api/claude', async route => {
      let body = null
      try { body = route.request().postDataJSON() } catch {}
      const step = body && body.step
      let text = 'Generic plain text content, long enough to read as genuinely built for this test.'
      if (step === 'jd-metadata') text = '{"company":"Alcorn Health System","role":"Vice President, Human Resources","location":"Remote"}'
      else if (step === 'lane-infer') text = '{"value":"FG","confidence":"high","reasoning":"Fits familiar ground."}'
      else if (step === 'industry-infer') text = '{"industry":"default"}'
      else if (step === 'op-company-read') text = 'About This Company: a regional health system with a stable executive team and steady growth.'
      else if (step === 'op-salary-read') text = 'Compensation Read: this role typically pays between one hundred sixty and two hundred thousand dollars.'
      else if (step === 'p5') text = 'Where You Fit: your background leading HR functions lines up directly with what this posting is asking for.'
      await new Promise(r => setTimeout(r, 150))
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content: [{ type: 'text', text }] }) })
    })

    await page.route('**/api/coach', async route => {
      let body = null
      try { body = route.request().postDataJSON() } catch {}
      const key = body && body.moment && body.moment.key
      const stub = key ? `${key.toUpperCase().replace(/-/g, '_')}_REPLY` : 'Got it.'
      await route.fulfill({ status: 200, contentType: 'text/plain', body: stub })
    })

    await page.goto(DEV_URL)
    await page.locator(INPUT).waitFor({ state: 'visible', timeout: 15000 })

    const jdBox = page.locator('textarea[placeholder="Paste the full job description here..."]')
    await jdBox.waitFor({ state: 'visible', timeout: 10000 })
    await jdBox.fill(JD)
    await page.locator('button', { hasText: 'Build My Playbook' }).click()

    // Mid-cascade: About This Company should be building (or done) but The
    // Role should not have finished yet -- the arrival must not have fired.
    await page.locator('#section-companyRead').waitFor({ state: 'visible', timeout: 10000 })
    const arrivalDuringBuild = await page.locator(ASSISTANT_MSG).filter({ hasText: 'This is your playbook for' }).count()
    check(arrivalDuringBuild === 0, `the arrival has not fired while the auto-build is still in progress (found ${arrivalDuringBuild} arrival message(s))`)

    // Let the whole auto-build finish.
    const arrivalMsg = page.locator(ASSISTANT_MSG).filter({ hasText: 'This is your playbook for' }).first()
    await arrivalMsg.waitFor({ state: 'visible', timeout: 15000 })
    const arrivalText = (await arrivalMsg.textContent()) || ''

    check(arrivalText.includes('Alcorn Health System'), `the arrival names the company once the auto-build has finished and company inference has resolved (got: ${JSON.stringify(arrivalText.slice(0, 300))})`)
    check(/About This Company|Compensation|Where you fit/i.test(arrivalText), `the arrival names at least one built card, not a stale "Nothing is built on it yet." (got: ${JSON.stringify(arrivalText.slice(0, 300))})`)
    check(!arrivalText.includes('Nothing is built on it yet'), 'the arrival does not carry the stale pre-auto-build copy')

    // No stage has been set on this record, so arrivalTarget/arrivalPick are
    // both null -- nothing to build and nothing to remind about later.
    check(!(await arrivalMsg.locator('button', { hasText: 'Remind me later' }).count()), 'a message with no offer and no move does not carry a Remind me later tap')
    check(await arrivalMsg.locator('button', { hasText: 'Minimize Coach for now' }).isVisible(), 'Minimize Coach for now is still offered regardless')

    await context.close()
  } finally {
    await browser.close()
  }

  if (failures) {
    console.error(`test-op-arrival-waits-for-autobuild-browser: ${failures} check(s) failed`)
    process.exit(1)
  } else {
    console.log('test-op-arrival-waits-for-autobuild-browser: OK (op-playbook-arrival does not fire while the top-down auto-build is still running, fires once it finishes naming the company and what got built, and a message with nothing to build and nothing to remind about drops the Remind me later tap while keeping Minimize)')
  }
}

run().catch(e => { console.error(e); process.exit(1) })
