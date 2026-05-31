# Reimagine — Project Guide for Claude Code

This file is loaded automatically when Claude Code works in this repo. It captures the project-level conventions that briefs in `Output/handoff/` assume. Read it first on every session.

---

## 1. What this is

Reimagine is a career-strategy tool in beta with ~20 users (as of May 2026). It walks users through a multi-step orientation, then produces a per-direction playbook covering Personal Brand, Role Options, Bridge Story, The Lingo, Interview Prep, Resume Refresh, LinkedIn Remix, Go-to-Market, and Income Now. The product is React + Vite, deployed on Vercel, with Anthropic API for prompt-driven generation, Neon Postgres + Resend for magic-link auth and cross-device profile sync, and Apps Script integrations for signup and corrections logging.

The product owner is Bob Goodwin (Career Club / Decima LLC). Strategic positioning leans on Bob's book *Making Your Own Weather* (the Four Cs and Five Ps frameworks).

Repo: `github.com/reimaginebob/reimagine` → Vercel auto-deploys to `reimagine2-two.vercel.app`.

---

## 2. The operating model

Cowork-Claude (Bob's strategic thought partner) drafts implementation briefs at `Output/handoff/` and hands them to Claude Code. Code runs premise verification, applies the changes, and ships the PR. Bob is the source of truth for product decisions; Code is the source of truth for "what currently ships."

Every brief follows the format described in section 4. Every PR follows the gh flow described in section 9.

---

## 3. Voice rules (load-bearing)

Reimagine's voice is the load-bearing differentiator. These rules apply to every user-facing surface: prompts, UI copy, the user guide, emails, marketing.

### The principles

- **Mirror, not cheerleader.** Reflect what's in the user's inputs. Never flatter. Never pre-judge value. Never assert the user is underrecognized before evidence.
- **Translation, not praise.** Every analytical claim is a translation move (where this capability transfers), not a characterization (what trait you have). The user comes to Reimagine already feeling capable; the value-add is showing where capability transfers, not naming what they already know about themselves.
- **Lead with the human.** User-facing copy answers "how does this help the person in their job search?" before describing what the feature does.
- **Plain language, not jargon.** Use the plainest word users know ("chat" not "helper"). Brand UI labels are fine; internal vocabulary should not become how we refer to features in copy.
- **Surface the insight.** Every analytical chunk uses visual hierarchy (bolded headline + supporting prose, bullets, callouts) so a 7-second scan catches the insight. Wall-of-text paragraphs that bury the punchline are a delight-killer.
- **Through-line first.** Find the FORCE that integrates the user's choices, not just the pattern. Pattern + source is still failure mode. Signal of done: recognition.
- **Epistemic humility.** Every interpretive claim is a hypothesis by default. Declarative claims are earned only when the evidence is named in the same paragraph.
- **Positive framing.** Frame every step as a gain. Never set up the user's current state as deficient or in need of correction.
- **The user is not a problem to solve.** Job search is heavy enough. Reimagine should be the lightest moment of the user's week.

### Banned constructions

These are refused in shipped output. The voice gate at `scripts/check-voice.mjs` catches the patterns that have shown up historically.

- **Logic-flip cadence:** "you do not just X, you Y," "X is not Y, it is Z," "it is not a Z, it is a W," "the next move is less about X and more about Y."
- **Comparative standing:** "Most people," "many candidates," "the average professional," "most hiring managers do not see X," "where others settle for X."
- **AI-coaching register:** "worth sitting with," "sit with this," "let that land," "lean into," "hold space for," "get curious about," "notice what comes up," "take a moment to consider," "trust the process," "honor your journey."
- **AI meta-narration:** "Based on your inputs," "Let me look at," "I'll now produce," "I need to search for." Deterministic stripper `stripMetaNarration` cleans these.
- **Sincerity qualifiers:** "the honest answer," "frankly," "candidly," "to be honest."
- **"Rooms" as a synonym for conversations or situations.** Specific labels ("panel opener," "networking coffee") are fine; abstract "room" is not.
- **Psychotherapy pull-language:** "pulling at you," "weighing on you," "sit with that." Replace with permission-giving register.
- **Typology labels:** "builder," "operator," "integrator," "strategist," "connector," "hunter," "farmer," "architect," "fixer," "closer."
- **Slogan-cadence closers:** "X is the engine. Y is the fuel." Inspirational-poster paired sentences.

### Enforcement

Voice rules need DETECTION, not just instruction. Three layers:

1. **In-prompt instructions** in every Clarity-producing prompt (the P object in `src/App.jsx`). Necessary but not sufficient — the model is probabilistic.
2. **Runtime voice gate** at `scripts/check-voice.mjs` with HARD_PATTERNS that block the build if a shipped output contains a banned construction. Voice-allow regions in App.jsx are documented exceptions; count is watched (current ~12, trending up is a warning sign).
3. **Deterministic post-processors** like `stripRoomsPlaceholder` and `stripMetaNarration` that clean output regardless of model compliance. Reach for these when a pattern is model-robust (the model regenerates banned constructions even when told not to).

When proposing a voice fix, pair the instruction with a detection or stripping mechanism. "Just add an instruction to the prompt" is a draft, not a fix.

---

## 4. The brief format

Every implementation brief lives at `Output/handoff/YYYY-MM-DD_short-name.md` and follows this shape:

- **Date / Type / Source.** What this is and where it came from.
- **Pre-flight discovery (scope correction).** What the brief's author verified against current code before drafting. Names what was confirmed already-shipped, retired, or differently-scoped than the brief's original framing implied. Audit / sibling / carry-forward briefs are HYPOTHESES; verify before drafting.
- **Files affected.** Table of file → change.
- **Specific changes.** Numbered changes, each with the exact text to replace or insert. Verbatim quotes of existing code so Code can locate the change unambiguously.
- **Voice rules on inserted text.** Confirm the inserted text passes voice rules.
- **Static gates.** What the build must pass post-change: `npm run build` clean, `check-voice` 0/0, `check-prompt-refs` 0, App.jsx EOF integrity preserved, diff scope limited to named files.
- **Runtime gate (post-merge, optional).** What Bob (or Cowork-Claude) verifies in production after merge.
- **Constraints.** Single PR, no effort estimates, PR title format.
- **Out of scope.** What this brief does NOT touch.
- **Commit message.** Pre-written commit message Code uses.
- **Push.** Always direct to `main`; Vercel auto-deploys.
- **Implementer's checklist.** Numbered steps Code follows: pull, premise-verify, apply changes, run gates, changelog, push, report PR URL + merge SHA.

### Premise verification

Every brief requires Code to verify the brief's premise against current code BEFORE applying changes. If a brief says "P.p11 contains the EVIDENCE-BASED CONFIDENCE block at line X," Code greps for the block. If it's missing or has drifted, Code STOPs and surfaces back to Cowork-Claude rather than proceeding on assumed state.

The brief's "Pre-flight discovery" section captures what Cowork-Claude already verified. The implementer's checklist captures what Code re-verifies before applying changes. Both layers exist because briefs run on snapshots and the codebase moves.

### Substance-grep, not just named-block-existence

When verifying a brief's premise, grep for the SUBSTANCE the brief proposes to add, not just the named block it lands in. Example: a brief proposing "add a per-path adaptation block to p11" might find the named block exists but the substance (FAMILIAR GROUND / INDUSTRY INSIDER / WORK THAT MATTERS branching) is already present under different scaffolding. The brief is reshaping, not adding; scope, title, and PR description change accordingly.

Briefs that come back at 25-80% of their original scope after pre-flight are common (today's audit closeout averaged ~50%). This is not a failure of the audit; it's the discipline working.

---

## 5. Prompt builders (the P object)

`src/App.jsx` contains the P object: ~14 prompt builders for each generation step. Most are single-line template literals at lines ~1110-1120. The current ID set:

- `p1`: Resume Analysis
- `p2`: Wiring & Compass (assessment synthesis)
- `p3`: Personal Brand synthesis (Golden Thread + Triangulation + Where This Transfers + Dimensional Fit + closing co-author invitation)
- `p4`: Wide View (lane options: FAMILIAR GROUND / INDUSTRY INSIDER / WORK THAT MATTERS)
- `p5`: Deep Dive (per-role analysis)
- `p6`: Bridge Story / Tell Me About Yourself
- `p7`: Go-to-Market (target companies + outreach)
- `p8`: LinkedIn Remix (Headline + About + Experience Reframe)
- `p9`: Industry Background (sector vocabulary + thought leaders + credibility move)
- `p10`: **RETIRED** — single-line stub redirecting to p11
- `p11`: Interview Prep (top questions with STAR breakdown + framing recommendations)
- `p_res`: Resume Refresh
- `income`: Income Now
- `op`: Live Opportunity Playbook (post-completion bonus)
- `skillsExtract`: Skills capture from resume + LinkedIn (orientation surface)

### Conventions inside prompt builders

- Every Clarity-producing prompt carries a RAW SIGNALS block injecting `pr.values`, `pr.passions`, `pr.rep.*`, `pr.lifeEvents`, and (where present) `pr.skills` and `pr.assess`. The block uses canonical field labels (`VALUES`, `PASSIONS AND CAUSES`, `PRAISE THEY RECEIVE`, `WHO CALLS THEM IN EMERGENCY`, `HOW PEOPLE DESCRIBE THEIR SUPERPOWER`, `OTHER REPUTATION DATA`, `LIFE-SHAPING EXPERIENCES`). Sub-bullet structures and renamed labels are drift.
- Every Clarity-producing prompt carries the standard voice rule stack: EVIDENCE-BASED CONFIDENCE, EVIDENCE-ANCHORED PATTERNS, NO TYPOLOGY LABELS, NO AI-COACHING REGISTER, EPISTEMIC CALIBRATION, REFUSE overclaim patterns, TRANSLATION NOT PRAISE, LOGIC-FLIP CADENCE refusal.
- Per-path adaptation (FG / II / WTM branching) is implemented in p4, p5, p11 (STAR stories), p_res (Repositioned Summary + Key Accomplishments), and parts of p6 and p7. p8 added per-path adaptation 2026-05-21. p9 deliberately does not branch by lane (it's a reference guide, not a synthesis surface).
- App.jsx EOF must remain intact. Always verify line count and final closing tag/brace before AND after every edit. Edit tool may truncate large files; for whole-file changes use git clone + Python rewrite.

---

## 6. The META / STEP_LABELS / api/chat.js invariant

Three surfaces hold step-name labels and must stay in sync:

- `src/App.jsx` `META` (line ~1132): canonical step-name map for sidebar display.
- `src/components/Chat.jsx` `STEP_LABELS`: chat helper's navigation target table.
- `api/chat.js` step-id table: chat helper LLM's reference for picking NAVIGATE intents.

`scripts/check-prompt-refs.mjs` enforces a build-time invariant:

- **ID-equality check** (existing): every key in STEP_LABELS and the api/chat.js table must exist in META. ID drift fails the build.
- **Label-equality check** (added 2026-05-21 via the label-resync PR): for each shared key, STEP_LABELS / api-table label must match META. Label drift fails the build. The api-table check strips trailing parentheticals like `(Phase 5, Get Ready)` and `(post-completion bonus)`.

When adding a new step or renaming an existing one, all three surfaces must be updated in the same PR. The build will catch drift; do not rely on manual cross-checking.

---

## 7. File layout

```
/                                  repo root
  CLAUDE.md                        this file
  package.json                     build pipeline + npm scripts
  vite.config.js
  index.html
  
  src/
    App.jsx                        main app, all prompt builders, META, voice-allow regions
    main.jsx                       entry
    components/
      Chat.jsx                     chat helper UI + STEP_LABELS
      CookieBanner.jsx
      ... (extracted React components)
    voice-patterns.mjs             HARD_PATTERNS used by the voice gate
    data/
      user-guide/                  user-guide markdown chapters (repo source)
    config/
    ...
  
  api/                             Vercel functions
    claude.js                      Anthropic API proxy + voice gate enforcement
    chat.js                        chat helper LLM + step-id table
    auth/, account/, profile/      magic-link auth + profile sync
    me.js
    _lib/
  
  scripts/
    check-voice.mjs                voice gate (build-time, also runtime via api/claude.js)
    check-prompt-refs.mjs          META/STEP_LABELS/api-table invariant
    build-user-guide.mjs           regenerates user-guide artifacts
    reimagine-corrections-log.gs   Apps Script for corrections logging
    ... other build scripts
  
  migrations/                      Postgres schema (Neon)
  db/migrations/                   alternate migrations folder (known tech debt)
  
  Output/                          (Cowork-Claude's workspace, not part of build)
    handoff/                       implementation briefs YYYY-MM-DD_short-name.md
    docs/
      reimagine-user-guide/        DEPRECATED. Repo src/data/user-guide/ is canonical going forward.
      reimagine-system-documentation/  internal system docs incl. Ch. 11 changelog
    audits/                        weekly audit packets
    briefs/                        broader product briefs
```

Two notes on drift:

- The repo's `src/data/user-guide/` is the canonical source for user guide content. The workspace path `Output/docs/reimagine-user-guide/` is deprecated and was historically used as the canonical source before the repo had user-guide build infrastructure. Future user-guide changes go directly through the repo. The workspace path is preserved for historical reference only.
- Two migration folders exist (`db/migrations/` and `migrations/`). Known tech debt; do not introduce more migrations to the wrong folder. Verify which folder current production reads from before adding.

---

## 8. Standing engineering rules

- **Pull before editing.** Workspace copies drift from main. Always sync before editing source files.
- **App.jsx integrity.** Check line count and EOF closure before AND after every edit. Never ship a file that ends mid-tag.
- **No effort estimates.** Engineer-days, weeks, hours, t-shirt sizes are not useful. Describe scope in terms of what it touches (files, surfaces, invariants).
- **Batch updates during beta.** Don't push improvements continuously. Queue and ship in batches so user feedback maps to known builds.
- **Use user-facing names in chat with Bob.** "LinkedIn Remix" not "p8." "The Lingo" not "p9." Briefs, code prompts, and PR titles use internal IDs.
- **Apps Script redeploy: update the EXISTING deployment.** "New deployment" mints a new URL and silently breaks the signup pipeline.
- **Apps Script POST CORS pattern.** Browser→Apps Script POSTs must omit BOTH fetch mode key AND Content-Type header; either alone triggers preflight that silently drops.
- **Resend SDK silent-error pattern.** Resend SDK returns `{data, error}` instead of throwing. Always unpack and throw on error or sends fail silently behind a fake 200.

### Vercel runtime constraints

**Cross-directory imports between `api/*` and `src/*`: use `.js` extension, never `.mjs`.** Vercel's serverless function bundler reliably traces `.js` imports across the `api/` and `src/` directories (proven by `api/chat.js` importing from `src/data/user-guide-content.js`). `.mjs` imports across the same boundary fail at function invocation time even when local Node, the Vite client build, and unit tests all pass.

This was the cause of the 2026-05-27 production outage: PR #76 added `import { SYS } from '../src/system-prompt.mjs'` to `api/claude.js`. Local build passed, function-level tests passed, Vite client build passed. The deployed function returned `FUNCTION_INVOCATION_FAILED` on every request for 45 minutes until PR #76 was reverted (commit `940557b`).

If you need to share a constant between `api/` and `src/`:

- Prefer keeping the constant inline in both files. Use the byte-equality gate at `scripts/check-sys-equality.mjs` to prevent drift. The SYS prompt that consolidation PR #76 was trying to share is the worked example: lives inline in both `src/App.jsx` and `api/claude.js`, gated by `check-sys-equality.mjs` in the prebuild chain.
- If consolidation is necessary, use `.js` extension (not `.mjs`), and verify on a Vercel preview deploy before merging to main. The verification is a curl against `/api/health` and `/api/claude` on the preview URL; if either returns `FUNCTION_INVOCATION_FAILED`, the bundler failed to load the function and the change must not merge.
- The `.mjs` cross-directory case is not solved on this Vercel target. Do not retry it without an isolated reproducer that proves a different outcome.

**Preview-deploy smoke test before merging to api/.** Every PR that touches `api/*` or its import surface gets a manual smoke test against the Vercel preview before merge: `curl /api/health` and `curl /api/claude` (minimal valid POST). Both must return 200. `api/health.js` exists specifically to mirror the import topology of `api/claude.js`; if `claude.js` cannot load at function invocation, `health.js` cannot either, and the curl returns 500 in seconds instead of waiting for users to hit the failure.

Run the smoke automatically with `npm run smoke:preview -- <preview-url>`. The script hits `/api/health` (GET) and `/api/claude` (POST `{}`), treating 4xx as a load-proof success and any 5xx as the merge-blocking condition. Vercel preview deployments require auth; the script attaches `VERCEL_PROTECTION_BYPASS` as the `x-vercel-protection-bypass` header on every request. Generate the token once at the `career-club / reimagine2` project's Settings → Deployment Protection → Protection Bypass for Automation (the existing bypass note is `claude-code-smoke`). The same secret is exposed inside functions at deploy time as `VERCEL_AUTOMATION_BYPASS_SECRET`. Store the value locally as the Windows user env var `VERCEL_PROTECTION_BYPASS`; see `.env.local.example`. Note: Claude Code inherits its env block at process launch, so a Windows user env var added mid-session won't reach Code until the harness is fully closed and reopened (a `/restart` inside the session is not enough).

---

## 9. GitHub operations (gh flow)

For pull request operations in this repo (open, watch CI, merge), use the `gh` CLI directly via Bash. `gh` was installed via `winget install GitHub.cli` and authenticated via `gh auth login` on 2026-05-20 — auth persists across sessions under the current Windows user.

**Standing workflow for every PR:**

1. Push the branch after static gates pass.
2. Open the PR with `gh pr create --title "<title>" --body-file <temp-markdown-file>`. Write the body to a temp file first to avoid shell-escaping issues with long markdown.
3. Watch CI with `gh pr checks --watch` until it returns success.
4. Merge with `gh pr merge --squash` once CI is green and no conflicts.
5. Report the PR URL and the merge commit SHA when done.

**PATH note for git-bash sessions.** `gh.exe` lives at `C:\Program Files\GitHub CLI\gh.exe` on Windows. winget puts it on the Windows PATH, but git-bash doesn't fully inherit that PATH. At the top of any session that will use `gh`, run:

```
export PATH="/c/Program Files/GitHub CLI:$PATH"
```

If `gh` is not found on first invocation, this is the fix — not a re-install.

**Do not:**

- Look for or attempt to install a GitHub MCP connector. The `gh` CLI is the chosen path for this repo; the MCP layer adds friction without payoff for our PR pattern.
- Hand the user a URL and ask them to paste title/body manually. That pattern is retired now that `gh` is available.
- Skip CI watching. Always confirm checks pass before merging.

If `gh auth status` ever returns "not logged in" (e.g., after a credential expiry), surface that to the user and ask them to re-run `gh auth login` rather than falling back to the URL-paste pattern.

---

## 10. Product north star

Delight the user; word-of-mouth is the engine. Specific delight dimensions:

- **Recognition.** The user reads themselves and thinks "yes, that's me."
- **Agency.** Information is on the table; the user decides.
- **Specificity.** The output is precise to this user, not boilerplate that could lift onto another profile.
- **Surprise.** Reimagine surfaces something the user knows but couldn't articulate.
- **Honesty.** Reimagine tells the truth, including when inputs are thin. Honest absence beats fabricated inclusion.
- **Identity confirmation followed by movement.** The user feels seen, then moved forward — not stuck reflecting.

When CTO / CPO / Consumer Insights / Marketing / Design-UX roles disagree internally, delight is the tiebreaker.

---

## 11. Known gaps and deferrals

- **Mobile responsiveness.** Reimagine is desktop-first with hardcoded widths. Portrait phone view is broken; landscape works "good enough." Every brief notes mobile implications until a Complete Mobile Responsiveness brief lands.
- **V2 launch bundle.** Accounts, paywall, referral, analytics, infrastructure, support — bundled launch planned. Brief at `Output/briefs/2026-05-04_reimagine-launch-plan.md`.
- **MYOW corpus injection** into Personal Brand synthesis. Open verification gate from the KYV consolidation work.
- **No BLS/Lightcast labor-market integration.** Intentional. Anti-linear by design. Native LLM training produces both linear and lateral answers.
- **Skills architecture is LLM-only.** No canonical taxonomy layer, no SkillNer, no Lightcast Open Skills IDs, no O*NET joins. Revisit only for B2B/TA features needing exact-match joins.

---

## 12. Where the source of truth lives for specific topics

- **Audit findings:** `Output/audits/YYYY-MM-DD_pm-packet.md` and the associated `_findings.json` sidecar.
- **Implementation briefs:** `Output/handoff/`.
- **User-facing copy authority:** `src/data/user-guide/` (canonical). The workspace path `Output/docs/reimagine-user-guide/` is deprecated; see Section 7.
- **System architecture docs:** `Output/docs/reimagine-system-documentation/`. Chapter 11 is the changelog updated on every infrastructure-touching brief.
- **Voice patterns:** `src/voice-patterns.mjs` (HARD_PATTERNS) and `scripts/check-voice.mjs` (the gate).
- **Step labels & invariants:** `META` in `src/App.jsx`, `STEP_LABELS` in `src/components/Chat.jsx`, step-id table in `api/chat.js`, invariant enforced by `scripts/check-prompt-refs.mjs`.

---

## 13. Quick reference: things to never do

- Do not invent values. If a placeholder needs a real value (Apps Script SHEET_ID, env var, etc.) and the real value is not findable, surface back to Bob rather than commit a placeholder.
- Do not auto-update `Output/audits/_status.json`. That file is Bob's via the dashboard.
- Do not bypass the voice gate. The `voice-allow` regions are documented exceptions; do not silently add more.
- Do not bundle unrelated changes into one PR. Batch updates during beta are about cadence, not about cramming.
- Do not include time or effort estimates in briefs or PR descriptions.
- Do not ship improvements directly to beta users between feedback cycles; the batch is what shipped between cycles.
- Do not call features by internal IDs in user-facing copy. "Interview Prep" not "p11." "The Lingo" not "p9."
- Do not retain placeholder text in shipped files. If a brief leaves an interactive choice for Code, surface it back rather than guessing.
