// The one-click survey questions asked by email.
//
// One canonical list, read by the endpoint that records answers
// (api/survey/respond.js) and by whatever builds the email. A question whose
// options drift between the email and the recorder produces answers nobody can
// interpret.
//
// Cross-boundary import rule (CLAUDE.md section 8): a `.js` file under src/
// imported by api/ with the .js extension, same shape as src/feedback-taxonomy.js
// and src/signup-sources.js. Never rename it to .mjs.
//
// THE DESIGN RULE FOR OPTIONS: every list must contain the answer we do not want
// to hear. A set of comfortable options only confirms what we already believe,
// and the whole point of buttons over free text is that they make an
// uncomfortable answer cheap to give — nobody has to compose a paragraph
// explaining that the product did not seem worth their time.
//
// Codes are permanent once a campaign has gone out; they are stored on answer
// rows. To retire one, stop offering it and leave the entry here so old rows
// still resolve to a label.
//
// A caution for whoever reads the results: two of these options ('timing' and
// 'forgot') are socially frictionless — they are the answers a person can give
// without implying any criticism. Expect them to be over-represented relative to
// the truth, and read a high count on either as a ceiling rather than a finding.
// They are here because they are also the most likely real answers, and leaving
// them out would force people into a reason they do not mean.
//
// `sentiment` is a fixed property of each option, not a judgement made later.
// It is set here so the Feedback tab can chart these alongside everything else
// on day one, and because the valence of "I did not think it would help me" is
// not in doubt.

export const SURVEYS = {
  // Sent to people who started Reimagine and stopped. The framing is
  // deliberately "what got in the way" rather than "why did you not finish" —
  // the first assumes something got in the way, the second assumes they failed.
  dropout: {
    key: 'dropout',
    surface: 'onboarding',
    prompt: 'What got in the way?',
    options: [
      { code: 'timing',      label: 'Life got busy — bad timing',                sentiment: 'neutral'  },
      // Distinct from 'timing' on purpose, and the two need different remedies:
      // busy means it lost to competing demands, forgot means it left their head
      // entirely. This is also the one option that states an INTENTION, which is
      // why it gets a way back into the product on the thank-you page rather
      // than a dead end — see returnLink below.
      { code: 'forgot',      label: "I forgot — I'll be back",                   sentiment: 'neutral', returnLink: true },
      { code: 'effort',      label: 'It asked for more than I had time to give', sentiment: 'negative' },
      { code: 'unclear',     label: "I wasn't sure what to do next",             sentiment: 'negative' },
      { code: 'not_for_me',  label: "I didn't think it would help me",           sentiment: 'negative' },
      { code: 'broken',      label: "Something didn't work",                     sentiment: 'negative' },
      { code: 'other',       label: 'Something else',                            sentiment: 'neutral'  },
    ],
  },
}

export function getSurvey(key) {
  return Object.prototype.hasOwnProperty.call(SURVEYS, key) ? SURVEYS[key] : null
}

export function getOption(surveyKey, code) {
  const survey = getSurvey(surveyKey)
  if (!survey) return null
  return survey.options.find(o => o.code === code) || null
}
