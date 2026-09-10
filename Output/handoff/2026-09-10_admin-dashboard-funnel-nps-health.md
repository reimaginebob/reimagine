# Admin dashboard: fix the Funnel / NPS / System health row

Date: 2026-09-10
Status: ready for Code
Repo: github.com/reimaginebob/reimagine, main at `aed414a` when written

## Prompt for Code

Read `C:\Users\bobgo\OneDrive\Desktop\Career-Club-HQ\Output\handoff\2026-09-10_admin-dashboard-funnel-nps-health.md` and save a copy at `Output/handoff/` in the repo. Then implement it: on `/admin/dashboard` (Analytics tab) fix the clipped Funnel table and its completed-greater-than-generated rows, remove the dead NPS panel (the in-app NPS survey was retired and `survey_responses` has had no rows since 2026-06-22; the Feedback tab already covers `feedback_event`), and repoint System health at live signals (`generation_events`, `sessions`, `feedback_event`) instead of the dead survey table. Files are `api/admin/analytics.js` and `src/AdminDashboard.jsx` only. Run `npm run build`, confirm the diff touches only those two files, load `/admin/dashboard` on the preview signed in as bob@career.club and check the five acceptance points in the Verification section. Commit with the message in the brief, push per CLAUDE.md, and update the System Documentation Ch.11 changelog plus the admin dashboard chapter. No User Guide change (admin-only surface).

## Goal

The middle row of the Analytics tab has three panels that currently mislead or break:

1. **Funnel per step** clips its fifth column (Drop-off) at the panel's right edge, and shows Bridge Story with 16 completed against 15 generated, which cannot be right for a funnel.
2. **NPS** shows a score of "—" and 0 / 0 / 0 / 0, while the Open text box below it renders a raw JSON blob from June. The panel reads two different windows (buckets are range-filtered, open text is all-time) and the renderer expects field names (`text`, `score`, `role`) the SQL does not return (`open_text`, `nps_score`, `chosen_role`). Underneath both bugs, the data source is dead: the post-session NPS survey was retired in favour of the Share feedback panel and the one-click email surveys, both of which write to `feedback_event` and already have their own Feedback tab. The last row in `survey_responses` is 2026-06-22.
3. **System health** reports "Survey responses (range): 0" and "Last survey response: 22 Jun 2026" from that same dead table, so the panel says nothing about whether the system is healthy today.

## Files

- `api/admin/analytics.js`
- `src/AdminDashboard.jsx`

## Changes

### A. Funnel per step

**A1. Layout (src/AdminDashboard.jsx, Panel "Funnel per step", ~line 520).** Wrap the `<table>` in `<div style={{ overflowX: "auto" }}>` exactly as the Power users panel does at ~line 583, and give the Step cell `whiteSpace: "nowrap"` so the two-line step names stop pushing the numeric columns off the edge. Keep the panel in the normal grid (do not make it `wide`).

**A2. Completed can never exceed Generated (api/admin/analytics.js, Panel 2 query, ~lines 158-181).** `completed` currently counts every user whose `profile_state.done` contains the step id, and the done flag survives a cleared or regenerated output, which is how Bridge Story reaches 16 completed on 15 generated. Change the `completed` subquery to require both the done flag and a non-empty output for the step:

```sql
(SELECT COUNT(*)::int FROM base b
   WHERE (b.profile_state->'done') ? s.sid
     AND NULLIF(TRIM(b.profile_state->'outputs'->>s.sid), '') IS NOT NULL) AS completed
```

Net effect: entered >= generated >= completed on every row, which is what a funnel promises.

**A3. Say what the numbers cover.** The query is all-time by design (profile progress is not timestamped per step; see the comment at ~line 156), but the range pills sit right above the panel and imply otherwise. Add a one-line muted subhead under the panel title, using the existing `S.muted` style: `All time. Entered = reached this step; Generated = has an output; Completed = marked done. Drop-off = 1 - completed / entered.` Plain English, no em dashes in the inserted text.

### B. Remove the NPS panel

**B1. src/AdminDashboard.jsx.** Delete the `{/* Panel 3: NPS */}` block (~lines 537-556) and the `const nps = ...` line (~line 281). Delete the `feed`, `feedItem`, `feedMeta`, `subSectionLabel` entries from `S` only if grep shows nothing else uses them; otherwise leave them.

**B2. api/admin/analytics.js.** Remove the five NPS queries from the `Promise.all` (`npsTrend`, `npsDist`, `npsByRole`, `npsOpenText`, `npsBuckets`, ~lines 210-262) and their destructured names (~lines 87-91), the `np` and `npsScore` derivations (~lines 427, 456-458), and the `panel_3_nps` key from the returned object (~lines 518-531). Leave the per-user drill-in at ~line 548 onward untouched: its `nps_history` read on `survey_responses` is historical context for a single user and still correct.

Do not migrate NPS onto `feedback_event`. There is no 0-10 score in that table (`native_type` / `native_value` carry the one-click email answers, which are not NPS), and the Feedback tab already shows what people said. Inventing an NPS figure from a different instrument would be a worse panel than no panel.

### C. System health on live signals

**C1. api/admin/analytics.js.** Replace the two survey queries under `// Panel 5: system health.` (~lines 263-275) with three, all excluding `adminEmails` the same way the rest of the file does:

```sql
-- last generation and count in range
SELECT MAX(ge.created_at) AS last_generation_at,
       COUNT(*) FILTER (WHERE ge.created_at >= NOW() - (${rangeInterval})::interval)::int AS generations_in_range
FROM generation_events ge
JOIN users u ON u.id = ge.user_id
WHERE LOWER(u.email) <> ALL(${adminEmails}::text[])

-- last sign-in and count in range
SELECT MAX(s.created_at) AS last_signin_at,
       COUNT(*) FILTER (WHERE s.created_at >= NOW() - (${rangeInterval})::interval)::int AS signins_in_range
FROM sessions s
JOIN users u ON u.id = s.user_id
WHERE LOWER(u.email) <> ALL(${adminEmails}::text[])

-- last feedback and count in range
SELECT MAX(fe.created_at) AS last_feedback_at,
       COUNT(*) FILTER (WHERE fe.created_at >= NOW() - (${rangeInterval})::interval)::int AS feedback_in_range
FROM feedback_event fe
WHERE fe.email IS NULL OR LOWER(fe.email) <> ALL(${adminEmails}::text[])
```

Check the `sessions` join column against `api/_lib/session.js` before relying on `s.user_id`; the file already joins `sessions` at ~line 130, so mirror that.

Return:

```js
panel_5_system_health: {
  db_ok: true,
  last_generation_at, generations_in_range,
  last_signin_at,     signins_in_range,
  last_feedback_at,   feedback_in_range,
}
```

Drop `last_survey_response_at` and `survey_responses_in_range`.

**C2. src/AdminDashboard.jsx (Panel "System health", ~lines 559-569).** Tiles: Database (unchanged), Generations (range), Sign-ins (range), Feedback (range). Under the tiles, three muted lines: `Last generation: <relative time>`, `Last sign-in: <relative time>`, `Last feedback: <relative time>`. Add a small `ago(ts)` helper (minutes / hours / days) rather than `toUTCString()`, since "3 hours ago" is the question this panel answers. Add a stale flag: if `last_generation_at` is older than 48 hours, render that line in the existing danger colour so a silent outage is visible at a glance.

## Verification

- `npm run build` passes.
- Diff touches only `api/admin/analytics.js` and `src/AdminDashboard.jsx` (plus the two doc files below). `src/App.jsx` untouched, so no EOF / line-count gate applies.
- `check-voice` and `check-prompt-refs`: not applicable, no user-facing or prompt text changed; state that in the PR body.
- On the preview, signed in as bob@career.club at `/admin/dashboard`, at the default 1180px container width:
  1. Funnel table shows all five columns with no clipping; Step names do not wrap.
  2. Every funnel row has entered >= generated >= completed (Bridge Story specifically no longer shows 16 > 15).
  3. The all-time subhead is visible under the Funnel title.
  4. No NPS panel is rendered; the Analytics tab still lays out without a hole (the grid is auto-fit, so the next panel flows in).
  5. System health shows Database OK, three counts that change when the range pill changes, and three "Last ..." lines with real recent timestamps.
- `curl` of the analytics endpoint unauthenticated still returns 403 (auth untouched).

## Commit message

```
Admin dashboard: fix funnel table, retire NPS panel, live system health

- Funnel: wrap table for overflow, nowrap step names, completed now
  requires a non-empty output so completed <= generated on every row,
  all-time subhead under the title
- NPS panel removed: in-app NPS survey retired, survey_responses dead
  since 2026-06-22, Feedback tab covers feedback_event
- System health: generation_events / sessions / feedback_event counts
  in range and last-seen times, stale flag at 48h; survey rows dropped
```

## Push

Per CLAUDE.md: branch, PR, merge to main, Vercel auto-deploys.

## System Documentation update

`Output/docs/reimagine-system-documentation/`: admin dashboard chapter (panel list and the health signals), Ch.11 changelog entry dated 2026-09-10.

## User Guide update

None. Admin-only surface, nothing user-visible changed.
