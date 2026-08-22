# ATS-compliant resume variant — exploration + recommended build

## Prompt for Code

**Do not implement yet.** This is an exploration/decision brief for Bob. It assesses the need for and viability of an ATS-optimized resume variant, and proposes a build. It carries **one open product decision (surfacing model) that is Bob's to make** before Code starts. Once Bob picks the surfacing option and confirms scope, this brief will be finalized into an implementation brief (exact prompt text, schema, render changes, gates) and handed off normally. Read it as the design case, not a change set.

## Date / Type / Source

- **Date:** 2026-08-12
- **Type:** Exploration + product decision (precedes implementation)
- **Source:** Bob's follow-on to the Career Highlights facet-split work (PR #379, merged `fbecafb`). Bob: "explore the need for and viability of creating a version of the resume that is very ATS compliant and adheres to best practices for that use case." Separated from #379 deliberately (different use case; one-change-per-PR).

## The question, restated

Reimagine's current Resume Refresh (`p_res`) produces a **human-reader** artifact: a curated Career Highlights block above the fold, bolded run-objects that draw a 7-second recruiter scan, a hybrid layout tuned for the interview discussion. That is correct for the human reader. The question is whether we also need a variant tuned for the **machine reader** — the Applicant Tracking System that parses the file into fields and scores keyword match before a human ever sees it — and whether building one is viable.

Short answer: **the need is real and specific, and viability is good** — because the mechanical foundation is already most of the way there and the biggest gaps are content-level, not rendering-level.

## Pre-flight discovery (verified against current code)

Grounded in `src/App.jsx` (`buildResumeDoc` at ~1894–2099, `p_res` prompt, `formatSkills`) as of `fbecafb`:

1. **The current `.docx` is already largely ATS-parseable.** `buildResumeDoc` emits a **single-column** document with **no tables, no text boxes, no images, no header/footer content**, standard section labels (`PROFESSIONAL SUMMARY`, `CAREER HIGHLIGHTS`, `PROFESSIONAL EXPERIENCE`, `EDUCATION`, `SKILLS`), and **tab-stops** (not table cells) for right-aligned dates. Tab-stops and paragraph borders parse cleanly in every major ATS. This is the opposite of the usual ATS-killer resume (multi-column, graphics, text boxes). **The mechanical lift for ATS mode is small.**
2. **The renderer already supports a Skills section — but `p_res` never populates it.** `buildResumeDoc` renders a `SKILLS` section from `r.skills` (grouped `{category, items[]}`, line ~2075). But the `p_res` JSON schema emits only `header / summary / keyAccomplishments / experience / education` — **no `skills` array.** So the section the renderer is ready to draw is always empty in Resume Refresh output, even though the user has a **validated hard-skills inventory** (the VALIDATED HARD SKILLS block, `formatSkills(pr.skills)`), which is exactly the ATS keyword source of truth. **This is the highest-value, lowest-cost ATS gap.** (The Resume *Builder* path already emits skills via its `SKILLS.` instruction; Resume Refresh does not.)
3. **Heading vocabulary is mostly ATS-safe already.** `PROFESSIONAL SUMMARY / PROFESSIONAL EXPERIENCE / EDUCATION / SKILLS` all map to sections every ATS recognizes. The one non-standard label is **`CAREER HIGHLIGHTS`**, which an ATS will not map to a known section — though it still extracts chronology from `PROFESSIONAL EXPERIENCE` regardless, so it is a keyword-*weighting* consideration more than a parse-breaker.
4. **Font is the one mild mechanical risk.** The builder uses **Garamond**. Parseable, but ATS best practice favors a common sans-serif (Calibri, Arial). Trivial to swap in an ATS render path.
5. **Design coordination point with PR #379 (important, honest tension).** The facet-split just shipped intentionally keeps the **headline result/number** in the Highlights block and pushes **method/scope** into the body. ATS keyword scoring, by contrast, rewards target keywords appearing **in context inside dated experience entries.** These are not in conflict for *skills/domain keywords* (method/scope bullets still carry them, and an explicit Skills section covers coverage definitively), but they do pull in opposite directions on where the *punchy result* lives. The ATS variant must therefore re-prioritize keyword-in-context and lean on the Skills section, rather than inherit the human-variant's deliberate top-loading. Name this explicitly in the ATS prompt.

## Need — who, when, why

- **Who:** senior candidates applying **through a portal** (Workday, Greenhouse, iCIMS, Taleo, Lever). A large share of mid/large-company applications are parsed and keyword-scored before human review. Reimagine's users are exactly this population.
- **When:** the ATS variant matters most on a **specific-opportunity application** (there is a JD to match against) — i.e. the Live Opportunity path and any JD-scoped Resume Refresh. It matters least for networking/referral hand-offs, where the human variant is strictly better.
- **Why it is not just a reskin:** the two readers fail differently. The human variant optimizes a 7-second scan and an interview guide; the ATS optimizes field extraction and keyword recall. Bold-as-signal is invisible to the parser; a curated Highlights block does not help keyword recall; an explicit Skills section (which we omit) is one of the strongest recall levers. Serving both readers well is a genuine product capability, and telling the user *why there are two versions* is itself a trust/delight moment ("Reimagine knows there are two different readers").

## Viability — good, and cheaper than it looks

Because the render foundation is already clean (finding 1) and the schema/renderer already support skills (finding 2), an ATS variant is **mostly a prompt variant plus a small schema addition and a small render toggle**, not a new document engine. Concretely:

**Minimal-viable ATS improvements (help everyone, ATS and human):**
- Add a `skills` array to the `p_res` schema, populated from the validated inventory, grouped by category. The renderer already draws it. This alone materially improves ATS recall and costs almost nothing.

**Full ATS mode (a distinct variant):**
- A dedicated ATS prompt path (or an ATS branch inside `p_res`) with a strict ruleset:
  - **Keyword-in-context:** every target skill/keyword from the validated inventory (and, when a JD is present, from the JD) appears at least once **inside a dated experience entry**, not only in a top block.
  - **Standard section headings only:** fold/reframe `CAREER HIGHLIGHTS` into a plain-text **`SUMMARY OF QUALIFICATIONS`** (a short list an ATS reads as summary), or drop the separate block and let the Summary + Skills carry it.
  - **Explicit Skills / Core Competencies section** (from the inventory + JD keywords).
  - **Reverse-chronological** (already the case), standard date formats, spelled-out + acronym on first use of key terms ("Search Engine Optimization (SEO)") so both the human and the keyword matcher hit.
  - **No reliance on bold as the only signal** (keep bold for humans; never let meaning depend on it).
- A small **ATS render path**: common sans-serif font, standard headings, no decorative rules if they risk heading detection (low risk, but ATS mode should be conservative).

## Recommended approach

1. **Ship the minimal-viable skills addition regardless** — add `skills` to `p_res` output and let the existing renderer draw it. This is a strict improvement for every user and de-risks the bigger build. (Could even be its own small PR ahead of full ATS mode.)
2. **Then build ATS mode as a variant of the same inputs**, so the user gets both a human version and an ATS version from one generation. Same structured JSON, an `atsMode` flag that changes the prompt's phrasing rules and the render path. No new upstream inputs required — it reuses resume, validated skills, and JD context.

## The one open product decision (Bob's call): surfacing

How does the user get the ATS version? Three options:

- **A. Toggle on Resume Refresh** ("Human version / ATS version") that regenerates/renders the ATS variant, with a one-line explanation of when to use each. **(Recommended.)** Best delight/education, both versions in hand, clearest "two readers" story.
- **B. Second download button** ("Download ATS-optimized .docx") next to the current download. Lighter build, less educational, easy to miss the *why*.
- **C. Separate deliverable/section** in the playbook. Heaviest surface; probably overkill for a resume variant.

My lean is **A**, with the minimal-viable skills addition landing first (either folded in or as a fast precursor PR).

## Files affected (anticipated — finalized after the surfacing decision)

| File | Change |
|---|---|
| `src/App.jsx` (`p_res`) | Add `skills` to the output schema (min-viable); add ATS ruleset + `atsMode` branch (full). |
| `src/App.jsx` (`buildResumeDoc` / a sibling `buildAtsResumeDoc`) | ATS render path: font, headings, Highlights→Summary of Qualifications fold. Renderer already draws `skills`. |
| `src/App.jsx` (Resume Refresh UI / `downloadResumeWord`) | Surfacing per Bob's choice (toggle or second button); ATS filename suffix. |
| `src/coach-routing.js` + `src/coach-nav-map.js` | Coach catalog: the resume feature now offers a human and an ATS version. |
| `src/data/user-guide/10-your-results.md` | Explain the two versions and when to use each (keeps the Coach accurate; regenerate guide PDF + hash). |

## Docs / Coach (standing rule)

Per CLAUDE.md §8, whichever version ships updates the user guide and the My Coach catalog in the same PR, so the Coach can tell users the ATS version exists, what it does, and when to prefer it — the same "we thought this through for both readers" confidence the facet-split guide subsection now gives.

## Out of scope (for the eventual implementation)

- No JD-scraping/keyword-extraction service beyond what the JD context + validated inventory already provide (skills architecture stays LLM-only per CLAUDE.md §11).
- No ATS *score simulator* / match-percentage gauge (possible future; not this build).
- No change to the human variant's facet-split behavior from #379.
- No new upstream orientation inputs.

## Open questions for Bob

1. **Surfacing:** A (toggle, recommended), B (second download), or C (separate deliverable)?
2. **Precursor:** ship the minimal-viable Skills-section addition to the *standard* output first as a fast PR, or fold it into the ATS build?
3. **Highlights in ATS mode:** fold `CAREER HIGHLIGHTS` into a plain `SUMMARY OF QUALIFICATIONS`, or drop it and let Summary + Skills carry recall?
4. **Scope of "ATS best practices":** keep to the safe, evergreen ruleset above, or do you want specific target-ATS behaviors (e.g. Workday-specific) — noting that chasing per-vendor quirks has diminishing returns and some risk.
