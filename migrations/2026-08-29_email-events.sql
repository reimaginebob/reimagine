-- Resend delivery events, so a lifecycle campaign can be judged on what it
-- actually moved rather than on opens alone (consult 2026-08-23).
--
-- The question this exists to answer: someone clicked a drip email — did they
-- then cross a stage? Resend can say who clicked; it has never seen the product
-- side. user_stage_events (2026-08-27) holds when each account reached each
-- stage. This table is the missing half of that join, and neither side is much
-- use without it.
--
-- Written only by api/resend-webhook.js, from Svix-signed Resend webhooks.
--
-- Keyed on (event_id) — Svix delivers at-least-once and retries on any non-2xx,
-- so the same event arrives more than once in normal operation. ON CONFLICT DO
-- NOTHING makes a redelivery a no-op instead of a double count.
--
-- recipient is stored as the raw address rather than a FK to users: Resend also
-- sends to addresses with no account (a test send, an unsubscribed contact, a
-- typo), and dropping those on the floor would hide exactly the bounce and
-- complaint events that matter most. The join to users happens at read time,
-- lowercased on both sides.
--
-- tags carries the tags set on the send (campaign, stage, domain). Without them
-- events cannot be attributed to a campaign, so every real drip send must be
-- tagged. Stored as jsonb because Resend's shape is a free-form object.
--
-- No retention policy on purpose: this is a small table (one row per event per
-- recipient) and the historical baseline is the point of it.
--
-- Forward-only, idempotent. The writer swallows its own errors, so this can
-- apply before or after the code deploys.
--
-- Verify with:
--   SELECT column_name, data_type FROM information_schema.columns
--     WHERE table_name='email_events' ORDER BY ordinal_position;

CREATE TABLE IF NOT EXISTS email_events (
  event_id    text        PRIMARY KEY,               -- svix-id; the dedupe key
  email_id    text,                                  -- Resend's email id, joins events from one send
  event_type  text        NOT NULL,                  -- delivered | opened | clicked | bounced | complained | delivery_delayed | sent
  recipient   text        NOT NULL,                  -- raw address, lowercased by the writer
  link_url    text,                                  -- clicked events only: which link
  tags        jsonb,                                 -- tags set on the send (campaign, stage, ...)
  occurred_at timestamptz NOT NULL,                  -- when Resend recorded it, not when we ingested
  created_at  timestamptz NOT NULL DEFAULT NOW()
);

-- Read path is "events for this recipient, newest first" (the per-person trace)
-- and "events of this type in a window" (the rollup).
CREATE INDEX IF NOT EXISTS email_events_recipient_idx ON email_events (recipient, occurred_at DESC);
CREATE INDEX IF NOT EXISTS email_events_type_time_idx ON email_events (event_type, occurred_at DESC);
