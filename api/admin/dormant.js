// Accounts that signed up and stopped, grouped by how far they actually got,
// with likely duplicate accounts flagged. Backs the "Signed up and stopped"
// panel on the Growth tab.
//
// Auth: Bearer ADMIN_TOKEN, same token as the other admin endpoints.
// Method: GET only.
//
// Separate from api/admin/growth.js on purpose. Growth is aggregates only;
// this returns email addresses, so it is its own endpoint with its own name
// and can be reasoned about (and revoked) on its own.
//
// "Did nothing" is three different situations and they deserve different
// treatment, so they are returned as three lists rather than one:
//
//   nothing_at_all    signed up, never typed anything, never generated. The
//                     weakest signal -- many are curiosity clicks.
//   inputs_only       gave us material and got nothing back. The most
//                     valuable group to reach: they spent effort, hit
//                     something, and left. Whatever stopped them is a real
//                     product problem and they can tell you what it was.
//   brand_no_playbook saw their Personal Brand and stopped before a playbook.
//                     They have seen the product's opening move and declined
//                     the next one.
//
// Duplicates matter here because a "dormant" account is often the second
// account of somebody who did their work elsewhere -- a second address, a
// Gmail alias, or a re-signup. Emailing them about not having started would
// be wrong. Three keys are checked (see the grouping below): exact address
// case-folded, provider-normalised address, and first+last name.

import { sql } from '../_lib/db.js'
import { checkAdminAuth, adminTokenMissing } from '../_lib/admin-auth.js'

function parseAdminEmails(envValue) {
  if (typeof envValue !== 'string') return []
  return envValue.split(',').map(e => e.trim().toLowerCase()).filter(e => e.length > 0)
}

// Provider-normalised address, for spotting the same inbox written two ways.
// Everywhere: case-folded, and anything after a '+' in the local part dropped
// (a tag, not a different mailbox). Gmail only: dots in the local part removed,
// since Gmail ignores them and googlemail.com is the same service.
function normalizeEmail(raw) {
  const e = String(raw || '').trim().toLowerCase()
  const at = e.lastIndexOf('@')
  if (at < 1) return e
  let local = e.slice(0, at)
  const domain = e.slice(at + 1)
  const plus = local.indexOf('+')
  if (plus > 0) local = local.slice(0, plus)
  if (domain === 'gmail.com' || domain === 'googlemail.com') {
    return `${local.replace(/\./g, '')}@gmail.com`
  }
  return `${local}@${domain}`
}

function nameKey(first, last) {
  const f = String(first || '').trim().toLowerCase()
  const l = String(last || '').trim().toLowerCase()
  if (!f || !l) return null
  const key = `${f} ${l}`
  // Two-character names are almost always placeholder input; matching on them
  // would manufacture duplicates rather than find them.
  return key.length >= 5 ? key : null
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  if (adminTokenMissing()) {
    console.error('admin/dormant: ADMIN_TOKEN not configured')
    return res.status(500).json({ error: 'Server misconfigured' })
  }
  // Read-only. Returns email addresses, so it is deliberately one of only three
  // routes an analyst token opens.
  if (!checkAdminAuth(req, { allowAnalyst: true })) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  const adminEmails = parseAdminEmails(process.env.ADMIN_EMAILS)

  try {
    // One read of every account with its activity summary. At this scale the
    // whole table is a few hundred rows, so classification and duplicate
    // grouping happen in JS below -- far clearer than expressing either in SQL,
    // and the cost is a single query.
    //
    // profile_state is the autosave blob: { step, profile, outputs, done,
    // savedPlaybooks, ... }. Inputs live under ->'profile', generated text
    // under ->'outputs'.
    const rows = await sql`
      WITH acts AS (
        SELECT user_id, MAX(at) AS last_at
        FROM (
          SELECT user_id, created_at AS at FROM sessions
          UNION ALL SELECT user_id, last_used_at FROM sessions
          UNION ALL SELECT user_id, created_at FROM generation_events WHERE user_id IS NOT NULL
          UNION ALL SELECT user_id, created_at FROM chat_messages WHERE user_id IS NOT NULL
        ) a
        GROUP BY user_id
      )
      SELECT
        u.email,
        u.first_name,
        u.last_name,
        u.created_at,
        u.last_login_at,
        u.signup_source,
        u.signup_source_detail,
        u.suspended_at IS NOT NULL AS suspended,
        a.last_at AS last_activity,
        -- Generated text: any non-empty value under outputs. Counting keys
        -- alone would score an account that holds twelve empty strings.
        (SELECT COUNT(*) FROM jsonb_each_text(
            CASE WHEN jsonb_typeof(u.profile_state->'outputs') = 'object'
                 THEN u.profile_state->'outputs' ELSE '{}'::jsonb END) AS e(k, v)
          WHERE NULLIF(TRIM(e.v), '') IS NOT NULL)::int AS outputs,
        NULLIF(TRIM(u.profile_state->'outputs'->>'p3'), '') IS NOT NULL AS has_brand,
        COALESCE(jsonb_array_length(
          CASE WHEN jsonb_typeof(u.profile_state->'savedPlaybooks') = 'array'
               THEN u.profile_state->'savedPlaybooks' ELSE '[]'::jsonb END), 0)::int AS playbooks,
        -- Orientation material the person typed or pasted in. Each field
        -- counted once; rep is four sub-fields and counts as one.
        (
          (CASE WHEN NULLIF(TRIM(u.profile_state->'profile'->>'resume'), '')     IS NOT NULL THEN 1 ELSE 0 END) +
          (CASE WHEN NULLIF(TRIM(u.profile_state->'profile'->>'linkedin'), '')   IS NOT NULL THEN 1 ELSE 0 END) +
          (CASE WHEN NULLIF(TRIM(u.profile_state->'profile'->>'assess'), '')     IS NOT NULL THEN 1 ELSE 0 END) +
          (CASE WHEN NULLIF(TRIM(u.profile_state->'profile'->>'values'), '')     IS NOT NULL THEN 1 ELSE 0 END) +
          (CASE WHEN NULLIF(TRIM(u.profile_state->'profile'->>'passions'), '')   IS NOT NULL THEN 1 ELSE 0 END) +
          (CASE WHEN NULLIF(TRIM(u.profile_state->'profile'->>'lifeEvents'), '') IS NOT NULL THEN 1 ELSE 0 END) +
          (CASE WHEN COALESCE(NULLIF(TRIM(u.profile_state->'profile'->'rep'->>'memory'), ''),
                              NULLIF(TRIM(u.profile_state->'profile'->'rep'->>'emergency'), ''),
                              NULLIF(TRIM(u.profile_state->'profile'->'rep'->>'twoWords'), ''),
                              NULLIF(TRIM(u.profile_state->'profile'->'rep'->>'other'), '')) IS NOT NULL THEN 1 ELSE 0 END)
        )::int AS input_fields,
        (SELECT COUNT(*) FROM sessions s WHERE s.user_id = u.id)::int             AS sessions,
        (SELECT COUNT(*) FROM generation_events g WHERE g.user_id = u.id)::int    AS generations,
        (SELECT COUNT(*) FROM chat_messages c WHERE c.user_id = u.id)::int        AS coach_turns
      FROM users u
      LEFT JOIN acts a ON a.user_id = u.id
      WHERE LOWER(u.email) <> ALL(${adminEmails}::text[])
      ORDER BY u.created_at DESC`

    const now = Date.now()
    const accounts = rows.map((r) => {
      const created = r.created_at ? new Date(r.created_at).getTime() : null
      const last = r.last_activity ? new Date(r.last_activity).getTime() : null
      return {
        email: r.email,
        name: [r.first_name, r.last_name].filter(Boolean).join(' ').trim() || null,
        created_at: r.created_at,
        last_activity: r.last_activity,
        days_since_signup: created ? Math.floor((now - created) / 86400000) : null,
        // Whole days between signing up and the last thing they did. 0 means
        // everything they ever did happened the day they arrived.
        days_active_span: (created && last) ? Math.max(0, Math.floor((last - created) / 86400000)) : 0,
        sessions: r.sessions,
        generations: r.generations,
        coach_turns: r.coach_turns,
        outputs: r.outputs,
        input_fields: r.input_fields,
        playbooks: r.playbooks,
        has_brand: !!r.has_brand,
        suspended: !!r.suspended,
        signup_source: r.signup_source || null,
        signup_source_detail: r.signup_source_detail || null,
        _normEmail: normalizeEmail(r.email),
        _lowEmail: String(r.email || '').trim().toLowerCase(),
        _nameKey: nameKey(r.first_name, r.last_name),
        _active: r.outputs > 0 || r.playbooks > 0 || r.generations > 0,
      }
    })

    // --- Duplicate clusters -------------------------------------------------
    // Built over EVERY account, not just the dormant ones. The case that
    // matters is a dormant account whose twin is busy: that person did their
    // work, just not here, and contacting them about not having started would
    // be wrong.
    const clusters = new Map() // key -> { kind, key, members[] }
    const addTo = (kind, key, acc) => {
      if (!key) return
      const id = `${kind}:${key}`
      if (!clusters.has(id)) clusters.set(id, { kind, key, members: [] })
      clusters.get(id).members.push(acc)
    }
    for (const a of accounts) {
      addTo('case', a._lowEmail, a)
      addTo('address', a._normEmail, a)
      addTo('name', a._nameKey, a)
    }

    const dupeInfo = new Map() // email -> { kinds:Set, twins:Set, twinActive:bool }
    const dupeClusters = []
    for (const c of clusters.values()) {
      if (c.members.length < 2) continue
      // A name cluster whose members are already caught as the same address is
      // not a second finding; only report the address-level one.
      if (c.kind === 'name') {
        const norms = new Set(c.members.map(m => m._normEmail))
        if (norms.size < 2) continue
      }
      if (c.kind === 'case') {
        const raws = new Set(c.members.map(m => m.email))
        if (raws.size < 2) continue
      }
      dupeClusters.push({
        kind: c.kind,
        key: c.key,
        accounts: c.members.map(m => ({
          email: m.email, name: m.name, created_at: m.created_at,
          outputs: m.outputs, playbooks: m.playbooks, active: m._active,
        })),
        any_active: c.members.some(m => m._active),
      })
      for (const m of c.members) {
        if (!dupeInfo.has(m.email)) dupeInfo.set(m.email, { kinds: new Set(), twins: new Set(), twinActive: false })
        const info = dupeInfo.get(m.email)
        info.kinds.add(c.kind)
        for (const other of c.members) {
          if (other.email !== m.email) {
            info.twins.add(other.email)
            if (other._active) info.twinActive = true
          }
        }
      }
    }

    const decorate = (a) => {
      const info = dupeInfo.get(a.email)
      const { _normEmail, _lowEmail, _nameKey, _active, ...rest } = a
      return {
        ...rest,
        duplicate_of: info ? [...info.twins] : [],
        duplicate_kinds: info ? [...info.kinds] : [],
        // The flag that decides whether this person is worth contacting.
        twin_is_active: info ? info.twinActive : false,
      }
    }

    // --- The three lists ----------------------------------------------------
    const nothingAtAll = []
    const inputsOnly = []
    const brandNoPlaybook = []
    for (const a of accounts) {
      if (a.outputs === 0 && a.input_fields === 0) nothingAtAll.push(decorate(a))
      else if (a.outputs === 0) inputsOnly.push(decorate(a))
      else if (a.has_brand && a.playbooks === 0 && a.outputs <= 2) brandNoPlaybook.push(decorate(a))
    }

    return res.status(200).json({
      ok: true,
      as_of: new Date().toISOString(),
      totals: {
        accounts: accounts.length,
        nothing_at_all: nothingAtAll.length,
        inputs_only: inputsOnly.length,
        brand_no_playbook: brandNoPlaybook.length,
        duplicate_clusters: dupeClusters.length,
        dormant_with_active_twin: [...nothingAtAll, ...inputsOnly, ...brandNoPlaybook].filter(a => a.twin_is_active).length,
      },
      nothing_at_all: nothingAtAll,
      inputs_only: inputsOnly,
      brand_no_playbook: brandNoPlaybook,
      duplicates: dupeClusters,
    })
  } catch (err) {
    console.error('admin/dormant: query failed', err && err.message)
    return res.status(500).json({ error: 'Query failed' })
  }
}
