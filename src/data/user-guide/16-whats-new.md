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

### Inline help across the journey

A comprehensive pass adding short coaching blocks at the moments where users benefit from a small nudge or a more thoughtful framing.

- **Phase 0 (Orientation):** a "Take your time" callout on the Welcome screen and a "Good stopping point" note on the phase transition card. Coaching callouts on the Resume, Assessment, Values, and Reputation input steps to help you put in the kind of material that produces strong output. The Reputation step gets a Good/Better worked example for "The Memory" and a collapsible list of where to find source material (old reviews, LinkedIn recommendations, 360 feedback). A small InfoTooltip on the Country field explains why location matters.
- **Phase 1 (Know Your Value):** brief milestone cards on first arrival at Wiring & Compass ("Phase 1, where the pieces integrate") and Brand Synthesis ("Phase 1, where you find the language"). These are interstitials that build anticipation for what is often the most revealing part of the journey, then resolve to the output. Shown once per user; later visits skip straight to the output. A one-time "What did we get wrong?" callout above the first generated output (Resume Analysis) explains that the correction box accepts factual corrections and cascades them across every later section.
- **Phase 2 (Explore Options):** a "How this works" intro card on the Wide View entry explains the three paths in concept before the role cards load. A persistent "Selected: N of 3" banner appears on the role-cards screen so you always know where you are. A chevron on each role card signals clickability. Familiar Ground role cards are now grouped under two clearly named sub-paths: **Same Role, Same Industry** and **Similar Role, Different Industry**. The Deep Dive gets a "Three reads to compare" framing. **Your Decision is renamed Your Focus**, with a three-question framework to help you choose when all three options feel viable, and an explicit reassurance that you are not locking it in; you can come back and choose again.
- **Phase 3 (Tell Your Story):** a "Learn the structure, then make it yours" callout above the generated Bridge Story so you internalize the three pieces rather than memorizing the script.
- **Phase 4 (Find Your Market):** a new framing card on the entry screen, "A brand new lane to pursue," makes the case for direct outreach as the path of agency before you generate. Above the outreach template inside the output, a "Why reach out before there is a posting?" callout reinforces the same point at the moment of action.
- **Phase 5 (Get Ready):** a "How to use this playbook" callout above Your Playbook output naming the three parts (Crash Course, Interview Prep, STAR Stories) and how each is used. A dedicated framing card above the STAR Stories section captures the principle of remixing: three core tracks, every interview a different set, practice the structure, not the words. Small italic disclaimers under LinkedIn Remix and Resume Refresh outputs clarify that Reimagine does not modify your actual profile or resume file; you apply the changes yourself.
- **Complete:** a major rebuild. The page now opens with "You finished the foundation" and three CTAs: Upload a Live Opportunity (for a specific role), Career Club's weekly group coaching call (free, every Monday at 12:00 ET, with a registration link), and *Making Your Own Weather* by Bob Goodwin (the methodology book this is all built on). A small note below points to Income Now.
- **Upload a Live Opportunity:** a "What to bring" coaching block on the input side encourages you to paste the full posting plus your own context about the role. A "How to use this playbook" callout above the output groups the thirteen sections into three buckets (Understanding the role, Preparing for the conversation, The deliverables) so you can scan to what you need.
- **Income Now:** the framing has been substantially expanded. Beyond bridge income, the module is also a foot in the door for permanent roles at the same company, a path some people did not see coming, and a credential-builder for the full-time role you originally wanted. The entry screen opens with the empathy-first message "When money gets tight, the temptation is to take whatever pays the bills. Reimagine has a different idea."

### In-app helper chat

A small chat button in the bottom-right corner of every screen opens a conversational helper trained on this user guide. Ask anything about how to use Reimagine and get an answer in your voice context. If the answer involves going somewhere specific in the journey, the chat offers a "Take me to [step] →" button that navigates you there.

The chat pulses with a "Need help?" hint after 90 seconds of inactivity on a step, in case you are stuck and have not thought to ask. Conversation history persists across page reloads and navigation between steps. A "Clear" button in the chat header resets the thread.

### Voice consistency

A behind-the-scenes pass tightened the language across the tool. The user-facing copy and the AI-generated output now hold to a consistent voice: no em dashes, no comparison framing that contrasts most-people against you, no logic-flip cadence (sentences that pivot through a negation to land their point), no AI filler. A build-time guard prevents regression on these patterns going forward.

## Known limits in this build

- **Multi-JD library is not yet built.** The Upload a Live Opportunity module holds one playbook at a time. Pasting a new JD overwrites the previous playbook. A library that holds many is on the roadmap.
- **PDF upload for the live opportunity is supported. Word docs are not.** Paste the text if you have a Word doc.
- **No mobile-optimized layout.** The tool is usable on tablets and phones but designed for laptop-sized screens.
- **One assessment type label.** The Assessment Type dropdown labels one type at a time. To use multiple assessments, paste them into the text field with divider lines.

---

*This guide and the tool both evolve together now. If you are reading this and the version of Reimagine you are using does not match what is described here, email [bob@career.club](mailto:bob@career.club).*
