// Batch item 1.1.7 (Output/handoff/2026-09-09_concierge-batch-and-phase4-
// brief.md, revised 2026-09-10): "Snooze swallows significant moments" --
// observed B4, confirmed by L8/L9 ("after 'I'm good for now,' two builds in
// a row produced no Delivery at all"). Root cause: the old quiet-state early
// return (`if(quietUntilReload||quietScreens[step])return`, retired by
// batch item 1.1.4) blocked the ENTIRE Moments evaluator from running, not
// just the panel reopen -- so while quiet/minimized, Delivery could not
// fire at all, whatever the account did next.
//
// This test reproduces the fixed behavior end to end, against a real build:
// minimize the embedded panel, generate a real (mocked) section, and assert
// Delivery still fires and reopens the panel -- exactly the sequence Bob's
// log reported broken. Runs against the real headless Chromium + Vite dev
// server + mocked backend, same harness as test-coach-moments-ordering.mjs;
// this file additionally mocks /api/claude (Anthropic's Messages API
// response shape, {content:[{type:'text',text}]}) since it needs a genuine
// client-side generation to complete, not just a pre-built fixture.
import { chromium } from 'playwright'
import { existsSync } from 'node:fs'
import {
  DEV_URL, VIEWPORT, RAIL, INPUT, dismissCookieBanner, openEmbeddedCoach,
} from './browser-tests/page-helpers.mjs'
import { mockBackend } from './browser-tests/mock-backend.mjs'
import { CHOSEN, SELECTED_LANE, DOOR1_RECORD } from './browser-tests/fixtures.mjs'

const EXECUTABLE_PATH = existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome')
  ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
  : undefined

const MINIMIZE_BTN = 'button[aria-label="Minimize My Coach"]'
const OPEN_PILL = 'button[aria-label*="Open My Coach"]'
const GENERATE_P9_BTN = 'button:has-text("Generate Industry Background")'
const P9_TEXT = 'This section names the vocabulary and reference points a hiring team in this space expects to hear discussed.'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } else { console.log(`  ok   ${msg}`) } }

async function run() {
  const browser = await chromium.launch({ executablePath: EXECUTABLE_PATH, args: ['--disable-features=Translate,AutofillServerCommunication'] })
  try {
    const idKey = `${SELECTED_LANE}::${CHOSEN}`
    // Pre-seed delivery-p5 as already fired so the only NEW Delivery this
    // test needs to reason about is the one it triggers itself (p9).
    const coachMoments = {
      'delivery-p5': { [idKey]: { value: DOOR1_RECORD.outputs.p5, firedAt: '2026-09-01T12:00:00.000Z' } },
    }

    const context = await browser.newContext({ viewport: VIEWPORT })
    const page = await context.newPage()
    await dismissCookieBanner(page)
    await mockBackend(page, { step: 'focus', flagged: true, onboardingConcierge: true, coachMoments })
    // Last-registered wins (Playwright route precedence) -- overrides
    // mockBackend's generic /api/coach stub so delivery-p9 gets its own
    // recognizable reply; every other moment.key gets a harmless generic one
    // so mount-time moments (choice-role, next-move) settle without noise.
    await page.route('**/api/coach', async route => {
      let body = null
      try { body = route.request().postDataJSON() } catch { /* not JSON */ }
      const key = body && body.moment && body.moment.key
      if (key === 'delivery-p9') {
        await route.fulfill({ status: 200, contentType: 'text/plain', body: 'DELIVERY_P9_REPLY' })
      } else {
        await route.fulfill({ status: 200, contentType: 'text/plain', body: 'Got it.' })
      }
    })
    // /api/claude: the real generation path (callClaude, src/App.jsx) parses
    // an Anthropic Messages API shape -- {content:[{type:'text',text}]} --
    // so this is the minimal valid response for the p9 build this test
    // triggers through the actual "Generate Industry Background" button.
    await page.route('**/api/claude', async route => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content: [{ type: 'text', text: P9_TEXT }] }) })
    })
    await page.goto(DEV_URL)
    await page.locator(RAIL).waitFor({ state: 'visible', timeout: 30000 })
    await openEmbeddedCoach(page)

    // Let mount-time moments (choice-role, next-move -- delivery-p5 is
    // deduped above) settle before minimizing, so the minimize happens on a
    // clean, idle panel rather than racing an in-flight fetch.
    await page.waitForTimeout(1200)

    // --- Minimize the panel -- the exact state Bob's log reported building
    // a section from ("after 'I'm good for now'"; this batch replaces that
    // tap with Minimize Coach for now / the header minimize control, same
    // presence mechanism). ---
    await page.locator(MINIMIZE_BTN).click()
    await page.locator(OPEN_PILL).waitFor({ state: 'visible', timeout: 5000 })
    check(!(await page.locator(INPUT).isVisible()), 'Panel is minimized (composer not visible) before the build starts')

    // --- Build a real section while minimized. ---
    await page.locator(GENERATE_P9_BTN).click()
    await page.locator(`text=${P9_TEXT}`).first().waitFor({ state: 'attached', timeout: 15000 })

    // --- Delivery still fires (the evaluator was never blocked) and, being
    // significant, reopens the panel from minimized. ---
    await page.locator('text=DELIVERY_P9_REPLY').first().waitFor({ state: 'attached', timeout: 10000 })
    await page.locator(INPUT).waitFor({ state: 'visible', timeout: 5000 })
    check(await page.locator(INPUT).isVisible(), 'Panel reopened (composer visible again) once Delivery on the newly-built section fired')
    check(!(await page.locator(OPEN_PILL).isVisible().catch(() => false)), 'Header pill is gone -- the panel is genuinely open, not still minimized')

    await context.close()
  } finally {
    await browser.close()
  }

  if (failures) {
    console.error(`test-coach-moments-minimize-significant: ${failures} check(s) failed`)
    process.exit(1)
  } else {
    console.log('test-coach-moments-minimize-significant: OK (minimizing the panel does not block the Moments evaluator -- Delivery still fires on a section built while minimized, and reopens the panel since it is a significant moment)')
  }
}

run().catch(e => { console.error(e); process.exit(1) })
