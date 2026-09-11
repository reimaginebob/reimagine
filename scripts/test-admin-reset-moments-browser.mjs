// F1 twenty-minute session, item 3: the admin reset action (api/admin/
// reset-moments.js) clears coachMoments -- the moment dedupe/decline record
// (src/coach-moments.js) -- to {} inside users.profile_state, so a
// previously-fired arrival/Delivery/Row A-C can fire again. The reset
// endpoint itself needs a live DB and admin session this harness cannot
// provide (same constraint every other admin endpoint has -- see
// test-admin-reset-moments.mjs's own header comment), so this is the
// CLIENT-side half: does the app actually respect an empty coachMoments and
// re-fire a moment it had previously marked done, the exact mechanism the
// admin reset depends on.
//
// Two loads of the same account shape (ptw-arrival: flagged, a built
// Personal Brand, on the twoDoors screen) that differ only in coachMoments:
// one with ptw-arrival already marked fired (as if consumed by an earlier
// verification pass), one with it cleared (as if just reset). "Fire an
// arrival on the fixture, reset, reload, assert it fires again" -- simulated
// as the before/after of that one field, since a real reset round-trip
// needs the live DB this harness does not have.
import { chromium } from 'playwright'
import { existsSync } from 'node:fs'
import { DEV_URL, VIEWPORT, INPUT, dismissCookieBanner } from './browser-tests/page-helpers.mjs'
import { mockBackend } from './browser-tests/mock-backend.mjs'

const EXECUTABLE_PATH = existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome')
  ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
  : undefined

const ASSISTANT_MSG = '[data-message-role="assistant"]'
const ARRIVAL_MARKER = "Are you working on any job opportunities right now"

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } else { console.log(`  ok   ${msg}`) } }

async function loadWithCoachMoments(browser, coachMoments) {
  const context = await browser.newContext({ viewport: VIEWPORT })
  const page = await context.newPage()
  await dismissCookieBanner(page)
  await mockBackend(page, { flagged: true, onboardingConcierge: true, step: 'twoDoors' })
  await page.route('**/api/profile/load', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      updatedAt: '2026-09-01T12:00:00.000Z',
      profile: {
        step: 'twoDoors',
        chosen: null,
        selectedLane: null,
        exploredRoleTitles: [],
        outputs: { p3: 'A built Personal Brand, already generated for this account.' },
        done: ['p3'],
        profile: {},
        savedPlaybooks: [],
        coachMoments,
      },
    }),
  }))
  await page.goto(DEV_URL)
  await page.locator(INPUT).waitFor({ state: 'visible', timeout: 15000 })
  await page.waitForTimeout(800)
  const texts = await page.locator(ASSISTANT_MSG).allTextContents()
  await context.close()
  return texts.join(' ||| ')
}

async function run() {
  const browser = await chromium.launch({ executablePath: EXECUTABLE_PATH, args: ['--disable-features=Translate,AutofillServerCommunication'] })
  try {
    // Before a reset: ptw-arrival already marked fired (default shape the
    // evaluator writes -- subKey '_', value 'fired') -- as if an earlier
    // verification run already consumed it.
    const before = await loadWithCoachMoments(browser, { 'ptw-arrival': { _: { value: 'fired', firedAt: '2026-09-10T12:00:00.000Z' } } })
    check(!before.includes(ARRIVAL_MARKER),
      `ptw-arrival does not fire again while its dedupe record says it already has (transcript: ${JSON.stringify(before.slice(0, 200))})`)

    // After a reset: coachMoments cleared to {} (exactly what
    // api/admin/reset-moments.js's jsonb_set writes) -- the arrival should
    // fire again on the very next load.
    const after = await loadWithCoachMoments(browser, {})
    check(after.includes(ARRIVAL_MARKER),
      `ptw-arrival fires again once coachMoments is cleared, matching what a reset writes (transcript: ${JSON.stringify(after.slice(0, 200))})`)
  } finally {
    await browser.close()
  }

  if (failures) {
    console.error(`test-admin-reset-moments-browser: ${failures} check(s) failed`)
    process.exit(1)
  } else {
    console.log('test-admin-reset-moments-browser: OK (an arrival stays suppressed while its dedupe record says it already fired, and fires again once coachMoments is cleared -- the exact client-side mechanism the admin reset action depends on)')
  }
}

run().catch(e => { console.error(e); process.exit(1) })
