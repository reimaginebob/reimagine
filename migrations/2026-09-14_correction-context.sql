-- Correction context: the text a correction was aimed at (launch capture
-- foundation, 2026-09-14, Output/handoff/2026-09-14_launch-capture-foundation.md,
-- PR 3).
--
-- corrections.original_inference has been NULL on every row since the table
-- was built (2026-09-11_corrections-table.sql). A correction records what the
-- person wrote back and never what provoked it, so "that's not right" carries
-- no information on its own, and several questions about the corrections
-- corpus cannot be answered at all.
--
-- Why a separate table instead of writing the text into profile.corrections
-- (which is how every other correction field reaches the corrections table):
-- profile.corrections rides inside the profile blob, which is saved whole on
-- every autosave and has a size cap. A full section snapshot per correction
-- (often 5-15 KB, and heavy correctors have 40+ corrections) would push real
-- accounts toward that cap. So the client posts the text once, directly, to
-- api/correction-context.js, and the blob stays as it was.
--
-- The text is the section AS THE PERSON SAW IT when they wrote the correction,
-- taken from each call site in src/App.jsx rather than looked up by step --
-- outputs[step] is the wrong source on the Opportunity Playbook cards and the
-- opportunity Bridge Story, which share step ids with the Focus sections. The
-- whole section is stored, not an extracted passage: locating the passage is
-- analysis, which can be re-run any time; the snapshot cannot be recreated.
--
-- original_inference is still filled, from whichever write lands second:
-- api/correction-context.js updates the corrections row if the autosave
-- already inserted it, and api/profile/save.js reads this table when it
-- inserts a correction whose context arrived first.
--
-- Write-once (correction_id is the client-generated corrections.id, ON
-- CONFLICT DO NOTHING). record_id is the saved playbook id for opportunity-card
-- corrections, NULL otherwise.
--
-- Forward-only, idempotent.

CREATE TABLE IF NOT EXISTS correction_context (
  correction_id  text        PRIMARY KEY,
  user_id        uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  step           text        NOT NULL,
  record_id      text,
  original_text  text        NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS correction_context_user_idx ON correction_context (user_id, created_at DESC);
