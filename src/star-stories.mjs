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
// `asks` is the question this type answers, written the way an interviewer says
// it, so the inventory reads as questions rather than as categories we invented.
// Four are Johnny Taylor's; two are not on his list and are asked anyway. They
// are not marked as exceptions — the source gets credited once, at the top of
// the screen, and after that a question is just a question.
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
    asks: '"Tell me about a time you led people who did not report to you."',
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
    asks: '"What is the biggest impact you have had?"',
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

// The rest of Johnny Taylor's twelve: the ones that do NOT want a story from the
// library. Every one of them is still a question this person will be asked, and
// Reimagine answers most of them somewhere else — so the screen names where,
// rather than leaving eight of the twelve unaccounted for.
//
// `step` is set only where the destination is a standalone screen we can send
// someone to. The rest are inside an opportunity or a chosen direction, so they
// are named in words instead of pretending to be one click away.
export const ROUTED_QUESTIONS = [
  {
    id: 'about-yourself',
    asks: '"Tell me about yourself."',
    where: 'Your Bridge Story',
    step: null,
    note: 'Built for you on any opportunity or direction: a thirty-second answer in your own words that gets used more than any other thing here.',
  },
  {
    id: 'not-on-resume',
    asks: '"What isn\'t on your resume?"',
    where: 'Work on this with My Coach',
    step: null,
    coach: "Help me answer \"What isn't on your resume?\" in an interview. You know my values, what I care about and what has shaped me. Draft an answer in my voice from what you already know, tell me which parts you were least sure about, then help me sharpen it.",
    note: 'The one question that wants the human answer rather than the professional one. Your values, what you care about, what shaped you. A real answer beats a rehearsed one, and everything it needs is already in what you have told us.',
  },
  {
    id: 'know-company',
    asks: '"What do you know about our company?"',
    where: 'About This Company, on the opportunity',
    step: null,
    note: 'This is research, and the effort is itself the signal. Go past the homepage to recent news, competitors and culture, and reference one specific thing you found.',
  },
  {
    id: 'why-leaving',
    asks: '"Why are you leaving your current role?"',
    where: 'Interview Prep',
    step: null,
    note: 'Your best and fewest reasons. If you were laid off, say so plainly: it is common right now, and it reflects a company\'s financial reality rather than anything about how well you did the job. A vague answer invites more questions, not fewer.',
  },
  {
    id: 'most-least',
    asks: '"What did you like most and least about your last role?"',
    where: 'Interview Prep',
    step: null,
    note: 'Tests values alignment. Name something you valued that this company also values, and for the least, pick something unrelated to this role and show you handled it well. Stay off the commute and the perks.',
  },
  {
    id: 'qualified',
    asks: '"Are you underqualified or overqualified for this position?"',
    where: 'Interview Prep',
    step: null,
    note: 'Redirect to the specific value you bring, and keep it short: a long explanation raises doubt rather than confidence. If overqualified, frame the experience as something the team can build on.',
  },
  {
    id: 'view-changed',
    asks: '"Has your view of the job changed since we started talking?"',
    where: 'Interview Prep',
    step: null,
    note: 'Asked late, and it tests whether you were listening rather than running a script. A specific yes, pointing at what an earlier answer clarified, shows you were in the conversation. If something is still unclear, saying so counts too.',
  },
  {
    id: 'your-questions',
    asks: '"Do you have any questions for me?"',
    where: 'Interview Prep, per person',
    step: null,
    note: 'Always have one; saying no reads as disengagement. Once you name who you are meeting, you get questions aimed at what each of them uniquely knows, and they are also your last chance to reinforce why you fit.',
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

/**
 * The library in the order the inventory above it lists the questions.
 *
 * Stories arrive in whatever order the seed produced them, which put the cards
 * out of step with the checklist a person had just read. Reading a menu in one
 * order and then meeting its contents in another makes someone re-find their
 * place on every scroll.
 *
 * Within a type, insertion order holds, so a second story of the same kind sits
 * under the first rather than jumping ahead of it. A story whose kind is not one
 * of the six sorts to the end instead of vanishing.
 */
export function orderStories(stories) {
  const list = Array.isArray(stories) ? stories : []
  const rank = new Map(PLAYLIST_TYPES.map((t, i) => [t.id, i]))
  return list
    .map((story, i) => ({ story, i, r: rank.has(story && story.kind) ? rank.get(story.kind) : PLAYLIST_TYPES.length }))
    .sort((a, b) => (a.r - b.r) || (a.i - b.i))
    .map(x => x.story)
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
