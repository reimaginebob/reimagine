-- Durable memory for Milestone Prompts (Coach-as-Concierge proactive signals,
-- Phase 3, PR #756). That phase shipped deliberately without this table --
-- see the standing comment above MILESTONE_PROMPT_NOTE in api/coach.js at the
-- time -- leaning instead on the model's own view of its prior turns ("never
-- twice in this same conversation") to avoid nagging, since the server only
-- ever sends the last 50 messages of a conversation and a first-of-its-kind
-- silent write with no user tap behind it was judged worth earning rather
-- than assuming.
--
-- scripts/eval-milestone-repeat-live.mjs (PR #758/#759) earned it: a live
-- probe against the real prompt showed 0/5 repeats while the model's own
-- prior mention was still inside the 50-message window, and 5/5 repeats once
-- it aged out -- confirming the gap the original comment flagged as a risk
-- to watch, not a hypothetical one. A user leaning on Coach across one long,
-- active sitting (exactly the intended use) will hit this window boundary
-- and get re-nagged about something already covered.
--
-- One row per (user, opportunity, milestone) that Coach has actually raised
-- -- existence alone is the signal; there is no state column because there is
-- only one state worth recording ("already said"). `milestone` is one of the
-- four keys in api/coach.js's MILESTONE_PROMPT_NOTE (coverLetter,
-- resumeRefresh, interviewPrep, offerNegotiation), validated against that
-- fixed set before a row is ever written, same discipline as
-- user_activity_facts.activity against src/activity-catalog.js.
--
-- record_id is the client-minted savedPlaybooks id, same shape and same
-- reasoning as pursuit_status.record_id (2026-08-16_my-search-foundation.sql)
-- -- text, FKs to nothing, no server-side validation; the (user_id) FK ON
-- DELETE CASCADE is the only referential guarantee.
--
-- Forward-only and idempotent; re-running is a no-op.
--
-- Verify with:
--   SELECT to_regclass('public.coach_milestone_mentions');

CREATE TABLE IF NOT EXISTS coach_milestone_mentions (
  user_id      uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  record_id    text        NOT NULL,
  milestone    text        NOT NULL,                 -- coverLetter | resumeRefresh | interviewPrep | offerNegotiation
  mentioned_at timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, record_id, milestone)
);
