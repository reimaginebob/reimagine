// Cross-device Clear, second follow-up (2026-09-16). The first follow-up
// (PR #963) fixed a SEPARATE device's stale local transcript by comparing
// /api/me's chat_cleared_at against reimagine_chat_cleared_at_applied
// (localStorage) on sign-in. But the device that actually TAPS Clear never
// wrote that marker itself -- clearChatServerSide (Chat.jsx) fired the
// POST to api/coach-clear.js and threw the response away. So on THIS
// device's next load (a reload, or sign-out/sign-in), /api/me's real
// chat_cleared_at looked newer than the (missing) marker, and PR #963's
// own cross-device effect reset the transcript all over again -- wiping
// any real conversation held after the clear, even though nothing had
// been cleared since.
//
// The fix: api/coach-clear.js now RETURNs the exact chat_cleared_at value
// it just wrote, and clearChatServerSide records that value as already-
// applied the moment the call succeeds, instead of waiting on a future
// /api/me round trip to notice it.
//
// This test reproduces the actual symptom: tap Clear, send a real new
// message, reload the page, and confirm the new message is still there --
// not just that the marker got written to localStorage in isolation.
import { chromium } from 'playwright'
import { existsSync } from 'node:fs'
import { newFlaggedFocusPage, RAIL, INPUT } from './browser-tests/page-helpers.mjs'
import { WIDEN_SEARCH_ROW_KEYS } from '../src/coach-moments.js'

const EXECUTABLE_PATH = existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome')
  ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
  : undefined

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

// Same Moments-eligibility reasoning as test-coach-clear-cross-device-
// browser.mjs: nothing in this test depends on Moments or the session-open
// recap firing, and either one landing mid-test can append or (for the
// recap, which special-cases a transcript that is exactly [INTRO_MSG] and
// REPLACES it) even overwrite the very transcript state these checks read.
// Retiring every widen-search row, leaving no chosen role, and pre-seeding
// the recap's own "already fired" sessionStorage flag keeps this test
// observing the fix under test.
const ALL_WIDEN_ROWS_RETIRED = Object.fromEntries(
  WIDEN_SEARCH_ROW_KEYS.map(key => [key, { retiredUntil: new Date(Date.now() + 30 * 86400000).toISOString() }])
)
const SESSION_STORAGE_SEED = { reimagine_session_recap_fired: '1' }

const NEW_MESSAGE = 'A real message sent right after tapping Clear'
const NEW_REPLY = 'Noted -- this is the reply to the post-clear message'

async function run() {
  const browser = await chromium.launch({ executablePath: EXECUTABLE_PATH, args: ['--disable-features=Translate,AutofillServerCommunication'] })
  try {
    const { context, page, coachRequests } = await newFlaggedFocusPage(browser, {
      chosenOverride: '',
      widenSearchState: ALL_WIDEN_ROWS_RETIRED,
      sessionStorageSeed: SESSION_STORAGE_SEED,
      coachReplyBody: NEW_REPLY,
      // chatClearedAt deliberately omitted (stays null): this account has
      // never been cleared before this test's own Clear tap, which is the
      // shape that actually exercises the fix -- if a clear had already
      // happened, PR #963's own /api/me effect would have written the
      // marker on mount, before Clear was ever tapped, and this test would
      // not be able to tell "the tap itself never wrote it" apart from
      // "something else already did."
    })

    // Registered AFTER newFlaggedFocusPage's own setup (mockBackend), so
    // Playwright's last-registered-wins precedence lets these override the
    // shared defaults for the rest of this test -- see mock-backend.mjs's
    // own top-of-file comment on route precedence. clearedAtRef is the one
    // piece of mutable state standing in for the real users.chat_cleared_at
    // column: api/coach-clear.js's real UPDATE...RETURNING and a real
    // /api/me read of that same row are two different requests reading the
    // same persisted value, so the mock needs the same shape -- a static
    // per-test fixture value (as the OTHER follow-up's browser test uses)
    // cannot represent "whatever Clear just wrote," which is exactly the
    // value this test needs the reload's /api/me to reflect.
    let clearedAtRef = null
    await page.route('**/api/coach-clear', async route => {
      clearedAtRef = new Date().toISOString()
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, clearedAt: clearedAtRef }) })
    })
    await page.route('**/api/me', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            email: 'browser-test-flagged@example.com',
            first_name: 'Browser',
            last_name: 'Test',
            suspended_at: null,
            employment_status: 'employed',
            search_going_well: '',
            search_focus: '',
            chat_cleared_at: clearedAtRef,
            feature_flags: ['coach_presence'],
            privacy_version: '2026-06-01',
            terms_version: '2026-06-01',
          },
        }),
      })
    })

    // --- Tap Clear. ---
    let clearRequestSeen = false
    const clearWait = page.waitForRequest(r => r.url().includes('/api/coach-clear') && r.method() === 'POST', { timeout: 5000 }).then(() => { clearRequestSeen = true }).catch(() => {})
    page.once('dialog', d => d.accept())
    const clearBtn = page.locator('button', { hasText: 'Clear' }).first()
    await clearBtn.click()
    await clearWait
    check(clearRequestSeen, 'tapping Clear fired a real POST /api/coach-clear')
    // Give clearChatServerSide's own async response-handling a moment to
    // finish (it does not block the click handler -- see Chat.jsx's own
    // comment on why this is fire-and-forget).
    await page.waitForTimeout(500)

    const appliedRightAfterClear = await page.evaluate(() => { try { return localStorage.getItem('reimagine_chat_cleared_at_applied') } catch { return null } })
    check(!!clearedAtRef && appliedRightAfterClear === clearedAtRef,
      `reimagine_chat_cleared_at_applied was not stamped with the exact clearedAt api/coach-clear.js returned right after tapping Clear (this is the actual fix -- without it, this stays null until a LATER /api/me round trip notices a newer server value, if ever) -- got ${JSON.stringify(appliedRightAfterClear)}, expected ${JSON.stringify(clearedAtRef)}`)

    // --- Send a real new message after the clear. ---
    const baseline = coachRequests.length
    await page.locator(INPUT).fill(NEW_MESSAGE)
    await page.locator(INPUT).press('Enter')
    const deadline = Date.now() + 10000
    while (coachRequests.length <= baseline && Date.now() < deadline) await new Promise(r => setTimeout(r, 50))
    check(coachRequests.length > baseline, 'sending a message after Clear never reached /api/coach')

    await page.waitForTimeout(500)
    const beforeReload = await page.evaluate(() => document.body.innerText)
    check(beforeReload.includes(NEW_MESSAGE) || beforeReload.includes(NEW_REPLY),
      'the post-clear message never rendered in the first place, so the reload check below cannot confirm anything (fixture problem, not necessarily the fix)')

    // --- Reload this SAME device/tab and confirm the new message survives. ---
    // Without the fix: reimagine_chat_cleared_at_applied stayed null after
    // Clear, so on this reload App.jsx's /api/me hydration effect sees the
    // real (now non-null) chat_cleared_at as newer than the missing marker
    // and resets chatMessages back to the seed intro -- wiping the message
    // just sent, even though nothing was cleared since the tap.
    await page.reload()
    await page.locator(RAIL).waitFor({ state: 'visible', timeout: 30000 })
    await page.waitForTimeout(1000)

    const afterReloadBody = await page.evaluate(() => document.body.innerText)
    const storedAfterReload = await page.evaluate(() => { try { return localStorage.getItem('reimagine_chat_history') } catch { return null } })
    const parsedAfterReload = storedAfterReload ? JSON.parse(storedAfterReload) : null
    const historyStillHasNewMessage = Array.isArray(parsedAfterReload) && parsedAfterReload.some(m => m && (m.content === NEW_MESSAGE || m.content === NEW_REPLY))

    check((afterReloadBody.includes(NEW_MESSAGE) || afterReloadBody.includes(NEW_REPLY)) && historyStillHasNewMessage,
      'the message sent right after Clear did not survive a reload of the SAME device that tapped Clear -- the tapping device\'s own missing reimagine_chat_cleared_at_applied marker let the cross-device reset fire again and wipe it')

    const appliedAfterReload = await page.evaluate(() => { try { return localStorage.getItem('reimagine_chat_cleared_at_applied') } catch { return null } })
    check(appliedAfterReload === clearedAtRef,
      'reimagine_chat_cleared_at_applied changed (or went missing) across the reload -- it should still equal the value Clear itself recorded, since chat_cleared_at has not changed since')

    await context.close()
  } finally {
    await browser.close()
  }
}

await run()

if (failures) {
  console.error(`test-coach-clear-applied-marker-browser: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-coach-clear-applied-marker-browser: OK (tapping Clear immediately records the server-returned clearedAt as this device\'s own applied marker, and a message sent right after Clear survives a reload of the same device instead of being wiped by a stale-marker false cross-device reset)')
}
