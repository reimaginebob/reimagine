-- Phase 1 of moving savedPlaybooks out of the profile_state blob.
--
-- Today every playbook lives in the single users.profile_state JSONB column,
-- which the client rewrites WHOLE on every autosave — so a stale tab/device can
-- overwrite and silently drop playbooks it never saw (a real user lost five).
-- This table gives each playbook its own row so writes/deletes become targeted.
-- Phase 1 stands the table up and backfills it; the client dual-writes to it in
-- parallel (reads still come from the blob). Phase 2 switches reads here; Phase 3
-- stops writing playbooks into the blob and removes the merge shim.
--
-- Keyed on the client sp_… id (newSavedId) — the same key pursuit_status uses.
-- data holds the full record; the other columns are for filtering without
-- parsing the jsonb. Forward-only, idempotent.

CREATE TABLE IF NOT EXISTS saved_playbooks (
  user_id     uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  playbook_id text        NOT NULL,
  source      text,                                 -- 'door1' | 'door2'
  archived_at timestamptz,                          -- mirrors record.archivedAt
  created_at  timestamptz,                          -- record.createdAt
  updated_at  timestamptz NOT NULL DEFAULT NOW(),   -- last-write-wins key
  data        jsonb       NOT NULL,                 -- the full savedPlaybook object
  PRIMARY KEY (user_id, playbook_id)
);

CREATE INDEX IF NOT EXISTS saved_playbooks_user_idx ON saved_playbooks (user_id);

-- One-time backfill from the existing blob. Idempotent (ON CONFLICT DO NOTHING);
-- array-guarded (users with no/!=array savedPlaybooks contribute nothing) and
-- date-guarded (a malformed timestamp becomes NULL rather than failing the deploy).
INSERT INTO saved_playbooks (user_id, playbook_id, source, archived_at, created_at, updated_at, data)
SELECT u.id,
       elem->>'id',
       elem->>'source',
       CASE WHEN elem->>'archivedAt' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' THEN (elem->>'archivedAt')::timestamptz END,
       CASE WHEN elem->>'createdAt'  ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' THEN (elem->>'createdAt')::timestamptz END,
       COALESCE(
         CASE WHEN elem->>'updatedAt' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' THEN (elem->>'updatedAt')::timestamptz END,
         CASE WHEN elem->>'createdAt' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' THEN (elem->>'createdAt')::timestamptz END,
         NOW()),
       elem
FROM users u
CROSS JOIN LATERAL jsonb_array_elements(
  CASE WHEN jsonb_typeof(u.profile_state->'savedPlaybooks') = 'array'
       THEN u.profile_state->'savedPlaybooks' ELSE '[]'::jsonb END) elem
WHERE elem->>'id' IS NOT NULL
ON CONFLICT (user_id, playbook_id) DO NOTHING;
