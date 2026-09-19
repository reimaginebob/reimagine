// Before-send check for the Corner "try Reimagine" campaign: which people on a
// list about to be emailed already have a Reimagine account?
//
//   node scripts/reconcile-tranche-accounts.mjs <contacts-file> [<contacts-file> ...]
//   node scripts/reconcile-tranche-accounts.mjs --segment <resend-segment-id> [...]
//
// READ-ONLY. It runs one SELECT against the users table and, in --segment
// mode, GETs a Resend segment's contact list. It changes nothing in Resend,
// sends nothing, and writes no files. It prints what to remove; removing is
// done by hand.
//
// Why this exists: the Resend "never registered" segment and the nine tranche
// segments are snapshots taken 2026-09-15. Registering does not remove anyone
// from them (nothing in the app ever removes a segment member), and matching on
// the exact address misses a person who signed up with a different one. The
// users table is the source of truth, so this compares against it directly.
//
// What it reports for each contact:
//   REMOVE  exact    same mailbox as an account, after api/_lib/normalize-email.js
//                    (case, +tag, Gmail dots) -- the same rule corner-segment.js uses
//   REMOVE  similar  same domain and the same local part once - _ . are ignored
//                    (m-lenart@ vs m_lenart@)
//   REVIEW  name     same first + last name as an account at a different address;
//                    could be the same person, could be a namesake -- look before removing
//   WARN    address  looks undeliverable (a typo'd ending such as .con, or a common
//                    misspelled domain)
// and, across all the inputs together:
//   DUPLICATE        the same mailbox, or the same first + last name, appears more
//                    than once among the contacts you are about to email
//
// Contacts file formats (auto-detected): a JSON array of {email, first_name,
// last_name}; or text with one contact per line, "email" or "email,First,Last"
// (tab or comma separated). Blank lines and lines starting with # are ignored.
//
// Getting the list: --segment needs RESEND_API_KEY in the environment (a
// read-only GET; the key is not stored anywhere on this machine). Without a key,
// export the tranche's contacts to a file however you like and pass the file.
//
// Database: DATABASE_URL if set, otherwise the SELECT-only connection string at
// ~/.reimagine-db-ro.

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { normalizeEmail } from '../api/_lib/normalize-email.js'

// ---- pure matching (exported for the test) ---------------------------------

const clean = s => String(s || '').trim().toLowerCase()

// Domain + local part with separators and any +tag removed. Deliberately looser
// than normalizeEmail: it exists to catch m-lenart@ vs m_lenart@, and it is only
// ever a REMOVE candidate when the domain is identical.
export function similarKey(raw) {
  const e = clean(raw)
  const at = e.lastIndexOf('@')
  if (at < 1) return e
  let local = e.slice(0, at)
  const plus = local.indexOf('+')
  if (plus > 0) local = local.slice(0, plus)
  return `${local.replace(/[^a-z0-9]/g, '')}@${e.slice(at + 1)}`
}

// A name key only when both halves are present; one-word or blank names would
// match half the list.
export function nameKey(first, last) {
  const f = clean(first).replace(/\s+/g, ' ')
  const l = clean(last).replace(/\s+/g, ' ')
  return f && l ? `${f}|${l}` : ''
}

const BAD_ENDINGS = new Set(['con', 'cmo', 'ocm', 'vom', 'comm', 'coom', 'xom'])
const BAD_DOMAINS = new Set([
  'gmial.com', 'gamil.com', 'gmai.com', 'gmal.com', 'gnail.com', 'gmail.co', 'gmail.cm',
  'yaho.com', 'yahooo.com', 'yahoo.co', 'hotmial.com', 'hotmal.com', 'outlok.com',
  'iclod.com', 'icloud.co', 'aol.co',
])

export function addressWarning(raw) {
  const e = clean(raw)
  const at = e.lastIndexOf('@')
  if (at < 1 || at === e.length - 1) return 'not a valid address'
  const domain = e.slice(at + 1)
  if (!domain.includes('.')) return 'domain has no dot'
  if (BAD_DOMAINS.has(domain)) return `misspelled domain (${domain})`
  const ending = domain.slice(domain.lastIndexOf('.') + 1)
  if (BAD_ENDINGS.has(ending)) return `ends in ".${ending}" -- probably a typo`
  return null
}

// accounts: [{email, first_name, last_name, created_at}]
// contacts: [{email, first_name, last_name, source}]
export function reconcile(contacts, accounts) {
  const byExact = new Map()
  const bySimilar = new Map()
  const byName = new Map()
  for (const a of accounts) {
    const push = (m, k, v) => { if (k) (m.get(k) || m.set(k, []).get(k)).push(v) }
    push(byExact, normalizeEmail(a.email), a)
    push(bySimilar, similarKey(a.email), a)
    push(byName, nameKey(a.first_name, a.last_name), a)
  }

  const findings = []
  for (const c of contacts) {
    const exact = byExact.get(normalizeEmail(c.email))
    if (exact) { findings.push({ level: 'REMOVE', kind: 'exact', contact: c, accounts: exact }); continue }
    const similar = bySimilar.get(similarKey(c.email))
    if (similar) { findings.push({ level: 'REMOVE', kind: 'similar', contact: c, accounts: similar }); continue }
    const named = byName.get(nameKey(c.first_name, c.last_name))
    if (named) findings.push({ level: 'REVIEW', kind: 'name', contact: c, accounts: named })
    const warn = addressWarning(c.email)
    if (warn) findings.push({ level: 'WARN', kind: 'address', contact: c, note: warn })
  }

  // Duplicates among the people about to be emailed. A person on two lists at
  // two addresses would get the same email twice.
  const dups = []
  const groups = (keyFn, kind) => {
    const m = new Map()
    for (const c of contacts) {
      const k = keyFn(c)
      if (k) (m.get(k) || m.set(k, []).get(k)).push(c)
    }
    for (const list of m.values()) {
      // Same address listed twice inside one source is a data quirk, not two sends
      // -- but the same address in two different sources would be sent twice.
      if (list.length > 1) dups.push({ kind, contacts: list })
    }
  }
  groups(c => normalizeEmail(c.email), 'same mailbox')
  groups(c => similarKey(c.email), 'similar address')
  groups(c => nameKey(c.first_name, c.last_name), 'same name')

  // A contact set that is identical for two of the kinds is one problem.
  const seen = new Set()
  const dedupedDups = dups.filter(d => {
    const sig = d.contacts.map(c => `${clean(c.email)}@${c.source}`).sort().join('#')
    if (seen.has(sig)) return false
    seen.add(sig)
    return true
  })

  return { findings, duplicates: dedupedDups }
}

// ---- input ----------------------------------------------------------------

export function parseContacts(text, source) {
  const trimmed = text.replace(/^﻿/, '').trim()
  if (!trimmed) return []
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    const json = JSON.parse(trimmed)
    const arr = Array.isArray(json) ? json : Array.isArray(json.data) ? json.data : []
    return arr
      .filter(o => o && o.email)
      .map(o => ({ email: String(o.email).trim(), first_name: o.first_name || '', last_name: o.last_name || '', source }))
  }
  const out = []
  for (const line of trimmed.split(/\r?\n/)) {
    const l = line.trim()
    if (!l || l.startsWith('#')) continue
    const parts = l.split(/[\t,]/).map(p => p.trim().replace(/^"|"$/g, ''))
    if (!parts[0] || !parts[0].includes('@')) continue // header row or stray text
    out.push({ email: parts[0], first_name: parts[1] || '', last_name: parts[2] || '', source })
  }
  return out
}

export async function fetchSegment(apiKey, segmentId) {
  const base = process.env.RESEND_API_BASE || 'https://api.resend.com'
  const out = []
  let after = null
  for (let page = 0; page < 50; page++) {
    const qs = new URLSearchParams({ limit: '100' })
    if (after) qs.set('after', after)
    let resp
    for (let attempt = 0; ; attempt++) {
      resp = await fetch(`${base}/segments/${segmentId}/contacts?${qs}`, { headers: { Authorization: `Bearer ${apiKey}` } })
      if (resp.status !== 429 || attempt >= 3) break
      await new Promise(r => setTimeout(r, 1000 * (attempt + 1)))
    }
    if (!resp.ok) throw new Error(`Resend segment ${segmentId}: ${resp.status} ${(await resp.text().catch(() => '')).slice(0, 200)}`)
    const json = await resp.json()
    const data = Array.isArray(json.data) ? json.data : []
    out.push(...data)
    if (!json.has_more || data.length === 0) break
    after = data[data.length - 1].id
    await new Promise(r => setTimeout(r, 200)) // Resend allows 10 requests a second
  }
  return out.map(o => ({ email: o.email, first_name: o.first_name || '', last_name: o.last_name || '', source: `segment ${segmentId.slice(0, 8)}` }))
}

function dbUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  const file = path.join(os.homedir(), '.reimagine-db-ro')
  const raw = fs.readFileSync(file, 'utf8').trim()
  const m = raw.match(/postgres(?:ql)?:\/\/\S+/)
  return m ? m[0].replace(/['"]$/, '') : raw
}

async function loadAccounts() {
  // Resolve from the repo the script lives in, not the caller's directory.
  const require = createRequire(new URL('../package.json', import.meta.url))
  const { neon } = require('@neondatabase/serverless')
  const sql = neon(dbUrl())
  return sql`SELECT email, first_name, last_name, created_at, suspended_at FROM users`
}

// ---- report ---------------------------------------------------------------

const who = c => `${c.email}${c.first_name || c.last_name ? ` (${[c.first_name, c.last_name].filter(Boolean).join(' ')})` : ''}${c.source ? `  [${c.source}]` : ''}`
const acct = a => `${a.email}${a.first_name || a.last_name ? ` (${[a.first_name, a.last_name].filter(Boolean).join(' ')})` : ''}, account created ${new Date(a.created_at).toISOString().slice(0, 10)}`

export function formatReport(contacts, accounts, result) {
  const lines = []
  const of = level => result.findings.filter(f => f.level === level)
  const remove = of('REMOVE'); const review = of('REVIEW'); const warn = of('WARN')

  lines.push(`Checked ${contacts.length} contact(s) against ${accounts.length} Reimagine account(s).`)
  lines.push(`REMOVE ${remove.length}   REVIEW ${review.length}   WARN ${warn.length}   DUPLICATE ${result.duplicates.length}`)

  const section = (title, items, render) => {
    if (!items.length) return
    lines.push('', title)
    for (const i of items) lines.push(...render(i))
  }
  section('REMOVE -- already has an account; do not send', remove, f => [
    `  ${who(f.contact)}`,
    ...f.accounts.map(a => `      ${f.kind === 'exact' ? 'same mailbox as' : 'near-identical address to'} ${acct(a)}`),
  ])
  section('REVIEW -- same name as an account at a different address; check before removing', review, f => [
    `  ${who(f.contact)}`,
    ...f.accounts.map(a => `      same name as ${acct(a)}`),
  ])
  section('WARN -- address looks undeliverable', warn, f => [`  ${who(f.contact)}  -- ${f.note}`])
  section('DUPLICATE -- would be emailed more than once', result.duplicates, d => [
    `  ${d.kind}:`,
    ...d.contacts.map(c => `      ${who(c)}`),
  ])
  if (!remove.length && !review.length && !warn.length && !result.duplicates.length) lines.push('', 'Nothing to remove.')
  lines.push('', 'Read-only: nothing was changed in Resend or the database.')
  return lines.join('\n')
}

// ---- main -----------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2)
  if (!args.length || args.includes('--help') || args.includes('-h')) {
    console.log('usage: node scripts/reconcile-tranche-accounts.mjs <contacts-file> [...]\n       node scripts/reconcile-tranche-accounts.mjs --segment <resend-segment-id> [...]   (needs RESEND_API_KEY)')
    process.exit(args.length ? 0 : 1)
  }
  const contacts = []
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--segment') {
      const id = args[++i]
      if (!id) { console.error('--segment needs a segment id'); process.exit(1) }
      const key = process.env.RESEND_API_KEY
      if (!key) { console.error('--segment needs RESEND_API_KEY in the environment; otherwise pass an exported contacts file.'); process.exit(1) }
      contacts.push(...await fetchSegment(key, id))
    } else {
      const text = fs.readFileSync(args[i], 'utf8')
      contacts.push(...parseContacts(text, path.basename(args[i])))
    }
  }
  if (!contacts.length) { console.error('No contacts found in the input.'); process.exit(1) }

  const accounts = await loadAccounts() // suspended accounts still count: an account excludes you by definition
  console.log(formatReport(contacts, accounts, reconcile(contacts, accounts)))
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main().catch(err => { console.error('reconcile-tranche-accounts failed:', err && err.message); process.exit(1) })
}
