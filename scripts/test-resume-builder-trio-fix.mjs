// Guards three related Resume Builder bugs from the 2026-09-07
// full-orientation-codebase review (findings #5, #6, #7), fixed after
// PR #780 (Build-brand race, framing line) and PR #781 (Skills re-extract,
// Reputation mic).
//
// 5. "Regenerate" called genBuilderBaseline() with no confirmation, silently
//    discarding every manual edit made to the draft (bullets, header,
//    skills, education) and rebuilding purely from the original skeleton
//    material.
//
// 6. Two silent-overwrite/stale-link paths between the plain "paste a
//    resume" field (profile.resume) and the structured builder draft
//    (profile.baselineResume), which the app keeps in sync via
//    genBuilderBaseline/commitBaseline but which can be edited
//    independently:
//      a. Completing the builder for the FIRST time (no baselineResume yet)
//         silently replaced whatever the person had already pasted/uploaded
//         directly on the Resume screen, with no warning it was about to be
//         overwritten.
//      b. Once a builder draft exists, uploading a new file or opening the
//         paste box and editing profile.resume directly left the "Your
//         built resume is saved... Download (Word)" links pointing at the
//         old, now-inaccurate baselineResume, with nothing signaling they'd
//         gone stale.
//
// 7. The builder's LinkedIn URL header field could get seeded from
//    profile.linkedin, which is the pasted LinkedIn PROFILE TEXT (About
//    section, recommendations, etc. from the separate LinkedIn orientation
//    screen), not a URL -- corrupting the resume's one-line contact field
//    (on screen and in the downloaded Word doc) with a large text blob.
import fs from 'node:fs'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

const APP = 'src/App.jsx'
const app = fs.readFileSync(APP, 'utf8')

// Fix 5: Regenerate confirms before discarding edits.
check(!/onClick=\{\(\)=>genBuilderBaseline\(\)\}><RotateCcw/.test(app),
  `${APP}: the Regenerate button still calls genBuilderBaseline() directly with no confirmation -- this is the exact silent-discard bug being fixed`)
check(app.includes("onClick={()=>{if(window.confirm('Regenerating replaces everything in your current draft, including any edits you\\'ve made here, with a fresh version built from your original entries.\\n\\nThis cannot be undone.\\n\\nContinue?'))genBuilderBaseline()}}><RotateCcw"),
  `${APP}: Regenerate's confirm dialog is not wired to actually gate the genBuilderBaseline() call`)

// Fix 6a: first-time "Create my resume" warns before overwriting a
// pre-existing plain resume that didn't come from this builder.
const createIdx = app.indexOf('Create my resume')
check(createIdx !== -1, `${APP}: could not find the "Create my resume" button`)
const createBlock = createIdx !== -1 ? app.slice(Math.max(0, createIdx - 900), createIdx) : ''
check(createBlock.includes("profile.resume&&!profile.baselineResume&&!window.confirm("),
  `${APP}: "Create my resume" no longer checks for a pre-existing plain resume before its first run -- it would silently overwrite text the person pasted or uploaded before ever opening the builder`)

// Fix 6b: direct edits to the plain resume field, once a draft exists,
// retire the draft (and its now-stale download links) instead of leaving
// them orphaned -- both at the two explicit entry points (file upload, the
// "Or paste it instead" toggle) and as a blur-time safety net for the case
// where the paste box was already open from an earlier visit.
const uploadIdx = app.indexOf('Upload Resume')
check(uploadIdx !== -1, `${APP}: could not find the resume FileUpload`)
const uploadBlock = uploadIdx !== -1 ? app.slice(uploadIdx, uploadIdx + 1500) : ''
const uploadClearIdx = uploadBlock.indexOf("setProfile(p=>({...p,baselineResume:null}))")
check(uploadBlock.includes('if(profile.baselineResume){') && uploadClearIdx !== -1,
  `${APP}: uploading a new resume file no longer retires an existing built draft -- its Download (Word) links would keep pointing at now-stale content`)
check(uploadClearIdx !== -1 && uploadClearIdx < uploadBlock.indexOf("pr('resumeFile',f.name)"),
  `${APP}: the upload path clears baselineResume after it has already started writing the new resume, instead of before`)

const pasteToggleIdx = app.indexOf('Or paste it instead')
check(pasteToggleIdx !== -1, `${APP}: could not find the "Or paste it instead" toggle`)
const pasteToggleBlock = pasteToggleIdx !== -1 ? app.slice(Math.max(0, pasteToggleIdx - 900), pasteToggleIdx) : ''
check(pasteToggleBlock.includes('if(profile.baselineResume){') && pasteToggleBlock.includes("setProfile(p=>({...p,baselineResume:null}))"),
  `${APP}: opening the paste-resume box no longer retires an existing built draft before letting the person edit the text directly`)

check(app.includes("if(profile.baselineResume&&profile.resume!==renderResumeText(profile.baselineResume))setProfile(p=>({...p,baselineResume:null}))"),
  `${APP}: the paste textarea's onBlur safety net (for a box left open from an earlier visit) is missing -- a builder draft could still go stale silently on that path`)

// Fix 7: the builder's LinkedIn URL field never falls back to profile.linkedin
// (pasted LinkedIn profile TEXT, not a URL) at either seed site.
check(!app.includes("linkedin:linkedinUrl||hdr.linkedin||p.linkedin||''"),
  `${APP}: the LinkedIn-PDF-parse header fallback still defaults to p.linkedin (raw pasted profile text) -- this is the exact corruption bug being fixed`)
check(app.includes("linkedin:linkedinUrl||hdr.linkedin||''"),
  `${APP}: the LinkedIn-PDF-parse header fallback chain (linkedinUrl||hdr.linkedin||'') is missing or changed`)
check(!app.includes("header:{name:'',email:'',phone:'',linkedin:profile.linkedin||''}"),
  `${APP}: the fresh-builder-init on the Resume screen still seeds the header's LinkedIn URL field from profile.linkedin (raw pasted profile text) -- this is the exact corruption bug being fixed`)
check(app.includes("header:{name:'',email:'',phone:'',linkedin:''}"),
  `${APP}: the fresh-builder-init's header no longer seeds linkedin as an empty string`)

if (failures) {
  console.error(`test-resume-builder-trio-fix: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-resume-builder-trio-fix: OK (Regenerate confirms before discarding edits, first-build and direct-edit paths between the plain resume field and the builder draft no longer silently overwrite or leave stale download links, the builder\'s LinkedIn URL field no longer gets corrupted by pasted LinkedIn profile text)')
}
