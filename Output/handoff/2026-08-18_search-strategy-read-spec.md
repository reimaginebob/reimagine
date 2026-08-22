# Spec (draft for review) — "Search Strategy Read": a MYOW-grounded pipeline insight in My Coach

**Date:** 2026-08-18
**Type:** Design spec (NOT an approved implementation brief — for Bob's review; open decisions at the end)
**Source:** Consult with Bob, 2026-08-18. Supersedes the "going quiet" deterministic signal as *the insight* (that stays as plain status; the candidate already knows an opportunity stalled).

---

## The idea in one line

My Coach reads the **whole search as a portfolio**, locates the person in the **Making Your Own Weather** arc, and coaches the section they're neglecting — prescribing action **inside** Reimagine (a direction not explored, a playbook section not built) and **outside** it (direct outreach, networking) — in the book's own frameworks, not generic tips.

## Why the lift is small

The full MYOW manuscript (~57K tokens) is already in the Coach's cached prompt (`MYOW_CONTENT`, imported in `api/coach.js`). The Coach already reasons from it. So this feature does **not** teach methodology. It adds two things:

1. The **portfolio picture** — a handful of aggregate facts the Coach can't currently see.
2. A **mandate + method** — one instruction block telling it to run a strategic read against the MYOW arc.

No schema. No new surface (v1). No generation. Gated behind `my_search`.

## The core mechanism: pipeline shape → MYOW section → action

The insight is a diagnosis, not a metric. The Coach reads the shape and coaches the section of the journey that the shape says is being skipped.

| Pipeline shape (what we can see) | MYOW read | Coached action (inside + outside) |
|---|---|---|
| 0–1 live opportunities; all inbound | **Outreach** — waiting for weather instead of making it (Lesson 7, Direct Outreach — the book's namesake) | Build a Focus Playbook for a target direction (widen the funnel inside Reimagine); start direct outreach; "how's networking going?" (Lesson 6) |
| Several opportunities, one direction only explored | **Branding + aperture** | Explore more directions (Career Paths); make sure the value prop (4 C's) is sharp before more volume |
| Everything stalled, long tenure, no movement anywhere | **Positioning problem, not a volume problem** | Revisit Personal Brand / Bridge Story (4 C's, value prop) — more outreach won't fix a message that isn't landing |
| Interview scheduled, Interview Prep unbuilt | **Interviewing** (Lessons 9/9B/10: STAR, People Hire People, SCOPE) | Finish Interview Prep / Bridge Story before the date |
| An opportunity at offer stage | **Negotiating** (Lesson 11: BATNA, comp) | Prep the negotiation; know your walk-away |
| Venting / discouragement / low activity | **Attitude first** (Lesson 1, KEEL; circle of control) | Steady the keel before tactics; Community (Lesson 2) |

The through-line is Covey's circle of control, which runs through the whole book: coach what the person *can act on*, framed as a gain, never as a deficiency.

## What we feed the Coach (portfolio facts)

Extends the Move-1 status block with a small aggregate summary, all computable from data already on hand:

- **Live opportunities** (active door2 count) and their stage distribution.
- **Directions explored** (door1 Focus Playbooks + `exploredRoleTitles`) — is there a top-of-funnel engine, or just reactive single opportunities?
- **Momentum:** how many opportunities have an upcoming action vs. none.
- **Build completeness:** which playbook sections are built vs. unbuilt across the set (leverage half-constructed).
- **Employment status** (already captured) — urgency/context.
- **Explicitly ABSENT — say so in the prompt:** networking activity, outreach volume, informational conversations are **not tracked anywhere in Reimagine**. The Coach must **ask** about these (exactly Bob's "how's networking going?"), never assert them.

## The instruction (the heart of the build)

A flag-gated block appended in the same uncached per-user slice as the Move-1 status (so it never forks the cached book+guide prefix). In plain terms it will tell the Coach:

- When the person asks how their search is going, or asks what to do next at the level of the whole search (not one opportunity), **run a strategic read**: from the portfolio facts, locate where they are in the MYOW arc, name the **one** section most worth attention now, and coach it using the book's frameworks and voice.
- **Prescribe concretely**, spanning both unfinished steps inside Reimagine and real-world moves outside it (outreach, networking, conversations).
- Where a section depends on untracked activity (networking/outreach), **ask** rather than assume; offer specific starting points from the book.
- **Honesty guard (carried from Move 1):** never fabricate activity or invent events; thin data → frame as hypotheses ("if you're not doing much direct outreach yet, that's where I'd start"); one clear next action, not a checklist dump.
- Voice: MYOW's voice, inside Reimagine's existing voice rules (epistemic humility, translation-not-praise, no logic-flip cadence — already enforced by `check-voice`).

## Where it lives / what changes

- **v1: Coach chat only.** No new surface. Fires reactively on strategic asks.
- The deterministic Move-2 signals (rollup, "in pipeline N days") stay as at-a-glance status. **"Going quiet" is demoted** — kept as plain status, never sold as an insight.
- Files touched (v1): `api/coach.js` only — a portfolio-facts helper (sibling to `buildPursuitStatusBlock`) + the instruction block. No migration, no client change, no new tool.

## Honest limits

- **Can't measure the outreach/networking half of MYOW** — those aren't tracked, so the Coach asks and advises rather than assesses. This is a coaching conversation, not a dashboard.
- **Reactive in v1.** A proactive "here's a read on your search" surfacing is phase 2 (needs a when/where trigger — e.g., a weekly nudge, or a one-tap "give me a read" affordance).
- **LLM synthesis varies** run to run; what's guaranteed is the portfolio facts and the guardrails, not the exact words.
- Only as good as a **current pipeline** — stale status → stale read.
- Still **gated** (`my_search`); not in `FEATURE_MAP`/guide until GA (added to the GA doc-trigger list).

## Open decisions for Bob

1. **Name.** "Search Strategy Read" / "State of Your Search" / "Pipeline Read" / something better.
2. **Reactive-first?** (Recommended.) Ship it firing on strategic asks; defer proactive surfacing to phase 2.
3. **One-tap affordance?** Alongside the reactive path, a visible "Give me a read on my whole search" button in the Coach — worth it in v1, or let it stay conversational?
4. **Proactive phase 2:** if/when, what's the trigger and where does it surface (weekly? on the pipeline screen? a Coach nudge)?

## Suggested next step

On your sign-off of the shape (esp. #1–#3), I draft the exact instruction text grounded in specific MYOW lessons, run it against a couple of fictional portfolios to show the reads, and only then wire it into `coach.js`. Prompt design is the whole game here, so it's worth one more review of the actual wording before code.
