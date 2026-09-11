// Three more concierge items, Cowork's live run 2026-09-11 evening, item 3's
// second ask: "Also check HOPE - CHRO on the flagged account, which reads
// Not set yet despite having an Offer & Negotiation analysis; say whether a
// test run cleared it."
//
// Investigation: nothing in this codebase infers a stage from a built card
// (offerNegotiation being built has no bearing on pursuit_status.stage --
// they are two independent things), and the admin moment-reset endpoint
// added earlier the same day (api/admin/reset-moments.js) only clears
// coachMoments, never touches pursuit_status. But api/pursuit-status.js's
// own POST (the "orphan reconcile") DOES delete a stage: `DELETE FROM
// pursuit_status WHERE user_id = ... AND record_id <> ALL(recordIds)`. The
// client fires this once per session, on first arrival at Focus Playbooks
// (App.jsx, step 'mylib', pursuitReconciledRef), with `ids` computed from
// savedPlaybooks AT THAT INSTANT -- and that effect had no hydrationStable
// gate. savedPlaybooks starts empty on mount and is only overwritten once
// the server profile load resolves; clicking into Focus Playbooks from the
// sidebar (a plain client-side nav(), unrelated to that load) before it
// settles fires the reconcile with whatever savedPlaybooks held before the
// load -- empty, on a fresh session -- and the server deletes the
// pursuit_status row for every door2 record, since none of them are in
// that empty list. This is a real, reproducible bug, not just a
// hypothesis: this file demonstrates it (a real sidebar click racing a
// delayed profile load, not a synthetic timer) and confirms the fix (a
// hydrationStable gate, matching the same signal coach-intro's own
// eligibility already uses for the identical hydration-timing reason).
//
// This does not touch or query the actual HOPE - CHRO account or its data
// (this session has no production database access) -- it demonstrates the
// mechanism that could have caused what was observed, and confirms it no
// longer can.
//
// Test: land on a screen other than Focus Playbooks with the server's own
// profile load delayed, then click into Focus Playbooks from the sidebar
// (data-step="mylib") before that load settles -- the exact race a person
// clicking around right after signing in would create. Confirm no
// reconcile POST fires from that click (firing then would have pruned
// every record's stage using an empty ids list), then confirm it fires
// once hydration completes, carrying the REAL, fully hydrated set of
// record ids.
import { chromium } from 'playwright'
import { existsSync } from 'node:fs'
import { DEV_URL, VIEWPORT, dismissCookieBanner } from './browser-tests/page-helpers.mjs'
import { mockBackend } from './browser-tests/mock-backend.mjs'
import { buildProfileLoadResponse, DOOR1_RECORD, DOOR2_RECORD } from './browser-tests/fixtures.mjs'

const EXECUTABLE_PATH = existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome')
  ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
  : undefined

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } else { console.log(`  ok   ${msg}`) } }

async function run() {
  const browser = await chromium.launch({ executablePath: EXECUTABLE_PATH, args: ['--disable-features=Translate,AutofillServerCommunication'] })
  try {
    const context = await browser.newContext({ viewport: VIEWPORT })
    const page = await context.newPage()
    await dismissCookieBanner(page)
    const secondRecord = { ...DOOR2_RECORD, id: 'test-hope-chro-001', title: 'CHRO, HOPE', company: 'HOPE' }
    // A returning device's own local cache (localStorage pe_v4) hydrates
    // near-instantly on mount, well before the server round-trip below
    // resolves -- this is what makes the sidebar's post-Personal-Brand
    // dashboard shape (the one that includes Focus Playbooks) available to
    // click almost immediately, while savedPlaybooks itself still only
    // holds whatever the server eventually sends. done:['p3'] is the one
    // field that shape actually reads (personalBrandDone, App.jsx's
    // Sidebar).
    await page.addInitScript(() => {
      localStorage.setItem('pe_v4', JSON.stringify({ step: 'welcome', done: ['p3'] }))
    })
    await mockBackend(page, { flagged: true, onboardingConcierge: true })

    // Delay the server profile load -- the window a person clicking into
    // Focus Playbooks right after landing would race against. The delayed
    // response carries the REAL saved set (two door2 records); the point is
    // that savedPlaybooks does not hold it yet at click time.
    // step:'mylib' here too -- the account's own last-saved position was
    // already Focus Playbooks, so the server response does not clobber the
    // person's fresh click back to 'welcome' once it lands (a separate
    // concern from the one under test: whichever screen the server load
    // resolves to is not this file's question).
    await page.route('**/api/profile/load', async route => {
      await new Promise(r => setTimeout(r, 700))
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(buildProfileLoadResponse({ step: 'mylib', savedPlaybooksOverride: [DOOR1_RECORD, DOOR2_RECORD, secondRecord] })) })
    })

    const reconcilePosts = []
    await page.route('**/api/pursuit-status', async route => {
      if (route.request().method() === 'POST') {
        let body = null
        try { body = route.request().postDataJSON() } catch {}
        reconcilePosts.push(body)
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, kept: (body && body.recordIds && body.recordIds.length) || 0 }) })
      } else {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ rows: [] }) })
      }
    })

    await page.goto(DEV_URL)

    // Click into Focus Playbooks (data-step="mylib") right away -- well
    // before the 700ms-delayed profile load can have resolved. hasPipeline
    // only needs a signed-in user (/api/me, not delayed), so the sidebar
    // item is clickable immediately.
    const mylibNav = page.locator('[data-step="mylib"]')
    await mylibNav.waitFor({ state: 'visible', timeout: 10000 })
    await mylibNav.click()

    // Early window: the profile load is still in flight. No reconcile POST
    // may have fired yet -- firing here, before hydration, is exactly the
    // bug (it would use the empty pre-load ids list and prune every
    // record's stage server-side).
    await page.waitForTimeout(300)
    check(reconcilePosts.length === 0, `clicking into Focus Playbooks before the server profile load settles does not fire an orphan-reconcile POST (found ${reconcilePosts.length})`)

    // Let the delayed load finish and the reconcile effect get its turn.
    await page.waitForTimeout(700)
    check(reconcilePosts.length === 1, `exactly one orphan-reconcile POST fires, once hydration completes (found ${reconcilePosts.length})`)
    const ids = (reconcilePosts[0] && reconcilePosts[0].recordIds) || []
    check(ids.includes(DOOR2_RECORD.id) && ids.includes(secondRecord.id),
      `the reconcile carries the REAL, fully hydrated set of door2 record ids, not the empty pre-load list that would have pruned a real stage (got: ${JSON.stringify(ids)})`)

    await context.close()
  } finally {
    await browser.close()
  }

  if (failures) {
    console.error(`test-pursuit-reconcile-hydration-gate-browser: ${failures} check(s) failed`)
    process.exit(1)
  } else {
    console.log('test-pursuit-reconcile-hydration-gate-browser: OK (clicking into Focus Playbooks before the server profile load settles does not fire the orphan-reconcile POST to /api/pursuit-status; it waits for hydrationStable, then fires once with the real, fully hydrated set of record ids -- so a fast navigation right after sign-in cannot prune a real record\'s stage using an incomplete pre-load ids list)')
  }
}

run().catch(e => { console.error(e); process.exit(1) })
