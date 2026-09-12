// Coach-as-Concierge Phase 4 Part 2 (Output/handoff/2026-09-09_concierge-
// batch-and-phase4-brief.md, §2.2, Column 2 rows 16/17): live verification
// of the two STAR Stories screen rows -- the weakness question and the
// routed interview-question row. Both are autoSend:true (the underlying
// page doors are "draft this for me from scratch" requests, not something
// needing the person's own composed input first), so a successful tap
// lands the seed straight in chat history rather than merely prefilling
// the composer.
import { chromium } from 'playwright'
import { existsSync } from 'node:fs'
import { DEV_URL, VIEWPORT, dismissCookieBanner, openEmbeddedCoach } from './browser-tests/page-helpers.mjs'
import { mockBackend } from './browser-tests/mock-backend.mjs'
import { buildProfileLoadResponse } from './browser-tests/fixtures.mjs'
import { WEAKNESS_QUESTION, ROUTED_QUESTIONS } from '../src/star-stories.mjs'

// newFlaggedFocusPage (page-helpers.mjs) hardcodes a wait on the Focus
// Playbook's own section rail ('nav[aria-label="Playbook sections"]'),
// which the STAR Stories screen does not render (a different top-level
// step, its own switch-case in App.jsx). This is the same bootstrap minus
// that rail wait -- the embedded Coach panel itself is what these tests
// actually need ready, and openEmbeddedCoach already waits for that.
//
// Mocking profile.step='stories' directly does not stick -- some other
// gate (not the landing-decision effect at App.jsx ~11093, which only acts
// once done.includes('p3'), and only ever redirects a returning-explorer
// account to pipeline/mylib, never to twoDoors) lands a fresh account on
// twoDoors regardless of the requested step. Sidestepping that by driving
// the real navigation instead: land wherever the app puts a p3-done
// account, then click the sidebar's own "Your STAR Stories" link, exactly
// as a real user would -- more representative of the real flow than
// fighting an initial-step mock in any case.
async function newFlaggedStoriesPage(browser, { coachMoments } = {}) {
  const context = await browser.newContext({ viewport: VIEWPORT })
  const page = await context.newPage()
  await dismissCookieBanner(page)
  await mockBackend(page, { step: 'twoDoors', flagged: true, onboardingConcierge: true, coachMoments })
  await page.route('**/api/profile/load', route => {
    const body = buildProfileLoadResponse({ step: 'twoDoors', coachMoments })
    body.profile.outputs = { ...body.profile.outputs, p3: 'A through-line built from your resume and reputation.' }
    body.profile.done = [...body.profile.done, 'p3']
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
  })
  await page.goto(DEV_URL)
  await openEmbeddedCoach(page)
  // The sidebar's nav items are plain divs with onClick, not <button>/<a> --
  // getByText matches innerText on any element, which is what this needs.
  await page.getByText('Your STAR Stories', { exact: true }).click()
  await page.waitForTimeout(500)
  return { context, page }
}

const EXECUTABLE_PATH = existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome')
  ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
  : undefined

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } else { console.log(`  ok   ${msg}`) } }

async function run() {
  const browser = await chromium.launch({ executablePath: EXECUTABLE_PATH, args: ['--disable-features=Translate,AutofillServerCommunication'] })
  try {
    // --- Scenario 1: weakness-question-coach (default fixture -- starStories
    // is empty, so hasWeaknessEvidence is false and this wins the priority
    // tie over routed-question-coach by catalog array order). ---
    {
      const { page } = await newFlaggedStoriesPage(browser)
      await page.waitForTimeout(2000)
      const bodyText = await page.evaluate(() => document.body.innerText)
      check(bodyText.includes('The greatest weakness question is one of the harder ones to answer well.'),
        'weakness-question-coach fires on arrival at Stories when the weakness answer is still thin')

      const tapBtn = page.locator('button', { hasText: 'Build it with My Coach' }).first()
      check(await tapBtn.isVisible().catch(() => false), 'the "Build it with My Coach" quick reply is visible')
      await tapBtn.click()
      await page.waitForTimeout(500)
      const chatHistory = (await page.evaluate(() => localStorage.getItem('reimagine_chat_history'))) || ''
      check(chatHistory.includes(WEAKNESS_QUESTION.coach),
        'tapping sends WEAKNESS_QUESTION.coach unchanged (autoSend true, matching the page door)')
      await page.context().close()
    }

    // --- Scenario 2: routed-question-coach, with weakness-question-coach
    // preset as already-fired so it doesn't win the tie. Static, non-
    // generated moments on the same screen fire through several evaluator
    // passes in quick succession on load (the same cascade Row B's own
    // browser test comment documents for onboarding) -- with five coach-
    // enabled ROUTED_QUESTIONS all eligible in the same pass window, more
    // than one can land before the offer-arbitration mechanism (App.jsx)
    // nulls out the stale ones' quickReplies, so which one is LEFT
    // interactive is a race, not something this row's own logic controls.
    // Reading it back off chatMessages rather than assuming array order is
    // what actually offered. ---
    {
      const { page } = await newFlaggedStoriesPage(browser, {
        coachMoments: { 'weakness-question-coach': { _: { value: 'fired', firedAt: new Date().toISOString() } } },
      })
      await page.waitForTimeout(2000)
      const bodyText = await page.evaluate(() => document.body.innerText)
      const anyRoutedOffered = ROUTED_QUESTIONS.some(q => q && q.coach && bodyText.includes(`${q.asks} is one you're likely to be asked.`))
      check(anyRoutedOffered, 'routed-question-coach fires with a coach-enabled ROUTED_QUESTIONS entry once weakness-question-coach is out of the way')

      // .last(): whichever of the (possibly several) same-cascade offers
      // is still current -- offer-arbitration (App.jsx) nulls quickReplies
      // on superseded ones, and the survivor is whichever fired most
      // recently, i.e. last in DOM/chat order.
      const tapBtn = page.locator('button', { hasText: 'Draft it with My Coach' }).last()
      check(await tapBtn.isVisible().catch(() => false), 'a "Draft it with My Coach" quick reply is visible')
      await tapBtn.click()
      await page.waitForTimeout(500)
      const chatHistory = (await page.evaluate(() => localStorage.getItem('reimagine_chat_history'))) || ''
      const anyRoutedSent = ROUTED_QUESTIONS.some(q => q && q.coach && chatHistory.includes(q.coach))
      check(anyRoutedSent,
        "tapping sends a routed question's own .coach seed unchanged (autoSend true, matching the page door)")
      await page.context().close()
    }
  } finally {
    await browser.close()
  }
}

await run()

if (failures) {
  console.error(`test-coach-moments-stories-rows-browser: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-coach-moments-stories-rows-browser: OK (weakness-question-coach and routed-question-coach both fire on the STAR Stories screen and both tap through to their existing page doors\' exact autoSend seeds)')
}
