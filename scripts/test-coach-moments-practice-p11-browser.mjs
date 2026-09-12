// Coach-as-Concierge Phase 4 Part 2 (Output/handoff/2026-09-09_concierge-
// batch-and-phase4-brief.md, §2.2, Column 2 row 13): live verification that
// practice-p11-weakest fires once delivery-p11 has already reacted for the
// identity, and that its tap opens My Coach with the same practice seed the
// op-side "practice the weakest answer" mechanism already uses -- not sent,
// so the person can edit before sending, same as every other openCoachWith
// door with autoSend left at its false default.
import { chromium } from 'playwright'
import { existsSync } from 'node:fs'
import { newFlaggedFocusPage, INPUT } from './browser-tests/page-helpers.mjs'
import { CHOSEN, SELECTED_LANE } from './browser-tests/fixtures.mjs'

const EXECUTABLE_PATH = existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome')
  ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
  : undefined

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } else { console.log(`  ok   ${msg}`) } }

const MESSAGE_TEXT = "Interview Prep is built. Want to practice the answer that's weakest?"
const IDKEY = `${SELECTED_LANE}::${CHOSEN}`

async function run() {
  const browser = await chromium.launch({ executablePath: EXECUTABLE_PATH, args: ['--disable-features=Translate,AutofillServerCommunication'] })
  try {
    // delivery-p11 preset as already-fired for this identity (its dedupe
    // value is the section's own interviewPrepToProse text -- the exact
    // value does not matter to practiceP11Target, which only checks the
    // record's presence) so the row is eligible on load rather than racing
    // the mocked Delivery round trip that would otherwise have to fire and
    // settle first.
    const { page } = await newFlaggedFocusPage(browser, {
      onboardingConcierge: true,
      coachMoments: { 'delivery-p11': { [IDKEY]: { value: 'seeded', firedAt: new Date().toISOString() } } },
    })
    await page.waitForTimeout(2000)
    const bodyText = await page.evaluate(() => document.body.innerText)
    check(bodyText.includes(MESSAGE_TEXT), 'the practice-p11-weakest offer fires once delivery-p11 has already reacted for this identity')

    const tapBtn = page.locator('button', { hasText: 'Practice it' }).first()
    check(await tapBtn.isVisible().catch(() => false), 'the "Practice it" quick reply is visible')
    await tapBtn.click()
    await page.waitForTimeout(500)

    const composerVisible = await page.locator(INPUT).isVisible().catch(() => false)
    check(composerVisible, 'tapping Practice it navigates to My Coach (composer is visible)')
    const seedValue = composerVisible ? await page.locator(INPUT).inputValue() : ''
    check(seedValue.includes(`I want to practice my interview answers for ${CHOSEN}.`),
      `the composer is prefilled with the practice seed naming the chosen role (got: ${JSON.stringify(seedValue)})`)

    // autoSend is false for this row -- the seed must sit in the composer
    // for review/edit, not already be in the sent chat history.
    const chatHistory = await page.evaluate(() => localStorage.getItem('reimagine_chat_history'))
    check(!(chatHistory || '').includes(`I want to practice my interview answers for ${CHOSEN}.`),
      'the seed is NOT auto-sent -- it waits in the composer for the person to review or edit first')

    // Once-per-identity within this session: the offer's own dedupe record
    // (written to coachMoments the instant it fires) must not let it land a
    // second time in this same live session. Cross-reload persistence of
    // that record rides the same profile-save/hydration path every other
    // catalog entry's dedupe already uses (coachMoments threaded through
    // stateForSave, covered structurally by test-coach-moments.mjs) rather
    // than this row needing its own reload check against a static mock that
    // cannot reflect an autosave round trip.
    const occurrences = ((await page.evaluate(() => localStorage.getItem('reimagine_chat_history'))) || '').split(MESSAGE_TEXT).length - 1
    check(occurrences === 1, `the offer fires exactly once in this session, not repeatedly (found ${occurrences} occurrence(s) in chat history)`)
  } finally {
    await browser.close()
  }
}

await run()

if (failures) {
  console.error(`test-coach-moments-practice-p11-browser: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-coach-moments-practice-p11-browser: OK (practice-p11-weakest fires once delivery-p11 has already reacted for the identity, its tap opens My Coach with the existing op-side practice seed left unsent for review, and it fires only once per identity)')
}
