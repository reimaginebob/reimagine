// Coach knowledge for the "Next move" capture pilot (brief 2026-09-02).
//
// DELIBERATELY NOT IN src/data/user-guide/ORDER.json. That list feeds
// USER_GUIDE_CONTENT, which api/coach.js interpolates into the ONE cached
// system block it sends to EVERY user on EVERY turn -- so a chapter there would
// describe a capability to 144 accounts that cannot use it. Same reasoning, and
// the same shape, as src/data/go-independent-knowledge.js: the text lives here
// and api/coach.js injects it only for accounts holding PIPELINE_CAPTURE_FLAG.
//
// This satisfies CLAUDE.md section 8 (docs ship with the feature) by
// partitioning the audience rather than deferring the documentation. When the
// pilot opens to everyone, this content moves into src/data/user-guide/
// my-coach.md and my-pipeline.md and this file is deleted.
//
// Cross-boundary import rule (CLAUDE.md section 8): `.js`, never `.mjs`,
// because api/coach.js imports it.
export const PIPELINE_CAPTURE_KNOWLEDGE = `SAVING A NEXT MOVE FROM THE CONVERSATION (this person has it; most accounts do not, so never imply it is generally available).

Every opportunity on My Pipeline has a "Next move" field: what they are doing next, in their own words, with the date they mean to do it by. It is the field that drives the rest of that screen -- an opportunity whose next move is past its date is flagged Overdue, and "Mark done" clears the move and its date together and files what they finished onto that opportunity's notes.

Until now the only way to fill that field was to type it on the card. For this person it is not: when they tell you an action they have decided to take on one of their opportunities -- a call they are making, a follow-up they are sending, someone they are reaching out to -- the app offers them a one-tap button to put it straight onto the card, with the wording and the date shown on the button before anything is saved.

Three things to hold onto. You never write to their pipeline yourself; the tap is what saves, and they can decline. The offer appears on its own, so do not tell them to go and type it in, and do not mention the mechanism. And a move captured this way is the same field they could have typed, so everything you already know about reading My Pipeline applies to it unchanged.`
