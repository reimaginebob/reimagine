-- Phase-2 foundation: per-user push token (brief: phase-2 connector).
--
-- Lets a non-browser caller — the user's own assistant, via the Reimagine
-- connector — authenticate to api/pursuit-status without a cookie or origin.
-- Only the SHA-256 hash of the token is stored; the plaintext is shown to the
-- user exactly once at mint time (api/push-token.js) and never persisted.
--
-- The token maps 1:1 to a user, so a bearer token on an ingest call resolves to
-- that user_id and writes only their pursuit_status rows. Revoking = NULLing the
-- hash. Rotating = minting a new one (overwrites the hash).
--
-- Forward-only, idempotent. Auto-applies on prod deploy (deploy-migrate).
--
-- Verify with:
--   SELECT column_name FROM information_schema.columns
--     WHERE table_name='users' AND column_name LIKE 'push_token%';

ALTER TABLE users ADD COLUMN IF NOT EXISTS push_token_hash       text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS push_token_created_at timestamptz;

-- Ingest resolves the caller by hash on every push; index the lookup.
CREATE INDEX IF NOT EXISTS users_push_token_hash_idx ON users (push_token_hash);
