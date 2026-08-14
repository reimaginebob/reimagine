// Applies pending database migrations as the FIRST step of a production Vercel
// build, so schema changes ship automatically with each deploy — no manual
// `npm run migrate`, and no "apply the migration before you merge" ordering trap
// (the build runs before the new code serves, so the schema is always updated
// first, by construction).
//
// Runs ONLY on production deploys. Preview and local builds skip it: previews
// share the production database, and we don't want an unmerged PR's build
// mutating the prod schema. A migration failure exits non-zero, which fails the
// build — that's intentional and safe: the current deployment keeps serving, so
// we never ship code ahead of its schema.
//
// Wired in via vercel.json: buildCommand = "node scripts/deploy-migrate.mjs && npm run build".
// Migrations remain forward-only and idempotent (ADD COLUMN IF NOT EXISTS, etc.),
// so a re-run is a no-op; `npm run migrate` still works for local/manual use.

import { spawnSync } from 'node:child_process'

const env = process.env.VERCEL_ENV || 'local'

if (env !== 'production') {
  console.log(`deploy-migrate: skip (VERCEL_ENV=${env}; migrations run on production deploys only)`)
  process.exit(0)
}

if (!process.env.DATABASE_URL) {
  console.error('deploy-migrate: DATABASE_URL is missing on the production build — cannot migrate')
  process.exit(1)
}

console.log('deploy-migrate: applying pending migrations before build…')
const r = spawnSync(process.execPath, ['scripts/migrate.mjs', 'up'], { stdio: 'inherit' })
if (r.error) {
  console.error('deploy-migrate: failed to run the migrate script:', r.error.message)
  process.exit(1)
}
process.exit(typeof r.status === 'number' ? r.status : 1)
