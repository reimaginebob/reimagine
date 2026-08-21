-- Stage history for opportunities.
--
-- pursuit_status holds one row per opportunity and updates in place, so it
-- records where something IS, never where it has BEEN. The moment an
-- opportunity closes, the fact that it once reached "interviewing" is gone. That
-- makes the outcome question unanswerable: "three people have an offer open
-- right now" is what the current state supports, when the sentence worth saying
-- is "nine reached interview and three took offers".
--
-- This is the append-only log that fixes it. One row per stage or outcome
-- change, written by api/pursuit-status.js after the status row is saved.
-- Nothing is ever updated or deleted here except by the user_id cascade on
-- account deletion.
--
-- prev_stage rides along so a transition reads as a transition without needing
-- a self-join, and so a stage that was set and immediately corrected is
-- distinguishable from a real progression.
--
-- source distinguishes 'live' (a change we actually observed) from 'backfill'
-- (the snapshot seeded below). This matters for honesty: a backfilled row says
-- only where an opportunity stood the day this shipped. For a record that had
-- already closed, the stages it passed through beforehand were never written
-- down and cannot be recovered. Everything from here forward is complete; the
-- Growth tab reports the split rather than presenting the two as one history.
--
-- Backfill is idempotent -- it skips any (user_id, record_id) that already has
-- an event -- so a re-run is a no-op and it cannot double-count.
--
-- Forward-only and idempotent. The write in api/pursuit-status.js is wrapped
-- and swallows its errors, so this can apply before or after the code deploys;
-- a failed log write must never cost a user their saved status.
--
-- Verify with:
--   SELECT source, COUNT(*) FROM pursuit_status_events GROUP BY source;

CREATE TABLE IF NOT EXISTS pursuit_status_events (
  id         bigserial   PRIMARY KEY,
  user_id    uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- Same opaque client-minted key as pursuit_status.record_id. FKs to nothing
  -- for the same reason: the server cannot see savedPlaybooks.
  record_id  text        NOT NULL,
  stage      text,
  outcome    text,
  prev_stage text,
  source     text        NOT NULL DEFAULT 'live',
  created_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS pursuit_status_events_record_idx  ON pursuit_status_events (user_id, record_id, created_at);
CREATE INDEX IF NOT EXISTS pursuit_status_events_stage_idx   ON pursuit_status_events (stage);
CREATE INDEX IF NOT EXISTS pursuit_status_events_created_idx ON pursuit_status_events (created_at);

-- Seed one snapshot row per opportunity that already has a stage, dated when
-- that status was last touched. Gives the "ever reached" counts a floor on day
-- one instead of an empty table, and is marked as a backfill so it is never
-- mistaken for observed history.
INSERT INTO pursuit_status_events (user_id, record_id, stage, outcome, prev_stage, source, created_at)
SELECT p.user_id, p.record_id, p.stage, p.outcome, NULL, 'backfill', p.updated_at
FROM pursuit_status p
WHERE p.stage IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM pursuit_status_events e
     WHERE e.user_id = p.user_id AND e.record_id = p.record_id
  );
