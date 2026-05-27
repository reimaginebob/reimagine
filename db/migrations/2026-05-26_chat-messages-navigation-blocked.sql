-- 2026-05-26: chat helper prereq gate observability
--
-- Adds a column to chat_messages so the server can log when the prereq
-- gate refuses a chat-helper NAVIGATE intent. When the LLM tries to
-- route a pre-Personal-Brand user to a post-p3 step (twoDoors,
-- laneSelect, p4, focus, mylib, p6, p7, p8, p_res, p9, p10, complete,
-- income, op), api/chat.js writes the step id to this column and
-- navigated_to is NULL (the client also gated, so no navigation
-- occurred). When the gate does not fire, this column stays NULL.
--
-- Idempotent so re-running against an environment that already has the
-- column is safe.
--
-- Schema convention note: the chat_messages table itself has no
-- canonical CREATE TABLE in either db/migrations/ or migrations/; it
-- was created out-of-band against Neon. Column additions to this table
-- live here in db/migrations/ and are run against Neon manually. See
-- CLAUDE.md for the full convention.

ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS navigation_blocked TEXT;
