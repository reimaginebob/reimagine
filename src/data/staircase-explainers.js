// What each thing on the staircase actually means, and what Reimagine gives you
// for it.
//
// WHY THIS EXISTS. The staircase shows nine terms -- KEEL, Resilience, 4 C's,
// Tell Me About Yourself, Networking, Direct Contact, STAR Stories, Remixing,
// BATNA -- and almost nobody who lands on that screen has read Making Your Own
// Weather. Opening in a vocabulary someone does not speak is the same failure as
// calling a feature by its internal ID, and it was sitting in nine places at
// once. Each term is now tappable and explains itself.
//
// TWO JOBS PER EXPLAINER, and the second is the one that earns the space:
//
//   `what`  -- the concept, in Bob's own framing from the book. Short enough to
//              read standing up. A chapter here would be a course nobody
//              finishes, which is the paralysis this screen exists to remove.
//   `gives` -- the Reimagine features that answer it, by name. A great deal of
//              this product's value is invisible until someone knows the problem
//              it solves, and the staircase is where the problems are already
//              named. Every entry below points at something that actually ships;
//              nothing here was invented to make the story tidy.
//
// THE POSTCARD. Some of these features are not open to everyone yet -- Go-to-
// Market needs a chosen direction, Offer & Negotiation needs a live opportunity.
// Those are NOT hidden and they are NOT buttons: a button landing on a "pick a
// direction first" gate is the soft version of a dead link (the locked rule in
// coach-routing.js). They are named with what opens them, which is the point of
// showing them at all -- this is the view from a stair you have not reached, and
// seeing where the climb goes is what makes the climb worth starting.
//
// `to` is a NAV_LABELS / step key when the feature is its own screen, or null
// when it lives inside something else. `needs` is what has to exist first:
// 'direction' (a chosen direction), 'opportunity' (a live one), or null for
// always open.
export const STAIRCASE_EXPLAINERS = {
  KEEL: {
    title: 'KEEL',
    what: 'A keel is the weighted fin under a sailboat. It runs the length of the hull and it is what keeps the boat steady when the wind gets up. Your attitude does the same job here, and it is carried the whole way rather than sorted out at the start.\n\nFour things to come back to on a hard day. Know you will find another job — not hope, know; you need one yes, not a hundred. Emotional ups and downs are natural, and expecting them takes away most of their power. Expect the best from yourself and others. Let the past go, because even justified bitterness is not working for you.',
    gives: [
      { label: 'Career Club Corner', to: 'resources', needs: null, does: 'Bob\'s free call, Mondays at noon Eastern. Every session recorded, so a missed week costs nothing.' },
      { label: 'My Coach', to: 'myCoach', needs: null, does: 'There on the bad days as well as the planning ones, and it knows your search.' },
    ],
  },
  Resilience: {
    title: 'Resilience',
    what: 'Most people picture a foam ball: squeezed, then bouncing back to the shape it was. Bob calls that recovery. It got back to where it started.\n\nResilience is closer to weight training. Resistance causes small tears in the muscle, and over the days after, it rebuilds slightly stronger than before. The load is what produces the strength. A search puts you under real load, and what you build carrying it is yours afterwards.',
    gives: [
      { label: 'Job Search Resources', to: 'resources', needs: null, does: 'Free help and people near you, including groups that meet weekly.' },
      { label: 'An accountability partner', to: null, needs: null, does: 'One person who knows what you said you would do this week. There is a world of difference between a good intention and a good behaviour.' },
    ],
  },
  '4 C’s': {
    title: 'The 4 C’s',
    what: 'Bob\'s framework for getting your message right, and the order matters: Convictions, Clarity, Confidence, Contagious. Convictions lead to Clarity, Clarity leads to Confidence, and Confidence is Contagious.\n\nConvictions are what you actually believe — what would still be true with the title, the company and the job description stripped away. That is the DNA of a personal brand, and unlike a logo it cannot be designed from outside. It has to be found.',
    gives: [
      { label: 'Personal Brand', to: 'p3', needs: null, does: 'Finds the through-line running under a varied background and puts it in words you can say out loud.' },
    ],
  },
  'Tell Me About Yourself': {
    title: 'Tell Me About Yourself',
    what: 'The first question in most interviews and the one most people answer worst — usually by narrating a CV in reverse.\n\nWhat works is a short story with three beats: something human that shows who you are, the theme running through your work with one real accomplishment behind it, and why this next move is the natural continuation. Thirty to forty-five seconds, spoken. Getting this right before you go wide matters, because going on air before the commercial is ready is expensive.',
    gives: [
      { label: 'Your Bridge Story', to: null, needs: 'direction', does: 'Builds that answer from your own history, for the direction you are working.' },
      { label: 'Personal Brand', to: 'p3', needs: null, does: 'The through-line the story is built on.' },
    ],
  },
  Networking: {
    title: 'Networking',
    what: 'Most networking advice makes this an exercise in asking. Bob\'s version turns it around with one question: how can I be of help to you, personally or professionally?\n\nIt is a posture rather than a script — going in curious about the other person, with your hand up rather than out. That shift changes how the conversation feels on both sides, and it is what makes people want to keep talking to you.',
    gives: [
      { label: 'Who You Know Here', to: null, needs: 'opportunity', does: 'Reads your own LinkedIn connections against a company you are pursuing and drafts the note. Your file never leaves your device.' },
      { label: 'Networking Groups', to: null, needs: 'direction', does: 'The professional communities for the direction you are moving into.' },
      { label: 'Job Search Resources', to: 'resources', needs: null, does: 'Free groups and public programmes near you.' },
    ],
  },
  'Direct Contact': {
    title: 'Direct Contact',
    what: 'The lesson the book is named after. Answering a posting means joining a queue that someone else opened; direct outreach is going out to create the opportunity.\n\nThink like a salesperson who knows the product. You have the message, so now you need pipeline — and your quota is one. Not the whole market. One company saying yes.',
    gives: [
      { label: 'Go-to-Market', to: null, needs: 'direction', does: 'Builds the target company list for your direction and drafts the outreach.' },
      { label: 'Recruiters for This Path', to: null, needs: 'direction', does: 'The boutique firms and named practice leaders who work your function and level.' },
    ],
  },
  'STAR Stories': {
    title: 'STAR Stories',
    what: 'Situation, Task, Action, Result — the structure behind a good interview answer. The part people skip is the thinking: the company is hiring your brain, so how you decided matters more than what you did.\n\nEverything before the interview is preparation. This is game day, and it is worth real time rather than a list of tips.',
    gives: [
      { label: 'Your STAR Stories', to: 'stories', needs: null, does: 'Your stories written once and kept, because the same story is told at this company and the next.' },
      { label: 'Interview Prep', to: null, needs: 'direction', does: 'The questions likely to come up, worked through with your own stories rather than a generic list.' },
    ],
  },
  'Remixing (SCOPE)': {
    title: 'Remixing, and SCOPE',
    what: 'You do not need a hundred stories for a hundred questions. You need a playlist — a small, well-developed set you know cold, and the ability to angle each one at whatever was actually asked. Same story, same facts, same result, a different emphasis each time. That is remixing.\n\nSCOPE is the frame for doing it. Five lenses most interview questions are reaching for, and a good story can be turned to any of them: Strategy — the business outcome, and the frameworks you brought to the problem. Culture — how you fit and how you work with people. Ownership — what you actually drove. Problem-solving — how you thought, rather than what you did. Execution — that it shipped and it held.\n\nThe discipline is noticing which lens the interviewer is looking through, and adjusting the emphasis rather than reaching for a different story.',
    gives: [
      { label: 'Interview Prep', to: null, needs: 'direction', does: 'Reads each person you are meeting and points at which of your stories to lead with for them.' },
      { label: 'Your STAR Stories', to: 'stories', needs: null, does: 'The playlist itself, in one place.' },
    ],
  },
  'The 5 P’s': {
    title: 'The 5 P’s',
    what: 'People hire people. Not resumes, not credentials, not accomplishments on their own. A human being is deciding whether they can picture you working alongside their team every day.\n\nThe mistake most candidates make is turning their humanity down at the exact moment they need it most, because the stakes feel too high to risk being themselves. Getting too careful loses the job in a quieter way: by being forgettable.\n\nFive dimensions to bring deliberately. Proficiency — table stakes, the thing that got you the interview. Passion — what you actually care about in this work. Personality — the part most people flatten under pressure. Perspiration — that you will do the work. Potential — where you are going, not only where you have been.',
    gives: [
      { label: 'Interview Prep', to: null, needs: 'direction', does: 'Prepares you person by person, so the human read is part of the preparation rather than something you improvise.' },
      { label: 'My Coach', to: 'myCoach', needs: null, does: 'Somewhere to say an answer out loud and hear how it lands before the day.' },
    ],
  },
  BATNA: {
    title: 'BATNA',
    what: 'Your Best Alternative to a Negotiated Agreement — what you have if this one does not come together. It comes from Getting to Yes, and the strength of it is your leverage.\n\nWhen one opportunity heats up, the pull is to put everything into it and let the rest go quiet. That is the moment leverage disappears. With other conversations still moving you can say honestly that this is your preferred path among several, and timelines tend to compress when a company hears it. You also carry yourself differently, because something else is in motion either way.',
    gives: [
      { label: 'Offer & Negotiation', to: null, needs: 'opportunity', does: 'Takes the offer apart, places it against a sourced range, and builds your ask from your own accomplishments.' },
      { label: 'Compensation Read', to: null, needs: 'opportunity', does: 'What this work pays in your market, every figure carrying its source.' },
      { label: 'Compare offers', to: 'pipeline', needs: 'opportunity', does: 'Two or more side by side, each benefits package priced on its own line rather than blended into one number.' },
      { label: 'My Pipeline', to: 'pipeline', needs: null, does: 'The practical half — keeping the other conversations alive is what gives the rest something to work with.' },
    ],
  },
}

// What has to exist before a feature is a live door rather than a postcard.
export const NEEDS_LABEL = {
  direction: 'opens once you pick a direction to work',
  opportunity: 'opens on an opportunity you are pursuing',
}
