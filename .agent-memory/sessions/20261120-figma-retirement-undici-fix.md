---
id: sessions/20261120-figma-retirement-undici-fix
type: session
title: "Figma skills retired and undici advisories patched"
description: >-
  Removed both Figma skills and the Figma plugin, upgraded the bundled undici
  to 6.29.1, updated pinned actions, and aligned branch protection in PR #60.
tags: [session, figma, retirement, security, undici, dependabot, branch-protection]
source: claude-code
created: 2026-11-20
updated: 2026-11-21
status: active
---

## What Happened

- Reviewed both Figma skills against Figma's official skills, the Figma MCP tool list, and peer skills on skills.sh (2026-11-10). See [decisions/retire-figma-skills](../decisions/retire-figma-skills.md).
- Removed `skills/code-to-figma/`, `skills/figma-to-code/`, `plugins/tokens-sync-to-figma/`, their `.security/` manifests, `tests/walker-patterns-snippets.test.mjs`, and every listing across README, AGENTS, SECURITY, CONTRIBUTING, lockfile, plugin manifests, issue and PR templates, the guardskills matrix, and the branch-protection snapshot.
- Upgraded the bundled `undici` 6.29.0 to 6.29.1, resolving five advisories (ten Dependabot alerts). Updated pinned actions: `github/codeql-action` 4.39.1, `astral-sh/setup-uv` 10.3.2, `actions/setup-python` 7.1.0.
- Removed the four retired `scan (code-to-figma|figma-to-code, 22|24)` contexts from live branch protection on `main`; the live list (17 contexts) matches `.github/branch-protection.expected.json`.
- Squash-merged PR #60 as `9824a1f chore: 🔥 retire Figma skills and patch undici advisories (#60)`. Closed Dependabot PRs #58 and #59 as superseded.

## Decisions Made

- Retire both Figma skills and the plugin outright, with no deprecation stub.
- No version bump in PR #60; versions are synchronized at the release decision.
- Fold pending Dependabot updates into the working PR and close the Dependabot PRs, as at 0.7.0. Dependabot PRs that touch workflows fail `validate` only because their description does not satisfy the PR skill-authoring audit.

## Open Threads

- Resolved 2026-11-21: skills4sh 0.8.0 ships `undici` 6.29.1 and no Figma skills; see [sessions/20261121-skills-review-v080-release](20261121-skills-review-v080-release.md). (npm 0.7.1 and earlier still bundle `undici` 6.29.0 and both Figma skills.)
- Resolved: GitHub listed no open Dependabot alerts on 2026-11-21.
- Removing a skill changes the required-check list: update `.github/branch-protection.expected.json`, the count in `.github/BRANCH_PROTECTION.md`, and the live protection together, or the drift check blocks the PR.
- The test environment needs PyYAML 6.0.3, which had no wheel for Python 3.15 on 2026-11-20; a Python 3.14 venv worked. `CONTRIBUTING.md` and `bin/check-test-env.mjs` state the 3.10–3.14 range since 0.8.0.
