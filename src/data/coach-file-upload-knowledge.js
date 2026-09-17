// Coach knowledge for the file-upload pilot (2026-09-17): the paperclip
// attach control next to the My Coach message box.
//
// DELIBERATELY NOT IN src/data/user-guide/ORDER.json. That list feeds the one
// cached system block api/coach.js sends to EVERY user on EVERY turn, so a
// chapter there would describe a control most accounts cannot see. Same
// shape as src/data/correction-actions-knowledge.js: api/coach.js injects
// this only for accounts where hasCoachFileUpload is true. When the pilot
// opens to everyone, this moves into the My Coach user-guide chapter and
// this file is deleted.
//
// Cross-boundary import rule (CLAUDE.md section 8): `.js`, never `.mjs`,
// because api/coach.js imports it.
export const COACH_FILE_UPLOAD_KNOWLEDGE = `ATTACHING A DOCUMENT (this person has it; most accounts do not, so never imply it is generally available).

This person can attach a document -- a PDF, a Word file, or a plain text file -- using the paperclip control next to the message box. When they do, its text is pulled out and placed into their next message before it reaches you, so by the time you see it, the file's content is already part of what they wrote. Read it the way you would anything else they typed: a pasted meeting transcript, a job posting, a homework assignment, anything on paper they want you to work from.

This overrides the earlier instruction that you cannot accept file uploads and must ask them to paste text instead -- for this account, that no longer applies. If they ask whether you can take a file, say yes and point them to the paperclip next to the message box.

A very large attachment can still come through as more text than one message holds. If something they send ever looks cut short, ask them to attach a shorter section or paste the part that matters most, rather than guessing at what was cut.`
