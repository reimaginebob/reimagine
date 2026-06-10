// Unit tests for deterministic My Coach feature-routing (src/coach-routing.js).
// Run by `npm test` (added to the test chain) and the prebuild gate.
import { detectFeatureNavigate, ROUTE_STEP_IDS } from '../src/coach-routing.js'

let pass = 0
let fail = 0
function check(message, expected) {
  const got = detectFeatureNavigate(message)
  if (got === expected) {
    pass++
  } else {
    fail++
    console.error(`FAIL: ${JSON.stringify(message)}\n   expected ${expected}, got ${got}`)
  }
}

// --- Feature matches (should route) ---
check('I want to target smaller, niche companies, not the big names. How do I find them?', 'p7')
check('How do I build a list of target companies to reach out to?', 'p7')
check('I need to find companies in my space that are hiring.', 'p7')
check('My only contacts at a company I am targeting are at my own level.', 'p7')

check('Can you help me fix my resume? It is not landing interviews.', 'p_res')
check('Is a two-column resume going to get me screened out by the ATS?', 'p_res')
check('Should I put a number on every bullet on my resume?', 'p_res')
check('I have spent months on resume writers and still cannot get past the ATS.', 'p_res')

check('How should I improve my LinkedIn profile?', 'p8')
check('Should I post about things I believe in on LinkedIn?', 'p8')

check('I struggle with the tell me about yourself question. How should I answer it?', 'p6')
check('How do I sharpen my elevator pitch?', 'p6')

check('A lot of people can claim the same skills I have. How do I find the thing that makes me memorable?', 'p3')
check('How do I make myself stand out from other candidates?', 'p3')

check('I have an interview next week. How should I prepare?', 'focus')
check('How do I practice for an AI pre-screen interview?', 'focus')

// --- Negatives (must NOT route: empathy, discouragement, pure-advice) ---
check('HR came back with a lowball number over email. Who do I actually negotiate with, and how?', null)
check('Some days I wonder if it is even worth continuing.', null)
check("What's the right way to follow up after a first interview so they actually remember me?", null)
check('I cannot remember the exact number from a project years ago. What do I say in the interview?', null)
check('They want me to build a 360 marketing plan and present it to the CEO as part of interviewing.', null)
check("I've burned through my whole network already. I don't know who else to reach out to.", null)
check('Tough few days. I just got rejected after seven rounds of interviewing.', null)
check('Tough few days. I just got rejected after two and a half months and seven rounds of interviewing with one company.', null)
check('I am more confident than I have ever been, which feels insane because I am still out of work.', null)
check('How do I show I can learn fast when the tools in my field change every few months?', null)
check('', null)
check(null, null)

// --- Every routable id is real (exists in the coach NAVIGATE table) ---
const VALID = new Set(['p7', 'p_res', 'p8', 'p6', 'p3', 'focus'])
for (const id of ROUTE_STEP_IDS) {
  if (!VALID.has(id)) { fail++; console.error(`FAIL: ROUTE_STEP_IDS has unknown id ${id}`) }
}

console.log(`coach-routing tests: ${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
