// SINGLE SOURCE OF TRUTH for user-guide chapter order and numbering.
//
// Why this exists. Chapter order used to be implied by numeric filename
// prefixes (04-orientation-phase.md) and read independently by three consumers
// that each did their own `.sort()`: build-user-guide.mjs, the PDF builder, and
// user-guide-hash.mjs. That made the number part of the filename, so inserting
// a chapter meant renaming files AND rewriting every "Chapter 12" reference in
// prose — 77 of them at the time this was written. A renumber you have to
// perform by hand is a renumber that eventually gets skipped, which is how the
// guide drifted in the first place.
//
// Now: filenames are stable slugs and never change. src/data/user-guide/ORDER.json
// owns the sequence, and the number a reader sees is DERIVED from position here.
// Adding a chapter is: create the file, add one line to ORDER.json. Numbering
// re-flows on its own and nothing breaks, because prose cites chapters by NAME
// rather than number (enforced by scripts/check-guide-refs.mjs).
//
// index.md is the contents page, not a numbered chapter, and is excluded
// everywhere — same as the old glob did.
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export const REPO_ROOT = path.resolve(__dirname, '..', '..')
export const CHAPTERS_DIR = path.join(REPO_ROOT, 'src', 'data', 'user-guide')
export const ORDER_FILE = path.join(CHAPTERS_DIR, 'ORDER.json')
export const INDEX_FILE = 'index.md'

function readOrder() {
  let raw
  try {
    raw = fs.readFileSync(ORDER_FILE, 'utf8')
  } catch {
    throw new Error(`user-guide-order: cannot read ${ORDER_FILE}`)
  }
  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch (e) {
    throw new Error(`user-guide-order: ORDER.json is not valid JSON — ${e.message}`)
  }
  const list = parsed && parsed.chapters
  if (!Array.isArray(list) || list.length === 0) {
    throw new Error('user-guide-order: ORDER.json must carry a non-empty "chapters" array')
  }
  return list
}

// Ordered chapter filenames. Throws — loudly, with the fix — when the manifest
// and the directory disagree. This is the guard that makes "add a chapter and
// forget the manifest" a build failure instead of a silently missing chapter.
export function chapterFiles() {
  const listed = readOrder()

  const dupes = listed.filter((n, i) => listed.indexOf(n) !== i)
  if (dupes.length) {
    throw new Error(`user-guide-order: ORDER.json lists these twice: ${[...new Set(dupes)].join(', ')}`)
  }

  const onDisk = fs
    .readdirSync(CHAPTERS_DIR)
    .filter((n) => n.endsWith('.md') && n !== INDEX_FILE)

  const missing = listed.filter((n) => !onDisk.includes(n))
  if (missing.length) {
    throw new Error(
      `user-guide-order: ORDER.json lists chapters that do not exist: ${missing.join(', ')}\n` +
      `  Fix: create the file, or remove the line from src/data/user-guide/ORDER.json.`
    )
  }

  const unlisted = onDisk.filter((n) => !listed.includes(n))
  if (unlisted.length) {
    throw new Error(
      `user-guide-order: these chapters exist but are not in ORDER.json: ${unlisted.join(', ')}\n` +
      `  Fix: add each to the "chapters" array in src/data/user-guide/ORDER.json,\n` +
      `  in the position it should read. Chapter numbers re-flow automatically.`
    )
  }

  return listed
}

// 1-based reader-facing chapter number, derived from position. Returns null for
// anything not a numbered chapter (index.md).
export function chapterNumber(filename) {
  const i = chapterFiles().indexOf(filename)
  return i === -1 ? null : i + 1
}

// Human title for a chapter: its first markdown H1, with any legacy leading
// "N. " stripped so a stale hand-typed number can never reach the contents page.
export function chapterTitle(filename) {
  const text = fs.readFileSync(path.join(CHAPTERS_DIR, filename), 'utf8')
  const m = text.match(/^﻿?#\s+(.+?)\s*$/m)
  if (!m) throw new Error(`user-guide-order: ${filename} has no H1 title`)
  return m[1].replace(/^\d+[a-e]?\.\s*/, '').trim()
}
