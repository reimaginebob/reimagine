-- Corrections diagnostic columns: theme classification (which recurring
-- pattern a correction represents -- wrong fact, hallucination, the system
-- not accepting a correction, sounds too AI) and Personal Brand ramification
-- flags (does this correction, made somewhere else, actually implicate
-- Personal Brand -- p3 -- which almost everything downstream is built from).
--
-- source distinguishes where a correction came from. Only 'refinebox' is
-- written today (the RefineBox correction flow, api/profile/save.js). 'coach'
-- (Coach-as-Concierge profile edits that are functionally corrections, not
-- first-time captures) is a deliberate later phase -- see
-- Output/session-continuity/2026-09-13_corrections-vs-coach-concierge-scope-question.md
-- for why this was scoped out rather than guessed at. The column exists now
-- so both sources land in one table and one report once that phase ships,
-- rather than a second table needing to be merged in later.
--
-- personal_brand_relevant is structural: true when the corrected step is p3
-- itself, or SECTION_UPSTREAMS (src/App.jsx) already says the step was built
-- from p3. Cheap, always available, computed client-side at capture time
-- (src/App.jsx's recordCorrection). personal_brand_confirmed is the stronger
-- signal: the correction's own wording was found, at capture time, to
-- actually contradict something already written in the live Personal Brand
-- output -- the same test Track 8's on-screen upstream-check prompt already
-- runs, just saved this time instead of discarded once the prompt is
-- dismissed. Both are NULL until proven true; a correction on a step that
-- was never on the p3 side of SECTION_UPSTREAMS should read as "not
-- personal-brand-relevant", not "unknown", so the backfill below sets false
-- rather than leaving every historical row NULL.
--
-- conflict_phrase carries the existing Track 6/7 signal (the user asked to
-- use a phrase Reimagine deliberately writes around and chose "Apply
-- anyway") -- already computed client-side, just was never captured before
-- this table existed.
--
-- theme/theme_notes/theme_classified_at are filled by a batch classifier
-- (api/admin/classify-corrections.js), not at write time -- classification
-- needs the correction's full context and is worth being able to re-run, not
-- something to compute inline on every save.
--
-- Forward-only, idempotent: safe to re-run.

ALTER TABLE corrections ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'refinebox';
ALTER TABLE corrections ADD COLUMN IF NOT EXISTS personal_brand_relevant boolean;
ALTER TABLE corrections ADD COLUMN IF NOT EXISTS personal_brand_confirmed boolean;
ALTER TABLE corrections ADD COLUMN IF NOT EXISTS conflict_phrase text;
ALTER TABLE corrections ADD COLUMN IF NOT EXISTS theme text;
ALTER TABLE corrections ADD COLUMN IF NOT EXISTS theme_notes text;
ALTER TABLE corrections ADD COLUMN IF NOT EXISTS theme_classified_at timestamptz;

CREATE INDEX IF NOT EXISTS corrections_theme_idx ON corrections (theme);
CREATE INDEX IF NOT EXISTS corrections_pb_relevant_idx ON corrections (personal_brand_relevant) WHERE personal_brand_relevant = true;

-- Backfill personal_brand_relevant for every existing row, mirroring
-- SECTION_UPSTREAMS in src/App.jsx exactly (p5/p6/p7/p8/p11/p_res/income
-- trace back to p3; p3 itself trivially does; p9/salaryRead and anything
-- else does not). personal_brand_confirmed is left NULL for historical
-- rows -- it depends on what Personal Brand's output looked like at the
-- moment of correction, which was never recorded and cannot be
-- reconstructed after the fact.
UPDATE corrections
SET personal_brand_relevant = (step IN ('p3', 'p5', 'p6', 'p7', 'p8', 'p11', 'p_res', 'income'))
WHERE personal_brand_relevant IS NULL;
