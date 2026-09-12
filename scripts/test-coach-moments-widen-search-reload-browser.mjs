// Production fix (2026-09-12 live QA on bob+lindsey@career.club): live testing
// found that reloading the page re-fires an unprompted widen-the-search offer
// (brief §2.6's one-per-session rule), and a second reload re-fires the exact
// same offer again, verbatim, as a duplicate message. Root cause (see
// test-coach-moments-hydration-gate.mjs and App.jsx's widenSearchOfferedThis
// SessionRef): the Moments evaluator had no gate stopping it from running
// against coachMoments' un-hydrated useState({}) default on mount, and the
// session pacing ref was a bare useRef(false) that reset to false on every
// page load instead of surviving the tab via sessionStorage. This is the
// browser-level regression test the bug report itself required before
// shipping the fix -- it reloads mid-session, twice, on the exact fixture
// (a fresh flagged account, rotation starting at widen-recruiters) the
// report's own repro used, and asserts neither symptom recurs.
import { chromium } from 'playwright'
import { existsSync } from 'node:fs'
import { newFlaggedFocusPage, openEmbeddedCoach, RAIL } from './browser-tests/page-helpers.mjs'

const EXECUTABLE_PATH = existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome')
  ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
  : undefined

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } else { console.log(`  ok   ${msg}`) } }

const FIRST_OFFER = 'Recruiters for This Path builds a list of the recruiters'
const SECOND_OFFER = 'Loading your LinkedIn contacts lets Who You Know Here'
const countOf = (text, needle) => (text.match(new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length

async function reloadAndSettle(page) {
  await page.reload()
  await page.locator(RAIL).waitFor({ state: 'visible', timeout: 30000 })
  await openEmbeddedCoach(page)
  // Give the local (pe_v4) hydration effect, the server /api/profile/load
  // effect, and the Moments evaluator's own re-run (gated on hydrationStable)
  // time to settle before reading the transcript -- same margin the sibling
  // browser tests use after a fresh load.
  await page.waitForTimeout(2000)
}

async function run() {
  const browser = await chromium.launch({ executablePath: EXECUTABLE_PATH, args: ['--disable-features=Translate,AutofillServerCommunication'] })
  try {
    // Fresh flagged account, nothing fired or snoozed yet -- the exact shape
    // of the report's own repro (bob+lindsey@career.club's My Pipeline):
    // rotation with no lastOfferedKey starts at widen-recruiters.
    const { context, page } = await newFlaggedFocusPage(browser, { onboardingConcierge: true })

    await page.waitForTimeout(2000)
    const initial = await page.evaluate(() => document.body.innerText)
    check(countOf(initial, FIRST_OFFER) === 1,
      'widen-recruiters fires once on first load (baseline before any reload)')

    // Let the debounced autosave (App.jsx, 800ms) flush coachMoments'
    // dedupe write to localStorage's pe_v4 before reloading -- a reload
    // that races ahead of the autosave would be testing a different bug
    // (a lost write) than the one reported (a hydration race on a write
    // that DID land).
    await page.waitForTimeout(1500)

    // --- Repro step 2: reload with no taps in between. Before the fix,
    // this fired a SECOND, different widen-the-search offer
    // ("Load your LinkedIn contacts") because the evaluator ran against
    // an empty coachMoments before hydration replaced it, and the session
    // pacing ref had reset to false. ---
    await reloadAndSettle(page)
    let bodyText = await page.evaluate(() => document.body.innerText)
    check(!bodyText.includes(SECOND_OFFER),
      'reloading once does not fire a second, different widen-the-search offer (repro step 2)')
    check(countOf(bodyText, FIRST_OFFER) === 1,
      'the original widen-recruiters offer still appears exactly once after one reload, not duplicated')

    // --- Repro step 3: reload again. Before the fix, this re-fired the
    // exact same second offer a third time, verbatim, as a new message --
    // a straight duplicate of a dedupe-keyed message. ---
    await reloadAndSettle(page)
    bodyText = await page.evaluate(() => document.body.innerText)
    check(!bodyText.includes(SECOND_OFFER),
      'reloading a second time still does not fire (or duplicate) any widen-the-search offer (repro step 3)')
    check(countOf(bodyText, FIRST_OFFER) === 1,
      'the original widen-recruiters offer still appears exactly once after two reloads, not duplicated')

    // sessionStorage (not localStorage) is the pacing ref's whole point --
    // confirm it actually survived the reloads rather than the assertions
    // above passing for an unrelated reason (e.g. the transcript simply
    // not re-rendering).
    const sessionFlag = await page.evaluate(() => { try { return sessionStorage.getItem('pe_widen_search_offered_session') } catch { return null } })
    check(sessionFlag === 'true',
      'the session pacing flag survived both reloads in sessionStorage, which is what actually stops the re-offer')

    await context.close()
  } finally {
    await browser.close()
  }
}

await run()

if (failures) {
  console.error(`test-coach-moments-widen-search-reload-browser: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-coach-moments-widen-search-reload-browser: OK (reloading mid-session, twice, fires no second widen-the-search offer and no duplicate of the original -- the exact repro from the 2026-09-12 live QA bug report)')
}
