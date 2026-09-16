// Widen-the-search PR (2026-09-16), pipeline-aware ordering: live
// verification of the two cases the deterministic engine tests
// (scripts/test-widen-search.mjs) can't reach on their own, because they
// depend on the real evaluator's ctx (pursuitStatusLoaded, the
// activeOpportunities/stepPosition join, coachMoments' own
// widenSearchLastOfferedKey derivation) rather than calling
// pickWidenSearchRowForPipeline directly.
//
// Scenario 1: a thin pipeline (one live opportunity, stale) with the
// Bridge Story already built -- Go-to-Market becomes a candidate, and the
// thin order (WIDEN_ORDER_THIN) leads with it, so it should fire first.
//
// Scenario 2: the same Bridge-Story-built fixture but with a healthy
// pipeline (three fresh, recently-touched opportunities) and Go-to-Market
// as the already-fired lastOfferedKey -- confirms a healthy pipeline
// still ROTATES (per WIDEN_ORDER_DEFAULT) rather than re-offering
// Go-to-Market just because it leads the default order.
import { chromium } from 'playwright'
import { existsSync } from 'node:fs'
import { newFlaggedFocusPage } from './browser-tests/page-helpers.mjs'
import { DOOR1_RECORD, DOOR2_RECORD } from './browser-tests/fixtures.mjs'

const EXECUTABLE_PATH = existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome')
  ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
  : undefined

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } else { console.log(`  ok   ${msg}`) } }

const DAY = 86400000
const NOW = Date.now()
const STALE_DATE = new Date(NOW - 20 * DAY).toISOString()
const FRESH_DATE = new Date(NOW - 1 * DAY).toISOString()

// Any non-empty string satisfies widenBridgeBuilt (App.jsx) -- the check
// is on length, not on real Bridge Story content.
const BRIDGE_TEXT = 'Built Bridge Story text for the pipeline-aware rotation fixture.'

const GO_TO_MARKET_TEXT = 'Reaching out to companies directly is the heart of Making Your Own Weather.'
const RECRUITERS_TEXT = 'Some recruiters specialize in placing people in roles like'

const freshDoor2 = (id, title) => ({ ...DOOR2_RECORD, id, title })

async function run() {
  const browser = await chromium.launch({ executablePath: EXECUTABLE_PATH, args: ['--disable-features=Translate,AutofillServerCommunication'] })
  try {
    // --- Scenario 1: thin pipeline (default fixture's one open
    // opportunity, additionally stale at 20 days quiet) with the Bridge
    // Story built and Go-to-Market unbuilt. Go-to-Market leads
    // WIDEN_ORDER_THIN, so it should be the very first unprompted offer. ---
    {
      const { context, page } = await newFlaggedFocusPage(browser, {
        onboardingConcierge: true,
        outputsOverride: { p6: BRIDGE_TEXT },
        pursuitStatusRows: [{ record_id: DOOR2_RECORD.id, stage: 'applied', updated_at: STALE_DATE }],
      })
      await page.waitForTimeout(2000)
      const bodyText = await page.evaluate(() => document.body.innerText)
      check(bodyText.includes(GO_TO_MARKET_TEXT),
        'a thin pipeline with the Bridge Story built offers Go-to-Market first (WIDEN_ORDER_THIN leads with it once it is a candidate)')
      check(!bodyText.includes(RECRUITERS_TEXT),
        'no other widen-the-search row also fires alongside it')
      await context.close()
    }

    // --- Scenario 2: healthy pipeline (three fresh, recently-touched
    // opportunities) with the same Bridge-Story-built fixture, and
    // Go-to-Market already the lastOfferedKey (seeded via coachMoments).
    // A healthy pipeline rotates WIDEN_ORDER_DEFAULT rather than
    // re-offering the row that leads it -- the next candidate in that
    // order after Go-to-Market is Recruiters. ---
    {
      const threeFresh = [
        freshDoor2('test-door2-a', 'Director of Logistics A'),
        freshDoor2('test-door2-b', 'Director of Logistics B'),
        freshDoor2('test-door2-c', 'Director of Logistics C'),
      ]
      const { context, page } = await newFlaggedFocusPage(browser, {
        onboardingConcierge: true,
        outputsOverride: { p6: BRIDGE_TEXT },
        savedPlaybooksOverride: [DOOR1_RECORD, ...threeFresh],
        pursuitStatusRows: threeFresh.map(r => ({ record_id: r.id, stage: 'applied', updated_at: FRESH_DATE })),
        coachMoments: { 'widen-go-to-market': { '_': { value: 'fired', firedAt: new Date(NOW - 10 * 60000).toISOString() } } },
      })
      await page.waitForTimeout(2000)
      const bodyText = await page.evaluate(() => document.body.innerText)
      check(!bodyText.includes(GO_TO_MARKET_TEXT),
        'a healthy pipeline does not re-offer Go-to-Market just because lastOfferedKey is Go-to-Market')
      check(bodyText.includes(RECRUITERS_TEXT),
        'a healthy pipeline rotates to the next row in WIDEN_ORDER_DEFAULT (Recruiters) instead')
      await context.close()
    }
  } finally {
    await browser.close()
  }
}

await run()

if (failures) {
  console.error(`test-coach-moments-widen-search-thin-pipeline-browser: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-coach-moments-widen-search-thin-pipeline-browser: OK (a thin pipeline with the Bridge Story built leads with Go-to-Market; a healthy pipeline rotates past it instead of re-offering it)')
}
