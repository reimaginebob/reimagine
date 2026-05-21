# Reimagine Quick-Wins Batch — Handoff Brief

**Status:** Ready to execute.
**Repo:** github.com/reimaginebob/reimagine
**Working directory:** `C:\Users\bobgo\Documents\reimagine`
**File:** `src/App.jsx` (all changes)
**Branch:** `main` (Vercel auto-deploys on push)

---

## Goal

Ship the same-day fixes surfaced in the 2026-05-09 beta-feedback synthesis as one coordinated push. None require new architecture. Each is small. Bundling them avoids three or four trickle pushes during the beta window.

Seven changes:

1. Multi-select on work-arrangement preference
2. "Verify the contact" copy reminder at top of GTM (p7) output
3. Directed contact research in p7 prompt (check leadership pages first, cite source)
4. "Click each job for deeper analysis" hint above the first card on Wide View (p4)
5. "Download all outputs as one markdown" button on Complete page
6. Strip markdown symbols on copy-to-clipboard across output sections
7. "Verify the contact" copy reminder at top of GTM (p7) output — covered in #2

---

## Files

- `src/App.jsx` — all changes land here

---

## Changes

### Change 1: Multi-select work arrangement

**Where:** the work-arrangement field in the orientation/preferences step. Find the existing single-select control (currently a dropdown or radio group with options like Remote / Hybrid / On-site).

**What to do:** convert to a multi-select. The user should be able to pick any combination of Remote, Hybrid, and On-site. Persist the selection as an array on `profile.work_arrangement` (array of strings, in selection order). Update any prompt that reads this field to expect an array and join with " or " in the natural-language form ("you're open to Hybrid or On-site work").

**Why:** Rob and Miles both flagged the single-select as a forced choice that didn't reflect their flexibility. Same-day fix.

### Change 2: "Verify the contact" copy at top of GTM output

**Where:** the rendered output for p7 (Find Your Market / Go-To-Market). Add a single-line note above the per-company blocks.

**Copy to add:**
> *Note: contact names are surfaced from public sources and may be out of date. Verify on LinkedIn before reaching out.*

**Why:** insurance against an outreach mishap caused by stale data. Bob's own note from the synthesis. Same-day.

### Change 3: Directed contact research in p7

**Where:** the p7 prompt template inside `const P = { ... }`. Find the section that instructs the model on contact identification (currently along the lines of "search for the actual name of the person most likely to be the hiring decision-maker… check LinkedIn, company website, press releases, and news").

**Replace with:**
> "First, fetch the company's official website. Look for an About, Leadership, Team, or Our People page. Use the names and titles listed there as the source of truth for current leadership. If a hiring manager for this role isn't named on a leadership page, then expand to LinkedIn, press releases, and news. Always note where each name was sourced (website / LinkedIn / press release) so the user can verify. If no name is found from any source, write 'Contact not identified' rather than guessing."

**Source field:** add a "Source:" line to the per-company output format right after the Contact line:
```
Contact: [name and title, or "Contact not identified"]
Source: [website / LinkedIn / press release / news, with the URL or page title]
```

If the dossier-fields change (next-batch brief) is shipping in the same push, the per-company format already has Contact and Email lines; the Source line goes between them.

**Why:** lower hallucination rate by directing the model to a stable authoritative source first. Andrea, Mike, and others noted contact-identification quality varied; the existing prompt names sources generically.

### Change 4: "Click each job" hint on Wide View

**Where:** the p4 output rendering (Wide View — three lanes). Find where the first card in each lane (or the first card overall, depending on layout) is rendered.

**What to do:** above the first lane's first card, add a one-liner:

> *Click any role for a deeper read on fit, transferable strengths, and how to talk about your background for it.*

Style as a small italic helper note in the same gold accent used for the section subheaders. Show only on first render of the section, not after the user has clicked a card (use a `hasClickedAnyCard` state or similar — or just always show, fine for v1).

**Why:** Andrea: "I didn't realize you click each one for the deep analysis." One-liner removes the discovery problem.

### Change 5: "Download all outputs as markdown" on Complete page

**Where:** the Complete-screen rendering. Add a button next to the existing CSV / share affordances.

**What to do:** the button generates a single Markdown file containing every completed phase's output, in phase order, with `## Phase Name` headings between them. Use the existing `outputs` object (keys are step ids: `p1`, `p2`, `p3`, `p4`, `p5`, `p6`, `p7`, `p8`, `p_res`, `p9`, `income`). Map step ids to display names in a small lookup. Skip steps with empty output. Include the user's name and a generation date at the top. Filename: `reimagine_[firstname]_[YYYY-MM-DD].md`.

```js
const STEP_NAMES = {
  p1: 'Resume Analysis',
  p2: 'Wiring & Compass',
  p3: 'Brand Synthesis',
  p4: 'Wide View',
  p5: 'Deep Dive',
  p6: 'Bridge Story / Tell Me About Yourself',
  p7: 'Go-To-Market',
  p8: 'LinkedIn Refresh',
  p_res: 'Resume Refresh',
  p9: 'Playbook & Interview Prep & Negotiation',
  income: 'Income Now',
}

const downloadAllMarkdown = () => {
  const today = new Date().toISOString().slice(0, 10)
  const firstName = (profile.name || 'User').split(' ')[0]
  const sections = Object.entries(STEP_NAMES)
    .filter(([k]) => outputs[k] && outputs[k].trim())
    .map(([k, name]) => `## ${name}\n\n${outputs[k]}`)
    .join('\n\n---\n\n')
  const md = `# Reimagine — ${profile.name || ''}\n\n*Generated ${today}*\n\n---\n\n${sections}\n`
  const blob = new Blob([md], { type: 'text/markdown' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `reimagine_${firstName.toLowerCase()}_${today}.md`
  a.click()
  URL.revokeObjectURL(url)
}
```

**Why:** Miles requested it. Cheap and reduces share-and-export friction across the whole product.

### Change 6: Strip markdown symbols on copy-to-clipboard

**Where:** every "Copy" button across output sections. Find the existing copy handlers (search for `navigator.clipboard.writeText` or `document.execCommand('copy')`).

**What to do:** before writing to clipboard, run the source text through a markdown-stripping helper:

```js
const stripMarkdown = (text) => {
  return (text || '')
    // bold / italic
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/_(.+?)_/g, '$1')
    // inline code / code fences
    .replace(/`{3}[\s\S]*?`{3}/g, (m) => m.replace(/`/g, ''))
    .replace(/`(.+?)`/g, '$1')
    // headings
    .replace(/^#{1,6}\s+/gm, '')
    // bullet markers
    .replace(/^\s*[-*+]\s+/gm, '• ')
    .replace(/^\s*\d+\.\s+/gm, (m) => m.replace(/[-*+]/, '').trim() + ' ')
    // horizontal rules
    .replace(/^\s*[-*_]{3,}\s*$/gm, '')
    // blockquote markers
    .replace(/^>\s?/gm, '')
}
```

Apply at every copy site. Do not modify the rendered output — markdown rendering in-app stays as-is. The strip happens only on copy.

**Why:** universal pain point. Everyone copies output to send somewhere; markdown symbols look unprofessional in email or LinkedIn DMs. Same-day fix.

---

## Verification

1. `npm run build` — must succeed without errors.
2. `npm run dev`, then walk a demo session:
   - Orientation step: confirm work-arrangement is multi-select; pick two; confirm both persist after Continue and reload.
   - p4 (Wide View) output: confirm the "Click any role…" helper note shows above the first card.
   - p7 output: confirm the "verify the contact" reminder appears at the top of the section. Confirm contact blocks include a "Source:" line. Generate a fresh p7 if needed to test the prompt change.
   - p7 contact: spot-check 2–3 names — they should be sourced from leadership pages first, with Source line populated.
   - Complete page: click "Download all outputs as markdown"; confirm file downloads, opens cleanly, includes every populated section with proper headings.
   - Click "Copy" on any output section; paste into a plain-text field; confirm `**`, `#`, `-` markers are gone, bullets render as `•`.
3. `git diff src/App.jsx` — confirm changes are localized to the seven areas above.

---

## Commit message

```
Quick-wins batch from beta synthesis

- Multi-select work arrangement (was single-select)
- "Verify the contact" reminder at top of p7 output
- p7 directed contact research: leadership pages first, cite source
  for each name, "Source:" line in per-company output
- "Click each role" helper note above first card on Wide View
- "Download all outputs as markdown" button on Complete page
- Strip markdown symbols on copy-to-clipboard across all sections

Source: 2026-05-09 beta feedback synthesis (Andrea, Rob, Miles, Mike,
Bob's own notes). All low-architecture; bundled to avoid trickle pushes
during beta window.
```

---

## Push

Direct push to `main`. Vercel auto-deploys.
