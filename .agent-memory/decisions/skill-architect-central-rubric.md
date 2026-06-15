---
id: decisions/skill-architect-central-rubric
type: decision
title: "Use skill-architect as the evolving portable skill authoring rubric"
description: >-
  skill-architect is the central planning/review layer for multi-agent skill authoring, derived from Anthropic Skill Development, Anthropic skill-creator, and OpenAI skill-creator.
tags: [skill-architect, skill-authoring, rubric, anthropic, openai, multi-agent]
source: craft-agent
created: 2026-06-13
updated: 2026-06-13
status: active
---

## Decision

Use `skill-architect` as the evolving portable skill creator/authoring skill and central planning/review layer for CWD/project/repository skill work.

## Why

The main motivation is that three high-signal authoring skills overlap but have distinct strengths:

- [Anthropic `Skill Development`](https://github.com/anthropics/claude-code/tree/main/plugins/plugin-dev/skills/skill-development) provides the strongest structural guidance, but is Claude Code plugin-specific if copied verbatim.
- [Anthropic `skill-creator`](https://www.skills.sh/anthropics/skills/skill-creator) provides the strongest quality/evaluation harness: baseline comparisons, trigger optimization, blind review, and iterative improvement.
- [OpenAI `skill-creator`](https://github.com/openai/skills/tree/main/skills/.system/skill-creator) provides Codex/OpenAI compatibility and `agents/openai.yaml` style adapter guidance, but is not a vendor-neutral portable rubric.

The synthesis model is: **portable rubric first, quality harness second, vendor adapters third**.

## How to apply

- Treat `docs/SKILL_AUTHORING_STANDARD.md` as the binding local project contract for `skills4sh`, while `skill-architect` remains a portable standard for planning, authoring, reviewing, and evolving skills in any CWD/project/repository context.
- Continue refining `skill-architect` with comparative lessons from famous `skills.sh` skill creation/development/maintenance/authoring/editing skills.
- Do not let a vendor-specific rubric replace the local project contract verbatim.
- Avoid upstream slug collisions such as `skill-creator` by using explicit local or restored names.
