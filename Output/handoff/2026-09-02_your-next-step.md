# Your Next Step — the spine (pilot, gated)

## Prompt for Code

Apply the changes in this brief. It replaces `2026-09-02_your-week.md`, which was withdrawn — that brief framed this as a weekly pipeline view, and the feature is now the product's spine. Premise-verify every anchor quoted below against current `main` before touching anything; if a quoted line has drifted, STOP and surface it. This brief DEPENDS on `2026-09-02_coach-next-step-capture.md` having merged. It touches `api/coach.js`'s import surface, so the Vercel preview smoke test is blocking, not optional. Run the static gates, run the Coach probe set in the runtime gate before merge, follow the gh flow in CLAUDE.md §9, and report the PR URL and merge SHA.

---

## Date / Type / Source

- **Date:** 2026-09-02
- **Type:** Feature (gated pilot) — navigation spine
- **Source:** Product conversation with Bob, 2026-09-02. Bob's framing: *"guide the user in a way that this is what you should be doing… a Sherpa bringing them along on a journey they've never been on before."* And on the name: *"Your — it's yours. Next — just one thing. Step — you don't have to have it all figured out yet."*

---

## Pre-flight discovery (scope correction)

Drafted against `main` at `1b5ae00`. What was verified in the code and the manuscript:

- **The sequence is already authored.** `src/data/myow-content.js` carries the full manuscript, and its introduction defines five sections in a deliberate order — Attitude, Personal Branding, Outreach, Interviewing, Negotiating — with the instruction *"Read it in order, at least the first time."* Part One's subtitle is *"The keel that runs under the entire journey."* This brief implements the book's structure; it does not invent one.
- **The Coach already has all of it.** `SYSTEM_PROMPT_STABLE` (`api/coach.js`) interpolates `MYOW_CONTENT`, `USER_GUIDE_CONTENT` and `COACH_NAV_MAP` into one `cache_control: ephemeral` block sent every turn. **No new corpus, no fine-tuning, no retraining.** What the Coach lacks is the person's position, which is data.
- **Every bullet on Bob's Career Club Corner slide is already a screen.** *Tell Me About Yourself* is Your Bridge Story (p6). *STAR Stories* is Your STAR Stories. *BATNA* is Offer & Negotiation. *Direct Contact* is Go-to-Market. The staircase is navigation that was drawn before the software.
- **The Attitude step has almost no product behind it, and mostly does not need any.** The staircase itself answers the confusion the book names first (*"If you are confused, call it confusion"*). What remains is KEEL surfacing at the right moment plus community, both of which this brief handles without a new screen.
- **`My Pipeline` already renders the label "My Next Steps"** at `src/App.jsx:11881`, with placeholder *"Your next step (e.g. send a follow-up note)"*. That collides with this feature's name. The column behind it has been called `next_move` since August, so the fix aligns label to schema.
- **Position is computable from data the account already holds.** `api/admin/dormant.js` already classifies accounts (`nothing_at_all`, `inputs_only`, `brand_no_playbook`) — the same signals, pointed at the admin dashboard rather than at the person in the search.
- **The docs pattern for a gated pilot exists.** `src/data/go-independent-knowledge.js` is content held deliberately out of `ORDER.json` and injected by `api/coach.js` as its own cached block only for the audience that has the feature. This brief uses that pattern. (An earlier draft proposed holding docs until GA; that reinvented a solved problem and is withdrawn.)

**Scope note.** This brief is **Move 1: the spine** — position, staircase, one next step, Coach alignment. The weekly detail (the control-versus-waiting balance read, last week's close, the two questions the product cannot see) is **Move 2** and gets its own brief once a real person has used Move 1 for a week. Shipping both at once triples the surface under test and makes a bad result impossible to attribute.

---

## Files affected

| File | Change |
|---|---|
| `src/step-position.js` | **New.** The position engine and the deterministic recommendation table |
| `src/components/Staircase.jsx` | **New.** The five-step staircase with the keel band |
| `src/data/next-step-knowledge.js` | **New.** Gated Coach knowledge for this feature |
| `api/coach.js` | Position block, authority rule, the six nuances, step-aware routing, SELFCHECK step |
| `api/_lib/feature-flags.js` | `NEXT_STEP_FLAG` + predicate + registry entry |
| `src/nav-labels.js` | `step: 'Your Next Step'` |
| `src/App.jsx` | Flag mirror, sidebar item, render case, and the pipeline label rename |

---

## Specific changes

### 1. `src/step-position.js` — one source of truth for the recommendation

Create the file. Plain `.js`, no JSX: it is imported by `api/coach.js` across the `api/*` ↔ `src/*` boundary, where `.mjs` is unsafe (CLAUDE.md §8, the 2026-05-27 outage, PR #76 reverted at `940557b`).

**This module is the whole reason the feature holds together.** The screen and the Coach must never recommend different things — a person who already does not know what to do, handed two answers, is worse off than before. So both call this, and the recommendation is **deterministic**: a rules table, no model in the loop. The model phrases things; it does not decide them.

Two exports:

```js
export function stepPosition(profileState, pursuitRows, now) // -> { step, stalled, sinceDays }
export function nextStep(profileState, pursuitRows, now)      // -> { step, action, why, target, keelLetter, stalled }
```

**Position rules.** Five steps, `1` Attitude through `5` Negotiating. Highest reached wins; the arrow never moves backwards.

| Step | Position sits here when |
|---|---|
| 1 · Attitude | Never. It is the keel, drawn as always-on. The arrow lives on steps 2–5. |
| 2 · Personal Brand | Default for any account, until Personal Brand is built **and** a direction is picked |
| 3 · Outreach | Direction picked, and nothing has reached `interviewing` |
| 4 · Interviewing | Any active opportunity at `interviewing` |
| 5 · Negotiating | Any opportunity at `offer` |

**Recommendation rules**, first match wins within the step:

| Step | Ordered rules → action |
|---|---|
| 2 | Brand not built → build Personal Brand · no direction → Career Paths · resume older than the brand → Resume Refresh · else LinkedIn Remix |
| 3 | An overdue next step → do that one · an active pursuit with no meeting booked → get the next conversation scheduled · researched Go-to-Market targets with none contacted → write to one · no opportunities at all → Go-to-Market |
| 4 | Interview Prep not built on the interviewing opportunity → build it · fewer than three STAR stories → add one · else work the panel |
| 5 | Two or more offers → Compare offers · else Offer & Negotiation |

**The stall override.** No `pursuit_status` change and no generation for 14 days: the recommendation is replaced by the keel — Career Club Corner (free, Mondays 12:00 ET) or one person to check in with — and `keelLetter` is `K`. **The step does NOT change.** Nobody gets demoted to step one for having a hard fortnight; the keel comes forward and the arrow holds its stair.

**Keel letters** otherwise: step 2 → `L` (Let the past go), step 3 → `E` (Expect the best from yourself and others), step 4 → `E` (Emotional ups and downs are natural), step 5 → `K` (Know you will find another job).

Every rule returns a human `action` (a short imperative, under 80 characters), a `why` naming the fact it came from, and a `target` step id the UI can navigate to.

### 2. `src/components/Staircase.jsx` — the picture

Five ascending steps in inline SVG, matching the diagram Career Club Corner attendees see every Monday: section name plus its bullets, an arrow pointing up at the current step, a completion check on steps already built, and the KEEL band running the full width underneath. Bullets are Bob's, verbatim: *KEEL · Resilience*, *4 C's · Tell Me About Yourself*, *Networking · Direct Contact*, *STAR Stories · Remixing*, *BATNA*.

Attitude carries **no completion check** — nobody finishes it. It is labelled as always-on.

Rules that are not negotiable:

- **No percentage, no progress bar, no estimate of how close an offer is.** The map shows preparation completed, which is honestly knowable. It never implies distance to a job.
- Steps ahead render quiet; the climb has a visible top and nobody is asked to look at it.
- On a narrow screen the staircase stacks bottom-to-top, current step open, others closed. `MOBILE_BREAKPOINT` (`src/use-is-mobile.js`) decides — do not introduce a second breakpoint.
- Font floor per CLAUDE.md §8. The file lives in `src/components/` so `check-fontsize` covers it.

### 3. `src/data/next-step-knowledge.js` — gated Coach knowledge

Same shape and same header conventions as `src/data/go-independent-knowledge.js`: deliberately **not** in `ORDER.json`, plain `.js`, imported by `api/coach.js`, injected only for flagged accounts as its own `cache_control` block. Content: what Your Next Step is, what the staircase shows, how the arrow is computed, and how the keel is woven in.

### 4. `api/coach.js` — alignment

**4a. The position block.** Compute `nextStep(...)` and render a short block into the **per-user** portion of the prompt — the dynamic profile slice, never `SYSTEM_PROMPT_STABLE`. Anything dynamic in the stable block breaks the prefix cache for every user on every turn.

**4b. The authority rule.** The single most important instruction in this brief:

> THEIR NEXT STEP (authoritative). This person is on step N of five, and their next step is "<action>", because <why>. When they ask what they should be doing, this is the answer — give it in your own voice with the reason, and do not substitute a different recommendation. If you believe something else matters more, say so out loud and say why, then offer to move their position; never quietly steer them somewhere else. If they tell you they are further along than this, they are right — say so plainly and tell them their step will move.

**4c. The six nuances.** None are inferable from the book; the model will not invent them.

1. Never state a percentage, a completion figure, or how close an offer is.
2. A stall never demotes anyone. Their step holds; the keel comes forward; K is the letter, and the Monday call is the move.
3. Attitude is never finished. Never describe it as complete or behind them.
4. One step, not a plan. Someone overwhelmed gets one thing — a five-item list is the paralysis this feature exists to remove, re-delivered in a friendlier voice.
5. The person outranks the computed position, always.
6. Never count what did not happen. Missed steps carry forward; they are not tallied back at anyone.

**4d. Step-aware framework routing.** Extend the existing `TEACH THE FRAMEWORKS` routing paragraph rather than replacing it: the same question deserves a different framework by step. *"How do I stand out?"* is 4 C's work at Personal Brand and 5 P's work at Interviewing. Covey's circles belong to Outreach, where the whole argument for direct contact is that the next move stays theirs. Frankl belongs to the weeks when nothing moves.

**4e. SELFCHECK carries the step.** Add the computed step to the existing SELFCHECK log line so off-step recommendations are measurable without new machinery. This is the alignment metric.

**4f. Quoted-book text and the voice gate.** The KEEL passage contains *"here is something worth sitting with"*, which is a HARD_PATTERN in `src/voice-patterns.mjs`. Any surface that quotes the book verbatim needs the quote handled as quoted text, not generated prose. Do not weaken the gate; do not add a voice-allow region without surfacing it first.

### 5. `api/_lib/feature-flags.js`

```js
// PILOT -- Your Next Step, 2026-09-02.
export const NEXT_STEP_FLAG = 'next_step'
export function hasNextStep(user) {
  const flags = user && Array.isArray(user.feature_flags) ? user.feature_flags : []
  return flags.includes(NEXT_STEP_FLAG)
}
```

Add `[NEXT_STEP_FLAG]: { label: 'Your Next Step' }` to `GRANTABLE_FLAGS`.

### 6. `src/nav-labels.js`

```js
  // Your Next Step (pilot 2026-09-02). Named for what it gives the person, not
  // what it costs them: theirs, one thing, and no need to have it all worked out.
  step: 'Your Next Step',
```

### 7. `src/App.jsx`

**7a.** Flag mirror beside `hasConnectorBeta` (line 7210), following that comment's shape.

**7b.** Sidebar: `...(hasPipeline&&hasNextStep?[{id:'step',label:NAV_LABELS.step,Icon:Footprints}]:[])` as the **first** item under "Your work" in both the independent and standard `primaryItems` arrays — above My Coach. It is the spine; it goes at the top. Verify the icon exists in the imported set rather than adding a dependency.

**7c.** Render case `case'step':` — the `Staircase`, then the one next step in a `CoachingCallout`-style accented block (CLAUDE.md §8 requires guidance to be visually distinct), with its `why`, a button to its `target`, and a *"I'm further along than this"* control. That control is load-bearing: without it the map can only be right.

**7d.** No other change to `src/App.jsx`. In particular the pipeline card's `My Next Steps` label is **NOT** touched here — see the note below.

---

## The one change that cannot be gated

`My Pipeline` renders the label **"My Next Steps"** at `src/App.jsx:11881`, which collides with this feature's name. That rename is real and should happen — the column behind it has been `next_move` since August, so the label finally matching the schema is an improvement on its own.

But **a feature flag cannot hide a rename.** My Pipeline is GA; the moment that label merges, all 145 accounts see it, gated pilot or not. Rendering two different names for the same field depending on a flag would be worse than either name.

So it is **out of this PR** and gets its own, approved on its own: `My Next Steps` → `Next move`, the placeholder `Your next step (e.g. send a follow-up note)` → `Your next move (e.g. send a follow-up note)`, the two explanatory paragraphs at lines 11792-11793, and the matching lines in `src/data/user-guide/my-pipeline.md`. Ship it before or after the pilot; do not ship it inside the pilot.

---

## Voice rules on inserted text

- The name gives the benefit, not the effort. "Your Climb" was rejected on exactly that ground.
- No comparative standing, no coaching register, no typology, no logic-flip cadence, no slogan-cadence closers, anywhere in the screen copy or the prompt instructions.
- Positive framing throughout: a step behind is ground covered, never a debt. The stall state opens with the keel and never with a tally.
- The staircase's claims are readbacks of the person's own work with dates. Nothing asserts anything about them.
- Guidance text uses the gold accented treatment, never a gray paragraph that reads like body copy.

## Static gates

- `npm run build` clean · `check-voice` 0/0 with the voice-allow count unchanged · `check-prompt-refs` 0 · `check-fontsize` ratchet not raised · `test-breakpoint-sync` passes.
- `check-coach-nav-map` passes with **no diff** to `src/coach-nav-map.js` — this brief adds no `FEATURE_MAP` entry while gated.
- `src/App.jsx` EOF integrity: line count and final closing tag recorded before and after every edit; git clone + Python rewrite if the Edit tool truncates.
- Diff limited to the seven files in the table.

## Runtime gate

**Preview smoke, blocking.** `npm run smoke:preview -- https://reimagine2-git-<branch>-career-club.vercel.app` — the **reimagine2** host, not `reimagine-git-*`. Both `/api/health` and `/api/claude` non-5xx.

**The Coach probe set, blocking.** On the preview, with a flagged test account, run these and confirm the Coach agrees with the arrow and teaches the right framework for the step. Seed the account to each position in turn:

| Position | Probe | Pass condition |
|---|---|---|
| Step 2 | "What should I be doing?" | Names the computed action; no menu of options |
| Step 3 | "How do I stand out?" | Routes to direct outreach and Covey, not to more applications |
| Step 3 | "I've applied to eighty jobs and heard nothing" | The RFP problem and the circle of control; never a hire-ability verdict |
| Step 4 | "How do I stand out?" | Routes to the 5 P's, not the 4 C's |
| Step 5 | "They offered me the job" | Offer & Negotiation, BATNA |
| Stalled | "Nothing is working" | KEEL and the Monday call; **does not** say they have gone backwards or lost progress |
| Any | "I'm actually interviewing next week" | Accepts it, says the step will move, does not argue |
| Any | "How far along am I?" | No percentage, no estimate of how close an offer is |

Any failure is a merge blocker.

**After merge, production:** grant `next_step` to **Bob first** and let him quality-control it before anyone else is added; then Lindsey. confirm a non-flagged account sees no rail item and cannot reach the step by URL; confirm the arrow matches real work on each account; confirm "I'm further along than this" sticks across a reload.

## Constraints

- Single PR. No effort estimates in the PR, the commits, or this brief.
- PR title: `Your Next Step: the staircase, the arrow, and one thing to do (gated pilot)`.
- Depends on `2026-09-02_coach-next-step-capture.md`.
- The recommendation is deterministic. Do not put a model in the recommendation loop in this move.

## Out of scope

- **Move 2**: the balance read, last week's close, the two questions the product cannot see. Own brief, after a week of real use.
- A commitments table. A proposed move is a next step on an opportunity; the schema already holds that.
- Any migration or change to `api/pursuit-status.js`.
- Generated prose for the recommendation itself.
- The pipeline card's "My Next Steps" rename. It reaches every account and cannot be gated, so it ships in its own PR.
- Re-colouring to Career Club's blue and orange. Reimagine's navy and gold are analogous and recognition holds — Bob to overrule if he wants an exact match to the slide.

## Commit message

```
Your Next Step: the staircase, the arrow, and one thing to do

Reimagine has twenty surfaces and a flat sidebar, which is a menu of
everything and an answer to nothing. The sequence that fixes it was already
written: Making Your Own Weather is built on five sections in a deliberate
order, and the same staircase has been on the screen at Career Club Corner
every Monday for years. This puts it under the product.

Five steps, an arrow computed from the account, and one action small enough
to do today. Attitude keeps its place as step one and carries no completion
check, because nobody finishes it -- the keel runs underneath all five, and
each step wears the KEEL letter it leans on hardest.

The recommendation is deterministic and lives in exactly one module, which
both the screen and My Coach read. That is the point: a person who does not
know what to do, handed two different answers, is worse off than before. The
Coach receives the step as authoritative, may disagree out loud, and may
never quietly steer somewhere else.

Six rules that are ours rather than the book's are written down because the
model will not invent them: no percentage ever, a stall never demotes anyone,
attitude is never finished, one step instead of a plan, the person outranks
the computed position, and nothing counts what did not happen.

Behind a per-user flag.
```

## Push

Branch, PR, `gh pr checks --watch`, preview smoke, Coach probe set, squash-merge once green. Report the PR URL and merge SHA.

## Implementer's checklist

1. Confirm the capture brief has merged. If not, STOP.
2. Pull `main`.
3. Premise-verify: the manuscript's five-section passage in `src/data/myow-content.js`; `SYSTEM_PROMPT_STABLE` and `buildCoachProfileSlice` in `api/coach.js`; `primaryItems`, the `My Next Steps` label at 11881, and `savePursuit` in `src/App.jsx`; `NAV_LABELS`; `GRANTABLE_FLAGS`; `go-independent-knowledge.js` as the injection pattern. Substance-grep, not block-existence.
4. Build `src/step-position.js` **first and alone**, with the rules table exercised at each of the five positions plus the stall, before any UI or prompt work. Everything else depends on it being right.
5. Apply the rest. Record `src/App.jsx` line count before and after.
6. Static gates, then preview smoke, then the Coach probe set.
7. Update Chapter 11 (changelog) in `Output/docs/reimagine-system-documentation/`.
8. Squash-merge. Report the PR URL, the merge SHA, and the actual output of every gate and probe.
