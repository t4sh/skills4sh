# skills4sh

Agent skills for Claude Code, Cursor, and VS Code (Copilot).

## Skills

| Skill | Description | Version |
|-------|-------------|---------|
| [agent-memory](skills/agent-memory/) | Cross-interface persistent memory system for any project | 2.7.0 |
| [discord-harvest](skills/discord-harvest/) | Extract and download images, links, and files from Discord conversations | 1.7.0 |
| [localhost-screenshots](skills/localhost-screenshots/) | Localhost screenshot capture and visual regression testing | 3.2.0 |

## Install

```bash
npx skills add t4sh/skills4sh                                # install all skills
npx skills add t4sh/skills4sh --skill agent-memory           # only agent-memory
npx skills add t4sh/skills4sh --skill discord-harvest        # only discord-harvest
npx skills add t4sh/skills4sh --skill localhost-screenshots  # only localhost-screenshots
```

Skills install to `~/.agents/skills/` by default. Or, picks your system-wide default. Re-running is idempotent — safe to use as a sync command.

<details>
<summary>Backup install path (no <code>git</code> required)</summary>

If you can't or don't want to use the `skills` CLI, this repo also ships its own pure-Node installer that fetches files directly via the GitHub API. Useful on machines without `git`, or when pinning to a specific ref.

```bash
# Short form (uses default --repo t4sh/skills4sh):
npx skills4sh --all
npx skills4sh --skill agent-memory
npx skills4sh --list

# Explicit form (works against any repo):
npx skills4sh add t4sh/skills4sh
npx skills4sh add t4sh/skills4sh --skill agent-memory
npx skills4sh list t4sh/skills4sh

# Options: --repo <owner/repo>  --ref <sha|branch>  --dest <dir>  --no-verify
# Env:     GITHUB_TOKEN         HTTPS_PROXY
```

Requires Node 18+. Same atomic-write, lock-verify, and idempotency guarantees as the primary path.

</details>

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
