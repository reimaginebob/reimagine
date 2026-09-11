// Route-mocks every backend call the app makes on load, so these tests run
// against the Vite dev server with no real account, no database, and no
// Anthropic call -- Playwright intercepts at the browser network layer,
// before a request ever reaches (or fails to reach) a real server. The
// client-side code that builds and sends each request runs identically
// either way, which is the only thing these tests need to be true.
//
// Playwright route precedence: the LAST-registered matching handler runs
// first (each earlier one is only reached via route.fallback()), so the
// broad catch-all is registered before the specific routes below it.
import { buildProfileLoadResponse, buildMeResponse, DOOR1_RECORD, DOOR2_RECORD } from './fixtures.mjs'

const json = (body) => ({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })

export async function mockBackend(page, { step = 'focus', flagged = false, coachReplyBody = 'Got it.', employmentStatus = 'employed', onboardingConcierge = false, nextStep = false, coachMoments, pursuitStatusRows, savedPlaybooksOverride, chosenOverride } = {}) {
  const coachRequests = []

  // Catch-all first (lowest precedence): anything not explicitly mocked
  // below gets a harmless empty 200 rather than a real network attempt.
  // Scoped to actual fetch/XHR calls (resourceType), not the URL pattern
  // alone: src/App.jsx imports a shared constant from ../api/_lib/ (a
  // legitimate cross-directory module import, Vite serves it as a 'script'
  // request), and that path also matches **/api/**. Fulfilling it with {}
  // as JSON broke the whole module graph (Vite's module-script MIME check
  // rejects it), which meant every test in this suite hung waiting for the
  // rail to ever render. Only intercept the resource types a real backend
  // call actually uses.
  await page.route('**/api/**', route => {
    const type = route.request().resourceType()
    if (type !== 'fetch' && type !== 'xhr') return route.fallback()
    return route.fulfill(json({}))
  })

  await page.route('**/api/me', route => route.fulfill(json(buildMeResponse({ flagged, employmentStatus, onboardingConcierge, nextStep }))))
  await page.route('**/api/profile/load', route => route.fulfill(json(buildProfileLoadResponse({ step, coachMoments, savedPlaybooksOverride, chosenOverride }))))
  await page.route('**/api/saved-playbooks', route => route.fulfill(json({ playbooks: savedPlaybooksOverride || [DOOR1_RECORD, DOOR2_RECORD] })))
  // Nothing needs to persist for these tests -- accept any write silently.
  await page.route('**/api/profile/save', route => route.fulfill(json({ ok: true, updatedAt: new Date().toISOString() })))
  // Live-side brief PR 2 (2026-09-10): pursuitStatusFor(recordId) (App.jsx)
  // reads this list to know an opportunity's stage and dates -- the op-side
  // Moments rows (Next move, Interview-close) need it. Optional and empty by
  // default, matching every other test in this suite that never touches
  // stage/dates; a caller passes pursuitStatusRows (the same {record_id,
  // stage, next_step_at, ...} shape GET /api/pursuit-status itself returns
  // in `rows`) to drive those rows specifically.
  await page.route('**/api/pursuit-status', route => route.fulfill(json({ rows: pursuitStatusRows || [] })))

  await page.route('**/api/coach', async route => {
    let body = null
    try { body = route.request().postDataJSON() } catch { /* not JSON, leave null */ }
    coachRequests.push(body)
    // coachReplyBody is overridable (default a short stub) so a caller can
    // mock a long reply -- e.g. to exercise the composer-visibility fix
    // (#846) against a real, tall transcript rather than a one-line reply.
    await route.fulfill({ status: 200, contentType: 'text/plain', body: coachReplyBody })
  })

  return { coachRequests }
}

// Waits for the Nth (1-indexed, default latest) /api/coach request captured
// so far, polling rather than racing a fixed delay -- the send() round trip
// (React state update -> fetch -> our own route handler) is fast but not
// synchronous with the click/keypress that triggered it.
export async function waitForCoachRequest(coachRequests, { count = null, timeoutMs = 5000 } = {}) {
  const target = count === null ? coachRequests.length + 1 : count
  const start = Date.now()
  while (coachRequests.length < target) {
    if (Date.now() - start > timeoutMs) throw new Error(`Timed out waiting for /api/coach request #${target} (have ${coachRequests.length})`)
    await new Promise(r => setTimeout(r, 50))
  }
  return coachRequests[target - 1]
}
