---
id: context/skill-review-version-bump-next
type: context
title: "TODO: bump changed skill versions before review PR"
description: >-
  Completed in PR #26 / release v0.4.13: changed existing skill content now has
  patch-level skill version bumps, refreshed hashes, and synced release metadata.
tags: [todo, versions, release, skill-review, hashes]
source: codex
created: 2026-06-19
updated: 2026-06-19
status: archived
expires: 2026-07-19
---

## Completed

PR #26 folded in the version-bump pass before merge and release. The package
released as `skills4sh@0.4.13` after the PR merged to `main`.

Changed bundled skill versions were bumped to:

- `agent-memory` — `2.7.5`
- `discord-harvest` — `1.7.6`
- `eleventy-nunjucks` — `0.1.6`
- `localhost-screenshots` — `3.3.5`
- `skill-architect` — `0.1.1`

Unchanged skills `code-to-figma` and `figma-to-code` do not need version bumps from this review pass.

Synced surfaces:

- `skills/<name>/SKILL.md`
- `.security/<name>.yaml`
- `skills-lock.json`
- `README.md`
- `SECURITY.md`
- `CHANGELOG.md`
- `package.json`
- `npm-shrinkwrap.json`
- `.claude-plugin/marketplace.json`
- `.cursor-plugin/plugin.json`

## Verification

```bash
npm run check:skill-standard
npm run check:drift
node bin/hash-check.mjs
npm run check:pr-skill-audit
npm_config_cache=/private/tmp/skills4sh-npm-cache npm run check:pack
npm_config_cache=/private/tmp/skills4sh-npm-cache npm run check:guardskills
npm_config_cache=/private/tmp/skills4sh-npm-cache npm test
bash .github/scripts/check-bin-tag-parity.sh
```

GitHub PR checks passed before merge, including `validate (22)`, `validate (24)`,
and `bin/ matches tag for current package.json version`.

## Release outcome

`v0.4.13` was tagged after PR #26 merged. The GitHub release triggered npm
Trusted Publishing, and npm registry metadata verified `gitHead` as the merged
`main` commit `1e3c7d2b61a92232dba29b4b4d07b1078aed3388`.
