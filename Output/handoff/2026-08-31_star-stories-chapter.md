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
    does: 'holds the handful of STAR stories they tell in interviews, which the book puts at roughly twelve covering the range of what gets asked. The first set is built from what Orientation already holds, and the parts come from different places: the resume carries Situation and Result, the reputation answers and career pattern carry the Thought Process, and the assessment carries the story about what they are still working on. Nothing is invented -- where an input does not support a story they get the question instead of a guess, and every part is editable because their words win. It tracks the six kinds a good set covers and, for one they do not have yet, shows the shape of a strong answer rather than an empty box. Remember the T here is Thought Process, never Task: that is the change this method makes to STAR and the reason its answers land. This is the set Interview Prep remixes from when it prepares them for named people' },
-->

# Your STAR Stories

**Your STAR Stories** is where the handful of stories you tell in interviews lives. It is a permanent sidebar entry, and it is the source the rest of the product draws on when it prepares you for a specific conversation.

## Why a set rather than a pile

*Making Your Own Weather* puts it plainly: you do not need one hundred stories for one hundred questions. What you need is a playlist of roughly twelve well-built stories that cover the range of what gets asked. The set is finite and manageable, and the skill that makes it feel infinite is the remix — the same true story told with a different part pushed to the front depending on who is listening. The facts never move: same situation, same actions, same result. What moves is the emphasis, the way a DJ plays one song for different crowds by changing the beat rather than swapping the track.

The book's example is a salesperson who finished the year at 140% of quota. To a CFO, lead with the financial discipline, because a CFO's first instinct on hearing a sales number is to ask whether it made money: the 140% is the headline, the profitability is the story. To a CEO, lead with what it moved — a market opened, a competitor pushed back. To a CHRO, lead with how the team came along with you, and let the number do its work quietly in the background. One story, three fronts.

The book calls the five dimensions SCOPE: **Strategy**, the business outcome and the framework behind it; **Culture**, how you collaborate and lead; **Oneself**, how you talk about a failure and what you did about it; **Passion**, why you want this one; and **Expertise**, the proof you can do the work. Almost any interview question is probing one of them.

That is why this exists as its own screen. The same integration story gets told at this company and the next one, so it belongs to you rather than to any single opportunity.

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

The screen tracks these, and shows which you have and which you do not:

- A significant achievement
- A setback and what you learned
- Leading without formal authority
- A difficult collaboration
- A moment of strategic impact
- Navigating ambiguity or conflict

A type you have not covered yet is never shown as an empty box. It comes with the shape of a strong answer for that question, so you know what you are looking for in your own memory before you sit down to write anything. Two of them — leading without formal authority, and a difficult collaboration — are usually the last to fill, because nobody writes them on a resume. They are worth having ready anyway; they get asked.

## Adding your own

**Add one of your own** takes a name and the kind of story it is. Fill in the parts when you have a minute. Naming it is most of the value: a story on the list is one you will come back to, and one you have only thought about is one you will fumble under pressure.

If a story you add is really the same experience as one already there, Reimagine keeps the one you have rather than listing it twice.

## How this connects to interview prep

When you build Interview Prep for an opportunity where you have named the people you will meet, each person gets the stories worth telling *them*, and you can have any story written out in full with a chosen emphasis. That is the remix. Your STAR Stories is the set it remixes from.
