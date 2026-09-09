# Coach voice review: rewrites for Bob's sign-off

**Date:** 2026-09-09
**Type:** Voice review of Code's extraction (`20260909_coachvoiceextraction.md`), before/after pairs
**Status:** DRAFT FOR BOB. Nothing here goes to Code until Bob approves each "After" or replaces it with his own words.

---

## The rule every rewrite follows

One principle, not a word list. Bob's call, and the reason is that banned-word lists are whack-a-mole: the model routes around each word with the next one. So every Coach instruction gets the same short block, named `PLAIN_ENGLISH` so Code writes it once and references it everywhere, including `SYSTEM_PROMPT_STABLE`:

> PLAIN ENGLISH. Write the way you would explain this across a table to a friend who has never used Reimagine. Say the plain fact first, then what to do with it. Use the everyday word for a thing, and use the name on the screen for anything in the product. Talk about the job, the fit, and the next step; do not talk about the person's inner state or what a choice "says about" them. No metaphors and no images standing in for a plain word. If a sentence would look at home on a poster, say it the way a person would say it out loud instead.

Screen names the person can see (Put It to Work, Add an Opportunity, Career Paths, Personal Brand, Where You Fit) are fine because they are on the screen. Shorthand that lives in our heads is not.

Two kinds of text are in play. **Static copy** is shown to the person exactly as written, so the After is the final text. **Model instructions** are never shown; the person sees what the model writes in reply. For those, the rewrite does two things: strips the AI-speak out of the instruction itself (the model echoes the register it is given, which is where "gasoline" and "earns the room" come from), and ends with the `PLAIN_ENGLISH` block. Section 10 covers how we check it without a word list.

---

## 1. Arrival: Put It to Work (static, `src/coach-moments.js:38-52`)

**Before**
> Is anything already moving — an application in, a referral, an interview on the calendar? If so, let's work that first. If not, we'll pick a direction and build from your brand.

**After**
> Are you working on any job opportunities right now, like an application you've sent, someone who offered to refer you, or an interview coming up? If so, let's start with that one. If not, we'll look at the kinds of roles that fit you and build from there.

**Quick replies**

| Before | After |
|---|---|
| "Something's moving" | "Yes, I have one" |
| "Starting from scratch" | "Not yet" |

**Follow-ups after the tap**

| Before | After |
|---|---|
| "Good — let's build a playbook around it. Taking you to Add an Opportunity." | "Good. Add it on the next screen and I'll build your plan for that job. Taking you to Add an Opportunity." |
| "Good — let's find your direction. Taking you to Career Paths." | "No problem. Let's look at the kinds of roles that fit you. Taking you to Career Paths." |

Why: "moving," "direction," and "build from your brand" are ours, not the user's. "A referral" assumes they know what we mean; "someone who offered to refer you" does not. The taps answer the question that was asked.

---

## 2. Arrival: Career Paths (static, `src/coach-moments.js:64-73`)

**Before**
> This is where we look at directions beyond the one you already have in hand — three lanes, each reading your background a different way. Pick one and I'll show you real role options that fit it.

**After**
> Career Paths shows you three kinds of roles you could go after, each one built from a different part of your background. Pick the one you want to look at and I'll show you real job titles that fit it. From there we can build a plan for any of them.

Why: "directions," "lanes," and "reading your background" are shorthand. "Role options" is a product noun; "job titles" is what the person is about to see. [Code: if the three choices on that screen carry plain one-line descriptions, Coach should not restate them; if they do not, that is a screen-copy gap to flag separately, not something to fix in this line.]

---

## 3. Choice: after picking a lane (model instruction, `api/coach.js:664-666`)

**Before**
> [They just chose {laneLabel} as a direction to explore on Career Paths. Reflect the choice against their Personal Brand in one line — what picking this lane says about where they're pointed, using something real from their brand rather than restating the lane's own description. Then name in one sentence what building the first role option's Where You Fit will tell them. Two sentences total, no more. Open with this directly, in your own voice. Do not mention that this is an automated check.]

**After**
> [They just picked {laneLabel} on Career Paths. Write two sentences. First: say why this kind of role fits them, naming one specific thing from their Personal Brand (a skill, a result, a piece of experience) in plain words. Second: say what they will learn by building Where You Fit for the first role listed: which parts of their background match that job and which parts they would need to explain. Use the label on the screen for the choice they made. Describe the fit, not the person. {PLAIN_ENGLISH} Do not mention that this is an automated check.]

**What the person should read (the target)**
> This kind of role fits because you have run large accounts and kept them, which is the core of the job. Building Where You Fit for the first role will show you which parts of your background already match and which ones you'd need to explain in an interview.

---

## 4. Choice: after picking a role (model instruction, `api/coach.js:667-669`)

**Before**
> [They just picked "{roleTitle}" ({laneLabel}) as the specific role to build a playbook around. Reflect the choice against their Personal Brand in one line — something real that connects this specific role to who they are, not a restatement of the title. Then name in one sentence what building Where You Fit will tell them about this specific role. Two sentences total, no more. Open with this directly, in your own voice. Do not mention that this is an automated check.]

**After**
> [They just picked "{roleTitle}" as the job to build a playbook for. Write two sentences. First: name one specific thing from their Personal Brand that this job needs, in plain words (a skill, a result, a piece of experience), and say that is why it fits. Second: say what building Where You Fit will show them about this job: what already matches and what they would need to explain. Describe the fit, not the person. {PLAIN_ENGLISH} Do not mention that this is an automated check.]

**Target**
> A Director of Customer Success needs someone who has cut churn with a real number behind it, and you have that from the last two roles. Where You Fit will show you which requirements you already meet and which ones you'd need to talk through.

---

## 5. Delivery: shared template for nine sections (model instruction, `api/coach.js:670-672`)

**Before**
> [They just built {sectionLabel} for this role. Here is what was built:
> {text}
> Give a short, genuine read: one specific strength actually in what they built, and at most one thing that would make it richer, framed as an invitation ("if you'd like...") never a correction. If it is already strong on both counts, say so plainly and specifically and stop there — do not manufacture a suggestion where none is warranted. Keep it to a few sentences, never a list. Open with this directly, in your own voice — this is the first thing they see after it was built. Do not mention that this is an automated check.]

**After**
> [They just built {sectionLabel} for this role. Here is what was built:
> {text}
> Write a few sentences, no list. First: point to one specific thing in what was built that is strong, quote or name it, and say in plain words why it helps them (what it shows a hiring manager, what it proves). Second, only if there is one: say the one thing that would make it better and what they could add, as an offer: "If you want, we could add..." If nothing would make it better, say it is good as it is and stop. No praise without a specific thing behind it. This is the first thing they see after the build. {PLAIN_ENGLISH} Do not mention that this is an automated check.]

**Target**
> The strongest part is the second STAR story, the one where you cut onboarding time from six weeks to two, because it answers the question every interviewer for this job asks first. If you want, we could add one line on what the team did differently after that, so the story shows how you lead and not only what you fixed.

---

## 6. Personal Brand richness check (model instruction, `api/coach.js:627-628`)

This is the prototype the Delivery template copies, and it is the likeliest source of the AI-speak Bob has been hearing. The two questions it asks are right. The way it asks them is what the model has been echoing: "RELEVANCE," "DIFFERENTIATION," "like gasoline," "earns the room," "a qualified stranger," "warm register," "even richer."

**Before**
> [Their Personal Brand just came together. Here is the brand itself, followed by the raw material it was built from — if it says this is a return visit, they already acted on an earlier suggestion and this is a fresh look at what they have now:
> {text}
> Read it against two things, not a checklist of whether every section got touched: RELEVANCE (does this read as someone who can actually do the job — backed by resume specifics, assessment, skills, real evidence behind any "where this transfers" claim) and DIFFERENTIATION (does this read as distinctly them, not a qualified stranger — values, reputation, life story, passions coming through as real material, not trait words with nothing behind them). A brand can be strong on relevance and thin on differentiation (reads competent and interchangeable, like gasoline — gets the job done, could be from anywhere) or the reverse (personal and memorable but never actually earns the room). Judge honestly which axis is thinner here, using only what is actually in the raw material below it, and never invent a gap that is not there.
> If it is genuinely strong on both: say so plainly and specifically — name the actual relevant thing and the actual differentiating thing that make it work together, and stop there. Do not manufacture a suggestion where none is warranted.
> If one axis is thinner: open with a specific, genuine compliment naming what is actually working in the brand already — never generic praise. Then, in the same warm register, offer one thing, two at most, that would make it richer, framed as something the two of you could add together if they want to, never as something missing or wrong with what is there now. Use the shape "if you'd like, one thing that would make this even richer would be..." — their choice, always. Pull the suggestion from whichever axis is thinner, and from something concrete you can see is genuinely underused in the raw material, never a generic "add more to X."
> Values, passions, reputation, skills, priorities, and life story can all be added right here in conversation — if the suggestion touches one of those, invite them to just tell you. If what would help most is on the Resume or LinkedIn side, or in Where You Think You Fit, say so honestly and point to the actual screen — do not imply it can be added by just telling you, when it cannot yet.
> Close by naming both ways they can act on any of this: telling you right here and you will rework the brand directly, or using the "Does this feel right?" box on the screen if they would rather do it there. Say this plainly, not as a menu of options.
> Keep it to a few sentences, never a list. Open with this directly, in your own voice — this is the first thing they see after their brand comes together. Do not mention that this is an automated check.]

**After**
> [Their Personal Brand was just built. Here is the brand, then the material it was built from. If the material says this is a return visit, they already added something after an earlier suggestion and this is a fresh look at what they have now:
> {text}
> Check it against two plain questions and use these exact words if you name them: "Does it show you can do the job?" (is there real evidence from the resume, skills, and assessment behind every claim about what they can do) and "Does it show who you are, not just what you've done?" (do values, reputation, life story, and passions show up as specific things, not adjectives). Decide which of the two questions the brand answers less well, using only what is in the material. Never invent a gap.
> If it answers both well: name the one specific thing that shows they can do the job and the one specific thing that shows who they are, say it works, and stop.
> If one question is answered less well: first name one specific thing in the brand that is already good and say why. Then say the one thing (two at most) they could add to answer that question better, and where it would come from, as an offer: "If you want, we could add..." Never say something is missing or wrong.
> Values, passions, reputation, skills, priorities, and life story can be added right here by telling you. If what would help is on the Resume or LinkedIn screens, or in Where You Think You Fit, say which screen, and do not imply it can be added by telling you.
> End with one sentence saying they can either tell you here and you will update the brand, or use the "Does this feel right?" box on the screen.
> A few sentences, no list. {PLAIN_ENGLISH} Do not mention that this is an automated check.]

**Target**
> The part that shows you can do the job is the three years running a 40-person support team through a system change, because it is the exact situation the roles you're looking at describe. What it says less about is who you are outside the job title: you mentioned coaching youth soccer for a decade and that is not in here yet. If you want, we could add a line about that, since it explains how you lead. Tell me here and I'll update the brand, or use the "Does this feel right?" box on the screen.

---

## 7. Return: session-open recap (`api/coach.js:1271-1282`)

Structure is right (hello, one question about how they are, one fact, one closing question, three sentences). Two lines need changing.

**Facts block fallback, before**
> Nothing changed in their pipeline or activity since their last session — a quiet stretch, not a stalled one.

**After**
> Nothing changed in their pipeline or activity since their last session.

Why: the "not X, not Y" tail is the logic-flip construction, and it is exactly the kind of line the model likes to repeat to the person.

**Closing sentence instruction, before**
> Close with one more sentence handing them the wheel: ask whether there is something specific they would like to work on today, or whether they would rather you suggest something based on what you can see in their search.

**After**
> Close with one sentence asking whether there is something specific they want to work on today, or whether they would like you to suggest something based on what is in their search.

Why: "handing them the wheel" is a metaphor in the instruction and it leaks into the reply.

**Target**
> Hi Dana, how are you doing this week? I saw the interview with Northwind happened on Tuesday. Is there something specific you want to work on today, or would you like me to suggest something based on where your search is?

---

## 8. Fixed strings: the two dismissals (`src/App.jsx:9122`, `:9183`)

| Before | After | Why |
|---|---|---|
| "I'm good for now" | "I'm good for now" | Bob's own words. Keep. |
| "Not on this screen" | "Stay quiet on this screen" | "Not on this screen" reads as a fragment of something. The After says what the tap does. |

If Bob prefers a shorter second tap, "Not here" is shorter but less clear; recommend the longer one.

---

## 9. Stripper replacement text (`src/text-strippers.js:368-407`)

"The conversations that matter" is product shorthand on its own, as Code suspected. When the model reaches for "rooms" it means interviews and hiring conversations, so the replacement should say that.

| Stripper output, before | After |
|---|---|
| "the conversations that matter" | "interviews" |
| "conversation(s) where / in which / that matter / that count" | "interview(s) where / in which" (drop "that matter / that count") |
| "into / in the conversation" | "into / in the interview" |
| "{determiner} conversations" | "{determiner} interviews" |

[Code: confirm the grammar holds in each regex branch after the swap; if a branch cannot drop "that matter" cleanly, replace the whole phrase with "interviews."]

---

## 10. How we check it without a word list

The standing CLAUDE.md rule says an instruction without detection is a draft. Bob's direction is that the detection cannot be a growing list of banned words, because that is the whack-a-mole that has failed before. So the check is on the principle, not on vocabulary:

1. **Real samples, read by Bob.** After the PR ships, Bob triggers each moment on production and reads what Coach says. That is the test. A reply passes when it says the plain fact and what to do with it in words a first-time user would use, whatever words it happened to pick.
2. **A rubric eval, not a regex.** Code adds a small eval (the `scripts/eval-*-live.mjs` pattern already exists) that runs each moment template against a labeled synthetic profile and asks a second model one question: "Would a first-time user understand every sentence of this without knowing anything about Reimagine, and does it tell them what to do next?" Yes/no with the failing sentence quoted. This catches drift after future prompt changes without anyone maintaining a list.
3. **The existing gate stays as it is.** `check-voice` keeps the patterns it already has for the historical failures (logic flips, "rooms," coaching register). No new words are added from this review.

Section 9's stripper change is the one exception, and it is a fix to text we wrote, not a new pattern.

## 11. The sample-output gap

Code cannot pull real transcripts. Recommendation: Bob pulls three real Coach replies per family from the admin Insights view for Dana Whitfield's account (and his own), and pastes them into this file under each section. Real samples are the only fair test of whether the rewritten instructions change what the model says. A synthetic run (Code's option 3) is acceptable as a second check only if every sample is labeled SYNTHETIC in the file; do not grant a read-only DB credential for this, since the admin view already exists and the credential would outlive the task.

The order that works: Bob signs off on the Afters above, Code applies them in one PR behind the existing flag, Bob triggers each moment on production, and the resulting replies are the samples. That gets real output without a synthetic run.

---

## 12. Out of scope here, needs the same pass

Code flagged two bodies of copy outside this extraction. Both should get the same treatment after this PR ships and Bob has heard the rewritten moments: all pre-Phase-2 Coach copy (onboarding framing, per-step narration, employment and intake prompts, capture-offer copy), and the posture rules in `SYSTEM_PROMPT_STABLE` (`api/coach.js:~1505-1530`), which shape every typed reply. The second one is the bigger lever, because a plain-language rule there reaches every Coach turn, not only moments. The `PLAIN_ENGLISH` block goes into `SYSTEM_PROMPT_STABLE` in the same PR, since it is one block and reaches every turn; the pre-Phase-2 copy gets its own review file afterward.

---

## 13. After Bob signs off: the instruction to Code

Apply the approved Afters verbatim in one PR (`coach: plain-English rewrite of Phase 2 moment templates and fixed strings`), behind the existing Phase 2 flag, with the `PLAIN_ENGLISH` block from the top of this file added once and referenced from every moment instruction and from `SYSTEM_PROMPT_STABLE`, the rubric eval from Section 10, and the stripper change from Section 9. No other changes in the PR. Update the design doc's Section 12 decision 4 and the phases summary with the approved Put It to Work wording. Report PR URL and merge SHA. Phase 3 stays paused until Bob has heard the rewritten Phase 2 moments on production.
