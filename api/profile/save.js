import { sql } from '../_lib/db.js'
import { requireAuth } from '../_lib/session.js'
import { stripNul } from '../_lib/strip-nul.js'

// Validates the client's claimed profile_updated_at (finding #2.5). Absent
// or unparsable is deliberately treated the same as "no precondition" --
// see the call site's own comment -- rather than rejected outright, so an
// older cached client bundle (which never sends this field) keeps saving
// exactly as it always did.
export function parseIncomingUpdatedAt(raw) {
  return typeof raw === 'string' && raw && !Number.isNaN(Date.parse(raw)) ? raw : null
}

async function handler(req, res) {
  if (req.method !== 'PUT' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  const rawBody = req.body
  if (!rawBody || typeof rawBody !== 'object') {
    return res.status(400).json({ error: 'Invalid profile' })
  }

  // profile_updated_at (finding #2.5, 2026-09-08 prelaunch audit): the
  // client's own last-known server timestamp, sent so a device carrying a
  // stale copy (a slow load racing a fast one, or two tabs/devices editing
  // at once) cannot blindly overwrite work saved elsewhere since. Transport
  // metadata, not part of the stored shape -- pulled out before the rest
  // becomes profile_state. Absent or unparsable is treated as "no
  // precondition" (an older client bundle, or a genuinely first save),
  // matching how a caller with nothing to compare against always did before.
  const { profile_updated_at: rawIncomingUpdatedAt, ...rawProfile } = rawBody
  const incomingUpdatedAt = parseIncomingUpdatedAt(rawIncomingUpdatedAt)

  const profile = stripNul(rawProfile)

  const serialized = JSON.stringify(profile)
  // Ceiling raised 1 MB -> 3 MB on 2026-08-28. The old limit was reached by a
  // real account (1,049,069 bytes — 493 over), and because the client dropped
  // the 413 on the floor, every save it made for six days failed in silence.
  // The client now shows a save-failure notice, so crossing this is visible;
  // 3 MB keeps the request under Vercel's 4.5 MB body limit with room to spare.
  // This is headroom, not a fix for unbounded growth: profile_state is written
  // whole on every autosave, so a genuinely large blob is a cost problem
  // before it is a correctness one. savedPlaybooks itself no longer lives in
  // this column at all (Phase 3 of that migration, plus the merge shim this
  // file used to carry for it, retired in finding #2.7) -- outputs is the
  // remaining growth driver; splitting it out per Section 7.2 of the
  // 2026-09-08 prelaunch audit is the real fix for that.
  const MAX_PROFILE_BYTES = 3 * 1024 * 1024
  if (serialized.length > MAX_PROFILE_BYTES) {
    console.error('profile/save rejected: over size ceiling', {
      userId: req.user?.id,
      bodyBytes: serialized.length,
      ceiling: MAX_PROFILE_BYTES,
    })
    return res.status(413).json({ error: 'Profile too large', bytes: serialized.length, ceiling: MAX_PROFILE_BYTES })
  }

  // Staleness precondition (finding #2.5): the UPDATE itself carries the
  // guard, atomically, rather than a separate read-then-write -- a stored
  // profile_updated_at of NULL (never saved before) or no incoming timestamp
  // (older client, first save) both mean "nothing to compare against, allow
  // it"; otherwise the incoming save must be at least as new as what is
  // already stored. RETURNING is empty exactly when the precondition failed
  // (req.user.id is already known to exist -- requireAuth confirmed the
  // session against it), so a zero-row result is read as "stale, rejected"
  // rather than probed further.
  //
  // Both sides truncated to milliseconds (same-day fix, live QA pass): the
  // neon serverless driver parses timestamptz into a JS Date, which only
  // holds millisecond precision, so the value a client ever echoes back as
  // its "last known" profile_updated_at has already lost whatever
  // microsecond remainder NOW() wrote. Comparing that against the
  // full-precision stored value made this reject almost every save --
  // stored's nonzero microseconds made it compare greater than the
  // client's necessarily-rounded copy, even with nothing else touching the
  // row. Truncating both sides to the precision a client can actually
  // round-trip keeps the guard (still rejects a genuinely older client)
  // without rejecting a client for a precision it was never given.
  let rows
  try {
    rows = await sql`
      UPDATE users
      SET profile_state = ${profile}::jsonb, profile_updated_at = NOW()
      WHERE id = ${req.user.id}
        AND (profile_updated_at IS NULL OR ${incomingUpdatedAt}::timestamptz IS NULL OR date_trunc('milliseconds', profile_updated_at) <= date_trunc('milliseconds', ${incomingUpdatedAt}::timestamptz))
      RETURNING profile_updated_at
    `
  } catch (err) {
    console.error('profile/save failed', {
      userId: req.user?.id,
      requestId: req.headers['x-vercel-id'] || null,
      pgCode: err?.code || null,
      pgDetail: err?.detail || null,
      bodyBytes: serialized.length,
      message: err?.message || String(err),
    })
    return res.status(500).json({ error: 'Save failed' })
  }

  if (rows.length === 0) {
    return res.status(409).json({ error: 'stale', message: 'Newer changes already exist on the server' })
  }

  // Corrections replaced the "Reimagine Corrections Log" Google Sheet (dead
  // since 2026-08-20 -- an Apps Script deployment drifted from the URL baked
  // into the client, silently, and the fire-and-forget client POST had no way
  // to notice). profile.corrections already lands here on every accepted
  // autosave, so capture becomes a byproduct of this already-proven path
  // instead of a second, independently-fragile one: upsert every entry
  // present, id is the client-generated natural key, ON CONFLICT DO NOTHING
  // makes re-sends of the same array a no-op. Best-effort -- a failure here
  // must never fail the profile save the user is waiting on.
  if (Array.isArray(profile.corrections) && profile.corrections.length) {
    const userName = [req.user.first_name, req.user.last_name].filter(Boolean).join(' ').trim() || null
    try {
      for (const c of profile.corrections) {
        if (!c || !c.id) continue
        await sql`
          INSERT INTO corrections (
            id, user_id, user_email, user_name, step, step_display_name,
            section_output_length, correction_text, app_version, browser, created_at
          ) VALUES (
            ${c.id}, ${req.user.id}, ${req.user.email || null}, ${userName},
            ${c.step || null}, ${c.stepDisplayName || null}, ${c.sectionOutputLength ?? null},
            ${c.text || c.correctionText || ''}, ${c.appVersion || null}, ${c.browser || null},
            ${c.created_at || null}
          )
          ON CONFLICT (id) DO NOTHING
        `
      }
    } catch (err) {
      console.error('profile/save corrections-capture failed (non-blocking)', {
        userId: req.user?.id,
        message: err?.message || String(err),
      })
    }
  }

  return res.status(200).json({ ok: true, updatedAt: rows[0].profile_updated_at })
}

export default requireAuth(handler)
