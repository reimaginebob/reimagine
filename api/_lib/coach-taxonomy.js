// Single source of truth for the My Coach question-insight taxonomy.
//
// Imported by BOTH api/admin/classify-coach.js (the nightly classifier that
// writes coach_message_tags) and api/admin/coach-insights.js (the admin read
// endpoint) so the version, the category set, and the attribute keys cannot
// drift between writer and reader. Plain `.js` (no JSX) so the Vercel function
// bundler traces it across api/* — never `.mjs` (the 2026-05-27 outage).
//
// Bump TAXONOMY_VERSION when the categories below change in a way that should
// re-tag history: the classifier tags any row lacking a coach_message_tags row
// at the CURRENT version, so a bump makes every historical message eligible for
// re-tagging on the next nightly run. Old-version rows are left in place (so two
// versions can be compared side by side); the endpoint reads the current version.

export const TAXONOMY_VERSION = 1

// Ordered field -> allowed values. The endpoint builds one distribution per key
// over these values; the classifier is constrained to them (or null) by the
// JSON schema below. Categorical ONLY — never an open-text or identifying value.
export const CATEGORIES = {
  topic: [
    'Direction & pivots', 'Resume', 'LinkedIn & profile', 'Networking & outreach',
    'Interviewing', 'Salary & negotiation', 'Applications & ATS', 'Cover letters',
    'Offer evaluation', 'Personal brand & positioning', 'Mindset & confidence',
    'Search strategy & logistics', 'Ageism & bias concerns', 'Using Reimagine (tool how-to)',
    'Industry/role-specific', 'Other',
  ],
  register: ['how-to', 'decision-support', 'emotional-support', 'reassurance', 'tool-navigation'],
  intent: ['informational', 'evaluative', 'generative', 'diagnostic', 'navigational'],
  stage: [
    'exploring-direction', 'preparing-materials', 'actively-applying', 'interviewing',
    'negotiating-closing', 'post-setback-regroup', 'employed-and-looking', 'unclear',
  ],
  specificity: ['generic', 'personalized'],
  tone: ['discouraged', 'anxious', 'neutral', 'motivated'],
  framework: ['KEEL', 'four-Cs', 'five-Ps', 'SCOPE', 'STAR', 'Covey', 'Frankl', 'none'],
  need_type: ['served-by-feature', 'coaching-only', 'product-gap'],
}

export const ATTRIBUTE_KEYS = Object.keys(CATEGORIES)

// JSON schema for the model's structured output. Every field is nullable so the
// model can decline ("allow null/unclear over a forced fit"). additionalProperties
// is false and all keys are required (the value may be null) per structured-output
// rules. Order of properties mirrors CATEGORIES.
export const TAG_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ATTRIBUTE_KEYS,
  properties: Object.fromEntries(
    ATTRIBUTE_KEYS.map(k => [k, { type: ['string', 'null'], enum: [...CATEGORIES[k], null] }])
  ),
}

// The classifier system prompt. Stable (no per-row interpolation) so it is sent
// as the cached prefix; the per-row question goes in the user turn after it.
// The category list is rendered verbatim from CATEGORIES so the prompt and the
// schema never disagree.
function renderCategories() {
  return ATTRIBUTE_KEYS.map(k => `- ${k}: ${CATEGORIES[k].join(' | ')}`).join('\n')
}

export const CLASSIFIER_SYSTEM = `You classify a single question a user asked an AI career coach inside Reimagine, a career-strategy tool. You are given ONLY the user's question (plus, as light context, the app step they were on and their chosen career lane). You are NOT given the coach's reply, and you must not speculate about it.

Assign exactly one value per category from the lists below, or null when the question does not clearly fit any value. Prefer null over forcing a fit.

CATEGORIES (choose one allowed value per field, or null):
${renderCategories()}

HARD RULES:
- Categorical only. Output only the allowed enum values (or null). Never invent a value.
- Never extract or echo identifying detail of any kind — no employer names, person names, job titles tied to a real employer, locations, or specifics like "laid off from <company>". You are bucketing the question, not summarizing it. The output carries no free text.
- Judge the question as written. Do not infer beyond what the user said. When unsure, use null (or the explicit 'unclear'/'none'/'Other' value where the field provides one).
- 'specificity' is 'personalized' only when the question references the user's own situation/materials; a generic how-to question is 'generic'.
- 'need_type': 'served-by-feature' if Reimagine has a feature that addresses this; 'coaching-only' if it is judgment/encouragement with no feature; 'product-gap' if it is a real need Reimagine does not serve.`
