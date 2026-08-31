# The STAR story library

**Prompt for Code.** Apply the changes in this brief. It adds a durable home for the user's STAR stories and the two affordances that depend on one: correcting a drafted answer, and choosing which story gets remixed for a given interviewer. Premise-verify before you start — in particular, re-check that no story store has appeared since this was written. Run the full prebuild gate, update the user guide and the Coach feature entry in the same PR, and follow the gh flow in CLAUDE.md §9. Phase 1 needs a migration; migrations auto-apply on deploy, so merging the file is the whole step.

**Date:** 2026-08-31
**Type:** Feature brief, arising from live use
**Source:** Bob, after demoing the per-person Interview Prep with the SCOPE remix control (PRs #611–#614). Two asks: a "does this feel right?" affordance on a drafted story, and the missing library of stories those drafts are drawn from. Bob then set the shape: the library is its own sidebar surface, prepopulated from the resume captured at Orientation, which the user then corrects, strengthens, and adds to. An earlier draft of this brief put resume extraction OUT of scope, reasoning that the library should build only from what the user actually drafted. That was wrong. A blank library is a wall, and drafting-then-correcting is how every other surface in this product works.

---

## Pre-flight discovery

Verified against `main` at `6067e35`.

**There is no story store. Anywhere.** `grep -c "starStories\|storyLibrary" src/App.jsx` returns 0. `src/profile-block.mjs` has no notion of stories: the profile block carries RESUME, REPUTATION, LIFE-SHAPING and PERSONAL BRAND, and every story in the product is inferred from those on the fly.

Three consequences, all of which the user can feel:

1. **Stories are re-derived on every rebuild**, per person, per opportunity. `p11Team` returns `stories: [{story, why}]` — a *name* and a reason it fits that person, not the story itself. Rebuild the prep and the model may name the same experience differently, or pick a different one.
2. **Drafted answers do not survive a reload.** `fullAnswers` is `useState({})` (src/App.jsx:8675). A user can draft their Toronto integration through Strategy, close the tab, and lose it. The new `storyLens` selection (src/App.jsx:6726) is the same.
3. **The book's central method is not buildable in the product.** Lesson 10 opens on the Playlist Principle: *"you do not need one hundred stories for one hundred questions… what you need is a playlist of roughly twelve well-built STAR stories."* We ship the remix (Lesson 10's second half) without the playlist it remixes from.

**So the two asks are one ask.** A "does this feel right?" box that corrects an answer which evaporates on reload is worse than not having it — it invites work that gets thrown away. Both affordances need stories to have a home first.

**Where the home goes.** Stories are cross-opportunity by nature: the same integration story is told at Imerys and at the next company. So they belong to the *person*, not to a playbook record. That rules out the opportunity record, and it argues against `profile_state`: a growing array of long text in the autosave blob is precisely the shape that caused the savedPlaybooks data loss (see `Output/handoff/2026-08-28_savedplaybooks-perrecord-table.md`), and it competes for the 3MB ceiling in `api/profile/save.js`. The precedent to follow is the one already set — a per-record table, as `migrations/2026-09-02_saved-playbooks-table.sql` did for playbooks.

---

## Files affected

| File | Change |
|---|---|
| `migrations/2026-08-31_star-stories.sql` | New. `star_stories` keyed (user_id, story_id) |
| `api/star-stories.js` | New. GET / PUT / DELETE, cookie-session auth, stale-write guard |
| `src/App.jsx` | Library UI, the resume-seeded first build, per-story refine box, story picker on each person, prompt threading |
| `src/data/user-guide/add-an-opportunity.md` | The library, and how it feeds prep |
| `src/data/user-guide/star-stories.md` | New chapter. Its own surface needs its own chapter |
| `src/data/user-guide/ORDER.json` | The new chapter's place in reading order |
| `src/nav-labels.js` | The sidebar label, single source of truth |
| `src/coach-routing.js` + regen | A FEATURE_MAP entry, and the Coach must know it can offer to save a story |
| `api/coach.js` | `STORY_CAPTURE_NOTE`, the third instance of the one-tap capture pattern |

---

## Phase 1 — give stories a home, and seed it from what Orientation already holds

The library arrives populated. A blank one is a wall: nobody writes twelve stories from an empty screen, and drafting-then-correcting is how every other surface in this product works. The resume is already captured at Orientation, so the raw material is there before the user asks for anything.

**Seed from the whole Orientation intake, not the resume alone.** The resume is the source for Situation and Result. It is not the source for Thought Process, and this product already knows that: the T slot in the existing `p11` breakdown is built from the reputation phrase and the career pattern, not from a job history. A live example of its own output reads "Your reputation phrase describes you as the person who slows the conversation down to ask what this feels like for the user. Your career pattern shows you start with the question before the method." That is the model to follow, and it means the raw material for a complete story is already being captured at Orientation, just spread across several inputs.

**Use the pattern that already ships: `raw_material` plus `to_strengthen`.** Every slot in the existing STAR breakdown states what the inputs actually support ("From your inputs:") and names what would make it stronger ("To strengthen:"), with an explicit ban on generic advice like "add more color". That is better than the blank slot an earlier draft of this brief proposed: it gives the user something true to react to and tells them exactly what only they can supply. Reuse it verbatim rather than inventing a second convention for the library.

**The failure story has a source, and the book gives its structure.** An earlier draft of this brief said a seeded library would be near-empty on "a failure and what you learned", because resumes do not carry failures. That was looking in the wrong input. Lesson 3 gives the structure, predicated on the assessments Orientation already captures:

> Your balcony is what a strength looks like when you are at your best, in your element, doing what you are most naturally wired to do. Your basement is what that same strength looks like when it is overdeveloped or misdirected... When an interviewer asks about your greatest weakness, you can answer with actual self-knowledge behind it rather than the recycled non-answer that everyone sees through.

So a weakness or failure story is built from the assessment plus reputation: name the strength at its best, name what it looks like overdeveloped, and tell the moment it cost something. `profile.assess` and `pr.rep.*` are already in the RAW SIGNALS block every Clarity-producing prompt receives.

**Naming rule, non-negotiable.** In output use "Where You Shine" and "Where to Watch Out". Never "balcony", "basement", "shadow", or "assessment signal" — this is an existing rule in the prompt stack and the library must not reintroduce the vocabulary.

**A type with no stored example is still not an empty slot.** Where Orientation holds no specific story for one of the six — "a time you led without formal authority" and "a difficult collaboration" are the likeliest — the library does NOT show a blank waiting to be filled. It shows what that question is testing and what a strong answer does, which is guidance the user can act on before they have written anything.

The product already carries this and it should be reused rather than rewritten. The `p11` prompt holds a canonical question set where each entry names what the question tests and what the strongest answer does. On conflict with a colleague: "Tests collaboration and self-regulation. The strongest answer is one real disagreement, resolved: they heard the other side out first, and it closes on the outcome and how it moved the team forward." The same prompt already types every question as behavioral or non_behavioral and gives the non-behavioral ones a `framing_recommendation` instead of a STAR breakdown, so the mechanism for "structure without a stored example" exists and is enforced by the parser.

So each of the six types renders in one of two states: a seeded story built from the person's own inputs, or the shape of a strong answer plus an invitation to supply the example. Never an empty box. The second state is what turns "add to your library" from a chore into a prompt the user can actually answer, because it tells them what they are looking for in their own memory.

## Phase 1b — the store itself

A `star_stories` table, one row per story per user. Fields: `story_id`, `title` (the short name the prep already produces), `body` (the full STAR answer once drafted), `lens` (the emphasis it was last drafted for), `source` (typed by the user, or drafted from prep), `created_at`, `updated_at`. Forward-only and idempotent per CLAUDE.md §7.

**On drafting, save.** When `generateFullAnswer` returns, write the result to the library rather than only to component state. That single change fixes the evaporation and makes everything below possible.

**Deduplicate on title.** The prep names stories loosely ("Toronto acquisition integration under the Managing Partner's direction" vs "Toronto acquisition, building trust with a skeptical acquired team" — both appeared in one rebuild). Match on a normalized title before inserting, and prefer the existing row, or the user will accumulate near-duplicates of the same experience. This is the same shape as `samePerson` in `src/connections-match.mjs`.

## Phase 2 — "does this feel right?"

A `RefineBox` under each drafted answer, the same component every generated card already uses. The user says what is wrong and the answer is redrafted against it, writing back to the library so the correction sticks.

Two things to get right:

- **The corrected version is the user's, not ours.** Once someone has edited or refined an answer, a later rebuild of the prep must not silently replace it. The Interview Team's per-interviewer research already has this pattern: a draft that becomes theirs once confirmed.
- **Refining is not re-remixing.** "Does this feel right" corrects the *facts and voice*; the emphasis menu changes the *lens*. Keep them visibly separate or the two controls will be read as the same thing.

## Phase 3 — the library as a surface

Somewhere the user can see all their stories, which today does not exist. Minimum:

- The list, with what each one is and which lens versions have been drafted.
- **Add one by hand.** Bob's word was "systematically", and the book gives the scaffold: a good playlist covers, at minimum, a significant achievement, a failure and what was learned, leading without formal authority, a difficult collaboration, a moment of strategic impact, and navigating ambiguity or conflict. Show which of the six the library currently covers and which it does not. That turns an empty list into a prompt.
- **The count.** The book says roughly twelve. Showing progress toward a real target is more motivating than an open box.

## Phase 3b — import what they already have

The reason the library is its own surface. Two routes in, and they serve different moments.

**Paste or upload, on the library screen.** Most people who have done this work have it in a document. Accept a paste or a file, split it into separate stories, and show each one parsed into Situation / Thinking / Action / Result for the user to confirm or correct before it is saved. Two things this must respect:

- **Reimagine's T is Thought Process, not Task.** That is the one change the book makes to STAR and the whole reason its answers land differently. An imported story written the conventional way will have a Task where the Thinking should be, so the parse should say so plainly and offer to help fill the gap — that is the single most valuable thing this import can do, and it teaches the method at the moment it matters.
- **Never silently rewrite what they wrote.** Parse, show, let them accept. An import that "improves" someone's story without asking will destroy trust in the library on first use.

**A one-tap save from My Coach.** This is where the behaviour already happens, so it is where the capture belongs. The mechanism exists and is proven twice: `VALUES_CAPTURE_NOTE` and `INTERVIEW_TEAM_CAPTURE_NOTE` in `api/coach.js` both have the Coach emit a trailer the app converts into a one-tap save offer and never renders. A `STORY_CAPTURE_NOTE` would be the third instance of an established pattern rather than a new mechanism.

Follow the existing rules exactly, because they are the reason this pattern is trusted: offer only when the conversation has genuinely settled on a story in the person's own words, never on a story the Coach proposed and they have not responded to; emit at most once per reply; never mention the line or ask them to copy anything. And per the standing rule on capture, the Coach must respond to what they said as well as store it — a save offer is not a substitute for coaching the story.

## Phase 4 — pick a different story for a person

On each interviewer, beside the recommended stories, let the user choose any story from the library to remix for that person. The prep's picks stay as the recommendation; this is the override.

This is the phase that makes the library pay off rather than merely exist, and it is the one Bob asked for directly: *"beyond the recommended stories… the ability to pick a different story to have remixed for that person."*

---

## Voice rules on inserted text

All new copy follows the house rules: plain English, no internal vocabulary, guidance in a `CoachingCallout` rather than a grey paragraph, nothing below 15px and interactive elements at 16px+. Two specific traps for this feature:

- **Do not tell the user their playlist is thin.** Frame coverage as what is there and what is worth adding, never as a deficiency. (`feedback_thin_input_invitations` and the positive-framing rule.)
- **Do not state that a story "works" for an interviewer.** The prep is already hedged to a read after PR #614; the library must not reintroduce confident claims about what will land.

## Static gates

`npm run build` clean; `check-voice` 0/0; `check-prompt-refs` 0; `check-coach-nav-map` regenerated; `check-fontsize` ratchet not raised; App.jsx EOF intact; diff limited to the files named above.

## Runtime gate (post-merge)

Draft an answer, reload the page, confirm it is still there. Refine it, rebuild the prep for that opportunity, confirm the refined version survived the rebuild.

On the seed specifically, and this is the check that matters most: open the library on an account with a resume, an assessment and reputation inputs already captured, and read the seeded stories back against those inputs. Every claim in a `raw_material` slot should trace to something the person actually supplied, and each slot should carry a `to_strengthen` that names a specific missing thing rather than generic advice. Confirm at least one seeded story is a "Where to Watch Out" story built from the assessment, not another achievement. And confirm the words "balcony", "basement" and "shadow" appear nowhere in the output.

## Out of scope

The story-by-person grid (which story to tell whom, across the whole panel). It wants the library in use first.

## Decided: its own sidebar entry

Bob's call, and the reason settles more than the placement: **people arrive with stories already written, and there is no systematic way to bring them in.** They currently do it by pasting into My Coach, which is a workaround — the Coach can discuss a story but has nowhere to put it. A library buried inside Interview Prep would not be a destination anyone could be pointed at with "bring what you already have"; a sidebar entry is.

This makes import a first-class entry path rather than a later convenience, and it moves up the phasing accordingly.
