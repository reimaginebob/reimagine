-- Interview-team suggestions: carry the loop role (parity with the Coach path).
-- The connector may set role when it can tell how a person fits the loop
-- (hiring_manager|skip_level|peer|cross_functional|recruiter_screen); validated
-- to that set by api/mcp.js. NULL when unknown. On adopt, it maps to the panel's
-- role_in_loop so a suggested peer isn't shown as the hiring manager.
--
-- Forward-only, idempotent.

ALTER TABLE pursuit_interviewers ADD COLUMN IF NOT EXISTS role text;
