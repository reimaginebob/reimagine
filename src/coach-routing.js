// Deterministic feature-routing for My Coach.
//
// The coach system prompt instructs the model to point users to the Reimagine
// tool that does the work and to emit a NAVIGATE line. In a prompt this large
// (full book + user guide), the model does that unreliably — a preview battery
// measured the NAVIGATE line firing on roughly one in seven feature-matched
// questions, and sometimes targeting the wrong step (the orientation "resume"
// upload step instead of Resume Refresh). This mirrors the project's voice-rule
// philosophy: an instruction is a draft; pair it with a deterministic
// mechanism. Given the user's message, infer the single best feature step id
// (or null). api/coach.js uses this to set or correct the NAVIGATE target,
// overriding a missing or mis-targeted model NAVIGATE on clearly
// feature-matched questions.
//
// Conservative by design. Matches are anchored on feature nouns (company,
// resume, LinkedIn, pitch, memorable, interview + a prep verb) so that
// discouragement/empathy turns and pure-advice questions — negotiation, a
// thank-you note, "is it worth continuing" — do not get a navigation button
// appended. Returns the FIRST match in priority order, so a message that
// mentions two features routes to the more specific one listed first.
//
// Cross-boundary import note: this file is imported by api/coach.js, so it must
// be `.js` (never `.mjs`); the Vercel function bundler does not reliably trace
// `.mjs` from api/* into src/* (the 2026-05-27 FUNCTION_INVOCATION_FAILED
// outage, PR #76).

// The step ids below MUST exist in the coach NAVIGATE table in api/coach.js.
export const ROUTE_STEP_IDS = ['p7', 'p_res', 'p8', 'p6', 'p3', 'focus']

export function detectFeatureNavigate(message) {
  if (!message || typeof message !== 'string') return null
  const m = message.toLowerCase()

  // p7 — Go-to-Market: finding/targeting/researching companies to reach out to,
  // or building a target-company list.
  if (
    /\b(go.?to.?market|target list|target compan|target-compan)\b/.test(m) ||
    /\b(niche|smaller|small)\s+compan/.test(m) ||
    /\b(find|finding|research|researching|build(ing)? a list|list of|target|targeting|reach(ing)? out to|prospect)\b[\s\S]{0,40}\bcompan(y|ies)\b/.test(m) ||
    /\bcompan(y|ies)\b[\s\S]{0,40}\b(target|targeting|reach(ing)? out|apply|applying|prospect|prospecting|pipeline)\b/.test(m)
  ) return 'p7'

  // p_res — Resume Refresh: anything about the user's resume/CV. (Never the
  // orientation "resume" upload step.)
  if (/\bresum[eé]s?\b|\bcv\b/.test(m)) return 'p_res'

  // p8 — LinkedIn Remix: anything about the user's LinkedIn profile/presence.
  if (/\blinked\s?in\b/.test(m)) return 'p8'

  // p6 — Your Bridge Story: "tell me about yourself", the pitch, positioning.
  if (/\btell me about yourself\b|\belevator pitch\b|\bmy pitch\b|\bpitch myself\b|\bintroduce myself\b|\bposition(ing)? myself\b/.test(m)) return 'p6'

  // p3 — Personal Brand: what makes me memorable/different, my through-line,
  // my strengths, who I am.
  if (/\bmemorable\b|\bwhat makes me (different|distinct|unique)\b|\bthrough.?line\b|\bpersonal brand\b|\bmy strengths\b|\bwho i am\b|\bstand out\b/.test(m)) return 'p3'

  // focus — Focus Playbook (Interview Prep): preparing or practicing for an
  // interview. Needs a prep/practice verb near "interview", so tactical
  // interview questions (a forgotten number, a thank-you note, a case
  // exercise) do not trigger it.
  if (
    /\b(prepare|prep|practice|practise|get ready|getting ready|rehears)\w*\b[\s\S]{0,30}\binterview\b/.test(m) ||
    /\binterview\b[\s\S]{0,30}\b(prep|prepare|practice|practise|rehears)\w*/.test(m)
  ) return 'focus'

  return null
}
