// The moves a job search is actually made of — in the product and outside it.
//
// FEATURE_MAP (src/coach-routing.js) already separates an in-app screen from a
// thing a person does in the world: Career Club Corner and an accountability
// partner sit in it as `reach: 'community'`. This is that idea carried through.
// The in-app half the product can already see, now that it reads what is built
// in every playbook. The off-product half it has never been able to see at all,
// and that half is where a search is won or lost.
//
// WHAT THIS IS FOR, AND WHAT IT MUST NEVER BECOME.
//
// It exists so the coach can say "did you know we can do this for you" about the
// right thing at the right moment, and so it stops asking about something once
// it has an answer. It is back-end vocabulary. It is never rendered to the user,
// never counted, never totalled, never scored. A list of everything a person
// could be doing, shown to a person doing their best in a hard week, is the
// paralysis this whole line of work set out to remove.
//
// Nothing here is required, and nothing is in an order. A search that never
// touches half of these can be an excellent search.
//
// Plain `.js`: api/* imports it across the boundary where `.mjs` is unsafe
// (CLAUDE.md section 8; the 2026-05-27 FUNCTION_INVOCATION_FAILED outage).

// `evidence` says how a fact about this activity can come to be known:
//   'observed'  — the product can see it for itself, from what is built. Never
//                 ask about these; asking for something already on file is the
//                 failure that made someone feel unread (the Marisol turn).
//   'asked'     — only the person knows. The product is blind to it, and the
//                 only honest way to find out is to ask, the way a doctor asks.
//
// `why` is the reason the move is worth making, in plain language, for the coach
// to draw on when it offers. It is a reason, never a rule, and never a scold.
export const ACTIVITY_CATALOG = [
  // ---- the human half: invisible to Reimagine, and the part that compounds ----
  {
    key: 'networking_group', evidence: 'asked', label: 'a job-search group they attend',
    why: 'A search run alone gets shorter and lonelier every week. A group is where someone hears what other people tried, what came back, and what they are doing next — which is also how they find out what is actually working right now.',
    offer: 'Job Search Resources finds groups near them, and Career Club Corner is free every Monday at noon Eastern.',
  },
  {
    key: 'career_club_corner', evidence: 'asked', label: 'Career Club Corner',
    why: 'A free weekly call with other people in the same search, Mondays at noon Eastern. It is where this method came from, and every session is recorded, so a missed week costs nothing.',
    offer: 'It is on Job Search Resources, pinned at the top.',
  },
  {
    key: 'accountability_partner', evidence: 'asked', label: 'someone holding them accountable',
    why: 'One person who knows what they said they would do this week. It costs nothing to set up and it changes what gets done between Mondays.',
    offer: 'Often someone already in their group, or another person in the same search.',
  },
  {
    key: 'direct_outreach', evidence: 'asked', label: 'writing to a company with nothing posted',
    why: 'A posting is an RFP: the reply goes into a pile and the waiting starts. Writing to a company that has posted nothing is the channel where the next move stays theirs.',
    offer: 'Go-to-Market builds the target list and the note.',
  },
  {
    key: 'asked_for_intro', evidence: 'asked', label: 'asking someone for an introduction',
    why: 'A name at the company beats a cold application, and their own network usually holds more of them than it feels like — including people they have forgotten they know.',
    offer: 'Who You Know Here reads their own LinkedIn connections against a live opportunity and drafts the note.',
  },
  {
    key: 'talked_to_recruiter', evidence: 'asked', label: 'a conversation with a recruiter',
    why: 'A recruiter who works their function and level knows what is open before it is posted, and keeps knowing it after this search ends.',
    offer: 'Recruiters finds the boutique firms and the named practice leaders for their path.',
  },
  {
    key: 'local_resources', evidence: 'asked', label: 'free help near them',
    why: 'Publicly funded and volunteer-run help exists in most places and is close to invisible from a search engine.',
    offer: 'Job Search Resources covers the American Job Center system, library programs and local groups.',
  },

  // ---- the in-product half: readable from what is built, never asked about ----
  { key: 'personal_brand', evidence: 'observed', label: 'their Personal Brand' },
  { key: 'direction_chosen', evidence: 'observed', label: 'a direction to work' },
  { key: 'resume_refreshed', evidence: 'observed', label: 'a refreshed resume' },
  { key: 'linkedin_remixed', evidence: 'observed', label: 'their LinkedIn rewritten' },
  { key: 'opportunity_added', evidence: 'observed', label: 'a live opportunity on My Pipeline' },
  { key: 'interview_prepped', evidence: 'observed', label: 'Interview Prep on an opportunity' },
  { key: 'stories_written', evidence: 'observed', label: 'their STAR stories' },
]

export const ACTIVITY_KEYS = ACTIVITY_CATALOG.map(a => a.key)
export const ACTIVITY_STATES = ['done', 'not_yet', 'declined']
export const ACTIVITY_SOURCES = ['said', 'asked', 'observed']

const BY_KEY = new Map(ACTIVITY_CATALOG.map(a => [a.key, a]))
export const activity = (key) => BY_KEY.get(key) || null

// An unregistered key is rejected rather than written. A row nothing reads looks
// exactly like a successful save and is the worst outcome available, which is the
// same reason GRANTABLE_FLAGS validates a flag before setting it.
//
// ONLY THE ASKABLE HALF IS EVER STORED. An `observed` activity is read from what
// the person has built -- it is derived, and derived state written down goes
// stale the moment they build something. Storing one would also mean offering to
// "remember" a thing the product can already see, which is the failure that made
// someone feel unread. The instruction tells the model to use only the askable
// keys; this makes it true whatever the model emits, because instruction alone
// has never held on this project.
export function isValidFact(key, state, source) {
  const def = BY_KEY.get(key)
  return !!def && def.evidence === 'asked' && ACTIVITY_STATES.includes(state) && ACTIVITY_SOURCES.includes(source)
}

// The ones only they can answer. The coach asks from this set and never from the
// observed half, which it can already see for itself.
export const ASKABLE = ACTIVITY_CATALOG.filter(a => a.evidence === 'asked')
