# 13. Saving and Sharing Your Work

> *(Bridge Story structure updated 2026-05-19; see [07-tell-your-story.md](07-tell-your-story.md) for the current model.)*

This chapter covers how Reimagine saves your progress, how your work syncs across devices, and how to take your finished strategy with you.

## How saving works

When you are signed in, Reimagine saves your progress to your account automatically as you go. Your inputs, your outputs, the direction you picked, the list of roles you have explored, and any corrections you have submitted are all saved against your email and synced to your devices.

One thing that is **not** saved server-side in v1: the generated content of a Focus playbook. Reimagine holds one active role's playbook at a time, and re-exploring a role regenerates it fresh from your current inputs. To keep a specific playbook exactly as it was, save it as a PDF (next section). Saving and restoring playbooks without regenerating is planned for a future release.

Three things worth knowing.

**Cross-device by default.** Sign in from a laptop, finish on a phone, pick up next week from a different computer. Your work travels with you as long as you sign in.

**Your data is stored on Career Club's database.** When you sign in, your work is saved to a database the team maintains, keyed to your email. The only parties that see your inputs are Anthropic's Claude service (which generates each section) and Career Club's own database (which holds your progress).

**Local fallback for users who decline sign-in.** If you reach the welcome screen and dismiss the sign-in prompt, Reimagine still works using browser-local storage. You can complete the full journey without an account. The trade-off is that you cannot move between devices, and clearing browser data clears your work. Sign-in is the safer mode for anyone using Reimagine seriously.

## Save a Focus playbook as PDF

The Focus playbook (Chapter 6) is where Reimagine builds everything for one role. Because that content is not stored between sessions, the PDF is how you keep it.

**Where the button is.** Once you have generated at least one section past The Role, a footer bar appears at the bottom of the Focus playbook with a **Save Playbook as PDF** button. It stays in view as you scroll, so it is there the moment you decide a playbook is worth keeping.

**What it produces.** Clicking it assembles every section you have generated for this role (The Role, Bridge Story, and whatever else you built) into a single clean document and opens your browser's print dialog. Choose "Save as PDF" as the destination. The result is formatted for paper, with each section on its own page and Reimagine branding, so it reads well when you send it to a coach, a mentor, or someone you would like to refer you.

**Why this matters in v1.** Reimagine keeps one active role's playbook at a time. Open a different role and the prior role's sections are cleared so the new role does not show stale content. The PDF lives on your device, so it survives any role switch, any change to your inputs, and any future product update. It is the way to keep a playbook between sessions today.

**The save-first prompt.** If you start switching to another role while the current playbook has unsaved work past The Role, Reimagine stops and asks first: save it as a PDF, continue without saving, or cancel. It is there so you never lose a playbook you cared about by accident. If you have already saved this playbook's current state, the prompt does not appear.

## Continuing where you left off

Sign in from any device. You land on the last step you were on, with all your previous inputs and outputs in place.

You can also click any completed step in the left sidebar to jump there.

## Snapshots and exports

Reimagine produces several artifacts you can take with you.

### Download all outputs as one markdown file

On the Complete screen, click **Download All Outputs as Markdown**. The file contains every generated section in one document, with clear headings between phases. Open it in any text editor, paste into a document, or convert it to PDF.

### The one-page PDF

The most portable summary of your work is the one-page PDF. It is generated from your final outputs and includes your personal brand, your value proposition, your bridge story, and your target direction in a clean printable format.

You can download it from two places on the Complete screen: the banner at the top, and the Your Deliverables section near the bottom.

Use it to share your story with a recruiter, a coach, or someone in your network you would like to refer you. It is designed to be readable in 60 seconds.

A creative use worth trying: upload the PDF into **Notebook LM** (Google's free notebook tool) and use the Audio Summary feature to generate a short podcast-style episode about you. Hearing two hosts talk about your background hits you differently than reading the same content on paper. Chapter 10 has the full setup.

### The target company list as a CSV

In Phase 4 (Find Your Market), Reimagine shows a callout with a **Download CSV** button right after your target company list. Click it and the entire list downloads as a spreadsheet. The columns include: Company, What they do, Industry, Size, HQ, Why it fits, Growth signal, Contact, and Email. The filename is keyed to your name, the role you are pursuing, and the date.

This is the most actionable artifact Reimagine produces. Open it in Excel, Google Sheets, or Numbers, and you have a working outreach tracker. Add columns as you go: when you reached out, what you heard back, the next step. Filter, sort, and share. Many users keep a live working copy that evolves as their search progresses and a separate clean copy of the original Reimagine output for reference.

## Copying individual sections

Every output section in Reimagine has a **Copy All** button at the top right of the panel. Click it to copy the full content of that section to your clipboard. The copy is clean plain text: the markdown formatting symbols (`**`, `#`, `-`) are stripped so the result pastes cleanly into email, LinkedIn DMs, or any other context where you do not want raw markdown.

Use Copy All to move text into:

- A document where you are drafting cover letters or LinkedIn posts.
- An email to a coach or mentor.
- Your own notes app for reference during interviews.

The Copy All works for all generated sections, including the Bridge Story, the Go-to-Market plan, the LinkedIn copy, the playbook, and the Income Now plan.

## Start over from scratch

If you want to redo your entire journey, the **Start Fresh** option in the top-right header permanently deletes your profile, outputs, and chat history. You can sign back in with the same email and start over from the Welcome screen.

Use this when:
- Your initial inputs were wrong and you want a clean slate.
- You want to redo the journey with a different framing of your story.
- You no longer want your data in Reimagine.

Start Fresh is not the same as Sign Out. Sign Out keeps your profile and signs you back in next time. Start Fresh removes everything from Reimagine's servers (your profile, outputs, marked picks, chosen direction, chat history, and active sessions) and signs you out.

When you click Start Fresh, a browser dialog asks you to confirm. After you confirm, the page reloads to the Welcome screen, signed out. If you want to come back, sign in with the same email and you'll receive a fresh magic link to start over.

If you are signed in and the Welcome screen shows a "Continue Where I Left Off" panel because you have work in progress, a smaller "Or start fresh" link appears below the continue button as a quieter second surface.

## What to do if your work disappears

If you return to Reimagine and your session is gone, two things to check:

1. **Are you signed in?** Click the welcome screen and enter your email. The sign-in link arrives in your inbox. Click it and your work reappears.
2. **Are you using the same email you signed up with?** Your account is keyed to your email; signing in with a different address creates a fresh account.

If you used Reimagine before the sign-in feature shipped and declined the migration prompt, your work was browser-local. Look in the same browser on the same device. If you cleared browser data since then, the local progress is gone.

---

*Next: [FAQ and Troubleshooting →](14-faq-and-troubleshooting.md)*
