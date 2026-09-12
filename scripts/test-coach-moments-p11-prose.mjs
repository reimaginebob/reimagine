// Production fix, 2026-09-12 (follow-up to the concierge moment engine
// audit's PR 3, #902): on main at b5c7a16, adding an opportunity, letting
// auto-build finish, setting a stage, then building Interview Prep by hand
// (on an account WITH a resume on file, unlike #902's empty-resume crash)
// produced a /api/coach POST that stayed pending for 3+ minutes with no
// console error and nothing ever rendering.
//
// Investigation: momentPayloadOk (api/coach.js) accepts the turn fine (m.text
// is a non-empty string), so the request reaches generate()'s fetch to
// https://api.anthropic.com/v1/messages, which carries no timeout/
// AbortController -- whatever the model does, the client just waits. What
// api/coach.js's buildFocusDeliveryReactionText actually sends as "here is
// what was built" is `clip(text)`, and `text` (src/coach-moments.js's
// delivery-p11/delivery-op-p11 momentContext, BEFORE this fix) was the raw
// p11 JSON -- one of the three whole-response-JSON steps (JSON_ONLY_STEPS,
// api/claude.js), the same wrapped-object shape p6 already has its own fix
// for (bridgeStoryToProse). A realistic 8-10 question STAR breakdown runs
// well past clip()'s 4000-char limit, so the model was handed a JSON
// document truncated mid-brace and asked to react to it as prose -- exactly
// the kind of malformed input that could send an adaptive-thinking model
// into an unusually long, confused generation with no other symptom (no
// parse error, no thrown exception -- momentPayloadOk only checks that text
// is a non-empty string, never that it's well-formed or reasonable to react
// to).
//
// Cover Letter and Resume Refresh (PR #902's own test) were not hit because
// their JSON is much smaller and simpler; p11's is the one JSON_ONLY_STEPS
// output large and structured enough (an id/question/type/framework_thread/
// seat_id per question, four STAR sections each carrying raw_material +
// relevance_bridge_draft + to_strengthen, for up to 14 questions) to
// realistically exceed clip()'s ceiling and arrive mid-structure.
//
// Fix: delivery-p11 and delivery-op-p11 now build `text` (and dedupeValue)
// from interviewPrepToProse(...) -- the same established, already-shipped
// prose-flattening function the op PDF export already uses for this exact
// content -- instead of the raw JSON, exactly mirroring delivery-p6's own
// bridgeStoryToProse fix for its sibling wrapped-object shape. Prose is
// compact and safe to clip() mid-sentence; raw JSON is not safe to clip()
// mid-brace.
//
// This file: (1) confirms the wiring fix is actually in place (source
// presence -- reverting it is how this test would have caught the bug
// before it shipped), and (2) re-derives interviewPrepToProse and its
// parser dependencies (App.jsx is not built for import; same reasoning as
// test-claude-json-retry.mjs for api/claude.js) to prove, against a
// realistic large multi-question STAR fixture, that the prose it produces
// is well-formed and dramatically smaller than clip()'s 4000-char ceiling,
// while the raw JSON for the same content is not.
import fs from 'node:fs'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

const MOMENTS = 'src/coach-moments.js'
const moments = fs.readFileSync(MOMENTS, 'utf8')

// --- Wiring: both p11 Delivery entries build text/dedupeValue from prose ---
check(moments.includes("dedupeValue: (ctx) => ctx.interviewPrepToProse(ctx.outputs.p11),\n    momentContext: (ctx) => ({ section: 'p11', sectionLabel: ctx.focusLabelFor('p11', ctx.isIndependent), text: ctx.interviewPrepToProse(ctx.outputs.p11) }),"),
  `${MOMENTS}: delivery-p11 no longer builds its dedupeValue/text from interviewPrepToProse(ctx.outputs.p11) -- it would send the raw, un-clip()-safe JSON to Coach's Delivery prompt again`)
check(moments.includes("dedupeValue: (ctx) => ctx.interviewPrepToProse(ctx.opRecord.cardText('p11')),\n    momentContext: (ctx) => ({ section: 'p11', sectionLabel: ctx.opRecord.cardLabel('p11'), text: ctx.interviewPrepToProse(ctx.opRecord.cardText('p11')) }),"),
  `${MOMENTS}: delivery-op-p11 no longer builds its dedupeValue/text from interviewPrepToProse(ctx.opRecord.cardText('p11')) -- it would send the raw, un-clip()-safe JSON to Coach's Delivery prompt again`)

const APP = 'src/App.jsx'
const app = fs.readFileSync(APP, 'utf8')
check(app.includes('bridgeStoryToProse,interviewPrepToProse,markDone'),
  `${APP}: the Moments evaluator's ctx no longer carries interviewPrepToProse through to catalog entries`)

// --- Pure re-derivation of interviewPrepToProse + its parser dependencies,
// exact copies from src/App.jsx (not built for import), same approach
// test-claude-json-retry.mjs uses for api/claude.js's own helpers. ---
const _mangleJsonKey = k => k.replace(/_([^_]+)_/g, '$1')
function repairMangledJsonKeys(str, canonicalKeys) {
  let out = str
  for (const k of canonicalKeys) {
    const m = _mangleJsonKey(k)
    if (m === k) continue
    out = out.replace(new RegExp('"' + m + '"(?=\\s*:)', 'g'), '"' + k + '"')
  }
  return out
}
const P11_JSON_KEYS = ['relevance_bridge_draft', 'questions_to_ask']
function parseInterviewPrepJSON(raw) {
  if (!raw || typeof raw !== 'string') return null
  let s = raw.trim()
  const fence = s.match(/^```(?:json)?\s*([\s\S]*?)```\s*$/)
  if (fence) s = fence[1].trim()
  const first = s.indexOf('{')
  const last = s.lastIndexOf('}')
  if (first === -1 || last === -1 || last < first) return null
  const candidate = repairMangledJsonKeys(s.slice(first, last + 1), P11_JSON_KEYS)
  let obj
  try { obj = JSON.parse(candidate) } catch { return null }
  if (!obj || typeof obj !== 'object') return null
  if (Array.isArray(obj.people)) {
    const ok = v => typeof v === 'string' && v.trim().length > 0
    for (const p of obj.people) {
      if (!p || typeof p !== 'object') return null
      if (!ok(p.name) && !ok(p.title) && !ok(p.role)) return null
      if (!Array.isArray(p.questions)) return null
      if (p.stories !== undefined && !Array.isArray(p.stories)) return null
      if (p.questions_to_ask !== undefined && !Array.isArray(p.questions_to_ask)) return null
    }
    return obj
  }
  const rc = obj.role_context
  if (!rc || typeof rc !== 'object' || typeof rc.target_role !== 'string' || !rc.target_role.trim()) return null
  const qs = obj.questions
  if (obj.panel !== undefined && !Array.isArray(obj.panel)) return null
  const maxQ = (Array.isArray(obj.panel) && obj.panel.length) ? (6 * obj.panel.length + 4) : 14
  if (!Array.isArray(qs) || qs.length < 3 || qs.length > maxQ) return null
  const okStr = v => typeof v === 'string' && v.trim().length > 0
  const okStarSec = x => x && typeof x === 'object' && okStr(x.raw_material) && okStr(x.to_strengthen)
  for (const q of qs) {
    if (!q || typeof q !== 'object') return null
    if (!okStr(q.id) || !okStr(q.question)) return null
    if (q.type !== 'behavioral' && q.type !== 'non_behavioral') return null
    if (!(q.framework_thread === null || typeof q.framework_thread === 'string')) return null
    if (!(q.seat_id === undefined || q.seat_id === null || typeof q.seat_id === 'string')) return null
    if (q.type === 'behavioral') {
      const sb = q.star_breakdown
      if (!sb || typeof sb !== 'object') return null
      if (!sb.S || typeof sb.S !== 'object' || !okStr(sb.S.raw_material) || !okStr(sb.S.relevance_bridge_draft) || !okStr(sb.S.to_strengthen)) return null
      if (!okStarSec(sb.T) || !okStarSec(sb.A) || !okStarSec(sb.R)) return null
    } else {
      if (!okStr(q.framing_recommendation)) return null
    }
  }
  return obj
}
function interviewPrepToProse(content) {
  const ip = parseInterviewPrepJSON(content)
  if (!ip) return ''
  if (Array.isArray(ip.people)) {
    return ip.people.map(p => {
      let x = `${(p.name && p.name.trim()) || p.role || 'Interviewer'}${p.title ? ', ' + p.title : ''}${p.role ? ' (' + p.role + ')' : ''}`
      if (p.looking_for) x += '\n   Looking for: ' + p.looking_for
      if (Array.isArray(p.questions) && p.questions.length) x += '\n   Likely questions:\n' + p.questions.map(q => '   - ' + q).join('\n')
      if (Array.isArray(p.stories) && p.stories.length) x += '\n   Stories to use:\n' + p.stories.map(s => '   - ' + ((s && s.story) || '') + ((s && s.why) ? ' (' + s.why + ')' : '')).join('\n')
      if (Array.isArray(p.questions_to_ask) && p.questions_to_ask.length) x += '\n   Questions to ask:\n' + p.questions_to_ask.map(q => '   - ' + q).join('\n')
      return x
    }).join('\n\n')
  }
  return ip.questions.map((q, i) => {
    let x = (i + 1) + '. ' + q.question
    if (q.type === 'behavioral' && q.star_breakdown) {
      ['S', 'T', 'A', 'R'].forEach(kk => {
        const y = q.star_breakdown[kk]
        if (y && y.raw_material) x += '\n   ' + kk + ': ' + y.raw_material
      })
    } else if (q.framing_recommendation) {
      x += '\n   ' + q.framing_recommendation
    }
    return x
  }).join('\n\n')
}

// --- Realistic fixture: 10 behavioral questions, each with a full STAR
// breakdown (id/question/type/framework_thread/seat_id + S/T/A/R, each
// section carrying raw_material/relevance_bridge_draft/to_strengthen) --
// the actual shape the real prompt asks for and the real parser requires,
// not a toy 1-question stub. This is deliberately large enough to
// reproduce the clip()-truncation risk. ---
function starSection(label) {
  return {
    raw_material: `${label} raw material drawn from the resume and orientation notes, written out in enough detail that a STAR answer could be built from it directly without further digging.`,
    relevance_bridge_draft: `${label} relevance bridge explaining why this moment matters for the target role, connecting the specific evidence to what the interviewer is actually listening for.`,
    to_strengthen: `${label} coaching note on what would make this section land harder in the room.`,
  }
}
const bigP11Json = JSON.stringify({
  role_context: { target_role: 'Director of Logistics' },
  questions: Array.from({ length: 10 }, (_, i) => ({
    id: `q${i + 1}`,
    question: `Tell me about a time you handled carrier contract renegotiation under pressure, scenario ${i + 1}.`,
    type: 'behavioral',
    framework_thread: null,
    seat_id: null,
    star_breakdown: {
      S: { raw_material: starSection('Situation').raw_material, relevance_bridge_draft: starSection('Situation').relevance_bridge_draft, to_strengthen: starSection('Situation').to_strengthen },
      T: starSection('Task'),
      A: starSection('Action'),
      R: starSection('Result'),
    },
  })),
})

check(bigP11Json.length > 4000,
  `the realistic 10-question fixture must actually exceed clip()'s 4000-char ceiling to prove the bug's mechanism (got ${bigP11Json.length} chars)`)

const clippedRaw = bigP11Json.length > 4000 ? bigP11Json.slice(0, 4000) + '…' : bigP11Json
let clippedRawParses = true
try { JSON.parse(clippedRaw.replace(/…$/, '')) } catch { clippedRawParses = false }
check(!clippedRawParses,
  'clip()-truncating the raw JSON at 4000 chars produces an invalid, mid-brace JSON fragment -- confirming this is genuinely unsafe to hand the model as "here is what was built" (this is the bug this fix avoids, not something the fix needs to tolerate)')

const prose = interviewPrepToProse(bigP11Json)
check(typeof prose === 'string' && prose.trim().length > 0,
  'interviewPrepToProse produces non-empty prose for a realistic, full-size Interview Prep JSON document')
check(prose.length < bigP11Json.length,
  `the prose form is more compact than the raw JSON it replaces (prose ${prose.length} chars vs raw ${bigP11Json.length} chars) -- clip() truncating THIS is safe, unlike the raw JSON`)
check(prose.includes('1. Tell me about a time you handled carrier contract renegotiation under pressure, scenario 1.'),
  `the prose numbers and quotes the actual question text (got: ${JSON.stringify(prose.slice(0, 120))})`)
check(/S: Situation raw material/.test(prose),
  'the prose carries the STAR raw_material for each section, not just the bare question list')
check(!/role_context|star_breakdown|relevance_bridge_draft/.test(prose),
  'the prose contains no raw JSON key names -- it reads as prose, not a flattened object dump')

// --- Malformed/edge-case safety: interviewPrepToProse must never throw,
// matching the established sibling contract (bridgeStoryToProse). ---
check(interviewPrepToProse('') === '', 'interviewPrepToProse returns empty string, not a throw, for empty content')
check(interviewPrepToProse('not json at all') === '', 'interviewPrepToProse returns empty string, not a throw, for non-JSON garbage')
check(interviewPrepToProse(bigP11Json.slice(0, 4000)) === '', 'interviewPrepToProse returns empty string, not a throw, for a truncated/broken JSON fragment (the exact shape clip() used to hand the model)')

if (failures) {
  console.error(`test-coach-moments-p11-prose: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-coach-moments-p11-prose: OK (delivery-p11/delivery-op-p11 now send Coach a compact, readable prose reaction to Interview Prep instead of raw, clip()-unsafe JSON that could truncate mid-structure)')
}
