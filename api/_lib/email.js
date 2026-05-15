import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const EMAIL_FROM = process.env.EMAIL_FROM

export async function sendMagicLinkEmail(email, link, firstName) {
  const greeting = firstName ? `Hi ${firstName},` : 'Hi,'
  const subject = 'Sign in to Reimagine'
  const textBody = `${greeting}

Click this link to sign in to Reimagine:

${link}

The link expires in 15 minutes. If you did not request this, you can ignore this email.

Career Club
`
  const htmlBody = `<!DOCTYPE html><html><body style="font-family: Georgia, serif; color: #1A2540; line-height: 1.6; max-width: 560px; margin: 0 auto; padding: 32px 16px;">
<p>${greeting}</p>
<p>Click the button below to sign in to Reimagine.</p>
<p style="margin: 32px 0;">
<a href="${link}" style="display: inline-block; background: #C8924A; color: #FFFFFF; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600;">Sign in to Reimagine</a>
</p>
<p style="font-size: 14px; color: #6B7280;">Or copy and paste this link into your browser:<br><span style="word-break: break-all;">${link}</span></p>
<p style="font-size: 14px; color: #6B7280;">The link expires in 15 minutes. If you did not request this, you can ignore this email.</p>
<p style="font-size: 13px; color: #9CA3AF; margin-top: 32px;">Career Club</p>
</body></html>`

  const { data, error } = await resend.emails.send({
    from: EMAIL_FROM,
    to: email,
    subject,
    text: textBody,
    html: htmlBody,
  })

  if (error) {
    const message = error.message || JSON.stringify(error)
    throw new Error(`Resend send failed: ${message}`)
  }

  console.log('Resend send ok', { id: data?.id, to: email })
  return data
}

// Legal-update notification. Built for future material changes to the Privacy
// Agreement or Terms of Service. NOT sent to production users in this release.
// The send mechanism (api/account/send-legal-update.js) is admin-only and
// targets only the requesting admin's own address for verification.
//
// summary: plain-language description of what changed (hardcoded per bump).
// docs: { privacy: boolean, terms: boolean } which agreement(s) changed.
export async function sendLegalUpdateEmail(email, summary, docs, firstName) {
  const greeting = firstName ? `Hi ${firstName},` : 'Hi,'
  const which =
    docs.privacy && docs.terms
      ? 'Privacy Agreement and Terms of Service'
      : docs.privacy
        ? 'Privacy Agreement'
        : 'Terms of Service'
  const subject = `We've updated our ${which}`
  const links = []
  if (docs.privacy) links.push('Privacy Agreement: https://reimagine.career.club/privacy')
  if (docs.terms) links.push('Terms of Service: https://reimagine.career.club/terms')

  const textBody = `${greeting}

We've updated our ${which}.

${summary}

You can read the full updated ${docs.privacy && docs.terms ? 'agreements' : 'agreement'} here:

${links.join('\n')}

The next time you sign in to Reimagine, we will ask you to review and confirm you agree to the updated ${docs.privacy && docs.terms ? 'agreements' : 'agreement'} before continuing.

Career Club
`

  const linkButtons = []
  if (docs.privacy)
    linkButtons.push(
      '<p style="margin: 12px 0;"><a href="https://reimagine.career.club/privacy" style="color: #C8924A;">Read the updated Privacy Agreement</a></p>'
    )
  if (docs.terms)
    linkButtons.push(
      '<p style="margin: 12px 0;"><a href="https://reimagine.career.club/terms" style="color: #C8924A;">Read the updated Terms of Service</a></p>'
    )

  const htmlBody = `<!DOCTYPE html><html><body style="font-family: Georgia, serif; color: #1A2540; line-height: 1.6; max-width: 560px; margin: 0 auto; padding: 32px 16px;">
<p>${greeting}</p>
<p>We've updated our ${which}.</p>
<p>${summary}</p>
${linkButtons.join('\n')}
<p style="font-size: 14px; color: #6B7280;">The next time you sign in to Reimagine, we will ask you to review and confirm you agree to the updated ${docs.privacy && docs.terms ? 'agreements' : 'agreement'} before continuing.</p>
<p style="font-size: 13px; color: #9CA3AF; margin-top: 32px;">Career Club</p>
</body></html>`

  const { data, error } = await resend.emails.send({
    from: EMAIL_FROM,
    to: email,
    subject,
    text: textBody,
    html: htmlBody,
  })

  if (error) {
    const message = error.message || JSON.stringify(error)
    throw new Error(`Resend legal-update send failed: ${message}`)
  }

  console.log('Resend legal-update send ok', { id: data?.id, to: email })
  return data
}
