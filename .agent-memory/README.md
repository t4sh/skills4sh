# Agent Memory

Cross-interface project memory for `skills4sh`.

This directory stores durable, non-secret context that any file-reading agent can use across sessions. Entries are YAML-frontmatter markdown files indexed by `.agent-memory/index.yaml`.

## Rules

- Store decisions, conventions, active context, and session handoff notes.
- Do not store credentials, tokens, private keys, or sensitive personal data.
- Keep one idea per file.
- Update existing memory files when facts change.
- Keep `index.yaml` synchronized with files on disk.

## Types

- `project/` — project identity, status, architecture
- `decisions/` — durable decisions and rationale
- `context/` — active work that may expire or need review
- `conventions/` — recurring working rules
- `references/` — external or durable reference summaries
- `sessions/` — lightweight session logs
- `user/` and `feedback/` — user preferences and corrections when explicitly relevant
