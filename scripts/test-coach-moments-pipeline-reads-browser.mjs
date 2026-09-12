// Coach-as-Concierge Phase 4 Part 2 (Output/handoff/2026-09-09_concierge-
// batch-and-phase4-brief.md, §2.2, Column 2 rows 23/24): live verification
// of the two My Pipeline reads -- the pipeline read (a step-back reflection
// on the whole board) and the opportunity read (a quick read on the
// nearest record, without opening its playbook). Both are Delivery-
// adjacent on op-pipeline-arrival, preset here as already-fired so the
// rows are eligible without racing that mocked round trip, and both are
// autoSend:true like their page doors.
import { chromium } from 'playwright'
import { existsSync } from 'node:fs'
import { DEV_URL, VIEWPORT, dismissCookieBanner, INPUT } from './browser-tests/page-helpers.mjs'
import { mockBackend } from './browser-tests/mock-backend.mjs'
import { DOOR2_RECORD } from './browser-tests/fixtures.mjs'

const EXECUTABLE_PATH = existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome')
  ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
  : undefined

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } else { console.log(`  ok   ${msg}`) } }

// My Pipeline has no section rail (RAIL is Focus/Opportunity Playbook-only,
// per test-coach-moments-op-side.mjs's own comment) -- newFlaggedFocusPage
// (page-helpers.mjs) hardcodes a wait on it, so this bootstraps the same
// flagged embedded-panel shape directly, waiting on the composer instead.
async function newFlaggedPipelinePage(browser, opts) {
  const context = await browser.newContext({ viewport: VIEWPORT })
  const page = await context.newPage()
  await dismissCookieBanner(page)
  await mockBackend(page, { step: 'pipeline', flagged: true, onboardingConcierge: true, ...opts })
  await page.goto(DEV_URL)
  await page.locator(INPUT).waitFor({ state: 'visible', timeout: 30000 })
  return { context, page }
}

// A second active opportunity -- op-pipeline-read requires 2+, and the
// default fixture set carries only one door2 record.
const SECOND_RECORD = { ...DOOR2_RECORD, id: 'test-door2-002', title: 'Ops Director, Harborline', company: 'Harborline', updatedAt: '2026-08-15T12:00:00.000Z' }
const PIPELINE_ARRIVAL_FIRED = { 'op-pipeline-arrival': { _: { value: 'fired', firedAt: new Date().toISOString() } } }
const nowFired = () => ({ value: 'fired', firedAt: new Date().toISOString() })

async function run() {
  const browser = await chromium.launch({ executablePath: EXECUTABLE_PATH, args: ['--disable-features=Translate,AutofillServerCommunication'] })
  try {
    // --- op-pipeline-read: fires once 2+ opportunities exist AND
    // op-pipeline-arrival has already reacted. op-opportunity-read is
    // independently eligible under the exact same gate (no ordering
    // between the two), so it's preset as already-fired here too --
    // otherwise both could appear in the same pass window and this
    // scenario would not isolate which "Give me the read" button belongs
    // to which row. ---
    {
      const { context, page } = await newFlaggedPipelinePage(browser, {
        savedPlaybooksOverride: [DOOR2_RECORD, SECOND_RECORD],
        coachMoments: { ...PIPELINE_ARRIVAL_FIRED, 'op-opportunity-read': { [DOOR2_RECORD.id]: nowFired() } },
      })
      await page.waitForTimeout(2000)
      const bodyText = await page.evaluate(() => document.body.innerText)
      check(bodyText.includes("Want to step back and look at your whole pipeline"),
        'op-pipeline-read fires with 2+ active opportunities once op-pipeline-arrival has already reacted')

      const tapBtn = page.locator('button', { hasText: 'Give me the read' }).last()
      check(await tapBtn.isVisible().catch(() => false), 'a "Give me the read" quick reply is visible')
      await tapBtn.click()
      await page.waitForTimeout(500)
      const chatHistory = (await page.evaluate(() => localStorage.getItem('reimagine_chat_history'))) || ''
      check(chatHistory.includes('Step back and look at my whole pipeline.'),
        'tapping sends the pipeline board\'s own "Get My Coach\'s read on your pipeline" seed unchanged (autoSend true)')
      await context.close()
    }

    // --- op-opportunity-read: same gate, naming the nearest record (here
    // the only record dated -- opDatesFor reads pursuit-status, empty by
    // default, so the fallback is the most recently updated one:
    // DOOR2_RECORD itself, updatedAt 2026-09-01 vs the second record's
    // 2026-08-15). Preset weakness/routed... n/a here; just op-pipeline-
    // read's own dedupe as already-fired so op-opportunity-read wins next. ---
    {
      const { context, page } = await newFlaggedPipelinePage(browser, {
        savedPlaybooksOverride: [DOOR2_RECORD, SECOND_RECORD],
        coachMoments: { ...PIPELINE_ARRIVAL_FIRED, 'op-pipeline-read': { _: { value: 'fired', firedAt: new Date().toISOString() } } },
      })
      await page.waitForTimeout(2000)
      const bodyText = await page.evaluate(() => document.body.innerText)
      check(bodyText.includes(`My Coach can give you a read on ${DOOR2_RECORD.company} without opening its playbook.`),
        'op-opportunity-read fires naming the nearest record once op-pipeline-arrival has reacted and op-pipeline-read is out of the way')

      const tapBtn = page.locator('button', { hasText: 'Give me the read' }).last()
      check(await tapBtn.isVisible().catch(() => false), 'a "Give me the read" quick reply is visible')
      await tapBtn.click()
      await page.waitForTimeout(500)
      const chatHistory = (await page.evaluate(() => localStorage.getItem('reimagine_chat_history'))) || ''
      check(chatHistory.includes(`Give me your read on where my ${DOOR2_RECORD.title} opportunity stands right now`),
        'tapping sends the per-record page door\'s own seed unchanged (autoSend true), using the same title fallback the pipeline board uses')
      await context.close()
    }
  } finally {
    await browser.close()
  }
}

await run()

if (failures) {
  console.error(`test-coach-moments-pipeline-reads-browser: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-coach-moments-pipeline-reads-browser: OK (op-pipeline-read and op-opportunity-read both fire once op-pipeline-arrival has already reacted, and both tap through to their existing page doors\' exact autoSend seeds)')
}
