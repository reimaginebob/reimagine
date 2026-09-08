-- Prelaunch audit, finding #2.3: the magic-link sender's rate limit was
-- keyed on recipient email only, so unlimited third-party addresses could
-- each receive emails from career.club (a spam-reputation risk on a young
-- sending domain), and api/auth/check-email.js had no rate limit at all --
-- an unauthenticated account-enumeration oracle. One small append-only log
-- shared by both endpoints, keyed by IP address, so a single caller hitting
-- either route with many different target emails is still bounded.
--
-- High-volume, append-only, short-lived data (the query window is at most an
-- hour). No index beyond (route, ip_address, created_at): every read is a
-- COUNT over that exact key, and nothing else ever queries this table.
CREATE TABLE IF NOT EXISTS auth_ip_events (
  id         bigserial PRIMARY KEY,
  route      text NOT NULL,
  ip_address text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS auth_ip_events_route_ip_created_idx ON auth_ip_events (route, ip_address, created_at);
