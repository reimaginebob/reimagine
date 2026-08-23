// Records a one-click survey answer from an email link, and shows a thank-you
// page. No sign-in: the whole point of buttons over a written reply is that
// answering costs nothing, and a magic link in front of the question would
// undo that.
//
//   GET /api/survey/respond?t=<survey_token>&q=<survey key>&a=<option code>
//
// The token is users.survey_token — a stored random value that identifies a
// person to THIS endpoint and nothing else. It cannot sign anyone in or reach
// any other route.
//
// ---------------------------------------------------------------------------
// EMAIL SCANNERS, which is the whole reason this is shaped the way it is
// ---------------------------------------------------------------------------
// This codebase has already been bitten once: security scanners pre-fetched
// magic links and consumed the one-time token before the human clicked
// (fixed 2026-08-15, PR #398). The same machines will pre-fetch these links,
// and a naive implementation would record a survey answer that nobody chose.
//
// Three defences, none of which asks anything extra of a real person:
//
//   1. GET only, and an Accept header that includes text/html. Browsers send
//      it; most prefetchers and link-checkers do not. A request without it gets
//      the page and records nothing.
//   2. The answer is OVERWRITABLE, not write-once. UNIQUE (source, source_record)
//      on feedback_event plus ON CONFLICT DO UPDATE means the last click wins.
//      A scanner's guess is corrected the moment the human picks something, and
//      a person who mis-clicks can just click again.
//   3. The user agent is stored on every answer, so scanner noise stays
//      identifiable afterwards rather than being silently baked into a count.
//
// Deliberately NOT used: a confirmation page with a submit button. It would
// defeat prefetching completely and would also halve the response rate, which
// is the one thing this design exists to protect.

import { sql } from '../_lib/db.js'
import { getSurvey, getOption } from '../../src/survey-questions.js'

const TOKEN_RE = /^[A-Za-z0-9_-]{16,64}$/

// Plain, quiet, and it does not congratulate anyone for clicking a button.
// These people are mid-job-search; the page should take two seconds to read
// and then get out of the way.
function page({ heading, body, note }) {
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Reimagine</title>
<style>
  body { margin:0; background:#FBF8F2; color:#3D4A5C; font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
         display:flex; align-items:center; justify-content:center; min-height:100vh; padding:24px; box-sizing:border-box; }
  .card { background:#fff; border:1px solid #E2E5EA; border-radius:14px; padding:32px 34px; max-width:520px; width:100%;
          box-shadow:0 1px 2px rgba(26,37,64,0.04); }
  h1 { font-family:Georgia,serif; font-size:26px; color:#1A2540; margin:0 0 14px; line-height:1.25; }
  p { font-size:17px; line-height:1.6; margin:0 0 14px; }
  .note { border-left:4px solid #C8924A; background:#FDF8F0; border-radius:0 8px 8px 0; padding:12px 14px;
          font-size:16px; line-height:1.55; margin-top:18px; }
  a { color:#A06828; }
</style>
</head><body><div class="card">
<h1>${heading}</h1>
<p>${body}</p>
${note ? `<div class="note">${note}</div>` : ''}
</div></body></html>`
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Content-Type', 'text/html; charset=utf-8')

  // A HEAD or anything non-GET is a machine looking at the link, not a person
  // answering. Nothing is recorded and nothing is revealed.
  if (req.method !== 'GET') return res.status(200).end()

  const q = req.query || {}
  const token = typeof q.t === 'string' ? q.t.trim() : ''
  const surveyKey = typeof q.q === 'string' ? q.q.trim() : ''
  const answerCode = typeof q.a === 'string' ? q.a.trim() : ''

  const survey = getSurvey(surveyKey)
  const option = getOption(surveyKey, answerCode)

  // A malformed link is the person's dead end, not a debugging surface. It says
  // what to do instead and says nothing about why it failed.
  if (!TOKEN_RE.test(token) || !survey || !option) {
    return res.status(400).send(page({
      heading: 'That link did not work.',
      body: 'It may have been altered on the way through, or it belongs to an older email.',
      note: 'Replying to the email works just as well — it reaches a person.',
    }))
  }

  // Defence 1: a client that does not ask for HTML is not a person reading a
  // page. It gets the same page, and nothing is written.
  const accept = String(req.headers.accept || '')
  const looksHuman = accept.includes('text/html')

  try {
    const rows = await sql`SELECT id, email FROM users WHERE survey_token = ${token} LIMIT 1`
    const user = rows[0]
    if (!user) {
      return res.status(404).send(page({
        heading: 'That link did not work.',
        body: 'It may belong to an account that has since been closed.',
        note: 'Replying to the email works just as well — it reaches a person.',
      }))
    }

    if (looksHuman) {
      // Defence 2: one row per person per survey, last click wins.
      // source_record is the user id, so UNIQUE (source, source_record) does the
      // work — no read-then-write race, and a correction is just another click.
      const eventId = `survey:${survey.key}:${user.id}`
      const userAgent = String(req.headers['user-agent'] || '').slice(0, 300)
      await sql`
        INSERT INTO feedback_event
          (id, source, source_record, user_id, email, created_at, body,
           surface, sentiment, solicited, extras)
        VALUES
          (${eventId}, ${'survey-' + survey.key}, ${user.id}, ${user.id}, ${user.email}, NOW(), ${option.label},
           ${survey.surface}, ${option.sentiment}, true,
           ${JSON.stringify({ answer: option.code, prompt: survey.prompt, user_agent: userAgent })}::jsonb)
        ON CONFLICT (source, source_record) DO UPDATE
          SET body = EXCLUDED.body,
              sentiment = EXCLUDED.sentiment,
              created_at = NOW(),
              extras = EXCLUDED.extras`
      console.log('survey/respond', { survey: survey.key, answer: option.code })
    }

    // Someone who says they will be back has told us something the other
    // answers do not: they still intend to use it. That intention is never
    // higher than in the second after they clicked, so this branch hands them
    // the door instead of a receipt.
    if (option.returnLink) {
      return res.status(200).send(page({
        heading: "Good, glad you're coming back.",
        body: 'Your work is saved exactly where you left it.',
        note: '<a href="https://reimagine.career.club/" style="font-weight:600">Pick up where you left off &rarr;</a>',
      }))
    }

    // "Something else" has no useful follow-up on a click, so it points at the
    // reply path rather than pretending a button captured the whole answer.
    const note = option.code === 'other'
      ? 'If you have a minute, hit reply on that email and tell us what it was. It goes straight to Bob.'
      : 'Changed your mind, or picked the wrong one? Click a different answer in the email — the latest one is the one we keep.'

    return res.status(200).send(page({
      heading: "Thanks, that's useful and I'll take it into account.",
      body: `You told us: <strong>${option.label}</strong>`,
      note,
    }))
  } catch (err) {
    console.error('survey/respond: failed', err && err.message)
    // The answer is lost, and saying so is better than a thank-you for
    // something that did not save.
    return res.status(500).send(page({
      heading: 'Something went wrong on our end.',
      body: 'Your answer did not save. Nothing you did caused this.',
      note: 'Replying to the email works just as well — it reaches a person.',
    }))
  }
}
