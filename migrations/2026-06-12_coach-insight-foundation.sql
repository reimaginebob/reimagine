-- Question-insight foundation for My Coach.
--
-- Two parts:
--  1. Deterministic per-turn context as real columns on chat_messages. These
--     are all known at write-time (api/coach.js already reads the profile each
--     turn), so they are populated by widening the base INSERT — no classifier,
--     no LLM. Real columns (not JSONB) because we GROUP BY / filter on them.
--  2. coach_message_tags: the evolvable classified-attribute layer. attributes
--     is JSONB so the taxonomy can grow/rename with NO migration; taxonomy_version
--     records which taxonomy produced a row, and the retained chat_messages.message
--     lets the nightly classifier re-tag all history by bumping the version. The
--     FK is ON DELETE CASCADE so api/account/delete.js (which deletes
--     chat_messages WHERE user_id) also purges tags — there is NO TTL, account
--     deletion is the only purge path, so the cascade is load-bearing for privacy.
--
-- Forward-only, idempotent (ADD COLUMN / CREATE TABLE / CREATE INDEX IF NOT
-- EXISTS, table creation guarded). No classified backfill here; the nightly
-- classifier (api/admin/classify-coach.js) fills coach_message_tags.
--
-- Apply to the production Neon database BEFORE deploying the PR that widens the
-- api/coach.js INSERT, or every coach turn's logging INSERT will fail on the
-- missing columns (the insert is wrapped in try/catch, so it fails silently —
-- the base message/reply row would stop being logged). Order: migrate, then merge.
--
-- Verify with:
--   SELECT column_name, data_type, is_nullable FROM information_schema.columns
--     WHERE table_name = 'chat_messages' ORDER BY ordinal_position;
--   SELECT column_name, data_type FROM information_schema.columns
--     WHERE table_name = 'coach_message_tags' ORDER BY ordinal_position;

-- 1. Deterministic context on chat_messages.
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS lane               text;     -- selectedLane key (familiar|insider|wtm|specific), null ok
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS turn_index         integer;  -- position in the exchange (history length at send time)
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS has_resume         boolean;  -- profile.resume present
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS has_personal_brand boolean;  -- outputs.p3 present
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS entry_point        text;     -- 'help' | 'sidebar', null until the client plumbs `surface`

-- 2. coach_message_tags. message_id type is derived from chat_messages.id at
--    apply time (that base table predates the migrations folder, so its id type
--    is not knowable from this repo) — the DO block matches the FK column type
--    exactly so the FK is valid whatever id is (integer / bigint / uuid).
DO $$
DECLARE
  id_type text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'coach_message_tags'
  ) THEN
    SELECT data_type INTO id_type
      FROM information_schema.columns
      WHERE table_name = 'chat_messages' AND column_name = 'id';
    IF id_type IS NULL THEN
      RAISE EXCEPTION 'chat_messages.id not found; cannot create coach_message_tags FK';
    END IF;
    EXECUTE format($f$
      CREATE TABLE coach_message_tags (
        message_id       %s          NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
        taxonomy_version integer     NOT NULL,
        attributes       jsonb       NOT NULL,
        classified_at    timestamptz NOT NULL DEFAULT NOW(),
        PRIMARY KEY (message_id, taxonomy_version)
      )
    $f$, id_type);
  END IF;
END $$;

-- Scan all tags at the current taxonomy_version (classifier "what's untagged"
-- LEFT JOIN, endpoint window read) cheaply.
CREATE INDEX IF NOT EXISTS coach_message_tags_version_idx ON coach_message_tags (taxonomy_version);
-- Filter inside attributes (endpoint attribute filters, e.g. attributes->>'topic').
CREATE INDEX IF NOT EXISTS coach_message_tags_attributes_idx ON coach_message_tags USING gin (attributes);
