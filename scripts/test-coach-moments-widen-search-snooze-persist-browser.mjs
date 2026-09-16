// Production fix (Output/handoff/2026-09-16_four-my-coach-breaks-brief.md,
// item B): tapping "Remind me later" or "Not for me" on a widen-the-search
// offer only ever changed widenSearchState in memory. The autosave effect's
// stateForSave object (src/App.jsx) carries widenSearchState, but the SAME
// effect's own dependency array did not list it -- Cowork diffed the two
// lists and found it was the one key present in stateForSave and missing
// from the dependencies. Since nothing else the tap touches is a listed
// dependency either, the debounced save() never even re-ran: no PUT to
// /api/profile/save, no rewrite of localStorage's pe_v4. The one-per-tab
// sessionStorage pacing flag hid this within the same tab; a new tab or a
// later visit saw the snoozed/retired offer as eligible again.
//
// This reproduces the actual symptom two ways: (1) after the tap, does the
// client even attempt to persist the new widenSearchState (a captured PUT
// body, and the localStorage blob) -- this is what the missing dependency
// broke; (2) given that a persisted widenSearchState IS what the server
// holds (a second, fresh browser context seeded with it), does the offer
// correctly stay snoozed -- confirming the read side, which this brief did
// not touch, still works once the write side is fixed.
import { chromium } from 'playwright'
import { existsSync } from 'node:fs'
import { newFlaggedFocusPage, RAIL } from './browser-tests/page-helpers.mjs'

const EXECUTABLE_PATH = existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome')
  ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
  : undefined

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } else { console.log(`  ok   ${msg}`) } }

const FIRST_OFFER = 'Recruiters for This Path builds a list of the recruiters'
const ROW_KEY = 'widen-recruiters'

// Registered AFTER mockBackend's own /api/profile/save route -- Playwright
// runs the LAST-registered matching handler first (see mock-backend.mjs's
// own top-of-file comment), so this captures every PUT body while still
// fulfilling the same {ok:true, updatedAt} shape the app expects back.
async function captureProfileSaves(page) {
  const saves = []
  await page.route('**/api/profile/save', async route => {
    let body = null
    try { body = route.request().postDataJSON() } catch { /* not JSON */ }
    saves.push(body)
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, updatedAt: new Date().toISOString() }) })
  })
  return saves
}

async function run() {
  const browser = await chromium.launch({ executablePath: EXECUTABLE_PATH, args: ['--disable-features=Translate,AutofillServerCommunication'] })
  try {
    // --- Context 1: fresh flagged account, tap Remind me later ---
    const { context, page } = await newFlaggedFocusPage(browser, { onboardingConcierge: true })
    const saves = await captureProfileSaves(page)

    await page.waitForTimeout(2000)
    const initial = await page.evaluate(() => document.body.innerText)
    check(initial.includes(FIRST_OFFER), 'widen-recruiters offer is showing before any tap (precondition)')

    await page.getByRole('button', { name: 'Remind me later' }).click()

    // Past the 800ms debounce (src/App.jsx), with the same margin the
    // sibling reload test uses for the autosave effect to actually fire.
    await page.waitForTimeout(1500)

    const lastSave = saves[saves.length - 1]
    check(!!lastSave, 'tapping Remind me later triggers at least one PUT to /api/profile/save -- before the fix, none fired at all')
    const savedSnoozedUntil = lastSave && lastSave.widenSearchState && lastSave.widenSearchState[ROW_KEY] && lastSave.widenSearchState[ROW_KEY].snoozedUntil
    check(typeof savedSnoozedUntil === 'string' && savedSnoozedUntil.length > 0,
      `the saved PUT body carries widenSearchState['${ROW_KEY}'].snoozedUntil -- this is the exact field the missing dependency dropped`)

    const pe_v4 = await page.evaluate(() => { try { return localStorage.getItem('pe_v4') } catch { return null } })
    let localWidenState = null
    try { localWidenState = pe_v4 ? JSON.parse(pe_v4).widenSearchState : null } catch { /* leave null */ }
    check(!!(localWidenState && localWidenState[ROW_KEY] && localWidenState[ROW_KEY].snoozedUntil),
      `pe_v4 in localStorage also carries widenSearchState['${ROW_KEY}'].snoozedUntil after the tap`)

    await context.close()

    // --- Context 2: a fresh browser context (no sessionStorage pacing flag
    // carried over), seeded with the widenSearchState the first context
    // actually saved -- simulating a new tab, or the same account signing
    // in on a second device, once the server genuinely holds the snooze. ---
    const seededState = savedSnoozedUntil ? { [ROW_KEY]: { snoozedUntil: savedSnoozedUntil } } : { [ROW_KEY]: { snoozedUntil: new Date(Date.now() + 5 * 86400000).toISOString() } }
    const { context: context2, page: page2 } = await newFlaggedFocusPage(browser, { onboardingConcierge: true, widenSearchState: seededState })
    await page2.waitForTimeout(2000)
    const secondBody = await page2.evaluate(() => document.body.innerText)
    check(!secondBody.includes(FIRST_OFFER),
      'a fresh context seeded with the saved snooze does not show the widen-recruiters offer -- the read side already honors a real snooze once one is actually persisted')
    await context2.close()
  } finally {
    await browser.close()
  }
}

await run()

if (failures) {
  console.error(`test-coach-moments-widen-search-snooze-persist-browser: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-coach-moments-widen-search-snooze-persist-browser: OK (Remind me later persists widenSearchState to both the server PUT and localStorage pe_v4, and a fresh context seeded with that saved state correctly keeps the row snoozed)')
}
