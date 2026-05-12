# 14. FAQ and Troubleshooting

## Getting started

**How long does this take?**
The intake takes about 20 to 30 minutes. The full journey, including reading each output and refining where you want to, usually takes a few hours spread over multiple sessions. Most people do not finish in one sitting.

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

## Inside the journey

**A generation is taking a long time. Is something wrong?**
Most steps take one to two minutes. The Go-to-Market step (Phase 4) and the Income Now step include live web research and can take three to four minutes. If a step is taking longer than five minutes, refresh the page and try again.

**The output looks like it cut off.**
Refresh the page and regenerate the step. If it happens again on the same step, use the refine box to ask for a shorter response and try again.

**I got an error message. What should I do?**
Refresh the page. Your work is saved. Most errors are transient. Usually a network blip or a momentary issue with the language model. If the error persists for the same step, try refining with simpler input ("regenerate without the third option," for example) and try again.

**The output is in the wrong tone or doesn't sound like me.**
Use the feedback box. Describe how you want it to sound. Example: "I'm more reserved than this version. Tighter sentences, less storytelling." Then click **Update with my correction**.

**Reimagine read my background wrong.**
Tell it in the feedback box. Example: "My time at MoneyGram was internal strategy work, not consulting." Click **Update with my correction**. Factual corrections persist across the whole session, so the correction propagates to every later section that depends on it.

**The Bridge Story or LinkedIn copy uses words I would never say.**
Refine. Examples: "Don't use the word 'unlock.' Don't use 'leverage.' Don't use phrases like 'not just X but Y.' I would not say any of those." Reimagine will adjust.

**I want to explore a different direction after I committed.**
Click **Your Decision** in the sidebar. Pick a different option or type a new one. Then click forward through Phases 3, 4, and 5 regenerating each step. Chapter 12 covers this in detail.

**I want a different mix of options in the Wide View.**
Use the refine box on the Wide View. Examples: "Add more startups." "Remove consulting roles." "Show me more in healthtech." Click **Update my options**.

## Output and deliverables

**How do I save the final results?**
Four ways:
1. Download the one-page PDF from the Results screen. Designed for sharing with a recruiter, coach, or contact.
2. Download the target company list as a CSV from the **Download CSV** button in Phase 4. This is the most useful artifact for tracking outreach over time.
3. Download all outputs as one markdown file from the Results screen. The complete record of every generated section.
4. Click **Copy All** on any section to copy that section's text to your clipboard. The output strips markdown symbols so the paste is clean.

**Can I print the full output?**
Use **Copy All** on each section, paste into a document, and print from there. The one-page PDF is also printable.

**Where do I share feedback about Reimagine itself?**
There is a short feedback survey on the **Complete** screen at the end of the journey. Otherwise, email Bob at [bob@career.club](mailto:bob@career.club).

## When something is genuinely broken

If a step keeps failing or the output is not making sense after multiple refines:

1. Refresh the page. Your work is saved.
2. Try again with a slightly different input.
3. Sign out and sign back in. A clean session sometimes resolves transient state issues.
4. If none of that works, email [bob@career.club](mailto:bob@career.club) and describe what was happening. Beta feedback is what shapes the next build.

---

*Next: [Glossary →](15-glossary.md)*
