# Reference: LinkedIn Remix (and sibling) JSON key-drift fix

**Date:** 2026-08-11
**Type:** Reference / handoff (work already shipped — this is context for a sibling Code session, not a new brief)
**Status:** SHIPPED and verified on production. Do NOT re-implement.

---

## Why you're reading this

A sibling Code session was pointed here in regards to the **LinkedIn JSON rendering issue** (LinkedIn Remix card showing raw JSON instead of formatted content). That specific bug is already fixed and merged. This doc gives you the full context so you can reference, extend, or avoid re-doing it — and so you inherit the reusable pattern if you touch any structured-JSON prompt.

## The bug (symptom)

LinkedIn Remix (p8) rendered as a **raw JSON dump** instead of the formatted card. The `skills_delta` keys showed mangled: `resumemissingfrom_linkedin`, `linkedinnoton_resume`, `targetroledemanded_absent` (while `both_underweighted` survived), and the top-level `what_to_do` came back as `whattodo`, silently dropping the "What to do" section.

Same failure hit two sibling surfaces:
- **Go-to-Market (p7):** empty card (the wavetechnology "empty GTM output" report).
- **Interview Prep (p11):** raw JSON dump, via a *nested* key.

## Root cause

The structured-emit prompts present their JSON schema example **unfenced**. The model markdown-interprets the underscores in any key carrying **two or more underscores** and drops them (`_x_`→`x` emphasis collapse): `resume_missing_from_linkedin` → `resumemissingfrom_linkedin`, `what_to_do` → `whattodo`, `relevance_bridge_draft` → `relevancebridgedraft`. Single-underscore keys survive. The strict parsers then reject the drifted object and fall back to a raw dump / empty render.

The mangling is in the **model's raw output** (not a render artifact) — proven because a mangled sample's markdown (`##`, `\n\n`) survives intact, which a render pass would have consumed. The client strippers (`callClaude` ~line 334), `api/claude.js`, and `MD.jsx` are all clean.

## The fix (canonical, in `src/App.jsx`)

Two layers, per CLAUDE.md §3 (instruction + detection):

1. **Detection — one unified mechanism, `repairMangledJsonKeys(str, keys)`** (App.jsx ~line 895). A string-level `_x_`→`x` reversal run **before `JSON.parse`** in every structured parser. Matches only in key position (`"key"` immediately followed by `:`) so string values are never touched, and heals **top-level AND nested** keys in one pass. Each parser passes its own 2+-underscore key list:
   - `parseLinkedInRemixJSON` → `P8_JSON_KEYS` (`what_to_do` + the three multi-underscore `skills_delta` keys)
   - `parseGtmJSON` → `GTM_JSON_KEYS` (the four `part_N_*` keys)
   - `parseInterviewPrepJSON` + `parseP11QuestionJSON` → `P11_JSON_KEYS` (`relevance_bridge_draft`, `questions_to_ask`)
   Repaired keys re-serialize canonical on the next per-slot regen (self-healing storage).
2. **Instruction** — a line in each JSON prompt (p8/p7/p11/p_res): *"The JSON keys are literal identifiers: reproduce each key name character-for-character, including every underscore, and do not treat underscores as markdown emphasis or drop them."* This stops emission at the source.

An earlier version used per-prompt object-key normalization (`normalizeJsonKeyDrift`) for p8/p7 and the string repair only for p11; #262 consolidated everything onto the single `repairMangledJsonKeys` string pass. If you grep and find `normalizeJsonKeyDrift`, you're on stale code.

## PRs (all merged to main)

| PR | SHA | Surface |
|----|-----|---------|
| #258 | `27e624d` | p8 `skills_delta` — raw JSON dump |
| #259 | `f2c0ccc` | p8 `what_to_do` — missing section |
| #260 | `a64a90d` | p7 `part_N` — empty GTM card |
| #261 | `3d0b395` | p11 nested `relevance_bridge_draft` — raw JSON dump |
| #262 | `7a9ab24` | consolidation onto one `repairMangledJsonKeys` pass |

## Verified

Live smoke tests against production (`reimagine.career.club/api/claude`) using the deployed prompts: the model now emits **canonical keys at the source** for both p8 (all five multi-underscore keys) and p11 (nested `relevance_bridge_draft`, both behavioral questions). The string repair sits underneath as a belt.

## If you're adding or touching a structured-JSON prompt

Any new schema key with **2+ underscores** inherits this risk. Before shipping:
1. Add the literal-identifiers instruction line to the prompt (copy from p8/p7/p11/p_res).
2. Add the key(s) to the parser's `*_JSON_KEYS` list so `repairMangledJsonKeys` heals them.
3. Sweep method: regex `\.([a-z][a-z0-9]*(?:_[a-z0-9]+){2,})` prop-accesses + quoted 2+-underscore tokens, then check each against prompt schemas + parser validation.

Known non-issues: the p6 `bridge_story` slot keys (`slot1_human_anchor` etc.) are 2+-underscore but read defensively (`filter(Boolean)`) — no raw-dump risk, intentionally left alone.

## Related

Memory: `project_structured_json_key_drift.md`. Canonical repo is `~/reimagine` (the `reimagine-live` clone used during the original fix was retired in the 2026-08-10 cleanup; all merges are in `~/reimagine` history below current `main`).
