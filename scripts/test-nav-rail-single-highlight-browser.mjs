// The "Your work" rail must highlight exactly one row: the screen you are on.
//
// Bob, 2026-09-18: landing on My Pipeline with the Coach panel docked open
// showed My Coach AND My Pipeline both highlighted, and because the two rows
// are adjacent their gold bars and tints merged into one block that read as a
// selected REGION rather than a current page. Cause: every other row asked
// `step === id`, but My Coach asked `coachActive` -- true whenever the chat
// panel is open, which is its default -- so that row was lit no matter where
// the person actually was.
//
// These checks pin the invariant rather than the one symptom: at most one
// primary row carries the active treatment at a time, it is the row for the
// current screen, and it MOVES when you navigate (so the fix cannot degrade
// into "nothing is ever highlighted", which would lose the you-are-here cue).
// Both Coach surfaces are covered -- the embedded/docked panel (flagged
// accounts) and the floating bubble -- because `coachActive` was computed
// differently for each and both were reproduced lit.
import { chromium } from 'playwright'
import { existsSync } from 'node:fs'
import { VIEWPORT, DEV_URL, dismissCookieBanner } from './browser-tests/page-helpers.mjs'
import { mockBackend } from './browser-tests/mock-backend.mjs'
import { buildProfileLoadResponse } from './browser-tests/fixtures.mjs'

const EXECUTABLE_PATH = existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome')
  ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
  : undefined

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } else { console.log(`  ok   ${msg}`) } }

// primaryItemStyle/subItemStyle (src/App.jsx) paint an active row with a solid
// gold left border; an inactive one leaves it fully transparent. Reading the
// computed border is what makes this a real render assertion rather than a
// re-statement of the predicate the component uses.
const ACTIVE_BORDER = 'rgb(200, 146, 74)'

async function railState(page) {
  return page.$$eval('#reimagine-nav [data-step]', els => els
    .map(el => ({ step: el.getAttribute('data-step'), bl: getComputedStyle(el).borderLeftColor }))
  )
}
const activeSteps = rows => rows.filter(r => r.bl === ACTIVE_BORDER).map(r => r.step)

// The dashboard ("Your work") rail only renders once the Personal Brand is
// done. The shared fixture deliberately empties `done` on its pipeline/op
// branch, so re-fulfil the profile load with p3 in it -- registered AFTER
// mockBackend so this route wins.
async function openDashboard(browser, { flagged }) {
  const context = await browser.newContext({ viewport: VIEWPORT })
  const page = await context.newPage()
  await dismissCookieBanner(page)
  await mockBackend(page, { step: 'pipeline', flagged, pursuitStatusRows: [{ record_id: 'test-door2-001', stage: 'applied', updated_at: '2026-09-15T12:00:00.000Z' }] })
  const body = buildProfileLoadResponse({ step: 'pipeline' })
  body.profile.done = ['p3', 'p5', 'p11']
  await page.route('**/api/profile/load', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) }))
  await page.goto(DEV_URL)
  await page.locator('#reimagine-nav [data-step="pipeline"]').waitFor({ state: 'visible', timeout: 30000 })
  // The Coach opens itself on load (docked panel, or the bubble on the other
  // surface) and that is precisely the state that used to light My Coach up,
  // so settle before reading rather than racing the panel's own mount.
  await page.waitForTimeout(2500)
  return { context, page }
}

async function run() {
  const browser = await chromium.launch({ executablePath: EXECUTABLE_PATH, args: ['--disable-features=Translate,AutofillServerCommunication'] })
  try {
    for (const flagged of [true, false]) {
      const surface = flagged ? 'docked panel' : 'floating bubble'
      const { context, page } = await openDashboard(browser, { flagged })

      const coachVisible = await page.locator('textarea[placeholder^="Ask your coach"], button[aria-label*="My Coach"]').first().isVisible().catch(() => false)
      check(coachVisible, `${surface}: the Coach surface is actually present, so this run really exercises the state that caused the bug`)

      const landed = await railState(page)
      check(activeSteps(landed).length === 1, `${surface}: exactly one rail row is highlighted on landing (was My Coach + My Pipeline together) -- got [${activeSteps(landed).join(', ')}]`)
      check(activeSteps(landed)[0] === 'pipeline', `${surface}: the highlighted row is the screen being shown`)
      check(!activeSteps(landed).includes('myCoach'), `${surface}: My Coach is not highlighted while its panel is open -- an open panel is not a location`)

      await page.locator('#reimagine-nav [data-step="mylib"]').click()
      await page.waitForTimeout(600)
      const moved = await railState(page)
      check(activeSteps(moved).length === 1, `${surface}: still exactly one row highlighted after navigating -- got [${activeSteps(moved).join(', ')}]`)
      check(activeSteps(moved)[0] === 'mylib', `${surface}: the highlight MOVES to the newly opened screen, so the you-are-here cue is intact`)
      check(!activeSteps(moved).includes('myCoach'), `${surface}: My Coach stays unhighlighted after navigating`)

      await context.close()
    }
  } finally {
    await browser.close()
  }
}

await run()

if (failures) {
  console.error(`test-nav-rail-single-highlight-browser: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-nav-rail-single-highlight-browser: OK (on both Coach surfaces the rail highlights exactly one row, it is the current screen, My Coach is never lit merely because its panel is open, and the highlight still moves on navigation)')
}
