-- Per-reply thumbs feedback for My Coach.
--
-- rating / rating_comment / rated_at are 1:1 with a Coach reply, written as a late
-- user UPDATE (api/coach-rate.js) for a row the user owns — the same shape as the
-- selfcheck columns. Columns (not a separate table) because the relationship is
-- 1:1 and singular: this inherits the dashboard's chat_messages select, the
-- account-deletion purge (DELETE chat_messages WHERE user_id), and the @career.club
-- read-time exclusion for free.
--
-- rating_comment is free-text PII; it is only ever surfaced on the admin dashboard
-- behind the COACH_CONTENT_REVIEW gate (default off), never with identity.
--
-- Forward-only, idempotent (ADD COLUMN IF NOT EXISTS). Apply BEFORE deploying the
-- code that reads/writes these columns. No backfill.
--
-- Verify with:
--   SELECT column_name, data_type FROM information_schema.columns
--     WHERE table_name = 'chat_messages' AND column_name IN ('rating','rating_comment','rated_at');

ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS rating         smallint;     -- 1 (up) | -1 (down) | NULL (unrated)
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS rating_comment text;         -- optional free-text, PII
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS rated_at       timestamptz;  -- when the user rated, NULL if unrated

-- Constrain rating to the two valid votes (NULL stays allowed = unrated). Guarded
-- so the migration is idempotent / re-runnable.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'chat_messages' AND constraint_name = 'chat_messages_rating_check'
  ) THEN
    ALTER TABLE chat_messages ADD CONSTRAINT chat_messages_rating_check CHECK (rating IN (-1, 1));
  END IF;
END $$;
