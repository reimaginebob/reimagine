import { useState } from 'react'

// Per-account support view at /admin/support (2026-09-08 observability brief).
// Look up an account by email and read one timeline of what happened to it.
//
// This page shows NO Coach message or reply text, and cannot: the endpoint it
// reads (api/admin/support-timeline.js) never SELECTs those columns, so the
// exclusion is a property of the query rather than a rendering decision this
// file could get wrong. Coach appears as counts per step with ratings. See
// that file's header for why -- src/legalDocs.js line 56 permits review of
// conversation content only de-identified, and this view is keyed by identity.
//
// Lazy-loaded by src/App.jsx so it adds nothing to the bundle every real user
// downloads. The palette is inlined rather than imported from App.jsx's C for
// the same reason ErrorBoundary inlines it: this file is loaded on its own.

const C = {
  bg: '#F7F8FA',
  card: '#FFFFFF',
  border: '#E2E5EA',
  gold: '#C8924A',
  navy: '#1A2540',
  gray: '#3D4A5C',
  mute: '#718096',
  err: '#C0392B',
}

const FAILURE_LABEL = {
  generation_failed: 'Generation failed',
  coach_failed: 'Coach failed',
  client_crash: 'Browser crash',
  save_failed: 'Save failed',
}

function fmt(ts) {
  if (!ts) return '—'
  try { return new Date(ts).toLocaleString() } catch { return String(ts) }
}

function fmtDay(ts) {
  if (!ts) return '—'
  try { return new Date(ts).toLocaleDateString() } catch { return String(ts) }
}

function Row({ label, children }) {
  return (
    <div style={{ display: 'flex', gap: 12, padding: '5px 0', fontSize: 16, lineHeight: 1.5 }}>
      <div style={{ width: 160, flexShrink: 0, color: C.mute, fontWeight: 600 }}>{label}</div>
      <div style={{ color: C.navy, wordBreak: 'break-word' }}>{children}</div>
    </div>
  )
}

// Guidance gets a distinct visual treatment (CLAUDE.md section 8): gold left
// border and tint, so nobody has to read the prose to tell instruction from
// data. Same treatment as CoachingCallout in the product.
function Callout({ children }) {
  return (
    <div style={{
      background: `${C.gold}10`, borderLeft: `3px solid ${C.gold}`, padding: '14px 18px',
      borderRadius: 8, margin: '0 0 20px', fontSize: 16, color: C.gray, lineHeight: 1.6,
    }}>{children}</div>
  )
}

// One timeline entry. Failures carry a red left border so a scan finds them
// without reading a word; everything else is a quiet context line, because the
// point of the surrounding rows is to say what the person was doing when the
// red one happened.
function Entry({ e }) {
  const isFailure = e.type === 'failure'
  return (
    <div style={{
      display: 'flex', gap: 14, padding: '10px 14px', marginBottom: 6, borderRadius: 8,
      background: isFailure ? `${C.err}08` : C.card,
      border: `1px solid ${isFailure ? `${C.err}30` : C.border}`,
      borderLeft: `4px solid ${isFailure ? C.err : C.border}`,
      fontSize: 16, lineHeight: 1.55,
    }}>
      <div style={{ width: 170, flexShrink: 0, color: C.mute }}>{fmt(e.at)}</div>
      <div style={{ flex: 1, color: C.navy }}>
        {isFailure && <>
          <strong style={{ color: C.err }}>{FAILURE_LABEL[e.kind] || e.kind}</strong>
          {e.step ? ` on ${e.step}` : ''}
          {e.error_class ? ` — ${e.error_class}` : ''}
          {e.http_status ? ` (HTTP ${e.http_status})` : ''}
          {e.duration_ms ? ` after ${Math.round(e.duration_ms / 100) / 10}s` : ''}
          {e.detail && <div style={{ color: C.gray, fontSize: 15, marginTop: 3 }}>{e.detail}</div>}
          {e.build_sha && <div style={{ color: C.mute, fontSize: 15, marginTop: 3 }}>build {String(e.build_sha).slice(0, 8)}</div>}
        </>}
        {e.type === 'generation' && <><strong>Generated</strong>{e.kind ? ` ${e.kind}` : ''}{e.cost_usd ? ` — $${e.cost_usd.toFixed(4)}` : ''}</>}
        {e.type === 'coach' && <><strong>Coach turn</strong>{e.step ? ` on ${e.step}` : ''}{e.turn_kind !== 'user' ? ` (${e.turn_kind})` : ''}{e.rating === 1 ? ' — rated up' : e.rating === -1 ? ' — rated down' : ''}</>}
        {e.type === 'stage' && <><strong>Reached</strong> {e.stage}{e.source && e.source !== 'observed' ? ` (${e.source})` : ''}</>}
        {e.type === 'pursuit' && <><strong>Opportunity</strong> {e.prev_stage ? `${e.prev_stage} → ` : ''}{e.stage || e.outcome || 'updated'}{e.outcome && e.stage ? ` (${e.outcome})` : ''}</>}
        {e.type === 'session' && <><strong>Signed in</strong>{e.user_agent ? <div style={{ color: C.mute, fontSize: 15, marginTop: 3 }}>{e.user_agent}</div> : null}</>}
      </div>
    </div>
  )
}

export default function SupportView() {
  const [email, setEmail] = useState('')
  const [days, setDays] = useState(30)
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [showContext, setShowContext] = useState(true)

  const look = async (e) => {
    if (e && e.preventDefault) e.preventDefault()
    if (!email.trim()) return
    setLoading(true); setError(null); setData(null)
    try {
      const r = await fetch(`/api/admin/support-timeline?email=${encodeURIComponent(email.trim())}&days=${days}`, { credentials: 'include' })
      if (r.status === 403) { setError('This account is not on the admin allowlist.'); return }
      if (r.status === 404) { setError('No account with that email.'); return }
      if (!r.ok) { setError('Lookup failed. Check the server logs.'); return }
      setData(await r.json())
    } catch {
      setError('Could not reach the server.')
    } finally {
      setLoading(false)
    }
  }

  const a = data && data.account
  const shown = data ? (showContext ? data.timeline : data.timeline.filter(e => e.type === 'failure')) : []
  const failureCount = data ? data.timeline.filter(e => e.type === 'failure').length : 0

  const inputStyle = {
    background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: '11px 14px',
    color: C.navy, fontSize: 16, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
  }

  return (
    <div style={{
      minHeight: '100vh', background: C.bg, padding: '28px 20px', color: C.navy,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
    }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 30, fontWeight: 700, margin: '0 0 16px' }}>Support</h1>

        <Callout>
          One account&rsquo;s activity, newest first, so a support email can be answered from what actually happened
          rather than from a guess. Failures are the red rows; everything around them is the context that says what the
          person was doing at the time. Coach shows as counts and ratings only, never as anything that was said.
        </Callout>

        <form onSubmit={look} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 22 }}>
          <input
            type="email" value={email} onChange={ev => setEmail(ev.target.value)}
            placeholder="someone@example.com" aria-label="Account email"
            style={{ ...inputStyle, flex: '1 1 280px', minWidth: 0 }}
          />
          <select value={days} onChange={ev => setDays(Number(ev.target.value))} aria-label="Window" style={{ ...inputStyle, cursor: 'pointer' }}>
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
          <button type="submit" disabled={loading || !email.trim()} style={{
            background: C.gold, color: '#FFF', border: 'none', borderRadius: 8, padding: '11px 22px',
            fontSize: 16, fontWeight: 700, fontFamily: 'inherit',
            cursor: loading || !email.trim() ? 'default' : 'pointer', opacity: loading || !email.trim() ? 0.55 : 1,
          }}>{loading ? 'Looking…' : 'Look up'}</button>
        </form>

        {error && <div role="alert" style={{
          background: `${C.err}10`, border: `1px solid ${C.err}40`, borderLeft: `4px solid ${C.err}`,
          borderRadius: 8, padding: '14px 18px', fontSize: 16, color: C.navy, marginBottom: 20,
        }}>{error}</div>}

        {a && <>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderLeft: `3px solid ${C.gold}`, borderRadius: 10, padding: '20px 24px', marginBottom: 22 }}>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: 21, fontWeight: 700, marginBottom: 10 }}>
              {a.name || a.email}
            </div>
            <Row label="Email">{a.email}</Row>
            <Row label="Signed up">{fmtDay(a.created_at)}</Row>
            <Row label="Last sign-in">{fmt(a.last_login_at)}</Row>
            <Row label="On step">{a.current_step || '—'}</Row>
            <Row label="Completed">{a.done && a.done.length ? a.done.join(', ') : 'nothing yet'}</Row>
            <Row label="Last saved">{fmt(a.profile_updated_at)}</Row>
            <Row label="Playbooks">{a.playbooks}{a.playbooks_archived ? ` (${a.playbooks_archived} archived)` : ''}</Row>
            <Row label="Employment">{a.employment_status || '—'}</Row>
            <Row label="Track">{a.track || '—'}</Row>
            <Row label="Flags">{a.feature_flags && a.feature_flags.length ? a.feature_flags.join(', ') : 'none'}</Row>
            {a.suspended_at && <Row label="Paused">{fmt(a.suspended_at)}{a.suspended_reason ? ` — ${a.suspended_reason}` : ''}</Row>}
            {/* Which nights a restorable copy of this person's work exists, which
                is the first thing worth knowing when the report is "my work is
                gone". See CLAUDE.md's backup-and-recovery bullet. */}
            <Row label="Nightly backups">
              {a.snapshots && a.snapshots.length
                ? `${a.snapshots.length} available, newest ${fmtDay(a.snapshots[0])}`
                : 'none'}
            </Row>
          </div>

          {data.failureTally && data.failureTally.length > 0 && <div style={{ marginBottom: 22 }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: C.mute, margin: '0 0 10px' }}>
              Everything that has ever failed for this account
            </h2>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 16 }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: C.mute }}>
                    <th style={{ padding: '6px 12px 6px 0', fontWeight: 600 }}>What</th>
                    <th style={{ padding: '6px 12px 6px 0', fontWeight: 600 }}>Class</th>
                    <th style={{ padding: '6px 12px 6px 0', fontWeight: 600 }}>Times</th>
                    <th style={{ padding: '6px 0', fontWeight: 600 }}>Most recent</th>
                  </tr>
                </thead>
                <tbody>
                  {data.failureTally.map((f, i) => (
                    <tr key={i} style={{ borderTop: `1px solid ${C.border}` }}>
                      <td style={{ padding: '7px 12px 7px 0' }}>{FAILURE_LABEL[f.kind] || f.kind}</td>
                      <td style={{ padding: '7px 12px 7px 0', color: C.gray }}>{f.error_class || '—'}</td>
                      <td style={{ padding: '7px 12px 7px 0' }}>{f.n}</td>
                      <td style={{ padding: '7px 0', color: C.gray }}>{fmt(f.last_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>}

          {Object.keys(data.coachByStep || {}).length > 0 && <div style={{ marginBottom: 22 }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: C.mute, margin: '0 0 10px' }}>
              Coach activity by screen
            </h2>
            <div style={{ fontSize: 16, color: C.gray, marginBottom: 8, lineHeight: 1.55 }}>
              Counts only. What was said is not readable here and is not reachable from here.
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 16 }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: C.mute }}>
                    <th style={{ padding: '6px 12px 6px 0', fontWeight: 600 }}>Screen</th>
                    <th style={{ padding: '6px 12px 6px 0', fontWeight: 600 }}>Turns</th>
                    <th style={{ padding: '6px 12px 6px 0', fontWeight: 600 }}>They typed</th>
                    <th style={{ padding: '6px 0', fontWeight: 600 }}>Rated</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(data.coachByStep).map(([stepKey, b]) => (
                    <tr key={stepKey} style={{ borderTop: `1px solid ${C.border}` }}>
                      <td style={{ padding: '7px 12px 7px 0' }}>{stepKey}</td>
                      <td style={{ padding: '7px 12px 7px 0' }}>{b.turns}</td>
                      <td style={{ padding: '7px 12px 7px 0' }}>{b.userTurns}</td>
                      <td style={{ padding: '7px 0', color: C.gray }}>
                        {b.thumbsUp || b.thumbsDown ? `${b.thumbsUp} up, ${b.thumbsDown} down` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>}

          <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap', marginBottom: 10 }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: C.mute, margin: 0 }}>
              Timeline, last {data.days} days
            </h2>
            <span style={{ fontSize: 16, color: failureCount ? C.err : C.mute }}>
              {failureCount} failure{failureCount === 1 ? '' : 's'}
            </span>
            <button type="button" onClick={() => setShowContext(v => !v)} style={{
              background: 'transparent', color: C.gold, border: `1px solid ${C.gold}`, borderRadius: 8,
              padding: '6px 14px', fontSize: 16, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            }}>{showContext ? 'Failures only' : 'Show everything'}</button>
          </div>

          {shown.length === 0
            ? <div style={{ fontSize: 16, color: C.gray, padding: '14px 0' }}>
                Nothing recorded in this window. Note that the trail only starts from when it shipped, so an older
                problem may simply predate it.
              </div>
            : shown.map((e, i) => <Entry key={i} e={e} />)}
        </>}
      </div>
    </div>
  )
}
