// Production report, Bob (test log L6/B6, 2026-09-10): "when Coach replies,
// the conversation scrolls to the end of the reply." A reply longer than the
// panel was entered from its last line, and when two messages arrived in one
// turn (a reply plus a capture offer, or a recap plus a Delivery), the first
// was scrolled out of view before it was read.
//
// Root cause (src/components/Chat.jsx): the old scroll effect re-anchored on
// EVERY message-array growth, always to whichever message had just arrived.
// A single typed question already produces more than one growth in the
// common case -- the reply itself, then (separately) a capture offer, an
// employment/pursuit save-offer, or a moment message appended right after it
// -- so the LAST growth always won, dragging the view to its own end and
// burying anything before it, reply included.
//
// Fix: a new Coach message pins its own TOP to the top of the visible area
// (never its end), with the person's message immediately above it when
// there is one. Several messages arriving together resolve to the FIRST of
// them, via a short debounce that anchors on the first growth of a burst and
// ignores any that follow until the burst goes quiet. If the person is
// scrolled up and not at the bottom when a message arrives, the view does
// not move; a small "New reply" marker appears instead. A tap (a synthetic
// quick-reply send) keeps the old follow-to-bottom behavior.
//
// Runs against the real headless Chromium + Vite dev server + mocked
// backend, same harness as test-browser-situation-tracking.mjs -- see that
// file's header for the general approach. Fixture bootstrap shared via
// scripts/browser-tests/page-helpers.mjs (flagged/embedded account, so the
// panel is on-screen without an extra open-the-bubble step).
import { chromium } from 'playwright'
import { existsSync } from 'node:fs'
import {
  VIEWPORT, INPUT, newFlaggedFocusPage,
} from './browser-tests/page-helpers.mjs'

const EXECUTABLE_PATH = existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome')
  ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
  : undefined

const TRANSCRIPT = '[data-coach-transcript="true"]'
const ASSISTANT_MSG = '[data-message-role="assistant"]'
const NEW_REPLY_MARKER = 'button[aria-label="New reply"]'
// Past Chat.jsx's own 250ms scroll-batch debounce, plus headroom for the
// smooth-scroll animation and the mocked stream to finish writing.
const SETTLE_MS = 900

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } else { console.log(`  ok   ${msg}`) } }

function longReply(label) {
  return Array.from({ length: 20 }, (_, i) =>
    `${label} paragraph ${i + 1}. Long enough on its own, and stacked twenty deep, that the whole reply runs well past a single panel's height.`
  ).join('\n\n')
}

async function box(locator) {
  return locator.boundingBox()
}

// True when `b`'s vertical span intersects the container's own visible box
// (the container has overflowY:auto with a fixed height, so its own
// boundingBox IS its visible viewport -- scrolled-off content is clipped
// outside it, not just outside the outer window).
function intersectsContainer(b, containerBox) {
  if (!b || !containerBox) return false
  return b.y < containerBox.y + containerBox.height && b.y + b.height > containerBox.y
}

async function run() {
  const browser = await chromium.launch({ executablePath: EXECUTABLE_PATH, args: ['--disable-features=Translate,AutofillServerCommunication'] })
  try {
    // --- Scenario 1: a reply longer than the panel is entered from its
    // TOP, not its last line. ---
    {
      const reply = longReply('Reply')
      const { context, page } = await newFlaggedFocusPage(browser, { coachReplyBody: reply })
      const input = page.locator(INPUT)
      await input.fill('Give me a long reply.')
      await input.press('Enter')
      await page.locator('text=Reply paragraph 20.').waitFor({ state: 'attached', timeout: 10000 })
      await page.waitForTimeout(SETTLE_MS)

      const containerBox = await box(page.locator(TRANSCRIPT))
      const firstLineBox = await box(page.locator('text=Reply paragraph 1.').first())
      const lastLineBox = await box(page.locator('text=Reply paragraph 20.').first())
      check(intersectsContainer(firstLineBox, containerBox), 'Long reply: its first line is visible in the transcript')
      check(!intersectsContainer(lastLineBox, containerBox), 'Long reply: its last line is NOT visible (would be, under the old scroll-to-end behavior)')
      await context.close()
    }

    // --- Scenario 2: two Coach messages land in one turn -- a reply, then
    // (moments later, same turn) the employment-mention capture offer --
    // and the scroll settles on the FIRST of them, per Bob's exact "a reply
    // plus a capture offer" case. employmentStatus:'' is what flips on
    // Chat's real employmentCaptureActive prop (App.jsx); the offer fires
    // off EMPLOYMENT_MENTION_RE matching the typed message, both genuine
    // app mechanisms, not a synthetic stand-in. The reply itself is made
    // deliberately long -- with a short reply the whole transcript fits
    // without scrolling at all, which would make "landed at the top" true
    // by coincidence rather than by the fix actually doing anything. ---
    {
      const { context, page } = await newFlaggedFocusPage(browser, { employmentStatus: '', coachReplyBody: longReply('Reply') })
      const before = await page.locator(ASSISTANT_MSG).count()
      const input = page.locator(INPUT)
      await input.fill('I am currently unemployed and job hunting.')
      await input.press('Enter')
      await page.locator('text=how would you describe your work situation right now?').waitFor({ state: 'attached', timeout: 10000 })
      await page.waitForTimeout(SETTLE_MS)

      const after = await page.locator(ASSISTANT_MSG).count()
      check(after === before + 2, `Two assistant messages landed this turn (reply + offer): before=${before} after=${after}`)
      const firstNew = page.locator(ASSISTANT_MSG).nth(after - 2) // the reply
      const secondNew = page.locator(ASSISTANT_MSG).nth(after - 1) // the offer
      const containerBox = await box(page.locator(TRANSCRIPT))
      const firstBox = await box(firstNew)
      const secondBox = await box(secondNew)
      check(firstBox && containerBox && Math.abs(firstBox.y - containerBox.y) < 24,
        `Scroll landed at the top of the FIRST new message (the reply), not the second (the offer) -- first.y=${firstBox && firstBox.y}, container.y=${containerBox && containerBox.y}`)
      check(!(secondBox && containerBox && Math.abs(secondBox.y - containerBox.y) < 24),
        'Scroll did not land on the SECOND message (the offer) -- that was the exact bug (the last-arrived message always won)')
      await context.close()
    }

    // --- Scenario 3: the person is scrolled up reading something else when
    // a new reply arrives -- the view must not move, and a small marker
    // offers the jump instead. ---
    {
      const { context, page } = await newFlaggedFocusPage(browser, { coachReplyBody: longReply('First') })
      const input = page.locator(INPUT)
      await input.fill('First question, give me a long reply.')
      await input.press('Enter')
      await page.locator('text=First paragraph 20.').waitFor({ state: 'attached', timeout: 10000 })
      await page.waitForTimeout(SETTLE_MS)

      // Deliberately scroll away from wherever the first reply settled, up
      // to the very top of the transcript's scrollable history.
      await page.locator(TRANSCRIPT).evaluate(el => { el.scrollTop = 0 })
      await page.waitForTimeout(150) // let the onScroll listener register atBottom=false
      const scrollTopBefore = await page.locator(TRANSCRIPT).evaluate(el => el.scrollTop)

      await input.fill('Second question, while I am scrolled up.')
      await input.press('Enter')
      await page.locator(NEW_REPLY_MARKER).waitFor({ state: 'visible', timeout: 10000 })
      await page.waitForTimeout(SETTLE_MS)

      const scrollTopAfter = await page.locator(TRANSCRIPT).evaluate(el => el.scrollTop)
      check(scrollTopAfter === scrollTopBefore, `Scroll position unchanged while scrolled up and a new reply arrived (before=${scrollTopBefore}, after=${scrollTopAfter})`)
      check(await page.locator(NEW_REPLY_MARKER).isVisible(), 'New reply marker is present')

      // Tapping the marker jumps to the new message and clears itself.
      await page.locator(NEW_REPLY_MARKER).click()
      await page.waitForTimeout(600)
      const scrollTopAfterTap = await page.locator(TRANSCRIPT).evaluate(el => el.scrollTop)
      check(scrollTopAfterTap !== scrollTopBefore, 'Tapping the marker moves the scroll position')
      check(!(await page.locator(NEW_REPLY_MARKER).isVisible()), 'Marker clears itself once tapped')
      await context.close()
    }
  } finally {
    await browser.close()
  }

  if (failures) {
    console.error(`test-coach-scroll-to-start: ${failures} check(s) failed`)
    process.exit(1)
  } else {
    console.log('test-coach-scroll-to-start: OK (a long reply enters from its top, two messages in one turn settle on the first, and a person scrolled up is never yanked down -- the marker offers the jump instead)')
  }
}

run().catch(e => { console.error(e); process.exit(1) })
