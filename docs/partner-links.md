# Partner links: how to tag them and where to read the results

**For:** Bob, and anyone helping him hand out links to partner organizations.
**Shipped:** 2026-09-18 (PR #952).

---

## The one-line version

Put `?via=` and a short tag on the end of the Reimagine address, give that
link to a partner, and every account that signs up through it gets counted
against that partner by name.

```
https://reimagine.career.club/?via=pwc-alumni
```

That's the whole mechanism. There is no setup step, no list to add the
partner to, and no code change. Invent the tag, put it in the link, hand it
over.

---

## Making a link

1. Start with `https://reimagine.career.club/`
2. Add `?via=` on the end
3. Add a tag you'll recognise later

**Examples:**

| Partner | Link |
|---|---|
| PwC alumni network | `https://reimagine.career.club/?via=pwc-alumni` |
| HBS Boston chapter | `https://reimagine.career.club/?via=hbs-boston` |
| A job search group in Dallas | `https://reimagine.career.club/?via=dallas-jobseekers` |
| A specific newsletter issue | `https://reimagine.career.club/?via=nl-2026-10` |

The partner puts that link in whatever they're already sending out — a
flyer, a newsletter blurb, a LinkedIn post, an email to members.

### What makes a valid tag

- Lowercase letters, numbers, and hyphens
- Between 2 and 40 characters
- Must start with a letter or a number, not a hyphen

Typed with capitals or stray spaces, it gets tidied up automatically:
`  PwC-Alumni ` becomes `pwc-alumni`. So you don't have to be careful about
that part.

**Not allowed:** spaces, underscores, punctuation, accents. `pwc_alumni`,
`PwC Alumni` and `pwc-alumni!` are all rejected.

### If a tag is wrong, nothing breaks

A malformed tag is quietly ignored. The person still signs up perfectly
normally; their account just carries no partner tag. A typo in a flyer costs
you the attribution for those signups, never the signups themselves.

### Pick tags you'll still recognise in six months

Nothing enforces a naming style, so pick one and stick to it. A reasonable
default is `organization-place` or just `organization`:
`pwc-alumni`, `kellogg-chicago`, `mit-sloan`. Keep a list somewhere of which
tag went to whom — the dashboard shows you the tag, not the partner's name,
so `hbs-b-26` will mean nothing later if you didn't write it down.

---

## Where to see the results

**Admin dashboard → Growth → "Signups by partner link"**

Each row is one tag, with:

- how many accounts arrived on it
- the date of the first signup
- the date of the most recent signup

Only tags with at least one signup appear. A partner you gave a link to
yesterday who hasn't sent anyone yet simply won't be listed — that's not a
fault, there's just nothing to show.

Your own admin and test addresses are left out of the counts. That's the
`ADMIN_EMAILS` setting in Vercel — a specific list of addresses, not
everyone with a `@career.club` address. If you test with an address that
isn't on that list, it will show up in the numbers.

---

## How it behaves, and why

**The first link wins.** If someone clicks a PwC link today and a different
partner's link next week, the account is credited to PwC. The tag records how
that person first found Reimagine, so a later click can't take credit for
someone who was already on their way in.

**It survives the gap between reading and signing up.** Someone can read a
newsletter on Monday, think about it, and sign up the following weekend, and
the tag still holds. It's remembered in their browser for **30 days** after
the click. Past 30 days it's forgotten, and a signup then counts as
untagged — better than crediting a partner for someone who arrived some
other way months later.

**New accounts only.** The tag is set once, when the account is created.
Someone who already has an account and clicks a partner link is not
re-tagged.

**It's tied to the browser, not the person.** Someone who clicks on their
phone and signs up on their laptop won't be tagged — the laptop never saw
the link. Nothing can be done about that; it's worth knowing when a partner's
numbers look lower than their reach would suggest.

---

## This is not the same as "How did you hear about us?"

Two different things that are easy to confuse:

| | What it is |
|---|---|
| **Signups by partner link** | Which link they actually **clicked**. Recorded automatically. |
| **Where signups came from** | What they **said** when the signup form asked. Self-reported. |

Both live on the Growth dashboard, in neighbouring panels. They're kept apart
on purpose so they can be compared. Someone might arrive on the PwC link and
still answer "Someone recommended it" — both facts are true and both are
worth knowing.

There's also a signup-form answer that reads **"A job search group or alumni
network,"** added at the same time. It's related but separate: it's what the
person says, not which link they came in on.

---

## If a tag isn't showing up

Work down this list:

1. **Has anyone actually signed up through it yet?** Empty tags don't appear.
2. **Check the link for typos.** `?via=` needs the question mark, and the tag
   needs to follow the rules above. Paste the link into a browser and look at
   the address bar.
3. **Is that address on the admin-exclusion list?** Addresses in the
   `ADMIN_EMAILS` setting are filtered out of the dashboard counts.
4. **Did that person already have an account?** Existing accounts don't get
   tagged.
5. **More than 30 days between their click and their signup?** The tag will
   have expired.
6. **Did they click on one device and sign up on another?** Not recoverable.

If none of those explain it, it's worth a look at the code.

---

## For whoever works on the code next

| What | Where |
|---|---|
| Tag format rules, storage key, expiry window | `src/referral-partner.js` |
| Read from the URL, first-touch capture, sent at signup | `src/App.jsx` |
| Written onto the pending signup | `api/auth/request-link.js` |
| Copied onto the account when it's created | `api/auth/verify.js` |
| Dashboard query | `api/admin/growth.js` (section 11b) |
| Dashboard table | `src/GrowthDashboard.jsx` |
| Database columns | `migrations/2026-09-16_referral-partner.sql` |
| Tests | `scripts/test-referral-partner.mjs` |

Two things not to undo without meaning to:

- **`pe_via` is deliberately left alone by `clearAccountLocalState()`.** The
  tag belongs to the browser that clicked the partner link, not to whoever
  happens to be signed in. Clearing it on sign-out would mean a second
  account on a shared browser loses the attribution the first one arrived
  with.
- **The tag is format-checked, not checked against a list.** That's what
  makes adding a partner free. A canonical list would mean a code change and
  a deploy every time Bob signs one up.
