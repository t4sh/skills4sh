# skills4sh

Agent skills for Claude Code, Cursor, and VS Code (Copilot).

## Skills

| Skill | Description | Version |
|-------|-------------|---------|
| [agent-memory](skills/agent-memory/) | Cross-interface persistent memory system for any project | 2.6.1 |
| [discord-harvest](skills/discord-harvest/) | Extract and download images, links, and files from Discord conversations | 1.6.0 |
| [localhost-screenshots](skills/localhost-screenshots/) | Localhost screenshot capture and visual regression testing | 3.1.1 |

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
└── references/       # Supporting documentation
```

## Security

See [SECURITY.md](SECURITY.md) for the full compliance mapping, vulnerability disclosure process, and expected findings. Per-skill security manifests live in [`.security/`](.security/).

### Security scanning

All skills are checked with [guardskills](https://www.npmjs.com/package/guardskills). **agent-memory** and **discord-harvest** rate **SAFE**; **localhost-screenshots** rates **WARNING** with documented false positives in code examples (see [SECURITY.md](SECURITY.md) and `.security/localhost-screenshots.yaml`).

```bash
npx guardskills add t4sh/skills4sh --skill agent-memory --dry-run;
npx guardskills add t4sh/skills4sh --skill discord-harvest --dry-run;
npx guardskills add t4sh/skills4sh --skill localhost-screenshots --dry-run;
```

Skills contain no shell scripts or executable code — only SKILL.md instructions and reference documentation.

## License

MIT
