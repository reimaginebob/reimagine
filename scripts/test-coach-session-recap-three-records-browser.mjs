// F1 twenty-minute session, item 2: Bob's report was specifically a flagged
// account with THREE pipeline records getting a stateless open. The actual
// fix (computeSessionDelta/sessionOpenNote naming the open records instead
// of skipping the status line) is entirely server-side prompt/data logic --
// api/coach.js's real handler never runs in this harness (Playwright
// intercepts /api/coach before it reaches a server at all, and pursuitRows
// itself is loaded server-side from the DB, never sent by the client), so a
// browser test cannot observe the model naming records any more than it can
// observe any other model phrasing. See test-coach-session-open-recap-
// names-pipeline.mjs for the actual behavioral coverage of that fix
// (confirmed to catch the bug by reverting it).
//
// What a browser test CAN and should guard: the client-side mechanism this
// fix depends on -- the session-open trigger firing correctly, once, for a
// flagged account that specifically has MULTIPLE pipeline records (not just
// the single default fixture record every other session-open test uses) --
// still works. If the multi-record shape ever broke the trigger itself
// (never fires, fires twice, or fires before the account's real records are
// hydrated), the server-side naming fix would have nothing to work from
// regardless of how good the prompt is.
import { chromium } from 'playwright'
import { existsSync } from 'node:fs'
import { DEV_URL, VIEWPORT, INPUT, dismissCookieBanner } from './browser-tests/page-helpers.mjs'
import { mockBackend } from './browser-tests/mock-backend.mjs'
import { DOOR2_RECORD, DOOR2_TITLE } from './browser-tests/fixtures.mjs'

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
    // nextStep (the flag Chat's sessionOpenEligible prop reads), no
    // onboarding_concierge -- keeps this isolated from the separate
    // onboarding-framing effect (a different message, a different screen),
    // same reasoning as test-coach-session-recap-single-message.mjs.
    let sessionOpenRequests = 0
    await mockBackend(page, { step: 'op', flagged: true, nextStep: true, coachReplyBody: RECAP_TEXT })
    await page.route('**/api/coach', async route => {
      let body = null
      try { body = route.request().postDataJSON() } catch { /* not JSON */ }
      if (body && body.sessionOpen === true) sessionOpenRequests++
      await route.fulfill({ status: 200, contentType: 'text/plain', body: RECAP_TEXT })
    })
    // Three saved door2 records -- Bob's exact reported shape (HOPE,
    // Deloitte, Imerys), not the single-record default every other
    // session-open test uses.
    const rec = (n) => ({ ...DOOR2_RECORD, id: `test-session-recap-3rec-${n}`, title: `${DOOR2_TITLE} ${n}`, sections: { ...DOOR2_RECORD.sections } })
    await page.route('**/api/profile/load', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        updatedAt: '2026-09-01T12:00:00.000Z',
        profile: {
          step: 'op',
          chosen: `${DOOR2_TITLE} 1`,
          selectedLane: 'specific',
          exploredRoleTitles: [],
          outputs: {},
          done: [],
          profile: {},
          savedPlaybooks: [rec(1), rec(2), rec(3)],
        },
      }),
    }))
    await page.goto(DEV_URL)
    await page.locator(INPUT).waitFor({ state: 'visible', timeout: 15000 })

    await page.locator(`text=${RECAP_TEXT}`).first().waitFor({ state: 'attached', timeout: 10000 })
    await page.waitForTimeout(500)

    check(sessionOpenRequests === 1, `the session-open trigger fires exactly once for a flagged account with three pipeline records (saw ${sessionOpenRequests})`)
    const texts = await page.locator(ASSISTANT_MSG).allTextContents()
    check(!texts.some(t => t.includes(INTRO_TEXT)),
      `the generic seed is replaced, not left stacked above the recap, even with three records loaded (saw: ${JSON.stringify(texts)})`)
    check(texts.filter(t => t.includes(RECAP_TEXT)).length === 1,
      'the recap text appears exactly once')

    await context.close()
  } finally {
    await browser.close()
  }

  if (failures) {
    console.error(`test-coach-session-recap-three-records-browser: ${failures} check(s) failed`)
    process.exit(1)
  } else {
    console.log('test-coach-session-recap-three-records-browser: OK (the session-open trigger fires exactly once and replaces the seed correctly for a flagged account carrying three pipeline records, matching the reported shape -- the client-side mechanism the server-side naming fix depends on)')
  }
}

run().catch(e => { console.error(e); process.exit(1) })
