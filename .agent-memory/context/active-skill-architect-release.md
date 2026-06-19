---
id: context/active-skill-architect-release
type: context
title: "Active release plan: skill-architect as central repo rubric"
description: >-
  Completed release work that refined skill-architect, aligned repo rubric/gates
  around it, and shipped the follow-up review/version-bump fixes in v0.4.13.
tags: [release-planning, skill-architect, gates, drift, guardskills, skills-sh]
source: craft-agent
created: 2026-06-13
updated: 2026-06-19
status: archived
expires: 2026-07-13
---

## Completed during 2026-06-19 release follow-through

- PR #26, `fix(skill-architect): tighten review gates`, merged to `main`.
- `skill-architect` now enforces deterministic low-false-positive description
  specificity in its helper validator and repo standard gate.
- Review guidance now distinguishes prompt-only eval catalogs from run evidence,
  treats vendor-adapter gaps as local-policy defects, and keeps weak-description
  judgment separate from mechanical checks unless the rule is portable.
- `localhost-screenshots` helper scripts now reject non-localhost URLs before
  loading Playwright, matching the skill's localhost-only network boundary.
- Changed skill versions and package/plugin metadata were bumped in the same PR,
  following the prior release-bump pattern from PR #23.
- Signed tag `v0.4.13` was created after merge, GitHub release was published, and
  npm Trusted Publishing completed successfully.

## Final release state

- Release: `v0.4.13`
- Merged commit: `1e3c7d2b61a92232dba29b4b4d07b1078aed3388`
- npm package: `skills4sh@0.4.13`
- Local cleanup: `main` was realigned to `origin/main`; stale local review
  branch was deleted; the user deleted the superseded remote `tash/*` branch.

## Completed during 2026-06-13 polish pass

- Migrated all existing skill descriptions from legacy trigger-only `This skill should be used when...` wording to the preferred `Capability summary. Use when...` format while keeping concrete retrieval cues.
- Kept the relaxed machine gate accepting `Capability. Use when...`, `Use when...`, and legacy `This skill should be used when...`, while rejecting loose summary-only descriptions.
- Refreshed `.security/<skill>.yaml` hashes and `skills-lock.json` computed hashes for all touched skills.
- Validation passed: `check:skill-standard`, `check:drift`, `check:pack`, `hash-check`, `npm test`, and full `guardskills-check.mjs`.

## Current state on 2026-06-13

Branch: `update/skill-authoring-lessons`.

`skill-architect` has been added as a new skill with:

- `SKILL.md`
- linked references for comparative study, portable rubric, vendor adapters, eval methodology, and naming/packaging
- inert helper scripts under `assets/scripts/`
- `.security/skill-architect.yaml`
- lockfile, README, AGENTS, SECURITY, plugin manifest, issue-template, and guardskills matrix updates

Validation already run successfully:

- `npm run check:skill-standard`
- `npm run check:drift`
- `npm run check:pack`
- `node bin/hash-check.mjs`
- `bin/guardskills-check.mjs skill-architect`
- `npm test`

## User's release goals

Before releasing, plan and execute a broader refinement pass:

1. Fine-tune and improve the new `skill-architect` skill.
2. Change and tweak the repo rubric so `skill-architect` is the central operational rubric for this repo.
3. Update descriptions and relevant repository details to reflect the new skill and its motivation.
4. Identify gaps in the current repo relative to famous `skills.sh` skill creation/development/maintenance/authoring/editing skills.
5. Build those gap checks into `skill-architect` over time.
6. Update gates, drift checks, guards, and CI so `skill-architect` is treated as the central rubric.

## Research notes to absorb

- `skills.sh` description-pattern research (2026-06-13): public high-install skills commonly use capability-first summaries or `Use when...` trigger phrasing. The current repo gate requiring exact `This skill should be used when...` is stricter than the public norm. For the `skill-architect` release, the chosen rule is now: prefer `Capability summary. Use when ...`, allow `Use when ...`, keep legacy `This skill should be used when ...` valid, and reject loose summaries with no trigger/use conditions. See `.agent-memory/references/skills-sh-description-patterns.md`.

## WIP changes to absorb

- `b897f4ca` — `docs(skills): apply authoring retrieval lessons` (2026-06-13). Current branch `HEAD` when noted. Touches `docs/SKILL_AUTHORING_STANDARD.md`, `skills/code-to-figma/SKILL.md`, adds `skills/code-to-figma/references/setup-scaffold.md`, and updates security/lock metadata. Treat this as an internal retrieval-lesson case study for `skill-architect`: it moved bulky setup/scaffold material out of `SKILL.md` into a reference, tightening retrieval/body altitude while preserving workflow detail.

## Known comparative sources to include

Already discussed:

- [Anthropic `Skill Development`](https://github.com/anthropics/claude-code/tree/main/plugins/plugin-dev/skills/skill-development)
- [Anthropic `skill-creator`](https://www.skills.sh/anthropics/skills/skill-creator)
- OpenAI same-name `skill-creator`
- [Matt Pocock `write-a-skill`](https://www.skills.sh/mattpocock/skills/write-a-skill)
- [Obra `writing-skills`](https://www.skills.sh/obra/superpowers/writing-skills)
- [xixu `skills-cli`](https://www.skills.sh/xixu-me/skills/skills-cli)
- Microsoft `azure-skills`
- Antigravity authoring/editing candidates from `skills.sh` to identify and verify

## Next session starting point

Start by reading:

1. `AGENTS.md`
2. `.agent-memory/index.yaml`
3. `docs/SKILL_AUTHORING_STANDARD.md`
4. `skills/skill-architect/SKILL.md`
5. `skills/skill-architect/references/comparative-study.md`
6. current `git status`

Then create a release work plan before modifying more gates or CI behavior.
