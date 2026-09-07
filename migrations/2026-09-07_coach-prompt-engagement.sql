-- Coach prompt engagement log (2026-09-07). Answers a question the product had
-- no data for: how often do people decline these proactive asks, and do some
-- kinds of asks get declined more than others.
--
-- Deliberately three columns of "what happened" rather than one boolean:
--   prompt_code   the QUESTION being asked (employment_status, search_intake,
--                 opportunity_archive, life_events_thin, ...) -- bounded, see
--                 src/coach-prompt-codes.js. This is what "some questions get
--                 declined more than others" groups by.
--   trigger_type  the MECHANISM that caused this particular firing
--                 (hub_arrival, model_detected, topic_close_tap,
--                 topic_close_language) -- bounded, same module. This is what
--                 lets the SAME question be compared across different timing
--                 heuristics, which is the actual point of building the
--                 topic-close triggers in the first place: prove the timing
--                 mechanism helps, don't just assert it.
--   outcome       shown | accepted | declined. Deliberately NOT a third
--                 explicit "no_response" value -- that number falls out for
--                 free as (shown count) minus (accepted+declined count) for
--                 the same prompt_code/trigger_type, so no separate write is
--                 needed to capture it, and it can never drift out of sync
--                 with the count it is derived from.
--
-- Append-only, like generation_events -- every firing gets its own row,
-- including repeat firings of the repeatable topic-close trigger. This is
-- intentionally NOT read back into any live product decision (no per-account
-- adaptive behavior keys off this table -- the topic-close fire cap is a
-- separate, independent counter stored on the profile, not derived from this
-- log). This table exists to be looked at in aggregate, later, by a person,
-- the same posture as generation_events and unlike pursuit_close_reasons (no
-- per-account content is ever stored here -- a prompt_code and an outcome are
-- not content).
--
-- Forward-only, idempotent. Best-effort from the client (api/coach-prompt-
-- engagement.js swallows nothing itself, but callers fire-and-forget and
-- never let a failed write block the UI) -- a dropped row undercounts by one,
-- never corrupts anything.
--
-- Verify with:
--   SELECT prompt_code, trigger_type, outcome, COUNT(*)
--   FROM coach_prompt_engagement GROUP BY 1,2,3 ORDER BY 1,2,3;

CREATE TABLE IF NOT EXISTS coach_prompt_engagement (
  id           bigserial   PRIMARY KEY,
  user_id      uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  prompt_code  text        NOT NULL,
  trigger_type text        NOT NULL DEFAULT 'direct',
  outcome      text        NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS coach_prompt_engagement_code_outcome_idx
  ON coach_prompt_engagement (prompt_code, trigger_type, outcome, created_at);
CREATE INDEX IF NOT EXISTS coach_prompt_engagement_user_idx
  ON coach_prompt_engagement (user_id, created_at);
