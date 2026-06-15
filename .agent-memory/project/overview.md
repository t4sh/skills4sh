---
id: project/overview
type: project
title: "skills4sh project overview"
description: >-
  Public agent-skill repository for t4sh skills, with repo-level packaging, security, drift, and marketplace metadata gates.
tags: [skills4sh, agent-skills, repository, packaging, security]
source: craft-agent
created: 2026-06-13
updated: 2026-06-13
status: active
---

## Summary

`skills4sh` is the `t4sh/skills4sh` agent-skill repository. Skills live under `skills/<slug>/` with `SKILL.md`, `LICENSE`, optional linked `references/`, and optional inert assets.

## Current local project contract

The repository has strong mechanical gates around skills:

- `docs/SKILL_AUTHORING_STANDARD.md` defines the binding skill authoring standard.
- `skills-lock.json` tracks versions and computed hashes.
- `.security/<skill>.yaml` stores per-skill AST10-style security manifests and file hashes.
- README, AGENTS, SECURITY, Claude plugin, Cursor plugin, guardskills matrix, and issue templates must stay in sync when a skill is added.
- Core validation commands include `npm run check:skill-standard`, `npm run check:drift`, `node bin/hash-check.mjs`, `npm run check:pack`, guardskills checks, and `npm test`.

## Source docs

- `AGENTS.md`
- `docs/SKILL_AUTHORING_STANDARD.md`
- `README.md`
- `SECURITY.md`
- `package.json`
