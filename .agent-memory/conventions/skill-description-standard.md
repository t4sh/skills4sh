---
id: conventions/skill-description-standard
type: convention
title: "Skill description format standard"
description: >-
  skills4sh descriptions should use a concise capability clause plus concrete trigger/use conditions, with Use when accepted as a trigger-first short form.
tags: [skill-authoring, descriptions, retrieval, skill-architect, standards]
source: craft-agent
created: 2026-06-13
updated: 2026-06-13
status: active
---

## Standard

The preferred `skills4sh` description shape is:

```yaml
description: Capability summary. Use when [specific triggers, file paths, tools, errors, or situations apply].
```

Allowed short form when the capability is obvious from the skill name:

```yaml
description: Use when [specific triggering conditions].
```

Legacy strict form remains valid, but is no longer the only accepted pattern:

```yaml
description: This skill should be used when [specific triggering conditions].
```

## Why

A 2026-06-13 `skills.sh` sample showed that public high-install skills commonly use capability-first summaries or `Use when...` phrasing. The old repo gate requiring the exact `This skill should be used when...` phrase was stricter than the public norm and overfit to one upstream rubric.

## How to apply

- Require a concrete trigger/use clause, not an exact phrase.
- Prefer `Capability. Use when ...` for new skills.
- Use `Use when ...` for discipline/rule skills where the capability is obvious.
- Reject loose summaries that have no retrieval cues.
- Keep concrete triggers: quoted user phrases, file paths, tools, file types, named errors, or situations.
