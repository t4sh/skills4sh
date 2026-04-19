# skills4sh

Agent skills for Claude Code, Cursor, and VS Code (Copilot).

## Skills

| Skill | Description | Version |
|-------|-------------|---------|
| [agent-memory](skills/agent-memory/) | Cross-interface persistent memory system for any project | 2.7.0 |
| [discord-harvest](skills/discord-harvest/) | Extract and download images, links, and files from Discord conversations | 1.7.0 |
| [localhost-screenshots](skills/localhost-screenshots/) | Localhost screenshot capture and visual regression testing | 3.2.0 |

## Install

Two supported paths.

### A. `skills4sh` — no git required (recommended)

Pure Node, Node 18+. Uses the GitHub Trees API + `raw.githubusercontent.com`. If `HTTPS_PROXY` / `HTTP_PROXY` is set, the published package includes an optional `undici` dependency so those requests can use your proxy (omit optional deps only if you do not need a proxy).

```bash
npx skills4sh --list
npx skills4sh --skill agent-memory
npx skills4sh --all
# Options: --repo <owner/repo>  --ref <sha|branch>  --dest <dir>  --force  --no-verify
# Env:     GITHUB_TOKEN         HTTPS_PROXY
```

### B. Subcommands: `add` / `list` (same binary as A)

The package exposes two bin names — `skills4sh` and `skills` — but **both resolve from this package only when that package is what you run**. On the public npm registry, the package name **`skills`** is [another project](https://www.npmjs.com/package/skills) (Vercel’s agent-skills CLI). To run **this** installer via `npx`, use the **`skills4sh`** package name (or pin a git/tarball spec you trust).

`add <owner/repo>` with no `--skill` installs all skills from the repo. Put **npm/npx flags** (`--yes` / `-y`) **before** the package name so npm consumes them; trailing `-y` is accepted by this CLI as a no-op for convenience.

```bash
npx --yes skills4sh add t4sh/skills4sh                       # install all (no npx prompt)
npx skills4sh add t4sh/skills4sh --skill agent-memory        # install one
npx skills4sh list t4sh/skills4sh                            # list available
npm install -g skills4sh && skills add t4sh/skills4sh        # global: `skills` is this repo’s bin
```

After `npm install -g skills4sh`, the `skills` command on your `PATH` is this installer (not `npx skills`, which downloads the npm package named `skills`).

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
