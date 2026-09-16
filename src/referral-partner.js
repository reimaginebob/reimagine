// Which partner organization's link brought a new account here. Carried the
// same way track and signup_source are: the URL that redistributes a
// partner's flyer, newsletter blurb, or LinkedIn post carries ?via=<tag>, the
// signup form posts it to api/auth/request-link.js, which parks it on the
// magic_link_tokens row, and api/auth/verify.js copies it onto the users row
// when the account is created. It rides the token because the token is the
// only thing that survives the round trip through the user's inbox -- the
// click that actually creates the account comes from an email client, on a
// URL that no longer carries the parameter.
//
// Cross-boundary import rule (CLAUDE.md section 8): this is a `.js` file
// under src/ imported by api/ with the .js extension -- the same shape as
// src/tracks.js and src/signup-sources.js. Never rename it to .mjs.
//
// Format-validated, not list-validated (unlike track and signup_source):
// partners are added weekly outside the codebase, in Bob's own partner
// tracker spreadsheet, so a canonical list here would mean a PR per partner.
// A tag that doesn't fit the format is dropped silently, never rejected --
// the same "a mistyped link must never fail a sign-in" principle signup_source
// and track already apply.
//
// First touch, not live-URL-only (unlike track, which is read live from the
// URL on every render): a flyer or newsletter click and the actual signup
// often don't happen in the same sitting, so the tag is captured into
// localStorage on first sight and carried until it's used on a new-account
// signup or ages out. See VIA_MAX_AGE_DAYS.

// The URL parameter that carries a partner tag at the front door.
export const VIA_PARAM = 'via'

// Where the first-touch tag is held in localStorage until signup.
export const VIA_STORAGE_KEY = 'pe_via'

// How long a first-touch tag stays valid. Long enough to cover someone who
// reads a newsletter now and signs up next week; short enough that a stale
// browser doesn't keep crediting a partner for an unrelated later signup.
export const VIA_MAX_AGE_DAYS = 30

const VIA_FORMAT = /^[a-z0-9][a-z0-9-]{1,39}$/

// True only for a value already in the exact stored form (lowercase, trimmed,
// format-matching) -- mirrors isTrack/isSignupSource, which check membership
// without re-deriving anything. Use normalizeVia() for anything that hasn't
// already been through it.
export function isVia(code) {
  return typeof code === 'string' && VIA_FORMAT.test(code)
}

// Trims and lowercases before checking format, so "PwC-Alumni " and
// "pwc-alumni" land on the same tag. Returns null for anything that doesn't
// fit -- callers drop it silently rather than surfacing an error.
export function normalizeVia(raw) {
  if (typeof raw !== 'string') return null
  const v = raw.trim().toLowerCase()
  return isVia(v) ? v : null
}
