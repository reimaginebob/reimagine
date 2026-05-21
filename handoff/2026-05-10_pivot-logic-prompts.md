# Reimagine Pivot Logic — Handoff Brief

**Status:** Ready to execute. Ships standalone; no dependencies on the correction loop or voice pass beyond not interfering with their output. **Repo:** github.com/reimaginebob/reimagine **Working directory:** `C:\Users\bobgo\Documents\reimagine` **Branch:** `main` (Vercel auto-deploys on push)

---

## Goal

Pivot is the product's core thesis. Three lanes on the Wide View page promise distinct things; today, two of the three drift away from what their names imply.

**Familiar Ground today** says "same function, same or adjacent industry." This pulls toward same-industry results and shuts out a meaningful case: similar work in a different industry. Rob's beta feedback named exactly this gap — he wanted companies that need similar Category and Strategy work in industries beyond his current one, and Familiar Ground today does not serve him.

**Work That Matters today** says "may stretch beyond your current title" but does not push hard enough on stripping title and industry from the inference. The model drifts back to the user's resume vocabulary, which collapses the lane onto the same career arc as the other two. Koonal, Miles, and Bob's Chewy-clustering observation all surface this.

**Industry Insider works as designed.** No changes.

This brief rewrites two prompt sections plus their corresponding lane definitions in the system prompt. Pure prompt-engineering. No schema, no UI, no API changes.

---

## Files

- `claude.js` — server-side SYS prompt, THREE PATHS section (the lane definitions Reimagine sends with every request)  
- `src/App.jsx` — the `P.p4` prompt template, Familiar Ground and Work That Matters sections  
- `src/App.jsx` — the dead local SYS prompt (around line 43–47), update for consistency though it has no production effect (Code verified this on 2026-05-10)

---

## Pre-step

```shell
cd C:\Users\bobgo\Documents\reimagine
git pull origin main
wc -l src/App.jsx          # baseline line count
```

If the working tree is dirty, stop and tell Bob.

---

## Changes

### Change 1: SYS prompt THREE PATHS rewrite (`claude.js`)

**Where:** the THREE PATHS section in `claude.js` SYS. Currently defines FAMILIAR GROUND, THE INDUSTRY INSIDER, and WORK THAT MATTERS each as a single sentence or short paragraph.

**Replace the THREE PATHS block** with this exact text:

```
THREE PATHS:
FAMILIAR GROUND serves two distinct cases, and you should generate options for both:

Case A, Same function and industry: Builds directly on where they have been, same function, same or adjacent industry. Track record speaks most immediately. Show where targeted upskilling or emerging capabilities make them the forward-looking candidate.

Case B, Same nature of work, different industry: The work itself is the constant; the industry varies. The user takes the same capability they have built (Category Strategy, Revenue Operations, Clinical Operations, Brand Building) into a different sector that needs that capability. The user keeps doing the work they are good at, in a context where it matters in a new way. Examples: a B2B SaaS sales leader moves to industrial manufacturing where digital go-to-market is just emerging. A pharma marketing leader moves to a fintech that needs regulated-industry brand discipline. A healthcare ops leader moves to logistics where ops rigor is undervalued.

Every Familiar Ground response must include both cases. Do not skip Case B. The user can self-select which case fits them; your job is to make both visible.

THE INDUSTRY INSIDER: Industry expertise is the primary asset. Map the full ecosystem: clients, vendors, consultants, upstream/downstream players, trade associations, educators, regulators, adjacent industries. The insider advantage is real: understanding how an industry thinks, what problems keep leaders up at night, and how decisions get made is a competitive edge whether moving to a vendor, a consultant, a regulator, or an adjacent player. Rank the strongest combinations of market need and candidate evidence highest.

WORK THAT MATTERS (Ikigai): The intersection of what they love, what they are good at, what the world needs, and what they can be paid for. Most applicable for people ready for more meaning in their work, or at a career stage where legacy matters more than maximizing compensation. Could mean consulting, fractional leadership, a role that does not exist yet, or something entirely their own. In output, use "Work That Matters" as the section header, and explain that it is built on the Ikigai framework.

Generation rules for Work That Matters:

1. Strip current title and current industry. Do not let them seed the options. The user's current job title is irrelevant in this lane. Their current industry is irrelevant unless their passion explicitly lives there.

2. Generate from capabilities, values, passions, and life themes. Read what the user is good at (extracted from their accomplishments and wiring), what they care about (values and passions), and what shows up across their life as a pattern (mentoring, building, teaching, advocating, designing). The lane sits at the intersection of those, not at the intersection of "their job plus their hobby."

3. Reach for non-obvious vehicles. W-2 is the default; do not default to it. Consulting, fractional leadership, advisory work, board seats, founding something, joining something at the ground floor, acquiring something existing, teaching, writing, speaking — all in scope. Choose the vehicle that fits the work, not the resume.

4. At least two of the options must be ones the user would not generate themselves. The test: would the user, looking at their own resume, list this as a possibility? If yes, it does not belong here. If no, it belongs here. The lane exists to surface roles the user has not seen for themselves.

5. Refuse resume vocabulary when naming roles. If the user is a "VP of Sales," do not generate "Chief Revenue Officer at a Faith-Based Platform" as a Work That Matters option unless the underlying capabilities and passions clearly drive that role. The role name should follow from the capabilities, not from the title trajectory.
```

### Change 2: `P.p4` prompt rewrite — Familiar Ground and Work That Matters sections (`src/App.jsx`)

**Where:** the `P.p4` template in `src/App.jsx` (around line 139). Find the `## FAMILIAR GROUND` and `## WORK THAT MATTERS` blocks within the template literal.

**Replace the `## FAMILIAR GROUND` block** with this exact text:

```
## FAMILIAR GROUND
Start with a bolded one-paragraph explanation: This path serves two distinct cases. Case A, the same function in the same or adjacent industry, where your track record speaks most immediately. Case B, the same nature of work in a different industry, where the capability you have built becomes a fresh perspective in a sector that needs it. Both are Familiar Ground. The work is what you keep doing; the question is in what context.

Generate options for BOTH cases. Do not weight one over the other unless the user's profile makes one case clearly stronger than the other (for example, a deeply industry-specific regulatory expert may have only Case A options; a generalist operator may have mostly Case B options). Default to a roughly even split.

For Case A options, label them with **Case A: Same function, same or adjacent industry.**
For Case B options, label them with **Case B: Same nature of work, different industry.**

Within each case, for each option, two sections:
**Why you are already credible:** Build the case from their actual track record. For Case A, name the direct experience that makes them a strong candidate right now. For Case B, name the underlying capability and explain specifically how it translates to the new industry context. Start from strength.
**What closes the gap:** What do they need to add, learn, or demonstrate? For Case A, be specific about credentials, tools, or portfolio pieces. For Case B, be specific about industry context they would need to absorb (the language of the new sector, key players, common problems). Rank by (1) highest impact, (2) achievable in 30-90 days, (3) achievable this week. If they already have everything they need, say so. Do not invent gaps.
```

**Replace the `## WORK THAT MATTERS` block** with this exact text:

```
## WORK THAT MATTERS
Start with a bolded one-paragraph explanation: This path is built on the Japanese concept of Ikigai: the intersection of what you love, what you are good at, what the world needs, and what you can be paid for. It is for people ready for more meaning in their work, or at a career stage where legacy matters more than maximizing compensation. These options are deliberately stripped of your current title and industry. They are grounded in your capabilities, values, passions, and life themes, not in where you happen to be sitting today.

Generation rules for this section, follow them literally:

1. Strip the user's current title and current industry from the option-generation. Do not let either seed the role names. If the user is a VP of Sales, the lane should not produce "Chief Revenue Officer" titles unless the underlying capabilities and passions clearly drive that role.

2. Generate from capabilities, values, passions, and life themes. Read across their full profile: accomplishments, wiring, what they care about, and any patterns visible across work and life (mentoring, building, teaching, advocating, designing, organizing, repairing, investigating). The intersection of those is the lane, not the intersection of "their job plus their hobby."

3. Reach for non-obvious vehicles. W-2 is the default; do not default to it. Consulting, fractional leadership, advisory work, board seats, founding something, joining something at the ground floor, acquiring something existing (entrepreneurship through acquisition), teaching, writing, speaking, franchising — all in scope. Choose the vehicle that fits the work, not the one that fits their resume trajectory.

4. At least two of the options must be ones the user would not generate themselves. The test: would the user, looking at their own resume, list this as a possibility? If yes, it does not belong here. If no, it belongs here. The lane exists to surface roles the user has not seen for themselves.

5. Refuse resume vocabulary when naming roles. The role name should follow from the capabilities and passions, not from the title trajectory.

For each option:
- Title/Role (named from capabilities and passions, not from the user's current title)
- Vehicle (W-2, consulting, fractional, advisory, entrepreneurship, entrepreneurship through acquisition, franchising, teaching, writing/speaking, board seat)
- 3-4 sentence rationale grounded in specific evidence from their profile. Cite the capabilities, values, or passions that drive the option. Push beyond the obvious. Name the through-line that makes this option theirs and not someone else's.

Mark which options are non-obvious by ending their rationale with "(non-obvious option)." Aim for at least two of these per Work That Matters lane.
```

### Change 3 (consistency): App.jsx local SYS prompt (`src/App.jsx`)

**Where:** the SYS prompt embedded in `src/App.jsx` around line 43–47 (the THREE PATHS block).

**What to do:** mirror the same THREE PATHS rewrite from Change 1\.

**Why:** Code verified on 2026-05-10 that this SYS is dead in production (the server-side claude.js SYS overrides it). Updating it has zero production effect. But keeping the two SYS prompts diverged invites confusion in future debugging and code review. Apply the change for consistency.

If you discover this SYS is being used in some path I missed, surface that finding rather than auto-mirroring; the divergence may be intentional.

---

## Verification

1. `npm run build` — must succeed.  
     
2. **Familiar Ground test (Case B):**  
     
   - Run a generation against the demo profile (Sarah Chen) through to p4.  
   - Inspect the Familiar Ground section. Confirm the section now contains options labeled both **Case A** and **Case B**.  
   - Confirm at least one Case B option actually moves to a different industry while keeping the function constant.  
   - Repeat against the test profile in `src/testData.js`.

   

3. **Work That Matters test:**  
     
   - In the same generations above, inspect the Work That Matters section.  
   - Confirm at least two options are marked "(non-obvious option)."  
   - Read each non-obvious option and apply the test: would the user, looking at their own resume, generate this themselves? If yes, the prompt isn't pushing hard enough — flag it for further tightening.  
   - Confirm the role names are not just rephrased versions of the user's current title or a step up from it.  
   - Confirm the vehicles include at least one beyond W-2 (consulting, fractional, advisory, founding, acquisition, teaching, etc.) — not as a token, but as a fit for the option.

   

4. **Industry Insider sanity check:**  
     
   - Confirm Industry Insider output looks unchanged in shape and tone. We are not modifying this lane and any drift would be regression.

   

5. **Voice audit:**  
     
   - The new prompt text follows the existing voice rules (no em dashes, no AI words, no logic-flip cadence, no intensifiers). Scan the rewrite text before pushing.

   

6. `git diff` — confirm changes are localized to `claude.js` (THREE PATHS rewrite) and `src/App.jsx` (P.p4 rewrites \+ dead SYS for consistency). No unrelated edits.  
     
7. `wc -l src/App.jsx` — compare to baseline \+ expected delta. Check the last 200 bytes end with proper closing tags.

---

## Report-back conditions

If you hit any of these during execution, surface them before pushing rather than working around silently:

- The `claude.js` THREE PATHS section reads materially different from what this brief assumes (refactored, moved, or already changed).  
- The `P.p4` template structure has changed enough that the `## FAMILIAR GROUND` and `## WORK THAT MATTERS` blocks no longer exist as discrete sections.  
- The dead App.jsx SYS turns out to be live in some code path you find while editing it.  
- A Familiar Ground or Work That Matters generation against the demo profile produces visibly worse output than today (regression in coherence, specificity, or relevance).

In any of those cases, stop and report. Bob would rather answer a clarifying question than have a bad commit on main.

---

## What this brief does not address

- **Capability-first generation pass.** The synthesis named this as "consider pulling into V2" — extracting capabilities from p1/p3 outputs and feeding them as the seed into the lane prompts. This brief does not include that work; the prompt rewrites here address the immediate complaint within the existing prompt-only architecture. If the rewrites do not fully fix the lane behavior in the next round of beta feedback, the capability-first pass becomes the next brief. Holding it in the backlog keeps the V2 guardrails clean (the underlying-drivers doc says don't pre-build capability-first work).  
- **Lane filter / power-user toggle.** The "exclude this industry / function" toggle is post-V2 and only worth building once the lane prompts deliver what their names promise. This brief is the first half of that work; the toggle is post-V2.  
- **Industry Insider changes.** Out of scope. Lane works as designed.

---

## Commit message

```
Pivot logic prompt revisions: Familiar Ground serves two cases,
Work That Matters strips current title and industry

Two of the three Wide View lanes were drifting away from what their
names promise. Rob's beta feedback named the Familiar Ground gap
explicitly (similar work, different industry was not represented).
Koonal, Miles, and Bob's Chewy-clustering observation surfaced the
Work That Matters drift back to resume vocabulary.

claude.js SYS THREE PATHS:
- Familiar Ground rewritten to explicitly serve Case A (same function,
  same/adjacent industry) and Case B (same nature of work, different
  industry). Both required in every output.
- Work That Matters rewritten with five literal generation rules:
  strip current title and industry, generate from capabilities/values/
  passions/life themes, reach for non-obvious vehicles, at least two
  options the user would not generate themselves, refuse resume
  vocabulary in role names.
- Industry Insider unchanged (works as designed).

src/App.jsx P.p4:
- Familiar Ground section now generates Case A and Case B options,
  labeled distinctly, with case-specific guidance for credibility and
  gap-closing.
- Work That Matters section now carries the five generation rules
  inline and requires at least two options marked "(non-obvious
  option)."

Local App.jsx SYS THREE PATHS mirrored for consistency (dead in
production per claude.js override; updated to keep the two from
drifting in code review).

Source: 2026-05-09 beta feedback synthesis Theme E1. Capability-first
generation pass remains in backlog as scoped.
```

---

## Push

Direct push to `main`. Vercel auto-deploys. The first three real-user p4 generations after deploy are the canary — read them for whether the Familiar Ground Case B options materialize and whether Work That Matters reaches for genuinely non-obvious roles.  
