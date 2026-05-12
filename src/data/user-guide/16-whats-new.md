# 16. What's New in This Build

This chapter is a living changelog. When Reimagine ships a batch of changes that meaningfully affect how you use the tool, the changes get summarized here.

If a release is small or affects only the prompts behind the scenes, it may not show up here at all. The point of this chapter is to flag the changes that would surprise a returning user.

## Current build. May 2026

Substantial updates shipped between April 28 and May 11. Returning users will see a more polished tool, a sharper AI voice, new ways to correct mistakes, cross-device sign-in, and a brand new post-Complete module for working a specific opportunity.

### Sign-in and cross-device persistence

- **Email sign-in via magic link, with a two-step form.** Step one asks only for your email. If you are returning, the sign-in link gets sent right away. If you are new, a second step asks for your first and last name before sending the link. Either way, click the link, you are in. No password to remember.
- **Sliding 30-day sessions.** Your sign-in lasts 30 days and refreshes every time you use the tool. Active users essentially never see the sign-in screen again after their first visit. The session only expires if you go a full 30 days without opening Reimagine.
- **Cross-device persistence.** Your work syncs across devices automatically once you sign in. Start on a laptop, finish on a phone, no copy-paste or manual export.
- **Migration prompt for existing users.** If you already had progress saved in your browser before this update, you will see a one-time prompt offering to save your work across devices. Accept and your local progress uploads to your new account. Decline and the tool keeps using browser-local storage exactly as before.

### AI voice and accuracy

- **Less flattery, more honesty.** The system prompt was tightened to stop the AI from rounding up tenure ("nearly 3 years" when it was 2.5), promoting job titles, calling small teams "organizations," or any other inflation move.
- **Interpretive calls are flagged inline.** When the AI makes a judgment about your background ("reading your time at X as consulting"), it now says so explicitly so you can correct it before that read cascades into every downstream section.
- **Empty cards no longer slip through.** If the Wide View output drops cards due to a generation glitch, the tool now auto-retries once and shows a regenerate button if the retry also fails. No more silent empty sections.
- **Several sections were stretching past their length limit and cutting off mid-sentence.** All sections audited; affected ones bumped to fit the longest realistic output.

### The correction loop

- **The feedback box was reframed.** Below every generated section, the refine box is now labeled for factual corrections, not just stylistic adjustments. Example: "You said I worked at MoneyGram as a consultant, but that was internal strategy."
- **Corrections now persist across the whole session.** When you submit a correction on Section A, it gets saved to your profile permanently. Every later section reads from that corrections list, so the wrong assumption stops cascading. You no longer need to make the same correction repeatedly.

### Wide View (Phase 2): the three paths

- **Familiar Ground now serves two cases explicitly.** Case A is the same function in the same or adjacent industry (where you have been). Case B is the same nature of work in a different industry (where your skills travel to a new context). Both appear in every output, labeled clearly.
- **Work That Matters now pushes harder for non-obvious options.** At least two options per output are marked "non-obvious," meaning roles you would not list on your own if asked.
- **The Wide View cards now show a hint** that you can click any role for a deeper read. Several beta users missed this in earlier builds.

### Go-to-Market (Phase 4): richer company detail

- **Each target company now includes four research fields.** What they do, Industry, Size, and HQ. The list now doubles as research material, not just an outreach roster.
- **The CSV download captures the new fields too.** Nine columns: Company, What they do, Industry, Size, HQ, Why it fits, Growth signal, Contact, Email.
- **Contact identification cites sources.** Each hiring contact now includes a Source line (website / LinkedIn / press release / news) so you can verify before reaching out.
- **A "verify the contact" reminder** appears at the top of every Go-to-Market output as a sanity check.

### Orientation polish

- **Country field is now a dropdown.** Type the first few letters and an autocomplete list of common countries appears. Free text still accepted.
- **Sidebar navigation works in both directions.** You can click back to a prior step you have already visited, not just forward through Continue.
- **Progress bar hits 100%.** When you reach Complete, the bar shows 100%. Income Now is bonus content beyond the main flow and does not pull the bar down.
- **Income Now completion now shows a checkmark.** When you generate the Income Now plan, the sidebar mark updates the same way it does for every other completed step.
- **A brief "Orientation complete" celebration card** appears between Reputation and Resume Analysis to mark the phase transition.
- **Loading screens now show a preview of what is coming.** While a section generates, a short "while you wait" bullet list describes what the AI is producing.

### Phrasing and copy

- **Step-scoped quotes from Making Your Own Weather** rotate on loading screens, matched to whichever phase you are in.
- **Strip markdown on copy.** When you click any "Copy" button, the output pastes cleanly into email or LinkedIn without `**` or `#` symbols.
- **Multi-select on work arrangement.** Pick any combination of Remote, Hybrid, and On-site if you are open to more than one.
- **"Click each role for a deeper read" hint** above the first card in Wide View, so you know the cards are clickable.
- **"Download all outputs as one markdown file"** button on the Complete page.

### New module. Upload a Live Opportunity

After you finish the main journey, a new entry appears in the sidebar: **Upload a Live Opportunity**. When a specific role catches your eye (through your network, on LinkedIn, in a posting you found yourself), bring the job description here. Paste the text or upload a PDF.

Reimagine combines the posting with everything you have already built and produces a tailored playbook for that specific role: how it aligns with your chosen path, where it stretches you, what the hiring manager is solving for, your STAR stories remixed for this opportunity, how to get past the screening interview, likely objections and rebuttals, a draft 90-day plan, high-value questions to ask, a Bridge Story variant, and a cover letter draft.

This module is the most natural reason to come back to Reimagine during a search. Every real role you consider can get its own playbook. See Chapter 11b for the full walkthrough.

### Other improvements behind the scenes

- **Corrections you submit are logged centrally** so the team can learn which prompts misread which user inputs and tighten them over time.
- **Documentation alignment.** This guide now stays current with the live tool. When new behavior ships, the relevant chapter gets updated alongside the code change.

## Known limits in this build

- **Multi-JD library is not yet built.** The Upload a Live Opportunity module holds one playbook at a time. Pasting a new JD overwrites the previous playbook. A library that holds many is on the roadmap.
- **PDF upload for the live opportunity is supported. Word docs are not.** Paste the text if you have a Word doc.
- **No mobile-optimized layout.** The tool is usable on tablets and phones but designed for laptop-sized screens.
- **One assessment type label.** The Assessment Type dropdown labels one type at a time. To use multiple assessments, paste them into the text field with divider lines.

---

*This guide and the tool both evolve together now. If you are reading this and the version of Reimagine you are using does not match what is described here, email [bob@career.club](mailto:bob@career.club).*
