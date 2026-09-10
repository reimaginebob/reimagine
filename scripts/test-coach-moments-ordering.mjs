// Live-side brief PR 1 (Output/handoff/2026-09-10_concierge-live-side-brief.md),
// items 1, 2 and 4(b): "coach: moment ordering, tap persistence, and record
// pinning" -- the shared engine fixes, both sides of the live-side/Focus-
// Playbook split rely on. This file covers the two fixes a real browser can
// prove: ordering (item 1) and tap persistence (item 2). Item 3 (record
// pinning, api/coach.js's situationRecordId derivation) is covered by the
// exact-string source assertion in test-coach-situation.mjs -- api/coach.js
// cannot be imported live (eager DB connection at module load, no
// DATABASE_URL in this harness) and the end-to-end "Next move names record
// A while record B was last discussed" scenario item 4(a) asks for needs
// PR 2's not-yet-built live-side catalog rows to be literally reachable, so
// that half of item 4 is not testable here; this file's job is the half
// that is.
//
// Bug D1 (tap loss) and the ordering race (item 1) were both live only when
// two generated moments become eligible close together. The fixture used
// here (src/coach-moments.js's own delivery-p5/delivery-p11/next-move
// shape) reproduces that on purpose: DOOR1_RECORD (fixtures.mjs) has both
// p5 and p11 already built, and this test pre-seeds coachMoments with
// delivery-p5 already fired (via buildProfileLoadResponse's own
// coachMoments hydration path). That makes delivery-p11 AND next-move (whose
// nextMoveTarget anchors on delivery-p5's record, independent of p11)
// eligible in the very same evaluator pass -- the exact shape that raced
// before the fix: candidates.sort() always calls delivery-p11 first
// (priority 3 beats next-move's 2), but nothing stopped next-move's fetch
// from being sent, and resolving, before delivery-p11's own fetch settled.
//
// To prove the fix (not just that both messages eventually show up), this
// test deliberately delays delivery-p11's mocked /api/coach response and
// asserts next-move's request is not even SENT until after delivery-p11's
// response lands -- the in-flight gate (momentInFlightRef, App.jsx) blocks
// the pick, not just the display, so a slow first moment cannot let a fast
// second one win the arrival race.
//
// Runs against the real headless Chromium + Vite dev server + mocked
// backend, same harness as test-coach-scroll-to-start.mjs.
import { chromium } from 'playwright'
import { existsSync } from 'node:fs'
import {
  DEV_URL, VIEWPORT, RAIL, INPUT, dismissCookieBanner, openEmbeddedCoach,
} from './browser-tests/page-helpers.mjs'
import { mockBackend } from './browser-tests/mock-backend.mjs'
import { CHOSEN, SELECTED_LANE, DOOR1_RECORD, DOOR2_RECORD } from './browser-tests/fixtures.mjs'

const EXECUTABLE_PATH = existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome')
  ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
  : undefined

const ASSISTANT_MSG = '[data-message-role="assistant"]'
// Deliberately slow: long enough that a naive (pre-fix) implementation --
// where next-move's fetch is sent as soon as its own eligibility becomes
// true, independent of whether delivery-p11's fetch has settled -- would
// have every opportunity to resolve and land in chatMessages first.
const DELIVERY_DELAY_MS = 600

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } else { console.log(`  ok   ${msg}`) } }

async function run() {
  const browser = await chromium.launch({ executablePath: EXECUTABLE_PATH, args: ['--disable-features=Translate,AutofillServerCommunication'] })
  try {
    const idKey = `${SELECTED_LANE}::${CHOSEN}`
    // Pre-seed delivery-p5 as already fired for this identity -- the same
    // shape the evaluator itself writes (coachMoments[key][subKey] =
    // {value, firedAt}), read back through the real hydration path
    // (buildProfileLoadResponse -> normalizeProfileState -> setCoachMoments).
    const coachMoments = {
      'delivery-p5': { [idKey]: { value: DOOR1_RECORD.outputs.p5, firedAt: '2026-09-01T12:00:00.000Z' } },
    }

    const requestLog = []
    // Built by hand rather than via newFlaggedFocusPage: the custom per-
    // moment /api/coach route below must be registered BEFORE the page ever
    // navigates, so it is in place before the evaluator's very first pass
    // (which can fire delivery-p11 within moments of the app mounting) --
    // registering it after newFlaggedFocusPage's own open step would be too
    // late, since the default 'Got it.' stub would already have answered
    // both moments by then. The flagged (coach_presence/embedded) account is
    // used deliberately, not the floating bubble: the embedded panel is on
    // screen from first paint with no click-to-open step, so there is no
    // race between the evaluator firing moments in the background (which
    // toggles the "Coach is thinking" state) and a bubble-open click target
    // that keeps re-rendering out from under it.
    const context = await browser.newContext({ viewport: VIEWPORT })
    const page = await context.newPage()
    await dismissCookieBanner(page)
    await mockBackend(page, { step: 'focus', flagged: true, onboardingConcierge: true, coachMoments })
    // Last-registered wins (Playwright route precedence, mock-backend.mjs's
    // own header comment) -- this overrides mockBackend's generic /api/coach
    // stub with per-moment responses, so delivery-p11 and next-move can be
    // told apart in the DOM and delivery-p11's response can be held back.
    await page.route('**/api/coach', async route => {
      let body = null
      try { body = route.request().postDataJSON() } catch { /* not JSON */ }
      const key = body && body.moment && body.moment.key
      requestLog.push({ key, at: Date.now() })
      if (key === 'delivery-p11') {
        await new Promise(r => setTimeout(r, DELIVERY_DELAY_MS))
        await route.fulfill({ status: 200, contentType: 'text/plain', body: 'DELIVERY_P11_REPLY' })
      } else if (key === 'next-move') {
        await route.fulfill({ status: 200, contentType: 'text/plain', body: 'NEXT_MOVE_REPLY' })
      } else {
        await route.fulfill({ status: 200, contentType: 'text/plain', body: 'Got it.' })
      }
    })
    await page.goto(DEV_URL)
    await page.locator(RAIL).waitFor({ state: 'visible', timeout: 30000 })
    await openEmbeddedCoach(page)

    // --- Item 1, part A: next-move's request must not be sent while
    // delivery-p11's is still in flight. ---
    await page.waitForTimeout(250) // well past when a same-pass eligible next-move would have been sent, pre-fix
    const momentReqsSoFar = requestLog.filter(r => r.key === 'delivery-p11' || r.key === 'next-move')
    check(momentReqsSoFar.length === 1 && momentReqsSoFar[0].key === 'delivery-p11',
      `Only delivery-p11's request has been sent 250ms in, with its response still held back -- next-move must wait for it to settle (saw: ${JSON.stringify(momentReqsSoFar.map(r => r.key))})`)

    // --- Item 1, part B: once delivery-p11's (delayed) response lands, the
    // evaluator re-fires (momentReevalTick) and next-move's request follows. ---
    await page.locator('text=DELIVERY_P11_REPLY').first().waitFor({ state: 'attached', timeout: 10000 })
    await page.locator('text=NEXT_MOVE_REPLY').first().waitFor({ state: 'attached', timeout: 10000 })
    const bothReqs = requestLog.filter(r => r.key === 'delivery-p11' || r.key === 'next-move')
    check(bothReqs.length === 2 && bothReqs[0].key === 'delivery-p11' && bothReqs[1].key === 'next-move',
      `Both requests were sent, delivery-p11 first (saw: ${JSON.stringify(bothReqs.map(r => r.key))})`)
    check(bothReqs[1].at - bothReqs[0].at >= DELIVERY_DELAY_MS - 50,
      `next-move's request was not sent until after delivery-p11's ${DELIVERY_DELAY_MS}ms-delayed response settled (gap=${bothReqs[1].at - bothReqs[0].at}ms) -- proves the fetches were serialized, not merely called in priority order`)

    // --- Item 1, part C: arrival order in the transcript matches call
    // order (Delivery before Next move), not whichever happened to resolve
    // first -- the actual symptom the ordering fix targets. ---
    const texts = await page.locator(ASSISTANT_MSG).allTextContents()
    const deliveryIdx = texts.findIndex(t => t.includes('DELIVERY_P11_REPLY'))
    const nextMoveIdx = texts.findIndex(t => t.includes('NEXT_MOVE_REPLY'))
    check(deliveryIdx !== -1 && nextMoveIdx !== -1 && deliveryIdx < nextMoveIdx,
      `Delivery's message renders before Next move's in the transcript (deliveryIdx=${deliveryIdx}, nextMoveIdx=${nextMoveIdx})`)

    // --- Item 2: Delivery's own taps are still visible after Next move's
    // message lands right after it -- the D1 bug (banner auto-collapse
    // hiding an earlier message's live quickReplies the moment a later one
    // supersedes it) would have hidden these behind a one-line strip. ---
    const deliveryMsg = page.locator(ASSISTANT_MSG).filter({ hasText: 'DELIVERY_P11_REPLY' }).first()
    const nextMoveMsg = page.locator(ASSISTANT_MSG).filter({ hasText: 'NEXT_MOVE_REPLY' }).first()
    // Tap labels updated by batch item 1.1.1 (2026-09-10): Remind me later /
    // Minimize Coach for now replace the retired session/screen quiet taps.
    check(await deliveryMsg.locator('button', { hasText: 'Remind me later' }).isVisible(),
      "Delivery's own \"Remind me later\" tap is still visible after Next move's message landed after it")
    check(await deliveryMsg.locator('button', { hasText: 'Minimize Coach for now' }).isVisible(),
      "Delivery's own \"Minimize Coach for now\" tap is still visible after Next move's message landed after it")
    // Next move's own action tap (the one new capability this catalog entry
    // adds -- see coach-moments.js's header comment): "Build {label}",
    // where {label} is the section after p5 in door1's build order (p6).
    check(await nextMoveMsg.locator('button', { hasText: /^Build /ig }).isVisible(),
      'Next move\'s own "Build {label}" action tap is visible on its message')

    await context.close()

    // --- Item 4(a), carried over from PR 1 (its own commit message: "needs
    // PR 2's not-yet-built catalog rows to be reachable") -- now that
    // op-next-move exists, this proves the client always sends the record
    // it is CURRENTLY OPEN ON as Situation, never whichever record was last
    // named in the chat transcript. Record B is mentioned by name in prior
    // chat history (the shape a keyword-match fallback would latch onto);
    // record A is the one actually open, with delivery-op-p5 already fired
    // as the anchor op-next-move reasons from. The server-side half of this
    // fix (situationRecordId's derivation on a moment turn, api/coach.js) is
    // covered by the exact-string assertion in test-coach-situation.mjs --
    // api/coach.js cannot be imported live here (eager DB connection, no
    // DATABASE_URL in this harness), so this covers the client-side half:
    // fireMoment's own situation:computeSituation() always reflects
    // currentSavedSlotIdRef, never the chat history it POSTs alongside it.
    {
      const recA = { ...DOOR2_RECORD, id: 'test-ordering-recA', title: 'Director of Ops, Record A', company: 'Record A Co', sections: { companyRead: { content: '', builtAt: null }, salaryRead: { content: '', builtAt: null }, p5: { content: 'Built Where You Fit for Record A.', builtAt: '2026-09-10T12:00:00.000Z' }, p6: '', p_res: { content: '', builtAt: null }, p_cover: { content: '', builtAt: null }, p11: { content: '', builtAt: null }, offerNegotiation: { content: '', builtAt: null } } }
      const recB = { ...DOOR2_RECORD, id: 'test-ordering-recB', title: 'Director of Ops, Record B', company: 'Record B Co' }
      const coachMoments = {
        'op-playbook-arrival': { [recA.id]: { value: 'fired', firedAt: '2026-09-01T12:00:00.000Z' } },
        'delivery-op-p5': { [recA.id]: { value: 'Built Where You Fit for Record A.', firedAt: '2026-09-01T12:05:00.000Z' } },
      }
      // stage drives opPickByStage (src/App.jsx) -- interviewing + Interview
      // Prep unbuilt gives a clean, single target (recA has only p5 built).
      const pursuitStatusRows = [{ record_id: recA.id, stage: 'interviewing' }]
      const context2 = await browser.newContext({ viewport: VIEWPORT })
      const page2 = await context2.newPage()
      await dismissCookieBanner(page2)
      await mockBackend(page2, {
        step: 'op', flagged: true, onboardingConcierge: true,
        savedPlaybooksOverride: [DOOR1_RECORD, recA, recB], chosenOverride: recA.title, coachMoments, pursuitStatusRows,
      })
      let nextMoveRequestBody = null
      await page2.route('**/api/coach', async route => {
        let body = null
        try { body = route.request().postDataJSON() } catch {}
        const key = body && body.moment && body.moment.key
        if (key === 'op-next-move') { nextMoveRequestBody = body; await route.fulfill({ status: 200, contentType: 'text/plain', body: 'NEXT_MOVE_RECORD_A_REPLY' }) }
        else await route.fulfill({ status: 200, contentType: 'text/plain', body: 'Got it.' })
      })
      await page2.goto(DEV_URL)
      await page2.locator(RAIL).waitFor({ state: 'visible', timeout: 30000 })
      await openEmbeddedCoach(page2)
      // Mention Record B by name in the transcript before Next move ever
      // fires -- the exact shape a keyword-match-on-history fallback would
      // resolve to, if the pinned Situation were not what actually won.
      await page2.locator(INPUT).fill(`Tell me about ${recB.title} at ${recB.company}.`)
      await page2.locator(INPUT).press('Enter')
      await page2.waitForTimeout(300)

      await page2.locator(ASSISTANT_MSG).filter({ hasText: 'NEXT_MOVE_RECORD_A_REPLY' }).first().waitFor({ state: 'attached', timeout: 10000 })
      check(!!nextMoveRequestBody && nextMoveRequestBody.situation && nextMoveRequestBody.situation.record && nextMoveRequestBody.situation.record.id === recA.id,
        `Next move's request names Record A (the one actually open), not Record B (last discussed in chat) -- got record: ${JSON.stringify(nextMoveRequestBody && nextMoveRequestBody.situation && nextMoveRequestBody.situation.record)}`)
      await context2.close()
    }
  } finally {
    await browser.close()
  }

  if (failures) {
    console.error(`test-coach-moments-ordering: ${failures} check(s) failed`)
    process.exit(1)
  } else {
    console.log('test-coach-moments-ordering: OK (next-move\'s request waits for delivery-p11\'s in-flight fetch to settle rather than firing in the same pass; arrival order in the transcript matches priority/call order even when the higher-priority moment resolves slower; delivery-p11\'s own taps stay visible once next-move\'s message lands after it; op-next-move\'s request names the record actually open, not one merely mentioned in chat)')
  }
}

run().catch(e => { console.error(e); process.exit(1) })
