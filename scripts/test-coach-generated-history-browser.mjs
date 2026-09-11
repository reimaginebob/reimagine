// F1 twenty-minute session, item 1: Coach could not see its own unprompted
// messages. sanitizeHistoryForModel (api/coach.js) stripped every history
// message carrying checkinKey/banner/intro/synthetic before the model saw
// it -- but fireMoment's real reply (Delivery reads, Next move, arrival,
// Check) is tagged checkinKey AND banner too, so a genuinely model-said
// sentence was stripped identically to a static app-authored bubble.
// Production: a Personal Brand Delivery read said "naming what you'd want
// to build next at a bigger table"; the person typed "what do you mean
// bigger table? did we ever say that?"; Coach, unable to see its own
// sentence, asked where they had heard the phrase.
//
// Fix: fireMoment's push (src/App.jsx) now tags generated:true on top of
// checkinKey/banner; sanitizeHistoryForModel lets generated:true through
// regardless of checkinKey/banner, and still strips everything else
// (test-coach-history-sanitize.mjs covers that function directly and
// behaviorally). This is the CLIENT-side half: a live Delivery fire in the
// real running app must actually produce a message shaped that way, and
// that shape must actually reach the server in the history array on the
// next real request -- not just a string present in source.
import { chromium } from 'playwright'
import { existsSync } from 'node:fs'
import { newFlaggedFocusPage, clickRailSection, INPUT } from './browser-tests/page-helpers.mjs'
import { waitForCoachRequest } from './browser-tests/mock-backend.mjs'

const EXECUTABLE_PATH = existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome')
  ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
  : undefined

const DELIVERY_REPLY = "You're already naming what you'd want to build next at a bigger table."

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } else { console.log(`  ok   ${msg}`) } }

async function run() {
  const browser = await chromium.launch({ executablePath: EXECUTABLE_PATH, args: ['--disable-features=Translate,AutofillServerCommunication'] })
  try {
    // The flagged fixture's mock /api/coach returns coachReplyBody for every
    // request; using the same text for the Delivery fire and the follow-up's
    // own reply is fine here since this test only inspects REQUEST bodies
    // (never the follow-up's response text).
    const { context, page, coachRequests } = await newFlaggedFocusPage(browser, { onboardingConcierge: true, coachReplyBody: DELIVERY_REPLY })

    // p5 ("The Role") is pre-built in the fixture and not yet in
    // coachMoments -- scrolling to it fires delivery-p5 as a Delivery-on-a-
    // pre-existing-build, same trigger test-coach-minimize-preserves-offer
    // uses.
    const baseline = coachRequests.length
    await clickRailSection(page, 'The Role')
    await waitForCoachRequest(coachRequests, { count: baseline + 1 })
    const deliveryMsg = page.locator('[data-message-role="assistant"]').filter({ hasText: DELIVERY_REPLY }).first()
    await deliveryMsg.waitFor({ state: 'attached', timeout: 10000 })
    check(coachRequests.length > baseline, 'Delivery fired a real moment request')

    // --- Type a follow-up quoting the Delivery reply's own phrase. ---
    const beforeFollowUp = coachRequests.length
    await page.locator(INPUT).fill('What do you mean "bigger table"? Did we ever say that?')
    await page.locator(INPUT).press('Enter')
    const followUpBody = await waitForCoachRequest(coachRequests, { count: beforeFollowUp + 1 })

    check(!!followUpBody, 'the typed follow-up sent a real request to /api/coach')
    const history = (followUpBody && followUpBody.history) || []
    // coachReplyBody is the same canned text for every moment this fixture
    // fires (not just delivery-p5), so match on checkinKey too -- content
    // alone could pick up a different moment's identical stub reply.
    const deliveryInHistory = history.find(m => m && m.content === DELIVERY_REPLY && m.checkinKey === 'moment:delivery-p5')
    check(!!deliveryInHistory, 'the delivery-p5 reply is present in the history sent with the follow-up (got: ' + JSON.stringify(history.map(m => m && [m.content, m.checkinKey])) + ')')
    check(!!(deliveryInHistory && deliveryInHistory.generated === true),
      'the Delivery reply in history is tagged generated:true, so the server keeps it instead of stripping it like a static bubble')
    check(!!(deliveryInHistory && deliveryInHistory.checkinKey === 'moment:delivery-p5'),
      'the Delivery reply still carries its checkinKey (dedupe/rendering are unaffected by the generated fix)')

    await context.close()
  } finally {
    await browser.close()
  }

  if (failures) {
    console.error(`test-coach-generated-history-browser: ${failures} check(s) failed`)
    process.exit(1)
  } else {
    console.log('test-coach-generated-history-browser: OK (a live Delivery fire tags its real reply generated:true, and that tag survives into the history array sent with the next real request, so the server keeps Coach\'s own words instead of stripping them like a static bubble)')
  }
}

run().catch(e => { console.error(e); process.exit(1) })
