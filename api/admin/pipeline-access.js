// Admin control to grant / revoke the assistant connector beta for an
// existing user, by email. In the test-user phase everyone invited is already a
// registered user, so this is a direct row update — no signup timing to track.
//
// Auth: signed-in session + ADMIN_LOGIN_EMAILS (api/_lib/admin-auth.js), same
// as the analytics dashboard. GET lists current testers; POST { email,
// action: 'grant'|'revoke' }.

import { sql } from '../_lib/db.js'
import { CONNECTOR_BETA_FLAG, GRANTABLE_FLAGS } from '../_lib/feature-flags.js'
import { checkAdminAuth, adminLoginEmailsMissing } from '../_lib/admin-auth.js'

// Named in api/_lib/feature-flags.js. The default is unchanged from when this
// endpoint served one pilot, so an older caller that sends no `flag` still
// grants the connector beta and nothing about its behaviour moved.
const DEFAULT_FLAG = CONNECTOR_BETA_FLAG

// Resolve the requested flag against the registry. Anything unregistered is
// rejected rather than written: a flag value nothing reads is a silent no-op
// that looks like a successful grant, which is the worst outcome for a pilot.
function resolveFlag(raw) {
  if (raw === undefined || raw === null || raw === '') return DEFAULT_FLAG
  const f = typeof raw === 'string' ? raw.trim() : ''
  return Object.prototype.hasOwnProperty.call(GRANTABLE_FLAGS, f) ? f : null
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  if (adminLoginEmailsMissing()) {
    console.error('admin/pipeline-access: ADMIN_LOGIN_EMAILS not configured')
    return res.status(500).json({ error: 'Server misconfigured' })
  }
  if ((await checkAdminAuth(req, res)) !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' })
  }

  try {
    if (req.method === 'GET') {
      const flag = resolveFlag(req.query && req.query.flag)
      if (!flag) return res.status(400).json({ error: 'unknown flag' })

      // The connector beta is the one pilot where "who has it" isn't the whole
      // question -- a granted flag only lets someone MINT a credential, and the
      // credential is the thing that actually reaches a user's pipeline
      // unattended. Every other flag stops mattering once granted, so only this
      // one pays for the extra join.
      if (flag === CONNECTOR_BETA_FLAG) {
        const rows = await sql`
          SELECT
            u.email,
            u.push_token_hash IS NOT NULL AS has_push_token,
            u.push_token_created_at,
            ot.active_oauth_tokens,
            ot.latest_oauth_token_at
          FROM users u
          LEFT JOIN LATERAL (
            SELECT count(*)::int AS active_oauth_tokens, max(t.created_at) AS latest_oauth_token_at
            FROM oauth_tokens t
            WHERE t.user_id = u.id AND t.expires_at > NOW()
          ) ot ON true
          WHERE ${flag} = ANY(u.feature_flags)
          ORDER BY lower(u.email)
        `
        const tokenStatus = {}
        for (const r of rows) {
          tokenStatus[r.email] = {
            hasPushToken: !!r.has_push_token,
            pushTokenCreatedAt: r.push_token_created_at,
            activeOAuthTokens: r.active_oauth_tokens || 0,
            latestOAuthTokenAt: r.latest_oauth_token_at,
          }
        }
        return res.status(200).json({ testers: rows.map(r => r.email), tokenStatus, flag, flags: GRANTABLE_FLAGS })
      }

      const rows = await sql`SELECT email FROM users WHERE ${flag} = ANY(feature_flags) ORDER BY lower(email)`
      // `flags` lets the dashboard build its picker from the server's registry
      // rather than from a copy of it that can drift.
      return res.status(200).json({ testers: rows.map(r => r.email), flag, flags: GRANTABLE_FLAGS })
    }

    const body = req.body || {}
    const email = typeof body.email === 'string' ? body.email.trim() : ''
    const action = typeof body.action === 'string' ? body.action.trim() : ''
    if (!email) return res.status(400).json({ error: 'email required' })
    if (action !== 'grant' && action !== 'revoke') {
      return res.status(400).json({ error: "action must be 'grant' or 'revoke'" })
    }
    const flag = resolveFlag(body.flag)
    if (!flag) return res.status(400).json({ error: 'unknown flag' })

    const rows = action === 'grant'
      ? await sql`
          UPDATE users
          SET feature_flags = CASE WHEN ${flag} = ANY(feature_flags) THEN feature_flags ELSE array_append(feature_flags, ${flag}) END
          WHERE lower(email) = lower(${email})
          RETURNING email, (${flag} = ANY(feature_flags)) AS enabled`
      : await sql`
          UPDATE users
          SET feature_flags = array_remove(feature_flags, ${flag})
          WHERE lower(email) = lower(${email})
          RETURNING email, (${flag} = ANY(feature_flags)) AS enabled`
    if (rows.length === 0) return res.status(404).json({ error: 'No account with that email' })
    console.log('admin/pipeline-access', { email, action, flag, enabled: rows[0].enabled })
    return res.status(200).json({ ok: true, email: rows[0].email, flag, enabled: !!rows[0].enabled })
  } catch (err) {
    console.error('admin/pipeline-access: query failed', err && err.message)
    return res.status(500).json({ error: 'Update failed' })
  }
}
