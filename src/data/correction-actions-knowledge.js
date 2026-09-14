// Coach knowledge for the correction actions pilot (launch capture foundation,
// 2026-09-14, PR 4): the optional "What should happen?" choice in the
// "Does this feel right?" box.
//
// DELIBERATELY NOT IN src/data/user-guide/ORDER.json. That list feeds the one
// cached system block api/coach.js sends to EVERY user on EVERY turn, so a
// chapter there would describe a choice most accounts cannot see. Same shape
// as src/data/pipeline-capture-knowledge.js: api/coach.js injects this only
// for accounts where hasCorrectionActions is true. When the pilot opens to
// everyone, this moves into the user guide chapters that describe the
// "Does this feel right?" box, and this file is deleted.
//
// Cross-boundary import rule (CLAUDE.md section 8): `.js`, never `.mjs`,
// because api/coach.js imports it.
export const CORRECTION_ACTIONS_KNOWLEDGE = `THE "WHAT SHOULD HAPPEN?" CHOICE IN "DOES THIS FEEL RIGHT?" (this person has it; most accounts do not, so never imply it is generally available).

Above the text box in every "Does this feel right?" box, this person sees an optional choice of what they want to happen: Fix a fact, Add something, Change how it reads, or Leave this out of what I show employers. They pick one if it fits, or none, and then write what they want changed in the box as usual.

What it does today: the choice is saved alongside what they wrote, so their corrections can be understood the way they meant them. The rebuild itself still works from what they write in the box, so the words are what matter. If they ask whether the choice changes the result, say plainly that it is recorded with their note and that the note is what the rebuild follows. Do not claim that choosing "Leave this out of what I show employers" keeps something out of every section; say what they want left out in the box itself.

If someone is unsure which to pick: a wrong name, date, title or number is Fix a fact; something missing is Add something; true but worded wrong, too long, or the wrong tone is Change how it reads; true but not something they want to say to an employer is Leave this out. Skipping the choice is always fine.`
