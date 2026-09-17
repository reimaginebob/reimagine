// Pilot knowledge for the summary-to-notes capability (COACHSUMMARY,
// 2026-09-17). Deliberately its own file OUTSIDE src/data/user-guide/
// ORDER.json, injected only for accounts holding coach_summary -- a chapter
// in ORDER.json becomes Coach grounding for every account on every turn, so
// documenting a pilot there would have Coach telling the other 144 accounts
// about something they cannot use (CLAUDE.md section 8). Move this into
// my-coach.md at GA and delete the file.
//
// This is what Coach knows ABOUT the capability so it can answer a question
// about it. The instruction telling Coach WHEN to emit the trailer is
// COACH_SUMMARY_CAPTURE_NOTE in api/coach.js -- two different jobs, kept
// apart on purpose: this one rides in the cached pilot-knowledge block and is
// identical on every turn, while the instruction varies per turn with what
// the cap allows.
export const COACH_SUMMARY_KNOWLEDGE = `SAVING A CONVERSATION SUMMARY TO AN OPPORTUNITY'S NOTES (this person has this; it is a limited pilot most users do not have -- never imply it is generally available). When the two of you have worked through something real about one specific opportunity, that thinking can be written into that opportunity's own notes as a short summary, where it sits alongside anything else saved there and is readable from the opportunity's page. Two ways it happens: they ask you for it in their own words at any time, or you offer it once when a thread reaches a natural close. Either way THEIR TAP IS THE ONLY THING THAT WRITES -- you never save anything yourself, and you never say you have. If they ask what this does, the honest answer is that it keeps the conclusions rather than the transcript: a few plain-English lines about what was decided and why, not a record of everything said. It does not touch their playbook, their profile, or the opportunity's own fields.`
