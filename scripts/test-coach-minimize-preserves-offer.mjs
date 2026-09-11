// F1 twenty-minute session (2026-09-11), item 2: tapping [Minimize Coach for
// now] on a message that also carried an offer ([Do it now]/[Practice it]
// plus [Remind me later]) wiped every tap off that message, including the
// offer's own -- reopening the panel showed no way left to act on it, only
// Minimize's own echo bubble. Root cause: Chat.jsx's tapQuickReply is the
// single handler for every quick-reply tap, and its generic "answered, so
// clear this message's buttons and push an echo" behavior does not
// distinguish an actual answer to the offer (Do it now, Remind me later)
// from Minimize, which App.jsx's own comment already describes as "a
// presence control, not a decision on the offer itself."
//
// This fires a real Delivery-with-offer (delivery-p5, scrolled into view on
// a pre-existing build, mocked to include DELIVERY_OFFER_RE's trigger
// phrase so the evaluator adds the Do it now tap), taps Minimize, reopens,
// and asserts the SAME message still carries a live Do it now AND a live
// Remind me later -- then actually clicks Do it now and confirms it still
// does its real job (a POST to /api/claude, the same rebuild the screen's
// own Generate/Rebuild button triggers).
import { chromium } from 'playwright'
import { existsSync } from 'node:fs'
import { DEV_URL, VIEWPORT, RAIL, INPUT, OPEN_COACH, dismissCookieBanner, openEmbeddedCoach, clickRailSection } from './browser-tests/page-helpers.mjs'
import { mockBackend } from './browser-tests/mock-backend.mjs'

const EXECUTABLE_PATH = existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome')
  ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
  : undefined

const ASSISTANT_MSG = '[data-message-role="assistant"]'
const MINIMIZE_BTN = 'button[aria-label="Minimize My Coach"]'
// The exact trigger phrase DELIVERY_OFFER_RE (src/App.jsx) matches.
const OFFER_REPLY = "This is a solid draft of Where you fit. If you want, we could add a second STAR story for the leadership question."

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } else { console.log(`  ok   ${msg}`) } }

async function run() {
  const browser = await chromium.launch({ executablePath: EXECUTABLE_PATH, args: ['--disable-features=Translate,AutofillServerCommunication'] })
  try {
    const context = await browser.newContext({ viewport: VIEWPORT })
    const page = await context.newPage()
    await dismissCookieBanner(page)
    let claudeRequests = 0
    await mockBackend(page, { flagged: true, onboardingConcierge: true, step: 'focus', coachReplyBody: OFFER_REPLY })
    await page.route('**/api/claude', async route => {
      claudeRequests++
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content: [{ type: 'text', text: 'Generated content.' }] }) })
    })
    await page.goto(DEV_URL)
    await page.locator(RAIL).waitFor({ state: 'visible', timeout: 30000 })
    await openEmbeddedCoach(page)

    // p5 ("The Role") is pre-built in the DOOR1_RECORD fixture and not yet
    // in coachMoments -- scrolling to it (an app-driven rail click, not the
    // free-scroll observer) is a genuine "viewed" signal and fires
    // delivery-p5 as a Delivery-on-a-pre-existing-build.
    await clickRailSection(page, 'The Role')
    // mockBackend's /api/coach stub returns the identical OFFER_REPLY text
    // for every moment request, so more than one message can carry this
    // exact text (the collapsed banner seed, next-move firing right after
    // with its own different taps) -- match on the one that actually
    // carries the Do it now button, not just the text, on every lookup.
    const offerMsgLocator = () => page.locator(ASSISTANT_MSG).filter({ hasText: OFFER_REPLY }).filter({ has: page.locator('button', { hasText: 'Do it now' }) }).first()
    const offerMsg = offerMsgLocator()
    await offerMsg.waitFor({ state: 'attached', timeout: 10000 })
    const doItNow = offerMsg.locator('button', { hasText: 'Do it now' })
    const remindLater = offerMsg.locator('button', { hasText: 'Remind me later' })
    const minimize = offerMsg.locator('button', { hasText: 'Minimize Coach for now' })
    check(await doItNow.isVisible(), 'Delivery fires with a live "Do it now" offer tap')
    check(await remindLater.isVisible(), 'The same message also carries "Remind me later"')
    check(await minimize.isVisible(), 'The same message also carries "Minimize Coach for now"')

    // --- Tap Minimize on this exact message. ---
    await minimize.click()
    await page.locator(MINIMIZE_BTN).waitFor({ state: 'detached', timeout: 5000 }).catch(() => {})
    await page.locator(OPEN_COACH).waitFor({ state: 'visible', timeout: 5000 })

    // --- Reopen. ---
    await page.locator(OPEN_COACH).click()
    await page.locator(INPUT).waitFor({ state: 'visible', timeout: 5000 })

    // --- The offer's own taps must still be there, on the same message. ---
    const offerMsgAfter = offerMsgLocator()
    const doItNowAfter = offerMsgAfter.locator('button', { hasText: 'Do it now' })
    const remindLaterAfter = offerMsgAfter.locator('button', { hasText: 'Remind me later' })
    check(await doItNowAfter.isVisible(), 'After minimize + reopen, "Do it now" is still on the message (not wiped)')
    check(await remindLaterAfter.isVisible(), 'After minimize + reopen, "Remind me later" is still on the message (not wiped)')

    // --- And it still actually works. ---
    const claudeBefore = claudeRequests
    await doItNowAfter.click()
    await page.waitForFunction((before) => window.__claudeRequests !== undefined || true, claudeBefore).catch(() => {})
    await page.waitForTimeout(500)
    check(claudeRequests > claudeBefore, `"Do it now" still triggers a real rebuild (a POST to /api/claude) after surviving minimize (requests before=${claudeBefore}, after=${claudeRequests})`)

    await context.close()
  } finally {
    await browser.close()
  }

  if (failures) {
    console.error(`test-coach-minimize-preserves-offer: ${failures} check(s) failed`)
    process.exit(1)
  } else {
    console.log('test-coach-minimize-preserves-offer: OK (Minimize is a presence control, not an answer to the offer -- tapping it leaves Do it now/Remind me later live on the same message through a minimize and reopen, and Do it now still actually triggers a rebuild afterward)')
  }
}

run().catch(e => { console.error(e); process.exit(1) })
