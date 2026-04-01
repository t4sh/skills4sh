# Troubleshooting & Common Issues — Full Reference

## Common Issues by Project Type

### Solo Developer Projects
- Memory accumulates fast with no pruning — run `maintain` monthly
- Session logs dominate the index — promote recurring patterns to `conventions/` or `decisions/`
- Context memories go stale within days — always set `expires` dates

### Multi-Agent Projects (Claude App + CLI + VSCode)
- Index gets out of sync when multiple interfaces create files — run `sync` at session end
- Duplicate memories from different interfaces covering same topic — `maintain` detects and suggests merges
- Source attribution missing — always set the `source` field so you know which agent wrote what

### Team / Shared Repository Projects
- Memory files committed to git create merge conflicts — keep `.agent-memory/` in `.gitignore` or use a shared branch strategy
- Different team members save contradictory decisions — use `supersedes` field to track which decision is current
- Onboarding context missing — run `build` to auto-generate from existing docs before new team members start

### Monorepo / Large Codebases
- Too many convention files — group by subsystem (e.g., `conventions/frontend.md`, `conventions/api.md`)
- Architecture changes invalidate old decisions — set `expires` on decision memories
- Build from docs generates too many files — be selective, focus on non-obvious knowledge

## Troubleshooting

### Index Out of Sync
- Run the `sync` or `maintain` command — the agent will reconcile the filesystem with `index.yaml`
- Check for files in `.agent-memory/` subdirectories that aren't listed in `index.yaml`
- Check for `index.yaml` entries that point to files that no longer exist

### Migration Fails
- Check for file permission issues on `.agent-memory/` directory
- Ensure old files have valid YAML frontmatter — malformed frontmatter blocks migration
- Run migration with verbose output: review each file it tries to move

### Memory Not Being Read by Other Interfaces
- Verify `AGENTS.md` exists at project root and references `.agent-memory/`
- Check that `.claude/settings.json` includes read permissions for the memory directory
- Ensure `.cursor/rules/index.mdc` references `AGENTS.md`
