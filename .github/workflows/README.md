# Workflows

## `smoke-preview.yml`

Runs `scripts/smoke-preview.mjs` against every `reimagine2` Vercel preview as
soon as it finishes building, and posts the result as a check on the PR.

It exists because CLAUDE.md section 8 makes that smoke a merge blocker on any PR
touching `api/*`, and until now the only way to run it was by hand on a machine
holding the bypass token — which made a merge blocker depend on somebody
remembering.

**Required secret:** `VERCEL_PROTECTION_BYPASS`, under Settings → Secrets and
variables → Actions. The value comes from Vercel → project `reimagine2` →
Settings → Deployment Protection → Protection Bypass for Automation. Rotate it
in Vercel if it leaks; nothing here stores a copy.

**Two behaviours worth knowing.** Deployments from the sibling `reimagine`
project are skipped rather than failed — both projects build this repo and post
checks, and only `reimagine2` holds the token. The check also says WHAT THE CHANGE TOUCHES before it says whether the smoke
passed. The smoke runs on every preview, so a green on a PR with no `api/`
involvement is real but says nothing about that PR -- the same false confidence
as the missing-secret case, reached from the other side. `scripts/api-surface.mjs`
computes the set of files reachable FROM `api/*` by following imports and
classifies the PR's changed files against it; the verdict lands in the job log
and the run summary. It is annotation only and decides no pass/fail.

The surface is directional, and reversing it is the easy mistake: `api/coach.js`
imports `src/step-position.js`, so that file is in. `src/data/staircase-explainers.js`
also imports `step-position.js` and stays out, because nothing in `api/` can
reach it. Follow imports the wrong way and most of `src/` walks in, every PR
reads "in scope", and the annotation stops carrying information.
`scripts/test-api-surface.mjs` pins that pair.

As for which version of this file runs:
do not trust the rule I first wrote here. It said a `deployment_status`
workflow always runs the copy on the DEFAULT BRANCH, so this one could not
possibly run on the PR that adds it. It ran (PR #683, 2026-09-02): the file
was absent from `main` and the `smoke` check posted anyway, against the
deployment URL. Whatever the mechanism, the operational rule is simpler and
does not depend on knowing it -- LOOK FOR THE CHECK. If `smoke` posted on the
PR, the preview was smoked; if it did not, it was not, and no amount of
reasoning about branch semantics changes that. What is worth knowing is the
consequence: a preview built from a branch that does not carry this file may
not be covered, so keep the file on `main`.
