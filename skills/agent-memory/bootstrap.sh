#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────
# .agent-memory — cross-interface persistent memory toolkit v2.1
#
# Usage:
#   bash .agent-memory/bootstrap.sh [command] [project-root]
#
# Commands:
#   init      Create .agent-memory/ structure + entry points (default)
#   migrate   Detect and migrate older structures to v2.1 standard
#   status    Read-only health check — file counts, staleness, index sync
#   fix       Fix index.yaml ↔ filesystem mismatches (non-destructive)
#   doctor    Full diagnostic: status + fix + staleness report
#
# Safe to re-run. Skips files that already exist on init.
#
# v2.1 changes:
#   - AGENTS.md is the canonical shared file (Linux Foundation standard)
#   - CLAUDE.md is a thin pointer: "read AGENTS.md first"
#   - .claude/ and .cursor/rules/ for tool-native configs
#   - Migrates: root CURSOR.md → .cursor/rules/index.mdc
#   - Migrates: flat {type}--{topic}.md → {type}/{topic}.md
#   - Migrates: INDEX.yaml → index.yaml
# ─────────────────────────────────────────────────────────────────
set -euo pipefail

CMD="${1:-init}"
ROOT="${2:-.}"
MEM="$ROOT/.agent-memory"
TODAY=$(date +%Y-%m-%d)

# ── Colors (if terminal supports them) ──
if [ -t 1 ]; then
  G='\033[0;32m'; Y='\033[0;33m'; R='\033[0;31m'; C='\033[0;36m'; B='\033[1m'; N='\033[0m'
else
  G=''; Y=''; R=''; C=''; B=''; N=''
fi

# ═══════════════════════════════════════════════════════════════
# INIT — scaffold the directory structure and entry points
# ═══════════════════════════════════════════════════════════════
do_init() {
  echo -e "${B}🧠 Initializing .agent-memory/ in ${ROOT}${N}"
  echo ""

  # ── Run migration first (non-destructive) ──
  do_migrate_silent

  # ── Directories ──
  for dir in user feedback project decisions context conventions reference sessions; do
    mkdir -p "$MEM/$dir"
  done
  echo -e "  ${G}✓${N} Directory tree created"

  # ── README.md ──
  if [ ! -f "$MEM/README.md" ]; then
cat > "$MEM/README.md" << HEREDOC
---
title: Agent Memory System
version: "2.1"
created: ${TODAY}
updated: ${TODAY}
---

# \`.agent-memory/\` — Cross-Interface Persistent Memory

Single source of truth for project context shared across all AI interfaces:
Claude App, Claude Code CLI, VSCode (Cursor), Craft Agent, or any file-reading agent.

## Quick Start for Agents

1. Read \`index.yaml\` — lists every memory file with type, description, and path.
2. Load only what's relevant to the current task.
3. If a memory conflicts with the current codebase, trust what you observe — then update the memory.

## Directory Structure

\`\`\`
.agent-memory/
├── index.yaml              # Machine-readable registry (read first)
├── README.md               # System spec (this file)
├── user/                   # Who the user is, preferences
├── feedback/               # Corrections and confirmations
├── project/                # Ongoing work, goals, progress
├── decisions/              # Architectural decisions (lightweight ADRs)
├── context/                # Current phase, sprint, active focus
├── conventions/            # Tone, voice, naming, code style
├── reference/              # External resources, architecture docs
└── sessions/               # Session logs (YYMMDD-slug.md)
\`\`\`

## Entry Points (v2.1 Standard)

\`\`\`
project/
├── AGENTS.md               # Canonical shared instructions (all tools read this)
├── CLAUDE.md               # Thin pointer → "read AGENTS.md" + Claude-specific notes
├── .claude/                # Claude Code native settings (settings.json, rules/)
├── .cursor/rules/          # Cursor native rules (.mdc files)
└── .agent-memory/          # This directory — cross-interface memory
\`\`\`

## File Format

\`\`\`yaml
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
---

Markdown body here.
For feedback/decision types, include **Why:** and **How to apply:** sections.
\`\`\`

## Memory Types

| Type         | Directory      | Purpose                                        | Changes    |
|--------------|----------------|------------------------------------------------|------------|
| user         | user/          | Role, goals, preferences, collaboration style  | Rarely     |
| feedback     | feedback/      | Corrections and confirmations — do / don't     | As given   |
| project      | project/       | Ongoing work, goals, progress, status          | Often      |
| decision     | decisions/     | Architectural decisions with rationale          | When changed|
| context      | context/       | Current phase, active sprint, immediate focus  | Frequently |
| convention   | conventions/   | Tone, voice, naming rules, code style          | Occasionally|
| reference    | reference/     | External resources, architecture docs          | Rarely     |
| session      | sessions/      | Session logs — what, when, which agent         | Each session|

## Operations

Any interface can perform: **init**, **build**, **save**, **maintain**, **status**.
Always keep \`index.yaml\` in sync with the filesystem.

## Rules

1. **Distill, don't transcribe.** Summaries and decisions, not transcripts.
2. **One idea per file.** Split if a memory covers unrelated topics.
3. **Update in place.** When facts change, edit the file. Don't append forever.
4. **Keep index in sync.** Every file in index, every index entry points to a file.
5. **Use \`expires\` on context.** Context goes stale. Set a review date.
6. **Reference, don't copy.** Point to source docs instead of duplicating content.
7. **No secrets.** No credentials, PII, or sensitive data. Safe to commit.

## Conventions

- Filenames: kebab-case, no type prefix (directory IS the type)
- Dates: ISO 8601 (YYYY-MM-DD), always absolute (never "next Thursday")
- Source identifiers: claude-app, claude-code, vscode, craft-agent, other
HEREDOC
  echo -e "  ${G}✓${N} README.md"
  else
    echo -e "  ${Y}⊘${N} README.md (exists)"
  fi

  # ── index.yaml ──
  if [ ! -f "$MEM/index.yaml" ]; then
cat > "$MEM/index.yaml" << HEREDOC
# .agent-memory index — master registry of all memory files
# Read this first. Load only what's relevant to the current task.
# Any AI interface may read, update, compact, or trim this index.

version: "2.1"
updated: ${TODAY}

memories: []
# Example entry (uncomment and edit):
#  - id: project/overview
#    type: project
#    path: project/overview.md
#    description: "What this project is and why it exists."
HEREDOC
  echo -e "  ${G}✓${N} index.yaml"
  else
    echo -e "  ${Y}⊘${N} index.yaml (exists)"
  fi

  # ── AGENTS.md (canonical shared file) ──
  if [ ! -f "$ROOT/AGENTS.md" ]; then
cat > "$ROOT/AGENTS.md" << 'HEREDOC'
# Agent Instructions

> For any AI agent, tool, or automation working on this project.
> Tool-specific configs: `.claude/` (Claude Code), `.cursor/rules/` (Cursor).

## First Steps

1. Read this file completely.
2. Read `.agent-memory/index.yaml` to discover available project context.
3. Load relevant memory files based on the current task.
4. Update or create memories when you learn something future sessions should know.

See `.agent-memory/README.md` for the full memory spec.

## Project Structure
<!-- TODO: Fill in your project's directory layout -->

## Key Rules
<!-- TODO: Add project-specific rules -->
HEREDOC
  echo -e "  ${G}✓${N} AGENTS.md"
  else
    echo -e "  ${Y}⊘${N} AGENTS.md (exists)"
  fi

  # ── CLAUDE.md (thin pointer to AGENTS.md) ──
  if [ ! -f "$ROOT/CLAUDE.md" ]; then
cat > "$ROOT/CLAUDE.md" << 'HEREDOC'
# Claude Instructions

**Read `AGENTS.md` first.** It contains the complete project context, structure,
rules, and conventions shared across all AI tools.

## Memory System

This project uses `.agent-memory/` for cross-interface persistent memory.
Before starting work, read `.agent-memory/index.yaml` and load relevant memories.
After significant work, save learnings with source: `claude-code` (CLI) or `claude-app` (Claude App).
See `.agent-memory/README.md` for the full spec.

## Claude-Specific Notes
<!-- TODO: Add Claude-specific instructions here -->
HEREDOC
  echo -e "  ${G}✓${N} CLAUDE.md"
  else
    echo -e "  ${Y}⊘${N} CLAUDE.md (exists)"
  fi

  # ── .claude/ directory ──
  mkdir -p "$ROOT/.claude"
  if [ ! -f "$ROOT/.claude/settings.json" ]; then
cat > "$ROOT/.claude/settings.json" << 'HEREDOC'
{
  "$schema": "https://code.claude.com/schema/settings.json",
  "permissions": {
    "allow": [
      "Read",
      "Glob",
      "Grep"
    ]
  }
}
HEREDOC
    echo -e "  ${G}✓${N} .claude/settings.json (created)"
  else
    echo -e "  ${Y}⊘${N} .claude/settings.json (exists)"
  fi

  # ── Permission hint (never auto-granted) ──
  if ! grep -q 'agent-memory/bootstrap' "$ROOT/.claude/settings.json" 2>/dev/null; then
    echo ""
    echo -e "  ${C}ℹ${N}  To allow bootstrap commands without prompts, add this to"
    echo -e "     ${B}.claude/settings.json${N} → permissions.allow:"
    echo ""
    echo -e "     ${C}\"Bash(bash .agent-memory/bootstrap.sh *)\"${N}"
    echo ""
  fi

  # ── .cursor/rules/ directory (separate file, never overwrites) ──
  # Use a dedicated agent-memory.mdc file instead of index.mdc.
  # This avoids conflicts with user-created or IDE-created rules.
  mkdir -p "$ROOT/.cursor/rules"
  CURSOR_RULE="$ROOT/.cursor/rules/agent-memory.mdc"
  if [ ! -f "$CURSOR_RULE" ]; then
    # Also check if index.mdc already has our instructions (from v2.1.0)
    if [ -f "$ROOT/.cursor/rules/index.mdc" ] && grep -q 'agent-memory' "$ROOT/.cursor/rules/index.mdc" 2>/dev/null; then
      echo -e "  ${Y}⊘${N} .cursor/rules/index.mdc already references agent-memory (skipping)"
    else
cat > "$CURSOR_RULE" << 'HEREDOC'
---
description: "Agent memory integration — reads AGENTS.md and .agent-memory/"
globs:
alwaysApply: true
---

Read `AGENTS.md` in the project root first. It contains the complete project context,
structure, rules, and conventions shared across all AI tools.

Then read `.agent-memory/index.yaml` to discover available persistent context.
Load relevant memory files based on the current task.
After significant work, save learnings with source: `vscode`.
HEREDOC
      echo -e "  ${G}✓${N} .cursor/rules/agent-memory.mdc (created)"
    fi
  else
    echo -e "  ${Y}⊘${N} .cursor/rules/agent-memory.mdc (exists)"
  fi

  echo ""
  echo -e "${G}Done.${N} Fill in AGENTS.md with your project details."
}

# ═══════════════════════════════════════════════════════════════
# MIGRATE — detect and migrate older structures
# ═══════════════════════════════════════════════════════════════
do_migrate() {
  echo -e "${B}🔄 Checking for older structures to migrate${N}"
  _do_migrate_inner
  echo ""
  echo -e "${G}Migration complete.${N}"
}

# Silent version (called during init, no header/footer)
do_migrate_silent() {
  _do_migrate_inner 2>/dev/null || true
}

_do_migrate_inner() {
  migrated=0

  # ── 1. Root CURSOR.md → .cursor/rules/ ──
  if [ -f "$ROOT/CURSOR.md" ]; then
    mkdir -p "$ROOT/.cursor/rules"
    # Migrate content to a dedicated .mdc file (not index.mdc — that may be user-owned)
    target="$ROOT/.cursor/rules/project-instructions.mdc"
    if [ ! -f "$target" ]; then
      # Extract content (strip any YAML frontmatter)
      content=$(sed '/^---$/,/^---$/d' "$ROOT/CURSOR.md")
cat > "$target" << HEREDOC
---
description: "Project instructions (migrated from CURSOR.md)"
globs:
alwaysApply: true
---

${content}
HEREDOC
      echo -e "  ${G}✓${N} CURSOR.md → .cursor/rules/project-instructions.mdc"
      migrated=$((migrated + 1))
    else
      echo -e "  ${Y}⚠${N} .cursor/rules/project-instructions.mdc already exists (CURSOR.md not migrated)"
    fi
    # Archive the old file
    mv "$ROOT/CURSOR.md" "$ROOT/CURSOR.md.migrated"
    echo -e "  ${Y}⊘${N} CURSOR.md renamed to CURSOR.md.migrated (safe to delete)"
    migrated=$((migrated + 1))
  fi

  # ── 2. INDEX.yaml (uppercase) → index.yaml ──
  if [ -f "$MEM/INDEX.yaml" ] && [ ! -f "$MEM/index.yaml" ]; then
    mv "$MEM/INDEX.yaml" "$MEM/index.yaml"
    echo -e "  ${G}✓${N} INDEX.yaml → index.yaml"
    migrated=$((migrated + 1))
  fi

  # ── 3. Flat {type}--{topic}.md → {type}/{topic}.md ──
  for f in "$MEM"/*--*.md; do
    [ -f "$f" ] || continue
    base=$(basename "$f" .md)
    # Split on first --
    type="${base%%--*}"
    topic="${base#*--}"
    if [ -n "$type" ] && [ -n "$topic" ]; then
      mkdir -p "$MEM/$type"
      if [ ! -f "$MEM/$type/$topic.md" ]; then
        mv "$f" "$MEM/$type/$topic.md"
        echo -e "  ${G}✓${N} ${base}.md → ${type}/${topic}.md"
        migrated=$((migrated + 1))
      else
        echo -e "  ${Y}⚠${N} ${base}.md: target ${type}/${topic}.md already exists (skipped)"
      fi
    fi
  done

  # ── 4. Old frontmatter field: summary → description ──
  while IFS= read -r f; do
    if grep -q "^summary:" "$f" 2>/dev/null && ! grep -q "^description:" "$f" 2>/dev/null; then
      sed -i.bak "s/^summary:/description:/" "$f" && rm -f "${f}.bak"
      echo -e "  ${G}✓${N} $(basename "$(dirname "$f")")/$(basename "$f"): summary → description"
      migrated=$((migrated + 1))
    fi
  done < <(find "$MEM" -mindepth 2 -name "*.md" 2>/dev/null)

  # ── 5. CLAUDE.md that is full instructions → make it a pointer ──
  # Only migrate if AGENTS.md doesn't exist and CLAUDE.md has project structure
  if [ -f "$ROOT/CLAUDE.md" ] && [ ! -f "$ROOT/AGENTS.md" ]; then
    if grep -q "## Project Structure" "$ROOT/CLAUDE.md" 2>/dev/null; then
      # CLAUDE.md has full instructions — promote to AGENTS.md
      cp "$ROOT/CLAUDE.md" "$ROOT/AGENTS.md"
      # Update the header
      sed -i.bak '1s/.*/# Agent Instructions/' "$ROOT/AGENTS.md" && rm -f "$ROOT/AGENTS.md.bak"
      echo -e "  ${G}✓${N} CLAUDE.md promoted to AGENTS.md (CLAUDE.md kept as-is — update to thin pointer)"
      migrated=$((migrated + 1))
    fi
  fi

  # ── 6. Version bump in index.yaml ──
  if [ -f "$MEM/index.yaml" ]; then
    if grep -q 'version: "2.0"' "$MEM/index.yaml" 2>/dev/null; then
      sed -i.bak 's/version: "2.0"/version: "2.1"/' "$MEM/index.yaml" && rm -f "$MEM/index.yaml.bak"
    fi
  fi

  if [ "$migrated" -eq 0 ]; then
    echo -e "  ${G}✓${N} No migration needed"
  fi
}

# ═══════════════════════════════════════════════════════════════
# STATUS — read-only health check
# ═══════════════════════════════════════════════════════════════
do_status() {
  echo -e "${B}🧠 Memory Health Report${N}"
  echo "───────────────────────────────"

  if [ ! -d "$MEM" ]; then
    echo -e "${R}✗ .agent-memory/ not found.${N} Run: bash bootstrap.sh init"
    exit 1
  fi

  # Count files by type — dynamically discover all subdirectories
  total=0
  for dirpath in "$MEM"/*/; do
    [ -d "$dirpath" ] || continue
    dir=$(basename "$dirpath")
    count=$(find "$dirpath" -maxdepth 1 -type f \( -name "*.md" -o -name "*.html" -o -name "*.yaml" -o -name "*.json" \) 2>/dev/null | wc -l | tr -d ' ')
    if [ "$count" -gt 0 ]; then
      printf "  %-14s %s\n" "$dir/" "$count"
    fi
    total=$((total + count))
  done
  echo "───────────────────────────────"
  printf "  %-14s %s\n" "Total" "$total"
  echo ""

  # Index entry count (exclude commented lines)
  idx_count=$(grep -c "^  - id:" "$MEM/index.yaml" 2>/dev/null || true)
  [ -z "$idx_count" ] && idx_count=0
  echo -e "  Index entries:  ${C}${idx_count}${N}"

  # Sync check — scan all files (not just .md) to match index entries
  fs_files=$(find "$MEM" -mindepth 2 -type f \( -name "*.md" -o -name "*.html" -o -name "*.yaml" -o -name "*.json" \) ! -name "index.yaml" | sed "s|^$MEM/||" | sort)
  idx_files=$(grep -v '^\s*#' "$MEM/index.yaml" 2>/dev/null | grep "path:" 2>/dev/null | sed 's/.*path: *//' | sort || true)

  orphan_fs=""
  orphan_idx=""
  if [ -n "$fs_files" ] || [ -n "$idx_files" ]; then
    orphan_fs=$(comm -23 <(echo "$fs_files") <(echo "$idx_files") 2>/dev/null || true)
    orphan_idx=$(comm -13 <(echo "$fs_files") <(echo "$idx_files") 2>/dev/null || true)
  fi

  if [ -n "$orphan_fs" ]; then
    echo ""
    echo -e "  ${Y}⚠ Files NOT in index:${N}"
    echo "$orphan_fs" | sed 's/^/    /'
  fi

  if [ -n "$orphan_idx" ]; then
    echo ""
    echo -e "  ${R}✗ Index entries with no file:${N}"
    echo "$orphan_idx" | sed 's/^/    /'
  fi

  if [ -z "$orphan_fs" ] && [ -z "$orphan_idx" ]; then
    echo -e "  Index sync:     ${G}✓ all clean${N}"
  fi

  # Staleness (files not updated in 30+ days)
  echo ""
  stale=0
  thirty_days_ago=$(date -d "30 days ago" +%Y-%m-%d 2>/dev/null || date -v-30d +%Y-%m-%d 2>/dev/null || echo "")
  if [ -n "$thirty_days_ago" ]; then
    while IFS= read -r f; do
      updated=$(grep "^updated:" "$f" 2>/dev/null | head -1 | sed 's/updated: *//' || true)
      # Skip non-date values (template placeholders like YYYY-MM-DD)
      if [ -n "$updated" ] && [[ "$updated" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2} ]] && [[ "$updated" < "$thirty_days_ago" ]]; then
        stale=$((stale + 1))
      fi
    done < <(find "$MEM" -mindepth 2 -type f \( -name "*.md" -o -name "*.html" \) 2>/dev/null)
    echo -e "  Stale (30+ days): ${stale}"
  fi

  # Expired
  expired=0
  while IFS= read -r f; do
    exp=$(grep "^expires:" "$f" 2>/dev/null | head -1 | sed 's/expires: *//' || true)
    # Skip non-date values
    if [ -n "$exp" ] && [[ "$exp" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2} ]] && [[ "$exp" < "$TODAY" ]]; then
      expired=$((expired + 1))
      echo -e "  ${Y}⏰ Expired: $(basename "$(dirname "$f")")/$(basename "$f")${N} (was $exp)"
    fi
  done < <(find "$MEM" -mindepth 2 -type f \( -name "*.md" -o -name "*.html" \) 2>/dev/null)
  if [ "$expired" -eq 0 ]; then
    echo -e "  Expired:          0"
  fi

  # Entry points check (v2.1 standard)
  echo ""
  ep=""
  ep="${ep}$([ -f "$ROOT/AGENTS.md" ] && echo -e "${G}AGENTS.md ✓${N}" || echo -e "${R}AGENTS.md ✗${N}")  "
  ep="${ep}$([ -f "$ROOT/CLAUDE.md" ] && echo -e "${G}CLAUDE.md ✓${N}" || echo -e "${R}CLAUDE.md ✗${N}")  "
  ep="${ep}$([ -d "$ROOT/.claude" ] && echo -e "${G}.claude/ ✓${N}" || echo -e "${Y}.claude/ ✗${N}")  "
  # Check for any .mdc file in .cursor/rules/ (agent-memory.mdc or index.mdc)
  cursor_ok=false
  if [ -d "$ROOT/.cursor/rules" ] && ls "$ROOT/.cursor/rules"/*.mdc >/dev/null 2>&1; then cursor_ok=true; fi
  ep="${ep}$($cursor_ok && echo -e "${G}.cursor/ ✓${N}" || echo -e "${Y}.cursor/ ✗${N}")"
  echo -e "  Entry points:   ${ep}"
}

# ═══════════════════════════════════════════════════════════════
# FIX — repair index ↔ filesystem mismatches
# ═══════════════════════════════════════════════════════════════
do_fix() {
  echo -e "${B}🔧 Fixing index.yaml ↔ filesystem${N}"

  if [ ! -d "$MEM" ]; then
    echo -e "${R}✗ .agent-memory/ not found.${N} Run init first."
    exit 1
  fi

  fixed=0

  # Find files on disk not in index
  for f in $(find "$MEM" -mindepth 2 -name "*.md" | sort); do
    relpath="${f#$MEM/}"
    if ! grep -v '^\s*#' "$MEM/index.yaml" 2>/dev/null | grep -q "path: $relpath"; then
      # Extract frontmatter fields
      id=$(grep "^id:" "$f" 2>/dev/null | head -1 | sed 's/id: *//')
      type=$(grep "^type:" "$f" 2>/dev/null | head -1 | sed 's/type: *//')
      desc=$(grep "^description:" "$f" 2>/dev/null | head -1 | sed 's/description: *//')
      [ -z "$id" ] && id="${relpath%.md}"
      [ -z "$type" ] && type=$(dirname "$relpath")
      [ -z "$desc" ] && desc="(no description)"

      # Append to index
      echo "" >> "$MEM/index.yaml"
      echo "  - id: $id" >> "$MEM/index.yaml"
      echo "    type: $type" >> "$MEM/index.yaml"
      echo "    path: $relpath" >> "$MEM/index.yaml"
      echo "    description: $desc" >> "$MEM/index.yaml"

      echo -e "  ${G}+${N} Added to index: $relpath"
      fixed=$((fixed + 1))
    fi
  done

  # Find index entries pointing to missing files
  while IFS= read -r path; do
    if [ ! -f "$MEM/$path" ]; then
      echo -e "  ${Y}⚠${N} Index points to missing file: $path (remove manually or create the file)"
      fixed=$((fixed + 1))
    fi
  done < <(grep -v '^\s*#' "$MEM/index.yaml" 2>/dev/null | grep "path:" | sed 's/.*path: *//')

  if [ "$fixed" -eq 0 ]; then
    echo -e "  ${G}✓ Already in sync${N}"
  else
    # Bump updated date
    sed -i.bak "s/^updated:.*/updated: $TODAY/" "$MEM/index.yaml" && rm -f "$MEM/index.yaml.bak"
    echo -e "\n  Fixed ${fixed} issue(s). Index updated."
  fi
}

# ═══════════════════════════════════════════════════════════════
# DOCTOR — full diagnostic (status + fix)
# ═══════════════════════════════════════════════════════════════
do_doctor() {
  do_status
  echo ""
  do_fix
}

# ═══════════════════════════════════════════════════════════════
# DISPATCH
# ═══════════════════════════════════════════════════════════════
case "$CMD" in
  init)     do_init ;;
  migrate)  do_migrate ;;
  status)   do_status ;;
  fix)      do_fix ;;
  doctor)   do_doctor ;;
  *)
    echo "Usage: bash bootstrap.sh [init|migrate|status|fix|doctor] [project-root]"
    echo ""
    echo "  init      Create .agent-memory/ structure + entry points (default)"
    echo "  migrate   Detect and migrate older structures to v2.1"
    echo "  status    Read-only health check"
    echo "  fix       Repair index ↔ filesystem mismatches"
    echo "  doctor    Full diagnostic: status + fix"
    exit 1
    ;;
esac
