// Batch item 8: live-browser confirmation that the Start Fresh dialog
// (src/App.jsx's startFreshModal, replacing the old window.confirm) actually
// renders and behaves as the source-presence checks in
// scripts/test-start-fresh-confirmation.mjs assert it does -- opening the
// account menu, clicking Start Fresh, and confirming the dialog appears
// with the right copy and buttons, Cancel closes it without deleting
// anything, and reopening + clicking the destructive button fires the real
// delete request. Runs against the real headless Chromium + Vite dev
// server + mocked backend, same harness as the other browser tests.
import { chromium } from 'playwright'
import { existsSync } from 'node:fs'
import { newFocusPage } from './browser-tests/page-helpers.mjs'

const EXECUTABLE_PATH = existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome')
  ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
  : undefined

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } else { console.log(`  ok   ${msg}`) } }

const browser = await chromium.launch({ executablePath: EXECUTABLE_PATH })
try {
  const { context, page } = await newFocusPage(browser)

  // Mock the delete endpoint so a real click on the destructive button is
  // observable without actually deleting anything server-side.
  let deleteCalled = false
  await page.route('**/api/account/delete', route => {
    deleteCalled = true
    route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
  })
  // location.replace('/') would navigate away and end the test -- block it
  // so the assertions below can still run after the click.
  await page.addInitScript(() => {
    window.location.replace = () => {}
  })

  await page.locator('button[aria-haspopup="true"]', { hasText: 'Account' }).click()
  await page.locator('button[role="menuitem"]', { hasText: 'Start Fresh' }).click()

  const dialog = page.locator('div[role="dialog"][aria-label="Start Fresh"]')
  await dialog.waitFor({ state: 'visible', timeout: 5000 })
  check(true, 'Start Fresh dialog opened from the account menu')
  check(await dialog.locator('text=This permanently deletes your profile, outputs, saved playbooks, and chat history. You can sign back in with the same email to start over.').isVisible(),
    'the dialog shows the brief\'s exact body copy')

  const cancelBtn = dialog.locator('button', { hasText: 'Cancel' })
  const deleteBtn = dialog.locator('button', { hasText: 'Delete my account' })
  check(await cancelBtn.isVisible() && await deleteBtn.isVisible(), 'both Cancel and Delete my account are visible')

  const focused = await page.evaluate(() => document.activeElement && document.activeElement.textContent)
  check(focused === 'Cancel', `Cancel is the focused (default) button on open (got focused element text: ${JSON.stringify(focused)})`)

  // Cancel closes the dialog and does NOT call delete.
  await cancelBtn.click()
  await dialog.waitFor({ state: 'hidden', timeout: 5000 })
  check(!deleteCalled, 'clicking Cancel did not call the delete endpoint')
  check(true, 'clicking Cancel closed the dialog')

  // Reopen and confirm the destructive path actually fires the request.
  await page.locator('button[aria-haspopup="true"]', { hasText: 'Account' }).click()
  await page.locator('button[role="menuitem"]', { hasText: 'Start Fresh' }).click()
  await dialog.waitFor({ state: 'visible', timeout: 5000 })
  await deleteBtn.click()
  await page.waitForTimeout(500)
  check(deleteCalled, 'clicking "Delete my account" called the real delete endpoint')

  await context.close()
} finally {
  await browser.close()
}

if (failures) {
  console.error(`test-start-fresh-modal-browser: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-start-fresh-modal-browser: OK (Start Fresh dialog opens from the account menu with the brief\'s exact copy, Cancel is focused by default and closes it with no delete call, and the destructive button actually fires the delete request)')
}
