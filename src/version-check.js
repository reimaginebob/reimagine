// src/version-check.js
// Stale-build self-healing runtime hook (Foundation, 2026-05-26). Polls
// `/version.json` and flips `updateAvailable` when the deployed SHA no
// longer matches the bundled BUILD_SHA. The hook does NOT auto-reload;
// the calling component renders a banner with a manual Reload button.
// Auto-reload would interrupt up-to-9-minute Anthropic generation chains
// and destroy unsaved textarea input. The trade is: slower self-healing,
// no destroyed work. The user reloads when convenient.
//
// Triggers:
//   - mount (immediate, once)
//   - visibilitychange when the tab returns to visible
//   - setInterval every 30 minutes for long-lived tabs
//
// Loop guard: sessionStorage `reimagine.lastReloadAt` records the
// timestamp of the most recent manual Reload. If a value exists within
// the past 60 seconds on mount, the hook returns disabled state and
// skips polling for the rest of this tab session. Prevents a broken
// /version.json or a crashing new build from looping a user. session
// (not local) storage so incognito users get the same guard and a
// closed tab clears the lock cleanly.
//
// Fail-closed: a /version.json fetch that 404s, 500s, parses badly, or
// network-errors NEVER sets updateAvailable=true. Errors are recorded
// silently for the ?debug=1 footer and otherwise ignored.

import { useEffect, useRef, useState, useCallback } from 'react'
import { BUILD_SHA } from './build-meta.js'

const LOOP_GUARD_KEY = 'reimagine.lastReloadAt'
const LOOP_GUARD_WINDOW_MS = 60 * 1000
const POLL_INTERVAL_MS = 30 * 60 * 1000
const VERSION_URL = '/version.json'

function readLoopGuard() {
  try {
    const raw = sessionStorage.getItem(LOOP_GUARD_KEY)
    if (!raw) return null
    const ts = Number(raw)
    if (!Number.isFinite(ts)) return null
    return ts
  } catch { return null }
}

function writeLoopGuard(ts) {
  try { sessionStorage.setItem(LOOP_GUARD_KEY, String(ts)) } catch {}
}

export function useVersionCheck() {
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [liveSha, setLiveSha] = useState(null) // most recent SHA seen from /version.json (null until first success)
  const [lastCheckAt, setLastCheckAt] = useState(null) // ISO timestamp of last successful fetch
  const [lastCheckStatus, setLastCheckStatus] = useState('unknown') // 'unknown' | 'current' | 'update-available' | 'check-failed'
  // Loop-guard latch: computed once at mount. When true, all polling is
  // suppressed for the lifetime of this tab session. Ref rather than
  // state because flipping it must not trigger a re-render.
  const disabledRef = useRef(false)
  // Set the latch synchronously so the first check() call in mount-effect
  // honors it. useState initializer runs once per component instance.
  const [disabled] = useState(() => {
    const last = readLoopGuard()
    if (last && Date.now() - last < LOOP_GUARD_WINDOW_MS) {
      disabledRef.current = true
      return true
    }
    return false
  })

  const check = useCallback(async () => {
    if (disabledRef.current) return
    let res
    try {
      res = await fetch(VERSION_URL, { cache: 'no-store', credentials: 'omit' })
    } catch {
      setLastCheckStatus('check-failed')
      return
    }
    if (!res || !res.ok) {
      setLastCheckStatus('check-failed')
      return
    }
    let body
    try { body = await res.json() } catch {
      setLastCheckStatus('check-failed')
      return
    }
    const sha = body && typeof body.sha === 'string' ? body.sha : null
    if (!sha) {
      setLastCheckStatus('check-failed')
      return
    }
    setLiveSha(sha)
    setLastCheckAt(new Date().toISOString())
    if (sha === BUILD_SHA) {
      setLastCheckStatus('current')
      // Note: do NOT clear updateAvailable here. If a previous check
      // detected an update and the user has not yet reloaded, an
      // intermediate /version.json hit (network blip, deploy revert)
      // should not retract the banner. Only a fresh page load clears it.
    } else {
      setLastCheckStatus('update-available')
      setUpdateAvailable(true)
    }
  }, [])

  useEffect(() => {
    if (disabled) return
    let cancelled = false
    const safeCheck = () => { if (!cancelled) check() }
    safeCheck()
    const onVisibility = () => { if (document.visibilityState === 'visible') safeCheck() }
    document.addEventListener('visibilitychange', onVisibility)
    const intervalId = setInterval(safeCheck, POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisibility)
      clearInterval(intervalId)
    }
  }, [disabled, check])

  const reload = useCallback(() => {
    writeLoopGuard(Date.now())
    try { window.location.reload() } catch {}
  }, [])

  return {
    updateAvailable,
    reload,
    // Diagnostic surface for the ?debug=1 footer. Caller renders these
    // directly; the hook does not format them.
    buildSha: BUILD_SHA,
    liveSha,
    lastCheckAt,
    lastCheckStatus,
    disabled,
  }
}
