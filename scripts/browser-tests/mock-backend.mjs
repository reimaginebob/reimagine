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

export async function mockBackend(page, { step = 'focus' } = {}) {
  const coachRequests = []

  // Catch-all first (lowest precedence): anything not explicitly mocked
  // below gets a harmless empty 200 rather than a real network attempt.
  await page.route('**/api/**', route => route.fulfill(json({})))

  await page.route('**/api/me', route => route.fulfill(json(buildMeResponse())))
  await page.route('**/api/profile/load', route => route.fulfill(json(buildProfileLoadResponse({ step }))))
  await page.route('**/api/saved-playbooks', route => route.fulfill(json({ playbooks: [DOOR1_RECORD, DOOR2_RECORD] })))
  // Nothing needs to persist for these tests -- accept any write silently.
  await page.route('**/api/profile/save', route => route.fulfill(json({ ok: true, updatedAt: new Date().toISOString() })))

  await page.route('**/api/coach', async route => {
    let body = null
    try { body = route.request().postDataJSON() } catch { /* not JSON, leave null */ }
    coachRequests.push(body)
    await route.fulfill({ status: 200, contentType: 'text/plain', body: 'Got it.' })
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
