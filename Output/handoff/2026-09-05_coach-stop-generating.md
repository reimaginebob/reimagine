## Prompt for Code

Apply the changes in this brief to `src/components/Chat.jsx`, premise-verify the anchors below against current `main`, run the static gates, add a source-level regression test following the pattern of its siblings, then follow the gh flow in section 9 of CLAUDE.md: push, open the PR, watch CI, squash-merge once green, and report the PR URL and merge SHA.

---

## Date / Type / Source

2026-09-05. Implementation brief, single gap out of a larger consult. Source: `Output/handoff/2026-09-05_my-coach-best-practices-audit-consult.md` (My Coach best-practices audit, Gap 1 — "No way to interrupt or stop a reply in progress"), sequenced second after Gap 3 (focus-return, shipped as PR #725), by Bob's own priority call: the widest-reaching of the three named gaps, since it affects every user rather than an accessibility subset.

## Pre-flight discovery (scope correction)

Re-verified against `main` at HEAD `74a5178`:

- Confirmed (again) via full-file search: no `AbortController`, `abort`, `cancel`, or `regenerat` anywhere in `Chat.jsx`. The only way to stop an in-flight reply today is the "Clear" control, which wipes the entire conversation, not just the current answer.
- **This is not a theoretical gap.** `api/coach.js`'s `max_tokens` was raised from 4000 to 8000 on 2026-08-28 specifically because a real production reply ran the 4000-token ceiling out and was cut off mid-sentence (comment at `api/coach.js:1390-1394` cites the longest observed reply at ~4.6k characters). Long replies are a real, recurring shape in production, not an edge case — raising this gap's priority above where the consult itself guessed ("very plausibly short enough it doesn't matter in practice").
- The request lifecycle lives entirely in `send()` (`Chat.jsx:387-689`), a single `try/catch/finally` around one `fetch` to `/api/coach` followed by a `while (true)` stream-reading loop (`Chat.jsx:476-486`). Only one `send()` can be in flight at a time — both the silent and explicit paths return early if `loading` is already true (`Chat.jsx:389`) — so a single `AbortController` ref, not a collection, is sufficient.
- **A real pitfall the consult did not catch.** The existing `catch` block (`Chat.jsx:672-685`) unconditionally overwrites the last message with "Sorry, I could not reach your coach just now" on *any* thrown error. Aborting a `fetch` throws a `DOMException` named `AbortError`. Without a special case, clicking Stop would look exactly like a network failure and would erase whatever text had already streamed in and was visible to the person — the opposite of what "stop, but keep what I have" should do. This brief's catch block distinguishes the two.
- **A second edge case the fix needs to handle:** if Stop is clicked before any text has streamed back yet, the message placeholder pushed at the start of `send()` (`{ role: 'assistant', content: '' }`, `Chat.jsx:396` non-silent / `Chat.jsx:441` silent) is still empty. Left alone, that would sit in the transcript forever as an empty gray bubble. The abort branch removes it when (and only when) it is still empty.
- The Send button (`Chat.jsx:871-882`) already fully encodes the `loading` state (disabled, dimmed, cursor). This brief turns it into a Send/Stop toggle in place, rather than adding a second control — one button, one slot, same as every other surface in this file.
- `inputRow` (containing the button) is a single shared `const`, rendered at both `Chat.jsx:916` (embedded) and `Chat.jsx:1077` (floating open panel) — one change covers both surfaces, consistent with how every other control in this file already works.
- Not a user-facing "capability" in the CLAUDE.md sense (nothing new to explain in the user guide, no new Coach-nav-map entry) — this is control over an existing interaction, not a new one. Matches the precedent of its Gap 3 sibling (PR #725), which shipped with no doc changes.

## Files affected

| File | Change |
|---|---|
| `src/components/Chat.jsx` | `AbortController` wired into the `fetch`; catch block distinguishes user-initiated abort from a real failure and cleans up an empty placeholder; Send button becomes a Send/Stop toggle while `loading` |
| `scripts/test-coach-stop-generating.mjs` | New source-level regression test |
| `package.json` | New test wired into the `test` chain |

## Specific changes

**1. `src/components/Chat.jsx` — add the abort ref.**

Locate (exact current text):

```
  const sendRef = useRef(null)
```

Replace with:

```
  const sendRef = useRef(null)
  // Stop generating (accessibility/UX audit, 2026-09-05, Gap 1): holds the
  // AbortController for whichever request is currently in flight, so the
  // Send button can double as Stop while loading. Only one send() can run at
  // a time (the guard at the top of send() below returns early if loading is
  // already true), so a single ref is enough -- no collection needed.
  const abortRef = useRef(null)
```

**2. Wire the controller into the `fetch` call.**

Locate (exact current text):

```
    try {
      const res = await fetch('/api/coach', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
```

Replace with:

```
    const controller = new AbortController()
    abortRef.current = controller
    try {
      const res = await fetch('/api/coach', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
```

**3. Distinguish a user-initiated stop from a real failure in the catch block, and clean up an empty placeholder.**

Locate (exact current text):

```
    } catch {
      // A silent open never pushed a placeholder to overwrite here (it only
      // does that once a real, non-204 response is in hand) -- so on a thrown
      // error (network down, etc.) there is nothing of its own to fail into,
      // and clobbering whatever the transcript's real last message happens to
      // be would be worse than saying nothing. Fail exactly as silently as
      // the 204/!res.ok branches above do.
      if (!silent) {
        setMessages(m => {
          const copy = [...m]
          copy[copy.length - 1] = { role: 'assistant', content: 'Sorry, I could not reach your coach just now. Try again in a moment.' }
          return copy
        })
      }
    } finally {
      setLoading(false)
    }
  }
```

Replace with:

```
    } catch (err) {
      if (err && err.name === 'AbortError') {
        // The person clicked Stop. Whatever streamed in before the click is
        // already the last message's content -- it was updated on every
        // chunk as it arrived -- so there is nothing to restore and nothing
        // to apologize for. The one cleanup this needs: stopping before any
        // text arrived at all would otherwise leave an empty bubble sitting
        // in the transcript forever.
        setMessages(m => {
          const last = m[m.length - 1]
          if (last && last.role === 'assistant' && !last.content) return m.slice(0, -1)
          return m
        })
      } else if (!silent) {
        // A silent open never pushed a placeholder to overwrite here (it only
        // does that once a real, non-204 response is in hand) -- so on a thrown
        // error (network down, etc.) there is nothing of its own to fail into,
        // and clobbering whatever the transcript's real last message happens to
        // be would be worse than saying nothing. Fail exactly as silently as
        // the 204/!res.ok branches above do.
        setMessages(m => {
          const copy = [...m]
          copy[copy.length - 1] = { role: 'assistant', content: 'Sorry, I could not reach your coach just now. Try again in a moment.' }
          return copy
        })
      }
    } finally {
      abortRef.current = null
      setLoading(false)
    }
  }
```

**4. Turn the Send button into a Send/Stop toggle.**

Locate (exact current text):

```
      <button
        onClick={send}
        disabled={loading || !input.trim()}
        style={{
          background: C.gold, color: '#fff', border: 'none',
          borderRadius: 8, padding: '8px 14px', cursor: loading || !input.trim() ? 'default' : 'pointer',
          fontFamily: 'inherit', fontSize: 17, fontWeight: 600,
          opacity: loading || !input.trim() ? 0.6 : 1,
        }}
      >
        Send
      </button>
```

Replace with:

```
      <button
        onClick={loading ? () => { if (abortRef.current) abortRef.current.abort() } : send}
        disabled={!loading && !input.trim()}
        style={{
          background: loading ? '#fff' : C.gold, color: loading ? C.gold : '#fff',
          border: loading ? `1px solid ${C.gold}` : 'none',
          borderRadius: 8, padding: '8px 14px', cursor: (!loading && !input.trim()) ? 'default' : 'pointer',
          fontFamily: 'inherit', fontSize: 17, fontWeight: 600,
          opacity: (!loading && !input.trim()) ? 0.6 : 1,
        }}
      >
        {loading ? 'Stop' : 'Send'}
      </button>
```

Note: the textarea directly above this button keeps its existing `disabled={loading}` — a person still cannot type a new message while one is streaming, only stop the current one. Unchanged, not part of this brief.

## Voice rules on inserted text

The only new user-facing string is the single word "Stop" on a button, replacing "Send" while a reply streams — a standard, universally understood control label, not prose. No voice rule applies; `check-voice`'s `FILES_TO_CHECK` does not scan this file's control labels for the HARD_PATTERNS (which target prose constructions), and none of those patterns could plausibly match a bare "Stop"/"Send" toggle regardless.

## Static gates

- `npm run build` clean (full prebuild chain: `check-voice`, `check-sys-equality`, `check-prompt-refs`, `check-coach-nav-map`, `check-scope-lenses`, `check-orphans`, `check-fontsize`, `check-btn-prominence`, `check-guide-refs`, `check-user-guide-pdf`, `npm run test`, `npm run lint`)
- `check-fontsize` / `check-btn-prominence`: the new Stop state reuses the same button element and font size as the existing Send button (17px, already above the 16px tappable-label floor) — no new ratchet risk.
- `src/App.jsx` untouched; `src/components/Chat.jsx` EOF integrity preserved before and after
- Diff scope limited to the two files named above (plus the new test)

## Runtime gate (post-merge, optional)

Bob (or Cowork-Claude) can verify in production: ask Coach a question likely to produce a long answer, click Stop partway through, and confirm (a) the partial answer stays visible rather than vanishing or being replaced by an error, (b) the input re-enables immediately, and (c) clicking Stop before any text has streamed back at all removes the empty bubble cleanly rather than leaving a blank one.

## Constraints

Single PR. No effort estimates. PR title: "Let Coach's reply be stopped mid-stream."

## Out of scope

Gap 2 (no screen-reader live region on the transcript) is separately sequenced, not touched here. No change to the textarea's own disabled-while-loading behavior, no "regenerate" or "try a different answer" affordance (the consult named only "interrupt," not "retry," as the documented gap), no change to the Clear control.

## Commit message

```
Let Coach's reply be stopped mid-stream

The only way to stop a reply in progress was Clear, which wipes the
entire conversation, not just the current answer. Nielsen's "user
control and freedom," reinterpreted for chat, calls out the ability
to interrupt as a marker of good conversational UX -- and this isn't
theoretical: api/coach.js's max_tokens was doubled on 2026-08-28
because a real reply already ran long enough to get cut off
mid-sentence, so long replies are a recurring shape in production,
not an edge case.

An AbortController now backs the one in-flight request send() ever
allows (a second call already no-ops while loading is true), and the
Send button doubles as Stop while a reply streams.

The catch block distinguishes a user-initiated abort from a real
failure -- naively, aborting throws just like a dropped connection
does, and the existing catch overwrote the last message with an
apology on any thrown error. Left alone, clicking Stop would have
looked exactly like a network failure and erased the partial answer
the person could already see, which is backwards. The one cleanup
still needed: stopping before any text streamed back at all leaves an
empty placeholder bubble, which the abort branch now removes rather
than leaving behind forever.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Qbsj3ds9Cfozte1ASdRrDx
```

## Push

Branch off current `main`, PR, CI, squash-merge per section 9. Vercel auto-deploys from `main` on merge.

## Implementer's checklist

1. Pull `main`, confirm HEAD.
2. Re-grep the anchors above; confirm no drift.
3. Apply the four file changes.
4. Add the new test file; wire it into `package.json`.
5. Run `npm run build` (full gate chain); confirm clean.
6. Verify `Chat.jsx` EOF (line count + closing brace) before and after.
7. Commit, push, open PR, subscribe to activity, watch CI, squash-merge.
8. Report PR URL and merge SHA.
