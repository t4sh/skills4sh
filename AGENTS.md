# Agent Instructions

This is a mono-repo of agent skills. Each skill lives in `skills/<skill-name>/` with a `SKILL.md` file.

## When asked to install a skill

1. **Ask the user** where to install:
   - **Global**: `~/.claude/skills/<skill-name>/` (default for `skills4sh`), or the system default for their agent (e.g. `~/.agents/skills/`, `~/.cursor/skills/`)
   - **Project**: `./.agents/skills/<skill-name>/`, or the project-local equivalent (e.g. `./.claude/skills/`)
2. Check for older installations (remove symlinks silently; ask before overwriting directories).
3. **Copy** the full skill folder contents (`SKILL.md`, `references/`, and any `assets/`) to the destination.
4. Show: **Installation complete!** The skill will now be loaded from `<path>`. Refresh or restart your session for changes to take effect.

Always **copy**, never symlink.

## Release and npm publish rules

Use [`docs/RELEASE_PROCESS.md`](docs/RELEASE_PROCESS.md) as the canonical
release and npm publishing runbook.

Key invariant: only create a `vX.Y.Z` tag after the PR containing
`package.json` version `X.Y.Z` has been merged to `main`. The GitHub release
for that tag triggers npm Trusted Publishing and checks out exactly that tag.

## Skill authoring standard

When creating, reviewing, or improving skills in this repository, use
[`docs/SKILL_AUTHORING_STANDARD.md`](docs/SKILL_AUTHORING_STANDARD.md) as the canonical rubric.

In summary:
- `Skill Development` is the primary structural standard.
- `writing-skills` contributes validation discipline.
- Codex system `skill-creator` is compatibility guidance, not the repo's primary rubric.

## Available skills

| Skill | Path |
|-------|------|
| agent-memory | `skills/agent-memory/` |
| code-to-figma | `skills/code-to-figma/` |
| discord-harvest | `skills/discord-harvest/` |
| eleventy-nunjucks | `skills/eleventy-nunjucks/` |
| figma-to-code | `skills/figma-to-code/` |
| localhost-screenshots | `skills/localhost-screenshots/` |
