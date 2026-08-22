# Move 3 — Connector-written "state of play" narrative for My Pipeline

**Date:** 2026-08-18
**Type:** Implementation brief (queued — do NOT start until Bob triggers)
**Source:** Consult with Bob, 2026-08-18 ("State of This Opportunity" + "State of Your Pipeline"). Moves 1 and 2 shipped in the same session; this is the third, deferred move.

---

## Prompt for Code

Apply the changes in this brief: add a small connector-written narrative field to each pursuit so Claude's Gmail/Calendar sync can record the *email-derived* half of an opportunity's state (who we're waiting on, the latest development, when the employer last moved) — the half Reimagine's server can never compute because it never sees the inbox. Surface it read-only on the pipeline card and feed it to the Coach. Premise-verify against current code first (the schema, the MCP tool, the card, and the coach injection all moved in Moves 1–2), run the static gates, and follow the gh flow. This is additive and gated behind `my_search`; do not regress the existing status fields.

---

## Why this is a separate move

Established in the 2026-08-18 consult and grounded in code:

- Reimagine (and the Coach) only ever see the **structured status** the connector pushes — stage, dates, next step, interviewers. The server **never reads Gmail/Calendar**; the user's own Claude does, and pushes back tidy fields. (Load-bearing two-phase decision; do not violate.)
- **Move 1** (shipped) fed the Coach the computable half of "state": stage, next meeting, the user's own next step + overdue, staleness, days-in-pipeline, plus a pipeline rollup — all synthesized live from `pursuit_status`, no storage. `api/coach.js` `buildPursuitStatusBlock`.
- **Move 2** (shipped) added deterministic UI: a pipeline rollup line ("N in play · N need attention · N going quiet") and a per-card "In your pipeline N days / nothing scheduled yet". `src/App.jsx` `mySearchPanel`.
- **Move 3 (this brief)** is the *email-derived* half: "the recruiter said Friday and went quiet," "they've rescheduled twice," "waiting on the hiring manager since the 12th." This cannot be computed server-side because the facts live in email. The only honest way to surface it is to let the connector — which already reads the inbox during its sync — **write a short narrative back** as a structured field.

## Design (proposed; confirm with Bob before building)

**One new nullable column on `pursuit_status`, connector-written:**

- `situation_note text` — a short (≤ ~280 char) plain-language "state of play" the connector composes from what it read: latest development and/or who the user is waiting on. NUL-stripped like `next_move`. Nullable; absent for anyone not running the connector.

Optionally, if Bob wants the "dragging on relative to what was promised" signal to be first-class rather than prose:

- `last_contact_at timestamptz` — when the employer last moved (last inbound email / completed meeting), connector-written. Enables a deterministic "quiet for N days" that is real (vs. Move 2's `updated_at` proxy, which only measures when the *user* last edited).

Recommend shipping `situation_note` first (smallest, highest signal); treat `last_contact_at` as a fast-follow only if the prose version proves too soft.

**Migration:** `migrations/YYYY-MM-DD_pursuit-situation-note.sql` — `ALTER TABLE pursuit_status ADD COLUMN IF NOT EXISTS situation_note text;` (forward-only, idempotent; auto-applies on deploy).

## Files affected

| File | Change |
|---|---|
| `migrations/…_pursuit-situation-note.sql` | New column `situation_note` (+ `last_contact_at` if Bob approves it). |
| `api/mcp.js` | `update_pursuit` gains a `situation_note` param (validated, length-capped, NUL-stripped); written through the same read-merge-write core. Tool description teaches the model WHEN to write it (a factual state-of-play from what it read — never speculation) and what NOT to (no inferring silence beyond what the email shows). `list_pursuits` returns `situation_note` so the connector can update rather than clobber. |
| `api/pursuit-status.js` | `writeCore` accepts/merges `situation_note` (mirror the existing `next_move` handling: NUL-strip, length cap, read-merge-write). |
| `api/coach.js` | `buildPursuitStatusBlock` reads `situation_note` and adds it to each opportunity's line as the connector's note, clearly labeled as "reported by their assistant from email/calendar" so the Coach treats it as an observed fact it may reflect — but the existing guard stays: the Coach still never manufactures email events on its own; it only relays what the note actually says. Add `situation_note` to the `SELECT` in the handler's pursuit read. |
| `src/App.jsx` (`mySearchPanel`) | Render `situation_note` read-only on the card when present — a short quoted "state of play" line under the deterministic Move 2 line, with the instruction/aside visual treatment (it is assistant-reported context, not a user control). Distinct from the user's own editable `next_move`. |
| `src/data/user-guide/my-playbooks.md` (or the pipeline chapter at GA) | Deferred per the pilot doc exception — gated feature, not in the guide/`FEATURE_MAP` until GA. Note it in the GA doc-trigger list. |

## Load-bearing constraints (carry forward)

- **Connector writes, server never reads email.** `situation_note` is only ever populated by the user's own Claude via `update_pursuit`. Reimagine composes nothing from the inbox itself.
- **Read-merge-write, UPSERT.** Same clobber-avoidance as every other pursuit field — never blank-out an unspecified field; `list_pursuits` must return the note so the connector merges.
- **Honesty/voice.** "Employer went silent / missed a commitment" is an evidence-bearing claim. The connector may write it only as a fact drawn from email; the Coach may relay the note but must not synthesize such claims from structured data alone. Keep the Move 1 guard intact.
- **Gated.** Everything stays behind `my_search`; not in `FEATURE_MAP`/guide/Coach-cached prefix until GA (avoids leaking the gate + forking the cached prompt). Add to the GA doc-trigger checklist.
- **Panel blob untouched.** `situation_note` lives on `pursuit_status` (its own table), not the `savedPlaybooks` profile_state blob — same reason `pursuit_status` exists at all (the blob's whole-column autosave clobbers concurrent writes).

## Out of scope

- No new generation. This is a connector-written field surfaced read-only + relayed by Coach.
- No stage-transition history / velocity (a separate, larger move if ever wanted).
- No change to the manual (non-connector) capture path — a manual user simply won't have a `situation_note`.

## Open decisions for Bob

1. Ship `situation_note` alone, or include `last_contact_at` in the same PR?
2. Card treatment: quoted aside under the Move 2 line (recommended), or a small "reported by your assistant" chip?
3. Cap length at ~280 chars (recommended) or allow longer?
