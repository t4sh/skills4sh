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
  Updated externally:   X  (content refreshed)

Session saved:
  Memories updated:     X
  Memories created:     X
  Session log:          Yes/No

Index entries:          X total
```

## Memory Health Report Template

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

## Memory File Frontmatter Schema

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

## Memory Types

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
