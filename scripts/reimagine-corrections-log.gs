// Reimagine Corrections Log — Apps Script web app
// Receives correction events from the Reimagine client and appends a row to the
// "Reimagine Corrections Log" sheet. Fire-and-forget; no response body required.
//
// Update the EXISTING deployment when changing this file. New deployment = new URL = silent break.

const SHEET_NAME = 'Reimagine Corrections Log'
// Sheet ID: open the Reimagine Corrections Log sheet, copy the long string between /d/ and /edit in the URL
const SHEET_ID = '1EI62uq_A4HQOLwMuU9W4TTiHayD0ugT0LAz-cZk451c'

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents || '{}')

    // Runtime voice validator events. Additive and backward compatible: only
    // type === 'voice_violation' takes this branch; correction events below
    // are unchanged. Writes to a separate "Reimagine Voice Violations" tab.
    if (body.type === 'voice_violation') {
      const VOICE_SHEET = 'Reimagine Voice Violations'
      const ss = SpreadsheetApp.openById(SHEET_ID)
      let vs = ss.getSheetByName(VOICE_SHEET)
      if (!vs) {
        vs = ss.insertSheet(VOICE_SHEET)
        vs.appendRow(['Timestamp', 'User Email', 'User Name', 'Step', 'Step Display Name', 'Attempt', 'Outcome', 'Violation Names', 'Violation Excerpts', 'App Version', 'Browser'])
      }
      vs.appendRow([
        new Date(),
        String(body.userEmail || '').slice(0, 200),
        String(body.userName || '').slice(0, 200),
        String(body.step || '').slice(0, 50),
        String(body.stepDisplayName || '').slice(0, 100),
        Number(body.attempt || 0),
        body.recovered ? 'recovered' : 'failed-open',
        String(body.violationNames || '').slice(0, 500),
        String(body.violationExcerpts || '').slice(0, 5000),
        String(body.appVersion || '').slice(0, 50),
        String(body.browser || '').slice(0, 200),
      ])
      return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(ContentService.MimeType.JSON)
    }

    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME) || SpreadsheetApp.openById(SHEET_ID).getSheets()[0]

    sheet.appendRow([
      new Date(),
      String(body.userEmail || '').slice(0, 200),
      String(body.userName || '').slice(0, 200),
      String(body.correctionId || '').slice(0, 100),
      String(body.step || '').slice(0, 50),
      String(body.stepDisplayName || '').slice(0, 100),
      Number(body.sectionOutputLength || 0),
      String(body.correctionText || '').slice(0, 5000),
      String(body.appVersion || '').slice(0, 50),
      String(body.browser || '').slice(0, 200),
    ])

    return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(ContentService.MimeType.JSON)
  } catch (err) {
    // Best-effort log to email so silent failures don't go unnoticed
    try {
      MailApp.sendEmail({
        to: 'bob@career.club',
        subject: 'Reimagine Corrections Log error',
        body: `Error: ${err.message}\n\nPayload: ${e && e.postData && e.postData.contents ? e.postData.contents.slice(0, 1000) : 'none'}`,
      })
    } catch {}
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: err.message })).setMimeType(ContentService.MimeType.JSON)
  }
}

function doGet() {
  return ContentService.createTextOutput('Reimagine Corrections Log endpoint. POST only.').setMimeType(ContentService.MimeType.TEXT)
}
