-- One row per campaign email actually sent to a person.
--
-- This table is a safety device before it is a record. Sending is the one thing
-- in this codebase that cannot be undone: a wrong email is in somebody's inbox
-- and no amount of fixing the code takes it back. Every guard the sender relies
-- on reads from here.
--
-- UNIQUE (user_id, campaign) is the important line. It makes double-sending a
-- database error rather than a judgement call — a retry, a double-click, two
-- operators running the same command, or a bug in the eligibility query all hit
-- the constraint instead of a recipient's inbox. The sender inserts BEFORE it
-- calls Resend for exactly this reason: if the insert fails, no email goes out.
--
-- sent_at also backs the frequency ceiling. Bob's rule is at most one campaign
-- email a week per person, and the sender enforces it by looking for any row for
-- that user inside the window — not just a row for the campaign being sent, so
-- two different campaigns cannot stack on the same person in the same week.
--
-- stage_at_send records where the person was when the email went out. Stage is
-- computed live and people move; without this, a campaign's results could not be
-- read six weeks later because the population would have changed underneath
-- them.
--
-- resend_id is the provider's message id, which is what joins these rows to the
-- delivery and open events arriving on the webhook (PR #496).
--
-- Forward-only and idempotent.
--
-- Verify with:
--   SELECT campaign, COUNT(*), MAX(sent_at) FROM campaign_sends GROUP BY campaign;

CREATE TABLE IF NOT EXISTS campaign_sends (
  id            bigserial   PRIMARY KEY,
  user_id       uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  campaign      text        NOT NULL,
  stage_at_send text,
  resend_id     text,
  sent_at       timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, campaign)
);

CREATE INDEX IF NOT EXISTS campaign_sends_user_sent_idx ON campaign_sends (user_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS campaign_sends_campaign_idx  ON campaign_sends (campaign, sent_at DESC);
