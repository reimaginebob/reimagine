# 14. FAQ and Troubleshooting

## Getting started

**How long does this take?**
The intake takes about 20 to 30 minutes. The full journey, including reading each output and refining where you want to, usually takes a few hours spread over multiple sessions. The full journey is meant to be paced across multiple sessions.

**Do I need to sign in?**
Yes, by email. The welcome screen asks for your email and sends a magic-link to your inbox. (If you are new to Reimagine, it also asks for your first and last name on a second step.) Click the link and you are in. No password. Your sign-in lasts 30 days and refreshes each time you open the tool, so active users almost never see the sign-in screen again. Signing in is what makes your work follow you across devices.

**How long does sign-in last?**
30 days, but the clock resets every time you use Reimagine. If you open it once a week, you essentially never need to sign in again. If you go a full month without opening it, you sign in once and you are back where you left off. Your account and your work are preserved regardless; only the session times out.

**Is there a cost?**
No, not today. Reimagine is in active beta and free to use.

**Do I have to take an assessment to use it?**
No, but the recommendations will be more abstract without one. If you do not have one, the free Affintus assessment takes 15 minutes and gives Reimagine the data layer that makes everything more personal. The link is on the welcome screen and on the Assessment input screen.

## Inputs

**Can I use more than one assessment?**
Yes, with a small workaround. Paste the results of each assessment sequentially into the text field on the Assessment screen with a divider line between each (`=== CliftonStrengths ===` then results, then `=== Hogan ===` then results). Reimagine will read all of it.

**Should my assessment be recent?**
Yes. We recommend assessments be no more than three years old. People change, and old data may not reflect how you operate today.

**Do I need to type everything?**
No. Most text fields have a microphone button. Tap it and talk. Reimagine listens and writes what you say into the field.

**My resume is old. Should I update it before I start?**
If you have time, yes. Especially adding numbers to your biggest accomplishments. If you do not, upload what you have. Reimagine will work with it and flag where to add quantification.

**What file formats does Reimagine accept?**
For your resume and your assessment: PDF, Word (.docx), and plain text (.txt). For loading a saved profile: JSON (the file Reimagine itself produced when you exported).

## Saving and your data

**Where is my data stored?**
Once you sign in, your work is stored in a Career Club database, keyed to your email, and synced to your devices. Before you sign in, work is in browser local storage as a fallback.

**Will Career Club share my data?**
No. Your inputs and outputs are not shared with third parties. The only places your information travels are to Anthropic's Claude service (which generates each section of your strategy) and Career Club's own database (which holds your progress against your email).

**What if I clear my browser cache?**
Once you are signed in, clearing cache does not affect your work. Sign in again on any device and your progress is there. If you declined the sign-in option and were using browser-local storage, clearing cache does clear your work.

**Can I move my work to another device?**
Yes, automatically. Sign in from the new device with the same email and your full session is there. No file export needed.

**Can I have more than one Reimagine direction in flight at a time?**
Not directly. Reimagine holds one active session per account. To explore two different directions in parallel, finish one, download the markdown of all outputs as a snapshot, then come back to the Decision step and pick a different option to generate downstream artifacts for the second direction. Chapter 12 covers the mechanics.

**Why is there only one playbook when I built the same role twice (or uploaded the same job description twice)?**
Reimagine de-duplicates. If you pick the same role from Career Paths twice, or upload the same job description twice, Reimagine quietly re-links you to the existing playbook instead of creating a second copy. Your work is not lost; you land back in the same record, right where you left it. If you want a clean start on that role or job description, delete the existing playbook from My Playbooks first, then build it again.

## Inside the journey

**A generation is taking a long time. Is something wrong?**
Most steps take three to four minutes. The Go-to-Market step (Phase 4) and the Income Now step include live web research and can take four to five minutes. Add an Opportunity is the exception: the page loads instantly and each of the four sections takes about 30 seconds to build on demand. If a step is taking longer than five minutes, refresh the page and try again.

**The output looks like it cut off.**
Refresh the page and regenerate the step. If it happens again on the same step, use the refine box to ask for a shorter response and try again.

**I got an error message. What should I do?**
Refresh the page. Your work is saved. Most errors are transient. Usually a network blip or a momentary issue with the language model. If the error persists for the same step, try refining with simpler input ("regenerate without the third option," for example) and try again.

**The output is in the wrong tone or doesn't sound like me.**
Use the feedback box. Describe how you want it to sound. Example: "I'm more reserved than this version. Tighter sentences, less storytelling." Then click **Update with my correction**.

**Reimagine read my background wrong.**
Tell it in the feedback box. Example: "My time at MoneyGram was internal strategy work, not consulting." Click **Update with my correction**. Factual corrections persist across the whole session, so the correction propagates to every later section that depends on it.

**I refreshed my Personal Brand and liked the previous version better.**
Reimagine keeps the version you had just before your last refresh or Start fresh. Click **Restore previous version** on the Personal Brand screen to bring it back. It is a one-click switch, and you can switch again if you change your mind, so you can compare the two. It keeps the most recent prior version.

**I edited an input, but my Personal Brand looks the same.**
Your Personal Brand does not rebuild on its own when you change an input (your resume, values, reputation, assessment, and so on). When you leave a changed input, Reimagine reminds you and offers to update it right then; you can also refresh it any time from the Personal Brand screen. Refreshing is safe: your current version is saved, so you can restore it if you prefer it.

**What does the Bridge Story look like?**
It is a single tell-me-about-yourself answer written in your voice and calibrated to the direction you picked. It opens with the strongest human anchor in your inputs (a passion, a craft you trained in, a formative experience, or an assessment finding), connects that to one accomplishment that carries the theme, and closes on why your next move is the natural next step. When your profile holds a second strong opening, Reimagine adds a short italic coaching note below the story. Chapter 7 covers the model in full.

**My Bridge Story is out of date after I changed my Orientation.**
If you change your reputation, values, passions, assessment, or Your Story after generating, regenerate the Bridge Story so it reflects what is now true. Open the feedback box below the story and click **Start fresh** (or **Update with my correction** if you also have a specific note). Reimagine rebuilds from your current inputs; your saved story is replaced only when you regenerate it.

**The Bridge Story or LinkedIn copy uses words I would never say.**
Open the feedback box below the section and tell Reimagine what to change, then regenerate. Examples: "Lead with my sustainability work instead," or "Don't use the word 'leverage,' I would not say that." The same feedback box works for the Bridge Story, LinkedIn copy, and every other section. Factual corrections save to your profile and carry into later sections; wording requests apply to the section you make them on.

**I want to explore a different direction or role after I picked one.**
Use **Explore another direction** to return to the three directions, or pick a different role in the Lane Option view. Any role you have opened before also appears under **Roles You've Explored** in the sidebar with a Re-explore action. Switching roles regenerates that role's Focus Playbook fresh; if the current playbook has unsaved work, Reimagine offers to save it as a PDF first. Chapter 6 covers this in detail.

**I want different options, or options in a direction we missed.**
On the Lane Option view, open **Tell us where else to look** and name a domain or direction we missed, or tell Reimagine what did not fit. Examples: "You missed affordable housing." "Consider education." "Remove consulting roles." "These skew too senior." It re-runs with your input weighted, without repeating the ones you have seen.

## Output and deliverables

**How do I save the final results?**
Four ways:
1. Download the one-page PDF from the Results screen. Designed for sharing with a recruiter, coach, or contact.
2. Download the target company list as a CSV from the **Download CSV** button in Phase 4. This is the most useful artifact for tracking outreach over time.
3. Download all outputs as one markdown file from the Results screen. The complete record of every generated section.
4. Click **Copy All** on any section to copy that section's text to your clipboard. The output strips markdown symbols so the paste is clean.

**Can I print the full output?**
Yes. Press Ctrl+P on Windows or Cmd+P on Mac from the section you want to print. Reimagine produces a clean printout of that section: the full content, paper-friendly type, no sidebar or buttons. From the print dialog you can save it as a PDF or send it to a printer. If you would rather paste into a document first, use **Copy All** at the top of the section. Both paths work, so pick whichever fits how you want to use the output. The one-page PDF on the Complete screen is also printable.

**Where do I share feedback about Reimagine itself?**
There is a short feedback survey on the **Complete** screen at the end of the journey. Otherwise, email Bob at [bob@career.club](mailto:bob@career.club).

## When something stays broken

If a step keeps failing or the output is not making sense after multiple refines:

1. Refresh the page. Your work is saved.
2. Try again with a slightly different input.
3. Sign out and sign back in. A clean session sometimes resolves transient state issues.
4. If none of that works, email [bob@career.club](mailto:bob@career.club) and describe what was happening. Beta feedback is what shapes the next build.

---

*Next: [Glossary →](15-glossary.md)*
