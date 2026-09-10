// Unit tests for the Personal Brand rework guard (src/brand-diff.js), added
// 2026-09-10 after a production regression: a one-sentence correction ("agree
// that my background points towards mid-size organizations...") came back as
// a wholesale rewrite -- 21 new lines, 27 lines silently gone, three stat
// tiles emptied. The prompt-level "amend, not rewrite" instruction
// (P.p3analysis's previousBrand branch, tested by test-p3-amend-modes.mjs) is
// necessary but was proven insufficient; this is the deterministic backstop.
import { extractNumericTokens, extractEntityTokens, checkBrandPreservation, describeBrandPreservationGap, mergeProofPoints, patchUnrelatedRegressions, MAX_CHANGED_LINES } from '../src/brand-diff.js'

let failed = 0
const check = (label, cond, detail) => {
  if (!cond) { failed++; console.error(`FAIL: ${label}`); if (detail !== undefined) console.error('  got:', JSON.stringify(detail)) }
}

// --- extractNumericTokens --------------------------------------------------
{
  const t = extractNumericTokens('A $4.8M total rewards refresh, a 76% placement rate, up from 19% to 13%, across 1,400 employees.')
  check('dollar figure with a unit suffix', t.includes('$4.8M'), t)
  check('a percentage', t.includes('76%'), t)
  check('both halves of a range', t.includes('19%') && t.includes('13%'), t)
  check('a thousands figure', t.includes('1,400'), t)
  check('no duplicates', new Set(t).size === t.length, t)
}
check('a spelled-out number is not extracted (documented scope limit)',
  !extractNumericTokens('a six-point drop').includes('six'))

// --- extractEntityTokens ---------------------------------------------------
{
  const t = extractEntityTokens('You built the DEI function at Continental Casualty Partners after an M&A close. You are direct.')
  check('a multi-word proper noun', t.includes('Continental Casualty Partners'), t)
  check('an acronym', t.includes('DEI'), t)
  check('an acronym with an internal ampersand', t.includes('M&A'), t)
  check('a sentence-initial capital alone is not mistaken for a name', !t.includes('You'), t)
}

// --- checkBrandPreservation ------------------------------------------------
{
  const prev = 'You led a $4.8M total rewards refresh at Continental Casualty Partners. Your directness is also where friction lives. That is a fit condition to be deliberate about.'
  const sameFacts = 'You led a $4.8M total rewards refresh at Continental Casualty Partners, and you are now ready for a larger, mid-size mandate. Your directness is also where friction lives. That is a fit condition to be deliberate about.'
  const droppedFacts = 'You are ready for a larger, mid-size mandate. Your directness is also where friction lives.'
  const passOk = checkBrandPreservation(prev, sameFacts)
  check('a real amendment that keeps every figure, name, and unrelated sentence passes',
    passOk.ok && !passOk.missingNumbers.length && !passOk.missingEntities.length, passOk)
  const failed1 = checkBrandPreservation(prev, droppedFacts)
  check('dropping the figure and the company name fails',
    !failed1.ok && failed1.missingNumbers.includes('$4.8M') && failed1.missingEntities.includes('Continental Casualty Partners'), failed1)
  check('the failed case also lost the unrelated closing sentence, which the diff should count as a changed line',
    failed1.changedLines > 0, failed1)
}
{
  // The actual production shape: many small sentence-boundary shifts with no
  // real content loss should still trip the changed-line ceiling -- volume
  // alone is a signal, not just missing tokens.
  const prev = Array.from({ length: 10 }, (_, i) => `This is sentence number ${i} about the work itself.`).join(' ')
  const rewritten = Array.from({ length: 10 }, (_, i) => `This is a totally different sentence ${i} about the work itself.`).join(' ')
  const r = checkBrandPreservation(prev, rewritten)
  check(`more than ${MAX_CHANGED_LINES} touched lines fails even with no missing tokens`,
    !r.ok && !r.missingNumbers.length && !r.missingEntities.length && r.changedLines > MAX_CHANGED_LINES, r)
}

// --- describeBrandPreservationGap ------------------------------------------
{
  const gap = describeBrandPreservationGap({ missingNumbers: ['$4.8M'], missingEntities: ['Continental Casualty Partners'], changedLines: 9, maxChangedLines: MAX_CHANGED_LINES })
  check('names the missing figure', gap.includes('$4.8M'))
  check('names the missing entity', gap.includes('Continental Casualty Partners'))
  check('states the changed-line count', gap.includes('9'))
  check('never attributes the note to the person (it is a developer instruction, not something they said)',
    !/^"|the person (said|told)/i.test(gap))
}

// --- mergeProofPoints -------------------------------------------------------
{
  const prev = [{ value: '$4.8M', label: 'Total rewards refresh' }, { value: '76%', label: 'Placement rate' }]
  const droppedOneTile = [{ value: '$4.8M', label: 'Total rewards refresh' }]
  const textStillHasBoth = 'The $4.8M total rewards refresh and the 76% placement rate both still stand.'
  const merged = mergeProofPoints(prev, droppedOneTile, textStillHasBoth)
  check('a tile stage two dropped is carried forward when its number is still in the final text',
    merged.some(p => p.value === '76%'), merged)
  check('no duplicate tile when both sides already agree',
    merged.filter(p => p.value === '$4.8M').length === 1, merged)
  const textLostIt = 'The $4.8M total rewards refresh still stands.'
  const mergedGone = mergeProofPoints(prev, droppedOneTile, textLostIt)
  check('a tile is never invented for a number that is genuinely gone from the final text',
    !mergedGone.some(p => p.value === '76%'), mergedGone)
}

// --- patchUnrelatedRegressions ---------------------------------------------
{
  const prevPresentation = {
    hero: 'You are an operator who scales.',
    sections: [
      { kicker: 'Who You Are', body: 'You are direct and structured.' },
      { kicker: 'Where You Are Pointed', body: 'You are ready for a mid-size mandate.' },
    ],
    origin: { body: 'You grew up around this work.' },
    edges: [{ claim: 'Your directness is friction.', detail: 'That is a fit condition to be deliberate about.' }],
    forwardClose: 'This is your foundation.',
  }
  // Stage two's second attempt: touches the section the correction is
  // actually about (scale/scope), but ALSO rewords the unrelated edge and
  // drops its closing clause -- exactly the production incident's shape.
  const nextPresentation = {
    hero: 'You are an operator who scales.',
    sections: [
      { kicker: 'Who You Are', body: 'You are direct and structured.' },
      { kicker: 'Where You Are Pointed', body: 'You are ready for a bigger, mid-size mandate at larger scale.' },
    ],
    origin: { body: 'You grew up around this work.' },
    edges: [{ claim: 'Your directness is friction.', detail: 'In loosely-defined environments you can read as impatient.' }],
    forwardClose: 'This is your foundation.',
  }
  const patched = patchUnrelatedRegressions(prevPresentation, nextPresentation, 'I am interested in a larger scale mandate.')
  check('the section the correction is actually about keeps its new wording',
    patched.sections[1].body.includes('larger scale'), patched.sections[1])
  check('an unrelated section with no textual overlap is left untouched',
    patched.sections[0].body === prevPresentation.sections[0].body, patched.sections[0])
  check('an edge whose change has no overlap with the correction reverts, so its dropped clause survives',
    patched.edges[0].detail === prevPresentation.edges[0].detail, patched.edges[0])
  check('origin and forwardClose, both untouched by stage two, are unaffected',
    patched.origin.body === prevPresentation.origin.body && patched.forwardClose === prevPresentation.forwardClose)
}
{
  // A section present only in the new presentation (no kicker match, no
  // positional counterpart) is new material, not a rewrite -- kept as-is.
  const prevPresentation = { sections: [{ kicker: 'A', body: 'old a' }] }
  const nextPresentation = { sections: [{ kicker: 'A', body: 'old a' }, { kicker: 'B', body: 'brand new material' }] }
  const patched = patchUnrelatedRegressions(prevPresentation, nextPresentation, '')
  check('a genuinely new section is kept even with an empty correction note',
    patched.sections[1].body === 'brand new material', patched.sections)
}

console.log(failed ? `\n${failed} FAILURE(S)` : '\nall cases correct')
process.exit(failed ? 1 : 0)
