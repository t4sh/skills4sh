# Agent pointers and install roots

Load this reference when initializing or migrating memory, or when validating that a runtime can see this skill. Install roots determine skill discovery. Pointer recipes determine which instruction files Init and Migrate create; follow the active host’s loading rules. Save and Sync still operate on the local `.agent-memory/` files.

`AGENTS.md` remains the shared instruction file. Create a pointer only for a runtime the project already uses. Skip pointer files for runtimes that are not present.

## Skill install roots

Use these paths to confirm the skill is installed where the active runtime reads skills. The [skills CLI supported-agents table](https://github.com/vercel-labs/skills#supported-agents) is the live catalog; this subset is the set this collection documents.

| Runtime | `skills` CLI `--agent` | Project skill root | Global skill root |
|---|---|---|---|
| Claude Code | `claude-code` | `.claude/skills/` | `~/.claude/skills/` |
| Codex | `codex` | `.agents/skills/` | `~/.codex/skills/` |
| Cursor | `cursor` | `.agents/skills/` | `~/.cursor/skills/` |
| GitHub Copilot | `github-copilot` | `.agents/skills/` | `~/.copilot/skills/` |
| Grok | `grok` | `.grok/skills/` | `~/.grok/skills/` |
| OpenClaw | `openclaw` | `skills/` (workspace) | `~/.openclaw/skills/` |
| Generic / shared | `universal` or host default | `.agents/skills/` | `~/.agents/skills/` |

OpenClaw also reads `~/.agents/skills/` and project `.agents/skills/` with lower precedence than workspace `skills/`. Grok also reads `AGENTS.md` and may scan `~/.agents/skills/`.

The supporting `npx skills4sh` installer defaults to `~/.claude/skills/` and accepts `--dest` for any of the roots above.

## Pointer files

Write the smallest file that points at `AGENTS.md`. Preserve existing non-pointer content; stage a merge instead of overwriting.

| Runtime in use | Pointer file | Recipe |
|---|---|---|
| Any | `AGENTS.md` | Canonical shared instructions; mention `.agent-memory/` |
| Claude Code | `CLAUDE.md` | Exact `@AGENTS.md` import. Optional Claude-only notes below that line. Do not replace the import with prose such as “read AGENTS.md”. |
| Cursor | `.cursor/rules/index.mdc` | Always-on rule that references `AGENTS.md`. Same destination Migrate uses when promoting `CURSOR.md`. Skip when `.cursor/` is absent and Cursor is not in use. |
| Codex, Grok, OpenClaw, Copilot, generic | none extra | `AGENTS.md` is the pointer. Do not invent a vendor file. |

Never put shared instructions inside `.claude/` or `.cursor/`. Those directories are vendor-local.

### `CLAUDE.md` template

```markdown
@AGENTS.md

<!-- Runtime-only notes may follow. Keep shared rules in AGENTS.md. -->
```

## Native auto-memory

Native memory is managed by its runtime; its storage and sharing scope depend on that runtime. Do not copy it wholesale into `.agent-memory/`, edit it during `init`, or assume it travels through Git or is readable by another runtime.

Examples (not an exhaustive list):

- Claude Code: `~/.claude/projects/<project>/memory/`; repository auto-memory is shared across worktrees on the same machine. See [Claude Code memory documentation](https://code.claude.com/docs/en/memory#auto-memory) (checked 2026-09-15).
- Other hosts: whatever directory that runtime documents as its private memory store

When native scratch contradicts `.agent-memory/`, surface the conflict and ask which fact is current before updating either store.
