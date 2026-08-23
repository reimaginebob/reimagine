// Campaign definitions: who each one targets, and what it says.
//
// One file so a campaign's audience and its copy cannot drift apart. Changing
// who receives something and changing what it says are the same decision, and
// splitting them across two files is how a message ends up in front of the
// wrong people.
//
// Cross-boundary import rule (CLAUDE.md section 8): a `.js` file under src/
// imported by api/ with the .js extension. Never rename it to .mjs.
//
// ---------------------------------------------------------------------------
// THE COPY BELOW IS PROVISIONAL AND COWORK OWNS IT
// ---------------------------------------------------------------------------
// It is written to be sendable rather than final, so the sender can be built and
// dry-run today. The dry run renders the whole email, so replacing this is a
// matter of editing the string and looking at the output.
//
// It follows the voice rules in CLAUDE.md section 3, which apply to email as
// much as to anything on screen. In particular it does not open with what the
// person failed to do. "You started and stopped" is a fact; "you never finished
// your profile" is an accusation, and this audience is mid-job-search and does
// not need one more thing telling them they are behind.

import { SURVEYS } from './survey-questions.js'

// Not secrets — account configuration. Kept here rather than in environment
// variables because every env var added is another Vercel round trip, and none
// of these values needs hiding.
export const CAMPAIGN_FROM = 'Bob Goodwin <bob@updates.career.club>'
// updates.career.club cannot receive mail, so without this every reply bounces.
// Replies are the qualitative half of this whole exercise.
export const CAMPAIGN_REPLY_TO = 'bob@career.club'
// The "Reimagine updates" topic. Sending under it means an unsubscribe here
// cannot touch the Career Club Corner newsletter.
export const CAMPAIGN_TOPIC_ID = '2a78469a-1a8d-489f-9124-6f36e37c53c9'

const BASE_URL = 'https://reimagine.career.club'

function surveyButton(token, surveyKey, option) {
  const href = `${BASE_URL}/api/survey/respond?t=${encodeURIComponent(token)}&q=${encodeURIComponent(surveyKey)}&a=${encodeURIComponent(option.code)}`
  return `<tr><td style="padding:0 0 10px">
  <a href="${href}" style="display:block;padding:13px 18px;background:#FFFFFF;border:1px solid #D9DEE6;border-radius:10px;
     color:#1A2540;text-decoration:none;font-size:16px;line-height:1.4">${option.label}</a>
</td></tr>`
}

function shell(inner) {
  return `<div style="background:#FBF8F2;padding:28px 16px;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#3D4A5C">
  <div style="max-width:560px;margin:0 auto;background:#FFFFFF;border:1px solid #E2E5EA;border-radius:14px;padding:30px 32px">
${inner}
  </div>
</div>`
}

export const CAMPAIGNS = {
  // People who put material into the orientation and never generated anything.
  // The smallest group and the most informative: they spent real effort, hit
  // something, and left, so they are the ones who can say what it was.
  //
  // This email ASKS rather than nudges. That is deliberate and it is Bob's call
  // from 2026-08-22 — we do not yet know whether the drop-off is a product
  // problem, and a "come back and finish" would presume an answer we have not
  // earned.
  'dropout-ask': {
    key: 'dropout-ask',
    // Matches the stage vocabulary in api/admin/user-stages.js.
    stages: ['gave_inputs_no_output'],
    survey: 'dropout',
    subject: 'What got in the way?',
    render({ firstName, surveyToken }) {
      const survey = SURVEYS.dropout
      const buttons = survey.options.map(o => surveyButton(surveyToken, survey.key, o)).join('\n')
      const hi = firstName ? `Hi ${firstName},` : 'Hi,'
      return shell(`
    <p style="font-size:17px;line-height:1.65;margin:0 0 16px">${hi}</p>
    <p style="font-size:17px;line-height:1.65;margin:0 0 16px">You started putting your background into Reimagine a while back and didn't come back to it. I'd like to know what got in the way — if something about it didn't work, that's worth me knowing.</p>
    <p style="font-size:17px;line-height:1.65;margin:0 0 20px">One click and you're done. Nothing else needed.</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse">
${buttons}
    </table>
    <p style="font-size:17px;line-height:1.65;margin:22px 0 0">Thanks,<br>Bob</p>
    <p style="font-size:15px;line-height:1.6;color:#6B7685;margin:18px 0 0">Your work is saved exactly where you left it, whenever you want it.</p>`)
    },
  },
}

export function getCampaign(key) {
  return Object.prototype.hasOwnProperty.call(CAMPAIGNS, key) ? CAMPAIGNS[key] : null
}
