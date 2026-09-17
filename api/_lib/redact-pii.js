// Redaction for the coach-insights content-review page (api/admin/coach-
// insights.js). The privacy policy (src/legalDocs.js) promises reviewers see
// "de-identified records: your name, email address, and account identifiers
// are removed before the content is reviewed." Before this file existed, the
// endpoint omitted user_id and email from the response but returned message/
// reply/rating_comment raw -- a 2026-09-11 read of the live page found full
// names, a phone number, and an email address inside drafted email replies
// and thank-you notes. This is a best-effort text scrub, not a guarantee:
// a name Coach invented, or a detail the user typed that exists nowhere in
// their own records, will still show. Callers must not label the result
// "anonymous" -- "de-identified" (the policy's own word) is the honest claim.
//
// Pure and side-effect-free so it is unit-testable without a DB.

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g

// Common US/international shapes: optional leading +country code, optional
// parens around the area code, '.'/'-'/space separators. Deliberately does
// not try to catch every international format -- this only has to cover the
// shapes a US-based product's users actually type in a signature block.
const PHONE_RE = /(?:\+\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g

const LINKEDIN_RE = /https?:\/\/(?:[a-z]{2,3}\.)?linkedin\.com\/in\/[A-Za-z0-9\-_%]+\/?/gi

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Full name first (so "Julie Johnson" redacts as one unit), then each part
// with 3+ characters on its own (so "Julie" and "Johnson" alone still catch
// a reply that only uses a first name). Sorted longest-first so a full name
// is consumed before its own parts would otherwise double-match the
// leftover fragments. A part or a whole single-token name under 3 characters
// is skipped -- too likely to be a common short word, not a name.
function buildNameVariants(names) {
  const variants = new Set()
  for (const raw of Array.isArray(names) ? names : []) {
    if (typeof raw !== 'string') continue
    const full = raw.trim()
    if (!full) continue
    if (full.length >= 3) variants.add(full)
    for (const part of full.split(/\s+/).filter(Boolean)) {
      if (part.length >= 3) variants.add(part)
    }
  }
  return Array.from(variants).sort((a, b) => b.length - a.length)
}

// Whole-word, case-insensitive, with an optional possessive ('s or 's)
// consumed right after so "Lindsey's" redacts cleanly to "[name]" rather
// than "[name]'s".
function nameRegex(variant) {
  return new RegExp(`\\b${escapeRegex(variant)}\\b(?:['’]s)?`, 'gi')
}

export function redactPII(text, { names = [], emails = [] } = {}) {
  if (typeof text !== 'string' || !text) return text
  let out = text

  out = out.replace(EMAIL_RE, '[email]')
  // Defensive pass for an explicitly supplied address the regex above might
  // not catch as written (unusual spacing, a trailing character the regex
  // does not anticipate).
  for (const email of Array.isArray(emails) ? emails : []) {
    if (typeof email === 'string' && email.trim()) out = out.split(email).join('[email]')
  }

  out = out.replace(PHONE_RE, '[phone]')
  out = out.replace(LINKEDIN_RE, '[linkedin]')

  for (const variant of buildNameVariants(names)) {
    out = out.replace(nameRegex(variant), '[name]')
  }

  return out
}
