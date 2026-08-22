# Resume Review desk — internal-only feedback on a resume someone sent you

## Prompt for Code

Apply the changes in this brief. It adds an internal-only screen at `/admin/resume-review` where a signed-in `@career.club` user **uploads** someone else's resume and gets back feedback written to that person, formatted to paste straight into Gmail. The model reads the actual PDF, not extracted text, so it can judge layout. Nothing is stored and nothing touches the reviewer's own profile. **The rubric is lifted from the prompts that already ship — do not author new resume rules.** Premise-verify every anchor before editing; written against `origin/main` at `71ec799`. Run the full static gate chain and follow the gh flow in CLAUDE.md §9. Report the PR URL and merge SHA.

---

**Date:** 2026-08-16
**Type:** Feature — internal tool
**Source:** Bob, 2026-08-15/16. People send him resumes; he wants to send back something useful without writing it by hand. Revised after his review: upload not paste, Gmail-safe output, and no new rubric.

---

## Pre-flight discovery (scope correction)

Verified against `origin/main` at `71ec799`. **This replaces an earlier draft of this brief that got three things wrong; each correction is recorded below so the reasoning is not lost.**

### The PDF rides the existing endpoint — no new API route

`api/claude.js:428-436` accepts a full Anthropic body when the client sends a `messages` array ("legacy format"), builds the outgoing body as `{...reqBody}`, and overrides only `model`, `max_tokens` and `system`. **Message content passes through untouched**, so a `document` content block reaches the API intact:

```js
messages: [{ role: 'user', content: [
  { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: <base64> } },
  { type: 'text', text: <the review prompt> },
]}]
```

Three consequences to respect:

- **The model is forced to `claude-sonnet-4-5` server-side** (`api/claude.js:433`). Do not try to override it; PDF document blocks are supported there.
- **`...reqBody` is spread**, and Anthropic 400s on unknown fields. The file already deletes `voiceMode` and `step` for exactly this reason (`api/claude.js:443-449`). Send only valid Anthropic fields.
- **Output still passes the runtime voice gate**, because it goes through this proxy like every other generation. That is a reason to use this path rather than a bespoke one.

### PDF only, and say so when it is not

The reason to upload rather than paste is to judge the actual page — columns, tables, dates stranded in a sidebar, text living in a header or an image. Only PDF gives the model that. A `.docx` cannot be sent as a document block.

So: **accept PDF for the real review.** If the reviewer has a `.docx`, the honest options are to ask them to save it as PDF, or to extract text and review the content while stating on screen and in the output that layout could not be assessed. Do not silently fall back — a layout verdict on text-only input is a fabricated verdict. Code: implement PDF-only for v1 and show a plain message for other file types telling the reviewer to save as PDF. Text extraction fallback is out of scope.

### The rubric already exists. Do not write a new one.

The earlier draft of this brief invented a resume-critique list (structure, verbs, quantification, ATS formatting). That is drift, and it is the specific thing Bob rejected.

`src/App.jsx` carries a standard voice-rule stack inline in each of its ten generation prompts (`grep -c "EVIDENCE-BASED CONFIDENCE" src/App.jsx` → 10). Per CLAUDE.md §5 it comprises: EVIDENCE-BASED CONFIDENCE, EVIDENCE-ANCHORED PATTERNS, NO TYPOLOGY LABELS, NO AI-COACHING REGISTER, EPISTEMIC CALIBRATION, REFUSE overclaim patterns, TRANSLATION NOT PRAISE, and LOGIC-FLIP CADENCE refusal.

**Code: lift that block verbatim from `p_res` (`src/App.jsx:2558`) into the new prompt.** Copy it; do not paraphrase, summarize, or "adapt it for this surface" — a reworded rule is a new rule. The stack is currently duplicated across all ten prompts, so an eleventh copy matches the house pattern. (Extracting it to a shared constant would touch all ten and is a separate piece of work; note it, do not do it here.)

The resume-specific judgment likewise comes from what already ships — `p_res` (Resume Refresh, the hybrid format and its section rules) and `p1` (Resume Analysis) — plus Making Your Own Weather, which is already in the system prompt this endpoint sends. **Reference those rules; do not restate them in your own words, and do not add criteria that appear in neither.** If the review needs a judgment neither prompt covers, STOP and surface it rather than inventing it.

### Gmail-safe output

The reviewer pastes this into Gmail and does not want it arriving in a different font or size than the rest of their message.

**Render it styled on screen; copy it as plain text.** The Copy button puts plain text on the clipboard — no HTML, no inline styles, no `text/html` clipboard flavour. Pasted into Gmail, plain text inherits the compose font, which is exactly the requirement. Subheadings are their own line; bullets are a literal `• ` prefix. Code: write only `text/plain` to the clipboard; if the app has an existing copy helper that writes rich text, do not reuse it here.

The reviewer writes their own salutation, so the output begins with the thank-you line and never with "Dear —".

### Two hazards, unchanged from the earlier draft

1. **Nothing may reach `profile_state`.** A third party's resume near the reviewer's own profile blob would contaminate their Personal Brand and saved work. Component state only — no `pr()`, no `setProfile`, no autosave.
2. **Nothing is persisted anywhere.** The person whose resume this is never signed up and agreed to nothing. Storing their document creates a retention and deletion obligation with no account to attach it to. Upload, review, return, keep nothing — not in the database, not in `localStorage`. The base64 lives in component state and dies on reload.

### The gate

`api/admin/coach-insights.js:12-20` gates on a shared `ADMIN_TOKEN` via Bearer header or `?t=`. That does not satisfy the requirement, which is *any* `@career.club` login rather than whoever holds a secret. Use the session instead — `getSessionUser` (`api/_lib/session.js`, already the auth for `api/coach.js`) server-side, and the `@career.club` test that already exists in `api/admin/activity-watchdog.js:70`.

Client-side, `signedInUser` is in scope in `App.jsx`. Code: **verify it carries `email`**; if `/api/me` does not return the address, widen that endpoint rather than adding a second lookup.

**Scope of the gate, stated plainly:** this gates *visibility*. Generation rides `/api/claude`, the endpoint every other prompt uses, so this adds a screen and a prompt rather than a new capability. Hardening to "unreachable by any other account" needs its own server route and is a separate brief.

---

## Files affected

| File | Change |
|---|---|
| `src/components/ResumeReview.jsx` | New. The screen, the upload, the prompt, the plain-text copy |
| `src/App.jsx` | One route line, gated on a signed-in `@career.club` address |

Note the path: `src/components/`, not `src/`. `scripts/check-fontsize.mjs` scans `src/App.jsx` plus `src/components/` only, and the ratchet baseline is 0 — a new file outside that tree would be unguarded.

---

## Specific changes

### 1. `src/App.jsx` — the route

At `src/App.jsx:4947-4948`, currently:

```js
  if(_path==='/admin/dashboard')return <AdminDashboard/>
  if(_path==='/admin/coach-insights')return <CoachInsights/>
```

Add a third line. The other two render unconditionally because their data endpoints hold the token gate; this screen has no such endpoint, so the gate lives here:

```js
  if(_path==='/admin/resume-review')return (signedInUser&&/@career\.club$/i.test(String(signedInUser.email||'')))?<ResumeReview/>:null
```

Code: `null` is the placeholder. Match whatever the app already renders for an unrecognized `_path`. A non-career.club address must not learn that the route exists. Confirm `signedInUser` is in scope at that line, and that the dispatch does not run before sign-in resolves — if it can, render nothing until it does rather than flashing the screen and pulling it back.

Import alongside the existing two at `src/App.jsx:41-42`.

### 2. `src/components/ResumeReview.jsx` — the screen

Follow the visual conventions of `src/CoachInsights.jsx` (same palette constants, same `Panel` shape) so it reads as part of the same internal surface.

**State, all local, none persisted:** `fileName`, `pdfBase64`, `targetRole`, `output`, `busy`, `err`.

**Inputs:**
- A file input accepting `.pdf` only. Read it with `FileReader.readAsDataURL` and strip the `data:...;base64,` prefix. Cap at **4 MB** before encoding and show a plain message above that — Vercel's function payload limit sits near 4.5 MB and base64 adds about a third. Any non-PDF gets a message asking for a PDF, per the pre-flight note.
- One optional field: **Role or job description they're targeting (optional)**.
- **Review** button; **Copy** button on the result.

**Copy behaviour:** `text/plain` only. Do not write a `text/html` clipboard flavour, and do not reuse any existing rich-text copy helper.

**Font floor** (CLAUDE.md §8): nothing below 15, interactive elements 16+, `check-fontsize` baseline 0 held.

**Guidance treatment** (CLAUDE.md §8): the note explaining that nothing is stored is guidance — `CoachingCallout` or an equivalent accented block, never a plain grey paragraph.

### 3. The prompt

Built in `ResumeReview.jsx`, sent as the `text` block alongside the `document` block, POSTed to `/api/claude`.

**Compose it in this order:**

1. The framing paragraph below.
2. **The voice-rule stack, lifted verbatim from `p_res` (`src/App.jsx:2558`).** Copy, do not paraphrase.
3. The output-shape section below.

**Framing:**

```
You are reviewing a resume that someone sent to a career coach for feedback. The
attached PDF is that resume — you are reading the actual document, so you can see
its layout, not only its words. Your output goes to that person directly and they
will read it as-is, so write it to them in second person.

You have their resume and nothing else. You have never met them, you do not know
their situation, and you cannot look them up. Never invent an accomplishment, a
motive, or a circumstance. Where the document is ambiguous, say what is unclear
and what would resolve it, rather than guessing and advising on the guess.

Judge it against how Reimagine already thinks about resumes and about writing
about a person — the rules in this prompt and the method in Making Your Own
Weather. Do not import resume conventions from anywhere else, and do not invent
criteria. If something seems off but no rule here covers it, leave it out.
```

**Output shape:**

```
FORMAT. The reader will paste this into an email, so write plain text only: no
markdown, no asterisks, no hashes, no code fences, no tables. A section is a
subheading on its own line, followed by bullets, each bullet starting with "• ".
Keep bullets to one or two sentences. Do not write a salutation or a sign-off —
the coach adds those.

Open with one short line thanking them for sharing the resume. Then these
sections, in this order.

WHAT YOUR RESUME SAYS ABOUT YOU
The through-line — what integrates a varied history, not a list of what they have
done. Name the evidence in the same breath so they can check it. If the document
does not support a through-line, say so plainly and name the two or three threads
competing for the space; that is the most useful thing you can tell them.

WHAT'S WORKING
Two or three things the resume already does well, each with the reason it works —
what a reader actually gets from it. Write these as information rather than
encouragement, and point at the line or the choice rather than at the person. Be
specific enough that they know what to leave alone: people rewrite their
strongest lines because nobody told them those lines were strong. Never pad this
to be kind — if there are only two, name two.

WHERE YOU'RE UNDERSELLING
Two or three places where a line does less work than the accomplishment behind it
deserves. Quote the line as written, say what it is hiding, offer a rewrite.

WHAT TO CHANGE
Specific and tied to things you can point at, including what you can see of the
layout now that you have the actual page. No advice that would apply to any
resume — every bullet names something in THIS document.

[Only when a target role or job description is supplied:]
IF YOU'RE AIMING AT THIS ROLE
What already lines up, what a reader will look for and not find, and the single
highest-value change for that target.
```

---

## Voice rules on inserted text

Two user-facing strings ship: the screen's labels and the not-stored note. Checked against CLAUDE.md §3 — plain language, no banned constructions. The prompt is model-facing and outside the gate's scan; its output is not, and passes the runtime gate on `/api/claude` like every other generation.

---

## Static gates

- `npm run build` clean.
- `check-voice` 0/0 — no new voice-allow region.
- `check-fontsize` — baseline 0 held (hence `src/components/`).
- `check-prompt-refs`, `check-sys-equality`, `check-coach-nav-map`, `check-orphans` — unchanged and passing.
- `check-user-guide-pdf` — untouched; internal tools do not go in the user guide.
- `src/App.jsx` EOF integrity: line count before and after.
- Diff scope: the two files above.
- **Preview smoke test not required** — no `api/*` file is touched. Confirm that is still true before skipping it.

---

## Runtime gate (post-merge)

1. Signed in as `bob@career.club`, open `/admin/resume-review`. Upload a PDF resume, leave the target blank, Review. Confirm four sections come back and every bullet under **What to change** names something actually in that document.
2. **Confirm it saw the page, not just the words.** Upload a resume with a two-column layout or dates in a sidebar and check whether the feedback reflects that. If it reads as though it only had the text, the document block is not reaching the API.
3. Read **What's working** as if it were about you. If it reads as encouragement rather than something you could act on, the prompt needs another pass — that section fails by being pleasant.
4. Repeat with a target role filled in; confirm the fifth section appears and the first four do not simply repeat themselves.
5. **Copy, then paste into a Gmail compose window.** Confirm the font and size match what you type there, and that no bullet arrives as a markdown asterisk.
6. Sign in as a non-career.club account and open the same URL. Confirm it renders nothing and does not hint the route exists.
7. Return to your own Orientation and Personal Brand. Confirm nothing you uploaded appears anywhere in your profile and that your Personal Brand was not marked stale.
8. Reload the review screen. Confirm the previous resume is gone.

---

## Constraints

- Single PR.
- No effort estimates in the PR description.
- PR title: `Resume Review desk (internal, career.club only)`

---

## Out of scope

- Emailing the feedback. It is copy-and-paste; sending on the reviewer's behalf is a different decision.
- `.docx` and text-paste input. PDF only, so the layout verdict is always honest.
- Any storage, history, or list of past reviews.
- Anything for the person whose resume it is — no account, no link, no invitation.
- Extracting the duplicated voice stack to a shared constant. Real, ten prompts wide, separate brief.
- Hardening the gate to a server route.

---

## Commit message

```
Resume Review desk (internal, career.club only)

People send Bob resumes and he wants to send back something useful without
writing it by hand. New screen at /admin/resume-review: upload a resume,
optionally name the role they are targeting, get feedback written to that person
that he can paste straight into Gmail.

- ResumeReview.jsx: upload, prompt, plain-text copy. The PDF goes to the model
  as a document block so it reads the actual page — columns, tables, dates in a
  sidebar — rather than extracted text, which is the whole reason it is an
  upload. PDF only: a layout verdict on text-only input would be fabricated.
- App.jsx: one route line, gated on a signed-in @career.club address.

Rides /api/claude, which already accepts a full messages array and passes
content through untouched, so no new endpoint and the output still clears the
runtime voice gate.

The rubric is lifted verbatim from the stack p_res already carries — evidence
based confidence, evidence-anchored patterns, no typology labels, epistemic
calibration, refuse-overclaim, translation not praise — plus Making Your Own
Weather, already in the system prompt. No new resume rules were written.

Copies as text/plain only, so it inherits the Gmail compose font instead of
arriving in a different typeface.

Stores nothing, anywhere, and never touches profile_state: the person whose
resume this is never signed up, and their document must not reach the
reviewer's own profile.

Build clean, voice 0/0, fontsize baseline 0 held.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

---

## Push

Direct to `main` via the gh flow (CLAUDE.md §9). Vercel auto-deploys.

---

## Implementer's checklist

1. `git fetch origin`; confirm current `origin/main`. Written against `71ec799`.
2. Premise-verify:
   - `src/App.jsx:4947-4948` still dispatches the two admin routes as quoted.
   - `signedInUser` is in scope there **and carries `email`**.
   - `api/claude.js` still takes the `messages` branch and still spreads `...reqBody` without touching message content.
   - The voice stack is still present in `p_res` at `src/App.jsx:2558` and still matches CLAUDE.md §5.
   - If any premise fails, STOP and surface back.
3. Check for uncommitted work from a concurrent session; stash-isolate, do not bundle.
4. Apply changes 1–3. **Copy the voice stack; do not retype or reword it.** Diff your copy against `p_res` before committing.
5. Full static gate chain. Record `src/App.jsx` line count before and after.
6. Open the PR with `gh pr create --body-file`, watch checks to green, merge `--squash`.
7. Report the PR URL, the merge SHA, and anything premise verification corrected — in particular whether the document block reached the API on the preview deploy.
