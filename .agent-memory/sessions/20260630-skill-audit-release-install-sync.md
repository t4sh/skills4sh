---
id: sessions/20260630-skill-audit-release-install-sync
type: session
title: "Audited skill fixes, release v0.4.14, and install verification"
description: >-
  Fixed audited findings across all seven bundled skills, released skills4sh 0.4.14, verified installed global skills, and removed a stale project-local figma-to-code override.
tags: [session, skill-review, release, skill-architect, agent-memory, install-verification]
source: craft-agent
created: 2026-06-30
updated: 2026-06-30
status: active
---

## What Happened

- Completed the audited skill-fix pass for all seven bundled `t4sh/skills4sh` skills.
- Merged Dependabot PRs before preparing the skill-fix PR:
  - PR #29: `undici` 6.25.0 → 6.27.0.
  - PR #30: GitHub Actions dependency group update; added the required PR audit packet to satisfy the repository gate, reran CI, then merged.
- Merged PR #31, `docs(skills): fix audited skill findings`, after CI passed.
- Merged PR #32, `chore(release): bump package to 0.4.14`, after CI passed.
- Created signed annotated tag `v0.4.14` on merged `main` commit `a1204e74da7bb3bc075cfac5d821c88ebd0581bf`.
- Created GitHub release `v0.4.14`; `npm-publish.yml` passed with npm Trusted Publishing and provenance.
- Verified npm registry metadata for `skills4sh@0.4.14`: version `0.4.14`, `gitHead` `a1204e74da7bb3bc075cfac5d821c88ebd0581bf`, registry signature verified, provenance attestation verified.
- Verified global installed t4sh skills under `~/.agents/skills` are latest and hash-matching against `skills-lock.json`. `~/.claude/skills` and `~/.cursor/skills` symlink to `~/.agents/skills`.
- Compared stale project-local `.agents/skills/figma-to-code` 0.1.1 against global `figma-to-code` 0.1.6 and found no local-only experimental feature worth preserving; removed the project-local copy so the global skill is used.

## Decisions Made

- Keep package/plugin release bumps as a separate follow-up PR after skill-fix PRs, following the pattern from PR #23.
- Treat project-local skill overrides as candidates for removal when they are older than global installs and contain no unique durable behavior.
- Keep `skill-architect` as the central repo skill-review rubric and evolve it with predictability, pruning, and executable-surface checks.

## Validation Run

The skill-fix and release work was validated with the relevant gates, including:

- `npm run check:skill-standard`
- `npm run check:drift`
- `node bin/hash-check.mjs`
- `npm run check:guardskills`
- `npm test`
- `npm run check:pack`
- `git diff --check`
- Release preflight: confirmed no `v0.4.14` tag, GitHub release, or npm package existed before tagging.
- Release verification: confirmed signed tag target, npm metadata, registry signature, and provenance attestation.

## Open Threads

- None for the 0.4.14 release. Future skill work should start from released `skills4sh@0.4.14` and current global skill installs.
