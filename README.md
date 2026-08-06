# skills4sh

Portable agent skills for Codex, Claude Code, Cursor, VS Code, and compatible runtimes.

## Skills

| Skill | Description | Version |
|-------|-------------|---------|
| [agent-memory](skills/agent-memory/) | Cross-interface persistent memory with explicit native-memory coexistence and Codex/Claude entry-point guidance | 2.7.7 |
| [code-to-figma](skills/code-to-figma/) | Generate a CI-anchored code → Figma pipeline with a conforming DTCG 2025.10 token artifact and Gist export | 0.2.0 |
| [discord-harvest](skills/discord-harvest/) | Archive Discord assets through authorized bot access, a user-provided Data Package, or manual local exports | 2.0.0 |
| [eleventy-nunjucks](skills/eleventy-nunjucks/) | Stable Eleventy v3 + Nunjucks guidance with a version-gated Build Awesome v4 prerelease migration track | 0.1.8 |
| [figma-to-code](skills/figma-to-code/) | Remote-first, repo-aware Figma MCP workflow for UI implementation, motion, assets, tokens, rules, and Code Connect | 0.1.7 |
| [localhost-screenshots](skills/localhost-screenshots/) | Playwright 1.62 localhost capture with redirect-safe helpers and visual regression guidance | 3.3.7 |
| [skill-architect](skills/skill-architect/) | Agent Skills open-spec baseline plus portable authoring/review, vendor-adapter, and eval-planning guidance | 0.1.3 |

> **Stability note.** `code-to-figma`, `eleventy-nunjucks`, `figma-to-code`, and `skill-architect` are pre-1.0 (v0.x) — their trigger phrasing and prompt content may change in incompatible ways between minor releases. The other three skills (agent-memory, discord-harvest, localhost-screenshots) follow semver: breaking changes only on major bumps.

## Install

These skills are plain [Agent Skills](https://agentskills.io/specification): each skill is a folder with a `SKILL.md` entrypoint plus optional references/assets. Use any installer or agent runtime that can place those folders where your agent reads skills.

Recommended install path:

```bash
npx skills@latest add t4sh/skills4sh                                # install all skills
npx skills@latest add t4sh/skills4sh --skill agent-memory           # only agent-memory
npx skills@latest add t4sh/skills4sh --skill code-to-figma          # only code-to-figma
npx skills@latest add t4sh/skills4sh --skill discord-harvest        # only discord-harvest
npx skills@latest add t4sh/skills4sh --skill eleventy-nunjucks      # only eleventy-nunjucks
npx skills@latest add t4sh/skills4sh --skill figma-to-code          # only figma-to-code
npx skills@latest add t4sh/skills4sh --skill localhost-screenshots  # only localhost-screenshots
npx skills@latest add t4sh/skills4sh --skill skill-architect        # only skill-architect
```

Re-running the same command is safe and can be used to sync the installed skill copy with this repository.

For a noninteractive global/user-level install, pass the target agent explicitly:

```bash
npx skills@latest add t4sh/skills4sh -g -a codex -y
```

Replace `codex` with your agent/runtime name when supported, such as `amp`, `cline`, `kimi-code-cli`, `opencode`, `warp`, or `zed`. The exact reload/restart behavior depends on the agent.

### Uninstall

```bash
npx skills@latest remove agent-memory                               # remove agent-memory
npx skills@latest remove code-to-figma                              # remove code-to-figma
npx skills@latest remove discord-harvest                            # remove discord-harvest
npx skills@latest remove eleventy-nunjucks                          # remove eleventy-nunjucks
npx skills@latest remove figma-to-code                              # remove figma-to-code
npx skills@latest remove localhost-screenshots                      # remove localhost-screenshots
npx skills@latest remove skill-architect                           # remove skill-architect
```

Add `-g` to remove from global/user scope. `skills remove --all` is intentionally **not** listed: it can remove skills beyond this repository, depending on the installer and destination.

<details>
<summary>Secondary supporting installer: <code>npx skills4sh</code></summary>

The published `skills4sh` package is a supporting installer for environments that cannot use the generic `skills` CLI, need explicit destination control, need no-git installation, or need to pin a specific ref.

```bash
npx skills4sh --all                                # install all skills
npx skills4sh --skill agent-memory                 # only agent-memory
npx skills4sh --skill code-to-figma                # only code-to-figma
npx skills4sh --skill discord-harvest              # only discord-harvest
npx skills4sh --skill eleventy-nunjucks            # only eleventy-nunjucks
npx skills4sh --skill figma-to-code                # only figma-to-code
npx skills4sh --skill localhost-screenshots        # only localhost-screenshots
npx skills4sh --skill skill-architect             # only skill-architect
```

**Uninstall** (v0.4.0+):

```bash
npx skills4sh remove agent-memory                       # uninstall agent-memory
npx skills4sh remove code-to-figma                      # uninstall code-to-figma
npx skills4sh remove discord-harvest                    # uninstall discord-harvest
npx skills4sh remove eleventy-nunjucks                  # uninstall eleventy-nunjucks
npx skills4sh remove figma-to-code                      # uninstall figma-to-code
npx skills4sh remove localhost-screenshots              # uninstall localhost-screenshots
npx skills4sh remove skill-architect                   # uninstall skill-architect
```

Defaults to `~/.claude/skills/`. Override with `--dest <dir>` to target `~/.cursor/skills/`, `~/.agents/skills/`, or any path. Requires Node 22+. `skills4sh remove --all --yes` is intentionally **not** listed: it wipes every skill in `<dest>`, not just those installed by this package.

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

Security scans are pinned to [guardskills](https://www.npmjs.com/package/guardskills) `1.2.1`. `agent-memory`, `discord-harvest`, `figma-to-code`, and `skill-architect` scan without overrides. `code-to-figma`, `localhost-screenshots`, and `eleventy-nunjucks` have documented false-positive findings from instructional CI/env/secret/grep snippets; the CI matrix only accepts those known findings when they match [SECURITY.md](SECURITY.md) § Expected Security Findings.

```bash
npx guardskills@1.2.1 add t4sh/skills4sh --skill agent-memory --dry-run;
npx guardskills@1.2.1 add t4sh/skills4sh --skill code-to-figma --dry-run --force;
npx guardskills@1.2.1 add t4sh/skills4sh --skill discord-harvest --dry-run;
npx guardskills@1.2.1 add t4sh/skills4sh --skill eleventy-nunjucks --dry-run --force;
npx guardskills@1.2.1 add t4sh/skills4sh --skill figma-to-code --dry-run;
npx guardskills@1.2.1 add t4sh/skills4sh --skill localhost-screenshots --dry-run;
npx guardskills@1.2.1 add t4sh/skills4sh --skill skill-architect --dry-run;
```

Skills do not auto-execute install or runtime code. Some skills may ship optional helper scripts under `assets/`; treat those as inert files unless a user or agent explicitly runs them.

## License

MIT - see [LICENSE](LICENSE) for Details.
