## Prompt for Code

Apply the changes in this brief to `src/voice-patterns.mjs` (renamed), its four import sites, and `api/coach.js`, premise-verify the anchors below against current `main`, run the static gates, add a source-level regression test, then follow the gh flow in section 9 of CLAUDE.md: push, open the PR, watch CI, and **in addition to the automated smoke check, manually confirm `/api/coach` itself loads on the preview** (the automated check only exercises `/api/health` and `/api/claude`, neither of which shares this PR's new import) before merging. Report the PR URL, merge SHA, and the manual `/api/coach` verification result.

---

## Date / Type / Source

2026-09-05. Implementation brief, arising directly from Bob's question after the "Here's the real shape of it" / "the arc" live catch: "Shouldn't we fix this then? I'd rather a few extra seconds and even a call rather than producing content I disapprove of." He is asking for the same silent pre-display retry Personal Brand/Focus Playbook generation already gets (`callClaudeWithVoiceGate`, `src/App.jsx`), applied to My Coach chat.

## Pre-flight discovery (scope correction — this changed the brief's whole shape)

My first answer to Bob (and CLAUDE.md's own standing note on this) was that Coach chat "streams live to the screen and cannot go through the silent pre-display retry." **That claim does not match the code and needed correcting before this brief could be written accurately:**

- **The Anthropic call in `api/coach.js`'s `generate()` (line ~1419) does not set `stream: true`.** It is an ordinary blocking POST; the server holds the complete reply before it does anything with it. The comment immediately above the existing retry block says so directly (`api/coach.js:1503-1505`): "the upstream call is buffered (non-streaming) rather than piped token-by-token: the append-only client cannot un-render text already shown." So the actual constraint that motivated `stream: true` NOT being used was already about protecting against exactly this kind of problem — buffering was already the design.
- **A pre-display regenerate-on-violation retry for Coach chat already exists** (`api/coach.js:1508-1535`, `detectResidualVoice`/`applyOutputStrippers` from `src/text-strippers.js`). It buffers, detects, regenerates once with a corrective rewrite instruction if flagged, re-detects, and keeps whichever version scores cleaner — the exact `callClaudeWithVoiceGate` pattern, already shipped, already proven safe on this endpoint. Bob's fix is not "build this from scratch"; it already exists and needs widening.
- **What it does NOT check is the actual gap.** `detectResidualVoice` (`src/text-strippers.js:1006`) covers five hand-picked categories only: comparative-standing, sincerity qualifiers, "the move" tic, sit-with register, and cited-without-source statistics. It does not know about logic-flip cadence, signposting/drama ("Here's the real shape of it"), framework names, or the jargon family just added (`the arc`) — because those live in `src/voice-patterns.mjs`'s much larger `HARD_PATTERNS`, which `api/coach.js` has never been able to import.
- **Why not: confirmed as a documented, deliberate workaround, not an open question.** `src/text-strippers.js:981-984`: "It lives here, in the `.js` module the api function already imports, because `api/*` cannot safely import the `.mjs` voice-patterns detector across the `api/src` boundary (the `FUNCTION_INVOCATION_FAILED` bundler-trace issue)." This is the same class of failure as the 2026-05-27 outage CLAUDE.md's Vercel-runtime-constraints section documents (PR #76, `system-prompt.mjs`) — but that section's own guidance says the fix is `.js`, not avoidance forever: "If consolidation is necessary, use `.js` extension (not `.mjs`), and verify on a Vercel preview deploy before merging to main."
- **The `.js` fix is already proven safe in this exact codebase, twice.** `api/coach.js` already successfully imports `src/text-strippers.js` (a plain `.js` file) across this exact boundary — that IS the workaround's own mechanism. `api/chat.js` importing `src/data/user-guide-content.js` is CLAUDE.md's own cited precedent. Renaming `src/voice-patterns.mjs` to `.js` puts it in the same proven category; nothing else about the file changes. (Node running `scripts/check-voice.mjs` and `scripts/test-voice-patterns.mjs` against a plain `.js` file with `export`/`import` syntax already happens today with no `"type": "module"` in `package.json` — confirmed by the existing benign `MODULE_TYPELESS_PACKAGE_JSON` warnings on every other `.js` module already doing exactly this, e.g. `src/autosave-gate.js`, `src/corrections.js`. Node reparses it as ESM and moves on; only Vite and the browser bundle were ever the reason `.mjs` was chosen, and Vite handles `.js` ESM natively.)
- **The real work is small: widen the existing loop, not build a new one.** Import `detectVoiceViolations` from the renamed file into `api/coach.js`, add its findings to the same trigger condition and the same before/after scoring the existing retry already does, and fold the specific violation into the same corrective-rewrite instruction style `callClaudeWithVoiceGate` uses in `src/App.jsx` ("the previous generation contained a BANNED CONSTRUCTION: ... Rewrite ..."). `detectResidualVoice` stays exactly as it is — this is additive, not a replacement, so its five categories keep their (deliberately looser) coverage alongside the new, broader check.

## Files affected

| File | Change |
|---|---|
| `src/voice-patterns.mjs` → `src/voice-patterns.js` | Rename only; no content change |
| `src/App.jsx` | Import path updated to `.js` |
| `src/components/Chat.jsx` | Import path updated to `.js` |
| `scripts/check-voice.mjs` | Import path updated to `.js` |
| `scripts/test-voice-patterns.mjs` | Import path updated to `.js` |
| `scripts/check-track-leaks.mjs` | Comment path reference updated (cosmetic) |
| `scripts/test-coach-voice-gate-wiring.mjs` | Top comment and import-path regex updated — the premise it documents ("no silent pre-display retry") is exactly what this brief changes |
| `api/coach.js` | Import `detectVoiceViolations` from `../src/voice-patterns.js`; widen the existing regenerate-on-violation retry to also trigger on and score against it |
| `scripts/test-coach-voice-gate-retry.mjs` | New regression test |

## Specific changes

**1. Rename** `src/voice-patterns.mjs` → `src/voice-patterns.js` (`git mv`). Update the file's own header comment (currently explains why it is `.mjs`; rewrite to explain why it is plain `.js` — Node handles the ESM syntax fine without the extension, and `.js` is what lets `api/coach.js` import it across the Vercel function boundary, matching the proven `src/text-strippers.js` pattern).

**2. Update four import sites**, changing `'../voice-patterns.mjs'` / `'./voice-patterns.mjs'` / `'../src/voice-patterns.mjs'` to the `.js` equivalent in: `src/App.jsx:5`, `src/components/Chat.jsx:5`, `scripts/check-voice.mjs:3`, `scripts/test-voice-patterns.mjs:19`. Update the path-reference comments in `src/App.jsx:427,507` and `scripts/check-track-leaks.mjs:35` for accuracy (no functional effect).

**3. `scripts/test-coach-voice-gate-wiring.mjs`** — update the top comment (currently states the exact claim this brief corrects: "Coach's live chat replies stream token-by-token straight into the visible UI... there is no silent pre-display retry here") and the import-path regex (`\.\.\/voice-patterns\.mjs` → `\.\.\/voice-patterns\.js`) at line 24.

**4. `api/coach.js` — import.** Add `detectVoiceViolations` to the import from `../src/voice-patterns.js` (new import line; nothing else from that module is needed here).

**5. `api/coach.js` — widen the retry** (`api/coach.js:1515-1535`). Locate:
```js
  const flags = detectResidualVoice(cleaned)
  if (flags.comparative || flags.sincerity || flags.theMove || flags.sitWith || flags.citedStat) {
    const wants = []
    if (flags.comparative) wants.push('do not compare me to "most people", or to "most"/"many"/"every"/"all"/"any" of a group (candidates, leaders, professionals, hiring managers, recruiters), or to anyone else — drop the comparison and state what is true about me directly')
    if (flags.sincerity) wants.push('do not announce your own honesty ("frankly", "candidly", "the honest answer", "to be honest", "being straight with you") — just say the thing')
    if (flags.theMove) wants.push('do not say "X is the move", "here\'s the play", "the key is to", or "what you want to do is" — just state the action, or "a good next step is to…"')
    if (flags.sitWith) wants.push('do not use coaching-therapy register ("sit with"/"sitting with", "lean into", "hold space for", "be present with") — say "think about" or "give it some thought"')
    if (flags.citedStat) wants.push('do not cite a statistic, percentage, or figure with a source you cannot defend ("a study found 70%", "according to LinkedIn…") — speak qualitatively or point me to where real data lives')
    const corrective = `Rewrite your previous reply for me. Keep all of the substance, the warmth, and roughly the same length, but ${wants.join('; and ')}.`
    try {
      const raw2 = await generate([...messages, { role: 'assistant', content: raw }, { role: 'user', content: corrective }])
      const cleaned2 = applyOutputStrippers(raw2)
      const flags2 = detectResidualVoice(cleaned2)
      const score = f => (f.comparative ? 1 : 0) + (f.sincerity ? 1 : 0) + (f.theMove ? 1 : 0) + (f.sitWith ? 1 : 0) + (f.citedStat ? 1 : 0)
      const useRetry = score(flags2) < score(flags)
      console.log('coach voice-retry', { user_id: user.id, before: flags, after: flags2, used: useRetry ? 'retry' : 'original' })
      if (useRetry) cleaned = cleaned2
    } catch (err) {
      console.error('coach voice-retry failed (keeping original):', err)
    }
  }
```
Replace with (adds `hardViolations` alongside the existing five `flags`, folds up to 3 named violations into the same corrective sentence, and extends the before/after score):
```js
  const flags = detectResidualVoice(cleaned)
  // Full HARD_PATTERNS set (src/voice-patterns.js) alongside the five
  // hand-picked categories above. detectResidualVoice was built as a
  // workaround for the .mjs cross-directory import failure (see its own
  // comment in src/text-strippers.js); the 2026-09-05 rename to .js clears
  // that, so this closes the gap that let "Here's the real shape of it" /
  // "the arc" reach a live reply -- neither is in detectResidualVoice's
  // five categories. Additive, not a replacement: detectResidualVoice keeps
  // its deliberately looser coverage on its five categories.
  const hardViolations = detectVoiceViolations(cleaned, { scope: 'runtime' })
  if (flags.comparative || flags.sincerity || flags.theMove || flags.sitWith || flags.citedStat || hardViolations.length) {
    const wants = []
    if (flags.comparative) wants.push('do not compare me to "most people", or to "most"/"many"/"every"/"all"/"any" of a group (candidates, leaders, professionals, hiring managers, recruiters), or to anyone else — drop the comparison and state what is true about me directly')
    if (flags.sincerity) wants.push('do not announce your own honesty ("frankly", "candidly", "the honest answer", "to be honest", "being straight with you") — just say the thing')
    if (flags.theMove) wants.push('do not say "X is the move", "here\'s the play", "the key is to", or "what you want to do is" — just state the action, or "a good next step is to…"')
    if (flags.sitWith) wants.push('do not use coaching-therapy register ("sit with"/"sitting with", "lean into", "hold space for", "be present with") — say "think about" or "give it some thought"')
    if (flags.citedStat) wants.push('do not cite a statistic, percentage, or figure with a source you cannot defend ("a study found 70%", "according to LinkedIn…") — speak qualitatively or point me to where real data lives')
    // Same corrective style callClaudeWithVoiceGate uses in src/App.jsx: name
    // the actual matched text, not a generic reminder, so the fix targets
    // exactly what fired. Capped at 3 so a reply with many small hits does
    // not produce an unreadable rewrite instruction.
    for (const v of hardViolations.slice(0, 3)) wants.push(`do not write "${String(v.match).replace(/"/g, '\\"').slice(0, 160)}" or anything shaped like it (${v.note})`)
    const corrective = `Rewrite your previous reply for me. Keep all of the substance, the warmth, and roughly the same length, but ${wants.join('; and ')}.`
    try {
      const raw2 = await generate([...messages, { role: 'assistant', content: raw }, { role: 'user', content: corrective }])
      const cleaned2 = applyOutputStrippers(raw2)
      const flags2 = detectResidualVoice(cleaned2)
      const hardViolations2 = detectVoiceViolations(cleaned2, { scope: 'runtime' })
      const score = (f, hv) => (f.comparative ? 1 : 0) + (f.sincerity ? 1 : 0) + (f.theMove ? 1 : 0) + (f.sitWith ? 1 : 0) + (f.citedStat ? 1 : 0) + hv.length
      const useRetry = score(flags2, hardViolations2) < score(flags, hardViolations)
      console.log('coach voice-retry', { user_id: user.id, before: { ...flags, hard: hardViolations.map(v => v.name) }, after: { ...flags2, hard: hardViolations2.map(v => v.name) }, used: useRetry ? 'retry' : 'original' })
      if (useRetry) cleaned = cleaned2
    } catch (err) {
      console.error('coach voice-retry failed (keeping original):', err)
    }
  }
```

Bounded exactly like the existing mechanism: one retry, only on turns that actually flag (typical replies pay nothing extra), and the client-side post-stream detection (`Chat.jsx`, `detectVoiceViolations(fullText, {scope:'runtime'})` → `onVoiceViolation`) stays in place unchanged as the backstop for whatever still slips through — it now has strictly less to catch, not a reason to remove it.

## Voice rules on inserted text

No new user-facing copy — this changes detection and an internal corrective instruction the person never sees.

## Static gates

- `npm run build` clean (full prebuild chain, tests, lint, vite build)
- `check-voice`: 0/0 (the renamed file's own patterns are unchanged; `check-voice.mjs`'s import path is the only thing touched there)
- `check-sys-equality`, `check-prompt-refs`, `check-coach-nav-map`: unaffected
- Diff scope limited to the files named above

## Runtime gate (post-merge) — the extra step this brief calls out explicitly

Beyond the automated CI `smoke` check (which hits `/api/health` and `/api/claude`, neither of which shares this PR's new import surface): **manually curl `/api/coach` on the preview URL** with a minimal POST body before merging. A `FUNCTION_INVOCATION_FAILED` or 500 there means the `.js` rename did not clear the bundler issue as expected and this must not merge; a 400 ("message required" or similar auth/shape rejection) proves the function loaded and ran real logic past the new import, which is the actual proof needed — the same load-proof-via-4xx standard `smoke-preview.mjs` already uses for `/api/claude`.

Separately, for Bob: on `bob+lindsey@career.club`, try to provoke one of the newly-covered constructions in a live Coach reply (hard to force on demand, so this is opportunistic verification, not a required gate) and confirm either it does not ship, or `coach voice-retry` in the function logs shows a caught-and-corrected turn.

## Constraints

Single PR. No effort estimates. PR title: "Widen Coach's voice-gate retry to the full pattern set."

## Out of scope

`detectResidualVoice` itself is untouched — no attempt to retire it or merge its categories into `voice-patterns.js` in this pass, even though some now overlap. No change to the retry cap (still exactly one retry) or to the client-side post-stream detection in `Chat.jsx`. No change to any pattern's content in `voice-patterns.js` beyond the file rename.

## Commit message

```
Widen Coach's voice-gate retry to the full pattern set

Coach chat already had a pre-display regenerate-on-violation retry
(detectResidualVoice, src/text-strippers.js) -- contrary to this
project's own prior documentation, the reply is never actually streamed
token-by-token; the upstream call is buffered and the retry already runs
before anything reaches the client. What it did not have was full
coverage: detectResidualVoice was built as a deliberate workaround for
src/voice-patterns.mjs's .mjs extension failing to import across the
api/src Vercel function boundary, so it only checks five hand-picked
categories (comparative-standing, sincerity, "the move", sit-with, cited
stats) rather than the full HARD_PATTERNS set -- which is exactly why
"Here's the real shape of it" and "the arc" reached a live reply.

Renaming voice-patterns.mjs to .js clears the import failure (proven
safe twice already in this codebase: api/coach.js already imports
src/text-strippers.js this way, and api/chat.js imports
src/data/user-guide-content.js the same way). The existing retry now
also checks detectVoiceViolations and folds any hit into the same
corrective-rewrite instruction, additively -- detectResidualVoice keeps
its own coverage unchanged.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Qbsj3ds9Cfozte1ASdRrDx
```

## Push

Branch off current `main`, PR, CI, squash-merge per section 9 — plus the manual `/api/coach` preview curl above before merging, given this touches the exact historical failure class. Vercel auto-deploys from `main` on merge.

## Implementer's checklist

1. Pull `main`, confirm HEAD, re-grep the anchors above for drift.
2. `git mv src/voice-patterns.mjs src/voice-patterns.js`.
3. Update the four import sites and the cosmetic comment references.
4. Update `scripts/test-coach-voice-gate-wiring.mjs`'s comment and regex.
5. Add the `detectVoiceViolations` import and widen the retry block in `api/coach.js`.
6. Add the new test file.
7. Run `npm run build` (full gate chain); confirm clean.
8. Commit, push, open PR, subscribe to activity, watch CI.
9. Once CI is green, manually curl `/api/coach` on the preview URL (per the Runtime gate section) before merging — do not skip this because the automated smoke check passed, since it does not cover this import.
10. Squash-merge, report PR URL, merge SHA, and the manual verification result.
