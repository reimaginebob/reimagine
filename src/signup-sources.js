// Where new accounts say they heard about Reimagine. One canonical list, read
// by the signup form (src/App.jsx) and validated against by the API
// (api/auth/request-link.js), so a code cannot drift between what a user picks
// and what the server will store.
//
// Cross-boundary import rule (CLAUDE.md section 8): this is a `.js` file under
// src/ imported by api/ with the .js extension — the same shape as
// src/feedback-taxonomy.js, which api/admin/feedback-dashboard.js already
// imports. Never rename it to .mjs.
//
// The codes are deliberately coarse. The question is optional and sits on a
// signup form, so it earns one glance and no more; a longer list would trade
// answer rate for detail that nobody acts on. The split that matters is
// word-of-mouth versus everything else, which is why "someone recommended it"
// is its own code and is first.
//
// Codes are permanent once they ship — they are stored on user rows. To retire
// one, stop offering it in ACTIVE_SIGNUP_SOURCES and leave the entry here so
// old rows still resolve to a label.

export const SIGNUP_SOURCES = [
  { code: 'referral',   label: 'Someone I know recommended it', detailPrompt: 'Who, if you would like to say? (optional)' },
  { code: 'bob',        label: 'Bob Goodwin or Career Club' },
  { code: 'linkedin',   label: 'LinkedIn' },
  { code: 'media',      label: 'A newsletter, podcast, or article', detailPrompt: 'Which one? (optional)' },
  { code: 'search',     label: 'A web search' },
  { code: 'event',      label: 'An event or workshop', detailPrompt: 'Which one? (optional)' },
  { code: 'other',      label: 'Something else',                detailPrompt: 'Where did you come across it? (optional)' },
]

// Codes currently offered on the form. Same as the full list today; the two are
// separate so a code can be retired without orphaning the rows that hold it.
export const ACTIVE_SIGNUP_SOURCES = SIGNUP_SOURCES

export const SIGNUP_SOURCE_CODES = SIGNUP_SOURCES.map(s => s.code)

export const SIGNUP_SOURCE_LABELS = SIGNUP_SOURCES.reduce((m, s) => {
  m[s.code] = s.label
  return m
}, {})

// The detail box only appears for codes that ask a follow-up. Everything else
// is self-explanatory and a second empty field would just add friction.
export function detailPromptFor(code) {
  const found = SIGNUP_SOURCES.find(s => s.code === code)
  return (found && found.detailPrompt) || null
}

export function isSignupSource(code) {
  return typeof code === 'string' && SIGNUP_SOURCE_CODES.includes(code)
}
