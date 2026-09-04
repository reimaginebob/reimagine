// Coach-as-Concierge, item 1, slice 2: what Coach says right before each
// orientation step, in place of that step's silent arrival. Adapted from the
// copy already on each screen (mostly the existing CoachingCallout text) so
// this is a relocation into Coach's voice, not a new set of claims about the
// product -- see api/coach.js/src/App.jsx for the screens these lines sit
// next to.
//
// Two of these (fit, orientation-intro) only render on the Go Independent
// track, where those steps exist; every other key applies to both tracks.
//
// Voice-gated in full (scripts/check-voice.mjs's FILES_TO_CHECK carries this
// path) since this is prose a person reads, spoken as Coach.
export const ORIENTATION_NARRATION = {
  resume: 'Now let\'s get started — first up is your resume. It does not need to be current or polished — share what you have and I will help you shape it from there. If yours is dated, there is a guided builder right on this screen that walks you through it instead.',

  linkedin: 'Worth adding if you have it — there is a quick how-to right on this screen: open your LinkedIn profile, click More, choose Save to PDF, then upload it here.',

  assessment: 'An assessment shows the part of you that stays constant no matter what job you are in — where you do your best work, what you carry with you. Without it I can only work from your track record; with it I can connect what you have done to why you are good at it, which sharpens everything that comes after. Affintus is free if you do not already have one.',

  values: 'What matters here is what is actually true about you, even the parts that seem off-topic — not what sounds professional. Some of the sharpest connections come from something you would never think to put on a resume.',

  priorities: 'This part is practical, not reflective — what a move would actually need to be worth making for you. Compensation, location, the things you will not budge on. Skip anything that does not apply; none of it is required.',

  reputation: 'This is where other people\'s words about you do the work — patterns in how you are described are often easier to see from the outside than from where you are standing. A specific quote beats a general compliment every time, so if you have an old review or a message someone sent you, bring it — that is exactly the kind of detail that makes this work.',

  'life-events': 'This one is about what shaped you, not what you accomplished — the things that do not show up on a resume but explain a lot about who you are, and it stays private to your account.',

  skills: 'I already pulled a first pass of your skills from your resume and LinkedIn — take a look and fix anything that is off. This list decides which roles actually fit and which keywords land later.',

  // Go Independent track only, below this line.
  fit: 'Before I run my own read on who needs what you do, let\'s start with yours. Your instinct here is real signal — we will test it together against your background and the market, not override it.',

  'orientation-intro': 'Here is the shape of what is coming and what it turns into: your background, an assessment if you have one, and your own words about what you value and who needs what you do. That builds your Personal Brand, then your practice plan — the companies worth pitching, your pricing, and what to say to them. About half an hour, and it saves as you go.',
}
