// t01-19 follow-up (2026-09-12 live QA on bob+lindsey@career.club): all four
// widen-the-search hint phrases ("I've run out of people to talk to,"
// "there's nothing out there," "I don't know anyone," "money is getting
// tight") got real, screen- and pipeline-aware prose answers naming the
// right row -- but none of them ended with the row's actual Do it now /
// Remind me later / Not for me buttons (brief §2.6). The reply text
// referenced the right widen-the-search row conceptually but never
// surfaced the catalog row itself, because the taps only ever exist
// client-side, keyed off a MOMENT_CATALOG row (src/coach-moments.js), and
// a live conversational reply had no path to that catalog at all.
//
// Fix: the model now ends such a reply with a bare WIDENSEARCH: <row-key>
// trailer (api/coach.js's WIDEN_SEARCH_HINT_NOTE); the server validates it
// against the real five-row enum and carries it on the X-Coach-Widen-
// Search response header; Chat.jsx resolves that key back to the row's own
// canonical message/quickReplies and attaches them via the same
// mergeOfferOntoReply every other capture offer uses, with checkinKey
// 'moment:<row-key>' -- the exact shape App.jsx's generic Moments tap
// dispatcher already reads, so the taps route through the SAME onTap
// (widenSearchOnTap) a scripted, unprompted fire of the row would use.
//
// This is the browser-level test the bug report itself required before
// shipping the fix: mocks the server response header (real end-to-end
// coverage of the trailer parse -> header -> client merge chain lives in
// the node-level coach-routing/coach.js tests; this proves the button
// actually renders and a tap on it does its real job).
import { chromium } from 'playwright'
import { existsSync } from 'node:fs'
import { newFlaggedFocusPage, INPUT } from './browser-tests/page-helpers.mjs'
import { waitForCoachRequest } from './browser-tests/mock-backend.mjs'
import { WIDEN_SEARCH_ROW_KEYS } from '../src/coach-moments.js'

const EXECUTABLE_PATH = existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome')
  ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
  : undefined

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } else { console.log(`  ok   ${msg}`) } }

const HINT_REPLY_PROSE = "Loading your LinkedIn contacts is exactly the move here -- it lets Who You Know Here and Known Contacts start finding the people you already know at companies you're targeting."
const ROW_MESSAGE = 'Loading your LinkedIn contacts lets Who You Know Here and Known Contacts find the people you already know at a company. Want to load them?'

async function sendHint(page, coachRequests, text) {
  const baseline = coachRequests.length
  // widenSearchState is a plain prop snapshot (not a live getter), so a
  // send() closure created before /api/profile/load's hydration lands
  // would still see the pre-hydration {} default and never see a real
  // retiredUntil -- give hydration time to settle first, same margin the
  // sibling widen-search browser tests use before their own first check.
  await page.waitForTimeout(2000)
  const input = page.locator(INPUT)
  await input.fill(text)
  await input.press('Enter')
  await waitForCoachRequest(coachRequests, { count: baseline + 1 })
  // Let Chat.jsx's own streaming/header-handling settle after the request
  // resolves -- same margin the sibling widen-search browser tests use.
  await page.waitForTimeout(1500)
}

async function run() {
  const browser = await chromium.launch({ executablePath: EXECUTABLE_PATH, args: ['--disable-features=Translate,AutofillServerCommunication'] })
  try {
    // --- Scenario 1: a hint fires the real offer, with its real taps ---
    {
      const { page, context, coachRequests } = await newFlaggedFocusPage(browser, {
        onboardingConcierge: true,
        coachReplyBody: HINT_REPLY_PROSE,
        coachReplyHeaders: { 'X-Coach-Widen-Search': 'widen-linkedin-contacts' },
      })
      await sendHint(page, coachRequests, "I don't know anyone there.")
      const bodyText = await page.evaluate(() => document.body.innerText)
      check(bodyText.includes(HINT_REPLY_PROSE), 'the model\'s own hint-answering prose still renders')
      check(bodyText.includes(ROW_MESSAGE), 'the reply carries the row\'s own canonical offer text, not just prose that references it')
      check(bodyText.includes('Do it now') && bodyText.includes('Remind me later') && bodyText.includes('Not for me'),
        'the reply attaches the real three-tap widen-the-search buttons (brief §2.6), not a plain follow-up question')

      // "Not for me" persists a retirement through the SAME dispatch a
      // scripted, unprompted fire of this row would use -- proof the
      // buttons are not just rendered but actually wired.
      const notForMeBtn = page.locator('button', { hasText: 'Not for me' }).last()
      check(await notForMeBtn.isVisible().catch(() => false), 'a "Not for me" tap is visible on the hint-triggered offer')
      await notForMeBtn.click()
      await page.waitForTimeout(1000)
      const saved = await page.evaluate(() => localStorage.getItem('pe_v4'))
      const parsed = saved ? JSON.parse(saved) : null
      check(!!(parsed && parsed.widenSearchState && parsed.widenSearchState['widen-linkedin-contacts'] && parsed.widenSearchState['widen-linkedin-contacts'].retiredUntil),
        'tapping "Not for me" on the hint-triggered offer persists a retiredUntil date, same as the scripted-fire path')
      await context.close()
    }

    // --- Scenario 2: a hint never overrides a "Not for me" retirement
    // (brief §2.6: a hint overrides snooze and pacing, never retirement).
    // Every row is retired here, not just widen-linkedin-contacts -- with
    // only that one row retired, the client's OWN unprompted rotation
    // (independent of anything this fix touches) is still free to fire a
    // DIFFERENT row's real offer on the same fresh page load, which also
    // renders "Do it now"/"Not for me" and would make this check pass for
    // the wrong reason. Retiring the whole set isolates what this test
    // actually needs to prove: the hint-triggered path for the row the
    // model named specifically. ---
    {
      const future = new Date(Date.now() + 10 * 86400000).toISOString()
      const allRetired = {}
      for (const k of WIDEN_SEARCH_ROW_KEYS) allRetired[k] = { retiredUntil: future }
      const { page, context, coachRequests } = await newFlaggedFocusPage(browser, {
        onboardingConcierge: true,
        widenSearchState: allRetired,
        coachReplyBody: HINT_REPLY_PROSE,
        coachReplyHeaders: { 'X-Coach-Widen-Search': 'widen-linkedin-contacts' },
      })
      await sendHint(page, coachRequests, "I don't know anyone there.")
      const bodyText = await page.evaluate(() => document.body.innerText)
      check(bodyText.includes(HINT_REPLY_PROSE), 'the model\'s own hint-answering prose still renders even when the row is retired')
      check(!bodyText.includes(ROW_MESSAGE) && !bodyText.includes('Not for me'),
        'a retired row\'s offer and buttons do not attach even when the model\'s own hint trailer names it -- retirement is never overridden')
      await context.close()
    }
  } finally {
    await browser.close()
  }
}

await run()

if (failures) {
  console.error(`test-coach-widen-search-hint-offer-browser: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-coach-widen-search-hint-offer-browser: OK (a hint-answering reply attaches the row\'s real Do it now / Remind me later / Not for me buttons through the same dispatch a scripted fire uses, and a "Not for me" retirement is never overridden by a hint)')
}
