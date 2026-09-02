import { KEEL_PRINCIPLES } from '../step-position.js'

// What each thing on the staircase actually means, and what Reimagine gives you
// for it.
//
// WHY THIS EXISTS. The staircase shows ten terms -- KEEL, Resilience, 4 C's,
// Tell Me About Yourself, Networking, Direct Contact, STAR Stories, Remixing
// (SCOPE), The 5 P's, BATNA -- and almost nobody who lands there has read Making Your Own
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
//
// `bullets` is optional and only KEEL carries it today. An acrostic read as
// prose stops being an acrostic: run the four principles together in a
// paragraph and the K-E-E-L going down the left is gone, which is the entire
// reason the mnemonic exists. A renderer MUST set these as a list with the
// letter leading each row, never fold them back into the `what` text.
//
// The four come from KEEL_PRINCIPLES rather than being retyped, so this
// explainer and the KEEL band on the screen itself cannot name them
// differently. KEEL_DETAIL pairs to it BY INDEX; the length assertion below is
// there because a fifth principle or a reordering would otherwise silently
// attach the wrong sentence to the wrong letter.
const KEEL_DETAIL = [
  'One yes ends the search. You are looking for that one.',
  'Expecting the swings takes most of their power away.',
  'It changes what you get back.',
  'Even bitterness you are entitled to is working against you.',
]
if (KEEL_DETAIL.length !== KEEL_PRINCIPLES.length) {
  throw new Error('KEEL_DETAIL must stay index-aligned with KEEL_PRINCIPLES')
}

export const STAIRCASE_EXPLAINERS = {
  KEEL: {
    title: 'KEEL',
    what: 'A keel is the weighted fin under a sailboat. It runs the length of the hull and it is what keeps the boat steady when the wind gets up. Your attitude does the same job here, and it is carried the whole way rather than sorted out at the start.\n\nFour things to come back to on a hard day, and the letters spell the word:',
    bullets: KEEL_PRINCIPLES.map((k, i) => ({ letter: k.letter, lead: k.gloss, rest: KEEL_DETAIL[i] })),
    gives: [
      { label: 'Career Club Corner', to: 'resources', needs: null, does: 'Bob\'s free call, Mondays at noon Eastern. Every session recorded, so a missed week costs nothing.' },
      { label: 'My Coach', to: 'myCoach', needs: null, does: 'There on the bad days as well as the planning ones, and it knows your search.' },
    ],
  },
  Resilience: {
    title: 'Resilience',
    what: 'The usual picture of resilience is a foam ball: squeezed in a fist, and when the hand opens it springs back to the shape it was. Bob calls that recovery. It got back to where it started.\n\nResilience is closer to weight training. Resistance causes small tears in the muscle fiber, and over the days that follow it rebuilds a little stronger than before. What would have maxed you out six weeks ago is manageable today. The load is what produces the strength.\n\nThere is a purpose in the struggle, and it is the part worth holding onto on the days it does not feel true. A search puts you under real load, and it is forming you while it does: building capacity, deepening your empathy, sharpening what you actually want, showing you what you are made of. Nothing about the hard part is wasted while you are learning in it.\n\nYou are aiming past where you started. The person who comes out the far side of this is stronger than the one who went in, and what you build carrying the load stays yours long after the search is over.\n\nOne thing helps on a hard day more than anything else: name the feeling. Confusion, fear, bitterness about how it ended. Naming it is where it starts to lose its grip.',
    gives: [
      { label: 'Job Search Resources', to: 'resources', needs: null, does: 'Free help and people near you, including groups that meet weekly.' },
      { label: 'An accountability partner', to: null, needs: null, does: 'One person who knows what you said you would do this week. There is a world of difference between a good intention and a good behavior.' },
    ],
  },
  '4 C’s': {
    title: 'The 4 C’s',
    what: 'Bob\'s framework for getting your message right, and the order is the point: Convictions, Clarity, Confidence, Contagious. Convictions lead to Clarity, Clarity leads to Confidence, and Confidence is Contagious.\n\nConvictions are what you actually believe — what would still be true with the title, the company and the job description stripped away. Five things make them up: your values, what you are curious about without anyone paying you to be, your track record, your reputation as other people describe it, and how you are wired. That is the DNA of a personal brand, and unlike a logo it cannot be designed from outside. It has to be found.\n\nThat is what the questions at the start were doing. They ask for the things people rarely say out loud — what you would be willing to be fired over, what you would read about with nobody paying you to, what colleagues come to you for when something matters. You come out of it able to say what you believe in your own words, and Reimagine has heard the same thing. Everything it builds for you from here stands on that.\n\nClarity follows: you can see which openings fit and decline the ones that do not, without apology. Confidence follows from that, because you are pointing at evidence rather than asserting into the air. And when you believe what you are saying, the person across the table starts to believe it too.',
    gives: [
      { label: 'Personal Brand', to: 'p3', needs: null, does: 'Finds the through-line running under a varied background and puts it in words you can say out loud.' },
    ],
  },
  'Tell Me About Yourself': {
    title: 'Tell Me About Yourself',
    what: 'The first question in most interviews, and the one usually answered by narrating a resume in reverse.\n\nThink about house hunting. You see forty houses, all with roughly the right square footage and the right number of bedrooms. Weeks later someone asks whether you remember the three-bedroom with two and a half baths, and you have no idea which one they mean. Then they say: the one with the huge oak tree out back. Now you know exactly.\n\nThe personal detail is the oak tree. Three beats, about sixty seconds. Something real about you as a person. How that has played out across your career, with one accomplishment behind it. Therefore, what you are looking for now. The arc has to connect, so the career reads as inevitable given who you are.\n\nThe usual stumble is answering the personal part in professional language — worked in three countries, managed large teams. That is resume content delivered out loud. What lands is color.',
    gives: [
      { label: 'Your Bridge Story', to: null, needs: 'direction', does: 'Builds that answer from your own history, for the direction you are working.' },
      { label: 'Personal Brand', to: 'p3', needs: null, does: 'The through-line the story is built on.' },
    ],
  },
  Networking: {
    title: 'Networking',
    what: 'One question changes the whole experience: how can I be of help to you, personally or professionally?\n\nIt is a posture rather than a script — going in curious about the other person, with your hand up rather than out. The personally matters. Someone already running a company may have nothing you can offer professionally and still have something going on outside work you can help with.\n\nThe other surprise is where jobs actually come from. In 1973 the sociologist Mark Granovetter found that people find work through acquaintances far more often than through close friends and family, and LinkedIn has since confirmed it in its own data. Your closest circle reads the same news and knows the same people you do. The former colleague you have not spoken to in seven years is moving in a different orbit.\n\nAnd you are not arriving empty-handed. You know things, and people, that the person across the table does not.',
    gives: [
      { label: 'Who You Know Here', to: null, needs: 'opportunity', does: 'Reads your own LinkedIn connections against a company you are pursuing and drafts the note. Your file never leaves your device.' },
      { label: 'Networking Groups', to: null, needs: 'direction', does: 'The professional communities for the direction you are moving into.' },
      { label: 'Job Search Resources', to: 'resources', needs: null, does: 'Free groups and public programs near you.' },
    ],
  },
  'Direct Contact': {
    title: 'Direct Contact',
    what: 'The lesson the book is named after. Answering a posting puts you in a queue someone else opened, on someone else\'s timing. Direct outreach is going out to create the conversation yourself.\n\nThe fear underneath it is reaching out to a company with no opening. Three situations are more common than that fear assumes. Someone is already in the seat who is fine and not much more, and they keep the job until you show up. Or the hiring manager knows they need someone like you and has not taken it to HR yet. Or the search has been open three months and nobody has been right.\n\nThe outreach is itself the interview: a researched, specific note demonstrates initiative rather than claiming it on a resume. What makes one land is timing — funding closed, an acquisition done, a new market opened. Change creates need.\n\nAnd your quota is one. One company saying yes.',
    gives: [
      { label: 'Go-to-Market', to: null, needs: 'direction', does: 'Builds the target company list for your direction and drafts the outreach.' },
      { label: 'Recruiters for This Path', to: null, needs: 'direction', does: 'The boutique firms and named practice leaders who work your function and level.' },
    ],
  },
  'STAR Stories': {
    title: 'STAR Stories',
    what: 'Situation, Thought Process, Action, Result. The traditional version calls the T Tasks. Bob changes it, and that change is the whole game.\n\nTasks tell an interviewer what you did. Thought process tells them how you think, which is what they are evaluating — the company is hiring your brain. “I ran one-on-ones with everyone on the team” is a task. “Before designing anything I needed the problem from both sides, so I started with structured one-on-ones to separate what people were saying from what they were experiencing” is a thought process. It shows a repeatable way of working, and showing carries further than claiming.\n\nEverything before the interview is preparation. This is game day, and it deserves real time rather than a list of tips. Four things go wrong in practice: rambling that never finds a period, compression that strips the substance out, a story kept too general to picture, and a good story never connected to what this company is trying to solve.',
    gives: [
      { label: 'Your STAR Stories', to: 'stories', needs: null, does: 'Your stories written once and kept, because the same story is told at this company and the next.' },
      { label: 'Interview Prep', to: null, needs: 'direction', does: 'The questions likely to come up, worked through with your own stories rather than a generic list.' },
    ],
  },
  'Remixing (SCOPE)': {
    title: 'Remixing, and SCOPE',
    what: 'A hundred questions do not need a hundred stories. What works is a playlist — about a dozen well-built ones you know cold, and the ability to angle each at whatever was actually asked. Same story, same facts, a different emphasis. That is remixing.\n\nSCOPE names the five lenses a question can be reaching for. Strategy — the business outcome, and the frameworks you brought to the problem. Culture — how you work with people. Oneself — what you know about your own shortcomings and what you have done about them. Passion — why this work, honestly. Expertise — depth in the craft, which is table stakes rather than the whole answer.\n\nThe skill is noticing which lens is in play and shifting the emphasis, rather than reaching for a different story.',
    gives: [
      { label: 'Interview Prep', to: null, needs: 'direction', does: 'Names the one SCOPE dimension each person you are meeting is mainly reading for, and drafts the same story with that emphasis.' },
      { label: 'Your STAR Stories', to: 'stories', needs: null, does: 'The playlist itself, in one place.' },
    ],
  },
  'The 5 P’s': {
    title: 'The 5 P’s',
    what: 'People hire people. Not resumes, not credentials, not accomplishments on their own. A human being is deciding whether they can picture you working alongside their team every day.\n\nThe common mistake is turning your humanity down at the exact moment it counts for most, because the stakes feel too high to risk being yourself. Getting too careful loses the job in a quieter way: by being forgettable.\n\nFive dimensions to bring deliberately. Proficiency — table stakes, the thing that got you the interview. Passion — what you actually care about in this work. Personality — the part most people flatten under pressure. Perspiration — that you will do the work. Potential — where you are going, not only where you have been.',
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
