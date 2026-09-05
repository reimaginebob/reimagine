## Prompt for Code

Apply the changes in this brief to `src/components/Chat.jsx`, premise-verify the anchors below against current `main`, run the static gates, add a source-level regression test following the pattern of its siblings (`test-coach-message-collapse.mjs`, `test-coach-banner.mjs`), then follow the gh flow in section 9 of CLAUDE.md: push, open the PR, watch CI, squash-merge once green, and report the PR URL and merge SHA.

---

## Date / Type / Source

2026-09-05. Implementation brief, single gap out of a larger consult. Source: `2026-09-05_my-coach-best-practices-audit-consult.md` (My Coach best-practices audit, Gap 3 — "Focus doesn't return to the trigger button on close"), sequenced first by Bob after Code's own verification pass confirmed all three named gaps against live code. This brief covers Gap 3 only; Gaps 1 and 2 are separately sequenced, not in scope here.

## Pre-flight discovery (scope correction)

Re-verified against `main` at HEAD `1faefad` (same commit the consult was read against — no drift):

- The floating panel's close button (`onClick={() => setOpen(false)}`) and its `aria-label="Close"` are exactly where the consult cited them.
- The `Escape` key handler (`if (e.key === 'Escape') setOpen(false)`) is exactly where cited, gated on `!embedded && open`.
- The trigger bubble button (the gold circle with the "?" glyph) that the consult cited has no `ref` today — confirmed by a full-file search for `useRef` and `Ref` declarations; nothing in the file already tracks this button.
- **Correction to the consult's own proposed fix shape.** The consult suggested "a ref on the bubble button and a `.focus()` call in the close handler and the Escape handler both" — i.e., two separate call sites. That would work, but there's a cleaner shape available and this brief uses it instead: the bubble button and the open panel are two different JSX branches of one early-return (`if (!open) return (...)` vs the open-panel return), so the bubble's DOM node does not exist yet at the instant either close handler fires — it is created fresh on the next render, once `open` flips to `false`. A single `useEffect` keyed on the `open` state (fires after React has committed the closed-panel render, so the bubble's DOM node is guaranteed to exist) is both simpler than duplicating a `.focus()` call in two handlers and correct in a way a same-tick call inside the handlers would not reliably be. The effect also needs to skip the very first render (nothing was "closed" yet — there is no invoking interaction to return focus to on initial page load), which the consult's proposed shape did not address at all.
- Confirmed the embedded (My Coach full-page) variant has no bubble and no open/close state of its own (`embedded` short-circuits the `Escape` effect already, per the existing comment at the top of that effect) — this fix touches the floating variant only, no cross-variant complication.
- Not a user-facing "capability" change (no new thing to document, no Coach feature-catalog entry) — CLAUDE.md's "docs stay current with every feature change" does not apply here, matching the precedent of its sibling accessibility/polish fixes (e.g. #720's collapse-to-strip shipped with no user-guide or Coach-nav-map changes).

## Files affected

| File | Change |
|---|---|
| `src/components/Chat.jsx` | New ref on the trigger bubble button; new effect that returns focus to it when the panel closes |
| `scripts/test-coach-focus-return.mjs` | New source-level regression test |
| `package.json` | Wire the new test into the `test` script chain |

## Specific changes

**1. `src/components/Chat.jsx` — add the ref and the focus-return effect.**

Locate (exact current text):

```
  const [generalMode, setGeneralMode] = useState(false)
  const [open, setOpen] = useState(false)
  // App bumps openRequest to open the floating coach programmatically (e.g. the
  // Personal Brand check-in on first arrival at Put it to Work).
  useEffect(() => { if (openRequest) setOpen(true) }, [openRequest])
```

Replace with:

```
  const [generalMode, setGeneralMode] = useState(false)
  const [open, setOpen] = useState(false)
  // App bumps openRequest to open the floating coach programmatically (e.g. the
  // Personal Brand check-in on first arrival at Put it to Work).
  useEffect(() => { if (openRequest) setOpen(true) }, [openRequest])
  // Focus-return on close (accessibility audit, 2026-09-05): a keyboard or
  // screen-reader user who opens the floating coach and then closes it --
  // either the panel's own Close button or Escape, both just set open:false --
  // was left with focus fallen back to <body>, with no way to tell where they
  // landed. The trigger bubble and the open panel are two different branches
  // of one early-return, so the bubble's DOM node does not exist yet at the
  // instant either close handler fires; it exists once this component
  // re-renders into the closed branch. A single effect keyed on `open` (not a
  // .focus() call duplicated inside both close handlers) fires after that
  // render has committed, and skips the very first render via wasOpenRef --
  // there is nothing to return focus TO on initial page load, since nothing
  // was closed yet. Floating only: the embedded My Coach view has no bubble
  // and no open/close state of its own.
  const bubbleBtnRef = useRef(null)
  const wasOpenRef = useRef(false)
  useEffect(() => {
    if (!embedded && !open && wasOpenRef.current && bubbleBtnRef.current) bubbleBtnRef.current.focus()
    wasOpenRef.current = open
  }, [open, embedded])
```

Locate (exact current text — the trigger bubble button):

```
              <button
                onClick={() => { setOpen(true); if (onDismissPulse) onDismissPulse() }}
                style={{
                  background: C.gold, color: '#fff', border: 'none',
                  borderRadius: '50%', width: 56, height: 56,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  fontSize: 22, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700,
                  animation: (showPulse && !bannerMsg) ? 'pe-chat-pulse-scale 2s ease-in-out infinite' : 'none',
                }}
                aria-label={thinking ? 'Coach is thinking. Open My Coach' : (showPulse ? 'Talk to your coach. Open My Coach' : 'Open My Coach')}
              >
```

Replace with (only the added `ref` prop):

```
              <button
                ref={bubbleBtnRef}
                onClick={() => { setOpen(true); if (onDismissPulse) onDismissPulse() }}
                style={{
                  background: C.gold, color: '#fff', border: 'none',
                  borderRadius: '50%', width: 56, height: 56,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  fontSize: 22, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700,
                  animation: (showPulse && !bannerMsg) ? 'pe-chat-pulse-scale 2s ease-in-out infinite' : 'none',
                }}
                aria-label={thinking ? 'Coach is thinking. Open My Coach' : (showPulse ? 'Talk to your coach. Open My Coach' : 'Open My Coach')}
              >
```

**2. `scripts/test-coach-focus-return.mjs` (new file).** Source-level, matching the pattern of its siblings — this needs a real signed-in browser session to exercise end to end. Assert:
- `bubbleBtnRef` and `wasOpenRef` are declared.
- The bubble `<button>` carries `ref={bubbleBtnRef}`.
- The effect body checks `!embedded && !open && wasOpenRef.current && bubbleBtnRef.current` before calling `.focus()` — losing any one of those four conditions would either focus-steal on first mount, fire for the embedded variant (which has no bubble to focus), or fire while the panel is still open.
- The effect's dependency array is `[open, embedded]`.

**3. `package.json`.** Add `&& node scripts/test-coach-focus-return.mjs` to the end of the `test` script chain (after `test-coach-voice-gate-wiring.mjs`).

## Voice rules on inserted text

No user-facing copy is added or changed — this is a code-only accessibility fix (no new strings, no prompt text, no UI copy). Voice gate is a no-op here; running it is still part of the standard gate chain.

## Static gates

- `npm run build` clean (full prebuild chain: `check-voice`, `check-sys-equality`, `check-prompt-refs`, `check-coach-nav-map`, `check-scope-lenses`, `check-orphans`, `check-fontsize`, `check-btn-prominence`, `check-guide-refs`, `check-user-guide-pdf`, `npm run test`, `npm run lint`)
- `check-voice`: 0/0 (no copy touched)
- `check-prompt-refs`: 0
- `src/App.jsx` EOF integrity preserved (not touched by this brief, but re-verify line count/closing tag as standing practice)
- `src/components/Chat.jsx` EOF integrity preserved before and after
- Diff scope limited to the three files named above

## Runtime gate (post-merge, optional)

Bob (or Cowork-Claude) can verify in production: open My Coach via the floating bubble using only the keyboard (Tab to the bubble, Enter to open), then close it with Escape — focus should land back on the bubble button, visibly indicated by the browser's default focus ring. Repeat closing via the panel's own × button.

## Constraints

Single PR. No effort estimates. PR title: "Return focus to the coach bubble when the panel closes."

## Out of scope

Gap 1 (no way to interrupt a reply in progress) and Gap 2 (no screen-reader live region on the transcript) are separately sequenced, not touched here. No change to the embedded My Coach view, the Escape handler's existing gating, or the close button's own behavior beyond the new effect reacting to the state change they already produce.

## Commit message

```
Return focus to the coach bubble when the panel closes

A keyboard or screen-reader user who opened the floating coach, then
closed it (the panel's Close button or Escape -- both just flip
open:false), was left with focus fallen back to <body>, with no way
to tell where they landed. Standard modal/panel accessibility
guidance calls for returning focus to the control that opened it.

The trigger bubble and the open panel are two branches of one early
return, so the bubble's DOM node does not exist at the instant either
close handler fires -- it exists once the component re-renders into
the closed branch. A single effect keyed on `open` (rather than a
.focus() call duplicated inside both close handlers) fires after that
render commits, and skips the initial mount via wasOpenRef, since
there is nothing to return focus to before anything has been opened
and closed. Floating only -- the embedded My Coach view has no bubble
and no open state of its own.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Qbsj3ds9Cfozte1ASdRrDx
```

## Push

Branch off current `main`, PR, CI, squash-merge per section 9. Vercel auto-deploys from `main` on merge.

## Implementer's checklist

1. Pull `main`, confirm HEAD.
2. Re-grep the three anchors above; confirm no drift.
3. Apply the three file changes.
4. Add the new test file; wire it into `package.json`.
5. Run `npm run build` (full gate chain); confirm clean.
6. Verify `Chat.jsx` EOF (line count + closing brace) before and after.
7. Commit, push, open PR, subscribe to activity, watch CI, squash-merge.
8. Report PR URL and merge SHA.
