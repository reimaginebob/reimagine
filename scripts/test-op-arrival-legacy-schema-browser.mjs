// F1 twenty-minute session, item 4: opCurrentRecordRaw (App.jsx) used to
// require rec.schemaVersion===2 on top of rec.source==='door2', so the
// Opportunity Playbook arrival (op-playbook-arrival, src/coach-moments.js --
// eligible on ctx.opRecord being truthy, which opCurrentRecordRaw feeds)
// never fired for a record saved at an earlier schema version, even though
// computeSituation resolves the same record with no version check at all
// and already hands it to Coach. Fix: opCurrentRecordRaw now accepts any
// door2 record regardless of schemaVersion; opRecord's own sections||{}
// fallback already handles a v1 record with no .sections cleanly (reads as
// nothing built).
//
// This seeds a v1 door2 record (no schemaVersion:2, no .sections at all --
// the shape a record from before the Opportunity Playbook cards existed
// would actually have) and confirms the arrival still fires and names it.
import { chromium } from 'playwright'
import { existsSync } from 'node:fs'
import { DEV_URL, VIEWPORT, INPUT, dismissCookieBanner } from './browser-tests/page-helpers.mjs'
import { mockBackend } from './browser-tests/mock-backend.mjs'
import { DOOR2_TITLE } from './browser-tests/fixtures.mjs'

const EXECUTABLE_PATH = existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome')
  ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
  : undefined

const ASSISTANT_MSG = '[data-message-role="assistant"]'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } else { console.log(`  ok   ${msg}`) } }

// A v1 door2 record: no schemaVersion field at all (the exact PR1/PR2-era
// shape App.jsx's own localStorage backfill comment describes), no
// .sections -- predates the Opportunity Playbook cards existing.
const V1_RECORD = {
  id: 'test-op-v1-legacy-001',
  title: DOOR2_TITLE,
  company: 'Meridian Freight',
  role: 'Director of Logistics',
  location: 'Remote',
  lane: 'specific',
  source: 'door2',
  createdAt: '2026-08-01T12:00:00.000Z',
  updatedAt: '2026-08-01T12:00:00.000Z',
  outputs: { op: '' },
  done: [],
}

async function run() {
  const browser = await chromium.launch({ executablePath: EXECUTABLE_PATH, args: ['--disable-features=Translate,AutofillServerCommunication'] })
  try {
    const context = await browser.newContext({ viewport: VIEWPORT })
    const page = await context.newPage()
    await dismissCookieBanner(page)
    await mockBackend(page, { flagged: true, onboardingConcierge: true, step: 'op' })
    await page.route('**/api/profile/load', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        updatedAt: '2026-09-01T12:00:00.000Z',
        profile: {
          step: 'op',
          chosen: DOOR2_TITLE,
          selectedLane: 'specific',
          exploredRoleTitles: [],
          outputs: {},
          done: [],
          profile: {},
          savedPlaybooks: [V1_RECORD],
        },
      }),
    }))
    await page.goto(DEV_URL)
    await page.locator(INPUT).waitFor({ state: 'visible', timeout: 15000 })
    await page.waitForTimeout(800)

    const texts = await page.locator(ASSISTANT_MSG).allTextContents()
    const combined = texts.join(' ||| ')
    check(combined.includes('This is your playbook for'),
      `the Opportunity Playbook arrival fires for a v1 (pre-schema-version-2) door2 record (transcript: ${JSON.stringify(combined.slice(0, 300))})`)
    check(combined.includes(DOOR2_TITLE) || combined.includes('Meridian Freight'),
      `the arrival names the v1 record by title/company, not a generic line (transcript: ${JSON.stringify(combined.slice(0, 300))})`)

    await context.close()
  } finally {
    await browser.close()
  }

  if (failures) {
    console.error(`test-op-arrival-legacy-schema-browser: ${failures} check(s) failed`)
    process.exit(1)
  } else {
    console.log('test-op-arrival-legacy-schema-browser: OK (the Opportunity Playbook arrival fires and names a v1 door2 record, matching computeSituation\'s own version-agnostic lookup instead of silently never firing for a legacy record)')
  }
}

run().catch(e => { console.error(e); process.exit(1) })
