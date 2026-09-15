# Agent Instructions

This is a mono-repo of agent skills. Each skill lives in `skills/<skill-name>/` with a `SKILL.md` file.

## First Steps

1. Read this file.
2. Read `.agent-memory/index.yaml` to discover project memory when `.agent-memory/` exists.
3. Load relevant memory files for the task before changing skill content, release metadata, gates, or repo conventions.

## When asked to install a skill

1. **Ask the user** where to install:
   - **Global**: the host default (see README installer table: `~/.claude/skills/`, `~/.codex/skills/`, `~/.cursor/skills/`, `~/.grok/skills/`, `~/.openclaw/skills/`, `~/.agents/skills/`, or `--dest`)
   - **Project**: `./.agents/skills/<skill-name>/`, or the project-local equivalent (`.claude/skills/`, `.grok/skills/`, workspace `skills/` for OpenClaw)
2. Check for older installations (remove symlinks silently; ask before overwriting directories).
3. **Copy** the full skill folder contents (`SKILL.md`, `LICENSE`, `references/`, and any `assets/`) to the destination.
4. Show: **Installation complete!** The skill will now be loaded from `<path>`. Refresh or restart your session for changes to take effect.

Always **copy**, never symlink.

## Release and npm publish rules

Use [`docs/RELEASE_PROCESS.md`](docs/RELEASE_PROCESS.md) as the canonical
release and npm publishing runbook.

Key invariant: only create a `vX.Y.Z` tag after the PR containing
`package.json` version `X.Y.Z` has been merged to `main`. The GitHub release
for that tag triggers npm Trusted Publishing and checks out exactly that tag.

## Draft skill work

Planning, analysis, and testing commits do not require version bumps. Defer bumps until the merge decision, then synchronize the final versions before merge. Keep content hashes and checks current throughout; follow the [authoring standard](docs/SKILL_AUTHORING_STANDARD.md#frontmatter).

## Skill authoring standard

When creating, reviewing, or improving skills in this repository, use
[`docs/SKILL_AUTHORING_STANDARD.md`](docs/SKILL_AUTHORING_STANDARD.md) as the canonical rubric and [`skills/skill-architect/`](skills/skill-architect/) as the in-house planning/review skill.

In summary:
- `skill-architect` is the operational planning/review skill for this repo's skill work.
- `Skill Development` supplies structural patterns that `skill-architect` bridges into the local rubric.
- `writing-skills` contributes validation discipline through `skill-architect` and the local standard.
- Anthropic/OpenAI `skill-creator` patterns inform evals and compatibility; they are inputs, not the repo's primary rubric.

## Available skills

| Skill | Path |
|-------|------|
| agent-memory | `skills/agent-memory/` |
| code-to-figma | `skills/code-to-figma/` |
| discord-harvest | `skills/discord-harvest/` |
| eleventy-nunjucks | `skills/eleventy-nunjucks/` |
| figma-to-code | `skills/figma-to-code/` |
| localhost-screenshots | `skills/localhost-screenshots/` |
| skill-architect | `skills/skill-architect/` |
