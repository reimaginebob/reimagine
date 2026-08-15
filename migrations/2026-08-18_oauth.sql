-- OAuth 2.1 authorization server for the Reimagine MCP connector (phase-2).
-- Lets a user's Claude connect via OAuth (Authorization Code + PKCE) — the flow
-- claude.ai / Claude desktop custom connectors require — instead of a pasted
-- bearer token. Every issued token maps to one Reimagine user; the connector
-- only ever reads/writes that user's pipeline.
--
-- Only hashes of codes/tokens are stored (SHA-256); plaintext lives only in the
-- redirect / token response. Codes are single-use and short-lived. FKs cascade
-- on user delete so account deletion purges a user's grants.
--
-- Forward-only, idempotent. Auto-applies on prod deploy.

CREATE TABLE IF NOT EXISTS oauth_clients (
  client_id     text        PRIMARY KEY,     -- issued by dynamic registration (RFC 7591)
  redirect_uris jsonb       NOT NULL,         -- allowed redirect URIs (exact match on authorize)
  client_name   text,
  created_at    timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS oauth_codes (
  code_hash      text        PRIMARY KEY,      -- SHA-256 of the authorization code
  user_id        uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id      text        NOT NULL,
  redirect_uri   text        NOT NULL,
  code_challenge text        NOT NULL,          -- PKCE S256 challenge
  scope          text,
  expires_at     timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS oauth_tokens (
  access_token_hash  text        PRIMARY KEY,   -- SHA-256 of the access token
  refresh_token_hash text        UNIQUE,        -- SHA-256 of the refresh token
  user_id            uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id          text        NOT NULL,
  scope              text,
  expires_at         timestamptz NOT NULL,       -- access-token expiry
  created_at         timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS oauth_tokens_refresh_idx ON oauth_tokens (refresh_token_hash);
