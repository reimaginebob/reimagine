# The Coach as Sherpa — replacing the one-step engine

## Prompt for Code

Apply this brief in four separate pull requests, in the order given, each with its own gates and its own merge. Read the whole document first: PR 1 builds the sight the other three depend on, and a shortcut taken there will misshape all of them. Premise-verify every claim in Pre-flight against current `main` before you touch anything — substance-grep, not block-existence — and STOP and surface if anything has moved. Everything user-facing stays behind the existing `next_step` flag; no ungated change rides along. Standard gh flow per CLAUDE.md section 9, preview smoke against the reimagine2 host on any PR touching `api/*`, and report the PR URL and merge SHA for each.

---

## Date / Type / Source

**Date:** 2026-09-02
**Type:** Replacement of a shipped pilot, in four PRs.
**Source:** Bob, in conversation with Code, immediately after opening the Your Next Step pilot (PR #675, merged `9f5a037`) on his own account.

Bob's verdict on the shipped version was "so what." He was right, and the reasons he gave are the brief:

> This is a very flat two dimensional view of someone's search. This is missing all of the Sherpa my coach guidance that this should be offering the user.

> Rather than one concrete next step, we need to present her with three viable next steps.

> You're being very differential to a user who is unfamiliar with the terrain, and we keep asking her where she wants to go even if it takes her over a cliff.

> We need to focus on principles more than rules.

---

## What went wrong the first time, so it is not repeated

The shipped pilot computes one recommendation from a rules table and instructs the Coach to repeat it. It reads as robotic because it is. Three specific errors produced it, and each has a correction that governs this brief.

**A principle was encoded as a rule.** Bob's concern was paralysis. That became "exactly one step, never a plan," written into the engine and into the Coach's standing instructions. The rule then outlived the situation it was drawn for. Five tasks is a backlog; three doors with a recommendation is agency, which is the thing the product is supposed to give. Going forward: **detection belongs in rules, judgment belongs in principles.** A banned phrase, a fabricated citation, a save claimed that did not happen — those are machine-checkable defects and they keep their gates. What to say to a person this week is judgment and gets a stated intent, not a table.

**One position was computed for a search that is several journeys at once.** The engine takes the furthest-along opportunity and reports it as the person's position, so an offer at one company puts a check mark on Outreach and declares it finished. It is not finished; every other opportunity is still in it. The check marks claim a completion the product has no basis for.

**The posture was protective rather than useful.** Do not overwhelm, do not count, do not interrupt, do not presume — every one a *don't*. A coach is made of do's. The product's entire value is that it understands the terrain better than the person walking it, and a guide who keeps asking which way to go is not honouring agency, it is stepping back and letting them pick the cliff.

### The line that replaces "never ask"

**Ask what only she knows. Tell what we know.**

What she wants, what she has already done, what she is willing to do — ask, because we cannot know it and guessing insults her. What works in a job search — tell her, because that is why she is here. The shipped version put both to a vote.

One thing survives from the caution, and it is not deference: **never ask for something she has already given us.** A doctor who re-asks the intake questions every visit has not read the chart. That is the same failure as the Coach asking who Marisol was while she sat on the panel with her role filled in.

---

## Pre-flight discovery

Verified against `main` at `9f5a037` during the conversation that produced this brief.

**Already true, and load-bearing:**

- `recordSectionText(record, key)` in `api/coach.js` already normalises both record shapes — door2 reads `record.sections[key]` (`{content, builtAt}` or a bare string), door1 reads `record.outputs[key]`. **The Coach already calls it for exactly one section (`p11`) and discards the other nine.** The build map PR 1 needs is a loop around a function that already exists.
- Focus Playbook sections, standard track, from `FOCUS_ORDER` (`src/App.jsx` ~13173): Deep Dive, Bridge Story, The Lingo, Interview Prep, Resume Refresh, LinkedIn Remix, Go-to-Market, Groups, Recruiters, Income Now. The Go Independent track has its own six.
- Opportunity Playbook sections: `p5`, `p6`, `p_res`, `p11`, `companyRead`, `salaryRead`, `offerNegotiation`. Interview team on `rec.panel.interviewers`; free-text context on `rec.panel.opportunity_context`; job description on `rec.jd`; `rec.savedNotes`.
- `pursuit_status` gives stage, `next_conversation_at`, `next_step_at`, `next_move`, `situation_note`, `closed_at`, `outcome`, `updated_at`. Read server-side in `api/coach.js`; the client GET at `/api/pursuit-status` returns the same columns.
- `FEATURE_MAP` (`src/coach-routing.js`) already carries `reach: 'community'` for `career-club-corner` and `accountability-partner` — it already distinguishes an in-app screen from a thing a person does in the world. **That distinction is the seed of the activity catalog and should be extended rather than replaced.**
- All three capabilities Bob named as missing already ship: **Recruiters** (focus-gated), **Who You Know Here** (opportunity-gated), and the university-alumni route, which is the third door *inside* Who You Know Here. Bob asked for a feature he had already commissioned — the strongest available evidence for the undiscovered-features problem this brief exists to solve.
- `users.search_going_well` / `search_focus`, each with an `_updated_at` sibling, are the existing precedent for a fact about someone's search captured conversationally and stored outside the profile blob. The activity catalog follows this pattern rather than inventing one.
- The one-tap capture pattern (model emits a hidden trailer → server validates onto a response header → client renders an offer → the tap writes; the model never writes) shipped for pipeline capture and is the mechanism for learning off-product facts.

**Confirmed defect, shipped, fix belongs in PR 2:**

`src/components/Staircase.jsx` renders no ascent — the five boxes sit flat, so the screen is not Bob's staircase. Each box sets `paddingTop` for the ascent and then sets `padding`, which is `undefined` on desktop. React does not skip an undefined style value; it assigns the empty string, and `style.padding = ''` clears the whole shorthand including `padding-top`. Because `padding` follows `paddingTop` in the object literal it wins every time. Remove the `padding` key from the desktop branch rather than reordering — a reorder leaves the same trap for the next edit.

**Not verified, verify before relying on it:** whether any door1 record in production carries a `builtAt` per section (door2 does). If not, "when it was built" is available for opportunities only, and the Coach must not imply otherwise for Focus Playbooks.

---

## PR 1 — Sight

The Coach can currently name every opportunity's title, stage and day counts, and knows almost nothing about what is actually inside them. It therefore speaks with confidence about a search whose contents it cannot see. This PR closes that, and nothing renders differently.

**1a. The build map.** Extend `buildPursuitStatusBlock` (`api/coach.js`) so each opportunity reports every section by name — built or not, and when, where a timestamp exists — plus whether the interview team is named and how many people are on it, whether a job description is loaded, and how many notes are saved. Do the same for Focus Playbooks, which reach the Coach today with no build state at all: title, direction, which of the ten sections exist, and when the record was last touched.

Report by section **name**, never as a count or a fraction. Three sections of ten may be exactly right for that path; a completeness figure is the progress bar this product refuses to draw, wearing a different hat.

**1b. The activity catalog.** A single back-end list of the moves a person can make, in the product and outside it, extending the `reach` distinction `FEATURE_MAP` already carries. In-app entries resolve their state from the record (Recruiters is built or it is not). Off-product entries are the new half and the more valuable one: joined a networking group, been to Career Club Corner, has an accountability partner, explored local job-search resources, written directly to a target company, asked anyone for an introduction.

Store what we learn, **including a no**. "She told us she does not want an accountability partner" is a fact worth keeping — it is precisely what stops the Coach asking a fourth time. Distinguish it from "we have never discussed this," which is not a deficit and is never counted, reported, or totalled.

New migration, forward-only and idempotent, following the `search_going_well` precedent: the fact, its state, when it was learned, and how (observed from a record, said in conversation, or answered when asked).

**1c. Learning it.** Reuse the one-tap capture. When someone says they went to the Monday call or that a former colleague is putting in a word, the Coach offers to note it and the tap writes. The model never writes directly.

**Out of scope here:** any change to what the screen renders, to `nextStep()`, or to how proactive the Coach is. This PR gives it sight; the next two give it a voice and a face.

**How to know it worked:** ask the Coach "how am I set up for the Imerys interview?" and it should answer from the actual build state — the company research, the team, the prep — without asking which opportunity or what has been built.

---

## PR 2 — The doors

**2a. The engine stops choosing.** `nextStep()` is replaced by a function returning the **candidate set**: the moves actually available and warranted for this account right now, each with what it is, why it applies, and where it lands. Availability stays deterministic and stays in `src/step-position.js`, because it is about what exists — Recruiters needs a direction, Who You Know Here needs a live opportunity, Interview Prep needs an opportunity to prepare for. The screen and the Coach read the same set, which is what stops them ever offering different doors.

Dependency order is real information and should be carried, not invented at render time: company research and the interview team both feed Interview Prep, so prep built without them is a weaker artifact and the sequence has a reason the Coach can give.

**2b. The screen shows two or three doors and a recommendation.** Not one instruction. One door only where there really is one — no Personal Brand means nothing else is worth offering yet. Never five.

**2c. The staircase holds her opportunities.** Each live opportunity sits on the stair it is actually at. The single arrow goes, and the check marks go with it: stairs carry her work rather than claiming she finished a phase. The picture becomes her search at a glance instead of a diagram of the framework, which is the only way it earns its space.

**2d. Fix the ascent.** Per Pre-flight. It should look like the Career Club Corner slide, because recognition is the whole reason that picture was chosen.

**Keep:** no percentage, no fraction, no estimate of how close an offer is. That one is a rule and stays a rule — it is machine-checkable and the failure is unambiguous.

---

## PR 3 — Initiative

**3a. The Coach reads the whole pipeline and says what it sees.** *Deloitte has gone quiet — it has been three weeks. Imerys has an interview on the 14th and the prep is not built.* Then two or three doors, its own recommendation among them, and an offer to walk it through. This is a judgment and it belongs to the model; a rules table was never going to say "you need to do something with Imerys."

**3b. It asks, the way a doctor asks.** Not a questionnaire, and never for something already on file — but it does ask, because it cannot prescribe without knowing. Have you got someone holding you accountable? Have you written to anyone at a target company directly? Sometimes there is no answer and it listens; that is fine.

**3c. It tells her what works, and offers to do it.** *Did you know we can find the recruiters who specialize in this?* This is the move that solves the undiscovered-features problem, and it is a **tell**, not a poll.

**3d. When the choice is hers alone, it asks.** Someone with a Personal Brand and nothing else has a real fork with no wrong answer: work a live opening, or explore directions. That is a preference only she holds. Ask, then escort — *tell me which and I will walk you through it* — rather than naming a screen and leaving.

**3e. She holds the dial.** Occasionally, after a nudge that mattered, the Coach offers her the control: **more of this, or should I ease off?** Phrase it as a control, never as a grade — "was that helpful?" asks her to judge us and she will be generous, where declining a preference costs nothing and gets a straight answer. It sticks as a setting she owns and can turn back up. Behaviour informs it too, and costs her nothing: whether she walked through the door, whether she came back, whether the third mention went the way of the first two.

**3f. Log the outcome as a product signal.** One person saying "ease off" is a setting. Everyone declining the same nudge means the nudge is wrong, or the thing behind it is. The Coach already logs a silent per-turn signal; this rides the same plumbing.

---

## PR 4 — Meet her at the door

Everything above still waits for her to arrive at the Coach. The Coach is a room she has to decide to walk into, and the product currently has nothing to say until she does. This PR has it speak first.

**4a. Nothing in Reimagine notices time passing for a person, and that is the root of it.** Five crons run today and all five watch the business: spend, abuse, surveys, snapshots. None watches a search. Her interview is Thursday and nothing knows. Her step was due last Tuesday and nothing knows until she happens to log in. Build the noticing once — what is about to matter for this account — and it feeds this PR and any future channel.

**4b. It lives on the floating coach bubble, not on a screen.** She lands wherever she left off, so the greeting has to follow her rather than sit somewhere she may not go. The bubble is already on every screen. It carries one line; tapping opens the conversation with that read already made.

**4c. Never a badge with a count.** A number is scorekeeping, and this product does not keep score. A quiet mark that there is something worth a minute is not a number.

**4d. Deterministic noticing, model only for the phrasing.** A fresh read on every page load is a model call per arrival — slow, and paid for on visits where nothing has changed. The trigger comes from data already in hand: an interview inside a few days with no prep built, a step well past its date, a fortnight of silence on a live opportunity. Only when something trips does the model phrase it, and the phrasing caches against a fingerprint of the facts that produced it. Facts move, new line. Facts hold, same line, no new call.

**4e. Silence is a valid state, and the feature fails without it.** If nothing is time-bound and nothing has changed, say nothing. A greeter who greets on every visit is furniture inside a week, and then it is worse than absent — she has learned to look past the one place we will need her to look when it matters.

**4f. It does not repeat itself.** One condition, said once, gone when dismissed, back only when the facts underneath it change. `alertOnce` (`api/_lib/ops-alerts.js`) is the existing precedent and its own comment already carries the reasoning — a repeat on a condition that persists trains the reader to ignore it. Same logic, applied to a person instead of an operator.

**4g. Measure the thing this is for.** No panel currently reports what share of accounts have ever opened the Coach: `chat_messages` is folded into the general activity union in `api/admin/growth.js` and never broken out. Add that figure in this PR — distinct non-internal accounts with at least one message, against active accounts — so the before and after are both readable. Shipping this without it means never learning whether it worked.

---

## Voice

Everything inserted is user-facing or spoken by the Coach and carries the full voice stack. Particular exposure in this work: no comparative standing ("most job seekers"), no AI-coaching register, no logic-flip cadence, no typology labels, and nothing that frames her current state as deficient — the encouragement in 3c is an offer of something available, never a report of something missing.

`scripts/check-voice.mjs` covers `src/App.jsx`, `src/step-position.js` and `src/components/Staircase.jsx`. It does **not** cover `api/coach.js` or `src/data/*-knowledge.js`; scan new prose in those against `patternsFor('build', { includeSoft: true })` by hand before committing, and consider adding them to the gate's file list in the PR that touches them most.

## Static gates

Per PR: `npm run build` clean end to end — voice 0/0, `check-sys-equality`, `check-prompt-refs`, `check-coach-nav-map`, `check-orphans`, `check-fontsize` and `check-btn-prominence` at baseline 0 (never raised), `check-guide-refs`, `check-user-guide-pdf`, the full test suite including `test-step-position.mjs`, and lint. `src/App.jsx` line count recorded before and after, EOF intact. Diff scope limited to the files that PR names.

`test-step-position.mjs` must be rewritten alongside the engine in PR 2, not deleted — it is the only thing standing between a judgment call and a silent regression in what two surfaces tell the same person.

## Runtime gates

Preview smoke (`npm run smoke:preview -- <url>`, reimagine2 host, URL copied from the Vercel bot comment) is a merge blocker on PR 1, PR 3 and PR 4, and on PR 2 if it touches `api/*`.

Then, per PR, against Bob's own account on the preview: PR 1, the Imerys probe above. PR 2, the staircase renders as a staircase with his opportunities on it, and the doors match what the Coach offers. PR 3, the Coach opens on a real read of his pipeline rather than a restatement of it. PR 4, arriving with something live and time-bound in the pipeline shows a line worth reading; arriving with nothing changed shows nothing at all, and the second half of that is the half to check hardest.

## Constraints

Four PRs, in order, each merged before the next begins. Everything user-facing behind `next_step`. No ungated change in any of them. No effort estimates anywhere. Documentation per CLAUDE.md section 8 — the pilot's Coach knowledge stays partitioned in `src/data/next-step-knowledge.js`, out of `ORDER.json` and out of `FEATURE_MAP`, until GA.

## Out of scope

The coach-icon audit (separate, already scoped). GA of the pilot. Any change to the Go Independent track's sections. Rendering the activity catalog to the user in any form, ever — it is back-end vocabulary, and the moment it becomes a visible list it is a to-do list and the argument is lost.

## Deferred, but not for long — and reframed

Reaching her by email is out of these four PRs. Bob's words: not ready yet, but not too long afterwards.

**The reframe matters more than the deferral, and it is his.** Email is not extra load piled on top of the product. It is what keeps the product uncluttered. The in-app experience stays focused — one screen, a few doors, the thing worth doing now — and the wider material goes to a medium where skimming is normal, ignoring costs nothing, and a link brings her back in. That is a direct answer to the fear this whole line of work started from: so much in the tool that it produces paralysis and undiscovered features. The breadth has somewhere to live that is not her working surface.

**The line that follows from it:** an email about what is *available* is welcome. An email about what she *has not done* is a report card in her inbox and must never ship. Same facts, opposite meanings — the first is an offer she can browse, the second is the scorekeeping this product refuses to do anywhere else and should not smuggle into email.

The machinery is already there: the Resend sender (`api/_lib/email.js`), the campaign pipeline with delivery tracking through `api/resend-webhook.js`, and cron auth matching the five jobs already scheduled. The noticing built in PR 4 feeds it unchanged — same trigger, second channel.

Two conditions before it is scoped. PR 4 must first show the noticing is any good, because an email built on a bad read is worse than no email. And it is never a calendared digest: Bob declined a Monday email earlier in this project and was right to. Event-driven, or an offer of something available — never a schedule that has to find something to say.

## Open, for Bob

How hard the encouragement pushes is settled: she holds the dial (3e). What is still open is what the Coach does when several things are urgent at the same time — an interview on Friday with no prep, an offer expiring, and a pipeline that has gone quiet. That is the Sherpa judgment, it cannot come from a table, and it should be written as an intent for the model rather than a priority order. Draft it in PR 3 and put the wording to Bob before merging.
