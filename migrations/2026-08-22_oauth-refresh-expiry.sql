-- Refresh-token expiry for the MCP OAuth server.
--
-- 2026-08-18_oauth.sql gave oauth_tokens a single expires_at, which is the
-- ACCESS token's 3600s TTL (api/_lib/oauth.js ACCESS_TOKEN_TTL_SECONDS). The
-- refresh lookup in api/oauth/token.js had no expiry predicate at all, so a
-- refresh token issued once worked forever: a granted connector was permanent
-- short of deleting the account.
--
-- The fix needs its own column. Reusing expires_at for the refresh predicate
-- would reject every refresh one hour after issue — exactly when a client
-- refreshes — so refresh gets refresh_expires_at, set to 90 days at mint.
--
-- Backfill: existing refresh tokens get 90 days from their created_at, so a
-- live grant is not invalidated mid-session. Any grant already older than 90
-- days is rejected on next use, which is the intended outcome for a stale one.
--
-- Deliberately NOT NOT-NULL: the column has to tolerate rows minted by the
-- currently-running deployment in the window between this migration applying
-- and the new code serving. The lookup predicate (refresh_expires_at > NOW())
-- excludes NULLs, so an un-backfilled row fails closed rather than open.
--
-- Dated 2026-08-22 so it sorts AFTER 2026-08-18_oauth.sql, which creates the
-- table this alters. scripts/migrate.mjs applies files in plain filename order
-- (.sort()), and "2026-08-18_oauth-refresh-expiry.sql" would sort BEFORE
-- "2026-08-18_oauth.sql" ('-' < '.'), breaking a clean bootstrap.
--
-- Forward-only, idempotent — safe to re-run. Auto-applied on prod deploy
-- (scripts/deploy-migrate.mjs), so shipping this file in the PR is enough.
--
-- Verify with:
--   SELECT column_name, data_type, is_nullable FROM information_schema.columns
--     WHERE table_name='oauth_tokens' ORDER BY ordinal_position;
--   SELECT count(*) FILTER (WHERE refresh_expires_at IS NULL) AS unbackfilled
--     FROM oauth_tokens WHERE refresh_token_hash IS NOT NULL;

ALTER TABLE oauth_tokens ADD COLUMN IF NOT EXISTS refresh_expires_at timestamptz;

UPDATE oauth_tokens
   SET refresh_expires_at = created_at + INTERVAL '90 days'
 WHERE refresh_expires_at IS NULL
   AND refresh_token_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS oauth_tokens_user_client_idx ON oauth_tokens (user_id, client_id);
