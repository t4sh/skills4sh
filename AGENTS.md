# Agent Instructions

This is a mono-repo of agent skills. Each skill lives in `skills/<skill-name>/` with a `SKILL.md` file.

## When asked to install a skill

1. **Ask the user** where to install:
   - **Global**: `~/.claude/skills/<skill-name>/`
   - **Project**: `./.claude/skills/<skill-name>/`
2. Check for older installations (remove symlinks silently; ask before overwriting directories).
3. **Copy** the skill folder contents (`SKILL.md` and `reference/`) to the destination.
4. Show: **Installation complete!** The skill will now be loaded from `<path>`. Refresh or restart your session for changes to take effect.

Always **copy**, never symlink.

## Available skills

| Skill | Path |
|-------|------|
| agent-memory | `skills/agent-memory/` |
| discord-harvest | `skills/discord-harvest/` |
| localhost-screenshots | `skills/localhost-screenshots/` |
