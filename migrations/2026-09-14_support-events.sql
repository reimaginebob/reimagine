-- Operational error trail, per account (2026-09-08 observability brief, part A).
--
-- The gap this closes: a failed generation was never recorded anywhere a query
-- could reach. api/claude.js deliberately writes NO generation_events row on a
-- rejected call -- a failure is not billed, and logging it there would inflate
-- the month's generation count and push the user toward the hourly cap for a
-- call that never ran -- so the single most common support question ("my
-- Personal Brand never came back") had nothing behind it but a Vercel console
-- line nobody can join to an account. Browser crashes never left the browser
-- at all (src/ErrorBoundary.jsx wrote to localStorage and stopped there), and
-- save failures were a screen notice plus a server console line.
--
-- THE PRIVACY BOUNDARY IS THE SCHEMA. This table is columns, not a blob, on
-- purpose: there is no column a prompt, a reply, a resume, a profile field or
-- a Coach message could be written into even by mistake. `detail` carries an
-- error message or class and is capped at 200 characters by a CHECK the
-- database enforces, so a caller that ignores the application-level cap in
-- api/_lib/support-events.js fails its INSERT rather than storing content.
-- Adding a content-bearing column here is a policy change, not a schema
-- change. src/legalDocs.js line 114 already promises technical logs retained
-- "for a limited period (typically 30 to 90 days) for security and
-- operational purposes" -- this table is exactly that, and the nightly
-- api/admin/cleanup.js cron is what makes the 90 days true rather than
-- aspirational.
--
-- Deliberately NOT the anonymous analytics stream (analytics_events): that one
-- is anonymous by policy (legalDocs line 40) and cannot become a per-account
-- trail. This table is keyed by user_id and is the operational counterpart,
-- covering failures only.
CREATE TABLE IF NOT EXISTS support_events (
  id          bigserial   PRIMARY KEY,
  user_id     uuid        REFERENCES users(id) ON DELETE CASCADE,
  -- generation_failed | coach_failed | client_crash | save_failed.
  -- Not an enum: a new failure class should be one line of application code,
  -- not a migration, and api/_lib/support-events.js holds the allowed set.
  kind        text        NOT NULL,
  -- The step or feature the failure happened on ('p3', 'op', 'coach'...).
  step        text,
  -- classifyAnthropicError's kind (spend_limit/auth/rate_limit/overloaded/
  -- upstream/network/request) for the API paths, or the client's own reason
  -- code (offline/device_full/stale/too_large/render/empty_output).
  error_class text,
  http_status int,
  duration_ms int,
  build_sha   text,
  user_agent  text,
  -- An error message or class, never user content. The CHECK is the actual
  -- guard; the application cap is belt and braces.
  detail      text        CHECK (detail IS NULL OR char_length(detail) <= 200),
  created_at  timestamptz NOT NULL DEFAULT NOW()
);

-- (user_id, created_at DESC) serves both readers: the per-account timeline at
-- /admin/support, and the per-user rate-limit count the client-event endpoint
-- runs on every post.
CREATE INDEX IF NOT EXISTS support_events_user_idx ON support_events (user_id, created_at DESC);
-- (created_at) is for the nightly retention sweep, which has no user_id to
-- narrow by and would otherwise scan the whole table every night.
CREATE INDEX IF NOT EXISTS support_events_created_idx ON support_events (created_at);

-- User-initiated diagnostics upload (part C, PR 4). Separate table because it
-- is a different consent posture, not a different shape of the same thing:
-- every row here exists because a person read the exact payload on screen and
-- clicked Send. api/support/diagnostics.js enforces a key allowlist on the
-- payload before it is stored, so `payload` being jsonb is not a hole -- the
-- endpoint is the schema. Same 90-day retention, same nightly sweep.
CREATE TABLE IF NOT EXISTS support_diagnostics (
  id         bigserial   PRIMARY KEY,
  user_id    uuid        REFERENCES users(id) ON DELETE CASCADE,
  payload    jsonb       NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS support_diagnostics_user_idx ON support_diagnostics (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS support_diagnostics_created_idx ON support_diagnostics (created_at);
