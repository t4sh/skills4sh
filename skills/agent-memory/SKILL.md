---
name: agent-memory
description: "Cross-interface persistent memory for project context, decisions, conventions, and session handoffs. Use when the user asks to \"manage project memory\", \"initialize .agent-memory\", \"migrate memory\", \"build memory from docs\", \"save session learnings\", \"sync memory\", \"run memory maintenance\", \"check memory status\", or mentions persistent memory across Claude Code, Cursor, VS Code, Craft Agent, or other file-reading agents."
license: MIT
compatibility: macOS, Linux, or Windows
metadata:
  author: t4sh
  version: "2.7.5"
  tags: memory, context, cross-interface, agent, persistence
---

# Agent Memory Skill

Manage cross-interface persistent memory for AI-assisted projects. Maintain a coherent, up-to-date knowledge base that any AI agent — Claude Code, Cursor, VS Code, Craft Agent, or any file-reading tool — can read and build upon across sessions.


## Capabilities

| Area | Outcome |
|------|---------|
| Initialize | Scaffold `.agent-memory/` with structure and entry points |
| Capture | Distill session decisions, feedback, and context into durable memory files |
| Sync | Keep memory consistent across Claude Code, Cursor, VS Code, and other file-reading agents |
| Maintain | Compact stale entries, resolve conflicts, clean orphaned files |
| Migrate | Upgrade older formats (v1 flat files, `CURSOR.md`) to memory format v2.1 |
| Build | Scan existing documentation and generate initial memory files |

## Design Principles

| Principle | Practice |
|---|---|
| Open files | Store memory as YAML-frontmatter markdown that can be read and edited with any editor or file-reading agent. |
| Shared entry point | Keep `AGENTS.md` as the canonical instructions file; keep client-specific files thin pointers. |
| Managed lifecycle | Use typed directories, `expires` metadata, `maintain`, and `sync` so memory stays current instead of accumulating noise. |
| No secrets | Store project knowledge and decisions, never credentials, private keys, tokens, or sensitive personal data. |

---

## Initial Assessment

Before operating on memory, understand:

1. **Current State** — Does `.agent-memory/` exist? What version/structure? Older formats needing migration?
2. **User's Goal** — First-time setup, saving learnings, or maintenance?
3. **Project Context** — Project type, existing docs, how many people/agents contributing?

---

## Commands

| Keyword      | Operation  | Description |
|--------------|------------|-------------|
| **init**     | Initialize | Scaffold `.agent-memory/`, README, index, AGENTS.md, CLAUDE.md, plus per-agent pointer files for the agents in use (e.g. `.cursor/rules/index.mdc`) |
| **migrate**  | Migrate    | Detect and migrate older structures (CURSOR.md, flat files, INDEX.yaml) to memory format v2.1 |
| **build**    | Build      | Scan project and auto-generate initial memory files from existing docs |
| **save**     | Save       | Capture learnings from the current session into memory |
| **maintain** | Maintain   | Compact, trim stale, fix index, clean old session logs |
| **sync**     | Sync       | Pull in external changes + save current session (end-of-session habit) |
| **status**   | Status     | Read-only health check — file counts, staleness, sync |

If no keyword is given, ask:

> **What would you like to do with agent memory?**
> 1. **Init** — Set up `.agent-memory/` for this project (first time)
> 2. **Migrate** — Upgrade older memory structures to memory format v2.1
> 3. **Build** — Scan project and generate initial memories
> 4. **Save** — Capture current session learnings
> 5. **Sync** — Pull in external changes + save this session (recommended end-of-session)
> 6. **Maintain** — Compact, trim stale, fix index
> 7. **Status** — Show memory health report

---

## Operation: Init

Scaffold the `.agent-memory/` system from scratch.

### Memory format v2.1 — Entry Points

```
project/
├── AGENTS.md                 # Canonical shared instructions (all tools read it)
├── CLAUDE.md                 # Thin pointer → "read AGENTS.md" + Claude-specific notes
├── .cursor/rules/index.mdc   # Cursor native: "Always" rule → references AGENTS.md (only when Cursor is in use)
└── .agent-memory/            # Cross-interface persistent memory
```

**Key:** `AGENTS.md` is the single source of truth. `CLAUDE.md` is thin. Never put shared instructions inside `.claude/` or `.cursor/`. Create only the per-agent pointer files for agents the project actually uses; `.cursor/rules/index.mdc` is Cursor-specific and should be skipped when Cursor is not in use.

### Steps

1. **Create directories:** `user/`, `feedback/`, `project/`, `decisions/`, `context/`, `conventions/`, `references/`, `sessions/` under `.agent-memory/`.
2. **Create files:** `.agent-memory/README.md` (system spec), `.agent-memory/index.yaml` (empty registry), `AGENTS.md` (canonical shared instructions), `CLAUDE.md` (thin pointer to AGENTS.md). Add per-agent pointer files only for agents the project uses — e.g. `.cursor/rules/index.mdc` (Cursor “Always” rule that points agents at `AGENTS.md` — same file Migrate creates from `CURSOR.md`) when a `.cursor/` directory exists or Cursor is otherwise in use. Skip it for non-Cursor projects.
3. **Fill in TODOs** in AGENTS.md with project's actual structure and rules.
4. **Update `index.yaml`** and **report** what was created.

---

## Operation: Migrate

Detect and migrate older structures to memory format v2.1.

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
4. **Session cleanup:** `type: session` with `updated` >60 days → extract valuable info elsewhere if needed, list deletion candidates, and ask for confirmation before deleting.
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

## Assessment Checklist

Use these prompts to choose the operation, then proceed without collecting unnecessary information:

1. Does `.agent-memory/` already exist, and what structure/version does it use?
2. Which operation fits the request: `init`, `migrate`, `build`, `save`, `sync`, `maintain`, or `status`?
3. Which agent entry points exist already (`AGENTS.md`, `CLAUDE.md`, Cursor rules), and do they point to the shared source of truth?
4. Which project docs can seed memory without copying them verbatim?
5. Is the memory local/private, or intended to be shared through git?

---

## Adjacent Patterns

| Pattern | When it is enough | When agent-memory is the better fit |
|---|---|---|
| Single client instruction file (`CLAUDE.md`, Cursor rule, etc.) | One tool and a small project | Multiple tools need a shared, indexed memory base |
| Session handoff note | One-time transfer between chats | Durable decisions, conventions, and project context need lifecycle management |
| Memory MCP/server | Searchable centralized service is already approved | Plain files, git review, and zero runtime dependencies are preferred |
