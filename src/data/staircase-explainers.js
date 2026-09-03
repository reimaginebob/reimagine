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
// `bullets` is optional; KEEL and Remixing (SCOPE) carry it. An acrostic read
// as prose stops being an acrostic: run the principles together in a paragraph
// and the K-E-E-L (or S-C-O-P-E) going down the left is gone, which is the
// entire reason the mnemonic exists. A renderer MUST set these as a list with
// the letter leading each row, never fold them back into the `what` text.
//
// `quote` is a line worth hearing from someone other than us, with its
// attribution. It gets the pull-quote treatment rather than being folded into
// `what`, because a borrowed sentence set as body prose reads as ours.
//
// `outro` is the prose that belongs AFTER a bullet list -- the line that says
// what to do with the five lenses, which reads as a caption under them and as a
// non-sequitur if it is left stranded at the end of `what` above the list.
//
// The four come from KEEL_PRINCIPLES rather than being retyped, so this
// explainer and the KEEL band on the screen itself cannot name them
// differently. KEEL_DETAIL pairs to it BY INDEX; the length assertion below is
// there because a fifth principle or a reordering would otherwise silently
// attach the wrong sentence to the wrong letter.
const KEEL_DETAIL = [
  'It only takes one yes. That is the one you are looking for.',
  'Knowing the swings are coming takes most of the sting out of them.',
  'It changes what you get back.',
  'Even anger you have every right to is costing you more than it costs anyone else.',
]
if (KEEL_DETAIL.length !== KEEL_PRINCIPLES.length) {
  throw new Error('KEEL_DETAIL must stay index-aligned with KEEL_PRINCIPLES')
}

// SCOPE's five dimensions. These MIRROR `SCOPE_LENSES` in src/App.jsx, which is
// the authority -- Interview Prep tags each interviewer with one of those exact
// words, so a name that disagrees here teaches a vocabulary the screen does not
// use. They are retyped rather than imported because the authority lives inside
// App.jsx and a data module importing the whole app is worse than a copy with a
// gate on it. The gate is scripts/check-scope-lenses.mjs (prebuild), which
// fails the build if the two lists stop matching.
//
// Written down because I got these wrong once: the first version of this file
// shipped Ownership / Problem-solving / Execution for O / P / E, which is not
// Bob's framework and is not what Interview Prep marks people with. Lesson 10
// is the source.
const SCOPE_DIMENSIONS = [
  { lead: 'Strategy',  rest: 'The business result, and the thinking you brought to the problem.' },
  { lead: 'Culture',   rest: 'How you work with people, and how you lead them.' },
  { lead: 'Oneself',   rest: 'What you know about your own weak spots, and what you have done about them.' },
  { lead: 'Passion',   rest: 'Why this work. Real enthusiasm can carry a gap in hard skills; performed enthusiasm is obvious.' },
  { lead: 'Expertise', rest: 'Depth in the craft. Necessary, and the one everybody leads with anyway.' },
]

export const STAIRCASE_EXPLAINERS = {
  KEEL: {
    title: 'KEEL',
    what: 'A keel is the heavy fin under a sailboat. It runs the whole length of the hull, and it is what keeps the boat upright when the wind picks up. Your attitude does the same job in a search, and you carry it the whole way rather than sorting it out at the start.\n\nFour things to fall back on when a week goes badly. The letters spell the word:',
    bullets: KEEL_PRINCIPLES.map((k, i) => ({ letter: k.letter, lead: k.gloss, rest: KEEL_DETAIL[i] })),
    gives: [
      { label: 'Career Club Corner', to: 'resources', needs: null, does: 'A free weekly call with people in the same search — Mondays at 12:00 ET, every session recorded, so a missed week costs nothing. Register at corner.career.club; it is also the first thing on Job Search Resources.' },
      { label: 'My Coach', to: 'myCoach', needs: null, does: 'It knows your search — the opportunities you are running, what you have built, where each one stands — so a question like where should I put my energy this week gets an answer about your week rather than about job searching in general. There on the bad days as much as the planning ones.' },
    ],
  },
  Resilience: {
    title: 'Resilience',
    what: 'The usual picture of resilience is a foam ball: squeeze it, let go, and it springs back to the shape it was. That is recovery. It ended up exactly where it started.\n\nResilience works more like weight training. Lifting tears the muscle a little, and over the next few days it rebuilds slightly stronger than it was. What would have flattened you six weeks ago is manageable now. The hard part is the thing that makes you stronger.\n\nThat is what is happening to you right now, on the days it feels like nothing is happening at all. A search stretches you. You get better at hearing no, clearer about what you want, and blunter about what you are no longer willing to put up with. Along the way you learn things about yourself you would have had no reason to learn otherwise.\n\nNone of that gets handed back when the search ends. You keep it.',
    // ATTRIBUTION. Bob asked for this as a Frankl quote from Man's Search for
    // Meaning, and Frankl does write it there -- quoting Nietzsche, whose line
    // it is (Twilight of the Idols, in Frankl's rendering). Crediting Frankl
    // alone is wrong in a way a reader who knows the book would catch, and this
    // product's voice rests on telling the truth, so both are named. It still
    // lands where Bob wanted it: Frankl is why anyone reading this knows it.
    quote: {
      text: 'He who has a why to live can bear almost any how.',
      attribution: 'Nietzsche, as Viktor Frankl quotes him in Man’s Search for Meaning',
    },
    gives: [
      { label: 'Job Search Resources', to: 'resources', needs: null, does: 'Free help and people near you, most of it weekly: library job-seeker programs, all-volunteer search groups, the American Job Center system, faith-based career ministries, college career services. It names the organizations and links their own pages rather than promising a date that has gone stale.' },
      { label: 'An accountability partner', to: null, needs: null, does: 'One person who knows what you said you would do this week. Telling someone what you plan to do this week is what turns it into something you actually do.' },
      { label: 'My Pipeline', to: 'pipeline', needs: null, does: 'Something to point at in a week that felt like nothing happened. Every opportunity with where it stands, when you next talk and what moved — which is the proof that it is working, on the weeks it does not feel like anything is.' },
    ],
  },
  '4 C’s': {
    title: 'The 4 C’s',
    what: 'The Career Club framework for getting your message right, and the order matters: Convictions, Clarity, Confidence, Contagious. Convictions lead to Clarity, Clarity leads to Confidence, and Confidence is Contagious.\n\nConvictions are what you believe — what would still be true about you if you stripped away the title, the company and the job description. Five things make them up: your values, what you are curious about when nobody is paying you to be, your track record, what other people say about you, and how you are wired. That is the DNA of a personal brand. Unlike a logo, you cannot design it from the outside. You have to find it.\n\nThat is what the questions at the start were for. They ask about things people rarely say out loud — what you would be willing to be fired over, what you would read about for the fun of it, what colleagues come to you for when something matters. You come out able to say what you believe in your own words, and Reimagine heard the same answers. Everything it builds for you from here rests on them.\n\nThe rest follows. You can tell which openings fit. You are pointing at evidence instead of talking yourself up. And the person across the table starts to believe it too.',
    gives: [
      { label: 'Personal Brand', to: 'p3', needs: null, does: 'Convictions, done for you and with you. It finds the through-line running under a varied background, names where that capability transfers, and puts it in words you can say out loud — built from what you answered at the start, so every claim in it is your own evidence rather than a template.' },
      { label: 'Career Paths', to: 'laneSelect', needs: null, does: 'Clarity with something attached to it. Directions worth exploring for someone with your background, including ones off the obvious path, so what am I looking for stops being a blank question and becomes a set of options you can accept or rule out.' },
      { label: 'My Coach', to: 'myCoach', needs: null, does: 'Where you find out whether the words sound like you. Say a line back to it, tell it what is off, and it works the wording with you — the point being that you can say it in a conversation without reading it.' },
    ],
  },
  'Tell Me About Yourself': {
    title: 'Tell Me About Yourself',
    what: 'The first question in most interviews, and the one people answer by reciting their resume backwards. What works is a short story in three beats, about sixty seconds out loud.\n\nStart with something real about you as a person, before any of the career. Here is one that works: playing the cello from a young age taught discipline, precision, and how to listen to everyone around you, because if you stop listening the whole performance falls apart no matter how well you play your own part.\n\nThen how that shows up in your work, with one real accomplishment behind it. Those same three things went on to define a career in finance, where the numbers have to be right and so does getting people in different departments to agree on what they mean.\n\nThen what you are looking for now, specific enough that they can picture you in it. Here, a role that uses both halves: the precision and the work of bringing people along.\n\nThe two halves have to connect, so your career reads as deliberate rather than accidental. And the personal opening is what makes you the one they remember at the end of a long day of interviews.',
    gives: [
      { label: 'Your STAR Stories', to: 'stories', needs: null, does: 'Tell me about yourself is one of the thirteen questions on this screen, and it is one of the few handed to My Coach rather than drafted for you — because this one is spoken, and it gets better by being said out loud and worked on.' },
      { label: 'Personal Brand', to: 'p3', needs: null, does: 'The through-line the middle beat is built from: the thing running under a varied career, which is what lets the personal opening and the work connect at all.' },
      { label: 'Your Bridge Story', to: null, needs: 'direction', does: 'Writes the whole answer from your own history for the direction you are working — the personal opening, the career arc and the close, so you are editing something rather than starting at a blank page.' },
    ],
  },
  Networking: {
    title: 'Networking',
    what: 'One question changes these conversations completely: how can I be of help to you, personally or professionally?\n\nTreat that as how you walk in rather than as a line to deliver — curious about the other person, with your hand up to help rather than out. And the personally earns its keep. Someone already running a company may have nothing you can do for them at work, and still have something going on at home you can help with.\n\nThe hard part is finding the people, and Reimagine does that part for you. It reads your own LinkedIn connections to show who you already know inside a company. It opens your school\'s alumni list at that company for when you know nobody there. And it finds the professional groups for where you are heading, alongside the free programs running near you now. All three reach past the handful of people you already speak to every week, which is where a search tends to get stuck.',
    gives: [
      { label: 'Who You Know Here', to: null, needs: 'opportunity', does: 'Reads your own LinkedIn connections against a company you are pursuing, names who you already know there, and drafts the note — with a different draft depending on what you actually want from them. Name your school and it opens LinkedIn\'s alumni page for that company too, which is the way in when you know nobody: it names the people you and they both know. Your connections file is read on your own device and never uploaded.' },
      { label: 'Networking Groups', to: null, needs: 'direction', does: 'Finds the professional communities for the direction you are moving into — a local chapter, a national body, a practitioner-run network, a members-only Slack. It searches near your city and again with no geography at all, because the right one is often national with no local chapter to find. Every row says what it costs.' },
      { label: 'Job Search Resources', to: 'resources', needs: null, does: 'Free help near you with no direction picked and nothing built yet: library job-seeker programs, all-volunteer search groups, the American Job Center system, faith-based career ministries, and college career services open to people who did not go there. Career Club Corner is first on the list.' },
    ],
  },
  'Direct Contact': {
    title: 'Direct Contact',
    what: 'Answering a posting puts you in a queue somebody else opened, on their timing. Direct outreach is you starting the conversation instead — and it is the part almost everyone skips.\n\nThe worry is obvious: why write to a company with no job posted? Three answers, all commoner than they sound. Someone is already in the seat who is fine and no better, and they keep it until you turn up. Or the hiring manager knows they need someone like you and has not taken it to HR yet. Or the search has been open three months and nobody has been right.\n\nThe email is the interview. A researched, specific note shows initiative instead of claiming it on a resume. What makes one work is timing — funding just closed, an acquisition went through, a new market opened. Change creates need.\n\nAnd you only need one. One company saying yes.',
    gives: [
      { label: 'Go-to-Market', to: null, needs: 'direction', does: 'Researches target companies live for your direction, flags any that have a role open right now that fits, and drafts the outreach. This is the part that costs an evening per company done by hand, which is why most lists never get built.' },
      { label: 'Who You Know Here', to: null, needs: 'opportunity', does: 'Checks whether you already know somebody inside before you write to a stranger. Your own LinkedIn connections matched against the company, the alumni route when the answer is nobody, and the note drafted either way.' },
      { label: 'Recruiters for This Path', to: null, needs: 'direction', does: 'Boutique firms and named practice leaders who work your function, industry and level, with a note to reach out — for a direction, and for any single opportunity you are running.' },
      { label: 'My Pipeline', to: 'pipeline', needs: null, does: 'Outreach works on the follow-up, and the follow-up is what gets dropped. Every opportunity carries its next step and the date, and the date going past is flagged, so the second note actually gets sent.' },
    ],
  },
  'STAR Stories': {
    title: 'STAR Stories',
    what: 'Situation, Thought Process, Action, Result. The version you have seen elsewhere calls the T Tasks. We changed it, and that one change is why these answers land.\n\nTasks tell an interviewer what you did. Thought process tells them how you think, and how you think is what they are deciding on. The company is hiring your brain.\n\n“I ran one-on-ones with everyone on the team” is a task. “Before I designed anything I wanted the problem from both sides, so I started with one-on-ones to separate what people were saying from what they were living with” is a thought process. It shows you have a way of working that will travel, and showing beats claiming.\n\nYour resume gets you the interview. The stories you tell get you the job.',
    gives: [
      { label: 'Your STAR Stories', to: 'stories', needs: null, does: 'Builds your first set from what you have already given Reimagine — the resume carries the Situation and the Result, your reputation answers carry the Thought Process — then holds thirteen questions to work through, every part editable because your words win. Nothing is invented: where your own inputs do not support a story you get the question instead of a guess.' },
      { label: 'Interview Prep', to: null, needs: 'direction', does: 'The questions likely to come up for your direction, worked through with your own stories rather than a generic list. Under each one, a box where you say your answer out loud and get written feedback on that answer — the rehearsal, not just the script.' },
    ],
  },
  'Remixing (SCOPE)': {
    title: 'Remixing, and SCOPE',
    what: 'A hundred questions do not need a hundred stories. What works is a playlist — about a dozen well-built ones you know cold, and the ability to angle each at whatever was actually asked. Same story, same facts, a different emphasis. That is remixing.\n\nSCOPE names the five lenses a question can be reaching for:',
    bullets: SCOPE_DIMENSIONS.map(d => ({ letter: d.lead[0], lead: d.lead, rest: d.rest })),
    outro: 'The trick is spotting which one a question is reaching for, then pushing that part of the story forward instead of hunting for a different story.',
    gives: [
      { label: 'Interview Prep', to: null, needs: 'direction', does: 'Name who you are meeting and it marks each person with the one dimension they are mainly reading for and why, then adds one thing you would not have thought of yourself. Any story can then be redrafted with a chosen emphasis, so you can hear the same story as a Strategy answer and then as a Culture one. That is the remix made concrete, per person, before the day.' },
      { label: 'Your STAR Stories', to: 'stories', needs: null, does: 'The playlist itself, in one place — one answer per question rather than a pile of competing versions, which is what makes a remix possible at all. Paste in stories you wrote elsewhere and they get filed under the question each one answers.' },
    ],
  },
  'The 5 P’s': {
    title: 'The 5 P’s',
    what: 'People hire people. More than resumes and credentials, a human being is deciding whether they can picture working alongside you every day.\n\nThe common mistake is turning your personality down at the moment it counts for most, because the stakes feel too high to risk being yourself. Playing it safe loses the job in a quieter way: by being forgettable.\n\nFive things to bring on purpose. Proficiency — the skills that got you the interview. Passion — what you care about in this work. Personality — the first thing to go flat when the stakes rise. Perspiration — that you will do the work. Potential — where you are going, not only where you have been.',
    gives: [
      { label: 'Interview Prep', to: null, needs: 'direction', does: 'Prepares you person by person once you name your interviewers, so the human read is part of the preparation rather than something you improvise. It also gives you two or three questions to ask each of them, tested against whether only that person could answer it — the questions you ask are read as evidence of how much thought went in.' },
      { label: 'My Coach', to: 'myCoach', needs: null, does: 'Somewhere to say an answer out loud and hear how it lands, the day before rather than in the chair. It knows your search, so what comes back is about your answer rather than about interviewing.' },
    ],
  },
  BATNA: {
    title: 'BATNA',
    what: 'Your Best Alternative to a Negotiated Agreement — what you have got if this one falls through. The term comes from Getting to Yes, and the stronger your alternative, the more leverage you have.\n\nWhen one opportunity heats up, the pull is to pour everything into it and let the rest go quiet. That is the moment your leverage disappears. With other conversations still live you can tell a company this is your first choice among several and mean it, and timelines tend to tighten when they hear that. You also carry yourself differently, because something else is moving either way.',
    gives: [
      { label: 'Offer & Negotiation', to: null, needs: 'opportunity', does: 'Takes the offer apart — typed, or uploaded as a letter it reads into its parts — places it against a sourced range, builds your ask as an evidence case from your own accomplishments, checks it against the priorities you set at the start, and prints the talking points for the call.' },
      { label: 'Compensation Read', to: null, needs: 'opportunity', does: 'What this work pays in your market, triangulated across public salary sites with every figure carrying its source so you can check it yourself. For a live opportunity it anchors to that company\'s size and industry.' },
      { label: 'Compare offers', to: 'pipeline', needs: 'opportunity', does: 'Two or more side by side, each benefits package priced on its own line rather than blended into one number.' },
      { label: 'My Pipeline', to: 'pipeline', needs: null, does: 'Leverage is other conversations still moving, and this is where they stay visible: what is live, when you next talk, what has gone overdue. The screen that keeps a BATNA from quietly going to nothing while you focus on the one that heated up.' },
    ],
  },
}

// What has to exist before a feature is a live door rather than a postcard.
export const NEEDS_LABEL = {
  direction: 'opens once you pick a direction to work',
  opportunity: 'opens on an opportunity you are pursuing',
}
