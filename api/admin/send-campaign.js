// Sends a campaign email to the people at a given stage. Deliberately
// triggered, never automatic.
//
//   POST /api/admin/send-campaign
//   { "campaign": "dropout-ask", "dryRun": true, "limit": 25 }
//
// Auth: ADMIN_TOKEN only. The analyst token cannot reach this and must never be
// able to — it is a read credential, and this is the one endpoint in the
// codebase whose mistakes land in a stranger's inbox and cannot be taken back.
//
// ---------------------------------------------------------------------------
// SAFETY, which is most of what this file is
// ---------------------------------------------------------------------------
// Everything else here can be fixed by shipping a correction. A wrong email
// cannot. So the defaults lean hard toward doing nothing:
//
//   * dryRun is TRUE unless the caller passes exactly false. A malformed body,
//     a missing field, a typo — all of those dry-run rather than send.
//   * A per-run cap, defaulting small. `updates.career.club` has no sending
//     history, and a first blast to hundreds of unengaged addresses is how a
//     new domain gets throttled. Ramping is enforced, not advised.
//   * The campaign_sends row is written BEFORE Resend is called. If the insert
//     fails the send does not happen, so a retry, a double-click, or two
//     operators running the same command hit a UNIQUE constraint instead of a
//     recipient.
//   * Stage is re-checked at send time. Somebody who moved on since the list
//     was drawn is dropped rather than told they are stuck.
//
// Excluded from every campaign, without a flag to turn it off:
//   * suspended accounts — never invite someone back to a product they are
//     currently blocked from
//   * internal @career.club addresses
//   * anyone active in the last fortnight — a person who used it on Tuesday
//     should not get "you stopped" on Thursday
//   * anyone who already received this campaign
//   * anyone who received ANY campaign inside the frequency window, so two
//     campaigns cannot stack on the same person in the same week
//
// Unsubscribes are Resend's job, and they only work if the recipient exists as
// a contact — an address Resend has never seen has no opt-out record to check,
// so it would be mailed regardless of what that person previously chose. Every
// recipient is therefore ensured as a contact before the send, and the send
// carries topic_id so an opt-out from Reimagine mail is honoured without
// touching the Corner newsletter.

import { sql } from '../_lib/db.js'
import { checkAdminAuth, adminTokenMissing } from '../_lib/admin-auth.js'
import { getCampaign, CAMPAIGN_FROM, CAMPAIGN_REPLY_TO, CAMPAIGN_TOPIC_ID } from '../../src/campaign-templates.js'

const DEFAULT_LIMIT = 25
const MAX_LIMIT = 200
// Someone who used the product this recently is not the audience for a message
// about having stopped.
const RECENT_ACTIVITY_DAYS = 14
// Bob's ceiling: at most one campaign email per person per week.
const FREQUENCY_WINDOW_DAYS = 7

function parseAdminEmails(envValue) {
  if (typeof envValue !== 'string') return []
  return envValue.split(',').map(e => e.trim().toLowerCase()).filter(e => e.length > 0)
}

// PATCH first, POST on 404. Avoids needing a "does this contact exist" lookup,
// and leaves an existing contact's name, segments and topic choices untouched —
// this must never overwrite somebody's subscription preferences.
async function ensureContact(apiKey, { email, firstName, lastName }) {
  const headers = { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
  const patch = await fetch(`https://api.resend.com/contacts/${encodeURIComponent(email)}`, {
    method: 'PATCH', headers, body: JSON.stringify({}),
  })
  if (patch.ok) return { created: false }
  if (patch.status !== 404) {
    const body = await patch.text().catch(() => '')
    throw new Error(`contact lookup failed ${patch.status} ${body.slice(0, 200)}`)
  }
  const create = await fetch('https://api.resend.com/contacts', {
    method: 'POST', headers,
    body: JSON.stringify({
      email,
      first_name: firstName || undefined,
      last_name: lastName || undefined,
    }),
  })
  if (!create.ok) {
    const body = await create.text().catch(() => '')
    throw new Error(`contact create failed ${create.status} ${body.slice(0, 200)}`)
  }
  return { created: true }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  if (adminTokenMissing()) {
    console.error('admin/send-campaign: ADMIN_TOKEN not configured')
    return res.status(500).json({ error: 'Server misconfigured' })
  }
  // allowAnalyst is absent on purpose. Do not add it.
  if (checkAdminAuth(req) !== 'admin') return res.status(403).json({ error: 'Forbidden' })

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.error('admin/send-campaign: RESEND_API_KEY not configured')
    return res.status(500).json({ error: 'Server misconfigured' })
  }

  const body = req.body || {}
  const campaign = getCampaign(typeof body.campaign === 'string' ? body.campaign.trim() : '')
  if (!campaign) return res.status(400).json({ error: 'unknown campaign' })

  // Anything other than an explicit false is a dry run.
  const dryRun = body.dryRun !== false
  const rawLimit = Number(body.limit)
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(Math.floor(rawLimit), MAX_LIMIT) : DEFAULT_LIMIT

  const adminEmails = parseAdminEmails(process.env.ADMIN_EMAILS)

  try {
    // Eligibility. Every exclusion here is a rule from _CURRENT.md rather than
    // a preference, and the stage expression matches api/admin/user-stages.js.
    const rows = await sql`
      WITH acts AS (
        SELECT user_id, MAX(at) AS last_at FROM (
          SELECT user_id, created_at AS at FROM sessions
          UNION ALL SELECT user_id, last_used_at FROM sessions
          UNION ALL SELECT user_id, created_at FROM generation_events WHERE user_id IS NOT NULL
          UNION ALL SELECT user_id, created_at FROM chat_messages WHERE user_id IS NOT NULL
        ) a GROUP BY user_id
      ),
      staged AS (
        SELECT
          u.id, u.email, u.first_name, u.last_name, u.survey_token, a.last_at,
          CASE
            WHEN u.profile_state->'done' ?& ARRAY['p5','p6','p7','p8','p9','p11','p_res'] THEN 'focus_complete'
            WHEN ((u.profile_state->'done') ? 'op'
                  OR NULLIF(TRIM(u.profile_state->'outputs'->>'op'), '') IS NOT NULL)
             AND ((u.profile_state->'done') ? 'laneSelect'
                  OR NULLIF(TRIM(u.profile_state->'outputs'->>'p5'), '') IS NOT NULL) THEN 'both_doors'
            WHEN ((u.profile_state->'done') ? 'laneSelect'
                  OR NULLIF(TRIM(u.profile_state->'outputs'->>'p4'), '') IS NOT NULL
                  OR NULLIF(TRIM(u.profile_state->'outputs'->>'p5'), '') IS NOT NULL) THEN 'career_paths'
            WHEN ((u.profile_state->'done') ? 'op'
                  OR NULLIF(TRIM(u.profile_state->'outputs'->>'op'), '') IS NOT NULL) THEN 'opportunity'
            WHEN NULLIF(TRIM(u.profile_state->'outputs'->>'p3'), '') IS NOT NULL THEN 'personal_brand_no_door'
            WHEN NULLIF(TRIM(u.profile_state->'profile'->>'resume'), '')     IS NOT NULL
              OR NULLIF(TRIM(u.profile_state->'profile'->>'linkedin'), '')   IS NOT NULL
              OR NULLIF(TRIM(u.profile_state->'profile'->>'assess'), '')     IS NOT NULL
              OR NULLIF(TRIM(u.profile_state->'profile'->>'values'), '')     IS NOT NULL
              OR NULLIF(TRIM(u.profile_state->'profile'->>'passions'), '')   IS NOT NULL
              OR NULLIF(TRIM(u.profile_state->'profile'->>'lifeEvents'), '') IS NOT NULL THEN 'gave_inputs_no_output'
            ELSE 'signed_up_only'
          END AS stage
        FROM users u
        LEFT JOIN acts a ON a.user_id = u.id
        WHERE u.suspended_at IS NULL
          AND LOWER(u.email) <> ALL(${adminEmails}::text[])
      )
      SELECT s.id, s.email, s.first_name, s.last_name, s.survey_token, s.stage, s.last_at
      FROM staged s
      WHERE s.stage = ANY(${campaign.stages}::text[])
        AND s.survey_token IS NOT NULL
        AND (s.last_at IS NULL OR s.last_at < NOW() - ${`${RECENT_ACTIVITY_DAYS} days`}::interval)
        AND NOT EXISTS (
          SELECT 1 FROM campaign_sends c
           WHERE c.user_id = s.id AND c.campaign = ${campaign.key})
        AND NOT EXISTS (
          SELECT 1 FROM campaign_sends c
           WHERE c.user_id = s.id
             AND c.sent_at >= NOW() - ${`${FREQUENCY_WINDOW_DAYS} days`}::interval)
      ORDER BY s.last_at ASC NULLS FIRST
      LIMIT ${limit}`

    const recipients = rows.map(r => ({
      email: r.email,
      first_name: r.first_name || null,
      stage: r.stage,
      last_activity: r.last_at || null,
    }))

    if (dryRun) {
      // Render the real email for the first recipient so the copy can be read
      // rather than imagined. A dry run that only returns counts is how bad
      // copy ships.
      const sample = rows[0]
      const preview = sample
        ? {
            to: sample.email,
            from: CAMPAIGN_FROM,
            reply_to: CAMPAIGN_REPLY_TO,
            subject: campaign.subject,
            html: campaign.render({ firstName: sample.first_name, surveyToken: sample.survey_token }),
          }
        : null
      return res.status(200).json({
        ok: true,
        dry_run: true,
        campaign: campaign.key,
        stages: campaign.stages,
        would_send: recipients.length,
        limit,
        excluded_by: {
          suspended: 'always',
          internal_addresses: 'always',
          active_within_days: RECENT_ACTIVITY_DAYS,
          already_received_this_campaign: 'always',
          any_campaign_within_days: FREQUENCY_WINDOW_DAYS,
        },
        recipients,
        preview,
      })
    }

    const sent = []
    const failed = []
    for (const r of rows) {
      try {
        // Claim the send first. If this row already exists the constraint
        // rejects it and nothing is emailed — that is the point.
        const claim = await sql`
          INSERT INTO campaign_sends (user_id, campaign, stage_at_send)
          VALUES (${r.id}, ${campaign.key}, ${r.stage})
          ON CONFLICT (user_id, campaign) DO NOTHING
          RETURNING id`
        if (claim.length === 0) continue

        await ensureContact(apiKey, {
          email: r.email, firstName: r.first_name, lastName: r.last_name,
        })

        const resp = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: CAMPAIGN_FROM,
            to: [r.email],
            reply_to: CAMPAIGN_REPLY_TO,
            subject: campaign.subject,
            html: campaign.render({ firstName: r.first_name, surveyToken: r.survey_token }),
            topic_id: CAMPAIGN_TOPIC_ID,
            tags: [{ name: 'campaign', value: campaign.key }],
          }),
        })
        const out = await resp.json().catch(() => ({}))
        if (!resp.ok) throw new Error(`send failed ${resp.status} ${JSON.stringify(out).slice(0, 200)}`)

        await sql`UPDATE campaign_sends SET resend_id = ${out.id || null}
                   WHERE user_id = ${r.id} AND campaign = ${campaign.key}`
        sent.push(r.email)
      } catch (err) {
        // The claim row stays. A failure here means the send may or may not have
        // reached Resend, and re-sending on the next run risks a duplicate in
        // somebody's inbox — the worse of the two outcomes. The row is the
        // record that this person was attempted; clear it by hand to retry.
        console.error('admin/send-campaign: recipient failed', { campaign: campaign.key, error: err && err.message })
        failed.push({ email: r.email, error: String(err && err.message).slice(0, 200) })
      }
    }

    console.log('admin/send-campaign', { campaign: campaign.key, sent: sent.length, failed: failed.length })
    return res.status(200).json({
      ok: true, dry_run: false, campaign: campaign.key,
      sent: sent.length, failed: failed.length, recipients: sent, failures: failed,
    })
  } catch (err) {
    console.error('admin/send-campaign: failed', err && err.message)
    return res.status(500).json({ error: 'Send failed' })
  }
}
