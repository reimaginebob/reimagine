# Resume Refresh — Career Highlights and body bullets: headline-then-evidence (facet split + de-dup)

## Prompt for Code

Apply the changes in this brief. It adds a coordination rule to the Resume Refresh prompt (`p_res` in `src/App.jsx`) so that when an accomplishment is promoted into the top Career Highlights block, its twin under the same job in the Experience section is written as *complementary evidence* (method + scope + secondary metrics) rather than a reworded duplicate. It also updates My Coach's feature catalog and the user guide so the Coach can explain the design with confidence. Premise-verify the anchors below (the `p_res` prompt is a single long template literal on one physical line), apply the four changes, run the full gate chain, and follow the gh flow. Single PR, direct to `main`.

## Date / Type / Source

- **Date:** 2026-08-12
- **Type:** Prompt behavior + docs (user-facing)
- **Source:** Bob ↔ Cowork-Claude design conversation on the repetition problem between the curated Career Highlights block and the resume body. Design conclusion: the Highlight and its body twin should read as **headline and its evidence**, not **duplicate and reworded duplicate**. Achieved by distributing an accomplishment's *facets* (result / method / scope / secondary metrics) across the two locations, plus a de-dup guard and a single-facet fallback.

## Pre-flight discovery (scope correction)

Verified against current `src/App.jsx` (`p_res` builder, one physical line, currently line 2442):

- **Confirmed:** `p_res` returns a JSON object with `keyAccomplishments` (3–5 entries = the above-the-fold Career Highlights) and per-role `experience[].bullets`. Both use the same run-object bolding shape. Highlights additionally carry a `roleTag` (role, company, year), so each Highlight is already mapped to a specific role.
- **Confirmed the gap:** there is currently **no instruction anywhere in `p_res` governing the relationship between `keyAccomplishments` and `experience` bullets.** Nothing prevents a lightly-reworded twin of a Highlight from also appearing under its role. This is the whole subject of the change.
- **Confirmed precedent to build on:** the `summary` field already coordinates against Highlights ("No quantified figures here; the numbers live in keyAccomplishments directly below"), and there is a `BEFORE WRITING, FIND THE FORCE` block ending "the force shapes the Repositioned Summary and the selection of Key Accomplishments." So cross-field coordination is an established pattern in this prompt; this brief extends it to Highlights ↔ body.
- **Confirmed selection clause:** Highlights are `selected (${AUDIENCE_PRIORITY_CLAUSE(sel)}) from the strongest accomplishments in the resume` — i.e. already curated for the target direction. This brief does not touch selection; it governs how the selected wins are phrased in each of the two places they appear.
- **Confirmed Coach knowledge surfaces:** `api/coach.js` feeds the Coach both `USER_GUIDE_CONTENT` (compiled from `src/data/user-guide/`) and `COACH_NAV_MAP` (generated from `FEATURE_MAP` in `src/coach-routing.js` + `NAV_LABELS`). So the real depth lever for "let the Coach reassure the user" is a user-guide subsection; the `does` line is a terse signal.
- **Voice gate:** the inserted prompt/guide text was drafted to avoid all `appliesTo:['build']` HARD patterns (banned intensifiers, AI-coaching register, `rooms where/in which`, first-person meta-narration). Logic-flip / comparative-standing patterns are `runtime`-only and do not scan source, but the inserted text avoids them anyway. No new `voice-allow` region is required.

## Files affected

| File | Change |
|---|---|
| `src/App.jsx` | Insert the **CAREER HIGHLIGHTS AND THE BODY** block into the `p_res` prompt, immediately before the `JSON SCHEMA` line; enrich the two `FIELD RULES` lines (`keyAccomplishments`, `experience`) with cross-references. |
| `src/coach-routing.js` | Enrich the `resume-refresh` `FEATURE_MAP` `does` line. |
| `src/coach-nav-map.js` | Regenerated via `npm run gen:coach-nav-map` (do not hand-edit). |
| `src/data/user-guide/10-your-results.md` | Add a subsection explaining the highlight-vs-body design; add a short clause to the Resume Refresh field-guide bullet. |

## Specific changes

### Change 1 — `src/App.jsx`, `p_res`: insert the coordination block before the JSON schema

**Locate** this verbatim substring inside the `p_res` template literal (it appears once):

```
\n\nJSON SCHEMA (return exactly this shape; field types are described inline; fill with real content):\n\n{
```

**Insert** the following block immediately BEFORE that `\n\nJSON SCHEMA` (i.e. the new text ends with `\n\n` and is followed by the existing `JSON SCHEMA` line). Author it in the same escaped single-line `\n` style as the rest of the prompt:

> CAREER HIGHLIGHTS AND THE BODY: HEADLINE, THEN EVIDENCE (load-bearing).
>
> Every Career Highlight is drawn from one specific role, and that same role appears in the Experience section below. A reader scans top to bottom: they meet the Highlight first, then the role's bullets. When a Highlight and its role bullet make the same point in reworded form, the second one reads as padding. When the role bullet DEEPENS the Highlight, it reads as evidence for the claim. Build for the second.
>
> Any accomplishment separates into four facets:
> - RESULT: the headline outcome or metric (grew ARR from $2M to $8M).
> - METHOD: how it was done (rebuilt the commercial team, replaced flat pricing with a tiered model).
> - SCOPE: team size, budget, geography, or timeframe (across three regions, in eighteen months).
> - SECONDARY METRICS: the supporting proof (shortened the sales cycle 40%, lifted retention to 118%).
>
> The Career Highlight takes the punchiest facet, almost always the RESULT, compressed. The Experience bullet under that same role takes the facets the Highlight left out, usually METHOD plus SCOPE plus a secondary metric. Same accomplishment, two different true statements about it. You are distributing facets across the two locations, not writing one sentence twice.
>
> Three rules:
> 1. When an accomplishment is promoted into keyAccomplishments, its bullet under that role in experience must not lead with the same verb or restate the same headline number as its point. The Highlight owns the result. The body bullet explains how the result happened.
> 2. The Experience section stands on its own for a reader who skips the Highlights. If moving the result up top would leave a role bullet thin, write a DIFFERENT role-specific bullet in that slot rather than a reworded copy, so the role stays fully represented.
> 3. Single-facet fallback: when an accomplishment is one bare metric with no method or scope worth separating out, keep it in keyAccomplishments only and give the body a different bullet. A reworded one-fact twin is the one case where cutting beats rephrasing.
>
> WORKED EXAMPLE.
> Highlight (result-forward, compressed):
> { "runs": [ {"text": "Scaled ARR "}, {"text": "from $2M to $8M in 18 months", "bold": true}, {"text": ", the fastest growth in company history."} ], "roleTag": "VP Sales, GrowthCo, 2023" }
> Body bullet under that same GrowthCo role (method plus scope plus secondary proof, with no repeat of the $2M-to-$8M headline):
> [ {"text": "Rebuilt a six-person commercial team and replaced flat pricing with a three-tier model, "}, {"text": "shortening the average sales cycle 40%", "bold": true}, {"text": " and "}, {"text": "lifting net revenue retention to 118%", "bold": true}, {"text": "."} ]
> Same achievement. No repeated phrasing. The body bullet substantiates the Highlight instead of echoing it.

Note for Code: render the block as `\n\n`-joined lines matching the surrounding style. The two JSON snippets in the worked example double as correct demonstrations of the run-object shape and the two-bold rule, so keep them intact.

### Change 2 — `src/App.jsx`, `p_res`: enrich the two FIELD RULES lines

**Locate** this verbatim substring (inside the same template literal, in the `FIELD RULES:` block):

```
- keyAccomplishments: 3 to 5 entries, selected (${AUDIENCE_PRIORITY_CLAUSE(sel)}) from the strongest accomplishments in the resume. Each is one short bullet. Above the fold, between Summary and Work History. Serves as the discussion guide for the interview.
```

**Append** to the end of that line (before its trailing `\n`):

> Each Highlight is the compressed, result-forward version of its accomplishment; the fuller mechanism lives in that role's experience bullets (see CAREER HIGHLIGHTS AND THE BODY above).

**Locate** this verbatim substring (the next FIELD RULES line):

```
- experience: chronological, most recent first. 3 to 6 bullets per role. Roles older than 10 years can be summarized to one role-line plus a single bullet if relevant.
```

**Append** to the end of that line (before its trailing `\n`):

> Where a role also supplied a Career Highlight above, its bullets carry the facets the Highlight left out (method, scope, secondary metrics), not a reworded copy of the Highlight (see CAREER HIGHLIGHTS AND THE BODY above).

### Change 3 — `src/coach-routing.js`: enrich the Resume Refresh `does` line

**Locate:**

```js
  { slug: 'resume-refresh',       reach: 'focus-gated', labelId: 'p_res',
    does: 'repoints the resume at a chosen direction' },
```

**Replace the `does` string** with:

```js
  { slug: 'resume-refresh',       reach: 'focus-gated', labelId: 'p_res',
    does: 'repoints the resume at a chosen direction; the top Career Highlights and the body bullets are written to complement, not repeat, each other' },
```

Then run `npm run gen:coach-nav-map` so `src/coach-nav-map.js` regenerates. The prebuild `check-coach-nav-map.mjs` gate will fail if it is left stale.

### Change 4 — `src/data/user-guide/10-your-results.md`: explain the design

**4a.** In the "How to use what is here" list, **locate** the Resume Refresh bullet:

```
- **Resume Refresh**. Open your resume document and apply the changes. The summary, the career highlights, the role expansion and compression guidance.
```

**Replace** it with:

```
- **Resume Refresh**. Open your resume document and apply the changes. The summary, the career highlights, the role expansion and compression guidance. Your strongest wins appear both in the Career Highlights block up top and under the jobs where they happened, written from two different angles so they read as evidence rather than repetition (see below).
```

**4b.** **Insert** the following new subsection immediately AFTER the "How to use what is here" list (after the Income Now bullet on current line 61) and BEFORE `## Your progress is saved across devices`:

```
## Your Career Highlights and your resume body work together

Your three to five strongest wins sit in a Career Highlights block at the top of the resume, chosen for the direction you are targeting. Those same wins also belong under the jobs where they happened. Reimagine does not repeat them word for word in both places, and that is deliberate.

A hiring manager reads top to bottom. They meet the Highlight first, then the role below it. If the two said the same thing twice, the second reading would feel like filler. So the Highlight up top carries the headline result in its most compressed form, and the bullet under the job carries the part the Highlight left out: how you did it, the scope you did it at, and the supporting numbers. Same accomplishment, seen from two angles. The version under the job becomes the evidence for the claim at the top, which is exactly what a careful reader is looking for.

When a win is a single number with no story behind it, Reimagine keeps it in the Career Highlights only and gives the job a different bullet, so nothing reads as a reworded copy. The result is a resume that rewards a second read instead of repeating itself.
```

## Voice rules on inserted text

- No banned intensifiers (truly/genuinely/absolutely/incredibly/very/really), no AI-coaching register, no `rooms where/in which`, no first-person meta-narration. Build-scoped HARD patterns will not fire.
- No logic-flip ("not X, it is Y" / "you do not just X, you Y"), no comparative-standing ("most people", "where others"), no em dashes. The guide subsection uses "does not repeat … and that is deliberate" and "seen from two angles", which are outside every banned family.
- Guide copy leads with the human benefit (a resume that rewards a second read) before the mechanism — consistent with the voice principles.

## Static gates

- `npm run build` clean (this runs the full prebuild chain: `build-user-guide`, `check-voice`, `check-sys-equality`, `check-prompt-refs`, `check-coach-nav-map`, `check-orphans`, `check-fontsize`, `check-user-guide-pdf`, `test`, `lint`).
- `check-voice` 0/0.
- `check-coach-nav-map` passes (requires `npm run gen:coach-nav-map` after Change 3).
- **`check-user-guide-pdf` gate:** editing `10-your-results.md` changes the guide, so the committed PDF hash will be stale and this gate will fail unless the PDF is rebuilt. Run `npm run build:user-guide-pdf` (needs the installed Python 3.12 arm64 at `AppData\Local\Programs\Python\Python312-arm64` — see the "Python runtime for the PDF build" memory) and commit the regenerated PDF + hash. If the PDF toolchain is unavailable in the session, STOP and surface to Bob rather than shipping with a stale/failing gate.
- `App.jsx` EOF integrity preserved (line count + final closing brace/tag unchanged apart from the inserted prompt text). The `p_res` edit is inside an existing template literal on one physical line; verify the physical line still opens and closes cleanly and the file still ends intact.
- Diff scope limited to the four named files plus the two generated artifacts (`coach-nav-map.js`, the user-guide PDF/hash + compiled `user-guide-content.js`).

## Runtime gate (post-merge)

Validate with a real generation per the "Validate Reimagine prompt changes with a real gen" memory: POST a built `p_res` prompt to `/api/claude` on the Vercel deploy (Origin spoof + bypass token), using demoData Sarah Chen. Confirm in the returned JSON that at least one `keyAccomplishments` entry maps by `roleTag` to a role in `experience`, and that role's bullets do **not** restate the Highlight's headline verb/number — they carry method/scope/secondary metrics instead. Spot-check the single-facet fallback: a lone-metric win should not appear as a reworded twin under its role.

## Constraints

- Single PR. No effort estimates. PR title: `Resume Refresh: Career Highlights and body bullets as headline-then-evidence (facet split + de-dup)`.
- Batch-during-beta: this ships as part of the current queued batch, not as a standalone hot-push, unless Bob says otherwise.

## Out of scope

- No change to Highlight **selection** (`AUDIENCE_PRIORITY_CLAUSE`), count (3–5), ordering, or the bolding rules.
- No change to `buildResumeDoc` / `.docx` rendering (the runs+roleTag shape is unchanged; only the phrasing the model chooses changes).
- No change to the Resume Builder plain path (`RESUME_PARSE` and siblings) or the Live Opportunity Resume Refresh variant beyond what shipping `p_res` naturally carries.
- No schema change.

## Commit message

```
Resume Refresh: Career Highlights and body bullets as headline-then-evidence

Adds a coordination rule to the p_res prompt so a win promoted into the
above-the-fold Career Highlights block is not reworded verbatim under its
job. The Highlight carries the compressed result; the body bullet carries
the facets it left out (method, scope, secondary metrics), so the body
reads as evidence for the Highlight rather than a duplicate. Includes a
de-dup guard (no shared lead verb / headline number) and a single-facet
fallback (lone-metric wins stay in Highlights only; the body gets a
different bullet).

Updates the My Coach feature catalog and user guide chapter 10 so the
Coach can explain the design to users with confidence.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
```

## Push

Direct to `main`; Vercel auto-deploys.

## Implementer's checklist

1. `git fetch` origin; sync working copy to `origin/main` (stash CLAUDE.md if dirty per the standing memory).
2. Premise-verify: grep the four verbatim anchors (Change 1 `JSON SCHEMA` line; Change 2 the two FIELD RULES lines; Change 3 the `resume-refresh` FEATURE_MAP entry; Change 4 the Resume Refresh guide bullet). If any has drifted, STOP and surface.
3. Apply Changes 1–4.
4. `npm run gen:coach-nav-map`.
5. `npm run build:user-guide-pdf` (regenerate guide PDF + hash) — if the Python toolchain is unavailable, STOP and surface.
6. `npm run build` — confirm the full gate chain is clean, `check-voice` 0/0, `check-coach-nav-map` and `check-user-guide-pdf` pass.
7. Update the changelog (Ch. 11 of the system documentation) with a one-line entry.
8. Push branch, open PR with the title above, watch CI green, squash-merge.
9. Report PR URL + merge SHA. Optionally run the post-merge real-gen validation.
