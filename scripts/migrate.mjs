#!/usr/bin/env node
// scripts/migrate.mjs
//
// Applies pending SQL migrations from migrations/ in alphabetical order,
// recording each in the schema_migrations table. Idempotent: safe to re-run.
//
// Commands:
//   node scripts/migrate.mjs status      — list applied + pending, no schema writes
//                                          beyond CREATE TABLE IF NOT EXISTS for the
//                                          tracking table itself
//   node scripts/migrate.mjs up          — apply all pending migrations
//   node scripts/migrate.mjs bootstrap   — mark all current files as applied
//                                          without running them (ONE-TIME, for
//                                          existing production databases whose
//                                          tables are already in place)
//
// DATABASE_URL env var is required. Uses the @neondatabase/serverless Pool,
// which connects to Neon over a WebSocket; point DATABASE_URL at a Neon
// database (production or a branch). It does NOT speak the raw Postgres wire
// protocol to an arbitrary local server.

import { Pool } from '@neondatabase/serverless'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const MIGRATIONS_DIR = path.resolve(__dirname, '..', 'migrations')

function listFiles() {
  return fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort()
}

async function ensureTrackingTable(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      duration_ms INTEGER
    )
  `)
}

async function getApplied(pool) {
  const result = await pool.query('SELECT name FROM schema_migrations ORDER BY name')
  return new Set(result.rows.map(r => r.name))
}

async function runStatus(pool) {
  await ensureTrackingTable(pool)
  const applied = await getApplied(pool)
  const files = listFiles()
  console.log('Migration status:')
  for (const f of files) {
    console.log(`  ${applied.has(f) ? '✓ applied ' : '… pending '} ${f}`)
  }
  const pending = files.filter(f => !applied.has(f))
  console.log(`\n${applied.size} applied, ${pending.length} pending`)
}

async function runUp(pool) {
  await ensureTrackingTable(pool)
  const applied = await getApplied(pool)
  const files = listFiles()
  const pending = files.filter(f => !applied.has(f))
  if (pending.length === 0) {
    console.log('No pending migrations.')
    return
  }
  for (const f of pending) {
    const sqlText = fs.readFileSync(path.join(MIGRATIONS_DIR, f), 'utf8')
    console.log(`Applying ${f}...`)
    const start = Date.now()
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query(sqlText)
      const ms = Date.now() - start
      await client.query(
        'INSERT INTO schema_migrations (name, duration_ms) VALUES ($1, $2)',
        [f, ms]
      )
      await client.query('COMMIT')
      console.log(`  ✓ ${f} (${ms} ms)`)
    } catch (err) {
      await client.query('ROLLBACK')
      console.error(`  ✗ ${f}: ${err.message}`)
      throw err
    } finally {
      client.release()
    }
  }
  console.log(`\n${pending.length} migrations applied.`)
}

async function runBootstrap(pool) {
  await ensureTrackingTable(pool)
  const applied = await getApplied(pool)
  const files = listFiles()
  const toRegister = files.filter(f => !applied.has(f))
  if (toRegister.length === 0) {
    console.log('Nothing to bootstrap; all files already in schema_migrations.')
    return
  }
  console.log('Bootstrap will register these files as already-applied (no SQL will run):')
  for (const f of toRegister) console.log(`  ${f}`)
  console.log('\nProceeding...')
  for (const f of toRegister) {
    await pool.query(
      'INSERT INTO schema_migrations (name, duration_ms) VALUES ($1, NULL)',
      [f]
    )
    console.log(`  ✓ registered ${f}`)
  }
  console.log(`\n${toRegister.length} files registered.`)
}

async function main() {
  const cmd = process.argv[2] || 'status'
  if (!['status', 'up', 'bootstrap'].includes(cmd)) {
    console.error(`Unknown command: ${cmd}. Use status | up | bootstrap.`)
    process.exit(1)
  }
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is required.')
    process.exit(1)
  }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  try {
    if (cmd === 'status') await runStatus(pool)
    else if (cmd === 'up') await runUp(pool)
    else if (cmd === 'bootstrap') await runBootstrap(pool)
  } catch (err) {
    console.error('\nMigration failed:', err.message)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

main()
