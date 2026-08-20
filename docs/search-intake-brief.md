# Search experience intake brief

## Context

Bob's first move with a new coaching client is to ask what's going well and what they'd like to move. Reimagine asks neither. Orientation captures who the person is — work situation, resume, values, priorities, reputation — and all of it feeds Personal Brand. Nothing captures the person's own read on their search.

The consequence is that My Coach opens cold on the most useful question in the relationship. Coach knows the person's background in depth (`buildCoachProfileSlice`, `api/coach.js`) and, for `my_search` pilot users, their live pipeline. It has no idea what the person walked in wanting to change.

This brief adds two free-text questions to Orientation, stores them as their own columns, and passes them to Coach as dated background. That is the whole feature.

**What this is deliberately not.** It is not a router — no answer opens a screen, changes a door, or picks a next step. It is not a diagnosis — nothing maps an answer onto the Five Ps or any other framework. It does not instruct Coach how to respond to any particular answer. Coach gets the context and uses its judgment, the same way it uses employment status today. Any brief that arrives with a mapping table from answers to Coach behaviors has overshot this one.

## The problem this has to solve: the answer must age

The failure mode to design against is anchoring. Someone arrives saying interviews are the thing they most want to move. Two months later they have strong STAR stories, they have practiced, they have had real feedback, and they are markedly more confident. Coach must not still be opening with "interviewing is your problem, let's work on that."

Three mechanisms, in order of how much work they do:

1. **Every field carries its own timestamp, and Coach is told the age in words.** Not "focus: interviews" but "when they started with Reimagine in March — five months ago — they said…". The model behaves very differently on a dated recollection than on a standing attribute. This is the main lever and it is nearly free.
2. **The injection softens, then stops.** Past a threshold (start at 90 days, one tunable constant) the lines drop out of the profile slice entirely. The context is worth a great deal in week one and close to nothing in month six.
3. **The person can revise it.** The Orientation screen is reachable any time from the sidebar; editing the field re-stamps that field only.

A fourth counterweight already exists for pilot users: Coach reads live pipeline data, so current reality is right there next to the stated intake. Most users are not flagged, so mechanism 1 carries the weight.

## Decisions needed before implementation

**1. Which screen — SETTLED.** Both fields belong in Orientation, on an existing screen — no eleventh step, for the friction reason that drove PR #466.

They fold into **Screen 2**, which already carries the employment-status radio for the same "where you actually are" reason. The screen is **retitled "Your Current Situation"** — it covers location, work arrangement, work situation, and search read as one coherent set, and the title stopped describing the contents the moment employment status landed there. The user-guide chapter's screen list and section heading change to match.

**2. Field wording — SETTLED.** In this order, both carrying the search as the subject:

1. **What's going well in your search right now?**
2. **What would you like to improve?**

The order is load-bearing: it opens the screen on a gain, it primes better recall for the second answer, and it gives Coach evidence of momentum rather than a lone deficit to anchor on.

The first question does the framing work for both. "Improve" on its own would point at the person, which brushes against the standing rule against framing the user's current state as deficient (CLAUDE.md §3); preceded by "in your search right now," it lands on the search, which is correct.

**That framing does not survive being separated, so it has to be re-carried anywhere the fields appear apart from each other** — most importantly in Coach's context block, where the two lines are not adjacent (see section D). A bare "what they wanted to improve" with no subject is exactly the reading to avoid.

**3. Required or optional.** Employment status on this same screen is required and blocks Continue. Recommendation: these two are **optional**, and the two rules sitting side by side with no visual difference is a deliberate choice, not an oversight. A thin or empty answer is better than a coerced one, and the person who has nothing to say yet is exactly the person for whom a forced answer would be noise.

**4. Free text over chips — settled, recorded here so it isn't relitigated.** Prose is what Coach reads best; a chip is a lossy compression of the input Coach is strongest at. It is also the consistent move for a screen that PR #466 just rebuilt around inviting richer input. The aggregation question ("what do most new users arrive wanting to move?") is answered later by classifying the stored prose server-side for analytics only — never in Coach's context. That ordering means the taxonomy can be revised in November and the whole corpus retagged, where chips would have frozen it on day one and only ever measured the options we thought of in August.

## In scope

### A. Capture — the two fields

Two textareas on the retitled **Your Current Situation** screen, below the employment-status block, labelled per Decision 2.

- `InfoTooltip` "Why we ask" on each — the honest answer: it helps My Coach start where you actually are instead of asking you to re-explain your search every session.
- `S.ta` for the inputs, `S.label` for labels, `S.helperText` for the invitation copy. Font floor applies; no ad-hoc `fontSize`.
- `SpeechBtn` on both, following the existing pattern on the Values/Passions fields. Someone talking through what's going well is the closest the product gets to the actual coaching conversation.
- Thin-answer mitigation reuses what PR #466 already built on this screen: example prompts and the mic reminder, in the richness-not-brevity register. No new mechanism, and no warning copy about short answers.
- Guidance copy gets the `CoachingCallout` treatment or equivalent, per the standing rule that instruction text is visually distinct from body and controls.

### B. Storage — two columns, not the profile blob

New migration, forward-only and idempotent, same shape as `2026-08-13_employment-status.sql`:

```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS search_going_well            text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS search_going_well_updated_at timestamptz;
ALTER TABLE users ADD COLUMN IF NOT EXISTS search_focus                 text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS search_focus_updated_at      timestamptz;
```

Column names stay copy-neutral — `search_focus` rather than `search_to_improve` — so a later wording change to the on-screen label doesn't strand a column name that no longer matches it.

**Why columns and not `profile_state`.** The profile blob is saved as a whole-object replace on a debounce (`api/profile/save.js`). A value written into the blob out-of-band — a save from a Coach panel, or any second surface added later — is silently lost when a stale tab's autosave lands after it. This is documented twice already, in the employment-status and My Search migrations. Two independent timestamps rather than one shared stamp, so revising one field does not make the other look freshly confirmed.

Migrations auto-apply on production deploy (`scripts/deploy-migrate.mjs`); shipping the file in the PR is the whole operation.

### C. Endpoint

`api/search-intake.js`, modelled directly on `api/employment.js`: POST only, origin allowlist, signed-in only, writes the caller's own row.

- Body `{ goingWell?, focus? }`. Partial update — write only the fields present, stamp only those fields' timestamps.
- Trim, strip NULs, cap length (2000 chars per field is generous for prose and bounds the Coach payload). Over-length truncates rather than rejecting.
- Empty string is a valid value: it clears the field and stamps it.
- App-owned write only. Nothing model-decided writes here, same rule as employment status.

Read path: add the four columns to the `SELECT` in `api/_lib/session.js:60` so `/api/me` carries them, and seed local state from `signedInUser` on load exactly as `employment_status` is seeded in `src/App.jsx`.

### D. Coach read

Extend `buildCoachProfileSlice` (`api/coach.js`) and the handler's profile query. The lines sit in **Anchor 1, under RAW SIGNALS** — that block is already framed as "this person's own words from orientation," which is precisely what these are.

Shape of the injected text, both fields on the same pattern. **Each line names the search as the subject** — the on-screen framing comes from the first question sitting above the second, and that adjacency is lost here (Decision 2):

> WHAT THEY SAID WAS GOING WELL IN THEIR SEARCH, at Orientation in March 2026 (5 months ago): "…"
>
> WHAT THEY SAID THEY WANTED TO IMPROVE ABOUT THEIR SEARCH, at Orientation in March 2026 (5 months ago): "…"
>
> These are their own words from when they started, not a current diagnosis and not a standing label. They describe the search, not the person. People move on; what they named then may be long since handled. Use it as background on where they came in. Do not open by returning to it, do not treat it as a settled read on their search today, and never tell them it is still their problem.

Month name and elapsed time are computed at request time from the stored timestamps. Past the staleness threshold (Decision: 90 days, one exported constant) the lines are omitted entirely.

Absent values are simply omitted — no "not provided" line, which would invite Coach to go fishing for it.

### E. Existing users

One light nudge, not a campaign. The value of an intake question is highest at intake; someone six weeks in has given Coach plenty of context already.

A single Coach message on the surfaces the employment prompt uses (`twoDoors`, `mylib`, `myCoach`, or floating-coach open), with one app-owned quick reply that navigates to the Orientation screen. Same dedupe discipline as the employment prompt: a `seen…` flag in the blob plus a session ref, yields to any prompt already pending, fires once and never again.

Note the real cost of the free-text decision, accepted knowingly: an existing user cannot answer in one tap the way they can for employment status. They have to go to a screen and type, and the completion rate will be correspondingly lower. That is the right trade for richer input on a field whose primary audience is new users.

### F. Analytics

Employment status got its own analytics PR (#392, status crossed with door usage). Add an equivalent admin panel: count answered vs unanswered, and surface the raw text for reading. At current user volume, reading the answers directly is worth more than any chart — the classifier described in Decision 4 is a later question and may never be worth building.

### G. Docs (same PR, no exceptions — CLAUDE.md §8)

- **User guide.** `src/data/user-guide/orientation.md` — the Screen 2 section and its heading, plus the numbered screen list at the top, both renamed from "Location & Work" to "Your Current Situation." Say plainly what the two questions are for and that they can be changed any time.
- **FEATURE_MAP** (`src/coach-routing.js`). Employment status is *not* in FEATURE_MAP — it's a profile fact, not a feature, and this is the same kind of thing. Recommendation: no FEATURE_MAP entry, therefore no `npm run gen:coach-nav-map` run. Recorded here as a decision rather than an omission; if it does get an entry, the regen ships in the same PR.

## Out of scope

- **Any routing.** No answer opens a screen, biases a door, or selects a nudge family.
- **Any diagnosis.** No Five Ps mapping, no per-answer Coach instructions, no "if they said X, pivot to Y."
- **Conversational capture.** Employment status has a plain-language detector that offers to save a mention (`EMPLOYMENT_MENTION_RE`, `src/components/Chat.jsx`). Prose does not admit the same clean one-tap save, and a fuzzy detector on a fuzzy field is a bad first move. The Orientation screen is reachable from the sidebar at any time; that is the revision path for now.
- **The tag classifier.** Deferred until the corpus is worth classifying.
- **Composition with pipeline data.** Coach can already see both the stated intake and the live pipeline for `my_search` users and may notice a mismatch on its own. Nothing is built to force that comparison.
- **Any new Claude call.** The capture path generates nothing. No prompt changes.

## Files this touches

| File | Change |
|---|---|
| `migrations/2026-08-2X_search-intake.sql` | new — four columns |
| `api/search-intake.js` | new — write endpoint |
| `api/_lib/session.js` | add columns to the session `SELECT` |
| `api/coach.js` | profile query + `buildCoachProfileSlice` lines + staleness constant |
| `src/App.jsx` | Orientation fields, local state, save handler, existing-user prompt |
| `api/admin/analytics.js` | new panel |
| `src/AdminDashboard.jsx` | render the panel |
| `src/data/user-guide/orientation.md` | screen list + Screen 2 section |

## Verification

- Migration applied; four columns present with expected types.
- New user: both fields save from Orientation, survive a reload, and appear in `/api/me`.
- Coach sees the values with a correct elapsed-time phrase; back-date a timestamp past the threshold and confirm the lines drop out entirely.
- Empty and over-length inputs both handled; a cleared field stamps and stays cleared.
- Existing-user prompt fires once, does not collide with the Personal Brand check-in or the employment prompt, and does not re-fire after dismissal.
- Prebuild gates pass: voice, font-size ratchet, user-guide staleness.
