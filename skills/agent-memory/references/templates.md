# Templates — Full Reference

## Session Log Template

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

## Sync Report Template

```
Sync Report
───────────────
External changes ingested:
  New files found:      X  (added to index)
  Orphan entries:       X  (removed from index)
  Updated externally:   X  (index entry refreshed)

Session saved:
  Memories updated:     X
  Memories created:     X
  Session log:          Yes/No

Index entries:          X total
```

Count a file under `Updated externally` only when its frontmatter `type`, `title`, or `status` differed from its index entry before Sync refreshed that entry. Compare the two files directly, or take the count from `summary.mismatchedFiles` of the optional [index checker](checker.md); no Git command is involved. An edit that changed only the body or other fields leaves nothing to compare, so do not estimate it. Report `0` when no entry differed.

## Memory Health Report Template

```
Memory Health Report
───────────────────────
Total memories:        X
By type:               user(X) feedback(X) project(X) decision(X) context(X) convention(X) reference(X) session(X)
Stale/needs review:    X
Expired:               X
Archived:              X
Index fixes:           X
Compaction candidates: X
Sessions cleaned:      X
```

`Index fixes` counts the entries Maintain added for unindexed memory files, removed as orphans, or refreshed because they differed from the file's frontmatter. `Archived` counts files whose `status` is `archived`, including any archived in this run.

## Memory File Frontmatter Schema

```yaml
---
id: {directory}/{topic}           # matches directory/filename (no .md), e.g. decisions/api-auth for type: decision
type: user | feedback | project | decision | context | convention | reference | session
title: Human-readable title
description: >-
  One-line summary — decides relevance without opening the file.
tags: [tag1, tag2]
source: {runtime-slug}           # e.g. codex, claude-code, cursor, grok, openclaw, vscode, craft-agent, other
created: YYYY-MM-DD
updated: YYYY-MM-DD              # set to today whenever the file is edited, including when it is archived
status: active | archived
expires: YYYY-MM-DD              # optional — review date for context memories
supersedes: {id}                 # optional — ID of memory this replaces
---

Markdown body.
For feedback/decision types, include **Why:** and **How to apply:** sections.
```

**Archiving** keeps the file. Set `status: archived` in the file's frontmatter and in its index entry, and set `updated` to today so the 90-day review of archived entries counts from the day of archiving. Deleting is a separate step that needs its own confirmation.

## Entry-Point Templates

Pointer files and native auto-memory locations live in [agent-pointers.md](agent-pointers.md). Keep shared rules in `AGENTS.md`; do not duplicate pointer recipes here.

## Index Registry

Create `.agent-memory/index.yaml` as `[]` during Init when no memories exist. When entries are saved, use a YAML sequence of records. The required fields are `id`, `type`, `title`, and `status`; the `id` maps to `.agent-memory/{id}.md` and matches that file's frontmatter. Keep an existing compatible registry and its entries rather than rewriting it to match this example.

```yaml
- id: decisions/storage
  type: decision
  title: "Storage choice"
  status: active
- id: context/current-sprint
  type: context
  title: "Current sprint focus"
  status: active
```

Additional useful registry metadata such as a short description or tags may be retained. The index should contain one entry for each memory file and no orphan entries.

## Memory Types

| Type       | Directory      | What Goes Here                                  | Changes     |
|------------|----------------|-------------------------------------------------|-------------|
| user       | user/          | Role, goals, preferences, collaboration style   | Rarely      |
| feedback   | feedback/      | Corrections and confirmations — do/don't        | As given    |
| project    | project/       | What the project IS (concept, progress, status) | Often       |
| decision   | decisions/     | Why things are the way they are (rationale)     | When changed|
| context    | context/       | Current state, active work, sprint focus        | Frequently  |
| convention | conventions/   | Patterns and rules for working on this project  | Occasionally|
| reference  | references/    | External resources, architecture, patterns      | Rarely      |
| session    | sessions/      | Lightweight session logs                        | Each session|
