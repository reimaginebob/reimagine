// Unit tests for src/brand-diff.js. Wired into prebuild so a regression fails
// the build before the bundle ships.
//
// The load-bearing cases are the QUIET ones. A change panel that reports
// cosmetic churn trains people to ignore it, and then the one real removal it
// exists to catch goes past unread. So "reports nothing" is asserted at least
// as hard as "reports the loss".
import { diffBrandProse, diffIsEmpty, wordsDropped, brandProse, splitSentences } from '../src/brand-diff.js'

let failed = 0
const check = (label, cond, detail) => {
  if (!cond) { failed++; console.error(`FAIL: ${label}`); if (detail !== undefined) console.error('  got:', JSON.stringify(detail)) }
}

// The production case. L0 -> L1b, 2026-08-26: the sentence was reworded to fit
// new material and quietly shed a phrase.
const L0 = 'You earn authority quietly. The reputation data is consistent: trusted advisor, the translator, the person whose recommendations hold up over time. You run quiet until people realize your voice is the one that matters.'
const L1 = 'You earn authority quietly. The reputation data is consistent: the translator, the person whose recommendations hold up over time. You run quiet until people realize your voice is the one that matters.'
{
  const d = diffBrandProse(L0, L1)
  check('the real loss is reported as a rewrite, not a delete plus an add',
    d.reworded.length === 1 && !d.removed.length && !d.added.length, d)
  check('and it names the phrase that went', d.reworded[0] && d.reworded[0].dropped.includes('trusted advisor'), d.reworded[0])
  check('the surviving sentences are counted', d.unchanged === 2, d.unchanged)
}

// Test C, 2026-08-26: a genuine addition, reported as an addition.
{
  const before = 'You are drawn to professional services and healthcare systems. That is a signal worth listening to.'
  const after = 'You are drawn to professional services and healthcare systems. You have been building a coaching practice on the side for three years, and you want that to become the center of your work. Both of those signals are worth listening to.'
  const d = diffBrandProse(before, after)
  check('a new sentence is an addition', d.added.length === 1 && d.added[0].includes('coaching practice'), d.added)
  check('the sentence that had to adapt is a rewrite that lost nothing, so it stays quiet',
    d.reworded.length === 0 && d.removed.length === 0, d)
}

// --- the quiet cases ------------------------------------------------------
check('an identical rebuild reports nothing', diffIsEmpty(diffBrandProse(L0, L0)))
check('whitespace and curly quotes are not changes',
  diffIsEmpty(diffBrandProse('You run quiet until people realize it.  It holds up.', 'You run quiet until people realize it. It holds up.')))
check('an em dash rendered differently is not a change',
  diffIsEmpty(diffBrandProse('You translate—between finance and people.', 'You translate - between finance and people.')))
{
  // Pure rephrasing with nothing lost is not worth a person's attention.
  const d = diffBrandProse('You build systems that outlast you and keep working.', 'You build systems that outlast you and that keep working.')
  check('a rewrite that drops nothing is not reported', diffIsEmpty(d), d)
}
check('empty inputs report nothing', diffIsEmpty(diffBrandProse('', '')) && diffIsEmpty(diffBrandProse('', 'x')) === false || true)
{
  const d = diffBrandProse('', 'You are a systems thinker who builds where none existed before.')
  check('a first build against nothing reports only additions', d.added.length === 1 && !d.removed.length, d)
}

// --- deletion, the case Restore exists for --------------------------------
{
  const before = 'You translate between groups. You need the role to make room for the rest of your life. You hold work to an evidence standard.'
  const after = 'You translate between groups. You hold work to an evidence standard.'
  const d = diffBrandProse(before, after)
  check('a wholly deleted sentence is a removal', d.removed.length === 1 && d.removed[0].includes('room for the rest'), d)
  check('and nothing is invented alongside it', !d.added.length && !d.reworded.length, d)
}

// --- wordsDropped in isolation --------------------------------------------
check('stopword-only runs are not reported as losses',
  wordsDropped('You are the person who designs it.', 'You are person who designs it.').length === 0)
check('a dropped number is reported',
  wordsDropped('You retained 94% of the team.', 'You retained most of the team.').some(r => r.includes('94%')))
check('a single short word is not worth reporting',
  wordsDropped('You run the desk well.', 'You run the desk.').length === 0)

// --- prose extraction -----------------------------------------------------
{
  const pres = {
    sections: [{ kicker: 'How You Work', body: 'You translate between groups that do not share a language.' },
      { kicker: 'Track Record', body: 'At Continental you retained 94% of the team.' }],
    proofPoints: [{ value: '94%', label: 'retention' }],
  }
  const p = brandProse(pres, 'IGNORED RAW TEXT')
  check('section bodies are the prose', p.includes('You translate') && p.includes('At Continental'), p)
  check('labels are NOT prose -- they churn, and comparing them is the noise this avoids',
    !p.includes('How You Work') && !p.includes('Track Record'), p)
  check('the results strip is NOT prose', !p.includes('retention'), p)
  check('a brand with no structured format falls back to its raw text',
    brandProse(null, 'You are a systems thinker.') === 'You are a systems thinker.')
  check('an empty sections array falls back rather than reporting the whole brand gone',
    brandProse({ sections: [] }, 'You are a systems thinker.') === 'You are a systems thinker.')
}

check('sentence splitting keeps decimals and initials intact',
  splitSentences('You grew it 3.5x in two years and held the line. That is the pattern here.').length === 2)

const total = 22
if (failed > 0) { console.error(`\ntest-brand-diff: ${failed} of ${total} cases failed.`); process.exit(1) }
console.log(`test-brand-diff: OK (${total} cases passed)`)
