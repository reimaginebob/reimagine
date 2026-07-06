// Server-side mirror of src/config/legal.js. The frontend bundle and the
// serverless runtime do not share a module, so these constants are duplicated
// intentionally. Keep them in sync with src/config/legal.js when versions are
// bumped. Used by api/account/reaccept.js to write the authoritative latest
// material version on re-acceptance.

export const PRIVACY_VERSION = '2026-06-24'
export const TOS_VERSION = '2026-05-15'
export const PRIVACY_VERSION_MATERIAL = '2026-06-24'
export const TOS_VERSION_MATERIAL = '2026-05-15'
