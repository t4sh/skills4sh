# Troubleshooting & Common Issues — Full Reference

## Common Issues by Project Type

### Solo Developer Projects
- Memory accumulates fast with no pruning — run `maintain` monthly
- Session logs dominate the index — promote recurring patterns to `conventions/` or `decisions/`
- Context memories go stale within days — always set `expires` dates

### Multi-agent projects
- Index gets out of sync when more than one runtime writes files — run `sync` at session end
- Duplicate memories covering the same topic — `maintain` detects and suggests merges
- Source attribution missing — always set the `source` field so later sessions know which runtime wrote the file

### Team / Shared Repository Projects
- Memory files committed to git can create merge conflicts — commit shared/team memory intentionally, use a shared branch strategy for collaborative memory, and reserve `.gitignore` for private/local-only memory
- Different team members save contradictory decisions — inspect evidence and review status; ask when the accepted direction is unknown. Use `supersedes` only after a replacement decision is established
- Onboarding context missing — a read-only onboarding or review request does not authorize `build` or `save`. Ask whether to generate memory from docs first.

### Monorepo / Large Codebases
- Too many convention files — group by subsystem (e.g., `conventions/frontend.md`, `conventions/api.md`)
- Architecture changes invalidate old decisions — set `expires` on decision memories
- Build from docs generates too many files — be selective, focus on non-obvious knowledge

## Troubleshooting

### Index Out of Sync
- Run the `sync` or `maintain` command — the agent will reconcile the filesystem with `index.yaml`
- With Node.js 22 or later, the read-only [index checker](checker.md) lists every difference without changing a file
- Check for files in `.agent-memory/` subdirectories that aren't listed in `index.yaml`
- Check for `index.yaml` entries that point to files that no longer exist

### Migration Fails
- Check for file permission issues on `.agent-memory/` directory
- Ensure old files have valid YAML frontmatter — malformed frontmatter blocks migration
- Request a migration plan listing each source and destination before approving moves

### Memory Not Being Read by Other Interfaces
- Verify `AGENTS.md` exists at project root and references `.agent-memory/`
- Verify pointer files for runtimes in use match [agent-pointers.md](agent-pointers.md)
- Claude Code reads a `CLAUDE.md`, `.claude/CLAUDE.md`, or `CLAUDE.local.md` in place of `AGENTS.md` when one exists in the working directory or above it, and versions before v2.1.277 do not read `AGENTS.md` directly. In either case add the `@AGENTS.md` import as described in [agent-pointers.md](agent-pointers.md#when-claude-code-needs-a-pointer)
- Native auto-memory is not a substitute for `.agent-memory/`; see [agent-pointers.md](agent-pointers.md#native-auto-memory)

### Native Auto-Memory Conflicts or Duplication
- Treat host-native memory as that host's own store, not as the shared source of truth; save project facts to `.agent-memory/` only and do not mirror them into the native store
- Do not copy an entire native memory directory into `.agent-memory/`; distill only approved durable facts into the appropriate typed file
- Native-memory scope depends on the runtime; do not assume Git transport or visibility to other runtimes. Claude Code shares repository auto-memory across local worktrees; see [agent-pointers.md](agent-pointers.md#native-auto-memory)
- When native memory contradicts `.agent-memory/`, surface the conflict and ask which fact is current before updating either store
