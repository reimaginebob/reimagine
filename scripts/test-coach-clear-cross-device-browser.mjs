// Cross-device Clear (2026-09-16 follow-up to PR #960's My Coach "Clear"
// fix). PR #960 made Clear record a server-side chat_cleared_at boundary
// so GET /api/coach-history's rehydration query respects it -- but that
// query only runs when a device's local transcript is ALREADY just the
// seed intro. A device that still held an OLDER local transcript (this
// same tab before the clear, or a second device that was never cleared)
// never re-checked anything, so the confirmation copy's own "on every
// device where you're signed in" promise did not actually hold for that
// shape. This is the browser-level reproduction of the fix: one context
// performs a real Clear tap; a second, separate context simulates a
// device that still holds an old local transcript and learns about the
// same clear only through /api/me's chat_cleared_at -- and its stale
// transcript has to reset on load, before anything else renders it.
import { chromium } from 'playwright'
import { existsSync } from 'node:fs'
import { newFlaggedFocusPage } from './browser-tests/page-helpers.mjs'
import { WIDEN_SEARCH_ROW_KEYS } from '../src/coach-moments.js'

const EXECUTABLE_PATH = existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome')
  ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
  : undefined

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

// This fix (a stale local transcript resetting on a newer chat_cleared_at)
// is unrelated to the Moments evaluator entirely, but Moments can still
// fire proactively during either context below and overwrite the very
// transcript state these checks read -- confirmed live (both a
// chosen-gated 'choice-role' moment and an unprompted 'widen-linkedin-
// contacts' widen-search row fired within ~500ms of page load in earlier
// runs of this test). Retiring every widen-search row up front (on top of
// chosenOverride: '' below, which covers the chosen-gated entries) closes
// off both sources.
const ALL_WIDEN_ROWS_RETIRED = Object.fromEntries(
  WIDEN_SEARCH_ROW_KEYS.map(key => [key, { retiredUntil: new Date(Date.now() + 30 * 86400000).toISOString() }])
)

// Two more real, unrelated mechanisms confirmed firing on first mount in
// earlier runs of this test: the session-open recap (Chat.jsx,
// sessionOpenEligible -- gated on hasNextStep in src/App.jsx, which has
// graduated to `!!signedInUser` with no feature-flag left to turn off) and
// App.jsx's per-field orientation-quality check (fireOrientationCheck).
// Both are legitimate product behavior on a fresh browser context and
// NEITHER has anything to do with this fix, but the session-open recap in
// particular is destructive here: its silent-turn handling in Chat.jsx
// special-cases a transcript that is exactly [INTRO_MSG] and REPLACES it
// with its own reply rather than appending -- exactly the shape this
// fix's own reset produces, so a recap landing right after the reset wipes
// out the very intro these checks look for. reimagine_session_recap_fired
// is the sessionStorage flag the app itself sets after that recap's first
// (real) firing; seeding it up front is "this browser already had its
// recap," which is true for any device that has been open before and
// keeps this test observing the fix under test instead of a timing race
// against an unrelated feature.
const SESSION_STORAGE_SEED = { reimagine_session_recap_fired: '1' }

const OLD_USER_MARKER = 'OLD DEVICE MARKER: tell me about salary negotiation'
const OLD_REPLY_MARKER = 'OLD DEVICE MARKER: here is how to think about it'
const OLD_TRANSCRIPT = [
  { role: 'assistant', intro: true, content: "Hi, I'm your coach. Ask me anything about your search — where to focus, how to tell your story, how to prepare for a conversation. One thing to know up front: I'm an AI, so treat what I say as a starting point you check against your own judgment, and bring anything legal, financial, or medical to a professional. I'll work from what Reimagine already knows about you." },
  { role: 'user', content: OLD_USER_MARKER },
  { role: 'assistant', content: OLD_REPLY_MARKER },
]

async function run() {
  const browser = await chromium.launch({ executablePath: EXECUTABLE_PATH, args: ['--disable-features=Translate,AutofillServerCommunication'] })
  try {
    // --- Context A: a real Clear tap, on an ordinary fresh account. This
    // is what a real device tapping Clear actually does -- confirms the
    // existing button still works end to end, and its outcome (a
    // server-recorded chat_cleared_at) is what Context B below learns
    // about only through /api/me. ---
    let clearRequestSeen = false
    {
      // chosenOverride: '' (unlike most of this suite's other fixtures,
      // which leave a chosen role in place): several MOMENT_CATALOG entries
      // (src/coach-moments.js -- 'choice-role', the widen-search rows) are
      // eligible as soon as ctx.chosen is set, and one firing mid-test would
      // race this reset and overwrite the transcript with content that has
      // nothing to do with Clear -- confirmed live (a real 'choice-role'
      // moment fired seconds after Clear and replaced the seed intro
      // entirely). This fix does not depend on Moments at all, so keeping
      // them from having anything to fire on is the accurate test, not a
      // workaround.
      const { context, page } = await newFlaggedFocusPage(browser, { chosenOverride: '', widenSearchState: ALL_WIDEN_ROWS_RETIRED, sessionStorageSeed: SESSION_STORAGE_SEED })
      page.once('dialog', d => d.accept())
      const clearWait = page.waitForRequest(r => r.url().includes('/api/coach-clear') && r.method() === 'POST', { timeout: 5000 }).then(() => { clearRequestSeen = true }).catch(() => {})
      const clearBtn = page.locator('button', { hasText: 'Clear' }).first()
      await clearBtn.click()
      await clearWait
      await page.waitForTimeout(500)
      const stored = await page.evaluate(() => { try { return localStorage.getItem('reimagine_chat_history') } catch { return null } })
      const parsed = stored ? JSON.parse(stored) : null
      // First entry only, not exact length: App.jsx's own per-field
      // orientation-quality check (fireOrientationCheck) is purely additive
      // (it only ever appends a banner, never replaces), so it can
      // legitimately land a message right after Clear resets the
      // transcript without that being anything Clear itself got wrong.
      check(Array.isArray(parsed) && parsed.length >= 1 && parsed[0] && parsed[0].intro === true,
        'tapping Clear resets this device\'s own local transcript to the seed intro immediately')
      await context.close()
    }
    check(clearRequestSeen, 'tapping Clear fired a real POST /api/coach-clear (the call the server-side chat_cleared_at boundary depends on)')

    // --- Context B: a SEPARATE device/browser that still holds an old
    // local transcript from before the clear (a real conversation, not
    // just the intro), and learns about the same account-level clear only
    // through the chat_cleared_at the mocked /api/me now reports --
    // exactly the shape PR #960 alone did not cover. ---
    {
      const clearedAt = new Date().toISOString()
      // chosenOverride: '' here too -- same Moments-eligibility reasoning as
      // Context A above.
      const { context, page } = await newFlaggedFocusPage(browser, {
        chosenOverride: '',
        widenSearchState: ALL_WIDEN_ROWS_RETIRED,
        sessionStorageSeed: SESSION_STORAGE_SEED,
        chatClearedAt: clearedAt,
        localStorageSeed: { reimagine_chat_history: JSON.stringify(OLD_TRANSCRIPT) },
      })
      // Confirm the seed actually landed and would have rendered the old
      // transcript absent the fix -- otherwise a false negative below
      // would just mean the seed never took, not that the fix works.
      await page.waitForTimeout(500)
      const preHydration = await page.evaluate(() => document.body.innerText)
      const seedTookEffect = preHydration.includes(OLD_USER_MARKER) || preHydration.includes(OLD_REPLY_MARKER)

      // Give the /api/me -> chat_cleared_at comparison effect time to run
      // and, if it fires, time for the resulting setChatMessages to
      // re-render.
      await page.waitForTimeout(2000)
      const bodyText = await page.evaluate(() => document.body.innerText)
      check(!bodyText.includes(OLD_USER_MARKER) && !bodyText.includes(OLD_REPLY_MARKER),
        seedTookEffect
          ? 'a second device\'s stale local transcript is still visible after loading with a newer server chat_cleared_at -- the cross-device reset did not fire'
          : 'the old-transcript seed never rendered in the first place, so this check cannot confirm the reset fired (seed or fixture problem, not necessarily the fix)')

      const storedAfter = await page.evaluate(() => { try { return localStorage.getItem('reimagine_chat_history') } catch { return null } })
      const parsedAfter = storedAfter ? JSON.parse(storedAfter) : null
      // First entry only, not exact length -- same orientation-check
      // caveat as Context A above.
      check(Array.isArray(parsedAfter) && parsedAfter.length >= 1 && parsedAfter[0] && parsedAfter[0].intro === true,
        'the second device\'s reimagine_chat_history resets to just the seed intro once it learns of the newer chat_cleared_at')

      const appliedMarker = await page.evaluate(() => { try { return localStorage.getItem('reimagine_chat_cleared_at_applied') } catch { return null } })
      check(appliedMarker === clearedAt,
        'reimagine_chat_cleared_at_applied is not stamped with the exact chat_cleared_at value this device just applied')

      await context.close()
    }
  } finally {
    await browser.close()
  }
}

await run()

if (failures) {
  console.error(`test-coach-clear-cross-device-browser: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-coach-clear-cross-device-browser: OK (a real Clear tap fires POST /api/coach-clear and resets the tapping device\'s own transcript; a separate device holding an old local transcript resets it to the seed intro purely from a newer chat_cleared_at reported by /api/me, and records the applied marker)')
}
