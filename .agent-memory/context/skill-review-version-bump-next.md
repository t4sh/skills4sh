---
id: context/skill-review-version-bump-next
type: context
title: "TODO: bump changed skill versions before review PR"
description: >-
  Follow-up from the 2026-06-19 skill review/fix pass: changed existing skill
  content has refreshed hashes, but individual skill metadata versions still
  match main and need an explicit release/version decision before PR.
tags: [todo, versions, release, skill-review, hashes]
source: codex
created: 2026-06-19
updated: 2026-06-19
status: active
expires: 2026-07-19
---

## TODO

Bump the individual `metadata.version` values for changed existing skills, then refresh all synced metadata and rerun the repo gates.

## Current state

As of 2026-06-19, these changed skill surfaces still have versions unchanged from `origin/main`:

- `agent-memory` — `2.7.4`
- `discord-harvest` — `1.7.5`
- `eleventy-nunjucks` — `0.1.5`
- `localhost-screenshots` — `3.3.4`
- `skill-architect` — `0.1.0`

Unchanged skills `code-to-figma` and `figma-to-code` do not need version bumps from this review pass.

## Recommended next step

Decide patch-level bumps for each changed existing skill, update:

- `skills/<name>/SKILL.md`
- `.security/<name>.yaml`
- `skills-lock.json`
- any README/AGENTS/SECURITY/plugin surfaces if drift-check reports version mismatches

Then run:

```bash
npm run check:skill-standard
npm run check:drift
node bin/hash-check.mjs
npm_config_cache=/private/tmp/skills4sh-npm-cache npm run check:pack
npm_config_cache=/private/tmp/skills4sh-npm-cache npm run check:guardskills
npm_config_cache=/private/tmp/skills4sh-npm-cache npm test
```

## Notes

- The 2026-06-19 validation pass already refreshed content hashes and passed all listed gates before version bumps.
- The next pass should keep this as version/metadata work unless another substantive review finding appears.
