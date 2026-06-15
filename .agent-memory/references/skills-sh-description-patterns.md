---
id: references/skills-sh-description-patterns
type: reference
title: "skills.sh description pattern research"
description: >-
  Cross-checked research note showing public skills.sh descriptions commonly use capability-first or Use when patterns, not only the stricter This skill should be used when form.
tags: [skills-sh, descriptions, triggers, retrieval, skill-authoring, skill-architect]
source: craft-agent
created: 2026-06-13
updated: 2026-06-13
status: active
---

## Finding

A 2026-06-13 `skills.sh` sample supports the user's research note: the public ecosystem does **not** consistently require descriptions to start with `This skill should be used when...`.

Common public patterns are:

1. **Capability-first summary**, sometimes followed by trigger guidance.
2. **`Use when...` trigger-first** phrasing.
3. **Loose capability summary only**.

This means the current `skills4sh` machine gate requiring `This skill should be used when...` is stricter than the observed public `skills.sh` norm.

## Cross-checked sample

| Skill | Source | skills.sh observation | Pattern |
|---|---|---|---|
| `skill-creator` | `anthropics/skills` | Summary: “Create, test, and iteratively improve…”; body starts with lifecycle guidance | capability-first |
| `write-a-skill` | `mattpocock/skills` | Summary: “Scaffold new agent skills…” and bullet notes trigger keywords | capability-first plus trigger guidance |
| `writing-skills` | `obra/superpowers` | Summary explicitly says description field must start with `Use when...` | trigger-first |
| `find-skills` | `vercel-labs/skills` | Summary capability-first; body has “When to Use This Skill” section | capability-first plus body triggers |
| `frontend-design` | `anthropics/skills` | Summary and body are capability/task oriented, no visible `Use when` prefix | capability-first |
| `web-design-guidelines` | `vercel-labs/agent-skills` | Summary: “Audit UI code…”; body starts “Review files…” | capability-first imperative |
| `azure-ai` | `microsoft/azure-skills` | Summary: “Unified access…”; body routes services by “Use When” table | capability-first plus routing table |
| `remotion-best-practices` | `remotion-dev/skills` | Body has “When to use” section: “Use this skills whenever…” | body trigger section |
| `webapp-testing` | `anthropics/skills` | Summary: “Native Python Playwright scripts…”; body starts with direct instruction | capability-first |
| `verification-before-completion` | `obra/superpowers` | Summary: “Enforce verification commands…”; body states principle and gate | capability-first / discipline rule |

## Sources checked

- `https://www.skills.sh/anthropics/skills/skill-creator`
- `https://www.skills.sh/mattpocock/skills/write-a-skill`
- `https://www.skills.sh/obra/superpowers/writing-skills`
- `https://www.skills.sh/vercel-labs/skills/find-skills`
- `https://www.skills.sh/anthropics/skills/frontend-design`
- `https://www.skills.sh/vercel-labs/agent-skills/web-design-guidelines`
- `https://www.skills.sh/microsoft/azure-skills/azure-ai`
- `https://www.skills.sh/remotion-dev/skills/remotion-best-practices`
- `https://www.skills.sh/anthropics/skills/webapp-testing`
- `https://www.skills.sh/obra/superpowers/verification-before-completion`

## Repo implication

`skills4sh` currently enforces a stricter third-person phrase through `bin/skill-standard-check.mjs` and `docs/SKILL_AUTHORING_STANDARD.md`.

For the upcoming `skill-architect` release, evaluate whether to:

1. **Keep the strict internal gate** for deterministic consistency while documenting that it is stricter than public `skills.sh`; or
2. **Relax the gate** to allow a public-ecosystem-compatible pattern such as:
   - `Capability. Use when ...`
   - `Use when ...`
   - `This skill should be used when ...`

A balanced future rule could require two semantic components instead of one exact string:

- a concise capability clause, and
- concrete trigger/use conditions.

This would better align with public `skills.sh` norms while preserving retrieval quality.
