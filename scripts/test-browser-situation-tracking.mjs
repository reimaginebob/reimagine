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
import { chromium } from 'playwright'
import { mockBackend, waitForCoachRequest } from './browser-tests/mock-backend.mjs'
import { existsSync } from 'node:fs'

const DEV_URL = process.env.SITUATION_TEST_URL || 'http://localhost:5173'
const EXECUTABLE_PATH = existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome')
  ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
  : undefined // falls back to Playwright's own managed browser elsewhere

// Taller than Playwright's 720px default. At 720, the rail's own maxHeight
// formula (calc(100dvh - 80px), src/components/PlaybookSectionRail.jsx) and
// its actual sticky offset once stuck (measured: the content column's own
// top plus 16px) disagree by several pixels, so the last row (Income Now)
// renders with its clickable center just past the viewport's clipped
// bottom edge -- confirmed by direct measurement, not app behavior this
// suite is testing. A taller viewport (matching a real laptop screen far
// more than 720px does) removes that incidental clip without masking it;
// scenario 3 below still exercises the genuine "last section, cannot
// scroll further" edge case the task asked for.
const VIEWPORT = { width: 1280, height: 1000 }

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } else { console.log(`  ok   ${msg}`) } }

const FOCUS_LABELS = {
  p5: 'The Role', p6: 'Your Bridge Story', p9: 'Industry Background', salaryRead: 'Compensation Read',
  p11: 'Interview Prep', p_res: 'Resume Refresh', p8: 'LinkedIn Remix', p7: 'Go-to-Market',
  groups: 'Networking Groups', recruiters: 'Recruiters for This Path', income: 'Income Now',
}
const FOCUS_ORDER_IDS = ['p5', 'p6', 'p9', 'salaryRead', 'p11', 'p_res', 'p8', 'p7', 'groups', 'recruiters', 'income']

// CSS/attribute locators throughout, not Playwright's role/accessible-name
// engine (getByRole/getByPlaceholder) -- observed in this environment
// matching against a live aria-label reliably while the same element's
// computed ARIA role+name did not, for reasons not worth chasing down here.
const RAIL = 'nav[aria-label="Playbook sections"]'
const INPUT = 'textarea[placeholder="Ask your coach anything. Shift+Enter for a new line."]'
const OPEN_COACH = 'button[aria-label*="Open My Coach"]'

async function openCoach(page) {
  await page.locator(OPEN_COACH).click()
  await page.locator(INPUT).waitFor({ state: 'visible', timeout: 10000 })
  // Opening the panel can itself fire a silent, un-typed request (the
  // returning-session opening recap, Chat.jsx's sessionOpenEligible effect
  // -- gated on hasNextStep, which this fixture's account carries). Chat's
  // send() no-ops while `loading` is true (Chat.jsx ~518), and the
  // textarea is disabled the same way, so typing here before that settles
  // would submit into a no-op and the test would hang waiting on a
  // request that was never sent. Waiting for the enabled state clears
  // that race without hardcoding which silent turns exist.
  await page.locator(`${INPUT}:not([disabled])`).waitFor({ state: 'visible', timeout: 10000 })
}

// Types "Where am I?" and sends it, returning the situation.section the next
// captured /api/coach request carried. Baseline is taken before the send so
// a silent turn (session-open recap, a capture offer) that lands in the gap
// between an earlier await and this call can never be mistaken for our own
// message's request.
async function askWhereAmI(page, coachRequests) {
  const baseline = coachRequests.length
  const input = page.locator(INPUT)
  await input.fill('Where am I?')
  await input.press('Enter')
  const body = await waitForCoachRequest(coachRequests, { count: baseline + 1 })
  return body && body.situation ? body.situation.section : undefined
}

async function clickRailSection(page, label) {
  const btn = page.locator(RAIL).locator('button', { hasText: label }).first()
  // Explicit native scrollIntoView, not Playwright's own actionability
  // auto-scroll: the rail sits inside a scrollable content column nested
  // inside a sticky rail with its own bounded height, and Playwright's
  // heuristic left the last row's clickable center a few pixels past the
  // viewport's clipped edge in exactly the scenario 3 (Income Now) case.
  // The browser's own scrollIntoView resolves the same nested-ancestor
  // scroll correctly.
  await btn.evaluate(el => el.scrollIntoView({ block: 'center' }))
  await btn.click()
}

// Two other one-time overlays sit above the floating coach bubble the same
// way the cookie banner does (src/CookieBanner.jsx, fixed full-width bar at
// the max z-index) -- the Support Reimagine announcement (App.jsx ~17216,
// a fixed full-viewport scrim gated on seenSupportAnnounce, which itself
// reads straight from this same localStorage key at mount). All three are
// pre-acknowledged the same way a real returning visitor's browser already
// has them, so they never intercept a click meant for the app underneath.
async function dismissCookieBanner(page) {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('reimagine_cookie_acknowledged_v1', '1')
      localStorage.setItem('reimagine_support_announce_v1_dismissed', '1')
    } catch {}
  })
}

async function newFocusPage(browser) {
  const context = await browser.newContext({ viewport: VIEWPORT })
  const page = await context.newPage()
  await dismissCookieBanner(page)
  const { coachRequests } = await mockBackend(page, { step: 'focus' })
  await page.goto(DEV_URL)
  await page.locator(RAIL).waitFor({ state: 'visible', timeout: 30000 })
  await openCoach(page)
  return { context, page, coachRequests }
}

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
      const context = await browser.newContext({ viewport: VIEWPORT })
      const page = await context.newPage()
      await dismissCookieBanner(page)
      const { coachRequests } = await mockBackend(page, { step: 'op' })
      await page.goto(DEV_URL)
      await page.locator(RAIL).waitFor({ state: 'visible', timeout: 30000 })
      await openCoach(page)
      await clickRailSection(page, 'About This Company')
      await page.waitForTimeout(400)
      const section = await askWhereAmI(page, coachRequests)
      check(section === 'companyRead', `Opportunity Playbook: About This Company (short/unbuilt, next to a long built card) reports companyRead (got ${JSON.stringify(section)})`)
      await context.close()
    }
  } finally {
    await browser.close()
  }

  if (failures) {
    console.error(`test-browser-situation-tracking: ${failures} check(s) failed`)
    process.exit(1)
  } else {
    console.log('test-browser-situation-tracking: OK (all eleven Focus Playbook sections, the last-section scroll edge case, the wheel-scroll fallback, and one Opportunity Playbook short-then-long case all report the correct situation.section)')
  }
}

run().catch(e => { console.error(e); process.exit(1) })
