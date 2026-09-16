// Production fix (Output/handoff/2026-09-16_four-my-coach-breaks-brief.md,
// item C): the Coach distress/mood holds (coachDistressHold/coachMoodHold,
// src/App.jsx) previously lived only in React state, initialized to false
// on every mount. A message that set X-Coach-Distress (or a MOOD: low
// trailer setting X-Coach-Mood) held the Moments evaluator back for the
// rest of the tab session -- but a reload silently dropped the hold, since
// nothing about it was ever written anywhere durable. This reproduces the
// actual symptom: send a message the mocked /api/coach reply marks
// distressed, confirm the hold is written to sessionStorage (the
// mechanism this brief adds), then reload and confirm the hold is STILL
// there -- before this fix there was no sessionStorage key to read at all,
// so this check fails against the old code, not just passes vacuously
// against the new.
import { chromium } from 'playwright'
import { existsSync } from 'node:fs'
import { newFlaggedFocusPage, openEmbeddedCoach, INPUT, RAIL } from './browser-tests/page-helpers.mjs'
import { waitForCoachRequest } from './browser-tests/mock-backend.mjs'

const EXECUTABLE_PATH = existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome')
  ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
  : undefined

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } else { console.log(`  ok   ${msg}`) } }

async function run() {
  const browser = await chromium.launch({ executablePath: EXECUTABLE_PATH, args: ['--disable-features=Translate,AutofillServerCommunication'] })
  try {
    const { context, page, coachRequests } = await newFlaggedFocusPage(browser, {
      onboardingConcierge: true,
      coachReplyBody: "That sounds like a lot to carry right now.",
      coachReplyHeaders: { 'X-Coach-Distress': '1' },
    })

    // No "hold is clear before any message" precondition here: this fixture
    // is signed-in (hasNextStep=!!signedInUser), which fires a silent
    // session-open turn on mount (Chat.jsx's sessionOpenEligible effect) --
    // and coachReplyHeaders applies to every /api/coach call the mock
    // answers, that silent turn included. So the hold may already be set
    // before our own typed message goes out; that's expected, not a bug.
    const baseline = coachRequests.length
    await page.locator(INPUT).fill("This search has been really hard lately.")
    await page.locator(INPUT).press('Enter')
    await waitForCoachRequest(coachRequests, { count: baseline + 1 })
    // Give the fetch response (headers + body) time to resolve and
    // handleCoachDistressDetected to run.
    await page.waitForTimeout(1000)

    const postHold = await page.evaluate(() => { try { return sessionStorage.getItem('pe_coach_distress_hold') } catch { return 'ERR' } })
    check(postHold === '1', 'a reply carrying X-Coach-Distress writes the hold to sessionStorage immediately')

    // --- The actual regression: reload, with nothing else happening in
    // between, and confirm the hold survives. Before this fix, the hold
    // lived only in a useState(false) -- reloading re-mounted the app with
    // no way to know the previous message had been distressed. ---
    await page.reload()
    await page.locator(RAIL).waitFor({ state: 'visible', timeout: 30000 })
    await openEmbeddedCoach(page)

    const afterReload = await page.evaluate(() => { try { return sessionStorage.getItem('pe_coach_distress_hold') } catch { return 'ERR' } })
    check(afterReload === '1', 'the distress hold is still set immediately after a reload -- the bug this brief fixes')

    await context.close()
  } finally {
    await browser.close()
  }
}

await run()

if (failures) {
  console.error(`test-coach-holds-reload-browser: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-coach-holds-reload-browser: OK (a distress-flagged reply writes the hold to sessionStorage, and the hold survives a reload)')
}
