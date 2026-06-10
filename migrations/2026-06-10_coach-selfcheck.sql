-- My Coach self-check verdict logging.
--
-- The Coach runs a hidden self-check each turn ("is there a Reimagine feature
-- for what this person is asking?") and the server records the verdict so the
-- "no match" cases become a queryable signal of unmet user needs, and the
-- matched cases show which features get surfaced (button vs prose) and how often.
--
-- navigated_to already exists (the actual reachable step jumped to, or null).
-- These add the intent-level verdict that navigated_to cannot carry: it is null
-- both for "no match" and for "matched but mentioned in prose only".
--
-- Forward-only, nullable; no backfill. Safe to apply before or after the code
-- deploys — the coach handler writes these via a best-effort UPDATE that no-ops
-- if the columns are not present yet.

ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS selfcheck_verdict  text; -- 'matched' | 'none'
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS selfcheck_feature  text; -- canonical feature slug, or NULL
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS selfcheck_surfaced text; -- 'button' | 'prose' | 'none'

-- The unmet-need signal queried most often: turns where the Coach found nothing
-- that fits. Partial index keeps it cheap.
CREATE INDEX IF NOT EXISTS chat_messages_selfcheck_none
  ON chat_messages (created_at) WHERE selfcheck_verdict = 'none';
