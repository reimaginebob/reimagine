// Provider-normalised email address, for deciding whether two addresses reach
// the same person.
//
// Extracted so the duplicate-account detection (api/admin/dormant.js) and the
// Corner cross-reference (api/admin/corner-segment.js) cannot drift apart. Two
// places disagreeing about whether b.ob@gmail.com and bob@gmail.com are the same
// inbox is how somebody ends up on a list they should have been excluded from.
//
// Everywhere: case-folded, and anything after a '+' in the local part dropped —
// a tag, not a different mailbox.
// Gmail only: dots in the local part removed, because Gmail ignores them, and
// googlemail.com folded into gmail.com because it is the same service.
//
// Deliberately conservative. Other providers vary in how they treat dots and
// tags, and treating two genuinely different people as one person is the more
// expensive mistake here: on the Corner list it would silently drop somebody
// from a campaign they should have received.

export function normalizeEmail(raw) {
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
