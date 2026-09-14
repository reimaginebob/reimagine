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
carries), rendered by the Corrections tab of `/admin/dashboard`
(`src/CorrectionsDashboard.jsx`).

## Theme classification (2026-09-13)

`theme`/`theme_notes`/`theme_classified_at` are filled by a manually-triggered
batch classifier, `api/admin/classify-corrections.js` -- a "Classify next
batch" button on the dashboard, not a cron; at this volume there's no need
for it to run itself. Calls Claude (claude-sonnet-5, matching every other
Anthropic call in this repo) with forced tool use so the response is
schema-valid JSON, no free-text parsing. Themes: `wrong_fact`,
`hallucination`, `wont_accept_correction`, `ai_voice`, `other` -- Bob's own
words for the patterns he wanted visible, not the `field_type` taxonomy the
original spec below anticipated (work-history/credential/industry/etc.);
`field_type` is unchanged and still unbuilt.

## Personal Brand ramification flags (2026-09-13)

`personal_brand_relevant` and `personal_brand_confirmed` (see the column
table below) are computed client-side in `recordCorrection()`
(`src/App.jsx`), not by the classifier -- both are structural/deterministic,
not judgment calls a model is needed for. `personal_brand_relevant` mirrors
`SECTION_UPSTREAMS`; `personal_brand_confirmed` reuses the exact same test the
existing "Track 8" upstream-check prompt already runs
(`extractCorrectionTerms` + `countTermInText` against the live Personal Brand
output, both from `src/corrections.js`), captured this time instead of
discarded once that prompt is dismissed.

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
| `original_inference` | text | The section exactly as the person saw it when they wrote the correction (from 2026-09-14; NULL on every earlier row, and unrecoverable for them). Each `recordCorrection()` call site in `src/App.jsx` passes its own text (opportunity cards and the opportunity Bridge Story read the saved record, not `outputs[step]`), posted once to `api/correction-context.js` into the write-once `correction_context` table and never carried in `profile.corrections` (blob size). Whichever lands second fills this column: the endpoint updates an existing row, or `api/profile/save.js` reads `correction_context` on insert. Whole section, not an extracted passage — locating the passage is analysis and can be re-run |
| `field_type` | text | NULL at write time; backfilled by a classifier batch job (work-history / credential / industry / scope / values / voice / other) — still unbuilt |
| `app_version` | text | for tying corrections to specific deployment dates |
| `browser` | text | user agent at correction time |
| `created_at` | timestamptz | client-stamped moment of the correction itself (set in `recordCorrection()`), preserved through to this table |
| `captured_at` | timestamptz | server-side timestamp: when the row was written here (defaults to `NOW()`) |
| `source` | text | `'refinebox'` for every row today (the RefineBox correction flow). `'coach'` is reserved for Coach-as-Concierge corrections, a deliberate later phase — see `Output/session-continuity/2026-09-13_corrections-vs-coach-concierge-scope-question.md` |
| `personal_brand_relevant` | boolean | structural: true when `step` is `p3` itself or `SECTION_UPSTREAMS` says it was built from `p3`. Backfilled for historical rows in `migrations/2026-09-13_corrections-diagnostics.sql`; computed at capture time going forward |
| `personal_brand_confirmed` | boolean | stronger signal: the correction's own wording was found, at capture time, to contradict something already written in the live Personal Brand output. NULL for historical rows (needs the live `outputs.p3` at correction time, not reconstructable after the fact) |
| `conflict_phrase` | text | set when the user chose "Apply anyway" on the Track 6/7 voice-conflict modal — the phrase Reimagine deliberately writes around |
| `theme` | text | see Theme classification above |
| `theme_notes` | text | short model-written rationale for `theme`, not a summary |
| `theme_classified_at` | timestamptz | when the classifier last set `theme` for this row |

## Indexes

- `(step, created_at desc)` — for "which step has the most corrections" queries
- `(user_id, created_at desc)` — for per-user history if accounts page exposes it
- `(theme)` — for the dashboard's by-theme breakdown
- `(personal_brand_relevant) WHERE personal_brand_relevant = true` — partial index for the Personal Brand filter
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
