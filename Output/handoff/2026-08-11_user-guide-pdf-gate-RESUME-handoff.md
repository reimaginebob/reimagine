# Resume handoff: user-guide PDF freshness gate (to the Code sibling who started it)

**Date:** 2026-08-11
**From:** a sibling Code session that was working in `~/reimagine` at the same time (shipping unrelated feedback-bug fixes — PRs #370–#374).
**To:** the session that started the user-guide-PDF freshness gate and got paused.
**TL;DR:** Your WIP is 100% intact. Nothing of yours was committed, clobbered, or lost. You're one step from done: **record the hash file, then commit the set.**

---

## Your work is safe — here's exactly what's in the tree

All uncommitted, on top of current `main`:

- `scripts/lib/user-guide-hash.mjs` (new) — `computeSourceHash()`, `HASH_FILE`, `chapterFiles()`. `HASH_FILE = src/data/user-guide/PDF-SOURCE.hash`.
- `scripts/check-user-guide-pdf.mjs` (new) — the prebuild gate: fails if `PDF-SOURCE.hash` is missing, or if the current chapter hash ≠ the recorded one.
- `scripts/write-user-guide-hash.mjs` (new) — writes `PDF-SOURCE.hash = computeSourceHash()`; wired to run after the Python PDF build.
- `package.json` (modified) — `prebuild` now calls `check-user-guide-pdf.mjs` (after `check-fontsize`, before `test`); `build:user-guide-pdf` now chains `... && node scripts/write-user-guide-hash.mjs`.
- `public/reimagine-user-guide.pdf` (modified) — your regenerated PDF.

(Also untracked but NOT part of this work / not mine to speak to: `Output/`, `docs/focus-playbook-*.md`, `docs/playbook-ux-review.md`, `scripts/eval-simple-vs-elaborate.mjs`.)

## What's blocking the build right now

`npm run build` fails with:

```
check-user-guide-pdf: FAIL — no source hash recorded for the PDF.
```

That's expected — you wrote the gate and the writer, but **`src/data/user-guide/PDF-SOURCE.hash` was never created**, so the gate has nothing to compare against. It does not exist yet on disk.

## Pick up here (one step + commit)

1. Record the hash (and refresh the PDF so they're guaranteed consistent):
   ```bash
   npm run build:user-guide-pdf
   ```
   This runs the Python build then `write-user-guide-hash.mjs`, producing `src/data/user-guide/PDF-SOURCE.hash`. (Python note: there's no default `python3` on this machine — it's installed at `AppData\Local\Programs\Python\Python312-arm64`. If `python3` isn't found, that's the runtime to point at, per the project's PDF-build setup. If you trust the already-regenerated PDF and only need the hash, `node scripts/write-user-guide-hash.mjs` alone writes it — but the full command above is safer.)
2. Confirm the gate passes:
   ```bash
   npm run build
   ```
   Expect `check-user-guide-pdf: OK (N chapters; PDF in sync with source)`.
3. Commit the whole set together so they never drift apart:
   `scripts/lib/user-guide-hash.mjs`, `scripts/check-user-guide-pdf.mjs`, `scripts/write-user-guide-hash.mjs`, `package.json`, `public/reimagine-user-guide.pdf`, **and the new `src/data/user-guide/PDF-SOURCE.hash`**.

## What I did that touched your files (so nothing surprises you)

- **I never committed any of your files.** My five PRs (#370–#374) each staged **only** `src/App.jsx` (and one also `api/claude.js`) — never `package.json`, the PDF, or your scripts. Confirm with `git log --stat origin/main` if you want.
- To build/validate my own changes against a clean gate chain, I ran `git stash push -- package.json` a handful of times (your incomplete gate was failing `npm run build` locally) and **`git stash pop`'d it back every time.** Your `package.json` edit is present and unchanged (`git status` shows it still `M`).
- **`main` moved** while you were paused: `d9dfefc → 816691d` (my 5 squash-merges). All were `src/App.jsx` / `api/claude.js` only — **disjoint from your files**, so your uncommitted WIP sits cleanly on top with no conflict.

## Two things to ignore

- `git stash list` shows `crashed-admin-analytics-uncommitted` and `auto-stash before claude-md task`. **Neither is mine** — mine were all popped. Leave them; they're unrelated to this work.
- The `check-sys-equality` gate is unrelated to yours (it guards the `SYS_BASE` byte-match between `api/claude.js` and `src/App.jsx`); I touched `SYS_BASE` in #371, both copies stay in sync, no action for you.
