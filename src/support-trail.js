// A local mirror of the failures this browser has observed (2026-09-08
// observability brief, part C).
//
// The server's support_events table is the real record. This is a small ring
// buffer of the same facts kept on the device, for one purpose: so the
// "Send to Career Club" box can SHOW the person what it is about to send. A
// payload the user is asked to approve has to be assembled client-side --
// reading their own server rows back to them would need an endpoint that hands
// an account its own log, which is a bigger surface than this needs.
//
// Same discipline as the server table, for the same reason: these entries can
// end up in an upload, so they carry an error class and a screen and nothing
// else. No message text, no field values, no generated output. The caps are
// small on purpose.
//
// Deliberately dependency-free (no React, no App.jsx) so src/ErrorBoundary.jsx
// can use it -- that file must keep working when App.jsx is the module that
// crashed. Every localStorage access is wrapped: private-mode browsers throw on
// read and write, and a diagnostics helper that can itself throw is worse than
// one that quietly remembers nothing.

const KEY = 'reimagine_support_trail'
export const MAX_TRAIL = 20

const LIMITS = { kind: 40, step: 60, error_class: 40, detail: 200 }

function clamp(value, limit) {
  if (value === null || value === undefined) return undefined
  const s = String(value).replace(/\s+/g, ' ').trim()
  return s ? s.slice(0, limit) : undefined
}

export function readTrail() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.slice(0, MAX_TRAIL) : []
  } catch {
    return []
  }
}

// Newest first, capped at MAX_TRAIL. Called alongside -- never instead of --
// the POST to api/support/client-event.js: the server row is the record, this
// is only what lets the user read the payload before approving it.
export function recordLocalFailure(entry) {
  try {
    const e = {
      kind: clamp(entry && entry.kind, LIMITS.kind),
      step: clamp(entry && entry.step, LIMITS.step),
      error_class: clamp(entry && entry.error_class, LIMITS.error_class),
      detail: clamp(entry && entry.detail, LIMITS.detail),
      at: new Date().toISOString(),
    }
    for (const k of Object.keys(e)) if (e[k] === undefined) delete e[k]
    const next = [e, ...readTrail()].slice(0, MAX_TRAIL)
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* a browser that will not store this is not a reason to fail anything */
  }
}

export function clearTrail() {
  try { localStorage.removeItem(KEY) } catch {}
}

// The exact object the Send box renders and posts. One function so the thing
// shown and the thing sent cannot drift: there is no second code path that
// could add a field the preview never displayed.
//
// url_path, not the full href -- a query string is somewhere state can hide,
// and the server's allowlist would drop it anyway.
export function buildDiagnosticsPayload({ crash = null, step = '', buildSha = '' } = {}) {
  const payload = {}
  if (crash && crash.message) payload.message = String(crash.message).slice(0, 400)
  if (crash && crash.componentStack) payload.component_stack = String(crash.componentStack).slice(0, 2000)
  payload.step = String((crash && crash.step) || step || '').slice(0, 60) || undefined
  payload.build_sha = String((crash && crash.build) || buildSha || '').slice(0, 64) || undefined
  try { payload.user_agent = String(navigator.userAgent || '').slice(0, 300) } catch { /* no navigator */ }
  try { payload.url_path = String(location.pathname || '').slice(0, 200) } catch { /* no location */ }
  payload.iso = new Date().toISOString()
  const trail = readTrail()
  if (trail.length) payload.trail = trail
  for (const k of Object.keys(payload)) if (payload[k] === undefined) delete payload[k]
  return payload
}
