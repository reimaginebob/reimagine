-- Stage vocabulary: In Conversation is retired (it only ever mapped to the
-- same Staircase step as Researching/Applied, with no other special-cased
-- logic anywhere) in favor of two more specific stages the pipeline board
-- needs: Phone Screen and Final Round. Forward-only, idempotent: re-running
-- is a no-op once no row holds the old value.
UPDATE pursuit_status SET stage = 'applied', updated_at = NOW() WHERE stage = 'in_conversation';
