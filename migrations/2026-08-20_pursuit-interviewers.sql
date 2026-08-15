-- Interview Team auto-populate (phase-2, suggestion model).
--
-- The user's connected assistant reads calendar invites / email and STAGES the
-- interviewers it finds here. This is deliberately a separate store from the
-- interview panel (which lives on the savedPlaybooks record in profile_state and
-- is edited by every Opportunity user): the connector never touches that shared
-- blob. Instead these rows surface in the Interview Team as "found by your
-- assistant" suggestions, and the user adopts them (one tap) into their real
-- panel or dismisses them — at which point the staged row is deleted.
--
-- So: connector writes here (clobber-safe); the browser reads + deletes here;
-- adoption goes through the existing panel path unchanged.
--
-- Forward-only, idempotent. Cascade on user delete.

CREATE TABLE IF NOT EXISTS pursuit_interviewers (
  user_id        uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  interviewer_id text        NOT NULL,   -- stable id for adopt/dismiss
  record_id      text        NOT NULL,   -- the opportunity (savedPlaybooks id)
  name           text        NOT NULL,
  title          text,
  notes          text,                    -- optional context the assistant learned
  created_at     timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, interviewer_id)
);

CREATE INDEX IF NOT EXISTS pursuit_interviewers_record_idx ON pursuit_interviewers (user_id, record_id);
