// Guards resolveGuideBlock (src/coach-guide-resolver.js) -- the function
// that decides how much of the user guide My Coach actually sends on a
// given turn. Runs after build-user-guide.mjs in the prebuild chain, so
// USER_GUIDE_UNITS is freshly generated.
//
// Imported directly, unlike api/coach.js's own tests (which are all
// source-level string checks): this module has no eager DB/Resend client
// construction, so importing it carries none of the risk that keeps the
// rest of the Coach test family at the source-code level.
import { resolveGuideBlock } from '../src/coach-guide-resolver.js'
import { USER_GUIDE_CONTENT, USER_GUIDE_UNITS } from '../src/data/user-guide-content.js'
import { ALWAYS_ON_UNITS } from '../src/data/guide-step-relevance.js'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

// Fallback surfaces get the full, unnarrowed guide -- myCoach is the
// general chat surface, and an unrecognized/missing currentStep must fail
// open rather than send nothing.
check(resolveGuideBlock('myCoach') === USER_GUIDE_CONTENT,
  'resolveGuideBlock("myCoach") does not return the full USER_GUIDE_CONTENT')
check(resolveGuideBlock(undefined) === USER_GUIDE_CONTENT,
  'resolveGuideBlock(undefined) does not fail open to the full guide')
check(resolveGuideBlock('a-step-that-does-not-exist') === USER_GUIDE_CONTENT,
  'resolveGuideBlock of an unrecognized step does not fail open to the full guide -- a step falling through the cracks would silently send nothing instead')

// A mapped step gets a real subset, strictly smaller than the whole guide,
// and it must actually be narrowed, not the fallback in disguise.
const opBlock = resolveGuideBlock('op')
check(opBlock.length > 0 && opBlock.length < USER_GUIDE_CONTENT.length,
  `resolveGuideBlock("op") is ${opBlock.length} chars -- expected something real but strictly smaller than the full guide's ${USER_GUIDE_CONTENT.length}`)
check(opBlock.includes(USER_GUIDE_UNITS['add-an-opportunity.md']),
  'resolveGuideBlock("op") does not include the add-an-opportunity.md chapter it is directly mapped to')

// Every always-on unit must be present on every non-fallback turn.
for (const key of ALWAYS_ON_UNITS) {
  check(opBlock.includes(USER_GUIDE_UNITS[key]),
    `resolveGuideBlock("op") is missing always-on unit "${key}"`)
}

// A step whose content lives in a focus-playbook split unit gets exactly
// that unit (plus the preamble it doesn't get, since p11 isn't a routing
// step) -- not the unsplit whole chapter, and not another section's slice.
const p11Block = resolveGuideBlock('p11')
check(p11Block.includes(USER_GUIDE_UNITS['focus-playbook:interviewPrep']),
  'resolveGuideBlock("p11") is missing its own focus-playbook:interviewPrep unit')
check(!p11Block.includes(USER_GUIDE_UNITS['focus-playbook:resumeRefresh']),
  'resolveGuideBlock("p11") leaked the Resume Refresh section it has no business including')
check(!p11Block.includes(USER_GUIDE_UNITS['focus-playbook:preamble']),
  'resolveGuideBlock("p11") included the routing-only focus-playbook preamble')

// The routing preamble shows up only for routing steps.
const laneSelectBlock = resolveGuideBlock('laneSelect')
check(laneSelectBlock.includes(USER_GUIDE_UNITS['focus-playbook:preamble']),
  'resolveGuideBlock("laneSelect") is missing the focus-playbook preamble a routing step should carry')

// Two different mapped steps in the same lane produce different content --
// narrowing is actually doing something, not just always returning the
// same reduced block regardless of step.
const p6Block = resolveGuideBlock('p6')
check(p6Block !== p11Block, 'resolveGuideBlock("p6") and resolveGuideBlock("p11") returned identical content -- narrowing is not actually varying by step')

if (failures) {
  console.error(`test-coach-guide-resolver: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-coach-guide-resolver: OK (fallback fails open, mapped steps narrow correctly, always-on units present, focus-playbook units isolated per step)')
}
