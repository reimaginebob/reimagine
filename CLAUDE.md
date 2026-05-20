# Reimagine — Project Context for Claude Code

This file gives Claude Code the context it needs to work on Reimagine effectively. Read this on every session start.

## What Reimagine is

Reimagine is a career strategy tool by Career Club, built on Bob Goodwin's book *Making Your Own Weather*. Single-page React app, deployed to Vercel at reimagine2-two.vercel.app, currently in active beta with a small user pool.

The app walks a user through 7 phases (Orientation, Know Your Value, Explore Options, Tell Your Story, Find Your Market, Get Ready, Income Now) using LLM-generated outputs at each step. The core file is `src/App.jsx`, which contains the entire application — all components, all prompt templates (the `P` object), all state management — in one ~1,700-line file.

## Stack

- React 18 + Vite 5
- Single source file: `src/App.jsx`
- Demo data: `src/demoData.js`
- Test data: `src/testData.js`
- LLM calls go through `/api/claude` (Vercel serverless function, not in this repo unless you've added it)
- File extraction via `mammoth` (docx) and `pdf.js` (pdf)
- Icons via `lucide-react`

## Commands

- `npm install` — install dependencies (one-time, after clone)
- `npm run dev` — local dev server with hot reload
- `npm run build` — production build via Vite. Must succeed before any commit. The build catches truncated-file syntax errors that copy/paste workflows can introduce.
- `npm run preview` — preview the production build locally

## Critical conventions

### Voice rules (apply to all prompt edits in `src/App.jsx`)

The system prompt (`SYS`) and per-step prompts (`P.p1` through `P.p11`, `P.income`, `P.p_res`) follow strict voice rules. When editing any prompt:

- **No em dashes.** Use commas, periods, colons, or parentheses. The rule is absolute and applies to examples and quoted lines inside prompts. UI text (dropdown labels, placeholders) is currently exempt — do not silently clean those without flagging.
- **No logic-flip cadence.** Banned constructions: "you do not just X, you Y," "you build X, not Y," "this is not Z, it is W," "they are not evaluating A, they are picturing B." If a sentence pivots through a negation to land its point, rewrite from the positive side.
- **No AI words.** Banned list includes (non-exhaustive): "exactly," "straightforward," "unlock," "leverage," "utilize," "robust," "seamless," "game-changer," "architecting," "ecosystem," "synergy," "platform" (metaphorical), "space" (meaning industry), "deliberate transition," "navigate," "journey," "transformative," "impactful," "passionate about," "results-driven," "lean in," "double down," "circle back."
- **No intensifier words.** "genuinely," "honestly," "truly," "real" (as amplifier), "really," "actually," "absolutely," "incredibly," "extremely," "deeply," "uniquely" (when used as filler). If a sentence needs an intensifier, rewrite it.
- **Second person.** "you," "your" — never third person about the user.

### File integrity (load-bearing)

- Before editing `src/App.jsx`, run `wc -l src/App.jsx` and check the last 200 bytes end with proper closing tags (typically `</>}` then `}`). If the file ends mid-tag, it's truncated — do not edit.
- After editing, repeat the check. The line count should match expected delta from the change.
- After editing, ALWAYS run `npm run build` and confirm it succeeds before committing. Vite catches mid-tag truncation that visual review would miss.
- A 2026-04-30 truncation incident broke production for ~30 minutes. The integrity check costs five seconds.

### Push workflow

- Direct push to `main` is the default. Vercel auto-deploys.
- Do not skip pre-commit hooks unless explicitly instructed.
- Commit messages: descriptive, include why (not just what), use the imperative mood ("Add company dossier fields" not "Added"). Bob does not require Co-Authored-By attribution; include it only if explicitly requested.

### Beta-window discipline

Reimagine is in active beta feedback collection. Bob ships changes in deliberate batches, not continuously, so user feedback can be attributed to specific builds. When given an opportunistic improvement to make outside the current task scope, surface it as a suggestion rather than implementing it inline.

## Architecture references

- **`docs/architecture/underlying-drivers.md`** — scoped (not-yet-built) architecture for replacing the values capture step with a multi-source structured assessment system (Affintus structured ingest + Schwartz PVQ-21 + narrative inference + validation loop). Read Part 1 (V2 Coordination) before doing any V2 work — it specifies what NOT to modify so this future initiative has clean ground when it starts. In particular: do not redesign the values step UX or schema, do not change Affintus referral copy or prominence, do not embed any structured values assessment, do not redesign assessment ingestion logic.

## Project layout

```
reimagine/
├── CLAUDE.md                              ← this file
├── package.json
├── vite.config.js
├── vercel.json
├── docs/
│   └── architecture/
│       └── underlying-drivers.md          ← future work guardrails
├── public/                                 ← static assets
└── src/
    ├── App.jsx                             ← main file, ~1,700 lines
    ├── demoData.js                         ← Sarah Chen demo profile
    ├── testData.js                         ← test profile
    └── main.jsx                            ← React entry point
```

## When in doubt

Ask. Bob would rather answer a clarifying question than have you guess on a load-bearing decision. Especially around prompt voice, beta-window timing, and anything that touches the values step or assessment ingestion (those two areas have a future initiative scoped against them).

## GitHub operations

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
