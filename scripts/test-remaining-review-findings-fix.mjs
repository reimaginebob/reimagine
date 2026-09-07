// Guards the last four (lower-severity) findings from the 2026-09-07
// full-orientation-codebase review, shipped after PR #780, #781, and #782.
//
// 10. The Reputation screen reads profile.rep[f] unguarded. A persisted
//     profile_state missing `rep` entirely (legacy schema, partial seed,
//     externally-written row) would crash that screen on arrival. Lower
//     confidence, not reproduced live, but the same class of gap
//     normalizeWork already guards for `loc` and `corrections`.
//
// 11. Several interactive elements sat at 15px, one short of the 16px
//     tappable-element floor -- invisible to check-fontsize.mjs, which only
//     ratchets sub-15px values, not the interactive-specific 16px floor.
//
// 12. Two static copy passages evaded the voice gate's HARD_PATTERNS
//     (comparative-standing and slogan-cadence are appliesTo:['runtime']
//     only, so they never scan hardcoded UI strings) but read as the same
//     construction in spirit: a paired-declarative slogan cadence on the
//     orientation-done screen, and a comparative-standing-adjacent line on
//     the bare-input modal.
//
// 13. Priorities had no thinness floor/nudge at all, unlike every other
//     high-value orientation field (Resume, Assessment, Reputation, Life
//     Story, Values). Added the on-screen nudge only, matching the
//     established THIN_MIN/ThinNudge pattern -- a proactive hub-arrival
//     chat prompt (the treatment Values/Life Story also got) is deliberately
//     out of scope here pending a product call, since Priorities is the one
//     orientation screen whose own copy already frames every field as
//     optional ("skip anything that doesn't apply").
import fs from 'node:fs'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

const APP = 'src/App.jsx'
const app = fs.readFileSync(APP, 'utf8')

// Fix 10: normalizeWork guards `rep` the same way it guards `loc`/`corrections`.
const normIdx = app.indexOf('const normalizeWork = (p) => {')
check(normIdx !== -1, `${APP}: could not find normalizeWork`)
const normBlock = normIdx !== -1 ? app.slice(normIdx, normIdx + 1800) : ''
check(normBlock.includes("if (!next.rep || typeof next.rep !== 'object') {"),
  `${APP}: normalizeWork no longer guards a missing/malformed profile.rep -- the Reputation screen's unguarded profile.rep[f] read could still crash on a legacy profile`)
check(normBlock.includes("next = { ...next, rep: { memory: '', emergency: '', twoWords: '', other: '' } }"),
  `${APP}: normalizeWork's rep guard no longer backfills the four expected subfields`)

// Fix 11: the six named interactive elements now meet the 16px floor.
check(app.includes("style={{background:'none',border:'none',cursor:'pointer',fontSize:16,color:C.gray,padding:0,marginLeft:2,lineHeight:1,fontFamily:'inherit'}} aria-label={`Remove ${s}`}"),
  `${APP}: the orientation Skills screen's chip-remove button is still below the 16px tappable floor`)
check(app.includes("<button type=\"button\" onClick={()=>removeSkill(gi,ii)} style={{background:'none',border:'none',color:C.gray,cursor:'pointer',fontSize:16,lineHeight:1}}>×</button>"),
  `${APP}: the Resume Builder's skill-chip remove button is still below the 16px tappable floor`)
const removeFromListHits = (app.match(/color:C\.gray,cursor:'pointer',fontSize:16,padding:'2px 6px',fontFamily:'inherit'\}\} aria-label=\{`Remove \$\{name\} from list`\}/g) || []).length
check(removeFromListHits === 2,
  `${APP}: expected both the Assessment and Reputation "remove from list" buttons at the 16px floor -- found ${removeFromListHits}`)
check(app.includes("Or start fresh (delete everything and begin again)</button>}") && app.includes("padding:'4px 0',fontSize:16,cursor:'pointer',fontFamily:'inherit',textDecoration:'underline'}}>Or start fresh"),
  `${APP}: the "Or start fresh" destructive account-delete button is still below the 16px tappable floor`)
check(app.includes("borderRadius:6,padding:'6px 12px',fontSize:16,cursor:'pointer',fontFamily:'inherit',marginLeft:8}}>Start Fresh</button>"),
  `${APP}: the "Start Fresh" destructive account-delete button is still below the 16px tappable floor`)

// Fix 12: the two copy passages no longer read as the banned constructions
// they were evading, and the old text is gone (not duplicated).
check(!app.includes("That's the input. Everything that follows is the output"),
  `${APP}: the orientation-done screen still carries the paired-declarative slogan cadence ("That's the input. Everything that follows is the output.")`)
check(app.includes("Everything that follows takes that and builds your story, your strategy, your next chapter."),
  `${APP}: the orientation-done screen's replacement copy is missing or changed`)
check(!app.includes('The users who get the most from Reimagine'),
  `${APP}: the bare-input modal still opens with the comparative-standing-adjacent "The users who get the most from Reimagine..." line`)
check(app.includes('Reimagine works best with your whole self:'),
  `${APP}: the bare-input modal's replacement copy is missing or changed`)

// Fix 13: Priorities gets the on-screen thinness nudge, matching the
// established THIN_MIN/ThinNudge pattern used by every other high-value field.
check(app.includes('const THIN_MIN={resume:60,assess:25,life:12,rep:12,values:12,priorities:12}'),
  `${APP}: THIN_MIN is missing a priorities entry`)
check(app.includes("{wc([profile.compFloor,profile.workReq,profile.dealBreakers].filter(Boolean).join(' '))<THIN_MIN.priorities&&<ThinNudge text=\"The clearer these are, the more precisely Reimagine can judge whether an opportunity is actually worth pursuing, not just whether it looks good on paper.\"/>}"),
  `${APP}: the Priorities screen is missing its on-screen thinness nudge`)
// Deliberately NOT present: this fix does not add a hub-arrival chat prompt
// for Priorities (that is a product call, not a mechanical bug fix) -- pin
// its absence so a future edit does not assume it shipped here.
check(!app.includes('priorities-thin-hub') && !app.includes('prioritiesThinPromptMessage') && !app.includes('seenPrioritiesThinHub'),
  `${APP}: a Priorities hub-arrival chat prompt appears to have been added -- this was deliberately scoped out of the on-screen-nudge-only fix; if intentional, update this test`)

if (failures) {
  console.error(`test-remaining-review-findings-fix: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-remaining-review-findings-fix: OK (normalizeWork guards a missing profile.rep, six interactive elements meet the 16px floor, two copy passages no longer read as banned constructions in spirit, Priorities gets the on-screen thinness nudge)')
}
