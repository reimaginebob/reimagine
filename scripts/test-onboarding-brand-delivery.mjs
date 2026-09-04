// Guards the Personal Brand delivery presence moment (Coach-as-Concierge,
// item 1, slice 3): Coach shows up on the p3 screen the first time a
// flagged account has a built brand, and takes over the existing "does this
// capture you?" check-in's job at twoDoors rather than letting both fire two
// screens apart. Source-level for the same reason its siblings are.
import fs from 'node:fs'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

const APP = 'src/App.jsx'
const app = fs.readFileSync(APP, 'utf8')

check(/const\[seenBrandDeliveryMoment,setSeenBrandDeliveryMoment\]=useState\(false\)/.test(app),
  `${APP}: seenBrandDeliveryMoment useState declaration is missing`)

// The trigger: p3 arrival, brand actually present, not mid-generation, once
// ever for this account.
check(/if\(step!=='p3'\|\|loading\)return/.test(app),
  `${APP}: the brand-delivery effect no longer guards on step==='p3' && !loading`)
check(/if\(seenBrandDeliveryMoment\|\|brandDeliveryFiredRef\.current\)return/.test(app),
  `${APP}: the brand-delivery effect lost its dedupe guard (flag + session ref)`)

// The suppression mechanism: this effect must mark seenPbCheckin /
// pbCheckinFiredRef satisfied itself, rather than the existing twoDoors
// check-in effect being modified to know about this one. Verifying the
// existing effect is UNTOUCHED (still fires on its own original condition)
// is what proves the two never collide without adding a dependency between
// them.
const brandDeliveryIdx = app.indexOf("if(step!=='p3'||loading)return")
const brandDeliveryBlock = app.slice(brandDeliveryIdx, brandDeliveryIdx + 400)
check(brandDeliveryBlock.includes('pbCheckinFiredRef.current=true') && brandDeliveryBlock.includes('setSeenPbCheckin(true)'),
  `${APP}: the brand-delivery effect no longer marks the existing Personal Brand check-in satisfied -- both would fire back to back at p3 and twoDoors`)

const pbCheckinIdx = app.indexOf("if(step!=='twoDoors'||!signedInUser)return")
check(pbCheckinIdx !== -1, `${APP}: could not find the existing Personal Brand check-in effect to verify it is untouched`)
const pbCheckinBlock = app.slice(pbCheckinIdx, pbCheckinIdx + 300)
check(pbCheckinBlock.includes('if(seenPbCheckin||pbCheckinFiredRef.current)return'),
  `${APP}: the existing Personal Brand check-in's own guard changed shape -- the suppression relies on it reading seenPbCheckin exactly as before`)

// Dedupe threading: both hydration paths and the autosave blob.
const hydrationHits = (app.match(/if\(d\.seenBrandDeliveryMoment\)setSeenBrandDeliveryMoment\(true\)/g) || []).length
check(hydrationHits === 2,
  `${APP}: expected seenBrandDeliveryMoment hydration in both the local pe_v4 path and the server profile/load path -- found ${hydrationHits}`)
const saveBlobIdx = app.indexOf('const blob=JSON.stringify(')
check(app.slice(saveBlobIdx, saveBlobIdx + 400).includes('seenBrandDeliveryMoment'),
  `${APP}: seenBrandDeliveryMoment is missing from the autosave blob's JSON.stringify -- the dedupe would never actually persist`)
const saveDepsIdx = app.indexOf('saveRef.current=save')
check(app.slice(saveDepsIdx, saveDepsIdx + 500).includes('seenBrandDeliveryMoment'),
  `${APP}: seenBrandDeliveryMoment is missing from the autosave effect's dependency array`)

if (failures) {
  console.error(`test-onboarding-brand-delivery: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-onboarding-brand-delivery: OK (trigger correctly gated, existing PB check-in untouched but pre-satisfied to prevent a back-to-back duplicate, dedupe threaded through both hydration paths and the autosave blob)')
}
