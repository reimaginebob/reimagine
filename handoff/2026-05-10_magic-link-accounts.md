# Reimagine Magic-Link Accounts: Handoff Brief

**Status:** Ready to execute. First V2 brief, ships standalone in the existing beta. No paywall, no entitlements, no gating. Pure quality-of-life upgrade: cross-device session persistence. **Repo:** github.com/reimaginebob/reimagine **Working directory:** `C:\Users\bobgo\Documents\reimagine` **Branch:** `main` (Vercel auto-deploys on push) **Estimated effort:** 1 to 2 weeks of focused Code work, larger than any May 9 brief.

---

## Goal

End the localStorage-only era for Reimagine. Today every beta user's profile, outputs, and corrections live in their browser. If they switch devices, they lose everything. If they clear cookies, they lose everything. About 20 active beta users plus an unknown number of returning visitors who came back on a different device and bounced.

This brief adds email \+ magic-link authentication, a Neon Postgres backend for user accounts and profile state, and an automatic sync layer between the existing localStorage profile shape and the server. Existing beta users get a one-time prompt offering to save their work across devices; on accept, their localStorage state uploads into a newly-created account. New signups go through the same magic-link flow and get account-backed persistence from day one.

What this brief does NOT add: anything paywall-related, Stripe, entitlements, account-required gating, or the "this feature is for paying users only" model. Accounts are universal and free for the entire beta and into V2 launch. Paywall integration ships as a separate brief once accounts are stable.

---

## Locked decisions (do not re-litigate without flagging)

- **ESP: Resend.** Account already provisioned by Bob. Use the official Resend Node SDK (`resend` on npm).  
- **Database: Neon.** Account already provisioned. Use `@neondatabase/serverless` HTTP driver, which works cleanly inside Vercel serverless functions without connection pooling issues.  
- **Phasing: one brief.** Auth infrastructure plus profile sync plus UI integration ship as one coherent unit. No half-done states.  
- **Migration: opt-in claim flow for existing users.** Local-first remains the default for unsigned users; signed-in users get sync. Existing localStorage profiles see a one-time "Save your work across devices" prompt that, on accept, creates an account and uploads the local state.  
- **Session model: DB-backed.** Session token stored in Neon, validated on each authenticated request. Easy to revoke, easy to reason about.  
- **Profile storage shape: JSONB blob on users table.** Mirrors the existing `pe_v3` localStorage object exactly. No schema migration when we add fields. Corrections data stays in its own table per the existing corrections-metadata pipeline (separate from this).

---

## Files (new and modified)

**New API endpoints (Vercel serverless functions):**

- `api/auth/request-link.js`: POST, generate token, send email  
- `api/auth/verify.js`: GET, validate token, set session cookie, redirect  
- `api/auth/logout.js`: POST, delete session, clear cookie  
- `api/me.js`: GET, return current user  
- `api/profile/load.js`: GET, return user's profile JSONB  
- `api/profile/save.js`: PUT, update user's profile JSONB

**New shared utility files:**

- `api/_lib/db.js`: Neon client wrapper  
- `api/_lib/session.js`: session token generation, cookie helpers, auth middleware  
- `api/_lib/email.js`: Resend client \+ magic link email template

**New SQL migration:**

- `db/migrations/001_init.sql`: schema for users, sessions, magic\_link\_tokens

**Modified:**

- `src/App.jsx`: sign-in UI, profile sync logic, migration prompt  
- `vercel.json`: add rewrite for `/auth/verify` to `/api/auth/verify`  
- `package.json`: new dependencies: `resend`, `@neondatabase/serverless`

**No changes:** existing claude.js (LLM proxy), the beta-signup Apps Script pipeline (keep running in shadow during the transition for Bob's existing tracking habit), corrections logging pipeline.

---

## Pre-step

Before starting:

```shell
cd C:\Users\bobgo\Documents\reimagine
git pull origin main
wc -l src/App.jsx          # baseline line count
```

Bob does these manual setup tasks:

1. **Confirm Resend sender.** In the Resend dashboard, verify which domains and from-addresses are usable. Common picks for the EMAIL\_FROM env var: `Reimagine <hi@career.club>`, `Reimagine <noreply@career.club>`, or `Reimagine <hello@reimagine.career.club>` if a subdomain is verified. Code will need this exact string before setting env vars.  
     
2. **Get the Neon connection string.** From Neon dashboard, copy the pooled connection string (it includes `-pooler` in the host segment). Save for the DATABASE\_URL env var. The non-pooled string also works but the pooled one is recommended for serverless.  
     
3. **Add env vars in Vercel project settings:**  
     
   - `DATABASE_URL` (from Neon, pooled)  
   - `RESEND_API_KEY` (from Resend dashboard)  
   - `EMAIL_FROM` (the verified sender string from step 1\)  
   - `MAGIC_LINK_BASE_URL` set to `https://reimagine2-two.vercel.app` for production  
   - `SESSION_COOKIE_NAME` set to `pe_session`  
   - `SESSION_DAYS` set to `30`

   

   For local dev, Code creates a `.env.local` template file with the same keys (without committing actual values; Bob fills in his local copy).

   

4. **Run the SQL migration** once Code has written it. Bob runs it manually via Neon SQL Editor or `psql`, since automated migrations are out of scope for this brief.

If the working tree is dirty, stop and tell Bob.

---

## Changes

### Change 1: SQL schema (`db/migrations/001_init.sql`)

Create the migration file with this exact content:

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  first_name TEXT,
  last_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMPTZ,
  profile_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  profile_updated_at TIMESTAMPTZ
);

CREATE INDEX idx_users_email ON users (email);
CREATE INDEX idx_users_last_login ON users (last_login_at DESC);

CREATE TABLE sessions (
  token TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_agent TEXT,
  ip_address TEXT
);

CREATE INDEX idx_sessions_user_id ON sessions (user_id);
CREATE INDEX idx_sessions_expires_at ON sessions (expires_at);

CREATE TABLE magic_link_tokens (
  token_hash TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  user_agent TEXT,
  ip_address TEXT
);

CREATE INDEX idx_magic_link_email ON magic_link_tokens (email);
CREATE INDEX idx_magic_link_expires ON magic_link_tokens (expires_at);
```

Bob runs this against the Neon database before the deployed code can authenticate anyone. Code's commit includes the file but does not run it automatically.

### Change 2: Database client (`api/_lib/db.js`)

```javascript
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL)

export { sql }
```

That is the entire file. The neon HTTP driver returns a tagged template literal function that handles all queries. No connection pool to manage.

### Change 3: Session and auth helpers (`api/_lib/session.js`)

```javascript
import crypto from 'node:crypto'
import { sql } from './db.js'

const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME || 'pe_session'
const SESSION_DAYS = parseInt(process.env.SESSION_DAYS || '30', 10)

export function generateToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64url')
}

export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

export function buildCookie(token, maxAgeSeconds, isProd) {
  const parts = [
    `${SESSION_COOKIE_NAME}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAgeSeconds}`,
  ]
  if (isProd) parts.push('Secure')
  return parts.join('; ')
}

export function clearCookie(isProd) {
  const parts = [
    `${SESSION_COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0',
  ]
  if (isProd) parts.push('Secure')
  return parts.join('; ')
}

export function getSessionToken(req) {
  const cookieHeader = req.headers.cookie || ''
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE_NAME}=([^;]+)`))
  return match ? match[1] : null
}

export async function createSession(userId, userAgent, ipAddress) {
  const token = generateToken()
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000)
  await sql`
    INSERT INTO sessions (token, user_id, expires_at, user_agent, ip_address)
    VALUES (${token}, ${userId}, ${expiresAt.toISOString()}, ${userAgent}, ${ipAddress})
  `
  return { token, expiresAt }
}

export async function getSessionUser(req) {
  const token = getSessionToken(req)
  if (!token) return null
  const rows = await sql`
    SELECT u.id, u.email, u.first_name, u.last_name, u.created_at, u.last_login_at
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token = ${token} AND s.expires_at > NOW()
    LIMIT 1
  `
  if (rows.length === 0) return null
  await sql`UPDATE sessions SET last_used_at = NOW() WHERE token = ${token}`
  return rows[0]
}

export async function deleteSession(token) {
  await sql`DELETE FROM sessions WHERE token = ${token}`
}

export function requireAuth(handler) {
  return async (req, res) => {
    const user = await getSessionUser(req)
    if (!user) {
      res.status(401).json({ error: 'Not authenticated' })
      return
    }
    req.user = user
    return handler(req, res)
  }
}

export const SESSION_DAYS_VALUE = SESSION_DAYS
export const SESSION_COOKIE_NAME_VALUE = SESSION_COOKIE_NAME
```

### Change 4: Email helper (`api/_lib/email.js`)

```javascript
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

  await resend.emails.send({
    from: EMAIL_FROM,
    to: email,
    subject,
    text: textBody,
    html: htmlBody,
  })
}
```

Voice rules in the email body: no em dashes, no AI words, no logic-flip cadence, no intensifier filler. Verify before pushing.

### Change 5: Request magic link endpoint (`api/auth/request-link.js`)

```javascript
import { sql } from '../_lib/db.js'
import { generateToken, hashToken } from '../_lib/session.js'
import { sendMagicLinkEmail } from '../_lib/email.js'

const TOKEN_EXPIRY_MINUTES = 15
const RATE_LIMIT_PER_HOUR = 5

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { email, firstName, lastName } = req.body || {}
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return res.status(400).json({ error: 'Invalid email' })
  }
  const normalizedEmail = email.trim().toLowerCase()

  // Rate limit: max 5 magic link requests per email per hour
  const recent = await sql`
    SELECT COUNT(*) AS count FROM magic_link_tokens
    WHERE email = ${normalizedEmail} AND created_at > NOW() - INTERVAL '1 hour'
  `
  if (parseInt(recent[0].count, 10) >= RATE_LIMIT_PER_HOUR) {
    return res.status(429).json({ error: 'Too many requests. Try again later.' })
  }

  const rawToken = generateToken()
  const tokenHash = hashToken(rawToken)
  const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_MINUTES * 60 * 1000)
  const userAgent = req.headers['user-agent'] || ''
  const ipAddress = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || ''

  await sql`
    INSERT INTO magic_link_tokens (token_hash, email, first_name, last_name, expires_at, user_agent, ip_address)
    VALUES (${tokenHash}, ${normalizedEmail}, ${firstName || null}, ${lastName || null}, ${expiresAt.toISOString()}, ${userAgent}, ${ipAddress})
  `

  const baseUrl = process.env.MAGIC_LINK_BASE_URL || 'https://reimagine2-two.vercel.app'
  const link = `${baseUrl}/auth/verify?token=${rawToken}`

  try {
    await sendMagicLinkEmail(normalizedEmail, link, firstName)
  } catch (err) {
    console.error('Resend send failure', err)
    return res.status(500).json({ error: 'Could not send email' })
  }

  return res.status(200).json({ ok: true })
}
```

Note: do not reveal whether the email exists in the system. Same response for new and returning users. Avoids enumeration.

### Change 6: Verify endpoint (`api/auth/verify.js`)

```javascript
import { sql } from '../_lib/db.js'
import { hashToken, createSession, buildCookie } from '../_lib/session.js'

export default async function handler(req, res) {
  const { token } = req.query
  if (!token || typeof token !== 'string') {
    return res.redirect(302, '/?auth=invalid')
  }

  const tokenHash = hashToken(token)
  const rows = await sql`
    SELECT email, first_name, last_name, expires_at, used_at FROM magic_link_tokens
    WHERE token_hash = ${tokenHash}
    LIMIT 1
  `
  if (rows.length === 0) {
    return res.redirect(302, '/?auth=invalid')
  }
  const row = rows[0]
  if (row.used_at) {
    return res.redirect(302, '/?auth=used')
  }
  if (new Date(row.expires_at) < new Date()) {
    return res.redirect(302, '/?auth=expired')
  }

  await sql`UPDATE magic_link_tokens SET used_at = NOW() WHERE token_hash = ${tokenHash}`

  // Find or create user
  const existing = await sql`SELECT id FROM users WHERE email = ${row.email} LIMIT 1`
  let userId
  if (existing.length > 0) {
    userId = existing[0].id
    await sql`UPDATE users SET last_login_at = NOW() WHERE id = ${userId}`
  } else {
    const created = await sql`
      INSERT INTO users (email, first_name, last_name, last_login_at)
      VALUES (${row.email}, ${row.first_name}, ${row.last_name}, NOW())
      RETURNING id
    `
    userId = created[0].id
  }

  const userAgent = req.headers['user-agent'] || ''
  const ipAddress = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || ''
  const { token: sessionToken } = await createSession(userId, userAgent, ipAddress)

  const isProd = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production'
  const SESSION_DAYS = parseInt(process.env.SESSION_DAYS || '30', 10)
  res.setHeader('Set-Cookie', buildCookie(sessionToken, SESSION_DAYS * 24 * 60 * 60, isProd))
  return res.redirect(302, '/?auth=ok')
}
```

### Change 7: Logout endpoint (`api/auth/logout.js`)

```javascript
import { getSessionToken, deleteSession, clearCookie } from '../_lib/session.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const token = getSessionToken(req)
  if (token) await deleteSession(token)

  const isProd = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production'
  res.setHeader('Set-Cookie', clearCookie(isProd))
  return res.status(200).json({ ok: true })
}
```

### Change 8: Me endpoint (`api/me.js`)

```javascript
import { getSessionUser } from './_lib/session.js'

export default async function handler(req, res) {
  const user = await getSessionUser(req)
  if (!user) return res.status(401).json({ user: null })
  return res.status(200).json({ user })
}
```

### Change 9: Profile load endpoint (`api/profile/load.js`)

```javascript
import { sql } from '../_lib/db.js'
import { requireAuth } from '../_lib/session.js'

async function handler(req, res) {
  const rows = await sql`SELECT profile_state, profile_updated_at FROM users WHERE id = ${req.user.id} LIMIT 1`
  if (rows.length === 0) return res.status(404).json({ error: 'User not found' })
  return res.status(200).json({ profile: rows[0].profile_state, updatedAt: rows[0].profile_updated_at })
}

export default requireAuth(handler)
```

### Change 10: Profile save endpoint (`api/profile/save.js`)

```javascript
import { sql } from '../_lib/db.js'
import { requireAuth } from '../_lib/session.js'

async function handler(req, res) {
  if (req.method !== 'PUT' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  const profile = req.body
  if (!profile || typeof profile !== 'object') {
    return res.status(400).json({ error: 'Invalid profile' })
  }

  // Cap payload size at 1 MB to prevent abuse
  const serialized = JSON.stringify(profile)
  if (serialized.length > 1024 * 1024) {
    return res.status(413).json({ error: 'Profile too large' })
  }

  await sql`
    UPDATE users
    SET profile_state = ${profile}::jsonb, profile_updated_at = NOW()
    WHERE id = ${req.user.id}
  `
  return res.status(200).json({ ok: true })
}

export default requireAuth(handler)
```

### Change 11: Vercel rewrite (`vercel.json`)

Add a rewrite so the magic link URL `/auth/verify?token=...` cleanly maps to the API endpoint. If `vercel.json` does not exist, create it. If it exists, merge the rewrite into the existing structure.

```json
{
  "rewrites": [
    { "source": "/auth/verify", "destination": "/api/auth/verify" }
  ]
}
```

### Change 12: `package.json` dependencies

Add to dependencies:

```json
"resend": "^4.0.0",
"@neondatabase/serverless": "^0.9.0"
```

Code runs `npm install` to update `package-lock.json`.

### Change 13: App.jsx integration

Three pieces. Order: sign-in UI replaces the existing signup gate, profile sync hooks into existing autosave logic, migration prompt for existing localStorage users.

**(a) Replace the signup gate with magic-link sign-in.** The existing `if(!signedUp)` block at the welcome step (around line 720 area, where the signup form captures first/last/email and POSTs to the Apps Script) becomes a sign-in form that POSTs to `/api/auth/request-link`.

After submission, show "Check your email: we sent a sign-in link to \[email\]. The link expires in 15 minutes."

The Apps Script POST to the existing signup pipeline stays, fired in parallel with the auth request, so Bob's existing beta signup tracking sheet keeps populating during the transition. Eventually retire the Apps Script POST in a future brief.

**(b) On app load, check for an authenticated session and load profile.** Add a `useEffect` near the existing `pe_v3` localStorage load that runs in parallel:

```
useEffect(() => {
  if (isDemo || isTest) return
  fetch('/api/me', { credentials: 'include' })
    .then(r => r.ok ? r.json() : { user: null })
    .then(data => {
      if (data.user) {
        setSignedInUser(data.user)
        setSignedUp(true)
        // Load profile from server, merge with localStorage
        fetch('/api/profile/load', { credentials: 'include' })
          .then(r => r.ok ? r.json() : null)
          .then(serverProfile => {
            if (serverProfile && serverProfile.profile && Object.keys(serverProfile.profile).length > 0) {
              const d = serverProfile.profile
              if (d.step) setStep(d.step)
              if (d.profile) setProfile(normalizeWork(d.profile))
              if (d.outputs) setOutputs(d.outputs)
              if (d.done) setDone(d.done)
              if (d.deepOpts) setDeepOpts(d.deepOpts)
              if (d.chosen) setChosen(d.chosen)
            }
          })
          .catch(() => {})
      }
    })
    .catch(() => {})
}, [])
```

The merge logic: if both server and localStorage have profile data, server wins (last-write-wins; the server is authoritative when signed in). If only localStorage has data and there is no signed-in user yet, that triggers the migration prompt below.

**(c) Auto-sync to server when signed in.** The existing autosave `useEffect` writes to localStorage every 800ms after a state change. Add a parallel fetch to `/api/profile/save` if `signedInUser` is set:

```
useEffect(() => {
  if (isDemo || isTest) return
  const t = setTimeout(() => {
    try {
      const blob = { step, profile, outputs, done, deepOpts, chosen }
      localStorage.setItem('pe_v3', JSON.stringify(blob))
      if (signedInUser) {
        fetch('/api/profile/save', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(blob),
        }).catch(() => {})
      }
    } catch {}
  }, 800)
  return () => clearTimeout(t)
}, [step, profile, outputs, done, deepOpts, chosen, signedInUser])
```

Note: the Content-Type header on /api/profile/save is fine because it is a same-origin call. The CORS preflight rule that bit us with the Apps Script applies only to cross-origin Apps Script calls. Same-origin fetches to /api/\* on the same domain are not subject to preflight in the way that broke the corrections logging.

**(d) Migration prompt for existing localStorage users.** On app load, if `localStorage.getItem('pe_v3')` exists with non-empty profile data AND there is no signed-in user, show a one-time prompt:

**Save your work across devices**

You can sign up with your email to save your progress. Next time you open Reimagine on any device, your work will be there.

\[Set up sign-in\] \[No thanks\]

If the user clicks "Set up sign-in," show the sign-in form (same form as the gate). On successful authentication, the profile\_save call automatically uploads their localStorage state on the next state change (or fire it explicitly on first sign-in).

If "No thanks," set `localStorage.setItem('pe_migration_dismissed', 'true')` so the prompt does not reappear. Add a "Sign in" link in the sidebar or footer for users who change their mind later.

Implementation choice: render the prompt as a banner above the sidebar or as a one-time modal on the welcome step. Pick whichever fits the existing UI layout cleaner. The brief's preference is the modal, since it forces engagement before the user gets back to flow.

**(e) Sign out affordance.** Somewhere in the existing UI (likely the existing reset/menu area), add a "Sign out" button visible when signedInUser is set. On click: POST /api/auth/logout, clear signedInUser state, navigate to welcome.

### Change 14: Auth status banner / toast

The verify endpoint redirects to `/?auth=ok`, `/?auth=invalid`, `/?auth=used`, or `/?auth=expired`. App.jsx should read the auth query param on mount and show a brief toast or banner:

- `auth=ok`: "Signed in as \[email\]." Auto-dismiss after 4 seconds.  
- `auth=invalid`: "That sign-in link is not valid. Try requesting a new one."  
- `auth=used`: "That sign-in link has already been used. Request a new one."  
- `auth=expired`: "That sign-in link expired. Request a new one."

After reading, strip the query param from the URL with `history.replaceState` so a refresh does not re-trigger the toast.

---

## Verification

This brief is too large for a single smoke test. Walk it through in stages.

**Stage 1: backend isolation.**

1. `npm install` succeeds.  
2. `npm run build` succeeds.  
3. Bob runs the SQL migration in Neon. Confirm three tables exist: users, sessions, magic\_link\_tokens.  
4. Bob sets all six env vars in Vercel.  
5. Deploy. From a curl in the sandbox or Bob's terminal:  
   - `curl -X POST https://reimagine2-two.vercel.app/api/auth/request-link -H "Content-Type: application/json" -d '{"email":"bob@career.club","firstName":"Bob","lastName":"Goodwin"}'` should return `{"ok":true}` and Bob should receive a sign-in email at his inbox.  
   - Click the link. Should redirect to the live app at `/?auth=ok` with a session cookie set.  
   - Hit `https://reimagine2-two.vercel.app/api/me` with the cookie. Should return the user record.  
   - Hit `https://reimagine2-two.vercel.app/api/profile/load` with the cookie. Should return `{"profile": {}, "updatedAt": null}` for a brand-new user.

**Stage 2: end-to-end sign-up flow.**

1. Open Reimagine in an incognito window. Confirm the welcome screen now offers email sign-in instead of the simple capture form.  
2. Enter a test email Bob can read. Submit.  
3. Confirm "Check your email" screen appears.  
4. Open the email. Click the link. Confirm redirect back to the app with the success toast.  
5. Walk through orientation, generate p1. Confirm the experience is identical to the pre-account experience.  
6. Open another incognito window or different browser. Sign in with the same email (request a new magic link). Click. Confirm the profile state appears on the new device with the same step, outputs, and progress.

**Stage 3: existing user migration.**

1. Open the app in a Chrome profile that already has `pe_v3` localStorage (a real beta-user session, or seed a test session manually).  
2. On load, confirm the migration prompt appears.  
3. Click "Set up sign-in." Enter email. Verify magic link. Click.  
4. After signing in, confirm the existing profile state is preserved on the server. Hit /api/profile/load. Should match the localStorage state.  
5. Open the same account in another browser. Confirm the migrated state appears.  
6. In a separate test, dismiss the migration prompt with "No thanks." Confirm `pe_migration_dismissed` is set in localStorage. Reload. Confirm the prompt does not reappear.

**Stage 4: edge cases.**

1. Request a magic link, do not click it for 16 minutes. Click. Confirm `/?auth=expired` toast.  
2. Request a magic link, click it, then click the same link again. Confirm `/?auth=used` toast on the second click.  
3. Request 6 magic links to the same email within an hour. Confirm the 6th request returns 429\.  
4. Sign in, click sign out. Confirm the cookie is cleared and /api/me returns 401\.  
5. Try to call /api/profile/save without a session cookie. Confirm 401\.

**Stage 5: voice and copy audit.**

1. Read every user-facing string added: sign-in form labels and helper text, "Check your email" screen, magic link email subject and body (text and HTML), all four auth toasts, the migration prompt copy, the sign-out button label.  
2. Confirm: zero em dashes anywhere, zero AI words from the banned list, zero logic-flip cadence, zero intensifier filler.

`git diff` and `wc -l src/App.jsx` as usual.

---

## Report-back conditions

Surface before pushing if you hit any of:

- A package-version compatibility issue between Vercel's Node runtime and the Resend or Neon SDK versions.  
- The existing signup gate (around line 720, `if(!signedUp)`) has been refactored since 2026-05-10 and the replacement integration is not as straightforward as the brief assumes.  
- The autosave `useEffect` at line 684 has been refactored or merged with other state, so the parallel server save needs a different integration point.  
- The profile blob on the server side is too large under any realistic walkthrough (sustained over the 1 MB cap). If users hit this, the write should still succeed but log a warning, since profile data shape may need normalization in a follow-up.  
- The migration prompt creates a UX dead-end (e.g., user clicks "Set up sign-in," requests link, but cannot reach back to the app to continue working while waiting for the email).  
- Vercel's redirect behavior for the verify endpoint behaves differently than expected (e.g., the cookie does not stick across the redirect).

In any case, stop and report. This is the largest brief in the V2 sequence and a bad commit on main is more disruptive than the May 9 batches.

---

## What this brief explicitly does NOT cover

- Stripe paywall integration. Separate brief.  
- Entitlement records. Separate brief.  
- Account-required gating on any feature. Accounts are universal and free in this brief.  
- OAuth providers (Google sign-in, etc.). Magic-link only for V1.  
- Account settings page beyond a sign-out button.  
- Email change flow.  
- Account deletion (Bob handles manually via Neon SQL until V1.5).  
- Cross-device conflict resolution beyond last-write-wins. If two devices edit simultaneously, the last save wins. Acceptable for V1.  
- Auto-cleanup of expired magic\_link\_tokens or sessions. Add a cron job or scheduled task in a follow-up; for V1, the tables grow but indexes keep queries fast.  
- Retiring the existing Apps Script signup pipeline. Keep it firing in shadow during this brief; retire in a follow-up once the Neon-based signups are proven for 2 to 4 weeks.  
- Migrating existing corrections logged in the corrections-log Sheet into the database. Stays in the Sheet for V1; folds into V2 Postgres in a follow-up brief.

---

## Commit message

```
Add magic-link accounts: Neon Postgres backend, Resend email,
session-based auth, profile sync, opt-in migration for existing users

First V2 brief. Ships standalone in beta with no paywall, no
entitlements, no gating. Pure quality-of-life upgrade: cross-device
session persistence.

Database (Neon):
- users table with profile_state JSONB blob mirroring pe_v3 localStorage
- sessions table for DB-backed sessions, 30-day expiry
- magic_link_tokens table for one-time sign-in tokens, 15-min expiry,
  hashed at rest

API endpoints (Vercel serverless):
- POST /api/auth/request-link: rate-limited (5/hour/email), generates
  token, sends email via Resend, never reveals whether email exists
- GET /api/auth/verify: validates one-time token, find-or-creates user,
  sets httpOnly secure SameSite=Lax cookie, redirects to app with
  status query param
- POST /api/auth/logout: deletes session row, clears cookie
- GET /api/me: returns current user or 401
- GET /api/profile/load: returns profile JSONB for authenticated user
- PUT /api/profile/save: updates profile JSONB, 1 MB cap

App.jsx:
- Sign-in form replaces the localStorage-only signup gate
- /api/me check on app load auto-restores signed-in state
- /api/profile/load merges server profile into local state on sign-in
- Autosave useEffect parallel-writes to /api/profile/save when signed in
- Migration prompt for existing localStorage users (one-time, dismissible)
- Sign-out button when signed in
- Auth status toasts via /?auth=... query param

Existing systems unchanged: claude.js LLM proxy, beta-signup Apps Script
pipeline (kept firing in shadow), corrections logging pipeline.

Locked decisions for this brief: ESP=Resend, DB=Neon, one bundled brief,
opt-in migration for existing users, DB-backed sessions, JSONB profile
blob (vs typed tables).

Source: V2 launch plan Phase 1 (foundation infrastructure) + Phase 2
(auth). Stripe paywall is a separate brief.
```

---

## Push

Direct push to `main`. Vercel auto-deploys. Bob completes the manual setup steps (run SQL migration in Neon, set env vars in Vercel) before deploy can authenticate anyone. Email sender domain in Resend must be verified before the first magic link will deliver.

After the first successful end-to-end sign-in (Stage 2 of verification), the brief is shipped. Migration of existing beta users happens organically as they return to the app and see the prompt.  
