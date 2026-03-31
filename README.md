# skills4sh

Agent skills for Claude Code, Cursor, Windsurf, Cline, and other AI coding agents.

## Skills

| Skill | Description | Version |
|-------|-------------|---------|
| [agent-memory](skills/agent-memory/) | Cross-interface persistent memory system for any project | 2.2 |
| [discord-harvest](skills/discord-harvest/) | Extract and download images, links, and files from Discord conversations | 1.0.0 |
| [localhost-screenshots](skills/localhost-screenshots/) | Localhost screenshot capture and visual regression testing | 1.0.0 |

## Install

```bash
# List available skills
npx skills add t4sh/skills4sh --list

# Install a specific skill
npx skills add t4sh/skills4sh --skill agent-memory

# Install all skills
npx skills add t4sh/skills4sh --all
```

---

## Skill structure

Each skill follows the [Agent Skills specification](https://agentskills.io/specification):

```
skills/<skill-name>/
├── SKILL.md          # Required: metadata + instructions
└── reference/        # Supporting documentation
```

## Security

See [SECURITY.md](SECURITY.md) for the full compliance mapping, vulnerability disclosure process, and expected findings.

### Security scanning

All skills pass [guardskills](https://www.npmjs.com/package/guardskills) with a **SAFE** rating:

```bash
npx guardskills add t4sh/skills4sh --skill agent-memory --dry-run
npx guardskills add t4sh/skills4sh --skill discord-harvest --dry-run
npx guardskills add t4sh/skills4sh --skill localhost-screenshots --dry-run
```

Skills contain no shell scripts or executable code — only SKILL.md instructions and reference documentation.

## License

MIT
