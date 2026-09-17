-- Content-viewed event (2026-09-17 brief, part 1). One row per view: fires
-- when a signed-in user opens or rereads an already-generated section
-- (Personal Brand, Income Now, an Opportunity Playbook, a Focus Playbook
-- reopen), distinct from generating it. Before this table, someone could
-- reopen their Personal Brand and reread it for twenty minutes and it
-- registered as nothing -- indistinguishable from a mechanics failure (the
-- section never rendered) or a coaching failure (they read it and felt
-- nothing). See Output/handoff/2026-09-17_content-view-and-donation-metrics.md.
--
-- Storage is account-linked -- a view is only useful matched to who viewed
-- it, the same way a Stripe donation is only useful matched to an account
-- before it becomes a rate -- but every reader of this table stays
-- aggregate-only by convention: nothing joins it back out as a per-account
-- view log. src/legalDocs.js line 38 ("General usage metrics, such as which
-- pages or steps were viewed and how long sessions lasted") already covers
-- this; no privacy-doc change needed.
--
-- Deliberately its OWN event, not folded into api/admin/growth.js's `acts`
-- session definition (sessions/generation_events/chat_messages) -- adding a
-- fourth source there mid-launch would move that metric. Read by new,
-- separate queries alongside it, not by extending it.
--
-- Written best-effort from api/view-events.js (via api/_lib/view-events.js)
-- -- a failed insert never blocks the page. Forward-only, idempotent.
--
-- Verify with:
--   SELECT to_regclass('public.view_events');

CREATE TABLE IF NOT EXISTS view_events (
  id         bigserial   PRIMARY KEY,
  user_id    uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  section    text        NOT NULL,
  viewed_at  timestamptz NOT NULL DEFAULT NOW()
);
-- Serves per-account and per-section aggregate queries (e.g. "did this
-- account ever reopen its Personal Brand").
CREATE INDEX IF NOT EXISTS view_events_user_viewed_idx ON view_events (user_id, viewed_at);
CREATE INDEX IF NOT EXISTS view_events_section_idx ON view_events (section);
