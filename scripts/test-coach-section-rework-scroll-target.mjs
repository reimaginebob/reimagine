// Batch item 13 (Output/handoff/2026-09-09_concierge-batch-and-phase4-brief.md,
// 2026-09-10 revision), Group 6 -- the decision test for Column 3 of the
// coach-affordance inventory: "on a Focus Playbook, scroll (do not click)
// to a section, type a correction ('change the opening'), assert the
// rework lands on that section. If it passes across the eleven sections,
// the per-section 'Ask My Coach about this' targets can come from the
// Situation and Column 3 collapses into Column 1 at GA."
//
// This runs that scenario, live, against the real dev server -- no rail
// click, and no click on a section's own "Ask My Coach about this," ever,
// in this file (those two are the only things that ever set coachReturn --
// see the empirical result below).
//
// THE EMPIRICAL RESULT, read straight from source before this file was
// written (src/App.jsx ~9277-9295, ~9285): sectionReworkTarget (the sole
// input to the /api/coach request's `returnSection` field, Chat.jsx line
// ~706) is derived exclusively from `coachReturn`, and coachReturn is set
// ONLY by openCoachWith -- which fires ONLY when a section's own "Ask My
// Coach about this" button is clicked. It is cleared by nav() on any
// navigation away from 'myCoach'. No code path anywhere reads
// situation.section (the scroll-tracked field) into that mechanism. So
// scrolling to a section and typing a correction, with no click, should
// send `returnSection: undefined` regardless of which section is on
// screen -- for all eleven sections, every time, by construction, not by a
// bug this PR introduces.
//
// WHAT THIS FILE ACTUALLY VERIFIES, AND WHY THE DESIGN CHANGED MID-WRITE:
// the original design scrolled to each section, then required askWhereAmI
// (situation.section, the mechanism test-browser-situation-tracking.mjs
// already proves reliable for CLICK-driven navigation) to confirm the
// EXACT intended section before checking returnSection. Under a battery of
// diagnosis (bounding-box heuristics, batched ArrowDown keypresses, direct
// `scrollIntoView` in several block alignments, an IntersectionObserver
// instrumentation pass, and a plain-flag-vs-@career.club-email isolation
// check to rule out background Moments turns polluting the request count)
// this fixture reproducibly shows activeSectionRef.current lagging the
// true scroll target -- reliably correct for some sections (p5, the
// initial one; occasionally others), reliably ONE SECTION BEHIND for most
// others, independent of wait length (tried up to 1.5s) or scroll
// mechanism. That is a real timing/scheduling characteristic of this
// fixture's IntersectionObserver + headless-CDP combination (this
// codebase's own test-browser-situation-tracking.mjs documents a related,
// narrower CDP/compositor quirk for synthetic wheel events) -- not
// something this file could resolve by trying a fourth scrolling
// technique, and not the question this file exists to answer.
//
// So rather than gate the returnSection check on hitting each section
// exactly, this file scrolls toward each of the eleven in turn (best
// effort), and for EVERY correction sent -- regardless of which section
// Situation actually reports at that moment -- checks whether returnSection
// matches whatever Situation says. If scroll-driven targeting worked at
// all, at least SOME of these eleven sends should show returnSection
// equal to their own situation.section (the two are computed from the
// same request, atomically -- there is no cross-request lag in that
// comparison, whatever section is live). None do. That is actually a
// STRONGER empirical result than eleven exact hits would have needed to
// be: it shows returnSection is undefined no matter what section Situation
// reports, for a real spread of situations landed on in this run
// (recorded below) -- not narrowly false only for the specific eleven
// targets this file aimed at.
import { chromium } from 'playwright'
import { existsSync } from 'node:fs'
import { waitForCoachRequest } from './browser-tests/mock-backend.mjs'
import { mockBackend } from './browser-tests/mock-backend.mjs'
import { buildMeResponse } from './browser-tests/fixtures.mjs'
import { DEV_URL, VIEWPORT, RAIL, INPUT, dismissCookieBanner, openFloatingCoach } from './browser-tests/page-helpers.mjs'

const EXECUTABLE_PATH = existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome')
  ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
  : undefined

let failures = 0
let situationEverMatchedReturnSection = 0
const results = []
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } else { console.log(`  ok   ${msg}`) } }

const FOCUS_ORDER_IDS = ['p5', 'p6', 'p9', 'salaryRead', 'p11', 'p_res', 'p8', 'p7', 'groups', 'recruiters', 'income']

async function run() {
  const browser = await chromium.launch({ executablePath: EXECUTABLE_PATH, args: ['--disable-features=Translate,AutofillServerCommunication'] })
  try {
    const context = await browser.newContext({ viewport: VIEWPORT })
    const page = await context.newPage()
    await dismissCookieBanner(page)
    const { coachRequests } = await mockBackend(page, { step: 'focus' })
    // Plain (non-internal) email with ONLY the section_rework flag added --
    // deliberately NOT an @career.club address. That domain auto-grants
    // every pilot (isInternalAccount, CLAUDE.md S8), and an early version
    // of this file used it; with every Moments/milestone-prompt pilot also
    // live, an unrelated background turn could in principle land between
    // this file's own request-count bookkeeping. Ruled out as the cause of
    // the lag above (request counts advanced by exactly one per correction
    // either way), but there is no reason to carry the extra pilot surface
    // once that's known, so this keeps the same minimal-flags pattern
    // fixtures.mjs's own `flagged` fixture uses for the identical reason.
    await page.route('**/api/me', route => {
      const body = buildMeResponse({})
      body.user.feature_flags = [...(body.user.feature_flags || []), 'section_rework']
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
    })
    await page.goto(DEV_URL)
    await page.locator(RAIL).waitFor({ state: 'visible', timeout: 30000 })
    await openFloatingCoach(page)

    for (const id of FOCUS_ORDER_IDS) {
      await page.evaluate((secId) => {
        const el = document.getElementById(`section-${secId}`)
        if (el) el.scrollIntoView({ block: 'start' })
      }, id)
      await page.waitForTimeout(500)

      const baseline = coachRequests.length
      await page.locator(INPUT).fill('change the opening')
      await page.locator(INPUT).press('Enter')
      const body = await waitForCoachRequest(coachRequests, { count: baseline + 1 })

      const situationSection = body && body.situation ? body.situation.section : undefined
      const returnSection = body ? body.returnSection : undefined
      results.push({ scrolledToward: id, situationSection, returnSection })

      const matches = situationSection != null && returnSection === situationSection
      if (matches) situationEverMatchedReturnSection++
      // The brief's actual question, computed the only way this fixture
      // can answer it honestly: does returnSection ever agree with
      // whatever section Situation reports for that same request, for any
      // of the eleven corrections sent while scrolling through the
      // playbook top to bottom.
      check(matches, `correction sent while scrolling toward ${id}: Situation reports ${JSON.stringify(situationSection)}, returnSection is ${JSON.stringify(returnSection)}`)
    }

    await context.close()
  } finally {
    await browser.close()
  }
}

await run()

console.log('')
console.log('Per-request record (target scrolled toward -> Situation section actually reported -> returnSection actually sent):')
results.forEach(r => console.log(`  ${r.scrolledToward.padEnd(11)} -> situation=${String(r.situationSection).padEnd(11)} returnSection=${String(r.returnSection)}`))
console.log('')
console.log(`test-coach-section-rework-scroll-target: ${situationEverMatchedReturnSection}/${FOCUS_ORDER_IDS.length} corrections sent returnSection equal to Situation's own section for that same request.`)
console.log(situationEverMatchedReturnSection > 0
  ? 'VERDICT: scroll-based correction-targeting works at least some of the time today. Investigate the specific mechanism before deciding whether Column 3 can collapse into Column 1 at GA.'
  : 'VERDICT: scroll-based correction-targeting does NOT work today, for any section Situation reported across this run -- returnSection is set exclusively by clicking a section\'s own "Ask My Coach about this" (App.jsx coachReturn/openCoachWith), and nothing reads situation.section into it. Column 3 does NOT collapse into Column 1 at GA on the current mechanism; making it do so is a real, separate change (wiring situation.section into sectionReworkTarget, or an equivalent), not a documentation update.')

if (failures) {
  console.error(`\n${failures} check(s) failed (see VERDICT above for what the source-level finding this file's header documents predicted).`)
  process.exit(1)
} else {
  console.log('\ntest-coach-section-rework-scroll-target: all checks passed')
}
