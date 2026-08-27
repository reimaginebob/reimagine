// Which product track an account is on. One canonical list, read by the app
// (src/App.jsx) and validated against by the API (api/auth/request-link.js and
// api/admin/track-access.js), so a code cannot drift between what a URL carries
// and what the server will store.
//
// Cross-boundary import rule (CLAUDE.md section 8): this is a `.js` file under
// src/ imported by api/ with the .js extension -- the same shape as
// src/signup-sources.js, which api/auth/request-link.js already imports. Never
// rename it to .mjs.
//
// NULL / absent is the standard product: a career strategy tool for someone
// pursuing a role. That is deliberately NOT a code here. Naming the default
// would invite writing it onto rows, and then "which accounts are standard"
// becomes a question about two values (NULL and 'standard') instead of one.
//
// Codes are permanent once they ship -- they are stored on user rows. To retire
// one, stop offering it and leave the entry here so old rows still resolve.

export const TRACKS = [
  {
    code: 'independent',
    // The URL that opens this track: /?track=independent
    label: 'Go Independent',
    // What the person is here to do. Used in admin surfaces, not user-facing copy.
    blurb: 'Building a consulting or fractional-executive practice.',
  },
]

export const TRACK_CODES = TRACKS.map(t => t.code)

export const TRACK_LABELS = TRACKS.reduce((m, t) => {
  m[t.code] = t.label
  return m
}, {})

// The URL parameter that carries a track at the front door.
export const TRACK_PARAM = 'track'

export function isTrack(code) {
  return typeof code === 'string' && TRACK_CODES.includes(code)
}

// The one track with product behavior today. Everything track-conditional in
// src/App.jsx reads this rather than the string literal, so a second track
// cannot silently inherit the first one's screens.
export const TRACK_INDEPENDENT = 'independent'
