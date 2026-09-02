-- What we know about the moves this person has made, in the product and outside it.
--
-- Reimagine can see everything built inside it and nothing about the human half
-- of a search. Whether someone joined a networking group, went to Career Club
-- Corner, has an accountability partner, wrote directly to a company rather than
-- answering a posting -- the product teaches all of that and then never asks,
-- never knows, and never follows up. That blindness is the whole reason for this
-- table.
--
-- THE ROWS ARE THINGS WE LEARNED, NEVER A CHECKLIST OF THINGS OWED.
--
-- No row is written for "we have not discussed this." Absence means exactly that
-- and nothing more -- it is a question waiting to be asked, never an assumption
-- that the thing has not happened. Absence in Reimagine has never been absence
-- in someone's life; it usually means nobody did the filing.
--
-- A NEGATIVE IS WORTH KEEPING, and that is not the same as keeping score.
-- "Asked, and she does not want an accountability partner" is precisely what
-- stops the coach raising it a fourth time. A system that cannot record a no has
-- no way to stop asking, which is how a helpful question becomes nagging. So
-- `state` carries three learned answers and never a fourth meaning "outstanding":
--
--   done      -- they have done it (said in conversation, or observed in-product)
--   not_yet   -- asked, and they have not; a live thing to encourage, not a debt
--   declined  -- asked, and they do not want to; the reason to stop asking
--
-- NOTHING HERE IS EVER SHOWN TO THE USER, COUNTED, OR TOTALLED. It is back-end
-- vocabulary that lets the coach say "did you know we can do this for you" about
-- the right thing at the right moment. The moment it renders as a list it is a
-- to-do list, and the product has become the scoreboard it refuses to be. There
-- is deliberately no completed-count anywhere in this schema and no view that
-- would produce one.
--
-- `activity` is a key from the catalog in src/activity-catalog.js, which is the
-- vocabulary and the only place a new one is defined. Unknown keys are rejected
-- on the way in rather than stored, so a typo cannot become a row nothing reads
-- (the same lesson as the feature flags in api/_lib/feature-flags.js).
--
-- One row per person per activity: the newest answer replaces the older one,
-- because someone who joined a group in October has superseded the "not yet"
-- they gave in September. `source` keeps how we came to know it, so the coach can
-- tell what it was told from what it saw, and `detail` holds their own words
-- where they gave any (which group, who the partner is) -- short, and theirs.
--
-- Forward-only and idempotent; re-running is a no-op. No deploy-order hazard:
-- every reader tolerates an empty set, because an account that has never
-- discussed any of this is the normal starting state and always will be.
--
-- Verify with:
--   SELECT to_regclass('public.user_activity_facts');

CREATE TABLE IF NOT EXISTS user_activity_facts (
  user_id     uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  activity    text        NOT NULL,                 -- key from src/activity-catalog.js
  state       text        NOT NULL,                 -- 'done' | 'not_yet' | 'declined'
  source      text        NOT NULL,                 -- 'said' | 'asked' | 'observed'
  detail      text,                                 -- their own words, optional and short
  learned_at  timestamptz NOT NULL DEFAULT NOW(),   -- when this answer replaced the last one
  PRIMARY KEY (user_id, activity)
);

-- Read path is always "everything we know about this person", so the primary key
-- already serves it. This index is for the product question -- who has said they
-- want an accountability partner and has not got one -- which is a column scan
-- without it once the table has any size.
CREATE INDEX IF NOT EXISTS user_activity_facts_activity_state_idx
  ON user_activity_facts (activity, state);
