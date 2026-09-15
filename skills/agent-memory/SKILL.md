---
name: agent-memory
description: "Persist project decisions, conventions, and session handoffs as reviewable markdown in `.agent-memory/`. Use when asked to \"manage project memory\", \"initialize .agent-memory\", \"migrate memory\", \"build memory from docs\", \"save session learnings\", \"sync memory\", \"run memory maintenance\", \"check memory status\", or \"onboard a new developer\"; when `.agent-memory/` or `AGENTS.md` memory pointers are in play; when sharing project context with another developer or reviewing project memory in a pull request; or when context \"forgets between sessions\". Sync reconciles files already in the checkout. Not for memory leaks, RAM usage, or human memory."
license: MIT
compatibility: macOS, Linux, or Windows
metadata:
  author: t4sh
  version: "2.7.7"
  tags: memory, context, cross-interface, agent, persistence, grok, openclaw
---

# Agent Memory Skill

Manage persistent project memory as reviewable markdown in the repository. Any file-reading agent can read and update the same `.agent-memory/` files across sessions.

## Capabilities

| Area | Outcome |
|------|---------|
| Initialize | Scaffold `.agent-memory/` with structure and entry points |
| Capture | Distill session decisions, feedback, and context into durable memory files |
| Sync | Reconcile `.agent-memory/` files already in the checkout, then save the session |
| Maintain | Compact stale entries, resolve conflicts, clean orphaned files |
| Migrate | Upgrade older formats (v1 flat files, `CURSOR.md`) to memory format v2.1 |
| Build | Scan existing documentation and generate initial memory files |

## Design Principles

| Principle | Practice |
|---|---|
| Open files | Store memory as YAML-frontmatter markdown that can be read and edited with any editor or file-reading agent. |
| Shared entry point | Keep `AGENTS.md` as the canonical instructions file; keep client-specific files thin pointers. |
| Native-memory coexistence | Treat vendor auto-memory as machine-local scratch and `.agent-memory/` as the deliberate cross-agent, reviewable source; do not overwrite or duplicate native stores. |
| Managed lifecycle | Use typed directories, `expires` metadata, `maintain`, and `sync` so memory stays current instead of accumulating noise. |
| No secrets | Store project knowledge and decisions, never credentials, private keys, tokens, or sensitive personal data. |

---

## Initial Assessment

Before operating on memory, understand:

1. **Current State** — Does `.agent-memory/` exist? What version/structure? Older formats needing migration?
2. **Requested outcome** — First-time setup, saving learnings, or maintenance?
3. **Project Context** — Project type, existing docs, how many people/agents contributing?

---

## Commands

| Keyword      | Operation  | Description |
|--------------|------------|-------------|
| **init**     | Initialize | Scaffold `.agent-memory/`, README, index, and `AGENTS.md`, plus pointer files only for agents already in use |
| **migrate**  | Migrate    | Detect and migrate older structures (CURSOR.md, flat files, INDEX.yaml) to memory format v2.1 |
| **build**    | Build      | Scan project and auto-generate initial memory files from existing docs |
| **save**     | Save       | Capture learnings from the current session into memory |
| **maintain** | Maintain   | Compact, trim stale, fix index, clean old session logs |
| **sync**     | Sync       | Reconcile memory files already in the checkout + save current session |
| **status**   | Status     | Read-only health check — file counts, staleness, sync |

Infer the operation from a clear request; a literal command keyword is not required. For example, “remember why we chose SQLite” routes to Save, and “reconcile these memory files and capture our decision” routes to Sync. Ask one focused question only when the intended operation or a required input remains ambiguous. Preserve read-only requests: onboarding or reviewing existing memory does not authorize rebuilding or saving it.

For a developer handoff, read the index and relevant entries, summarize the current decisions and open questions, and cite their files. Preserve proposals as proposals. A newer timestamp alone does not resolve conflicting decisions; inspect their evidence and review status, then ask when the accepted direction is unknown. Record `supersedes` only when replacement is established.

For cross-repository work, use accessible references to the owning project's decisions with a revision when relevant. Summarize only the context needed locally; identify unavailable sources rather than inventing their contents. A request concerning one repository does not authorize edits to another.

---

## Operation: Init

Scaffold the `.agent-memory/` system from scratch.

**Overwrite guard:** Before creating or changing `AGENTS.md`, `.agent-memory/index.yaml`, `.agent-memory/README.md`, or any pointer file listed in [references/agent-pointers.md](references/agent-pointers.md), inspect any existing file and preserve its content. If a target file already exists and is not a thin compatible pointer, stage the proposed replacement and ask before overwriting. Report every file kept, created, or changed.

### Memory format v2.1 — Entry Points

```
project/
├── AGENTS.md          # Canonical shared instructions
└── .agent-memory/     # Reviewable project memory
```

**Key:** `AGENTS.md` is the shared source of truth. Add thin pointer files only for agents the project already uses; recipes live in [references/agent-pointers.md](references/agent-pointers.md). Never put shared instructions inside a vendor-only directory. Detect native memory/rule locations read-only and report them; do not migrate or overwrite them implicitly.

### Steps

1. **Create directories:** `user/`, `feedback/`, `project/`, `decisions/`, `context/`, `conventions/`, `references/`, `sessions/` under `.agent-memory/`.
2. **Create files:** `.agent-memory/README.md` (system spec), `.agent-memory/index.yaml` (empty registry), and `AGENTS.md` (canonical shared instructions). Create pointer files only for agents already in use, following [references/agent-pointers.md](references/agent-pointers.md).
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
| `CLAUDE.md` with full instructions (no AGENTS.md) | `AGENTS.md` + a thin pointer file | Promoted; pointer recipe in [agent-pointers.md](references/agent-pointers.md) |

**Steps:** Scan for each old structure listed above → preserve existing content → perform only confirmed migrations → move shared instructions into `AGENTS.md`, then rewrite leftover client files as thin pointers per [references/agent-pointers.md](references/agent-pointers.md) → reconcile `index.yaml` with filesystem → report what changed.

**Migration guard:** Renames, moves, and pointer rewrites are destructive. Before renaming `CURSOR.md`, `INDEX.yaml`, or replacing instruction files, show the planned source and destination paths and ask for confirmation unless the file is empty or already an exact generated pointer. Keep a backup or `.migrated` file whenever content is moved.

---

## Operation: Build

Scan project and auto-generate initial memory files from existing docs.

1. **Scan** for docs: `*.md`, `package.json`, `pyproject.toml`, `Cargo.toml`, `CLAUDE.md`, `AGENTS.md`, `*.yaml` configs, `.env.example`
2. **Distill** each source: overview → `project/overview.md`, architecture → `project/architecture.md`, decisions → `decisions/{topic}.md`, conventions → `conventions/{topic}.md`, user preferences/collaboration style → `user/preferences.md` only when explicitly confirmed by the user
3. **Rules:** Summarize don't copy. One topic per file. Reference source docs. Use standard frontmatter.
4. **Migrate** old formats if found (flat files, old frontmatter fields)
5. **Update `index.yaml`** — add entries for each new file, reconcile with filesystem
6. **Report** with summary table

---

## Operation: Save

Capture learnings from the current conversation into memory.

1. **Review conversation** for: decisions, feedback, conventions, status changes, important context
2. **For each piece:** update existing memory file or create new one in appropriate `{type}/` directory. Create session log in `sessions/` for significant sessions.
3. **Source identifier:** record the writing runtime as a slug (`codex`, `claude-code`, `cursor`, `grok`, `openclaw`, `vscode`, `craft-agent`, or `other`)
4. **Write files** using standard frontmatter format (see [references/templates.md](references/templates.md))
5. **Update `index.yaml`** and **report** what was saved/updated

---

## Operation: Sync

Reconcile memory files **already present in the current checkout**, then save the session. Sync does not fetch, pull, merge, commit, push, or synchronize another repository or a vendor-native memory store. Git operations require their own task authorization and repository workflow.

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
8. **Absolute dates.** Resolve relative dates from the date and timezone supplied by the task; otherwise use the current date and timezone. Compute and verify the calendar date, then save it as `YYYY-MM-DD`. Never copy a date from a template. Ask only when the intended reference date or relative phrase is ambiguous.

For frontmatter schema, memory types, and templates, see [references/templates.md](references/templates.md).

---

## Reference Files

| File | Contents |
|------|----------|
| [references/templates.md](references/templates.md) | Session log template, sync/health report templates, frontmatter schema, memory types table |
| [references/agent-pointers.md](references/agent-pointers.md) | Installer skill roots, thin pointer files, and native-memory scope and preservation boundaries |
| [references/display-conventions.md](references/display-conventions.md) | How to render memory files inline (markdown, YAML, JSON, rich previews, guidelines) |
| [references/troubleshooting.md](references/troubleshooting.md) | Common issues by project type (solo, multi-agent, team, monorepo), troubleshooting Q&A |

---

## Assessment Checklist

Use these prompts to choose the operation, then proceed without collecting unnecessary information:

1. Does `.agent-memory/` already exist, and what structure/version does it use?
2. Which operation fits the request: `init`, `migrate`, `build`, `save`, `sync`, `maintain`, or `status`?
3. Which instruction or pointer files already exist, do they point at `AGENTS.md`, and which vendor-native memory stores must be left untouched? See [references/agent-pointers.md](references/agent-pointers.md).
4. Which project docs can seed memory without copying them verbatim?
5. Is the memory local/private, or intended to be shared through git?

---

## Adjacent Patterns

| Pattern | When it is enough | When agent-memory is the better fit |
|---|---|---|
| Single client instruction file | One tool and a small project | Multiple tools need a shared, indexed memory base |
| Vendor auto-memory | Local scratch and automatic recall inside one client | Knowledge must be portable, reviewable, shareable through git, or consistent across checkouts |
| Session handoff note | One-time transfer between chats | Durable decisions, conventions, and project context need lifecycle management |
| Memory MCP/server | Searchable centralized service is already approved | Plain files, git review, and zero runtime dependencies are preferred |

## Behavioral evals

**Authors/reviewers only:** use the [scenario catalog](assets/evals/scenarios.json) when explicitly evaluating this skill. Skip it during normal task execution. Materialize each case in a fresh temporary directory, withhold assertions from the executing agent, and grade the resulting artifacts and actions. The catalog defines expected behavior; it is not evidence of a passing run. Synthetic browser and service inputs test decisions only, not live integrations.
