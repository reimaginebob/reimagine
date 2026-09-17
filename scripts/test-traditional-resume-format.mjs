// Traditional resume format (Output/handoff/2026-09-16_traditional-resume-format.md):
// a third renderResumeText/buildResumeDoc/resumeFilename arrangement of the SAME
// resume record -- no Key Accomplishments/Career Highlights block, Summary then
// Skills then straight into reverse-chronological experience, plain human-readable
// headings and typography (unlike ATS). The fold that moves each Career Highlight
// into the role where it happened still runs (shared with ATS), so a highlight is
// never silently dropped; an orphaned highlight (roleTag matches no employer) falls
// back to the same "SUMMARY OF QUALIFICATIONS" heading ATS uses for the same reason.
//
// src/App.jsx is JSX with no bundler in this harness. foldHighlightsIntoExperience,
// renderResumeText, and resumeFilename are pure functions with no JSX or React
// dependency, so this extracts their literal source (the new-Function pattern
// established in scripts/test-p3-amend-modes.mjs) and runs it directly.
import fs from 'node:fs'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

const APP = 'src/App.jsx'
const app = fs.readFileSync(APP, 'utf8')

const foldStart = app.indexOf('function foldHighlightsIntoExperience(r){')
check(foldStart !== -1, `${APP}: foldHighlightsIntoExperience is missing`)
const filenameStart = app.indexOf("function resumeFilename(r, format='human'){")
check(filenameStart !== -1, `${APP}: resumeFilename is missing or its signature has drifted`)
const filenameEnd = app.indexOf('\n}\n', filenameStart) + 2
const rendererSrc = foldStart !== -1 && filenameStart !== -1 ? app.slice(foldStart, filenameStart) : ''
const filenameSrc = filenameStart !== -1 ? app.slice(filenameStart, filenameEnd) : ''

check(rendererSrc.includes("function renderResumeText(r, format='human'){"),
  `${APP}: renderResumeText's signature has drifted from the (r, format='human') shape this test extracts`)

let foldHighlightsIntoExperience, renderResumeText, resumeFilename
if (rendererSrc && filenameSrc) {
  ;({ foldHighlightsIntoExperience, renderResumeText } =
    new Function(`${rendererSrc}\nreturn {foldHighlightsIntoExperience, renderResumeText}`)())
  ;({ resumeFilename } = new Function(`${filenameSrc}\nreturn {resumeFilename}`)())
}

if (foldHighlightsIntoExperience && renderResumeText && resumeFilename) {
  // A record with: one highlight that folds cleanly into Acme (roleTag names the
  // employer), and one orphaned highlight whose roleTag matches no employer --
  // exactly the case the brief's design question is about.
  const record = {
    header: { name: 'Dana Whitfield', city: 'Columbus, OH', email: 'dana@example.com', phone: '555-0100', linkedin: 'linkedin.com/in/danawhitfield' },
    summary: 'Operations leader who cuts missed-ship incidents in half.',
    keyAccomplishments: [
      { runs: [{ text: 'Cut missed-ship incidents in half at Acme', bold: true }], roleTag: 'Acme Logistics' },
      { runs: [{ text: 'Board-level advisor on a statewide logistics council', bold: false }], roleTag: 'Statewide Council (no matching employer)' }
    ],
    experience: [
      { company: 'Acme Logistics', location: 'Columbus, OH', context: 'Regional freight carrier',
        titles: [{ title: 'Director of Operations', dates: '2020–Present', bullets: [{ runs: [{ text: 'Ran the daily ops for 4 distribution centers', bold: false }] }] }] },
      { company: 'Beacon Freight', location: 'Dayton, OH',
        titles: [{ title: 'Operations Manager', dates: '2016–2020', bullets: [{ runs: [{ text: 'Opened the Dayton hub from zero', bold: false }] }] }] }
    ],
    education: [{ degree: 'B.S.', field: 'Logistics', institution: 'Ohio State University', year: '2012' }],
    skills: [{ category: 'Core', items: ['Supply chain', 'Fleet ops', 'P&L ownership'] }]
  }

  const human = renderResumeText(record, 'human')
  const traditional = renderResumeText(record, 'traditional')
  const ats = renderResumeText(record, 'ats')

  // --- Traditional's shape: no highlights block, Summary -> Skills -> Experience ---

  check(!traditional.includes('KEY ACCOMPLISHMENTS') && !traditional.includes('CAREER HIGHLIGHTS'),
    'Traditional format still renders a Key Accomplishments/Career Highlights block -- the brief says this format has none by definition')
  check(traditional.includes('SUMMARY') && traditional.includes('SKILLS') && traditional.includes('EXPERIENCE'),
    'Traditional format is missing one of Summary/Skills/Experience')
  const idxSummary = traditional.indexOf('SUMMARY')
  const idxSkills = traditional.indexOf('SKILLS')
  const idxExperience = traditional.indexOf('EXPERIENCE')
  check(idxSummary < idxSkills && idxSkills < idxExperience,
    'Traditional format does not open Summary, then Skills, then straight into Experience, in that order')
  check(!traditional.includes('CORE COMPETENCIES'),
    'Traditional format uses the ATS "keyword bank" heading (Core Competencies) -- the brief says no keyword bank up top')

  // --- The orphaned highlight's destination: Summary of Qualifications fallback ---
  // (design question in the brief; Bob's recommended default for the first release)

  check(traditional.includes('SUMMARY OF QUALIFICATIONS'),
    'Traditional format dropped the orphaned highlight instead of falling back to Summary of Qualifications')
  check(traditional.includes('Board-level advisor on a statewide logistics council'),
    'Traditional format lost the orphaned highlight text entirely -- nothing should ever be silently dropped')
  check(ats.includes('SUMMARY OF QUALIFICATIONS') && ats.includes('Board-level advisor on a statewide logistics council'),
    'ATS format (the existing fallback this reuses) regressed')

  // --- The fold still runs for Traditional: the matched highlight becomes Acme's leading bullet ---

  const acmeIdx = traditional.indexOf('Acme Logistics')
  const foldedBulletIdx = traditional.indexOf('Cut missed-ship incidents in half at Acme')
  const nextRoleIdx = traditional.indexOf('Beacon Freight')
  check(acmeIdx !== -1 && foldedBulletIdx > acmeIdx && foldedBulletIdx < nextRoleIdx,
    "Traditional format did not fold the Acme-tagged highlight into Acme's role as the leading bullet")

  // --- Content parity across all three: every bullet, date, employer, and highlight ---
  // in the human version must appear SOMEWHERE in Traditional (the whole premise is
  // one record arranged three ways, nothing invented or dropped).

  const mustAppearEverywhere = [
    'DANA WHITFIELD', 'Columbus, OH', 'dana@example.com',
    'Operations leader who cuts missed-ship incidents in half.',
    'Acme Logistics', 'Director of Operations', '2020', 'Ran the daily ops for 4 distribution centers',
    'Beacon Freight', 'Operations Manager', '2016', 'Opened the Dayton hub from zero',
    'B.S.', 'Ohio State University', '2012',
    'Cut missed-ship incidents in half at Acme',
    'Board-level advisor on a statewide logistics council'
  ]
  mustAppearEverywhere.forEach(fragment => {
    check(human.includes(fragment), `human render is missing an expected fragment (fixture problem): "${fragment}"`)
    check(traditional.includes(fragment), `Traditional format dropped content present in the human version: "${fragment}"`)
    check(ats.includes(fragment), `ATS format dropped content present in the human version (pre-existing contract, sanity check): "${fragment}"`)
  })

  // Skill items appear in Traditional too (pushed near the top instead of the foot).
  ;['Supply chain', 'Fleet ops', 'P&L ownership'].forEach(skill => {
    check(traditional.includes(skill), `Traditional format is missing a skill item: "${skill}"`)
  })

  // --- Traditional does not mutate the caller's record (fold clones; same contract as ATS) ---

  check(record.keyAccomplishments.length === 2 && Array.isArray(record.experience[0].titles[0].bullets) && record.experience[0].titles[0].bullets.length === 1,
    'renderResumeText(record, "traditional") mutated the source record -- foldHighlightsIntoExperience must stay pure')

  // --- resumeFilename: suffix carries the format, and default stays human (no suffix) ---

  check(resumeFilename(record, 'human') === resumeFilename(record) , 'resumeFilename\'s default format is no longer "human"')
  check(!resumeFilename(record, 'human').includes('_ats') && !resumeFilename(record, 'human').includes('_traditional'),
    'resumeFilename added a suffix for the human format, which should carry none')
  check(resumeFilename(record, 'ats').includes('_ats_'), 'resumeFilename lost its "_ats" suffix for the ATS format')
  check(resumeFilename(record, 'traditional').includes('_traditional_'), 'resumeFilename has no "_traditional" suffix for the Traditional format')

  // --- A record with no orphans at all: Traditional renders cleanly with nothing left over ---

  const noOrphans = JSON.parse(JSON.stringify(record))
  noOrphans.keyAccomplishments = [noOrphans.keyAccomplishments[0]] // only the Acme-tagged one
  const traditionalNoOrphans = renderResumeText(noOrphans, 'traditional')
  check(!traditionalNoOrphans.includes('SUMMARY OF QUALIFICATIONS'),
    'Traditional format renders an empty Summary of Qualifications heading when every highlight folded cleanly -- it should only appear when something is left over')
} else {
  failures++
  console.error('  FAIL could not extract foldHighlightsIntoExperience/renderResumeText/resumeFilename from src/App.jsx')
}

if (failures) {
  console.error(`test-traditional-resume-format: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-traditional-resume-format: OK (Traditional renders Summary -> Skills -> straight into Experience with no highlights block, reuses the same fold as ATS so a highlight is never silently dropped, an orphaned highlight falls back to the Summary of Qualifications heading, content parity holds against the human version, and resumeFilename carries the chosen format)')
}
