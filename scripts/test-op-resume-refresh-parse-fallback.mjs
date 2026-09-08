// Caught live during today's QA pass: building Resume Refresh inside a real
// Opportunity Playbook (Cart.com) returned genuinely truncated JSON from the
// model (no closing brace at all -- {"header": {"name": "Dana Whitfield",
// "city": with nothing after it). parseResumeJSON correctly returned null
// for that, but App.jsx's OPPORTUNITY-side renderer (_renderSection,
// distinct from the Focus Playbook's own p_res branch a few hundred lines
// earlier) had no fallback for a null parse -- it fell through to the
// generic <MD text={content}/> renderer and printed the raw, broken JSON as
// plain text with zero explanation. The Focus Playbook's sibling code
// already solved this exact problem with a friendly "didn't come together
// cleanly, regenerate" message; this fix applies the identical fallback to
// the Opportunity side.
//
// parseResumeJSON is not exported (App.jsx is JSX, unimportable by plain
// Node) -- pure re-derivation of its truncation-detection logic below,
// plus source-presence checks on the wiring in App.jsx.
import fs from 'node:fs'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

// --- Pure re-derivation: parseResumeJSON's first-brace-to-last-brace scan --

function parseResumeJSON(raw) {
  if (!raw || typeof raw !== 'string') return null
  let s = raw.trim()
  const fence = s.match(/^```(?:json)?\s*([\s\S]*?)```\s*$/)
  if (fence) s = fence[1].trim()
  const first = s.indexOf('{')
  const last = s.lastIndexOf('}')
  if (first === -1 || last === -1 || last < first) return null
  const candidate = s.slice(first, last + 1)
  try {
    const obj = JSON.parse(candidate)
    if (obj && typeof obj === 'object' && obj.header && (Array.isArray(obj.keyAccomplishments) || Array.isArray(obj.experience))) return obj
    return null
  } catch { return null }
}

const TRUNCATED = '{"header": {"name": "Dana Whitfield", "city":'
check(parseResumeJSON(TRUNCATED) === null,
  'parseResumeJSON did not return null for genuinely truncated content (no closing brace) -- the exact shape caught live today')
check(parseResumeJSON('') === null, 'parseResumeJSON did not treat an empty string as unparseable')
check(parseResumeJSON('not json at all') === null, 'parseResumeJSON did not reject non-JSON prose')

const VALID = JSON.stringify({ header: { name: 'Dana Whitfield', city: 'Columbus' }, keyAccomplishments: ['Cut missed-ship incidents in half'] })
check(!!parseResumeJSON(VALID), 'parseResumeJSON rejected a genuinely well-formed resume object -- the happy path must keep working')

// --- Source-presence: App.jsx's Opportunity-side _renderSection ------------

const APP = 'src/App.jsx'
const app = fs.readFileSync(APP, 'utf8')

const anchor = "const _renderSection=(key,content)=>{"
const anchorIdx = app.indexOf(anchor)
check(anchorIdx !== -1, `${APP}: the Opportunity Playbook's _renderSection function is missing or has drifted`)

// Bound the search window to this function's p_res branch specifically --
// from the anchor to the p11 branch that follows it -- so this cannot be
// satisfied by the unrelated Focus Playbook renderBody's own p_res branch
// (App.jsx:14791-14794), which already had this fallback before today.
const p11Idx = app.indexOf("if(key==='p11')return renderInterviewPrep(", anchorIdx)
check(p11Idx !== -1 && p11Idx > anchorIdx, `${APP}: could not bound _renderSection's p_res branch against its own p11 branch`)
const window = anchorIdx !== -1 && p11Idx !== -1 ? app.slice(anchorIdx, p11Idx) : ''

check(window.includes("const j=parseResumeJSON(content)"),
  `${APP}: _renderSection's p_res branch no longer parses the section content with parseResumeJSON`)
check(window.includes('<ResumeRefreshView resumeJson={j}'),
  `${APP}: a successful parse no longer renders through ResumeRefreshView`)
check(window.includes("The download didn't come together cleanly on this try."),
  `${APP}: the Opportunity Playbook's p_res branch has no fallback message for a failed parse -- this reintroduces today's bug (raw, broken JSON shown with zero explanation)`)
check(window.includes('Regenerate this section and it usually lands right the second time.'),
  `${APP}: the fallback no longer tells the user what to do next (regenerate)`)
check(window.includes('{content}'),
  `${APP}: the fallback no longer shows the raw content at all -- nothing should be silently hidden, same principle as the Focus Playbook's sibling fallback`)

// The two fallbacks (Focus Playbook's pre-existing one, and this PR's new
// Opportunity-side one) should read identically, so a person seeing either
// gets the same message regardless of which surface they were on.
const focusFallbackIdx = app.indexOf("The download didn't come together cleanly on this try.")
const opFallbackIdx = window ? anchorIdx + window.indexOf("The download didn't come together cleanly on this try.") : -1
check(focusFallbackIdx !== -1 && opFallbackIdx !== -1 && focusFallbackIdx !== opFallbackIdx,
  `${APP}: expected two distinct occurrences of the fallback message (Focus Playbook's existing one, and this PR's new Opportunity-side one) -- found only one, so the fix may not have landed in the right branch`)

if (failures) {
  console.error(`test-op-resume-refresh-parse-fallback: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-op-resume-refresh-parse-fallback: OK (parseResumeJSON correctly returns null on truncated/malformed content and parses well-formed resumes, and the Opportunity Playbook\'s _renderSection now shows the same friendly "didn\'t come together cleanly, regenerate" fallback as the Focus Playbook\'s sibling branch instead of silently rendering raw broken JSON)')
}
