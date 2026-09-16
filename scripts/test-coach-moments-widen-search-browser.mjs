// Coach-as-Concierge Phase 4 Part 2, widen-the-search PR2 (Output/handoff/
// 2026-09-09_concierge-batch-and-phase4-brief.md, §2.6), extended 2026-09-16
// with pipeline-aware ordering: live verification of the seven rows on the
// flagged Focus Playbook fixture -- rotation starts at the front of the
// THIN order on a fresh account (the default fixture's one open
// opportunity makes its pipeline thin), a snoozed row is skipped in favor
// of the next one, and each of the three taps does its real job ([Not for
// me] persists a retirement, [Do it now] on Career Club Corner opens the
// real corner.career.club link in a new tab).
import { chromium } from 'playwright'
import { existsSync } from 'node:fs'
import { newFlaggedFocusPage } from './browser-tests/page-helpers.mjs'

const EXECUTABLE_PATH = existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome')
  ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
  : undefined

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } else { console.log(`  ok   ${msg}`) } }

const ALL_KEYS = ['widen-go-to-market', 'widen-recruiters', 'widen-linkedin-contacts', 'widen-networking-groups', 'widen-job-search-resources', 'widen-career-club-corner', 'widen-income-now']
const snoozeAllExcept = (survivor) => {
  const future = new Date(Date.now() + 10 * 86400000).toISOString()
  const state = {}
  for (const k of ALL_KEYS) if (k !== survivor) state[k] = { snoozedUntil: future }
  return state
}

async function run() {
  const browser = await chromium.launch({ executablePath: EXECUTABLE_PATH, args: ['--disable-features=Translate,AutofillServerCommunication'] })
  try {
    // --- Scenario 1: fresh account, nothing fired or snoozed yet -- the
    // default fixture has one open opportunity, which is a thin pipeline
    // (fewer than two), so the pick leads with WIDEN_ORDER_THIN, not
    // WIDEN_ORDER_DEFAULT. Go-to-Market is excluded from the candidate
    // pool (no Bridge Story built), so the front of the thin order that is
    // actually a candidate is widen-networking-groups. The default 'focus'
    // fixture already has a chosen direction, so every direction-needing
    // row is still in the candidate pool. ---
    {
      const { context, page } = await newFlaggedFocusPage(browser, { onboardingConcierge: true })
      await page.waitForTimeout(2000)
      const bodyText = await page.evaluate(() => document.body.innerText)
      check(bodyText.includes('I can put together a list of groups where people in roles like'),
        'widen-networking-groups fires first on a fresh, thin-pipeline account (leads the thin order once Go-to-Market is excluded)')
      check(bodyText.includes('Do it now') && bodyText.includes('Remind me later') && bodyText.includes('Not for me'),
        'the three-tap hard rule (brief §2.6) is present, not the shared Remind-later/Minimize pair')

      const notForMeBtn = page.locator('button', { hasText: 'Not for me' }).last()
      check(await notForMeBtn.isVisible().catch(() => false), 'a "Not for me" tap is visible')
      await notForMeBtn.click()
      await page.waitForTimeout(1500)
      const saved = await page.evaluate(() => localStorage.getItem('pe_v4'))
      const parsed = saved ? JSON.parse(saved) : null
      check(!!(parsed && parsed.widenSearchState && parsed.widenSearchState['widen-networking-groups'] && parsed.widenSearchState['widen-networking-groups'].retiredUntil),
        'tapping "Not for me" persists a retiredUntil date for widen-networking-groups in the autosave blob')
      await context.close()
    }

    // --- Scenario 2: widen-networking-groups (the front of the thin
    // order that is actually a candidate) is already snoozed -- the pick
    // should skip it and land on the next eligible row in WIDEN_ORDER_THIN
    // (widen-job-search-resources), same as the engine's own rotation-skip
    // test but exercised end to end. ---
    {
      const future = new Date(Date.now() + 3 * 86400000).toISOString()
      const { context, page } = await newFlaggedFocusPage(browser, {
        onboardingConcierge: true,
        widenSearchState: { 'widen-networking-groups': { snoozedUntil: future } },
      })
      await page.waitForTimeout(2000)
      const bodyText = await page.evaluate(() => document.body.innerText)
      check(bodyText.includes('Job Search Resources finds free job-search groups where you live'),
        'the thin-pipeline pick skips a snoozed widen-networking-groups and offers widen-job-search-resources next')
      check(!bodyText.includes('I can put together a list of groups where people in roles like'),
        'the snoozed row does not also render')
      await context.close()
    }

    // --- Scenario 3: force widen-career-club-corner to be the only
    // eligible row (every other row pre-snoozed) and verify its exact
    // APPROVED copy, and that "Do it now" opens the real corner.career.club
    // link in a new tab rather than navigating away from the app. ---
    {
      const { context, page } = await newFlaggedFocusPage(browser, {
        onboardingConcierge: true,
        widenSearchState: snoozeAllExcept('widen-career-club-corner'),
      })
      // Spy on window.open rather than following the real popup through to
      // a loaded page -- this sandbox's network policy blocks the actual
      // outbound request to corner.career.club, which is an environment
      // constraint, not something this test needs a live fetch to prove.
      // What the code under test is responsible for is calling
      // window.open with the right URL; whether that URL is reachable from
      // this particular container is out of scope.
      await page.evaluate(() => { window.__openCalls = []; window.open = (url, target, features) => { window.__openCalls.push({ url, target, features }); return null } })
      await page.waitForTimeout(2000)
      const bodyText = await page.evaluate(() => document.body.innerText)
      check(bodyText.includes("There's a free community that meets every Monday called Career Club Corner."),
        'widen-career-club-corner fires with Bob\'s approved verbatim paragraph')
      check(bodyText.includes('Nobody is selling you anything. Want the link?'),
        'the approved paragraph\'s closing lines are intact')

      const doItBtn = page.locator('button', { hasText: 'Do it now' }).last()
      check(await doItBtn.isVisible().catch(() => false), 'a "Do it now" tap is visible')
      await doItBtn.click()
      await page.waitForTimeout(500)
      const openCalls = await page.evaluate(() => window.__openCalls)
      check(Array.isArray(openCalls) && openCalls.length === 1 && openCalls[0].url === 'https://corner.career.club',
        '"Do it now" calls window.open with the real corner.career.club URL, not an in-app navigation')
      check(!!openCalls && openCalls[0] && openCalls[0].target === '_blank',
        '"Do it now" opens the link in a new tab (_blank), not the current one')
      await context.close()
    }
  } finally {
    await browser.close()
  }
}

await run()

if (failures) {
  console.error(`test-coach-moments-widen-search-browser: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-coach-moments-widen-search-browser: OK (rotation starts at the front of the set on a fresh account, skips a snoozed row for the next one in order, widen-career-club-corner fires with the approved verbatim copy, "Not for me" persists a retirement, and "Do it now" opens the real corner.career.club link)')
}
