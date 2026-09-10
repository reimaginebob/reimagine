// Shared page-bootstrap helpers for the Playwright browser suite
// (scripts/test-browser-situation-tracking.mjs and friends). Split out of
// that file on 2026-09-10 so a second suite (the live-side concierge PR 1
// browser tests) can drive the same two account shapes without copying
// selectors or the open-panel dance: the ordinary floating-bubble account
// every non-flagged user sees, and the coach_presence-flagged account that
// renders the embedded concierge panel instead (App.jsx's conciergeEmbedded).
import { mockBackend, waitForCoachRequest } from './mock-backend.mjs'

export const DEV_URL = process.env.SITUATION_TEST_URL || 'http://localhost:5173'

// Taller than Playwright's 720px default -- see test-browser-situation-tracking.mjs's
// own VIEWPORT comment for the measured reason. Shared here so both account
// shapes render identically.
export const VIEWPORT = { width: 1280, height: 1000 }

// CSS/attribute locators throughout, not Playwright's role/accessible-name
// engine -- see test-browser-situation-tracking.mjs's original comment
// (observed matching a live aria-label reliably where computed ARIA
// role+name did not, in this environment).
export const RAIL = 'nav[aria-label="Playbook sections"]'
export const INPUT = 'textarea[placeholder="Ask your coach anything. Shift+Enter for a new line."]'
// Only rendered for the floating bubble (Chat's non-embedded branch) OR for
// the embedded concierge panel once it has been minimized back down to a
// pill (App.jsx ~17497, conciergeEmbedded&&coachPresence==='minimized') --
// both cases share the same aria-label. Not present on first load of the
// embedded panel, since coachPresence's initial value is 'open'
// (App.jsx's `const[coachPresence,setCoachPresence]=useState('open')`): the
// panel is already showing, nothing to click open.
export const OPEN_COACH = 'button[aria-label*="Open My Coach"]'

export async function dismissCookieBanner(page) {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('reimagine_cookie_acknowledged_v1', '1')
      localStorage.setItem('reimagine_support_announce_v1_dismissed', '1')
    } catch {}
  })
}

// Floating-bubble account: the panel starts closed, so this clicks the
// bubble open and waits for the composer to become interactive. Opening the
// panel can itself fire a silent, un-typed request (the returning-session
// opening recap) that disables the textarea until it resolves -- waiting
// for the not([disabled]) state clears that race without hardcoding which
// silent turns exist.
export async function openFloatingCoach(page) {
  await page.locator(OPEN_COACH).click()
  await page.locator(INPUT).waitFor({ state: 'visible', timeout: 10000 })
  await page.locator(`${INPUT}:not([disabled])`).waitFor({ state: 'visible', timeout: 10000 })
}

// Flagged (coach_presence) account: conciergeEmbedded renders the panel
// directly, open by default -- there is no bubble to click, so this only
// waits for the composer to become interactive (same silent-turn race as
// the floating case).
export async function openEmbeddedCoach(page) {
  await page.locator(INPUT).waitFor({ state: 'visible', timeout: 10000 })
  await page.locator(`${INPUT}:not([disabled])`).waitFor({ state: 'visible', timeout: 10000 })
}

async function newPage(browser, { step, flagged, coachReplyBody, employmentStatus, onboardingConcierge, coachMoments, pursuitStatusRows, savedPlaybooksOverride, chosenOverride }) {
  const context = await browser.newContext({ viewport: VIEWPORT })
  const page = await context.newPage()
  await dismissCookieBanner(page)
  const { coachRequests } = await mockBackend(page, { step, flagged, coachReplyBody, employmentStatus, onboardingConcierge, coachMoments, pursuitStatusRows, savedPlaybooksOverride, chosenOverride })
  await page.goto(DEV_URL)
  await page.locator(RAIL).waitFor({ state: 'visible', timeout: 30000 })
  return { context, page, coachRequests }
}

// Ordinary (unflagged) Focus Playbook page, floating bubble opened.
export async function newFocusPage(browser, { step = 'focus', coachReplyBody, employmentStatus, onboardingConcierge, coachMoments, pursuitStatusRows, savedPlaybooksOverride, chosenOverride } = {}) {
  const { context, page, coachRequests } = await newPage(browser, { step, flagged: false, coachReplyBody, employmentStatus, onboardingConcierge, coachMoments, pursuitStatusRows, savedPlaybooksOverride, chosenOverride })
  await openFloatingCoach(page)
  return { context, page, coachRequests }
}

// Flagged (coach_presence) page, embedded panel already open. Named for its
// original (Focus Playbook) use; step also accepts 'pipeline' or 'op' for
// the live-side brief PR 2 browser tests -- pursuitStatusRows and
// savedPlaybooksOverride/chosenOverride (all optional) drive an
// opportunity's stage/dates/built-cards for those without touching the
// shared DOOR1_RECORD/DOOR2_RECORD fixtures.
export async function newFlaggedFocusPage(browser, { step = 'focus', coachReplyBody, employmentStatus, onboardingConcierge, coachMoments, pursuitStatusRows, savedPlaybooksOverride, chosenOverride } = {}) {
  const { context, page, coachRequests } = await newPage(browser, { step, flagged: true, coachReplyBody, employmentStatus, onboardingConcierge, coachMoments, pursuitStatusRows, savedPlaybooksOverride, chosenOverride })
  await openEmbeddedCoach(page)
  return { context, page, coachRequests }
}

export async function clickRailSection(page, label) {
  const btn = page.locator(RAIL).locator('button', { hasText: label }).first()
  // Explicit native scrollIntoView, not Playwright's own actionability
  // auto-scroll -- see test-browser-situation-tracking.mjs's original
  // comment for the measured reason (nested scrollable ancestors).
  await btn.evaluate(el => el.scrollIntoView({ block: 'center' }))
  await btn.click()
}

// Types "Where am I?" and sends it, returning the situation.section the next
// captured /api/coach request carried. Baseline is taken before the send so
// a silent turn that lands in the gap can never be mistaken for our own
// message's request.
export async function askWhereAmI(page, coachRequests) {
  const baseline = coachRequests.length
  const input = page.locator(INPUT)
  await input.fill('Where am I?')
  await input.press('Enter')
  const body = await waitForCoachRequest(coachRequests, { count: baseline + 1 })
  return body && body.situation ? body.situation.section : undefined
}
