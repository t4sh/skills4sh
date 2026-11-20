# Agent pointers and install roots

Load this reference when initializing or migrating memory, when validating that a runtime can see this skill, or when an operation runs on a host that has its own memory feature. Install roots determine skill discovery. Pointer recipes determine which instruction files Init and Migrate create; follow the active host’s loading rules. Save and Sync still operate on the local `.agent-memory/` files.

`AGENTS.md` remains the shared instruction file. Create a pointer only when a runtime the project already uses cannot load `AGENTS.md` without one; the [pointer table](#pointer-files) gives the condition per runtime. Skip pointer files for runtimes that are not present. Leave an existing working pointer in place, and never delete a pointer file.

## Skill install roots

Use these paths to confirm the skill is installed where the active runtime reads skills. The [skills CLI supported-agents catalog](https://github.com/vercel-labs/skills/blob/main/docs/agents.md) is the live list (checked 2026-11-21); this subset is the set this collection documents.

| Runtime | `skills` CLI `--agent` | Project (repo) skill root | Global (user) skill root |
|---|---|---|---|
| Claude Code | `claude-code` | `.claude/skills/` | `~/.claude/skills/` |
| Codex | `codex` | `.agents/skills/` (working directory up to repo root) | `~/.agents/skills/` |
| Cursor | `cursor` | `.agents/skills/` | `~/.cursor/skills/` |
| GitHub Copilot | `github-copilot` | `.agents/skills/` | `~/.copilot/skills/` |
| Grok | `grok` | `.grok/skills/` | `~/.grok/skills/` |
| OpenClaw | `openclaw` | `skills/` (workspace) | `~/.openclaw/skills/` |
| Generic / shared | `universal` | `.agents/skills/` | `~/.config/agents/skills/` |

Codex roots checked 2026-10-20 against the [Codex skills documentation](https://learn.chatgpt.com/docs/build-skills): user `$HOME/.agents/skills`, repo `.agents/skills` from the working directory up to the repository root, and admin `/etc/codex/skills`. The `skills` CLI's global `codex` target installs into `~/.agents/skills/`; its global `universal` target installs into `~/.config/agents/skills/`, which is a different directory.

OpenClaw also reads `~/.agents/skills/` and project `.agents/skills/` with lower precedence than workspace `skills/`. Grok also reads `AGENTS.md` and may scan `~/.agents/skills/`.

The supporting `npx skills4sh` installer defaults to `~/.claude/skills/` and accepts `--dest` for any of the roots above.

## Pointer files

Write the smallest file that points at `AGENTS.md`, and only when the table calls for one. Preserve existing non-pointer content; stage a merge instead of overwriting.

| Runtime in use | Pointer file | Recipe |
|---|---|---|
| Any | `AGENTS.md` | Canonical shared instructions; include the session-start loading instruction below |
| Claude Code | none, or `CLAUDE.md` when [needed](#when-claude-code-needs-a-pointer) | Exact `@AGENTS.md` import. Optional Claude-only notes below that line. Do not replace the import with prose such as “read AGENTS.md”. |
| Cursor | none extra | Cursor reads `AGENTS.md` in the project root and subdirectories. Do not create `.cursor/rules/index.mdc`; keep one that already exists. When Migrate promotes `CURSOR.md`, shared content goes into `AGENTS.md`. |
| Codex, Grok, OpenClaw, Copilot, generic | none extra | `AGENTS.md` is the pointer. Do not invent a vendor file. |

Never put shared instructions inside `.claude/` or `.cursor/`. Those directories are vendor-local.

Cursor row checked 2026-11-21 against the [Cursor rules documentation](https://cursor.com/docs/context/rules), which says Cursor supports `AGENTS.md` in the project root and subdirectories.

### When Claude Code needs a pointer

Checked 2026-11-21 against the [Claude Code `AGENTS.md` documentation](https://code.claude.com/docs/en/memory#agents-md). Claude Code v2.1.277 and later reads `AGENTS.md` directly, but only when no `CLAUDE.md`, `.claude/CLAUDE.md`, or `CLAUDE.local.md` exists in the working directory or any directory above it. When one of those files exists, Claude Code reads it instead of `AGENTS.md`.

| Project state | Action |
|---|---|
| None of the three files exists | Create nothing. `AGENTS.md` loads directly. Report that no pointer was needed. |
| One of them already imports `AGENTS.md` (`@AGENTS.md`, or a path relative to that file such as `@../AGENTS.md` from `.claude/CLAUDE.md`) | Leave it. The import never makes Claude Code read `AGENTS.md` twice. |
| `CLAUDE.md` or `.claude/CLAUDE.md` exists without the import | Propose adding the import as its first line, keeping the existing content below it. This changes an existing file, so the Init overwrite guard applies: show the change and wait for approval. |
| Only `CLAUDE.local.md` exists | It is a personal file and still stops `AGENTS.md` from loading. Do not edit it. Report this and propose a root `CLAUDE.md` from the template below; create it only when the user agrees or the request already asks for Claude Code setup. |
| The user confirms sessions that cannot load `AGENTS.md` directly: a version before v2.1.277, the built-in `AGENTS.md` reader disabled, or Project instructions set to `claude-md` | Create a root `CLAUDE.md` from the template below. |

When Migrate promotes a `CLAUDE.md` that holds full instructions, the shared content moves into `AGENTS.md` and the file keeps the import plus any Claude-only notes, under the migration guard.

Do not change Claude Code settings to make `AGENTS.md` load. Do not remove a `CLAUDE.md` that holds only the import; whether to drop it is the user's decision.

### Session-start loading

Add this instruction to a new `AGENTS.md`, adapted to the project's existing rules. For an existing substantive `AGENTS.md`, preserve its content and follow the Init overwrite guard before adding it:

```markdown
At session start, read `.agent-memory/index.yaml` when it exists. Use each entry's title, type, and status to select memories relevant to the current task, then read those memory files before acting. Recheck the index when the task changes. An empty `[]` index means there are no entries to load yet; continue normally.
```

The index is a discovery registry, not a substitute for reading selected memory files. Resolve an entry ID such as `decisions/storage` to `.agent-memory/decisions/storage.md`. Do not turn Init into Build by generating project facts from source documents merely to populate an empty registry.

### `CLAUDE.md` template

Use this only when the table above calls for a new `CLAUDE.md`.

```markdown
@AGENTS.md

<!-- Runtime-only notes may follow. Keep shared rules in AGENTS.md. -->
```

## Native auto-memory

Native memory is managed by its runtime; its storage and sharing scope depend on that runtime. Do not copy it wholesale into `.agent-memory/`, edit it during `init`, or assume it travels through Git or is readable by another runtime.

Examples (not an exhaustive list):

- Claude Code auto memory: `~/.claude/projects/<project>/memory/`; machine-local, and shared across worktrees of the same repository on that machine. See [Claude Code memory documentation](https://code.claude.com/docs/en/memory#auto-memory) (checked 2026-11-21).
- GitHub Copilot Memory: repository-level facts, viewed and deleted in the repository's settings, and user-level preferences, stored in the user's settings. See [Copilot Memory documentation](https://docs.github.com/en/copilot/concepts/agents/copilot-memory) (checked 2026-11-21).
- Other hosts: whatever store that runtime documents as its own memory

### When an operation runs on a native-memory host

`.agent-memory/` stays the shared, reviewable source. The host's store stays the host's.

| Operation | What to do |
|---|---|
| Save, Sync | Write the confirmed project fact to `.agent-memory/` only. Do not also write it to the native store through this skill, and do not edit, move, or delete what the host recorded there. |
| Init, Migrate, Build | Detect native stores read-only and name them in the report. Do not seed memory from them. When the user asks to bring a native fact across, distill that approved fact into the right typed file and leave the native copy alone. |
| Maintain, Status | Count and check `.agent-memory/` only. Never prune, archive, or reindex a native store. |

Do not turn a host's memory feature off or change its settings. When native memory contradicts `.agent-memory/`, surface the conflict and ask which fact is current before updating either store.
