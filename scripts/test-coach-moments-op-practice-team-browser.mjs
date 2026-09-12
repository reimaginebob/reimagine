// Coach-as-Concierge Phase 4 Part 2 (Output/handoff/2026-09-09_concierge-
// batch-and-phase4-brief.md, §2.2, Column 2 rows 14/15): live verification
// that op-practice-interview-team fires once delivery-op-p11 has already
// reacted for a record whose built Interview Prep carries a real per-
// person team, and that its tap opens My Coach with the shared practice
// seed -- not sent, so the person can edit before sending.
import { chromium } from 'playwright'
import { existsSync } from 'node:fs'
import { newFlaggedFocusPage, INPUT } from './browser-tests/page-helpers.mjs'
import { DOOR1_RECORD, DOOR2_RECORD } from './browser-tests/fixtures.mjs'

const EXECUTABLE_PATH = existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome')
  ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
  : undefined

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } else { console.log(`  ok   ${msg}`) } }

// A built Interview Prep in the panel shape renderInterviewPrep branches on
// (ip.panel), same shape the page's own "Prep with My Coach" door reads.
const P11_WITH_TEAM = JSON.stringify({
  role_context: { target_role: DOOR2_RECORD.role },
  // parseInterviewPrepJSON requires at least 3 questions in the flat/panel
  // shape (App.jsx: qs.length<3 fails the parse).
  questions: [
    { id: 'q1', question: 'Tell me about a supply chain tradeoff you made.', type: 'non_behavioral', framework_thread: null, framing_recommendation: 'Answer plainly.' },
    { id: 'q2', question: 'What is your approach to carrier negotiations?', type: 'non_behavioral', framework_thread: null, framing_recommendation: 'Answer plainly.' },
    { id: 'q3', question: 'Why this role?', type: 'non_behavioral', framework_thread: null, framing_recommendation: 'Answer plainly.' },
  ],
  panel: [{ seat_id: 'vp_ops', seat_role: 'hiring_manager', name: 'Jordan Reyes', title: 'VP Operations', read: 'Weighing whether you can run the network end to end.', resonance: ['Owns the number, not just reports on it.'] }],
})

const DOOR2_WITH_TEAM = { ...DOOR2_RECORD, sections: { ...DOOR2_RECORD.sections, p11: { content: P11_WITH_TEAM, builtAt: '2026-09-01T12:00:00.000Z' } } }

const MESSAGE_TEXT = `Your interview team for ${DOOR2_RECORD.company} is mapped out. Want to prep with My Coach?`

async function run() {
  const browser = await chromium.launch({ executablePath: EXECUTABLE_PATH, args: ['--disable-features=Translate,AutofillServerCommunication'] })
  try {
    // delivery-op-p11 preset as already-fired for this record so the row is
    // eligible without racing the mocked Delivery round trip.
    const { page } = await newFlaggedFocusPage(browser, {
      step: 'op',
      onboardingConcierge: true,
      savedPlaybooksOverride: [DOOR1_RECORD, DOOR2_WITH_TEAM],
      coachMoments: { 'delivery-op-p11': { [DOOR2_RECORD.id]: { value: 'seeded', firedAt: new Date().toISOString() } } },
    })
    await page.waitForTimeout(2500)
    const bodyText = await page.evaluate(() => document.body.innerText)
    check(bodyText.includes(MESSAGE_TEXT), 'the op-practice-interview-team offer fires once delivery-op-p11 has already reacted for a record with a built team')

    const tapBtn = page.locator('button', { hasText: "Let's prep for it" }).first()
    check(await tapBtn.isVisible().catch(() => false), 'the "Let\'s prep for it" quick reply is visible')
    await tapBtn.click()
    await page.waitForTimeout(500)

    const composerVisible = await page.locator(INPUT).isVisible().catch(() => false)
    check(composerVisible, 'tapping Let\'s prep for it navigates to My Coach (composer is visible)')
    const seedValue = composerVisible ? await page.locator(INPUT).inputValue() : ''
    check(seedValue.includes(`I want to practice my interview answers for ${DOOR2_RECORD.company}.`),
      `the composer is prefilled with the practice seed naming the company (got: ${JSON.stringify(seedValue)})`)
    check(seedValue.includes('Walk me through my interview team'),
      'the seed asks Coach to walk through the team, distinguishing this row from the generic practice offer')

    const chatHistory = await page.evaluate(() => localStorage.getItem('reimagine_chat_history'))
    check(!(chatHistory || '').includes('Walk me through my interview team'),
      'the seed is NOT auto-sent -- it waits in the composer for the person to review or edit first')

    const occurrences = ((chatHistory || '').split(MESSAGE_TEXT).length - 1)
    check(occurrences === 1, `the offer fires exactly once in this session, not repeatedly (found ${occurrences} occurrence(s) in chat history)`)
  } finally {
    await browser.close()
  }
}

await run()

if (failures) {
  console.error(`test-coach-moments-op-practice-team-browser: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-coach-moments-op-practice-team-browser: OK (op-practice-interview-team fires once delivery-op-p11 has already reacted for a record with a real built team, its tap opens My Coach with the team-aware practice seed left unsent for review, and it fires only once per record)')
}
