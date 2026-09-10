// Batch item 1.1.3 (Output/handoff/2026-09-09_concierge-batch-and-phase4-
// brief.md, revised 2026-09-10; production report L1, "the seed line
// stacked above the recap again"). The session-open recap used to always
// APPEND its placeholder message, so on a genuinely fresh mount it landed
// BELOW the untouched "Hi, I'm your coach" seed (INTRO_MSG) instead of
// replacing it -- Coach visibly greeting the person twice in the same
// breath. src/components/Chat.jsx's send() now replaces the seed with the
// recap's own placeholder when the seed is still the sole, untouched
// message (the exact same replace-not-append pattern src/App.jsx's
// onboarding-framing effect already used for the same problem, one screen
// over).
//
// Runs against the real headless Chromium + Vite dev server + mocked
// backend, same harness as the other coach-moments browser tests. The
// mocked /api/coach response is deliberately distinct from INTRO_MSG's own
// text, so "did the seed get replaced" and "did the recap's own text land"
// are two independently checkable facts, not one coincidence.
import { chromium } from 'playwright'
import { existsSync } from 'node:fs'
import {
  DEV_URL, VIEWPORT, RAIL, dismissCookieBanner, openEmbeddedCoach,
} from './browser-tests/page-helpers.mjs'
import { mockBackend } from './browser-tests/mock-backend.mjs'

const EXECUTABLE_PATH = existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome')
  ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
  : undefined

const ASSISTANT_MSG = '[data-message-role="assistant"]'
const INTRO_TEXT = "Hi, I'm your coach."
const RECAP_TEXT = 'RECAP_REPLY_TEXT'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } else { console.log(`  ok   ${msg}`) } }

async function run() {
  const browser = await chromium.launch({ executablePath: EXECUTABLE_PATH, args: ['--disable-features=Translate,AutofillServerCommunication'] })
  try {
    const context = await browser.newContext({ viewport: VIEWPORT })
    const page = await context.newPage()
    await dismissCookieBanner(page)
    // flagged (embedded panel, on screen from first paint) + nextStep (the
    // flag Chat's sessionOpenEligible prop reads) -- no onboarding_concierge,
    // so the separate onboarding-framing effect (a different message, a
    // different screen) cannot also fire and confound which replace-logic
    // is under test.
    await mockBackend(page, { step: 'focus', flagged: true, nextStep: true, coachReplyBody: RECAP_TEXT })
    await page.goto(DEV_URL)
    await page.locator(RAIL).waitFor({ state: 'visible', timeout: 30000 })
    await openEmbeddedCoach(page)

    // The recap fires as soon as the panel mounts (Chat.jsx's sessionOpen
    // effect needs no user action) -- wait for its distinct reply text.
    await page.locator(`text=${RECAP_TEXT}`).first().waitFor({ state: 'attached', timeout: 10000 })

    const texts = await page.locator(ASSISTANT_MSG).allTextContents()
    check(!texts.some(t => t.includes(INTRO_TEXT)),
      `The generic seed ("${INTRO_TEXT}") is gone -- replaced by the recap, not left stacked above it (saw: ${JSON.stringify(texts)})`)
    check(texts.filter(t => t.includes(RECAP_TEXT)).length === 1,
      'The recap text appears exactly once')
    check(texts.length === 1,
      `Exactly one assistant message exists after the recap lands -- one message, never two (saw ${texts.length}: ${JSON.stringify(texts)})`)

    await context.close()
  } finally {
    await browser.close()
  }

  if (failures) {
    console.error(`test-coach-session-recap-single-message: ${failures} check(s) failed`)
    process.exit(1)
  } else {
    console.log('test-coach-session-recap-single-message: OK (the session-open recap replaces the generic seed message instead of stacking below it -- one message, never two)')
  }
}

run().catch(e => { console.error(e); process.exit(1) })
