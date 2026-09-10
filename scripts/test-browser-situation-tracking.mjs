// First browser tests in this repo. Written to the symptoms Bob's
// production test reported on c0b6f0a, and they must fail on that commit
// before the fix in this PR:
//
//   - clicking Compensation Read (unbuilt, short) with Interview Prep built
//     and long right after it reported Interview Prep instead
//   - clicking Networking Groups (unbuilt, short) with Recruiters built
//     right after it reported Recruiters instead
//
// Both times the clicked heading sat under the sticky chrome while the next
// section's heading was fully visible, and the old observer -- which
// watched the <h2> HEADING rather than the section's own container, and
// picked by raw intersection ratio with no regard for what the app had just
// done -- reported that next section instead.
//
// Runs against a real headless Chromium (the one pre-installed in this
// environment; see EXECUTABLE_PATH below for portability) driving the Vite
// dev server, with every backend call intercepted at the network layer
// (scripts/browser-tests/mock-backend.mjs) -- no real account, no database,
// no Anthropic call. The client code that builds and sends each /api/coach
// request runs identically either way, which is the only thing these tests
// need to be true. Fixture data: scripts/browser-tests/fixtures.mjs.
//
// The path from a click to a request, after this PR's fix: clicking a rail
// row calls scrollToOutput, which sets activeSectionRef (and locks the
// IntersectionObserver fallback out) synchronously, in the same tick as the
// click -- before the smooth-scroll animation even starts -- so whatever
// /api/coach request Chat's send() builds next reads that value live via
// getSituation(), regardless of where the scroll animation has or hasn't
// settled by the time the person finishes typing.
//
// NOT wired into the standing `npm run test` chain (package.json's `test`
// script, which gates every `npm run build`/prebuild locally). That chain
// is plain Node, dependency-free, and runs on every build on every machine;
// folding a real-Chromium E2E suite into it would make routine local builds
// depend on Playwright's browser binaries being present and working
// everywhere Code or Bob runs `npm run build`, which nothing currently
// requires. No GitHub Actions workflow runs `npm run build`/`npm run test`
// at all today (the only CI job is the api/* preview smoke, a separate
// dependency-free script against a live deployment) -- so there is no
// automated pipeline this suite would need to slot into yet, either. It
// gets its own script instead: `npm run test:browser`, run manually (or
// wired into a future CI job) same as `npm run smoke:preview` already is.
//
// Extended 2026-09-10 (item 12, the concierge batch brief): scenarios 7 and
// 8 run the same rail-click sweep and a new composer-visibility check
// against a coach_presence-FLAGGED account, so the embedded concierge panel
// (App.jsx's conciergeEmbedded) is the surface under test, not just the
// ordinary floating bubble scenarios 1-6 exercise. The account-bootstrap
// helpers (newFocusPage/newFlaggedFocusPage and friends) moved out to
// ./browser-tests/page-helpers.mjs so a second suite can reuse the same two
// account shapes without copying selectors.
import { chromium } from 'playwright'
import { mockBackend, waitForCoachRequest } from './browser-tests/mock-backend.mjs'
import {
  DEV_URL, VIEWPORT, RAIL, INPUT,
  dismissCookieBanner, openFloatingCoach, openEmbeddedCoach,
  newFocusPage, newFlaggedFocusPage, clickRailSection, askWhereAmI,
} from './browser-tests/page-helpers.mjs'
import { existsSync } from 'node:fs'

const EXECUTABLE_PATH = existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome')
  ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
  : undefined // falls back to Playwright's own managed browser elsewhere

// VIEWPORT (1280x1000, taller than Playwright's 720px default), RAIL/INPUT
// selectors, dismissCookieBanner, openFloatingCoach/openEmbeddedCoach,
// clickRailSection, askWhereAmI, and the newFocusPage/newFlaggedFocusPage
// bootstrap helpers all now live in ./browser-tests/page-helpers.mjs (split
// out 2026-09-10 so the live-side concierge PR 1 browser tests can reuse
// the same two account shapes -- see that file's header comment).

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } else { console.log(`  ok   ${msg}`) } }

const FOCUS_LABELS = {
  p5: 'The Role', p6: 'Your Bridge Story', p9: 'Industry Background', salaryRead: 'Compensation Read',
  p11: 'Interview Prep', p_res: 'Resume Refresh', p8: 'LinkedIn Remix', p7: 'Go-to-Market',
  groups: 'Networking Groups', recruiters: 'Recruiters for This Path', income: 'Income Now',
}
const FOCUS_ORDER_IDS = ['p5', 'p6', 'p9', 'salaryRead', 'p11', 'p_res', 'p8', 'p7', 'groups', 'recruiters', 'income']

async function run() {
  // Chrome's own autofill/account-sync background features try to reach
  // Google's servers on every page even though nothing here uses them; in a
  // network-restricted environment those attempts hang rather than failing
  // fast, and were observed stalling page readiness well past 30s. Disabled
  // outright -- this suite has no use for either.
  const browser = await chromium.launch({ executablePath: EXECUTABLE_PATH, args: ['--disable-features=Translate,AutofillServerCommunication'] })

  try {
    // --- Scenario 1: Compensation Read (unbuilt, short) next to Interview
    // Prep (built, long) -- Bob's first reproduction case. ---
    {
      const { context, page, coachRequests } = await newFocusPage(browser)
      await clickRailSection(page, FOCUS_LABELS.salaryRead)
      await page.waitForTimeout(400) // let the smooth-scroll settle before asking
      const section = await askWhereAmI(page, coachRequests)
      check(section === 'salaryRead', `Compensation Read click reports salaryRead (got ${JSON.stringify(section)})`)
      await context.close()
    }

    // --- Scenario 2: Networking Groups (unbuilt, short) next to Recruiters
    // (built) -- Bob's second reproduction case. ---
    {
      const { context, page, coachRequests } = await newFocusPage(browser)
      await clickRailSection(page, FOCUS_LABELS.groups)
      await page.waitForTimeout(400)
      const section = await askWhereAmI(page, coachRequests)
      check(section === 'groups', `Networking Groups click reports groups (got ${JSON.stringify(section)})`)
      await context.close()
    }

    // --- Scenario 3: Income Now, the LAST section -- the page cannot
    // scroll it all the way to the top, since there is no more content
    // below it to scroll past. Exercises the edge case where scrollIntoView
    // lands short of its usual position. ---
    {
      const { context, page, coachRequests } = await newFocusPage(browser)
      await clickRailSection(page, FOCUS_LABELS.income)
      await page.waitForTimeout(400)
      const section = await askWhereAmI(page, coachRequests)
      check(section === 'income', `Income Now click (last section, cannot reach the top) reports income (got ${JSON.stringify(section)})`)
      await context.close()
    }

    // --- Scenario 4: the eleven-click sweep, each id in turn, one shared
    // session (clicking through the whole rail in FOCUS_ORDER). ---
    {
      const { context, page, coachRequests } = await newFocusPage(browser)
      for (const id of FOCUS_ORDER_IDS) {
        await clickRailSection(page, FOCUS_LABELS[id])
        await page.waitForTimeout(400)
        const section = await askWhereAmI(page, coachRequests)
        check(section === id, `Eleven-click sweep: clicking "${FOCUS_LABELS[id]}" reports ${id} (got ${JSON.stringify(section)})`)
      }
      await context.close()
    }

    // --- Scenario 5: the observer fallback. Click The Role (authoritative,
    // locks the observer out), then scroll further by wheel -- a genuine
    // user gesture, which must release the lock -- down to Industry
    // Background (the next section, since Your Bridge Story is left
    // unbuilt/short in the fixture) and confirm the observer picks it up. ---
    {
      const { context, page, coachRequests } = await newFocusPage(browser)
      await clickRailSection(page, FOCUS_LABELS.p5)
      await page.waitForTimeout(400)
      const afterClick = await askWhereAmI(page, coachRequests)
      check(afterClick === 'p5', `Fallback scenario: clicking The Role reports p5 before any scrolling (got ${JSON.stringify(afterClick)})`)
      // Genuine scroll gesture, not scrollIntoView -- this is what must
      // release the section lock (onKeyDown, App.jsx ~11346, releases on
      // ArrowDown same as onWheel does on a wheel event). Click at x=600
      // first to give the content column keyboard focus: left of it (up to
      // ~535) is the 200px section rail, right of it (from ~693 on this
      // VIEWPORT) is the open coach panel (min(44vw,620px) anchored to the
      // right edge). ArrowDown, not page.mouse.wheel: confirmed by direct
      // measurement that Playwright's synthetic wheel events land correctly
      // (release fires, scrollTop moves) but the browser's own
      // IntersectionObserver in this headless environment stops delivering
      // further threshold-crossing entries after the first couple of wheel
      // ticks, even though the DOM keeps moving -- an environment quirk in
      // how CDP-dispatched wheel input reaches the compositor's intersection
      // scheduling, not a defect in the fix (a real user's mouse wheel does
      // not go through CDP). Small ArrowDown increments, polled after each
      // and stopped the moment Industry Background's own container spans
      // the top of the viewport, land precisely in its narrow (short,
      // unbuilt) window without overshooting into whatever built section
      // follows it.
      await page.mouse.move(600, 400)
      await page.mouse.click(600, 400)
      let landedOnP9 = false
      for (let i = 0; i < 200; i++) {
        await page.keyboard.press('ArrowDown')
        await page.waitForTimeout(30)
        const spans = await page.evaluate(() => {
          const el = document.getElementById('section-p9')
          if (!el) return false
          const r = el.getBoundingClientRect()
          return r.top <= 0 && r.bottom >= 0
        })
        if (spans) { landedOnP9 = true; break }
      }
      check(landedOnP9, 'Fallback scenario: ArrowDown scrolling reaches Industry Background\'s own container')
      await page.waitForTimeout(400)
      const afterWheel = await askWhereAmI(page, coachRequests)
      check(afterWheel === 'p9', `Fallback scenario: wheel-scrolling past The Role releases the lock and reports p9 (got ${JSON.stringify(afterWheel)})`)
      await context.close()
    }

    // --- Scenario 6: one Opportunity Playbook case -- a short/unbuilt card
    // (About This Company) immediately followed by a long/built one (Where
    // you fit), the same short-then-long shape as the Focus Playbook
    // repro cases, confirming the fix covers both surfaces. ---
    {
      const { context, page, coachRequests } = await newFocusPage(browser, { step: 'op' })
      await clickRailSection(page, 'About This Company')
      await page.waitForTimeout(400)
      const section = await askWhereAmI(page, coachRequests)
      check(section === 'companyRead', `Opportunity Playbook: About This Company (short/unbuilt, next to a long built card) reports companyRead (got ${JSON.stringify(section)})`)
      await context.close()
    }

    // --- Scenario 7 (item 12, 2026-09-10): the eleven-click sweep repeated
    // against a coach_presence-flagged account, so it exercises the
    // embedded concierge panel (conciergeEmbedded=true) as the surface
    // under test, not just the floating bubble every non-flagged account
    // sees. Same fixture, same assertions as scenario 4 -- only the account
    // shape (and therefore which Chat variant renders) differs. ---
    {
      const { context, page, coachRequests } = await newFlaggedFocusPage(browser)
      for (const id of FOCUS_ORDER_IDS) {
        await clickRailSection(page, FOCUS_LABELS[id])
        await page.waitForTimeout(400)
        const section = await askWhereAmI(page, coachRequests)
        check(section === id, `Flagged/embedded eleven-click sweep: clicking "${FOCUS_LABELS[id]}" reports ${id} (got ${JSON.stringify(section)})`)
      }
      await context.close()
    }

    // --- Scenario 8 (item 12, 2026-09-10): composer-visibility check on the
    // embedded panel. #846 replaced a JS-measured maxHeight with a genuine
    // CSS flex height chain specifically so a long reply can never push the
    // composer (input/mic/Send) out of view -- Bob's screenshot on 7bb7f91
    // showed exactly that happening under the old measurement, with the
    // composer's box still technically present in the DOM but clipped out
    // of the panel's visible area by its overflow:hidden ancestor. A plain
    // boundingBox() read doesn't catch that (a clipped element still
    // reports a box), so this asks the browser what element actually
    // paints at the input's and the Send button's own center point --
    // document.elementFromPoint -- which a clipped/covered element fails,
    // and a genuinely visible one passes. ---
    {
      const longReply = Array.from({ length: 20 }, (_, i) =>
        `Paragraph ${i + 1} of a deliberately long reply, long enough that a panel sized by a stale JS measurement would let it push the composer out of view.`
      ).join('\n\n')
      const { context, page } = await newFlaggedFocusPage(browser, { coachReplyBody: longReply })
      const input = page.locator(INPUT)
      const sendBtn = page.locator('button', { hasText: /^(Send|Stop)$/ })
      await input.fill('Give me a long reply.')
      await input.press('Enter')
      // Wait for the mocked reply's own text to actually render, not just
      // the request firing -- the composer-visibility risk is specifically
      // about the panel's layout AFTER a tall transcript renders.
      await page.locator('text=Paragraph 20 of a deliberately long reply').waitFor({ state: 'visible', timeout: 10000 })

      const paintsAt = async (locator) => {
        const box = await locator.boundingBox()
        if (!box) return false
        const cx = box.x + box.width / 2
        const cy = box.y + box.height / 2
        return page.evaluate(([x, y]) => {
          const el = document.elementFromPoint(x, y)
          return !!(el && el.closest('textarea, button'))
        }, [cx, cy])
      }

      check(await paintsAt(input), 'Composer-visibility check: the input actually paints at its own center point after a long reply (not clipped by an overflow:hidden ancestor)')
      check(await paintsAt(sendBtn), 'Composer-visibility check: the Send/Stop button actually paints at its own center point after a long reply')
      await context.close()
    }
  } finally {
    await browser.close()
  }

  if (failures) {
    console.error(`test-browser-situation-tracking: ${failures} check(s) failed`)
    process.exit(1)
  } else {
    console.log('test-browser-situation-tracking: OK (all eleven Focus Playbook sections, the last-section scroll edge case, the wheel-scroll fallback, one Opportunity Playbook short-then-long case, the eleven-click sweep on a flagged/embedded account, and the embedded-panel composer-visibility check all pass)')
  }
}

run().catch(e => { console.error(e); process.exit(1) })
