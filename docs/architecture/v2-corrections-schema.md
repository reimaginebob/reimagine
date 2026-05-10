# V2 Corrections Table — Schema Spec

For the V2 Phase 1 Postgres provisioning. Migrates from the "Reimagine Corrections Log" Google Sheet that captures the same data starting 2026-05-10.

## Table: `corrections`

| Column | Type | Notes |
|---|---|---|
| `id` | text PK | the client-generated correction ID, e.g. `corr_1715000000000_abc12` |
| `user_email` | text | joined to `users.email` (V2 accounts) |
| `user_name` | text | snapshot at correction time |
| `step` | text | step ID: `p1`, `p2`, etc. |
| `step_display_name` | text | snapshot of human-readable name at correction time |
| `section_output_length` | integer | character count of the section output at correction time, useful for "thin output → correction" correlation analysis |
| `correction_text` | text | the user's correction string |
| `original_inference` | text | NULL during Sheet era; in V2 capture the full section output at correction time so we can compare correction text against what the model actually said |
| `field_type` | text | NULL at write time; backfilled by a classifier batch job (work-history / credential / industry / scope / values / voice / other) |
| `app_version` | text | for tying corrections to specific deployment dates |
| `browser` | text | user agent at correction time |
| `created_at` | timestamptz | server-side timestamp |

## Indexes

- `(step, created_at desc)` — for "which step has the most corrections" dashboard
- `(user_email, created_at desc)` — for per-user history if accounts page exposes it
- `(field_type, created_at desc)` — once classifier backfill runs

## Migration from the Sheet

When V2 Phase 1 runs:
1. Export the "Reimagine Corrections Log" sheet to CSV.
2. Bulk-load into the `corrections` table. The `original_inference` column will be NULL for all migrated rows; that's expected.
3. Going forward, the client posts directly to the V2 API (replacing the Apps Script), and the API also captures `original_inference` (the full `outputs[step]` text at correction time) so the comparison analysis works for V2-era data.

## Dashboard queries to reach for first

- Top steps by correction rate over the last 30 days
- Most recent 100 corrections by step (raw read for prompt-revision input)
- Cluster of similar corrections (lightweight grouping by tf-idf or embeddings — post-V2 build)
