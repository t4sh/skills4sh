---
name: agent-memory
description: "Use when managing project memory, initializing .agent-memory/, saving session learnings, or running memory maintenance. Handles cross-interface persistent memory for any project."
license: MIT
compatibility: macOS, Linux, or Windows
metadata:
  author: t4sh
  version: "2.7.0"
  tags: memory, context, cross-interface, agent, persistence
---

# Agent Memory Skill

You are an expert in managing cross-interface persistent memory for AI-assisted projects. Your goal is to maintain a coherent, up-to-date knowledge base that any AI agent — Claude App, Claude Code CLI, VSCode, Craft Agent, or any file-reading tool — can read and build upon across sessions.

## Installation

```bash
npx skills add t4sh/skills4sh --skill agent-memory
```

---

## What I Can Help With

- **Initializing project memory** — scaffold `.agent-memory/` with proper structure and entry points
- **Capturing session learnings** — distill decisions, feedback, and context into durable memory files
- **Cross-interface sync** — keep memory consistent across 4+ different AI interfaces
- **Memory maintenance** — compact stale entries, resolve conflicts, clean orphaned files
- **Migration** — upgrade older formats (v1 flat files, CURSOR.md) to v2.1 standard
- **Auto-building from docs** — scan existing documentation and generate initial memory files

## Design Philosophy

1. **Files you can open, read, and edit.** Memory is YAML-frontmatter markdown in a folder — viewable in VSCode, Obsidian, Sublime, or `cat`. Structured frontmatter (`type`, `status`, `expires`, `tags`) makes files machine-queryable without an LLM; the markdown body makes them human-readable. The user can browse `decisions/`, fix a stale entry, or add a convention by hand. The agent writes memory; it doesn't gatekeep it.

2. **Cross-interface portability.** `AGENTS.md` is the single entry point, readable by any tool. No runtime, no platform SDK, no MCP server. Memory written by Claude Code is immediately available in Cursor, VSCode Copilot, Craft Agent, or anything that reads files. If it requires a specific client to read, it doesn't belong in `.agent-memory/`.

3. **Lifecycle management.** Typed directories with staleness rules: `context/` expires at 30 days, `sessions/` at 60, archived at 90. The `maintain` command compacts overlapping entries, promotes session patterns to `conventions/` or `decisions/`, and reconciles the index. Memory that only grows eventually becomes noise.

---

## Initial Assessment

Before operating on memory, understand:

1. **Current State** — Does `.agent-memory/` exist? What version/structure? Older formats needing migration?
2. **User's Goal** — First-time setup, saving learnings, or maintenance?
3. **Project Context** — Project type, existing docs, how many people/agents contributing?

---

## Trigger

Invoke with `/agent-memory` or when the user mentions managing project memory.

## Commands

| Keyword      | Operation  | Description |
|--------------|------------|-------------|
| **init**     | Initialize | Scaffold `.agent-memory/`, README, index, AGENTS.md, CLAUDE.md, .claude/, .cursor/rules/ |
| **migrate**  | Migrate    | Detect and migrate older structures (CURSOR.md, flat files, INDEX.yaml) to v2.1 |
| **build**    | Build      | Scan project and auto-generate initial memory files from existing docs |
| **save**     | Save       | Capture learnings from the current session into memory |
| **maintain** | Maintain   | Compact, trim stale, fix index, clean old session logs |
| **sync**     | Sync       | Pull in external changes + save current session (end-of-session habit) |
| **status**   | Status     | Read-only health check — file counts, staleness, sync |

If no keyword is given, ask:

> **What would you like to do with agent memory?**
> 1. **Init** — Set up `.agent-memory/` for this project (first time)
> 2. **Build** — Scan project and generate initial memories
> 3. **Save** — Capture current session learnings
> 4. **Sync** — Pull in external changes + save this session (recommended end-of-session)
> 5. **Maintain** — Compact, trim stale, fix index
> 6. **Status** — Show memory health report

---

## Operation: Init

Scaffold the `.agent-memory/` system from scratch.

### v2.1 Standard — Entry Points

```
project/
├── AGENTS.md                 # Canonical shared instructions (all tools read it)
├── CLAUDE.md                 # Thin pointer → "read AGENTS.md" + Claude-specific notes
├── .claude/settings.json     # Claude Code native: permissions, hooks
├── .cursor/rules/index.mdc   # Cursor native: "Always" rule → references AGENTS.md
└── .agent-memory/            # Cross-interface persistent memory
```

**Key:** `AGENTS.md` is the single source of truth. `CLAUDE.md` is thin. Never put shared instructions inside `.claude/` or `.cursor/`.

### Steps

1. **Create directories:** `user/`, `feedback/`, `project/`, `decisions/`, `context/`, `conventions/`, `references/`, `sessions/` under `.agent-memory/`.
2. **Create files:** `.agent-memory/README.md` (system spec), `.agent-memory/index.yaml` (empty registry), `AGENTS.md` (canonical shared instructions), `CLAUDE.md` (thin pointer to AGENTS.md), `.cursor/rules/index.mdc` (Cursor “Always” rule that points agents at `AGENTS.md` — same file Migrate creates from `CURSOR.md`).
3. **Fill in TODOs** in AGENTS.md with project's actual structure and rules.
4. **Update `index.yaml`** and **report** what was created.

---

## Operation: Migrate

Detect and migrate older structures to v2.1.

| Old Structure | New Structure | Action |
|---|---|---|
| `CURSOR.md` at root | `.cursor/rules/index.mdc` | Content moved, old file renamed `.migrated` |
| `INDEX.yaml` (uppercase) | `index.yaml` (lowercase) | Renamed |
| Flat `{type}--{topic}.md` | `{type}/{topic}.md` | Moved to directory |
| `summary:` frontmatter | `description:` frontmatter | Field renamed |
| `CLAUDE.md` with full instructions (no AGENTS.md) | `AGENTS.md` + thin `CLAUDE.md` | Promoted |

**Steps:** Scan for each old structure listed above → perform the migration → update `CLAUDE.md` to thin pointer → reconcile `index.yaml` with filesystem → report what changed.

---

## Operation: Build

Scan project and auto-generate initial memory files from existing docs.

1. **Scan** for docs: `*.md`, `package.json`, `pyproject.toml`, `Cargo.toml`, `CLAUDE.md`, `AGENTS.md`, `*.yaml` configs, `.env.example`
2. **Distill** each source: overview → `project/overview.md`, architecture → `project/architecture.md`, decisions → `decisions/{topic}.md`, conventions → `conventions/{topic}.md`, user identity → `user/identity.md`
3. **Rules:** Summarize don't copy. One topic per file. Reference source docs. Use standard frontmatter.
4. **Migrate** old formats if found (flat files, old frontmatter fields)
5. **Update `index.yaml`** — add entries for each new file, reconcile with filesystem
6. **Report** with summary table

---

## Operation: Save

Capture learnings from the current conversation into memory.

1. **Review conversation** for: decisions, feedback, conventions, status changes, important context
2. **For each piece:** update existing memory file or create new one in appropriate `{type}/` directory. Create session log in `sessions/` for significant sessions.
3. **Source identifier:** `claude-app` | `claude-code` | `vscode` | `craft-agent` | `other`
4. **Write files** using standard frontmatter format (see [references/templates.md](references/templates.md))
5. **Update `index.yaml`** and **report** what was saved/updated

---

## Operation: Sync

Combined: ingest external changes **then** save session. Recommended end-of-session command for multi-editor workflows.

**Phase 1 — Ingest:** Scan for unindexed files in `.agent-memory/` (add to index) → scan for orphan index entries (remove) → read updated files for awareness.

**Phase 2 — Save:** Run the full Save operation (review, update/create, session log, index).

**Phase 3 — Report:** Single combined report (see [references/templates.md](references/templates.md) for format).

---

## Operation: Maintain

Full maintenance: compact, trim stale, fix index, clean old session logs.

1. **Health check:** Count files by type, check index sync, identify stale/expired entries.
2. **Staleness check — frontmatter-driven:**
   - **Primary signal:** `expires` field. If `expires` < today → flag as expired, ask update/archive/remove.
   - **Fallback (no `expires`):** Use `updated` date (or `created` if never updated) + type-based thresholds: `context/` >30 days, `sessions/` >60 days.
   - **Archived entries:** `status: archived` with `updated` >90 days ago → suggest deletion.
   - **`supersedes` chain:** If file A has `supersedes: B`, and B still exists with `status: active`, flag B for archival.
3. **Compaction:** Identify content overlap, suggest merges, promote session log patterns to `conventions/` or `decisions/`.
4. **Session cleanup:** `type: session` with `updated` >60 days → extract valuable info elsewhere if needed, then delete.
5. **Report** with health summary (see [references/templates.md](references/templates.md) for format).

---

## Operation: Status

Quick read-only health check. Count files by type, check index ↔ filesystem sync, report stale/expired entries. If `.agent-memory/` doesn't exist, suggest `init`. If issues found, suggest `maintain`.

---

## File Format Rules

1. **Distill, don't transcribe.** Summaries and decisions, not conversation dumps.
2. **One idea per file.** Split if a memory covers unrelated topics.
3. **Update in place.** When facts change, edit the file. Don't append forever.
4. **Keep index in sync.** Every file in index, every index entry points to a file.
5. **Use `expires` on context.** Context goes stale. Set a review date.
6. **Reference, don't copy.** Point to source docs instead of duplicating content.
7. **No secrets.** No credentials, PII, or sensitive data in memory files.
8. **Absolute dates.** Convert "next Thursday" to "2026-03-27" when saving.

For frontmatter schema, memory types, and templates, see [references/templates.md](references/templates.md).

---

## Reference Files

| File | Contents |
|------|----------|
| [references/templates.md](references/templates.md) | Session log template, sync/health report templates, frontmatter schema, memory types table |
| [references/display-conventions.md](references/display-conventions.md) | How to render memory files inline (markdown, YAML, JSON, rich previews, guidelines) |
| [references/troubleshooting.md](references/troubleshooting.md) | Common issues by project type (solo, multi-agent, team, monorepo), troubleshooting Q&A |

---

## Tools Referenced

**Built-in:** `index.yaml` (registry), `AGENTS.md` (shared instructions)

**AI Interfaces:** Claude App, Claude Code CLI, VSCode (Claude extension), Cursor, Craft Agent

---

## Task-Specific Questions

1. Is this a new project or does `.agent-memory/` already exist?
2. Are you working across multiple AI interfaces?
3. Do you have existing documentation to bootstrap from?
4. Is this a solo project or shared with a team?
5. When was the last time memory maintenance was run?

---

## Related Skills

**Built-in (Claude Code):**
- **revise-claude-md** — updates CLAUDE.md with session learnings (the "thin pointer" agent-memory depends on)
- **session-save** — captures files and responses from current chat to disk (one-shot export, not structured memory)

**On skills.sh:**
- **[memory-management](https://skills.sh/anthropics/knowledge-work-plugins/memory-management)** — Anthropic's two-tier system (CLAUDE.md hot cache + `memory/` directory). Same architectural pattern; use agent-memory when you need cross-interface portability beyond Claude Code
- **[session-handoff](https://skills.sh/softaworks/agent-toolkit/session-handoff)** — creates handoff documents for session transfers with git history and project metadata. Complements agent-memory's `sync` operation for end-of-session workflows
- **[agent-memory-mcp](https://skills.sh/sickn33/antigravity-awesome-skills/agent-memory-mcp)** — MCP server approach with searchable persistent memory and web dashboard. Alternative architecture (server-based vs file-based)
