# skills4sh

Agent skills for Claude Code, Cursor, and VS Code (Copilot).

## Skills

| Skill | Description | Version |
|-------|-------------|---------|
| [agent-memory](skills/agent-memory/) | Cross-interface persistent memory system for any project | 2.7.0 |
| [discord-harvest](skills/discord-harvest/) | Extract and download images, links, and files from Discord conversations | 1.7.0 |
| [eleventy-nunjucks](skills/eleventy-nunjucks/) | 11ty v3 + Nunjucks conventions, syntax cheat sheet, autoescape rules, stability + security checklists | 0.1.0 |
| [localhost-screenshots](skills/localhost-screenshots/) | Localhost screenshot capture and visual regression testing | 3.3.0 |

> **Stability note.** `eleventy-nunjucks` is pre-1.0 (v0.x) — its trigger phrasing and prompt content may change in incompatible ways between minor releases. The other three skills follow semver: breaking changes only on major bumps.

## Install

```bash
npx skills add t4sh/skills4sh                                # install all skills
npx skills add t4sh/skills4sh --skill agent-memory           # only agent-memory
npx skills add t4sh/skills4sh --skill discord-harvest        # only discord-harvest
npx skills add t4sh/skills4sh --skill eleventy-nunjucks      # only eleventy-nunjucks
npx skills add t4sh/skills4sh --skill localhost-screenshots  # only localhost-screenshots
```

This is the Marketplace-compatible install path and the recommended way to consume the skills from this repo. Re-running is idempotent — safe to use as a sync command.

<details>
<summary>Secondary supporting installer: <code>npx skills4sh</code></summary>

The published `skills4sh` package is a no-git supporting installer for machines that cannot use the `skills` CLI, need explicit destination control, or need to pin a specific ref.

```bash
npx skills4sh --all                                # install all skills
npx skills4sh --skill agent-memory                 # only agent-memory
npx skills4sh --skill discord-harvest              # only discord-harvest
npx skills4sh --skill eleventy-nunjucks            # only eleventy-nunjucks
npx skills4sh --skill localhost-screenshots        # only localhost-screenshots
```

```bash
npx skills4sh add t4sh/skills4sh --ref <sha|branch|tag>
npx skills4sh list t4sh/skills4sh
```

The supporting installer defaults to `~/.claude/skills/` (matches `bin/install.mjs` → `DEFAULT_DEST = ~/.claude/skills`). Override with `--dest <dir>` to target `~/.cursor/skills/`, `~/.agents/skills/`, or any path. Requires Node 22+.

</details>

---

## Skill structure

Each skill follows the [Agent Skills specification](https://agentskills.io/specification):

```text
skills/<skill-name>/
├── SKILL.md          # Required: metadata + instructions
├── references/       # Supporting documentation
└── assets/           # Optional icons or static assets
```

## Security

See [SECURITY.md](SECURITY.md) for the full compliance mapping, vulnerability disclosure process, and expected findings. Per-skill security manifests live in [`.security/`](.security/).

### Security scanning

Security scans are pinned to [guardskills](https://www.npmjs.com/package/guardskills) `1.2.1`. `agent-memory` and `discord-harvest` scan without overrides. `localhost-screenshots` and `eleventy-nunjucks` have documented false-positive findings from instructional browser/profile/env/grep snippets; the CI matrix only accepts those known findings when they match [SECURITY.md](SECURITY.md) § Expected Security Findings.

```bash
npx guardskills@1.2.1 add t4sh/skills4sh --skill agent-memory --dry-run;
npx guardskills@1.2.1 add t4sh/skills4sh --skill discord-harvest --dry-run;
npx guardskills@1.2.1 add t4sh/skills4sh --skill eleventy-nunjucks --dry-run --force;
npx guardskills@1.2.1 add t4sh/skills4sh --skill localhost-screenshots --dry-run;
```

Skills contain no shell scripts or executable code — only SKILL.md instructions and reference documentation.

## License

MIT
