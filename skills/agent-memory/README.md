# agent-memory

Cross-interface persistent memory system for any project. Maintains a coherent, up-to-date knowledge base that any AI agent — Claude App, Claude Code CLI, VS Code, Cursor, Craft Agent, or any file-reading tool — can read and build upon across sessions.

## Install

```bash
npx skills add t4sh/skills4sh --skill agent-memory
```

Installs to `~/.claude/skills/agent-memory/`. Re-running is idempotent.

## Usage

See [`SKILL.md`](SKILL.md) for the full instruction surface the agent reads. Triggers, file layout, and maintenance behavior are documented there.

## References

- [`references/display-conventions.md`](references/display-conventions.md)
- [`references/templates.md`](references/templates.md)
- [`references/troubleshooting.md`](references/troubleshooting.md)

## License

MIT
