# Support Reimagine: move to the top of the sidebar, make it visibly distinct, and teach My Coach it exists

Date: 2026-09-11. Status: READY FOR CODE. Verified against main at fe0a987.

## Goal

Someone who wants to give should find the entry without hunting, on any screen, before or after the Personal Brand is built, on desktop and in the mobile drawer. Someone who asks My Coach "how do I support this" or "is there a cost" should get the right answer with the card's location in it. The ask stays permission-first (SUPPORT_PANEL_COPY is untouched). What changes is findability and Coach grounding.

## Current state

- src/App.jsx ~6968-6982: supportItemStyle and the supportRail fragment (divider + heart row + SupportPanel mount). Rendered at {supportRail} on ~7102 (dashboard shape, after Inputs) and ~7151 (orientation shape, after PHASES). Bottom of the rail in both.
- SUPPORT_ANNOUNCEMENT_COPY.body (~6871) ends "Look for Support Reimagine in the sidebar."
- src/coach-routing.js FEATURE_MAP: no entry for Support Reimagine, so the generated src/coach-nav-map.js never names it.
- src/data/user-guide/*.md: zero mentions. faq-and-troubleshooting.md lines 14-15: "**Is there a cost?** No, not today. Reimagine is in active beta and free to use." This is what Coach is grounded on.
- scripts/test-coach-routing.mjs ~106 asserts CANONICAL_FEATURE_SLUGS.length === 25.
- Support Reimagine is not flag-gated; every account sees it, so it belongs in the guide.

## Files

src/App.jsx; src/coach-routing.js; scripts/lib/render-coach-nav-map.mjs; src/coach-nav-map.js (generated); scripts/test-coach-routing.mjs; src/data/user-guide/faq-and-troubleshooting.md plus PDF-SOURCE.hash and the published PDF via npm run build:user-guide-pdf; Output/docs/reimagine-system-documentation/ Ch.11.

## Part A: sidebar

A1. Replace supportItemStyle + supportRail (~6976-6982) with a card. Same single fragment used by both shapes, same local supportOpen state, same data-support-nav, same SupportPanel mount. Only markup and style change:

```jsx
  // Always-on Support Reimagine entry. Pinned to the TOP of the rail in both
  // sidebar shapes (dashboard and the linear PHASES flow) since 2026-09-11:
  // it sat at the bottom, below Inputs, and a user who wanted to give could not
  // find it. Styled as a card rather than a rail row so it reads as a different
  // kind of thing from the navigation under it: solid gold border and a filled
  // heart, which no other row has. It does not route through onNav (its id is
  // not a real step); it opens the support overlay via local state, leaving
  // `step` untouched so the user keeps their place. In demo mode the whole rail
  // is wrapped in pointerEvents:none by the caller, so the entry shows but is
  // inert during the guided tour.
  const supportCardStyle=(active)=>({margin:'0 14px 12px',padding:'11px 12px',display:'flex',alignItems:'center',gap:10,cursor:'pointer',borderRadius:8,background:active?`${C.gold}45`:'rgba(200,146,74,0.22)',border:`1.5px solid ${C.gold}`,transition:'all 0.15s'})
  const supportRail=<>
    <div data-support-nav onClick={()=>setSupportOpen(true)} style={supportCardStyle(supportOpen)}>
      <Heart size={17} color={C.gold} fill={C.gold}/>
      <div style={{flex:1}}>
        <div style={{fontSize:17,fontWeight:700,color:'#FFFFFF'}}>{SUPPORT_PANEL_COPY.navLabel}</div>
        <div style={{fontSize:15,color:'#B0BEDE',marginTop:1}}>{SUPPORT_PANEL_COPY.navSubline}</div>
      </div>
    </div>
    {supportOpen&&<SupportPanel onClose={()=>setSupportOpen(false)}/>}
  </>
```

The old divider above the row goes away with it. Sizes 17/15 match the pinned My Coach and Job Search Resources rows on the orientation rail; the difference from those rows is the solid 1.5px border (they use 1px at 35% alpha), the 22% tint (they use 12%), and the filled heart.

A2. Add navSubline to SUPPORT_PANEL_COPY (~6839), right after navLabel:

```js
  navLabel:'Support Reimagine',
  navSubline:'Free to use, help keep it that way',
```

A3. Move the mount to the top in both shapes. Dashboard shape (~7059): render {supportRail} as the first child of the rail div, before <div style={sectionHeaderStyle}>Your work</div>; delete the {supportRail} at ~7102. Orientation shape (~7106): render {supportRail} as the first child of the rail div, before the pinned My Coach row; delete the {supportRail} at ~7151. The rail has padding:'16px 0' and the card carries margin:'0 14px 12px', so it sits 16px from the top and 12px above what follows.

A4. Announcement copy. In SUPPORT_ANNOUNCEMENT_COPY.body (~6871), replace the final sentence "Look for Support Reimagine in the sidebar." with "It's the gold card at the top of the sidebar."

A5. Nothing else in the panel changes: SupportPanel, body paragraphs, quote, Stripe links, the openSupportReq bump from the announcement CTA are all untouched.

## Part B: My Coach

B1. src/coach-routing.js: extend the header comment's reach list with

```
//   'always-on'   — not a step and not gated: a card pinned to the top of the
//                   sidebar on every screen that opens a panel. Carries an
//                   inline `label` + `where` (no NAV_LABELS entry to join).
```

and append this entry to FEATURE_MAP after job-search-resources:

```js
  // Support Reimagine (2026-09-11). Not a step: a card at the top of the rail
  // that opens the voluntary-support panel. Listed here because a user who
  // asked Coach how to give was told nothing existed; the guide FAQ carries the
  // same facts, this is the pointer.
  { slug: 'support-reimagine',    reach: 'always-on',   label: 'Support Reimagine',
    where: 'the gold card with a heart at the very top of the left sidebar, above My Coach and everything else, on every screen and every track; it opens a panel rather than a new screen, so nobody loses their place',
    does: 'is the one place a person can choose to give back. Reimagine is free and stays free, nothing in it is gated on giving, and someone in a search without a paycheck should use it as much as they want with no expectation of payment. If they have found value and have the capacity, the panel offers one-time gifts ($20, $50, $100, or an amount they choose) and a $10 monthly option, each opening a Stripe checkout page in a new tab. The reason asking helps: AI tokens are expensive and Reimagine is token-intensive, so every contribution pays it forward for the next person. When someone asks how to support, donate, pay, tip, contribute, or give back, or whether there is a cost, this is the answer, and say where the card is' },
```

B2. scripts/lib/render-coach-nav-map.mjs: add `const alwaysOn = FEATURE_MAP.filter(f => f.reach === 'always-on')` beside the other filters, and insert between the opportunity group and the community group:

```js
    '',
    'This is not a step and is never gated. It is a card pinned to the top of the left sidebar on every screen, and it opens a panel. Point someone straight to it by name and say where it is:',
    ...alwaysOn.map(line),
```

Then npm run gen:coach-nav-map to rewrite src/coach-nav-map.js (check-coach-nav-map.mjs fails the build otherwise).

B3. scripts/test-coach-routing.mjs: change the count assertion to 26, update its comment to name Support Reimagine as the 26th, and add beside the community/opportunity shape checks:

```js
ok('always-on features carry an inline label + where (a pinned card, no NAV_LABELS join)',
  FEATURE_MAP.filter(f => f.reach === 'always-on').every(f => f.label && f.where && !f.labelId))
```

B4. src/data/user-guide/faq-and-troubleshooting.md, "Getting started": replace the "Is there a cost?" entry (lines 14-15) with:

```md
**Is there a cost?**
No. Reimagine is free to use, and if you are in a job search and feeling the pinch of no paycheck, please use it as much as you want with no expectation of payment. Nothing in Reimagine is gated on whether you give.

**How do I support Reimagine?**
If it has been useful and you have the capacity, the gold Support Reimagine card at the top of the left sidebar opens a panel with one-time options ($20, $50, $100, or an amount you choose) and a $10 monthly option. Each opens a Stripe checkout page in a new tab. AI tokens are what Reimagine costs to run, so every contribution helps keep it free for the next person.
```

No other chapter changes. No What's New note.

B5. npm run build:user-guide-pdf; commit the regenerated PDF and PDF-SOURCE.hash with the chapter change so check-user-guide-pdf.mjs passes.

## Guidance visual treatment (CLAUDE.md §8)

Does not apply. The subline is a navigation label, not an instruction, and the FAQ text is guide prose rendered by the guide viewer. No CoachingCallout added or removed.

## Verification

- npm run build clean (prebuild runs check-voice 0/0, check-prompt-refs 0, check-coach-nav-map current, check-fontsize on the new 17/15 sizes, check-btn-prominence, check-guide-refs, check-user-guide-pdf, then npm run test and npm run lint).
- scripts/test-coach-routing.mjs passes at 26 slugs with the new shape assertion.
- src/App.jsx EOF integrity: line count differs only by the lines this brief adds and removes; last line is the same closing as before.
- Diff scope limited to the files named above plus the regenerated src/coach-nav-map.js, PDF, and hash.
- Preview smoke, both sidebar shapes: a fresh account before Personal Brand shows the card above My Coach; an account with a Personal Brand shows the card above "Your work". Click opens the panel; closes on × and backdrop; step unchanged after close. Mobile drawer: card is the first thing visible when the drawer opens. Announcement "Take a look" still opens the panel.
- Coach smoke on preview, signed in: ask "How do I support Reimagine?" and "Is there a cost?" and confirm the reply names the gold card at the top of the sidebar and the amounts, without inventing a paywall.

## Commit message

```
Pin Support Reimagine to the top of the sidebar and teach Coach it exists

The entry sat at the bottom of both rails, below Inputs, and a user who
wanted to give could not find it. It is now a gold-bordered card with a
filled heart at the top of the rail in both sidebar shapes, with a one-line
subline. The announcement popup points at the new location.

Coach had no grounding for it: no FEATURE_MAP entry and no guide mention,
and the FAQ still said "in active beta and free." Adds an always-on group
to the coach nav map, rewrites the cost FAQ, and adds a how-to-support
entry. Guide PDF rebuilt.
```

## Push

Follow CLAUDE.md §9 (gh branch, PR, CI, merge). §4's "push direct to main" line still contradicts §9; Bob's call, not resolved here.

## System Documentation update

Output/docs/reimagine-system-documentation/ Ch.11 changelog: one entry dated 2026-09-11 naming the sidebar move, the always-on reach value in FEATURE_MAP, and the FAQ rewrite. If the sidebar chapter describes rail order, update it there too.

## User Guide update

Covered in B4 and B5; ships in the same PR.
