---
id: context/skill-architect-effectiveness-followups
type: context
title: "TODO: improve skill-architect audit effectiveness"
description: >-
  Completed on 2026-06-19: skill-architect now distinguishes prompt catalogs
  from run evidence, treats adapter coverage as local policy, and documents the
  deterministic-vs-judgment boundary for weak descriptions.
tags: [todo, skill-architect, evals, adapters, skill-creator, writing-skills]
source: craft-agent
created: 2026-06-16
updated: 2026-06-19
status: archived
expires: 2026-07-16
---

## Completed

Absorbed the follow-up guidance into `skill-architect` without making the skill depend on one project, repository, or case study.

Updated files:

- `skills/skill-architect/SKILL.md`
- `skills/skill-architect/references/eval-methodology.md`
- `skills/skill-architect/references/house-rubric.md`
- `skills/skill-architect/references/vendor-adapters.md`
- `docs/SKILL_AUTHORING_STANDARD.md`
- `skills/skill-architect/assets/scripts/validate_skill.py`
- `bin/skill-standard-check.mjs`
- focused tests for both validators

## Completed item 1: eval evidence quality

`skill-architect` now distinguishes prompt-vector catalogs from actual run evidence. Prompt-only evals remain acceptable as low-risk retrieval/fixture vectors, but high-risk behavior-shaping, ops, safety, discipline, and review skills should not claim strong eval evidence without observed run status, baseline failure, with-skill result, or transcript summary.

## Completed item 2: adapter coverage policy

`skill-architect` now treats vendor adapter coverage as a local packaging policy. Missing adapters are defects only when local repo rules require them; otherwise partial coverage should be reported as a policy decision with a recommendation to add consistent adapters or document selective coverage.

## Completed item 3: deterministic-vs-judgment boundary

`skill-architect` now states that weak-description checks should become deterministic only when portable and low-false-positive. In this repo, generic trigger-only descriptions such as `Use when creating skills.` now fail mechanically; richer trigger quality remains a review judgment.

## Validation

Focused checks passed on 2026-06-19: `npm run check:skill-standard`, portable validation across all skills, and targeted helper/standard tests.
