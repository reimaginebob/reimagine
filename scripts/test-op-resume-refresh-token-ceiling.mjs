// Root cause of the Resume Refresh truncation this same QA pass already
// patched the symptom of (scripts/test-op-resume-refresh-parse-fallback.mjs):
// production runtime logs for the exact live call showed
//   {"evt":"claude_truncated","step":"p_res","maxTokens":6000,"hasText":true}
//   {"evt":"claude_usage","step":"p_res","usage":{"output_tokens":6000,
//     "output_tokens_details":{"thinking_tokens":5973}}}
// -- 5,973 of the 6,000-token ceiling went to thinking alone, leaving ~27
// tokens for the actual resume JSON. Same failure class documented in the
// comment directly above this option object for Interview Prep ("stopped
// exactly on 8000 five times in a row"), which is why p11/clientPlay
// already sit at maxTokens:16000. This fix joins p_res to that same
// ceiling in generateOpSection specifically -- the Opportunity Playbook
// path, where this was caught live. The Focus Playbook's own, separate
// p_res call site (App.jsx's `go` function, a different code path for the
// Career Paths flow) is NOT touched by this fix and carries the identical
// theoretical risk -- flagged for the batch, not in scope for this urgent
// fix, which is scoped to the path actually observed failing.
//
// Source-presence only: generateOpSection is not exported (App.jsx is JSX,
// unimportable by plain Node) and the options object is a single inline
// expression with no pure logic to re-derive.
import fs from 'node:fs'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

const APP = 'src/App.jsx'
const app = fs.readFileSync(APP, 'utf8')

check(app.includes("const opts={...(key==='p11'||key==='clientPlay'||key==='p_res'?{maxTokens:16000}:key==='clientRead'?{maxTokens:6000,effort:'low'}:{maxTokens:5000}),profileBlock:buildUserProfileBlock(pc,opOuts),step:key}"),
  `${APP}: generateOpSection's options object no longer gives p_res the 16000-token ceiling -- this reintroduces the truncation caught live (5,973 of 6,000 tokens spent on thinking alone, ~27 left for the actual resume JSON)`)

// Guards against a future edit accidentally dropping p_res back to the
// low-ceiling branch while leaving the high-ceiling branch's condition
// looking superficially unchanged (e.g. a find-and-replace that touches
// the branch body but not its condition).
const optsIdx = app.indexOf("const opts={...(key==='p11'")
check(optsIdx !== -1, `${APP}: could not locate generateOpSection's options object at all`)
if (optsIdx !== -1) {
  const line = app.slice(optsIdx, app.indexOf('\n', optsIdx))
  const highCeilingBranch = line.match(/key==='p11'\|\|key==='clientPlay'(\|\|key==='p_res')?\?\{maxTokens:16000\}/)
  check(!!highCeilingBranch, `${APP}: the 16000-token branch's condition has drifted in an unexpected shape`)
  check(!!(highCeilingBranch && highCeilingBranch[1]), `${APP}: p_res is not part of the 16000-token branch's condition`)
}

if (failures) {
  console.error(`test-op-resume-refresh-token-ceiling: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-op-resume-refresh-token-ceiling: OK (the Opportunity Playbook\'s p_res generation now shares p11/clientPlay\'s 16000-token ceiling instead of the 5000/6000-token one that left ~27 tokens for the actual resume JSON after thinking consumed the rest)')
}
