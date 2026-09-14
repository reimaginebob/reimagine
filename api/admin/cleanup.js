// Nightly retention sweep (2026-09-08 observability brief, plus the prelaunch
// audit's finding #3.10). Two jobs in one cron because they are the same job:
// deleting rows that have no reason to exist any more.
//
// 1. The operational error trail. src/legalDocs.js line 114 promises technical
//    logs are kept "for a limited period (typically 30 to 90 days)". Without
//    this sweep, support_events and support_diagnostics would keep everything
//    forever and that sentence would stop being true the day the table shipped.
//    90 days is the ceiling the policy names, so it is the number used here --
//    not a value to tune upward.
//
// 2. Expired auth material: sessions, magic-link tokens, OAuth codes and
//    tokens. These rows are already dead -- every lookup that reads them
//    filters on expires_at -- so keeping them is pure accumulation of exactly
//    the data least worth keeping.
//
// Auth: CRON_SECRET as a Bearer token, matching every other cron endpoint
// (api/admin/profile-snapshot.js and its siblings).
//
// DESTRUCTIVE BY DESIGN, so the predicates are deliberately conservative and
// each one is spelled out rather than generated in a loop: a bug in a
// generated DELETE is a bug that deletes the wrong table. Counts are logged on
// every run; a failure pages the operator once per window rather than failing
// quietly, because a retention sweep that has silently stopped running looks
// exactly like one that is working.

import { sql } from '../_lib/db.js'
import { alertOnce } from '../_lib/ops-alerts.js'

// The policy ceiling from src/legalDocs.js line 114. Lowering this is fine;
// raising it past 90 needs the privacy page to change first.
export const SUPPORT_RETENTION_DAYS = 90

export default async function handler(req, res) {
  const expected = process.env.CRON_SECRET
  if (!expected) {
    console.error('admin/cleanup: CRON_SECRET not configured')
    return res.status(500).json({ error: 'Server misconfigured' })
  }
  if ((req.headers.authorization || '') !== `Bearer ${expected}`) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  const deleted = {}
  try {
    const supportEvents = await sql`
      DELETE FROM support_events
      WHERE created_at < NOW() - (${SUPPORT_RETENTION_DAYS} * INTERVAL '1 day')
      RETURNING id`
    deleted.support_events = supportEvents.length

    const supportDiagnostics = await sql`
      DELETE FROM support_diagnostics
      WHERE created_at < NOW() - (${SUPPORT_RETENTION_DAYS} * INTERVAL '1 day')
      RETURNING id`
    deleted.support_diagnostics = supportDiagnostics.length

    // getSessionUser slides expires_at forward on every authenticated request,
    // so an expired row here belongs to a session nobody has used since it
    // lapsed. The extra day is slack for clock skew between the app and the
    // database, not a grace period with any meaning of its own.
    const sessions = await sql`
      DELETE FROM sessions
      WHERE expires_at < NOW() - INTERVAL '1 day'
      RETURNING token`
    deleted.sessions = sessions.length

    // Magic-link tokens are single-use and short-lived. A used one is as dead
    // as an expired one, but it is kept for its own window anyway: used_at is
    // what answers "did that sign-in link actually get clicked" during a
    // support conversation, and that question is asked while the link is still
    // recent.
    const magicLinks = await sql`
      DELETE FROM magic_link_tokens
      WHERE expires_at < NOW() - INTERVAL '1 day'
      RETURNING token_hash`
    deleted.magic_link_tokens = magicLinks.length

    const oauthCodes = await sql`
      DELETE FROM oauth_codes
      WHERE expires_at < NOW() - INTERVAL '1 day'
      RETURNING code_hash`
    deleted.oauth_codes = oauthCodes.length

    // COALESCE, not expires_at: on oauth_tokens, expires_at is the ACCESS
    // token's expiry and refresh_expires_at (added 2026-08-22) is the refresh
    // token's. A row whose access token lapsed an hour ago is still live --
    // its refresh token has up to 90 days left, and the connector-beta bearer
    // tokens are exactly that case. Deleting on expires_at alone would sign
    // out every connector every hour. The row is dead only when the thing that
    // can still renew it is dead, which is what this predicate says.
    const oauthTokens = await sql`
      DELETE FROM oauth_tokens
      WHERE COALESCE(refresh_expires_at, expires_at) < NOW() - INTERVAL '1 day'
      RETURNING access_token_hash`
    deleted.oauth_tokens = oauthTokens.length

    console.log('admin/cleanup', { retentionDays: SUPPORT_RETENTION_DAYS, deleted })
    return res.status(200).json({ ok: true, retentionDays: SUPPORT_RETENTION_DAYS, deleted })
  } catch (err) {
    console.error('admin/cleanup: failed', { deleted, message: (err && err.message) || String(err) })
    try {
      await alertOnce('cleanup:failing',
        'Reimagine: the nightly retention sweep is failing',
        [
          `api/admin/cleanup.js threw: ${(err && err.message) || String(err)}`,
          `Deleted before the failure: ${JSON.stringify(deleted)}`,
          `While this is broken, support_events and support_diagnostics keep growing past the ${SUPPORT_RETENTION_DAYS}-day retention the privacy page promises, and expired sessions and tokens accumulate.`,
        ],
        { cooldownHours: 24 }
      )
    } catch { /* alerting must never be the thing that takes the sweep down */ }
    return res.status(500).json({ error: 'Cleanup failed', deleted })
  }
}
