# Corrections Table — Schema Spec

**Built 2026-09-11, ahead of V2.** The "Reimagine Corrections Log" Google Sheet
this spec was written to replace went silently dead around 2026-08-20 (an Apps
Script deployment drifted from the URL baked into the client; see CLAUDE.md §8
"Apps Script redeploy" and `migrations/2026-09-11_corrections-table.sql`). The
underlying corrections were never lost -- they land in
`profile_state.profile.corrections` on every autosave regardless of the Sheet
-- but the Sheet itself is not worth fixing, so this table shipped now instead
of waiting for V2 Phase 1.

The shape below is the original spec, close to unchanged. Two differences from
what was originally planned: `user_id` is a real FK (accounts didn't exist yet
in V2-planning terms when this was written; `req.user.id` is available now),
and capture is server-side in `api/profile/save.js` rather than a client POST
to a dedicated V2 API -- the autosave path already existed and is already
proven reliable, so there was nothing to build there. `original_inference` and
`field_type` are unchanged: still NULL until a later capture path / classifier
backfill fills them in. Read access is `api/admin/corrections.js` (session +
ADMIN_LOGIN_EMAILS/ANALYST_LOGIN_EMAILS, same pattern as `api/admin/growth.js`
-- not the older ADMIN_TOKEN pattern `api/admin/feedback-dashboard.js` still
carries) -- no dashboard tab yet; a natural follow-up if the raw query view
isn't enough.

## Table: `corrections`

| Column | Type | Notes |
|---|---|---|
| `id` | text PK | the client-generated correction ID, e.g. `corr_1715000000000_abc12` |
| `user_id` | uuid FK | references `users(id)`; added when this shipped early, ahead of the original plan |
| `user_email` | text | snapshot at correction time |
| `user_name` | text | snapshot at correction time |
| `step` | text | step ID: `p1`, `p2`, etc. |
| `step_display_name` | text | snapshot of human-readable name at correction time |
| `section_output_length` | integer | always NULL currently — this was computed fresh in the client's Sheet-POST code, never persisted into `profile.corrections`, so there was nothing to carry over when capture moved server-side. Populating it means adding it to the `recordCorrection()` payload in `src/App.jsx`; not done as part of the 2026-09-11 build (out of scope) |
| `correction_text` | text | the user's correction string |
| `original_inference` | text | NULL — still unbuilt. Would need `recordCorrection()` to snapshot the full section output at correction time so it can be compared against the correction text |
| `field_type` | text | NULL at write time; backfilled by a classifier batch job (work-history / credential / industry / scope / values / voice / other) — still unbuilt |
| `app_version` | text | for tying corrections to specific deployment dates |
| `browser` | text | user agent at correction time |
| `created_at` | timestamptz | client-stamped moment of the correction itself (set in `recordCorrection()`), preserved through to this table |
| `captured_at` | timestamptz | server-side timestamp: when the row was written here (defaults to `NOW()`) |

## Indexes

- `(step, created_at desc)` — for "which step has the most corrections" queries
- `(user_id, created_at desc)` — for per-user history if accounts page exposes it
- `(field_type, created_at desc)` once classifier backfill runs — not yet added; add it alongside that work

## History

Backfilled once, in `migrations/2026-09-11_corrections-table.sql`, from every
account's `profile_state.profile.corrections` (full history back to
2026-05-10, not just a recent window — the feature is only that old). Ongoing
capture is `api/profile/save.js` upserting on every autosave; see that file's
comment. The Sheet is no longer written to for corrections (the client no
longer POSTs to it for this) and is not planned to be fixed.

## Dashboard queries to reach for first

- Top steps by correction rate over the last 30 days
- Most recent 100 corrections by step (raw read for prompt-revision input)
- Cluster of similar corrections (lightweight grouping by tf-idf or embeddings — post-V2 build)
