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
checks, and only `reimagine2` holds the token. And a `deployment_status`
workflow always runs the version on the DEFAULT BRANCH, so edits to this file
take effect only once merged, including the first time it is added.
