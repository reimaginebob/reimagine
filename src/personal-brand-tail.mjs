// src/personal-brand-tail.mjs
// Foundation A (2026-05-25): p3 Personal Brand structured-emit helpers.
// Extracted into its own ESM module so the unit tests in scripts/test-
// personal-brand-tail.mjs can import them without pulling in the whole
// React app. App.jsx imports the same exports for the runtime path.
//
// The p3 prompt instructs the model to append a JSON tail after the prose
// synthesis (and after any LinkedIn profile interpolation); Foundation B
// downstream modules will consume the structured fields. The tail-finding
// strategy is end-of-output, NOT first-brace-to-last-brace: the prose
// region above the tail can contain stray braces (worked-example snippets,
// quoted JSON in instructions, etc.). parseResumeJSON's strategy in
// App.jsx is unsafe for this output shape.

export const PB_DIMENSION_KEYS = ['function', 'industry', 'position', 'scale', 'pace', 'mission']
export const PB_STATUS_ENUM = ['aligned', 'one-off', 'multi-off', 'thin']
export const PB_ANCHOR_TYPE_ENUM = ['accomplishment', 'reputation', 'life-shaping']

// Returns the character offset where the JSON tail begins (the fence opener
// or the bare-brace opener), or -1 if no tail is detectable. Used by
// parsePersonalBrandTail to slice the candidate JSON and by the voice gate's
// dimensional-regression check to scope its scan to the pre-tail prose
// region (the structured emit's bolded `**function**`-style keys would
// otherwise read as the dedicated-paragraph regression shape).
export function findPersonalBrandTailBoundary(raw) {
  if (!raw || typeof raw !== 'string') return -1
  // Prefer the LAST ```json fence opener (case-insensitive). The model is
  // instructed to fence the tail; fenced shape is the canonical happy path.
  const fenceRe = /```json\b/gi
  let lastFence = -1
  let m
  while ((m = fenceRe.exec(raw)) !== null) lastFence = m.index
  if (lastFence !== -1) return lastFence
  // Fall back: the model dropped the fence. Look for a bare-brace opener
  // near end-of-output. Anchored on `\n\n{`, the same blank-line separator
  // the prose-to-tail boundary uses. Take the LAST such opener whose
  // matching `}` lands within 50 chars of end-of-output (allowing for
  // trailing whitespace).
  const bareRe = /\n\n\{/g
  let lastBare = -1
  while ((m = bareRe.exec(raw)) !== null) {
    const openerIdx = m.index + 2
    const closeIdx = findMatchingCloseBrace(raw, openerIdx)
    if (closeIdx !== -1 && closeIdx >= raw.length - 50) lastBare = openerIdx
  }
  return lastBare
}

// Brace-aware matcher for the bare-brace fallback. Honors double-quoted
// strings and their escapes (JSON has no single-quoted strings or template
// literals).
export function findMatchingCloseBrace(s, openIdx) {
  if (s[openIdx] !== '{') return -1
  let depth = 0
  let mode = 'code'
  for (let i = openIdx; i < s.length; i++) {
    const c = s[i]
    if (mode === 'dq') { if (c === '\\') { i++; continue } if (c === '"') mode = 'code'; continue }
    if (c === '"') { mode = 'dq'; continue }
    if (c === '{') depth++
    else if (c === '}') { depth--; if (depth === 0) return i }
  }
  return -1
}

// parsePersonalBrandTail returns one of three shapes:
//   { found: false }                                -- no candidate detected.
//   { found: true, parseFailed: true }              -- candidate found but JSON.parse failed.
//   { found: true, parsed: <object> }               -- candidate found and parsed (schema not yet checked).
export function parsePersonalBrandTail(raw) {
  if (!raw || typeof raw !== 'string') return { found: false }
  const boundary = findPersonalBrandTailBoundary(raw)
  if (boundary === -1) return { found: false }
  const tail = raw.slice(boundary)
  let candidate = null
  const fenceMatch = tail.match(/^```json\s*\n?([\s\S]*?)```/i)
  if (fenceMatch) {
    candidate = fenceMatch[1].trim()
  } else if (tail.startsWith('{')) {
    const closeIdx = findMatchingCloseBrace(tail, 0)
    if (closeIdx === -1) return { found: true, parseFailed: true }
    candidate = tail.slice(0, closeIdx + 1)
  } else {
    return { found: false }
  }
  if (!candidate) return { found: true, parseFailed: true }
  let obj
  try { obj = JSON.parse(candidate) } catch { return { found: true, parseFailed: true } }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return { found: true, parseFailed: true }
  return { found: true, parsed: obj }
}

// validatePersonalBrandTailSchema returns granular errors so telemetry can
// distinguish "missing scale dimension" from "topAnchors has 3 entries
// (expected 6 to 8)." Caller (the voice gate's Phase 3) feeds errors[] into
// the logVoiceEvent payload when schema is invalid.
export function validatePersonalBrandTailSchema(obj) {
  const errors = []
  if (!obj || typeof obj !== 'object') { errors.push('root: not an object'); return { valid: false, errors } }
  if (typeof obj.throughLine !== 'string' || !obj.throughLine.trim()) errors.push('throughLine: missing or empty')
  if (!obj.dimensionalFit || typeof obj.dimensionalFit !== 'object') {
    errors.push('dimensionalFit: missing or not an object')
  } else {
    for (const k of PB_DIMENSION_KEYS) {
      const d = obj.dimensionalFit[k]
      if (!d || typeof d !== 'object') { errors.push(`dimensionalFit.${k}: missing`); continue }
      if (!PB_STATUS_ENUM.includes(d.status)) errors.push(`dimensionalFit.${k}.status: invalid (${JSON.stringify(d.status)})`)
      if (typeof d.read !== 'string' || !d.read.trim()) errors.push(`dimensionalFit.${k}.read: missing or empty`)
    }
  }
  if (!Array.isArray(obj.topAnchors)) {
    errors.push('topAnchors: missing or not an array')
  } else {
    if (obj.topAnchors.length < 6 || obj.topAnchors.length > 8) errors.push(`topAnchors: ${obj.topAnchors.length} entries (expected 6 to 8)`)
    obj.topAnchors.forEach((a, i) => {
      if (!a || typeof a !== 'object') { errors.push(`topAnchors[${i}]: not an object`); return }
      if (!PB_ANCHOR_TYPE_ENUM.includes(a.type)) errors.push(`topAnchors[${i}].type: invalid (${JSON.stringify(a.type)})`)
      if (typeof a.text !== 'string' || !a.text.trim()) errors.push(`topAnchors[${i}].text: missing or empty`)
    })
  }
  return { valid: errors.length === 0, errors }
}

// First-sentence extractor for the lead-drift comparator. Scans from the
// start of the pre-tail prose region up to the first `.`, `!`, or `?`
// followed by whitespace, newline, or end-of-string. Trims leading
// whitespace. Callers should pass everything BEFORE the JSON tail boundary;
// the comparator uses exact-equality against the parsed throughLine value.
export function extractLeadSentence(prose) {
  if (!prose || typeof prose !== 'string') return ''
  const s = prose.replace(/^\s+/, '')
  const m = s.match(/^[\s\S]*?[.!?](?=\s|$)/)
  return m ? m[0].trim() : s.trim()
}

// Render-time strip: returns the prose region only, removing the JSON tail
// the p3 prompt asks the model to append. Foundation A specified "UI
// displays prose only," but outputs.p3 was left holding the full string
// including the tail, so the fenced JSON block leaked into the user's
// rendered Personal Brand. This helper closes that gap at every render
// site (Personal Brand step display, MD pass-through, saved playbooks
// view, PDF print, chat helper context, correction-context submission).
// Storage and serialization paths (pe_v4 localStorage, /api/profile/save,
// exportProfile JSON) keep the raw string with the tail so Foundation B
// downstream consumers can still parse it. The strip is render-time only.
//
// Behavior:
// - Uses the same tail-finding strategy as parsePersonalBrandTail so the
//   boundary is identical (last ```json fence opener, or the bare-brace
//   end-of-output fallback).
// - No tail found: returns the input unchanged (preserves any whitespace
//   the caller might rely on; this is the legacy / pre-Foundation-A case).
// - Tail found: returns text.slice(0, boundary) with trailing whitespace
//   trimmed so the rendered prose does not end with a chunk of blank
//   space where the JSON used to be.
// - Non-string or empty input: returns the input unchanged.
export function stripPersonalBrandTail(text) {
  if (!text || typeof text !== 'string') return text
  const boundary = findPersonalBrandTailBoundary(text)
  if (boundary === -1) return text
  return text.slice(0, boundary).trimEnd()
}
