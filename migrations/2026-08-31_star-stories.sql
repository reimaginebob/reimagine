-- The STAR story library.
--
-- Interview Prep has always inferred stories on the fly: p11Team returns a story
-- NAME and a reason it fits one interviewer, never the story, and the drafted
-- full answer lived in React state and died on reload. So nothing accumulated,
-- the same experience got re-derived (and often re-named) on every rebuild, and
-- the Playlist Principle from Lesson 10 — roughly twelve well-built stories you
-- remix rather than a hundred you memorise — was not buildable in the product.
--
-- This table is that playlist. One row per story per user.
--
-- Its own table rather than profile_state: stories are the user's own work
-- product, they grow, and a growing array of long text inside the whole-blob
-- autosave is exactly the shape that lost a user five playbooks (see
-- Output/handoff/2026-08-28_savedplaybooks-perrecord-table.md). Same precedent
-- as saved_playbooks, same key shape.
--
-- Stories belong to the PERSON, not to an opportunity: the same integration
-- story is told at this company and the next one. Nothing here references a
-- playbook.
--
-- Forward-only and idempotent.

CREATE TABLE IF NOT EXISTS star_stories (
  user_id     uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  story_id    text        NOT NULL,                 -- client-generated st_…
  title       text        NOT NULL,                 -- the short name, e.g. "Toronto acquisition integration"
  kind        text,                                 -- which of the six playlist types this covers
  origin      text,                                 -- 'seed' | 'drafted' | 'typed' | 'imported'
  created_at  timestamptz,
  updated_at  timestamptz NOT NULL DEFAULT NOW(),   -- last-write-wins key
  data        jsonb       NOT NULL,                 -- slots, drafted versions per lens, user edits
  PRIMARY KEY (user_id, story_id)
);

CREATE INDEX IF NOT EXISTS star_stories_user_idx ON star_stories (user_id);
