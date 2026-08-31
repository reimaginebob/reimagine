// src/star-stories.mjs
// The STAR story library: the six playlist types, story shape, and the dedupe
// that stops one experience becoming three near-identical rows.
//
// Pure and dependency-free so scripts/test-star-stories.mjs can exercise it
// under plain node. src-only, never imported from api/* (the .mjs boundary).
//
// WHY A LIBRARY AT ALL. Lesson 10 of Making Your Own Weather opens on the
// Playlist Principle: "you do not need one hundred stories for one hundred
// questions... what you need is a playlist of roughly twelve well-built STAR
// stories that cover the full range of likely interview topics." Interview Prep
// shipped the remix half of that lesson without the playlist it remixes from.

// The book's own list, in its order.
//
// `asks` is the question from Johnny Taylor's twelve that this type answers, so
// the inventory reads as questions a person will be asked rather than as
// categories we invented. Two of the six are not in the twelve on their own and
// carry an `asksNote` saying where they actually turn up instead — only four of
// those twelve need a stored story at all; the rest are positioning and research
// questions that belong in Interview Prep, not in a story library.
//
// `prompt` is what the person is being asked to remember when the library has no
// story of that kind yet — the shape of a strong answer, not a scolding about a
// gap.
export const PLAYLIST_TYPES = [
  {
    id: 'achievement',
    asks: '"What are your greatest strengths?"',
    label: 'A significant achievement',
    prompt: 'The one you would lead with. What made it hard, what you decided, and the number at the end of it.',
  },
  {
    id: 'setback',
    asks: '"What is your greatest weakness?"',
    label: 'A setback and what you learned',
    prompt: 'This is the one an interviewer asks as "tell me about a failure" or "what is your biggest weakness". Not a disguised strength. Something that genuinely did not go your way, what you did about it, and how you stay mindful of it now. Your assessment is the best place to start: the strength that serves you at your best is usually the same one that costs you when it runs unchecked.',
  },
  {
    id: 'authority',
    asks: null,
    asksNote: 'Not one of the twelve on its own. It arrives inside the strengths question, or when someone asks how you get things done.',
    label: 'Leading without formal authority',
    prompt: 'A time you moved something without the title to order it. Tests influence rather than rank, so the interesting part is how you got people to want it.',
  },
  {
    id: 'collaboration',
    asks: '"How do you handle conflict with a colleague?"',
    label: 'A difficult collaboration',
    prompt: 'One real disagreement, resolved. The strongest version hears the other side out first and closes on the outcome, not on who was right.',
  },
  {
    id: 'strategic',
    asks: null,
    asksNote: 'Not one of the twelve on its own. It arrives when they ask about your biggest impact, or what you would do first here.',
    label: 'A moment of strategic impact',
    prompt: 'Where your thinking changed the direction, not just the delivery. Name the framework you used if you have one; it is the most underused part of a story like this.',
  },
  {
    id: 'ambiguity',
    asks: '"Tell me about a time you faced a difficult situation at work."',
    label: 'Navigating ambiguity or conflict',
    prompt: 'A time the brief was unclear or the room disagreed, and you had to move anyway. What you did first is usually the whole answer.',
  },
]

export const PLAYLIST_TARGET = 12

export const STORY_SLOTS = ['S', 'T', 'A', 'R']

// Reimagine's one change to STAR, and the reason its answers land differently.
export const SLOT_LABELS = { S: 'Situation', T: 'Thought Process', A: 'Action', R: 'Result' }

export function newStoryId() {
  return 'st_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8)
}

/** Normalized title, for deciding whether two rows are the same experience. */
export function normalizeTitle(raw) {
  return String(raw || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

// Words that carry no identity, so "Toronto acquisition integration" and
// "the Toronto acquisition" are recognised as one experience.
const WEAK_TITLE_WORDS = new Set([
  'the', 'a', 'an', 'and', 'of', 'at', 'in', 'on', 'for', 'to', 'with', 'my',
  'our', 'their', 'his', 'her', 'story', 'time', 'when', 'that', 'this',
])

function titleTokens(raw) {
  return normalizeTitle(raw).split(' ').filter(t => t && !WEAK_TITLE_WORDS.has(t))
}

/**
 * Are these two titles the same experience?
 *
 * The prep names stories loosely — one rebuild produced both "Toronto
 * acquisition integration under the Managing Partner's direction" and "Toronto
 * acquisition, building trust with a skeptical acquired team" for one event. A
 * library that takes both accumulates duplicates of the same story, which is
 * exactly what a playlist must not do.
 *
 * Deliberately not fuzzy matching: two titles are the same when one's
 * distinctive words are a subset of the other's. That catches restatements and
 * leaves genuinely different stories alone.
 */
export function sameStory(a, b) {
  const x = titleTokens(a), y = titleTokens(b)
  if (!x.length || !y.length) return false
  const [short, long] = x.length <= y.length ? [x, y] : [y, x]
  if (short.length < 2) return short[0] === long[0] && long.length < 2
  const set = new Set(long)
  return short.every(t => set.has(t))
}

/** The library plus `story`, unless something already there is the same experience. */
export function addStory(stories, story) {
  const list = Array.isArray(stories) ? stories : []
  if (!story || !String(story.title || '').trim()) return list
  if (list.some(s => sameStory(s && s.title, story.title))) return list
  return list.concat([story])
}

/** Which of the six the library covers, and which are still open. */
export function coverage(stories) {
  const list = Array.isArray(stories) ? stories : []
  const held = new Set(list.map(s => s && s.kind).filter(Boolean))
  return PLAYLIST_TYPES.map(t => ({ ...t, covered: held.has(t.id) }))
}

/**
 * A story is only as useful as its thinnest slot. Returns the slots with
 * nothing in them, which is what the library shows as the next thing to do.
 */
export function emptySlots(story) {
  const slots = (story && story.slots) || {}
  return STORY_SLOTS.filter(k => {
    const v = slots[k]
    const text = v && typeof v === 'object' ? v.text : v
    return !String(text || '').trim()
  })
}

/** Complete enough to take into a conversation. */
export function isComplete(story) {
  return emptySlots(story).length === 0
}

export const STORY_STORAGE_VERSION = 1
