---
id: context/skill-architect-description-length-todo
type: context
title: "TODO: evaluate description-too-short checks for skill-architect"
description: >-
  Completed on 2026-06-19: skill-architect and repo validation now reject
  generic trigger-only descriptions with no concrete retrieval detail.
tags: [todo, skill-architect, skill-standard, validation, descriptions]
source: craft-agent
created: 2026-06-16
updated: 2026-06-19
status: archived
expires: 2026-07-16
---

## Completed

Added a deterministic, low-false-positive description specificity check to both:

- `skills/skill-architect/assets/scripts/validate_skill.py`
- `bin/skill-standard-check.mjs`

The rule does not use a raw word-count minimum. Instead, a description must still include a trigger/use clause and must also include concrete retrieval detail such as a quoted user phrase, path/file cue, tool cue, named situation, or multi-clause trigger. Generic trigger-only text such as `Use when creating skills.` now fails mechanically.

## Current state

- `skill-architect` currently requires description quality by rubric: concise capability clause plus concrete trigger/use conditions.
- `skills/skill-architect/assets/scripts/validate_skill.py` mechanically checks that a `description` exists and includes trigger/use wording such as `Use when`, `should be used when`, `when the user`, `when working`, path cues, or `or mentions`.
- `bin/skill-standard-check.mjs` has the same trigger/use-condition gate.
- There is no numeric minimum character/word count and no explicit `description too short` error.
- A weak line such as `description: "Use when creating skills."` may pass mechanically even though it is weak by the rubric.

## Decision

This became a deterministic gate because the chosen rule catches obvious under-specification without forcing bloated descriptions.

## Validation

- Added fixture coverage in `tests/skill-architect-helpers.test.mjs` and `tests/skill-standard-check.test.mjs`.
- Updated `docs/SKILL_AUTHORING_STANDARD.md` and `skills/skill-architect/references/house-rubric.md`.
- Focused checks passed on 2026-06-19: `npm run check:skill-standard`, portable validation across all skills, and the targeted helper/standard tests.
