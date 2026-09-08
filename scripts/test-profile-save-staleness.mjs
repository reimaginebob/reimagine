// Guards finding #2.5 from the 2026-09-08 prelaunch audit: a failed
// /api/profile/load unlocked the autosave PUT just as readily as a
// successful one (App.jsx's serverLoadDone settles on both), and
// api/profile/save.js replaced the profile_state column with no
// updatedAt precondition -- a laptop with weeks-old local state, signing
// in during a Neon hiccup, could silently overwrite newer work saved on
// another device or tab.
//
// BEHAVIORAL for parseIncomingUpdatedAt (api/profile/save.js), the one
// piece of this fix that is a pure function reachable without a live DB.
// The staleness precondition itself lives in a single atomic SQL UPDATE
// (api/profile/save.js) and cannot be exercised without a live Postgres
// connection -- same constraint as the Coach turn-cap query in PR3 -- so it
// is guarded here by source-presence checks against the exact WHERE clause
// and response codes, plus the client-side wiring that sends the field and
// reacts to a 409. The client-side load-success gate (serverLoadOk) is
// exercised by the race-replay simulation in test-autosave-gate.mjs, which
// this file does not duplicate.
import fs from 'node:fs'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

process.env.DATABASE_URL ||= 'postgres://user:pass@localhost/dummy'

const { parseIncomingUpdatedAt } = await import('../api/profile/save.js')

// --- parseIncomingUpdatedAt --------------------------------------------------

const validIso = '2026-09-08T10:00:00.000Z'
check(parseIncomingUpdatedAt(validIso) === validIso, 'a valid ISO timestamp was not passed through unchanged')
check(parseIncomingUpdatedAt(null) === null, 'null was not treated as "no precondition"')
check(parseIncomingUpdatedAt(undefined) === null, 'undefined was not treated as "no precondition"')
check(parseIncomingUpdatedAt('') === null, 'an empty string was not treated as "no precondition"')
check(parseIncomingUpdatedAt('not a date') === null, 'a garbage string reached the SQL layer instead of being rejected as "no precondition"')
check(parseIncomingUpdatedAt(1757321234000) === null, 'a raw number (not the expected ISO-string shape) was not rejected')
check(parseIncomingUpdatedAt({}) === null, 'a non-string object was not rejected')
check(parseIncomingUpdatedAt([]) === null, 'a non-string array was not rejected')

// --- Source-presence: api/profile/save.js -----------------------------------

const SAVE = 'api/profile/save.js'
const save = fs.readFileSync(SAVE, 'utf8')

check(save.includes('const { profile_updated_at: rawIncomingUpdatedAt, ...rawProfile } = rawBody'),
  `${SAVE}: profile_updated_at is no longer pulled out of the incoming body before it becomes profile_state`)

const whereIdx = save.indexOf('AND (profile_updated_at IS NULL OR ${incomingUpdatedAt}::timestamptz IS NULL OR profile_updated_at <= ${incomingUpdatedAt}::timestamptz)')
check(whereIdx !== -1, `${SAVE}: the staleness precondition's WHERE clause is missing or has drifted`)

const updateIdx = save.indexOf('SET profile_state = ${profile}::jsonb, profile_updated_at = NOW()')
check(updateIdx !== -1 && whereIdx !== -1 && updateIdx < whereIdx,
  `${SAVE}: the precondition does not gate the same UPDATE that writes profile_state`)

check(save.includes('RETURNING profile_updated_at'), `${SAVE}: the UPDATE no longer returns the new timestamp for the client to track`)
check(/if \(rows\.length === 0\) \{\s*return res\.status\(409\)/.test(save),
  `${SAVE}: a precondition failure (zero rows) no longer returns 409`)
check(save.includes("res.status(200).json({ ok: true, updatedAt: rows[0].profile_updated_at })"),
  `${SAVE}: a successful save no longer reports the new updatedAt back to the client`)

// --- Source-presence: src/autosave-gate.js -----------------------------------

const GATE = 'src/autosave-gate.js'
const gate = fs.readFileSync(GATE, 'utf8')
check(gate.includes('export function canPushProfile({ signedIn, serverLoadOk, deleting })'),
  `${GATE}: canPushProfile no longer keys on serverLoadOk (settle-only-on-success), the finding #2.5 fix`)
check(gate.includes('export function pushProfileVerdict({ signedIn, serverLoadOk, deleting })'),
  `${GATE}: pushProfileVerdict no longer keys on serverLoadOk`)
check(!/function\s+(canPushProfile|pushProfileVerdict)\([^)]*serverLoadDone/.test(gate),
  `${GATE}: one of the exported functions still takes the old serverLoadDone param -- this gate must key on serverLoadOk exclusively (settle-only-on-success), not the settle-regardless-of-outcome flag`)

// --- Source-presence: src/App.jsx --------------------------------------------

const APP = 'src/App.jsx'
const app = fs.readFileSync(APP, 'utf8')

check(app.includes('if(r.ok)serverLoadOkRef.current=true;return r.ok?r.json():null'),
  `${APP}: /api/profile/load's response is no longer checked for success before unlocking the autosave PUT`)
check(app.includes('setServerLoadOk(serverLoadOkRef.current)'),
  `${APP}: the load chain's .finally no longer syncs serverLoadOk state from the ref`)
check(app.includes('profileUpdatedAtRef.current=serverProfile.updatedAt||null'),
  `${APP}: a successful profile load no longer captures the server's updatedAt`)
check(app.includes('canPushProfile({signedIn:true,serverLoadOk:serverLoadOkRef.current,deleting:deletingRef.current})'),
  `${APP}: the autosave gate call site no longer passes serverLoadOk -- it may still be gating on the settle-regardless-of-outcome flag`)
check(app.includes('profile_updated_at:profileUpdatedAtRef.current'),
  `${APP}: the autosave PUT no longer sends profile_updated_at`)
check(app.includes("if(saved&&saved.updatedAt)profileUpdatedAtRef.current=saved.updatedAt"),
  `${APP}: a successful save no longer advances profileUpdatedAtRef from the server's response`)
check(app.includes("reason=r.status===409?'stale':r.status===413?'too_large'"),
  `${APP}: a 409 from the server no longer maps to the 'stale' save-error reason`)
check(app.includes("saveError==='stale'?"),
  `${APP}: the save-failure notice has no copy for the 'stale' reason`)
check(app.includes("saveError!=='signed_out'&&saveError!=='stale'&&"),
  `${APP}: the 'Try again' button still offers a blind retry on 'stale', which would resend the same stale precondition and fail identically -- it needs a reload, not a retry`)

if (failures) {
  console.error(`test-profile-save-staleness: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-profile-save-staleness: OK (parseIncomingUpdatedAt treats absent/malformed timestamps as "no precondition" and passes valid ones through unchanged; api/profile/save.js gates its UPDATE atomically on the staleness precondition and returns 409/the new updatedAt; the client only unlocks the PUT on an actual load success, sends profile_updated_at, tracks the server-returned updatedAt, and gives a stale save a Reload path instead of a doomed retry)')
}
