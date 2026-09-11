// F1 twenty-minute session (2026-09-11), item 1: reproduces Bob's exact
// observed shape -- Row A (coach-intro) fired for a RETURNING account with
// a built Personal Brand and three pipeline records. Root cause: outputs/
// done both start at their pre-load empty defaults on every mount (App.jsx's
// initStep is unconditionally 'welcome', regardless of where hydration will
// eventually route the account), and hasOnboardingConcierge flips true as
// soon as /api/me resolves -- a full fetch earlier than /api/profile/load,
// which is what actually carries outputs.p3. In that window, coach-intro's
// eligibility (done.length===0 && !outputs.p3) read the empty pre-load
// state as "genuinely first-time," not this account's real one. The same
// race let the search-intake hub_arrival prompt stack right alongside it
// for the identical reason.
//
// This test does not need an artificial network delay to reproduce the
// race: the mocked /api/profile/load response IS the account's real,
// built-brand state, but React's first render always happens synchronously
// before any fetch (mocked or real) can resolve -- that gap is the window
// both the old coach-intro and the old search-intake effect read as
// "nothing loaded yet, so nothing is really there."
import { chromium } from 'playwright'
import { existsSync } from 'node:fs'
import { DEV_URL, VIEWPORT, INPUT, dismissCookieBanner } from './browser-tests/page-helpers.mjs'
import { mockBackend } from './browser-tests/mock-backend.mjs'
import { DOOR2_RECORD, DOOR2_TITLE } from './browser-tests/fixtures.mjs'

const EXECUTABLE_PATH = existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome')
  ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
  : undefined

const ASSISTANT_MSG = '[data-message-role="assistant"]'
// Marker text unique to Row A's own message (src/coach-moments.js,
// coach-intro) -- not shared with any other catalog entry or seed message.
const ROW_A_MARKER = "I'm your coach, and I'm with you for the whole search."
const SEARCH_INTAKE_MARKER = "What's going well in your search right now?"

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } else { console.log(`  ok   ${msg}`) } }

async function run() {
  const browser = await chromium.launch({ executablePath: EXECUTABLE_PATH, args: ['--disable-features=Translate,AutofillServerCommunication'] })
  try {
    const context = await browser.newContext({ viewport: VIEWPORT })
    const page = await context.newPage()
    await dismissCookieBanner(page)
    await mockBackend(page, { flagged: true, onboardingConcierge: true, step: 'op' })
    // Last-registered wins (Playwright route precedence): overrides
    // mockBackend's own /api/profile/load so the top-level outputs/done
    // this test actually needs to reason about (a built Personal Brand,
    // landing on 'op') are not forced empty the way buildProfileLoadResponse
    // forces them for step:'op' by default.
    const rec = (n) => ({ ...DOOR2_RECORD, id: `test-hydration-race-${n}`, title: `${DOOR2_TITLE} ${n}`, sections: { ...DOOR2_RECORD.sections } })
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
          outputs: { p3: 'A built Personal Brand: the Golden Thread, Triangulation, and Where This Transfers, already generated for this account.' },
          done: ['p3'],
          profile: {},
          savedPlaybooks: [rec(1), rec(2), rec(3)],
        },
      }),
    }))
    await page.goto(DEV_URL)
    // Not waiting on RAIL: this account's shape (done includes 'p3', three
    // saved playbooks) also satisfies the app's own returning-explorer
    // landing redirect (App.jsx, gated on the same hydrationStable this fix
    // adds to coach-intro), which can route a returning account to My
    // Pipeline/My Library rather than straight into a specific Playbook --
    // exactly the realistic behavior fixtures.mjs documents for this same
    // account shape. RAIL (Playbook-only) is not guaranteed to render;
    // INPUT (the coach composer) is present across every post-onboarding
    // screen this account could land on, so it is the only wait this test
    // needs.
    await page.locator(INPUT).waitFor({ state: 'visible', timeout: 15000 })
    await page.locator(`${INPUT}:not([disabled])`).waitFor({ state: 'visible', timeout: 10000 })
    // Give the evaluator every chance to have wrongly fired Row A/search-
    // intake during the pre-hydration window if the gate were broken,
    // rather than passing by accident on a race.
    await page.waitForTimeout(800)

    const texts = await page.locator(ASSISTANT_MSG).allTextContents()
    const combined = texts.join(' ||| ')
    check(!combined.includes(ROW_A_MARKER),
      `Row A does not fire for a returning account with a built Personal Brand and three pipeline records (transcript: ${JSON.stringify(combined.slice(0, 300))})`)
    check(!combined.includes(SEARCH_INTAKE_MARKER),
      `The search-intake question does not stack alongside a (correctly suppressed) Row A during the same pre-hydration window`)

    await context.close()
  } finally {
    await browser.close()
  }

  if (failures) {
    console.error(`test-coach-intro-hydration-race: ${failures} check(s) failed`)
    process.exit(1)
  } else {
    console.log('test-coach-intro-hydration-race: OK (a returning account with a built Personal Brand and three pipeline records never sees Row A or the search-intake question, even during the pre-hydration window before outputs/done load)')
  }
}

run().catch(e => { console.error(e); process.exit(1) })
