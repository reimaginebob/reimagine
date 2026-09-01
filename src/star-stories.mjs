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

// The story types, in the book's order. Five, not six: the weakness question is
// in the inventory too, but it is answered with a structure rather than with a
// story, and WEAKNESS_QUESTION below carries it.
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
    where: 'Work on this with My Coach',
    step: null,
    // Bridge Story is focus-gated: it only exists once a direction or an
    // opportunity has been built, so pointing someone there before they have one
    // sends them to a screen that is not there yet. The Coach can work the answer
    // now, and Bridge Story sharpens it per opportunity later.
    coach: 'Help me build my answer to "Tell me about yourself" for an interview. This is the first time I have asked you about it, so start from scratch. Thirty seconds, in my own words, ending on why I am in this conversation rather than trailing off in the past. Draft one from what you know about me, say which parts you were least sure about, then help me sharpen it.',
    note: 'The answer that gets used more than any other, and the one most people improvise. Thirty seconds, in your own words, landing on why you are in this conversation. Once you build a direction or add an opportunity, Bridge Story writes you a version aimed at that specific role.',
  },
  {
    id: 'not-on-resume',
    asks: '"What isn\'t on your resume?"',
    where: 'Work on this with My Coach',
    step: null,
    coach: "Help me answer \"What isn't on your resume?\" in an interview. This is the first time I have asked you about it, so start from scratch rather than referring back to any earlier draft. You know my values, what I care about and what has shaped me. Draft an answer in my voice from what you already know, tell me which parts you were least sure about, then help me sharpen it.",
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
    // No destination: the guidance IS the answer. Sending someone to Interview
    // Prep to be told the same thing again is a redirect for its own sake.
    id: 'why-leaving',
    asks: '"Why are you leaving your current role?"',
    where: null,
    step: null,
    note: 'Your best and fewest reasons. If you were laid off, say so plainly: it is common right now, and it reflects a company\'s financial reality rather than anything about how well you did the job. A vague answer invites more questions, not fewer, and the reason you give should connect to what this new role offers.',
  },
  {
    id: 'most-least',
    asks: '"What did you like most and least about your last role?"',
    where: null,
    step: null,
    note: 'This is a values question wearing a preferences question. For the most, name something you valued that this company also values. For the least, pick something this role would not repeat, and say what you did about it rather than leaving it as a complaint. Keep both answers about the work itself, since pay, hours and location say nothing about how you operate.',
  },
  {
    id: 'qualified',
    asks: '"Are you underqualified or overqualified for this position?"',
    where: 'Work on this with My Coach',
    step: null,
    // The right answer depends on which way they are being asked and on what the
    // person suspects is behind it, so the Coach asks before it drafts.
    coach: 'Help me answer the over-or-underqualified question for a role I am pursuing. Ask me first which way it is being asked and what you need to know about the role, then draft an answer. Keep it short: a long explanation raises doubt rather than settling it. This is the first time I have asked you about it, so start from scratch.',
    note: 'Whichever way it is asked, the answer redirects to the specific value you bring, and it stays short. A long explanation raises doubt rather than settling it.',
  },
  {
    id: 'your-questions',
    asks: '"Do you have any questions for me?"',
    where: 'Interview Prep, per person',
    step: null,
    note: 'Always have one; saying no reads as disengagement. Once you name who you are meeting, you get questions aimed at what each of them uniquely knows, and they are also your last chance to reinforce why you fit.',
  },
]

// THE WEAKNESS QUESTION, AND WHY IT IS NOT A STAR STORY.
//
// Lesson 10 gives this question its own model, separate from the playlist:
// "name something real, describe what you have done about it, and close on a
// note that shows you are still mindful of it. Real. Addressed. Ongoing."
//
// It first shipped here as a sixth story type, and the seed did what the shape
// asked of it: it took a real pattern out of someone's assessment and hung it on
// a specific invented event, complete with a year and a restructure that nobody
// had mentioned. The card even confessed it, asking the person to "confirm
// whether this specific 2017 instance is the clearest example". A STAR shape
// demands a Situation, so a prompt handed a trait will manufacture one.
//
// The book is also explicit about where the honest version comes from: "Go back
// to your assessment results... Use that as the foundation for your weakness
// answer rather than starting from scratch." So the evidence is real and quotable
// and the story around it is the person's to supply, in conversation, not ours to
// invent for them.
export const WEAKNESS_QUESTION = {
  id: 'weakness',
  asks: '"What is your greatest weakness?"',
  label: 'The weakness question',
  model: [
    { key: 'Real', text: 'Name something true. Your assessment is the strongest place to find it: the strength that serves you at your best is usually the same one that costs you when it runs unchecked.' },
    { key: 'Addressed', text: 'Say what you have done about it. Building a team strong where you are not, being deliberate about what you own and what you hand off.' },
    { key: 'Ongoing', text: 'Close in the present tense. This is something you still manage, which is what tells them the growth is real rather than finished.' },
  ],
  why: 'Those three parts carry humility, self-awareness and a growth orientation at once.',
  prompt: 'Your assessments are the credible, objective basis for this one. Work it through with My Coach and the answer rests on evidence.',
  coach: 'Help me answer the greatest weakness question. Use the Real, Addressed, Ongoing structure from Making Your Own Weather. Start from my assessment results and name what they actually say about the edges of my strengths, quoting which assessment it came from. Do not invent an event or a date for me: ask me for the example, and if I do not have one, help me find it. Then help me put the three parts together in my own words.',
}

// What the screen lists, in order. The weakness question sits where an
// interviewer asks it, second, rather than being appended after the stories.
export const INVENTORY = [PLAYLIST_TYPES[0], WEAKNESS_QUESTION, ...PLAYLIST_TYPES.slice(1)]

/** The stored weakness answer, if one has been built. Never a STAR story. */
export function weaknessRecord(stories) {
  const list = Array.isArray(stories) ? stories : []
  return list.find(s => s && s.kind === 'weakness') || null
}

/** Does the stored weakness answer actually carry evidence? */
export function hasWeaknessEvidence(stories) {
  const w = weaknessRecord(stories)
  return !!(w && w.weakness && String(w.weakness.real || '').trim())
}

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

/**
 * One story per kind, keeping the first of each.
 *
 * The title dedupe above catches a restatement; it cannot catch the same event
 * described in different words. One seed returned four setback stories: two
 * angles on a 2017 restructure titled "When protecting people cost you capital"
 * and "Being protective of people at a cost", and two on the same departure
 * titled "Choosing when to leave Continental" and "The department elimination in
 * the Beacon acquisition". Not one distinctive word in common across either
 * pair, so nothing string-based was ever going to see it.
 *
 * The seed is a starting library, and a starting library wants one strong answer
 * per question rather than four attempts at one of them. What someone adds by
 * hand afterwards is not capped: by then they are choosing, not being given.
 */
export function firstPerKind(stories) {
  const seen = new Set()
  return (Array.isArray(stories) ? stories : []).filter(s => {
    const k = s && s.kind
    if (!k || seen.has(k)) return false
    seen.add(k)
    return true
  })
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

/** Which of the six questions the library answers, and which are still open. */
export function coverage(stories) {
  const list = Array.isArray(stories) ? stories : []
  const held = new Set(list.map(s => s && s.kind).filter(Boolean))
  // The weakness row is covered by real evidence rather than by a row existing,
  // because an empty weakness record is exactly the state we are steering out of.
  return INVENTORY.map(t => ({ ...t, covered: t.id === 'weakness' ? hasWeaknessEvidence(list) : held.has(t.id) }))
}

/**
 * The rows that render as story cards: the five story types, in playlist order.
 *
 * Filters to known kinds on purpose. The weakness record is not a story, and a
 * legacy 'setback' row from before this split is a fabricated STAR card that
 * should stop being shown; both are still in the database, neither belongs here.
 */
export function storyCards(stories) {
  const known = new Set(PLAYLIST_TYPES.map(t => t.id))
  return orderStories((Array.isArray(stories) ? stories : []).filter(s => s && known.has(s.kind)))
}

// NUMBERS IN A CORRECTION MUST SURVIVE IT.
//
// "Does this feel right?" hands a note to a model and takes back a rewritten
// story. The prompt says the correction wins, but a prompt is an instruction and
// a number is the one thing on a STAR card that must not be left to chance: it
// is the most checkable content in the story and the part an interviewer will
// remember. So we check, the same way the voice rules are checked rather than
// only asked for.
//
// Digits only, and only substantive ones: two or more digits, or a single digit
// carrying a marker like % or $ or x. Otherwise "part 1 is wrong" reports a
// missing 1 and the warning stops meaning anything.
const NUM_RE = /(\$\s*)?(\d[\d,]*(?:\.\d+)?)\s*(%|x\b|k\b|m\b|bn\b|percent)?/gi

/** The substantive numbers in a piece of text, normalised for comparison. */
export function numbersIn(text) {
  const out = new Set()
  const str = String(text || '')
  let m
  NUM_RE.lastIndex = 0
  while ((m = NUM_RE.exec(str)) !== null) {
    const core = m[2].replace(/,/g, '')
    const marked = !!(m[1] || m[3])
    if (core.replace(/\./g, '').length >= 2 || marked) out.add(core)
  }
  return out
}

/** Every number written anywhere in a story: its slots, title, question and why. */
export function storyNumbers(story) {
  const st = story || {}
  const slots = st.slots || {}
  const parts = [st.title, st.question, st.why]
  for (const k of STORY_SLOTS) {
    const v = slots[k]
    if (v && typeof v === 'object') parts.push(v.text, v.to_strengthen)
    else parts.push(v)
  }
  const out = new Set()
  for (const part of parts) for (const n of numbersIn(part)) out.add(n)
  return out
}

/**
 * Numbers the person introduced in their note that did not make it into the
 * rewritten story.
 *
 * Only numbers NEW to the note are checked. "it was 40% not 15%" introduces 40
 * and refers back to 15, and 15 is supposed to disappear — reporting it as lost
 * would be exactly backwards. Anything already in the story before the rewrite
 * is therefore excluded, which also covers "drop the 2017 date".
 */
export function missingNumbers(note, before, after) {
  const had = storyNumbers(before)
  const has = storyNumbers(after)
  return [...numbersIn(note)].filter(n => !had.has(n) && !has.has(n))
}

/**
 * Stories best-first: fewest open slots, then most recently worked on.
 *
 * Used to pick which one leads a question. Insertion order is the wrong answer
 * here — the oldest row is the one built by the earliest version of the prompt,
 * so ordering by arrival puts the weakest card in the most prominent place.
 */
export function rankStories(list) {
  return [...(Array.isArray(list) ? list : [])].sort((a, b) => {
    const ga = emptySlots(a).length, gb = emptySlots(b).length
    if (ga !== gb) return ga - gb
    return String((b && b.updatedAt) || '').localeCompare(String((a && a.updatedAt) || ''))
  })
}

/**
 * One question's answer, plus whatever else is competing for it.
 *
 * The screen exists to give someone a good answer to each of fourteen questions.
 * Rendering every story as a peer card turned that into a wall — one library had
 * three separate cards all answering "the achievement you are most proud of", so
 * a person arriving at the screen had to work out which of three was theirs
 * before they could use any of them. One answer leads; the rest are candidates
 * for the same question, kept and named as such.
 */
export function questionGroup(stories, kindId) {
  const ranked = rankStories(storyCards(stories).filter(s => s.kind === kindId))
  return { primary: ranked[0] || null, alternates: ranked.slice(1) }
}

// READING THE SEED BACK.
//
// The seed returns one JSON object holding the weakness evidence and up to five
// STAR stories, each with four slots carrying both a text and a to_strengthen.
// That is a lot of output, and thinking tokens come out of the same budget, so a
// generation can stop mid-story. `indexOf('{')` to `lastIndexOf('}')` then
// JSON.parse throws the entire response away when that happens, and the person
// gets "that came back in a shape we could not read" after waiting minutes for
// four perfectly good stories.
//
// So: parse the whole thing when it is whole, and otherwise recover the complete
// story objects out of a truncated array and say the set is short.

/** Walks `str` from `start` and returns the index after the object opening there, or -1. */
function endOfObject(str, start) {
  let depth = 0, inStr = false, esc = false
  for (let i = start; i < str.length; i++) {
    const c = str[i]
    if (esc) { esc = false; continue }
    if (c === '\\') { esc = true; continue }
    if (c === '"') { inStr = !inStr; continue }
    if (inStr) continue
    if (c === '{') depth++
    else if (c === '}') { depth--; if (depth === 0) return i }
  }
  return -1
}

/** The complete `{...}` objects inside the stories array, even if it never closed. */
function salvageStories(body) {
  const key = body.search(/"stories"\s*:\s*\[/)
  if (key === -1) return []
  let i = body.indexOf('[', key) + 1
  const out = []
  while (i < body.length) {
    const open = body.indexOf('{', i)
    if (open === -1) break
    const close = endOfObject(body, open)
    if (close === -1) break
    try { out.push(JSON.parse(body.slice(open, close + 1))) } catch { /* skip a bad one */ }
    i = close + 1
  }
  return out
}

// The weakness fields sit ahead of the stories array, so they survive a
// truncation that eats the tail.
function firstString(body, key) {
  const m = body.match(new RegExp('"' + key + '"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"'))
  if (!m) return ''
  try { return JSON.parse('"' + m[1] + '"') } catch { return '' }
}

/**
 * The seed response as an object, whole or salvaged.
 *
 * Returns null only when there is nothing usable at all. `truncated` is true when
 * the response did not parse as a whole but stories were recovered from it, so
 * the caller can tell someone their set came back short rather than pretending
 * five was the answer.
 */
export function parseStorySeed(raw) {
  let str = String(raw || '').trim()
  const fence = str.match(/^```(?:json)?\s*([\s\S]*?)```\s*$/)
  if (fence) str = fence[1].trim()
  const first = str.indexOf('{')
  if (first === -1) return null
  str = str.slice(first)
  const last = str.lastIndexOf('}')
  if (last > 0) {
    try {
      const whole = JSON.parse(str.slice(0, last + 1))
      if (whole && typeof whole === 'object') return { ...whole, truncated: false }
    } catch { /* fall through to salvage */ }
  }
  const stories = salvageStories(str)
  if (!stories.length) return null
  return {
    stories,
    weakness_real: firstString(str, 'weakness_real'),
    weakness_source: firstString(str, 'weakness_source'),
    truncated: true,
  }
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
