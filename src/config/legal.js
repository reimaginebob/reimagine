// Current published versions. Bump these when the agreement text is updated.
export const PRIVACY_VERSION = "2026-09-16";
export const TOS_VERSION = "2026-09-11";

// Latest MATERIAL version. Set this equal to the current version only when
// the change is material (substantive changes to data use, retention, sharing,
// AI processing, user rights, scope of use, liability, or governing law).
// For minor changes (typos, contact info updates, clarifications that do not
// change rights or obligations), bump PRIVACY_VERSION / TOS_VERSION but leave
// the corresponding _MATERIAL constant on the previous value.
//
// 2026-09-16: PRIVACY_VERSION bumped, PRIVACY_VERSION_MATERIAL deliberately
// left on the prior value pending Bob's own read on materiality -- see the
// donor-economics PR description. The new paragraph discloses a new source
// (a donation made on Stripe's own page) but does not change what a user can
// do or expect inside the product itself, and nothing about the new use
// (an aggregate count and a timing bucket, never a per-account display) is a
// materially different promise than the account-linked "record of ... your
// activity" this document already made in Section 1. If that reasoning is
// wrong, bump this constant too and every existing account will be asked to
// re-accept on next login.
export const PRIVACY_VERSION_MATERIAL = "2026-06-24";
export const TOS_VERSION_MATERIAL = "2026-09-11";

// One-time acknowledgment gate on the Offer & Negotiation card (src/App.jsx).
// Bump this if the disclaimer text changes materially -- accounts that
// already accepted an older version will be asked again.
export const OFFER_DISCLAIMER_VERSION = "2026-09-11";
