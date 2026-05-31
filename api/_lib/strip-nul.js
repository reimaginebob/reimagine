// Strip U+0000 (NUL) from every string leaf in an arbitrary JSON-shape value.
// Postgres jsonb rejects NUL in text with SQLSTATE 22P05; this clears it
// before the value reaches the driver. Returns a new value; does not mutate.

const NUL_RE = /\x00/g

export function stripNul(value) {
  if (typeof value === 'string') {
    return value.indexOf('\x00') === -1 ? value : value.replace(NUL_RE, '')
  }
  if (Array.isArray(value)) {
    return value.map(stripNul)
  }
  if (value && typeof value === 'object') {
    const out = {}
    for (const k of Object.keys(value)) {
      out[k] = stripNul(value[k])
    }
    return out
  }
  return value
}
