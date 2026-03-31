---
name: agent-memory
description: "Use when managing project memory, initializing .agent-memory/, saving session learnings, or running memory maintenance. Handles cross-interface persistent memory for any project."
license: MIT
compatibility: macOS, Linux, or Windows with bash (for bootstrap.sh)
metadata:
  author: t4sh
  version: "2.4.0"
  tags: memory, context, cross-interface, agent, persistence
alwaysAllow:
  - "Read"
  - "Glob"
  - "Grep"
---

# Agent Memory Skill

You are an expert in managing cross-interface persistent memory for AI-assisted projects. Your goal is to maintain a coherent, up-to-date knowledge base that any AI agent — Claude App, Claude Code CLI, VSCode, Craft Agent, or any file-reading tool — can read and build upon across sessions.

## Installation

### Via `npx skills` (recommended)

```bash
npx skills add t4sh/skills4sh --skill agent-memory
```

### Via manual install scripts

| Platform | Script | Usage |
|----------|--------|-------|
| macOS / Linux | `install.sh` | `./install.sh --global` or `./install.sh --project` |
| Windows | `install.ps1` | `.\install.ps1 -Global` or `.\install.ps1 -Project` |

Both scripts copy skill files to either `~/.claude/skills/agent-memory` (global) or `./.claude/skills/agent-memory` (project-local), handling existing installations, excluding meta files, and prompting for credential setup if a `.env.example` is present.

---

## What I Can Help With

- **Initializing project memory** — scaffold the `.agent-memory/` system with proper directory structure and entry points
- **Capturing session learnings** — distill decisions, feedback, and context into durable memory files
- **Cross-interface sync** — keep memory consistent when 4+ different AI interfaces touch the same project
- **Memory maintenance** — compact stale entries, resolve conflicts, clean orphaned files
- **Migration** — upgrade older memory formats (v1 flat files, CURSOR.md) to the v2.1 standard
- **Auto-building from docs** — scan existing project documentation and generate initial memory files

## Initial Assessment

Before operating on memory, understand:

1. **Current State**
   - Does `.agent-memory/` already exist?
   - What version/structure is in place?
   - Are there older formats (CURSOR.md, flat files, INDEX.yaml) that need migration?

2. **User's Goal**
   - First-time setup or ongoing management?
   - Saving learnings from this session or doing maintenance?
   - Working across multiple AI interfaces?

3. **Project Context**
   - What kind of project is this? (affects which memory types matter most)
   - Is there existing documentation to bootstrap from?
   - How many people/agents are contributing?

---

## Trigger

Invoke with `/agent-memory` or when the user mentions managing project memory.

## Commands

The user triggers an operation with a keyword:

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

Scaffold the `.agent-memory/` system from scratch. Delegates to the bootstrap script when available.

### v2.1 Standard — Entry Points

```
project/
├── AGENTS.md                 # Canonical shared instructions (Linux Foundation standard)
├── CLAUDE.md                 # Thin pointer → "read AGENTS.md" + Claude-specific notes
├── .claude/
│   └── settings.json         # Claude Code native: permissions, hooks
├── .cursor/
│   └── rules/
│       └── index.mdc         # Cursor native: "Always" rule → references AGENTS.md
└── .agent-memory/            # Cross-interface persistent memory
```

**Key principles:**
- `AGENTS.md` at project root is the single source of truth (all tools read it)
- `CLAUDE.md` is thin: "Read AGENTS.md first" + Claude-only gotchas
- `.claude/` and `.cursor/rules/` hold tool-native configs
- Never put shared instructions inside `.claude/` or `.cursor/` — those are tool-specific

### Steps

1. **Check if `.agent-memory/bootstrap.sh` exists** in the working directory.
   - If yes: `bash .agent-memory/bootstrap.sh init`
   - If no: check if a global copy exists at `~/.agents/skills/agent-memory/bootstrap.sh` and copy it in first.
   - If neither exists: create the directory structure and files manually (see structure below).

2. **Verify the result (v2.1):**
   - `.agent-memory/` directory with subdirs: `user/`, `feedback/`, `project/`, `decisions/`, `context/`, `conventions/`, `reference/`, `sessions/`
   - `.agent-memory/README.md` — self-describing spec
   - `.agent-memory/index.yaml` — empty registry
   - `AGENTS.md` at project root — canonical shared instructions
   - `CLAUDE.md` at project root — thin pointer to AGENTS.md
   - `.claude/settings.json` — Claude Code permissions
   - `.cursor/rules/index.mdc` — Cursor "Always" rule

3. **Fill in TODOs** in AGENTS.md with the project's actual structure and rules.

4. **Report** what was created.

---

## Operation: Migrate

Detect and migrate older structures to the v2.1 standard.

### What Gets Migrated

| Old Structure | New Structure | Action |
|---|---|---|
| `CURSOR.md` at root | `.cursor/rules/index.mdc` | Content moved, old file renamed `.migrated` |
| `INDEX.yaml` (uppercase) | `index.yaml` (lowercase) | Renamed |
| Flat `{type}--{topic}.md` | `{type}/{topic}.md` | Moved to directory |
| `summary:` frontmatter | `description:` frontmatter | Field renamed |
| `CLAUDE.md` with full instructions (no AGENTS.md) | `AGENTS.md` + thin `CLAUDE.md` | Promoted |

### Steps

1. **Run:** `bash .agent-memory/bootstrap.sh migrate`
2. Review the migration report.
3. Manually update `CLAUDE.md` to be a thin pointer if it was promoted.
4. Run `bash .agent-memory/bootstrap.sh fix` to verify index sync.

---

## Operation: Build

Scan the project and auto-generate initial memory files from existing documentation.

### Steps

1. **Scan for documentation sources:**
   - `*.md` files (README, specs, plans, guides)
   - `package.json`, `pyproject.toml`, `Cargo.toml` (project metadata)
   - `CLAUDE.md`, `AGENTS.md` (existing context files)
   - `*.yaml`, `*.yml` config files
   - `.env.example` (technology indicators)
   - Existing `.agent-memory/` files from older formats (migrate them)

2. **For each significant source**, distill into a memory file:
   - Project overview → `project/overview.md`
   - Architecture / tech stack → `project/architecture.md` or `reference/architecture.md`
   - Roadmap / phases → `project/roadmap.md`
   - Design decisions → `decisions/{topic}.md`
   - Coding conventions → `conventions/{topic}.md`
   - User identity (from CLAUDE.md, commit history) → `user/identity.md`

3. **Distillation rules:**
   - Summarize, don't copy. Memories are pointers + distilled knowledge.
   - One topic per file. Split if a source covers multiple unrelated topics.
   - Reference the source document: "See `docs/architecture.md` for full details."
   - Use the standard frontmatter format with appropriate tags.

4. **Migrate old formats if found:**
   - Flat `{type}--{topic}.md` files → move to `{type}/{topic}.md`
   - `INDEX.yaml` (uppercase) → rename to `index.yaml`
   - Old frontmatter fields (`summary` → `description`, add `source` and `status`)
   - v1 index entries → update paths to use directory format

5. **Update `index.yaml`** with all new/migrated entries.

6. **Run** `bash .agent-memory/bootstrap.sh fix` to verify sync.

7. **Report** what was generated, with a summary table.

---

## Operation: Save

Capture learnings from the current conversation into memory.

### Steps

1. **Review the conversation** for saveable knowledge:
   - Decisions made (architecture, naming, tool choices, approach)
   - Feedback given (corrections, confirmations, preferences)
   - Conventions discovered or established
   - Status changes (phase transitions, blockers resolved, features completed)
   - Important context the next session should know

2. **For each piece of knowledge**, determine:
   - Does an existing memory cover this? → **Update** the file (bump `updated`, edit body)
   - Is this new? → **Create** a new file in the appropriate `{type}/` directory
   - Significant session? → **Create** a session log in `sessions/`

3. **Determine the source identifier:**
   - Claude App (Cowork): `claude-app`
   - Claude Code CLI: `claude-code`
   - VSCode extension: `vscode`
   - Craft Agent: `craft-agent`
   - If unsure, ask or use `other`

4. **Write memory files** using the standard format (see File Format below).

5. **Session log** (for significant sessions):
   ```markdown
   ---
   id: sessions/YYMMDD-{slug}
   type: session
   title: "Session Title"
   description: >-
     Brief description of what happened.
   tags: [relevant, tags]
   source: {source-id}
   created: YYYY-MM-DD
   updated: YYYY-MM-DD
   status: active
   ---

   ## What Happened
   - Bullet points of work done

   ## Decisions Made
   - Any decisions with brief rationale

   ## Open Threads
   - Unfinished work or questions for next session
   ```

6. **Update `index.yaml`** — add new entries, update descriptions for modified entries.

7. **Report** what was saved/updated.

---

## Operation: Sync

Combined operation: ingest external changes **then** save current session learnings. This is the recommended end-of-session command when you work across multiple editors.

### Why Sync Exists

When 4 different interfaces (Claude App, CLI, VSCode, Craft Agent) touch the same `.agent-memory/`, files get added or modified externally. Running `sync` in one pass avoids needing `/agent-memory :maintain` then `/agent-memory :save` separately.

### Steps

**Phase 1 — Ingest external changes:**

1. **Run bootstrap fix** to detect filesystem↔index mismatches:
   ```bash
   bash .agent-memory/bootstrap.sh fix
   ```

2. **Scan for unindexed files** — memory files on disk that aren't in `index.yaml`:
   - For each unindexed `.md` file in a memory directory (`user/`, `feedback/`, `project/`, etc.):
     - Read its frontmatter
     - Add an entry to `index.yaml` with its `id`, `path`, `type`, `title`, `tags`, `description`
   - Report each file discovered with its source (who created it)

3. **Scan for orphan index entries** — entries in `index.yaml` whose files no longer exist:
   - Remove orphan entries from `index.yaml`
   - Report each removal

4. **Check for updated content** — files whose `updated` date is newer than what the current agent last saw:
   - Read the file to absorb the updated content into context
   - No file changes needed — just awareness

**Phase 2 — Save current session:**

5. **Run the full Save operation** (see Operation: Save above):
   - Review conversation for saveable knowledge
   - Update existing memories or create new ones
   - Create session log if significant work was done
   - Update `index.yaml`

**Phase 3 — Report:**

6. **Single combined report:**
   ```
   Sync Report
   ───────────────
   External changes ingested:
     New files found:      X  (added to index)
     Orphan entries:       X  (removed from index)
     Updated externally:   X  (content refreshed)

   Session saved:
     Memories updated:     X
     Memories created:     X
     Session log:          Yes/No

   Index entries:          X total
   ```

---

## Operation: Maintain

Full maintenance cycle: compact, trim stale, fix index, clean old session logs.

### Steps

1. **Run bootstrap doctor:**
   ```bash
   bash .agent-memory/bootstrap.sh doctor
   ```
   This handles index↔filesystem sync and basic health reporting.

2. **Staleness check:**
   - `context/` memories not updated in 30+ days → ask: update, archive, or remove?
   - Any memory with `expires` date in the past → same question
   - Any memory with `status: archived` older than 90 days → suggest deletion

3. **Compaction:**
   - Read all memory files. Identify significant content overlap.
   - Suggest merges where two files cover the same topic.
   - Look for patterns in session logs that should be promoted to `conventions/` or `decisions/`.

4. **Session log cleanup:**
   - Session logs older than 60 days: check if key information is captured elsewhere.
   - If yes → safe to delete.
   - If no → extract valuable info into appropriate memory files first, then delete.

5. **Report** with full health summary:
   ```
   Memory Health Report
   ───────────────────────
   Total memories:        X
   By type:               user(X) feedback(X) project(X) decision(X) context(X) convention(X) reference(X) session(X)
   Stale (30+ days):      X
   Expired:               X
   Archived:              X
   Index fixes:           X
   Compaction candidates: X
   Sessions cleaned:      X
   ```

---

## Operation: Status

Quick read-only health check. No modifications.

### Steps

1. **Run:**
   ```bash
   bash .agent-memory/bootstrap.sh status
   ```

2. If `.agent-memory/` doesn't exist, suggest running `init`.

3. Report the output. If issues are found, suggest running `maintain`.

---

## File Format Reference

### Frontmatter Schema

```yaml
---
id: {type}/{topic}                # matches directory/filename (no .md)
type: user | feedback | project | decision | context | convention | reference | session
title: Human-readable title
description: >-
  One-line summary — decides relevance without opening the file.
tags: [tag1, tag2]
source: claude-app | claude-code | vscode | craft-agent | other
created: YYYY-MM-DD
updated: YYYY-MM-DD
status: active | archived
expires: YYYY-MM-DD              # optional — review date for context memories
supersedes: {id}                 # optional — ID of memory this replaces
---

Markdown body.
For feedback/decision types, include **Why:** and **How to apply:** sections.
```

### Memory Types

| Type       | Directory      | What Goes Here                                  | Changes     |
|------------|----------------|-------------------------------------------------|-------------|
| user       | user/          | Role, goals, preferences, collaboration style   | Rarely      |
| feedback   | feedback/      | Corrections and confirmations — do/don't        | As given    |
| project    | project/       | What the project IS (concept, progress, status) | Often       |
| decision   | decisions/     | Why things are the way they are (rationale)     | When changed|
| context    | context/       | Current state, active work, sprint focus        | Frequently  |
| convention | conventions/   | Patterns and rules for working on this project  | Occasionally|
| reference  | reference/     | External resources, architecture, patterns      | Rarely      |
| session    | sessions/      | Lightweight session logs                        | Each session|

### Rules

1. **Distill, don't transcribe.** Summaries and decisions, not conversation dumps.
2. **One idea per file.** Split if a memory covers unrelated topics.
3. **Update in place.** When facts change, edit the file. Don't append forever.
4. **Keep index in sync.** Every file in index, every index entry points to a file.
5. **Use `expires` on context.** Context goes stale. Set a review date.
6. **Reference, don't copy.** Point to source docs instead of duplicating content.
7. **No secrets.** No credentials, PII, or sensitive data in memory files.
8. **Absolute dates.** Convert "next Thursday" to "2026-03-27" when saving.

---

## Display Conventions

When showing memory files or project documents to the user, **always render them inline in the chat** rather than opening external editors. This applies to all interfaces (Claude App, Claude Code CLI, VSCode, Craft Agent).

### Universal (works everywhere)

| Format | How to Display |
|--------|---------------|
| **Markdown** (`.md`) | Render the file body directly as inline markdown (strip YAML frontmatter — show only the body, optionally with the `title` as a heading) |
| **YAML** (`.yaml`, `.yml`) | Render in a `yaml` fenced code block |
| **JSON** (`.json`) | Render in a `json` fenced code block |
| **Plain text** (`.txt`, `.log`) | Render in a plain fenced code block |

### Rich previews (use when the interface supports them)

If the interface supports rich preview blocks (e.g., Craft Agent), prefer these for binary and rich formats. Otherwise, fall back to describing the file with its path as a clickable link.

| Format | Rich Preview | Fallback |
|--------|-------------|----------|
| **PDF** (`.pdf`) | `pdf-preview` code block with `"src"` | Show file path as link + page count |
| **Images** (`.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.svg`) | `image-preview` code block with `"src"` | Show file path as link |
| **HTML** (`.html`) | `html-preview` code block with `"src"` | Show file path as link |
| **Multiple files** | Use `items` array with tabs | Render each under a heading |
| **Index / tables** | `datatable` code block | `yaml` code block |

### Guidelines

- **Never open external editors** unless the user explicitly asks to edit a file externally.
- **Strip frontmatter for markdown display.** Omit the `---` YAML frontmatter block — show only the markdown body.
- **Large files.** For very long markdown files, summarize and offer to show specific sections. For PDFs over 10 pages, note the page count.
- **Index display.** When showing `index.yaml`, use whichever format is most readable — a table, datatable, or yaml code block.

---

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

---

## Troubleshooting

### `bootstrap.sh` Not Found
- Check if the skill was installed correctly: `ls ~/.agents/skills/agent-memory/bootstrap.sh`
- If missing, re-install the skill or create the directory structure manually using the Init operation steps

### Index Out of Sync
- Run `bash .agent-memory/bootstrap.sh fix` — this reconciles filesystem with index
- If `fix` doesn't resolve it, run `bash .agent-memory/bootstrap.sh doctor` for a full diagnostic

### Migration Fails
- Check for file permission issues on `.agent-memory/` directory
- Ensure old files have valid YAML frontmatter — malformed frontmatter blocks migration
- Run migration with verbose output: review each file it tries to move

### Memory Not Being Read by Other Interfaces
- Verify `AGENTS.md` exists at project root and references `.agent-memory/`
- Check that `.claude/settings.json` includes read permissions for the memory directory
- Ensure `.cursor/rules/index.mdc` references `AGENTS.md`

---

## Tools Referenced

**Built-in**
- `bootstrap.sh` — shell script for init, migrate, fix, doctor, status operations
- `index.yaml` — machine-readable registry of all memory files
- `AGENTS.md` — canonical shared instructions (Linux Foundation standard)

**AI Interfaces Supported**
- Claude App (Cowork) — reads AGENTS.md + `.agent-memory/`
- Claude Code CLI — reads CLAUDE.md → AGENTS.md → `.agent-memory/`
- VSCode (Claude extension) — reads CLAUDE.md → AGENTS.md
- Cursor — reads `.cursor/rules/index.mdc` → AGENTS.md → `.agent-memory/`
- Craft Agent — reads AGENTS.md + `.agent-memory/` with rich preview support

---

## Task-Specific Questions

1. Is this a new project or does `.agent-memory/` already exist?
2. Are you working across multiple AI interfaces (Claude App, CLI, VSCode, Cursor)?
3. Do you have existing documentation that should be bootstrapped into memory?
4. Is this a solo project or shared with a team?
5. When was the last time memory maintenance was run?

---

## Related Skills

- **revise-claude-md**: For updating CLAUDE.md with session learnings (complementary to memory save)
- **session-save**: For capturing files and responses from current chat to disk
- **find-skills**: For discovering additional skills that may generate useful memory entries
