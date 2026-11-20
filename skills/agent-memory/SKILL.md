---
name: agent-memory
description: "Persist and recall project decisions in reviewable `.agent-memory/` markdown. Use when asked to \"remember a project decision\", \"save session learnings\", \"initialize .agent-memory\", \"manage project memory\", \"migrate memory\", \"build memory from docs\", \"sync memory\", \"run memory maintenance\", or \"check memory status\"; when asked \"what did we decide about X\" or \"why did we choose X\" in a repository that has `.agent-memory/`; when changing or reviewing `.agent-memory/` files or their `AGENTS.md` loading instruction; when sharing that memory with, or onboarding, another developer or agent; or when an agent \"forgets between sessions\". Not for unrelated work in a repository that merely contains `.agent-memory/`, general onboarding or machine setup, writing ADRs, vendor auto-memory consolidation, personal agent rulebooks, memory leaks, RAM usage, or human memory."
license: MIT
compatibility: macOS, Linux, or Windows; optional checker needs Node.js 22+
metadata:
  author: t4sh
  version: "3.0.0"
  tags: memory, context, cross-interface, agent, persistence, grok, openclaw
---

# Agent Memory Skill

Manage persistent project memory as reviewable markdown in the repository. Any file-reading agent can read and update the same `.agent-memory/` files across sessions.

## Design Principles

| Principle | Practice |
|---|---|
| Open files | Store memory as YAML-frontmatter markdown that can be read and edited with any editor or file-reading agent; the bundled checker is optional. |
| Shared entry point | Keep `AGENTS.md` as the canonical instructions file; keep client-specific files thin pointers. |
| Native-memory coexistence | Leave host-native memory (Claude Code auto memory, Copilot Memory) untouched and unmirrored; `.agent-memory/` is the deliberate cross-agent, reviewable source. |
| Managed lifecycle | Use typed directories, `expires` metadata, `maintain`, and `sync` so memory stays current instead of accumulating noise. |
| No secrets | Store project knowledge and decisions, never credentials, private keys, tokens, or sensitive personal data. |

---

## Commands

| Keyword      | Operation  | Description |
|--------------|------------|-------------|
| **init**     | Initialize | Scaffold `.agent-memory/`, README, index, and `AGENTS.md`, plus pointer files only where needed |
| **migrate**  | Migrate    | Detect and migrate older structures (CURSOR.md, flat files, INDEX.yaml) to memory format v2.1 |
| **build**    | Build      | Scan project and auto-generate initial memory files from existing docs |
| **save**     | Save       | Capture learnings from the current session into memory |
| **maintain** | Maintain   | Compact, trim stale, fix index, clean old session logs |
| **sync**     | Sync       | Reconcile memory files already in the checkout + save current session |
| **status**   | Status     | Read-only health check — file counts, staleness, sync |
| **recall**   | Recall     | Read-only — answer what was decided and why, citing files |

Infer the operation from a clear request; a literal command keyword is not required. For example, “remember why we chose SQLite” routes to Save, and “reconcile these memory files and capture our decision” routes to Sync. Ask one focused question only when the intended operation or a required input remains ambiguous. Preserve read-only requests: recall, onboarding, or reviewing existing memory does not authorize rebuilding or saving it.

For Recall or a developer handoff, read the index and relevant entries, answer or summarize the current decisions and open questions with file citations, say when no entry covers the question, and write nothing. Preserve proposals as proposals. A newer timestamp alone does not resolve conflicting decisions; inspect their evidence and review status, then ask when the accepted direction is unknown. Record `supersedes` only when replacement is established.

For cross-repository work, use accessible references to the owning project's decisions with a revision when relevant. Summarize only the context needed locally; identify unavailable sources rather than inventing their contents. A request concerning one repository does not authorize edits to another.

Show memory files inline rather than in an external editor: markdown bodies without YAML frontmatter; YAML, JSON, and plain text in fenced code blocks.

## Assessment Checklist

Use these prompts to choose the operation, then proceed without collecting unnecessary information:

1. Does `.agent-memory/` already exist, and what structure/version does it use?
2. Which Commands-table operation fits the request?
3. Which instruction or pointer files already exist, do they point at `AGENTS.md`, and which vendor-native memory stores must be left untouched? See [references/agent-pointers.md](references/agent-pointers.md).
4. Which project docs can seed memory without copying them verbatim?
5. Is the memory local/private, or intended to be shared through git?

**No `.agent-memory/`:** never scaffold silently. Report its absence and suggest `init`; Save and Sync confirm Init with one question before writing, unless the request asks for setup.

---

## Operation: Init

**Overwrite guard:** Before creating or changing `AGENTS.md`, `.agent-memory/index.yaml`, `.agent-memory/README.md`, or any pointer file listed in [references/agent-pointers.md](references/agent-pointers.md), inspect any existing file and preserve its content. If a target file already exists and is not a thin compatible pointer, stage the proposed replacement and ask before overwriting. Report every file kept, created, or changed.

### Memory format v2.1 — Entry Points

```
project/
├── AGENTS.md          # Canonical shared instructions
└── .agent-memory/     # Reviewable project memory
```

**Key:** `AGENTS.md` is the shared source of truth. Add a thin pointer file only where [references/agent-pointers.md](references/agent-pointers.md#pointer-files) requires one for a runtime in use; never delete an existing pointer. Never put shared instructions inside a vendor-only directory. Detect native memory/rule locations read-only and report them; do not migrate or overwrite them implicitly.

### Steps

1. **Create directories:** `user/`, `feedback/`, `project/`, `decisions/`, `context/`, `conventions/`, `references/`, `sessions/` under `.agent-memory/`.
2. **Create files:** `.agent-memory/README.md` (system spec), `.agent-memory/index.yaml` (empty `[]` registry in the [index format](references/templates.md#index-registry)), and `AGENTS.md`; pointer files only per the Key above. Keep an existing compatible index format and its entries; do not reset it to `[]`.
3. **Complete `AGENTS.md`:** replace every placeholder with the project's actual structure and rules. Include the [session-start loading instruction](references/agent-pointers.md#session-start-loading) so the next agent reads the index and relevant entries. Preserve substantive existing instructions under the overwrite guard; propose the addition rather than replacing them without approval. Done when no TODO or placeholder tokens remain and the loading instruction is present or its pending approval is reported.
4. **Check the registry** and **report** what was created or kept. An empty `[]` index is correct until entries are saved or the separate Build operation is requested; do not invent project memories during Init. Done when a new registry parses as an empty list, or an existing registry retains its entries, and next-session discovery is configured or explicitly pending approval.

---

## Operation: Migrate

| Old Structure | New Structure | Action |
|---|---|---|
| `CURSOR.md` at root | `AGENTS.md` | Shared content merged into `AGENTS.md`; no new Cursor pointer; old file kept as `CURSOR.md.migrated` |
| `INDEX.yaml` (uppercase) | `index.yaml` (lowercase) | Renamed |
| Flat `{type}--{topic}.md` | `{type}/{topic}.md` | Moved to directory |
| `summary:` frontmatter | `description:` frontmatter | Field renamed |
| `CLAUDE.md` with full instructions (no AGENTS.md) | `AGENTS.md` + `CLAUDE.md` reduced to the `@AGENTS.md` import | Promoted; an existing `CLAUDE.md` [still needs the import](references/agent-pointers.md#when-claude-code-needs-a-pointer) |

**Steps:** Scan for each old structure listed above → preserve existing content → perform only confirmed migrations → move shared instructions into `AGENTS.md`, then apply the pointer rules in [references/agent-pointers.md](references/agent-pointers.md) to leftover client files → reconcile `index.yaml` with filesystem → report what changed. Done when every confirmed migration has a backup or `.migrated` file, shared instructions live only in `AGENTS.md`, and index ↔ filesystem differences are empty.

**Migration guard:** Renames, moves, and pointer rewrites are destructive. Before renaming `CURSOR.md`, `INDEX.yaml`, or replacing instruction files, show the planned source and destination paths and ask for confirmation unless the file is empty or already an exact generated pointer. Keep a backup or `.migrated` file whenever content is moved.

---

## Operation: Build

1. **Scan** for docs: `*.md`, `package.json`, `pyproject.toml`, `Cargo.toml`, `CLAUDE.md`, `AGENTS.md`, `*.yaml` configs, `.env.example`
2. **Distill** each source: overview → `project/overview.md`, architecture → `project/architecture.md`, decisions → `decisions/{topic}.md`, conventions → `conventions/{topic}.md`, user preferences/collaboration style → `user/preferences.md` only when explicitly confirmed by the user
3. **Rules:** Summarize don't copy. One topic per file. Reference source docs. Use standard frontmatter.
4. **Migrate** old formats if found (flat files, old frontmatter fields)
5. **Update `index.yaml`** — add entries for each new file, reconcile with filesystem
6. **Report** with summary table. Done when every new file has standard frontmatter and an index entry, index ↔ filesystem differences are empty, and the report lists each created path with its source doc.

---

## Operation: Save

1. **Review conversation** for: decisions, feedback, conventions, status changes, important context
2. **For each piece:** update existing memory file or create new one in appropriate `{type}/` directory. Create session log in `sessions/` for significant sessions. On a [native-memory host](references/agent-pointers.md#when-an-operation-runs-on-a-native-memory-host), write only to `.agent-memory/`.
3. **Source identifier:** record the writing runtime as a slug (`codex`, `claude-code`, `cursor`, `grok`, `openclaw`, `vscode`, `craft-agent`, or `other`)
4. **Write files** using standard frontmatter format (see [references/templates.md](references/templates.md))
5. **Update `index.yaml`** and **report** what was saved/updated. Done when the report lists each created or updated path with its `id`, and each path has an index entry.

---

## Operation: Sync

Reconcile memory files **already present in the current checkout**, then save the session. Sync does not fetch, pull, merge, commit, push, or synchronize another repository or a vendor-native memory store. Git operations require their own task authorization and repository workflow.

**Phase 1 — Ingest:** Index unindexed memory files in the type directories → remove entries confirmed absent (retain and report skipped paths) → refresh entries that differ from their file's frontmatter; only these count as updated externally. With Node.js and a shell, run the [index checker](references/checker.md); otherwise compare by hand.

**Phase 2 — Save:** Run the full Save operation.

**Phase 3 — Report:** Combined report in the [sync report format](references/templates.md#sync-report-template).

Done when the index ↔ filesystem difference is empty and every fact saved this session maps to an indexed file with standard frontmatter.

---

## Operation: Maintain

To archive, set `status: archived` in the file and its index entry; keep the file ([details](references/templates.md#memory-file-frontmatter-schema)).

1. **Health check:** Count files by type, fix the index as in Sync Phase 1 (checker or manual), identify stale/expired entries.
2. **Staleness check — frontmatter-driven:**
   - **Primary signal:** `expires` field. If `expires` < today → flag as expired, ask update/archive/remove.
   - **Fallback (no `expires`):** Use `updated` date (or `created` if never updated) + type-based thresholds: `context/` >30 days, `sessions/` >60 days.
   - **Archived entries:** `status: archived` with `updated` >90 days ago → suggest deletion.
   - **`supersedes` chain:** If file A has `supersedes: B`, and B still exists with `status: active`, flag B for archival.
3. **Compaction:** Identify content overlap, suggest merges, promote session log patterns to `conventions/` or `decisions/`.
4. **Session cleanup:** stale sessions → extract valuable info elsewhere if needed, list deletion candidates, and ask for confirmation before deleting.
5. **Report** in the [health report format](references/templates.md#memory-health-report-template). Done when index ↔ filesystem differences are empty, every flagged item has a user decision or is listed as pending, and nothing was deleted or archived without confirmation.

---

## Operation: Status

Read-only: count files by type, check index ↔ filesystem sync (checker or manual), report stale/expired entries; suggest `maintain` on issues.

---

## File Format Rules

1. **Distill, don't transcribe.** Summaries and decisions, not conversation dumps.
2. **One idea per file.** Split if a memory covers unrelated topics.
3. **Update in place.** When facts change, edit the file and set `updated` to today. Don't append forever.
4. **Keep index in sync.** Every file in index, every index entry points to a file.
5. **Use `expires` on context.** Context goes stale. Set a review date.
6. **Reference, don't copy.** Point to source docs instead of duplicating content.
7. **No secrets.** No credentials, PII, or sensitive data in memory files.
8. **Absolute dates.** Resolve relative dates from the date and timezone supplied by the task; otherwise use the current date and timezone. Compute and verify the calendar date, then save it as `YYYY-MM-DD`. Never copy a date from a template. Ask only when the intended reference date or relative phrase is ambiguous.

---

## Reference Files

| File | Contents |
|------|----------|
| [references/templates.md](references/templates.md) | Session log template, sync/health report templates, frontmatter schema, memory types table |
| [references/agent-pointers.md](references/agent-pointers.md) | Installer skill roots, when a pointer file is needed, and native-memory host rules |
| [references/checker.md](references/checker.md) | Optional read-only [index checker](assets/scripts/check-memory.mjs): usage, codes, manual comparison |
| [references/troubleshooting.md](references/troubleshooting.md) | Common issues by project type (solo, multi-agent, team, monorepo), troubleshooting Q&A |

---

## Adjacent Patterns

| Pattern | When it is enough | When agent-memory is the better fit |
|---|---|---|
| Single client instruction file | One tool and a small project | Multiple tools need a shared, indexed memory base |
| Vendor auto-memory | Automatic recall inside one client | Knowledge must be portable, reviewable, shareable through git, or consistent across checkouts |
| Session handoff note | One-time transfer between chats | Durable decisions, conventions, and project context need lifecycle management |
| Memory MCP/server | Searchable centralized service is already approved | Plain files and git review with no required runtime are preferred |

## Behavioral evals

**Authors/reviewers only:** use the [scenario catalog](assets/evals/scenarios.json) when explicitly evaluating this skill. Skip it during normal task execution. Materialize each case in a fresh temporary directory, withhold assertions from the executing agent, and grade the resulting artifacts and actions. The catalog defines expected behavior; it is not evidence of a passing run. Synthetic browser and service inputs test decisions only, not live integrations.
