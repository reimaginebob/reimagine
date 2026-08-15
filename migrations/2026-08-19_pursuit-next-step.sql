-- My Pipeline: separate "My Next Steps" date from the scheduled-meeting date.
--
-- next_conversation_at is reframed as the "Next scheduled meeting" (calendar
-- truth — a real booked event). next_step_at is new: the date for the user's
-- next action ("My Next Steps"), which is NOT an appointment — a follow-up, prep,
-- outreach, etc. The two are independent (a pursuit can have a meeting, a next
-- step, both, or neither), which is why they need separate columns.
--
-- next_move (the action text) stays; "My Next Steps" = next_move + next_step_at.
--
-- Forward-only, idempotent. Auto-applies on prod deploy.

ALTER TABLE pursuit_status ADD COLUMN IF NOT EXISTS next_step_at timestamptz;
