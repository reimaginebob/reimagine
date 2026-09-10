Prompt for Code
GO on Part 1 (Bob, 2026-09-10 evening). Ship Part 1 in this order, one PR per group, gated and ungated never mixed: (1) 1.1 items 1 and 4 together (the taps and the retired dismissals, with the snooze bug in item 7 since it lives in the same code); (2) 1.1 items 3, 6, 7b (recap, self-open explanation, Welcome tap); (3) 1.1 item 5 (Stall) plus the 1.5 grounding fixes 14 and 15; (4) 1.5 items 17, 18, 19 (capture flow, false banner, distress double pointer); (5) 1.3 items 8, 9, 10 as three small ungated PRs; (6) 1.4 item 13 (the correction-target test). Item 7a (live side) is already in flight on the other session; item 16 (posture rule) rides with its PR 2; do not duplicate either. Copy marked APPROVED ships as written; copy marked DRAFT does not ship until Bob marks it. Part 2 stays on hold until Part 1 has cleared Bob's read. Standing gates, gh flow, browser tests on the flagged fixture (`newFlaggedFocusPage`), report each PR with URL and merge SHA.
Date: 2026-09-09, revised 2026-09-10 (section 2.6 added; Code: replace the saved copy with this one)
Type: Batch (post-production-test fixes) and Phase 4 brief (fold the hand-wired Coach into the catalog)
Sources: Bob's test log (`2026-09-09_concierge-test-feedback.md`, Parts A and B, plus the SCOPE reference sample); Code's affordance inventory (`2026-09-09_coach-affordance-inventory.md`); the introduction-messaging research consult (2026-09-09); the concierge design (`2026-09-08_coach-concierge-design.md`).
Build these were observed on: `268a812` through `e4e088f`.

Standing rules that apply to everything below

* Situation fields are a projection of app state, never DOM measurement (CLAUDE.md §8, #842).
* No Coach copy ships without Bob's sign-off on the text. Copy in this brief marked APPROVED is his; copy marked DRAFT is not, and must not ship.
* One `PLAIN_ENGLISH` principle, no banned-word lists. Add this sentence to the block: "Could a good colleague say this across a table without sounding either above the person or like they were keeping a file on them? If not, rewrite it." (Bob, 2026-09-09: no superiority, no surveillance, partner not parent.)
* A gated PR contains no ungated change. Each item below is marked G (behind `onboarding_concierge` / `coach_presence`) or U (reaches every account).
* Production bugs: reproduce to the symptom first, trace the path in the PR, run it in a browser on the preview.

Part 1: the batch

1.1 Engine and presence (G)

1. Taps, decided (Bob, 2026-09-10). On an offer: [Do it now] [Remind me later]. With no offer: [Remind me later] only. Plus one presence control in the tap row on every unprompted message: [Minimize Coach for now], which does exactly what the header minimize does (the panel zips into the header pill, the animation from #844), so the person sees where Coach went; a significant moment reopens it, and a typed question is one click away. This replaces both old dismissals: "I'm good for now" and "Stay quiet on this screen" are retired, and the screen-level quiet state goes with them (the presence model already covers it: minimized means ordinary moments stay in the pill, significant ones open the panel). "Remind me later" is per offer: it snoozes that offer (see 2.6 for the floor) and nothing else. "Do it now" sends the acceptance as the person's turn so the existing rework/capture path does the work. Gold on the action tap only. Tap words APPROVED.
2. Delivery on pre-existing builds. Delivery fires once on first visit to a section that was built before the concierge existed (observed A1, Interview Prep). Decision: KEEP, once per section, as the discovery moment for prior work. APPROVED (Bob, 2026-09-10).
3. Return recap tightening. Observed B6: four sentences, "real momentum on the live side" (our shorthand), and it arrived as two stacked messages. Instruction: three sentences hard cap; name the pipeline fact plainly ("HOPE is at the offer stage, and you have interviews at Deloitte and Imerys coming up"); one message, never two. Confirm what the first of the two stacked messages was and why it fired.
4. Snooze tightening, superseded. Guardrails brief change 3 was written for "I'm good for now," which item 1 retires. Replace with: while minimized, ordinary moments write to the pill's preview line and do not open the panel; significant moments open it. No session-wide quiet state remains. Remove the old snooze code paths rather than leaving them behind the new taps.
5. Stall copy. Per `2026-09-09_coach-phase3-voice-review.md`: "Nothing is built for this role yet. Want me to build {firstSectionLabel} now, or would you rather look at other roles?" Taps "Build {firstSectionLabel}" / "Show me other roles". Note the D3 finding: The Role auto-builds on landing, so Stall must treat The Role as the free first section (fires when nothing beyond The Role is built) or it never fires. Copy APPROVED (Bob, 2026-09-10).
6. Introduction explanation once. The self-open explanatory framing (Part 2, item 2.3) appears the first time Coach opens on its own and never again: dedupe key `coach-self-open-explained`, durable.
7. Snooze swallows significant moments (B4, confirmed by L8 and L9). After a session snooze, two builds in a row produced no Delivery. Significance bug in the evaluator. With item 1 retiring the old snooze, the rule becomes: while minimized, a significant moment (Delivery, Check with a date) opens the panel. Fix to the symptom with a browser test on the flagged fixture: minimize, build, assert Delivery renders and the panel opens.
7b. Welcome message ends with a way to start (Bob, 2026-09-10). On the Welcome screen the panel's first message ends "Let's start with where you are right now" and then nothing happens; the person has to find the page's "Let's get started" button on their own. Give the message a tap, [Let's go], that does exactly what "Let's get started" does (advance to Your Current Situation). No auto-advance: the Welcome screen also offers "Load a Saved Profile," so the choice stays with the person. Same rule for Phase 4 Row A when it replaces this message (see 2.3): the first-open message always ends with the one tap that starts the groundwork.
7a. Concierge on the live side. Pulled forward from Phase 4 (2026-09-10): Arrival on My Pipeline and on each Opportunity Playbook, Delivery and a stage-based Next move on Opportunity cards, an "interview is close" Check, and the state-based jump to Resume Refresh when an opportunity is added for a direction. Written as its own prompt: `2026-09-10_concierge-live-side-brief.md`. Its PR 1 (ordering, tap persistence, record pinning) also closes items D1 and D2 from the log and should ship first in the batch.

1.2 Voice samples for the eval (no code; add to the fixture set)

* PASS reference: Bob's SCOPE question on the Deloitte Interview Prep card (grounded, personalized, surfaced "leaning on" and "also consider"). Use as the bar.
* FAIL samples: "Every interviewer on this path is going to clock that" (unsourced absolute plus slang); "the main read mostly confirms what you already believe" (tells the person what they believe); "real momentum on the live side" (shorthand).

1.3 Ungated fixes (U, each its own PR or grouped as marked)

8. Start Fresh confirmation. Replace the browser-native `confirm()` with an in-app dialog: Cancel is the default, the destructive button reads "Delete my account", body text unchanged ("This permanently deletes your profile, outputs, saved playbooks, and chat history. You can sign back in with the same email to start over.").
9. Layout width token. Raise layout width, keep prose measure (see the layout prompt of 2026-09-09): one token for page layout (cards, pipeline board, rails), ceiling around 1440, running text keeps its current measure inside it; no centering; same width whether the panel is open or docked. Screenshots at 1440 and 1920.
10. CoachMark on the sidebar's My Coach row. Same mark as the header pill so the two entrances share an identity. No other sidebar change.

1.4 Process and tests (U, docs and test files only)

11. CLAUDE.md additions. (a) Production bugs: reproduce to the symptom, trace the path in the PR, run it in a browser on the preview; adversarial second look on engine PRs. (b) Animation: when morphing a box between very different sizes, screenshot the mid-flight frame, not only the endpoints (the #844 radius bug). (c) Branch restart: rebase onto `origin/main`, not the reset branch tip, even when content-identical.
12. Flagged fixture for browser tests. The #842 suite runs as a non-internal account (floating bubble). Add a flagged-account fixture so the embedded concierge panel is the surface under test; run the eleven-click sweep and the composer-visibility check on it.
13. Correction-target verification. The one browser test that decides Column 3 of the inventory: on a Focus Playbook, scroll (do not click) to a section, type a correction ("change the opening"), assert the rework lands on that section. If it passes across the eleven sections, the per-section "Ask My Coach about this" targets can come from the Situation and Column 3 collapses into Column 1 at GA.

1.5 From Bob's Part L (filled 2026-09-10; verbatim replies are in the log)

Sorted by phase. "Batch" means Part 1 of the batch brief; the number is the item.

Urgent, ungated, ships before the batch (own prompt: `2026-09-10_personal-brand-correction-regression.md`). L3's small correction in "Does this feel right?" ("agree that my background points towards mid-size organizations, I am very interested in increasing the scope of my responsibilities to do this at larger scale") regenerated the whole Personal Brand instead of editing one passage. The "Also worth a look" review lists 7 lines changed and 27 lines gone, each with a "Put it back" button; three stat tiles went to "n/a" (the $4.8M total rewards refresh, the six-point turnover drop, the 76% placement rate); the mental-health benefit expansion, the DEI function, and the CFO/partners exchange dropped out. A one-sentence correction must produce a one-passage change and can never lose a number. Bob: "This is a disaster and needs to be fixed ASAP."

Phase 1a, grounding (batch, new items).

* L4 Cover Letter: Coach said "I don't have the text of your cover letter in front of me" and listed the sections it could see (Where you fit, About This Company, Compensation, Bridge Story, Interview Prep, Resume Refresh). The Cover Letter card text is not in what Coach receives for an Opportunity record. Add it to the record payload; assert with a browser test that a typed question on the Cover Letter card gets the letter's own words back.
* L4 Compensation: the reply begins mid-sentence ("Com at $118,700, ZipRecruiter at $116,690..."). The opening clause was lost, most likely to the #839 preamble stripper (stripSelfTalkPreamble) eating a first sentence that was not self-talk. Reproduce with the same question on the Compensation card; tighten the stripper to the actual preamble shapes.
* L5: with the Bridge Story card in view, "make this less about COVID" produced a rework offer on Where you fit ("Want me to update Where you fit on Deloitte..."). The offer targeted the wrong card. This is the Column 3 question in the inventory and batch item 13; the test now has a real failing case to reproduce. Bob to confirm which card was on screen when he typed.
* L7: "What can you do?" replied "I can't generate or edit anything in Reimagine, only read what's there," in the same session where L6 had just updated the Imerys record and L2 had offered to build Interview Prep. The posture rule in SYSTEM_PROMPT_STABLE contradicts what Coach now does (same root as D2's self-contradiction). Fix the posture rule in PR 1 of the live-side brief; the Phase 4 "what can you do" rule replaces the list.

Phase 1b / engine (batch).

* L8 + L9: after "I'm good for now," two builds in a row (Bridge Story, Industry Background) produced no Delivery at all. That is B4 reproduced on a second day: the session snooze is swallowing significant moments. Batch 1.1.7 is now a confirmed bug, not a pending question. Fix to the symptom with a browser test on the flagged fixture: snooze, build, assert Delivery renders.
* L8: Delivery fired with the right role and the right lane (Familiar Ground) and offered "add a line"; no Next move build offer appeared and no tap of any kind beyond the two dismissals. Same as D1 (tap loss) or Next move not firing; PR 1 of the live-side brief covers both.
* L1: the seed line ("Hi, I'm your coach...") stacked above the recap again. Batch 1.1.3, still open.
* L2: Delivery on Industry Background fired with the right record, one strength, one offer, and no accept tap (1.1.1). Delivery's offer was a build ("we could build Interview Prep next"), which is Next move's job folded into Delivery; fine if intended, but then the tap should be "Build Interview Prep."
* L6: two stacked replies to the capture sentence (the coaching reply, then the capture offer), and the panel scrolls to the second so the first is out of view before it is read. After the tap, a "Saved" confirmation plus a long coaching message. Four messages for one sentence. One reply, offer first, coaching after the tap.
* L8: a "your work is not being saved" banner flashed during a build and cleared on its own. Ungated; find the state that shows it and make it show only when a save actually failed.

Phase 2 / 3 copy (batch, voice).

* L1: recap with nothing new correctly skipped the status line ("Hi Lindsey — good to see you. How are you doing this week? Whenever you're ready...") which is the design; the "point to what looks most worth your time" line is decent. PASS.
* L3: the Personal Brand richness read used the two questions, named specifics, and ended with the tell-me-here-or-use-the-box line. Two additions were offered, not one. It also proposed connecting to "the 'trusted advisor' thread" after the person had asked (B4) to lose the word "trust"; corrections need to reach this read's context. No taps on the offer (1.1.1).
* L4 Where you fit: strong and grounded (the 50% travel deal-breaker from Practical Priorities, Susan Smith as the person to ask). PASS. "At the Big Four typically runs meaningfully above" (Compensation) is an unsourced claim; voice fixture.
* L11: the distress reply already pointed to 988 and to a trusted person, and the deterministic net appended a second "please talk to someone you trust" paragraph, so the person got the pointer twice. ensureDistressSupport should append only when the reply lacks the pointer. Bob's copy note: "I'm glad you told me that" can be misread; prefer "Thank you for telling me that." Copy DRAFT for Bob.
* L7: Bob's note: the section on screen listed recommended actions in its body that Coach did not pick up. Consider adding the section's own next-step lines to the Situation.

Demo bar (L6). One run, one success, except the interviewer's title ("VP of Operations") was not captured (Interview Team: Julie Johnson, no title). Two more runs with different wording still needed; the demo beat is not yet cleared. Add the title to the capture fields.

Not testable / not run. L10 (no sections left to build on Lindsey; run F1 on Dana or on a new role), F2 admin dashboard counts, L11's "no moment fires for the rest of the session."

Test-plan notes for next time. "Fresh session so screen-quiet is cleared" was unclear; say "close the tab and sign in again first." L6 should say "run it three times, with the wording changed each time, and paste all three."

Each 1a and engine item above is a batch item: 14 (Cover Letter in the record payload), 15 (preamble stripper over-stripping), 16 (posture rule vs. what Coach now does; PR 1 of the live-side brief), 17 (capture flow: one reply, offer first, coaching after the tap; add the interviewer title to the capture fields), 18 (false 'not being saved' banner), 19 (ensureDistressSupport appends only when the pointer is absent). 1.1.7 (snooze swallows significant) is confirmed and no longer pending.

Part 2: Phase 4 brief

2.1 What Phase 4 is
One mechanism for the whole journey. The eighteen hand-wired `seen*` triggers, the fifteen `openCoachWith` sites, and the twenty-five Coach affordances in Code's inventory become catalog rows in the Moments engine, offered by Coach at the moment they are useful, with taps. Nothing users see changes on day one; the change is that a future tweak is one row in one place. Onboarding is last on purpose, so the part that works is never the part under test.

2.2 The inventory, applied
Per `2026-09-09_coach-affordance-inventory.md` (25 affordances):

* Column 1 (16, open Coach only): removal list for GA day. Nothing is removed until the panel is on for every account. Two premises to verify before this list is final: "Your Next Step" is a live pilot (shipped 2026-09-02, flagged), not dead code, so its button is a pilot question, not a removal; and the five Focus sections whose "Ask My Coach about this" carries no rework target (The Role, Compensation Read, Interview Prep, Networking Groups, Recruiters) need one answer: corrections unsupported there, or inconsistent wiring. Report which.
* Column 2 (8, specific reads and drills): become catalog rows, one each: Practice This Answer; the two per-seat Interview Team doors; the weakness question; the five routed interview questions (one row with a parameter, not five); the offer-negotiation trade-off drill; the pipeline read; the opportunity read. Each row: family (mostly Check, keyed on pipeline or playbook state; Practice This Answer is Delivery-adjacent, after Interview Prep builds), significance (ordinary unless it responds to something the person just did), condition, dedupe key, and the tap that runs the existing read. The page button is removed only once its row has fired on Bob's account and passed his read.
* Column 3 (1, correction target): resolved by item 13. Until then, unchanged.

2.3 Coach introduces itself (three catalog rows, Arrival family, surface = Coach)
Principles (research consult, 2026-09-09, adopted): teach one capability at the moment it is true, never a list; trust comes from what Coach does, not what it claims; the first open is relationship plus the one true next thing. Bob's constraints: partner not parent; no language that implies superiority or surveillance; texture over vagueness ("worth a word" and "worth talking about" rejected as meaningless to a new user); never apologize for being present.

Row A, first open (once per account, at the first appearance of the panel after Welcome). Copy APPROVED by Bob 2026-09-10 (fifth pass):
I'm your coach, and I'm with you for the whole search. We start with the groundwork: your resume, what people count on you for, what matters to you in the next job. I'll be right here while you put that in, and if you'd rather tell me something than type it into a box, say it here and I'll put it where it belongs. Ask me anything along the way, about your search or about how any part of Reimagine works.
Row A tap (added 2026-09-10, per batch item 7b): the message ends with [Let's go], which advances to Your Current Situation; a closing sentence to carry the tap is DRAFT for Bob: "Ready? We'll start with where you are right now."

Row B, first minimize (once; renders in the pill as it lands). APPROVED:
I'm right up here. Click me anytime and we pick up where we left off.

Row C, first self-open (once, the first time a significant moment opens the panel; the real reason is filled in from the moment that fired). APPROVED:
I opened because something just happened that's worth talking about: {the real reason, e.g. "you finished your Bridge Story, and I have a read on it"}. I'll do this when there's something real to say, after you build something, when you pick a role, when an interview is coming up. If you'd rather I hold off for now, tell me "I'm good" and I will.

Rule, not copy: "what can you do?" When asked, Coach names three or four things it can do with what this person has built right now, one line each, each with a tap; never a general list of features. Implement as a prompt rule in `SYSTEM_PROMPT_STABLE` plus the catalog's tap vocabulary.

2.4 One Coach
The panel is the Coach. Add an expand control that takes it to full width for a long conversation; the sidebar's My Coach opens that same panel expanded rather than a separate screen. The full-page `myCoach` mount is retired once the expanded panel has passed Bob's read. The pill and the sidebar row share the CoachMark.

2.5 Pre-Phase-2 copy pass
All Coach copy that predates Phase 2 (onboarding framing, per-step narration, employment and intake prompts, capture-offer copy; the "how it lands" onboarding line is an example) gets the same extraction-and-sign-off pass the Phase 2 and 3 copy got. Extraction first, verbatim, as a returned document; rewrite only after Bob's sign-off.

2.6 The widen-the-search set (added 2026-09-10)
Why. The features that widen a person's surface area of opportunity are the ones nobody finds: in the 14 days to Sep 10 the insights page shows Groups for This Path surfaced once, Known Contacts once, Recruiters never. Next move walks the section order and these sit ninth and tenth. Bob's principle (2026-09-10): people don't know how to run a job search, they are overloaded, and part of Coach's job is to keep gently nudging them toward the things that increase the surface area of their opportunities. A good idea declined for lack of bandwidth is not a rejected idea.

The set. Five offers, each a Check-family catalog row, surface = Coach, tap opens the thing:

1. Recruiters for This Path (build the section for the direction in view).
2. Load your LinkedIn contacts (the connections export, so Who You Know Here and Known Contacts work).
3. Networking Groups (build the section; groups near you for this path).
4. Career Club Corner (link out). Copy APPROVED, Bob's own words (2026-09-10): "There's a free community that meets every Monday called Career Club Corner. It's run by Bob, and he walks the group through his book, Making Your Own Weather, a twelve-week syllabus on the job search. It's also an open opportunity for you to ask him anything about your own search. The people on the call are just like you, going through the same process, and plenty of them become networking contacts and accountability partners. Nobody is selling you anything. Want the link?" Taps: [Take me there] [Remind me later] [Not for me]. (Cowork: never "the same kind of search you are" or "a community around this search"; plain spoken, as above.)
5. Income Now (the section; a path for bringing money in while the search runs).

Taps, a hard rule. Every offer in the set carries three taps: [Do it now] [Remind me later] [Not for me]. "Remind me later" is a snooze with a date: five days (Bob, 2026-09-10), and that is a floor on Coach raising the same offer unprompted, not a ceiling; a situational hint from the person brings it back sooner (example: recruiters offered Monday and snoozed; on Wednesday the person says no recruiters are finding them; Coach answers that and offers the recruiter build again, with the tap). "Not for me" retires the offer for that person for twenty-one days (Bob, 2026-09-10: sixty is too long, people's situations and moods change), then it may be raised once more. Nothing in this set is once-per-account. The dedupe key for these rows stores a snooze-until date, not a done flag. Tap words APPROVED.

What the engine does (machinery, kept small). Two things a model is bad at: it remembers the snooze dates per row per person, and it enforces pacing: at most one widen-the-search offer per session unprompted, never the same row inside its snooze window, and rotation through the set so a person who snoozed recruiters hears about groups next time. While the panel is minimized, the set stays in the pill like any other ordinary moment. Exception: a direct hint from the person overrides the pacing and the snooze (not a "Not for me" retirement), because answering what someone just said is a reply, not an unprompted offer.

What Coach does (principle, in the prompt, not a condition table). Add to `SYSTEM_PROMPT_STABLE`, under `PLAIN_ENGLISH`, in words to this effect (copy DRAFT, Bob signs off): Reimagine has built things for the hard parts of a search: finding the recruiters who place this kind of role, seeing who you already know at a company, finding groups of people on the same path, the Career Club Corner calls, and bringing money in while the search runs. When what the person says, how they sound, or what their pipeline shows points at one of those, name it plainly and offer to start it, with the tap. Hints to listen for: "I've run out of people to talk to," "there's nothing out there," "I don't know anyone," feeling alone in it, a comment that the money is getting tight, discouragement about opportunities; and, in the Situation, a pipeline with few live opportunities, nothing added in a while, or nothing moving. The snooze is a floor on Coach raising the same thing unprompted; a hint from the person is answered when it comes, snooze or not. Offer the path, do not diagnose the person: for Income Now in particular, respond to the words that were said and never probe the finances behind them.

The catalog rows carry a sentence, not a rule. Each row lists what it offers, the tap targets, and one sentence on when it tends to be true (e.g. Recruiters: "The Role and Your Bridge Story are built for a direction and nothing is live in the pipeline for it"). These sentences are guidance to the model through the Situation, not evaluator conditions; the evaluator's job for this set is the pacing and the snooze dates only.

The mood question gets a job. The Return recap's "How are you doing this week?" read as perfunctory (Bob, C1). It stops being decorative once the answer routes somewhere: "run out of people," "no opportunities," "tired of this," "money" are the hints above. Keep the question; make it real.

Measured by. The dashboard's offer-made / do-it-now / remind-later / not-for-me counts per row (see `2026-09-10_coach-insights-dashboard-concierge.md`). A row whose remind-later rate runs high is not a failure; a row whose not-for-me rate runs high gets its condition sentence or its copy revisited.

2.7 Order of work and gates

1. Part 1 ships and clears Bob's read.
2. Item 13 (correction-target test) decides Column 3.
3. 2.3 rows A, B, C ship first in Phase 4, since they are three rows with no removals, and Bob reads them on a fresh account.
4. Column 2 rows ship in small groups (two or three per PR), each row read by Bob before its page button is removed.
5. 2.6 widen-the-search set: the engine change (snooze dates, pacing, rotation) first, then the five rows in one PR, then the prompt principle; Bob reads each offer on his account with the hints typed in, and reads a snooze coming back after its date.
6. 2.4 One Coach.
7. 2.5 copy pass.
8. GA: flag opens to named testers, then everyone; Column 1 removals ship the same day the flag opens to everyone, not before.

Out of scope
Weekly goals (held by Bob until Part G results). The challenge mechanism as a Check moment (backlog). The My Coach avatar (enhancements list, Later). Server-side orchestration and the rest of the structural backlog.
