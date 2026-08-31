<!--
PARKED. This is the user-guide chapter for Your STAR Stories, written and ready,
held out of src/data/user-guide/ while the surface is an internal-only pilot
(storiesPilot in src/App.jsx).

It cannot simply sit unlisted in the guide folder: scripts/lib/user-guide-order.mjs
hard-fails the build when a chapter file exists but is missing from ORDER.json.
That guard is correct — ORDER.json feeds both the guide AND the single cached
system block api/coach.js sends to every user, so publishing this would describe
a surface only internal accounts can open.

TO OPEN THE GATE, four things in one PR:
  1. Delete storiesPilot in src/App.jsx and its three uses (the const, the
     Sidebar prop, and the early return in the 'stories' case).
  2. Move this file to src/data/user-guide/star-stories.md, strip this comment,
     and add "star-stories.md" to ORDER.json after add-an-opportunity.md.
  3. Move the slug tripwire in scripts/test-coach-routing.mjs from 22 to 23.
  4. Restore this entry to FEATURE_MAP in src/coach-routing.js, immediately
     above the bridge-story entry:

  { slug: 'your-stories',        reach: 'standalone',  labelId: 'stories',
    does: 'holds the handful of STAR stories they tell in interviews, which the book puts at roughly twelve covering the range of what gets asked. The first set is built from what Orientation already holds, and the parts come from different places: the resume carries Situation and Result, the reputation answers and career pattern carry the Thought Process, and the assessment carries the story about what they are still working on. Nothing is invented -- where an input does not support a story they get the question instead of a guess, and every part is editable because their words win. It tracks the six questions a good set answers and, for one they do not have yet, shows the shape of a strong answer rather than an empty box. Five of those want a story; the weakness question does not, and has a section of its own on the screen built on the book's Real / Addressed / Ongoing model, grounded in whatever their assessment actually says and handed to the Coach to work through rather than written for them. Remember the T here is Thought Process, never Task: that is the change this method makes to STAR and the reason its answers land. This is the set Interview Prep remixes from when it prepares them for named people. The screen also names eight more questions -- the ones that want something other than a story -- and points at where Reimagine answers each: Bridge Story, About This Company, Interview Prep, and for "what is not on your resume" a conversation with the Coach itself. Fourteen questions in all. Every story carries a "Does this feel right?" box that reworks that one story from the person's note; a story Reimagine built has no Remove, because correcting it beats deleting it' },
-->

# Your STAR Stories

**Your STAR Stories** is where the handful of stories you tell in interviews lives. It is a permanent sidebar entry, and it is the source the rest of the product draws on when it prepares you for a specific conversation.

## Why a set rather than a pile

*Making Your Own Weather* puts it plainly: you do not need one hundred stories for one hundred questions. What you need is a playlist of roughly twelve well-built stories that cover the range of what gets asked. The set is finite and manageable.

That is why this exists as its own screen. The same story gets told at this company and the next one, so it belongs to you rather than to any single opportunity. What you do with the set once you have it — telling the same story with a different part pushed forward depending on who is listening — is covered in Interview Prep, where there is a specific person to aim at.

## What a STAR story is here

Your resume got you the interview. The stories you tell get you the job, because what a company is hiring is your brain rather than your history. They want to know how you approach a problem, what you notice that others miss, and what you do first.

Every story has four parts: Situation, Thought Process, Action, Result. The usual version of this format calls the T "Task". Here it is your **Thought Process**, and that swap is the whole game.

The difference, from the book:

> **Task.** "I decided to run one-on-ones with each team member." That says what you did.
>
> **Thought process.** "I knew I had to understand the problem from both sides before designing anything, so I started with structured one-on-ones to separate what people were saying from what they were experiencing." That shows how you think.

Same events, same action. The second one demonstrates a way of working: gather information before drawing conclusions, decide from what you learn. Rather than claim you are a strategic thinker, you show them, and showing beats claiming every time. You do not need to name the framework you used — the interviewer will feel the difference between someone thinking out loud and someone who owns a repeatable way of solving problems.

## Where the first set comes from

You do not start from a blank screen, and you do not have to ask. The first time you open this screen Reimagine builds the set from what you have already given it during Orientation, and different parts come from different places:

- Your **resume** carries the Situation and the Result: the roles, the scope, the numbers.
- Your **reputation answers** and the pattern across your career carry the Thought Process. That is almost never written on a resume, which is why a story built only from a resume reads flat.
- Your **assessment** carries the setback story, the one an interviewer asks as the failure or weakness question. The strength that serves you at your best and the one that costs you when it runs unchecked are usually the same trait, and being able to name both is what self-awareness sounds like out loud.

Nothing is invented. Where your inputs do not support a story, you get the question rather than a guess — because a made-up account of your own past is the one thing you cannot afford to carry into an interview.

Each part shows what your inputs support and, underneath, the specific thing only you can supply: a name, a number, the moment it turned. Every box is editable. If Reimagine has read something wrong, change it — this is your library and your words win.

## The six a good set covers

The screen tracks these as the questions they answer, and shows which you have and which you do not. They are a head start drawn from Johnny Taylor, CEO of SHRM, the largest HR organization in the world, and from what else gets asked once someone starts probing how you work:

- A significant achievement
- The weakness question
- Leading without formal authority
- A difficult collaboration
- A moment of strategic impact
- Navigating ambiguity or conflict

Five of those want a story. The weakness question is answered differently, and has its own section below.

A question you have not covered yet is never shown as an empty box. It comes with the shape of a strong answer, so you know what you are looking for in your own memory before you sit down to write anything. Two of them — leading without formal authority, and a difficult collaboration — are usually the last to fill, because nobody writes them on a resume. They are worth having ready anyway; they get asked.

## The weakness question

This one is not a STAR story, and building it as one is how it goes wrong. *Making Your Own Weather* gives it a model of its own: **name something real, describe what you have done about it, and close on a note that shows you are still mindful of it. Real. Addressed. Ongoing.** Those three parts carry humility, self-awareness and a growth orientation at once.

Your assessments are where the honest version starts. As the book puts it, go back to your assessment results and use what they say about the edges of your strengths as the foundation rather than starting from scratch. The screen shows you what your own results actually say, and names which assessment said it, because naming it out loud is part of what makes the answer land as evidence.

What it does not do is write the example for you. Reimagine will not invent the year, the company or the moment it happened, so the screen hands the question to My Coach with the structure already loaded, and the two of you build the answer from what really happened.

## The other questions you will be asked

Eight more questions do not want a story out of your library. They want something else, and Reimagine has that, so the screen names where. Between the six above and these eight, fourteen questions are accounted for before you walk in.

- **"Tell me about yourself."** Your Bridge Story, built for you on any opportunity or direction.
- **"What isn't on your resume?"** Work on this one with My Coach. It is the question that wants the human answer rather than the professional one -- values, what you care about, what shaped you -- and the Coach already knows all of it. It drafts an answer in your voice, says which parts it was least sure about, and works it with you from there.
- **"What do you know about our company?"** About This Company, on the opportunity. The effort is itself the signal.
- **"Why are you leaving your current role?"** Your best and fewest reasons. A layoff stated plainly reads as fact and needs no apology.
- **"What did you like most and least about your last role?"** Values alignment. Name something you valued that this company also values.
- **"Are you underqualified or overqualified?"** Redirect to the specific value you bring, and keep it short.
- **"Has your view of the job changed since we started talking?"** Asked late, and it tests whether you were listening rather than running a script.
- **"Do you have any questions for me?"** Interview Prep gives you questions aimed at what each person you are meeting uniquely knows.

## Does this feel right?

Every story carries the same **Does this feel right?** box you see under everything Reimagine builds. If a Result is wrong, if the Thought Process is not how you actually approached it, say so and the story is reworked from your note. Only that story changes, and anything you have written by hand stays put unless your note asks otherwise. Your correction also carries forward, so a fact you fix once does not come back wrong somewhere else.

A story Reimagine built for you has no Remove button, and that is deliberate: every one of them answers a question you will be asked, so a rough answer corrected beats a good question with nothing behind it. Stories you add yourself can be removed, because those are yours to keep or drop.

**Edit the words myself** switches the four parts into text boxes when you would rather write it yourself. Your words win over ours every time.

## Adding your own

**Add one of your own** takes a name and the kind of story it is. Fill in the parts when you have a minute. Naming it is most of the value: a story on the list is one you will come back to, and one you have only thought about is one you will fumble under pressure.

If a story you add is really the same experience as one already there, Reimagine keeps the one you have rather than listing it twice.

## How this connects to interview prep

When you build Interview Prep for an opportunity where you have named the people you will meet, each person gets the stories worth telling *them*, and you can have any story written out in full with a chosen emphasis. That is the remix. Your STAR Stories is the set it remixes from.
