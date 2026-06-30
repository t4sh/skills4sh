# skills4sh

Agent skills for Claude Code, Cursor, and VS Code (Copilot).

## Skills

| Skill | Description | Version |
|-------|-------------|---------|
| [agent-memory](skills/agent-memory/) | Cross-interface persistent memory system for any project | 2.7.6 |
| [code-to-figma](skills/code-to-figma/) | Generate a CI-anchored code → Figma token export pipeline (walker + Gist) that the tokens-sync-to-figma plugin consumes | 0.1.5 |
| [discord-harvest](skills/discord-harvest/) | Extract and download images, links, and files from Discord conversations | 1.7.7 |
| [eleventy-nunjucks](skills/eleventy-nunjucks/) | 11ty v3 + Nunjucks conventions, syntax cheat sheet, autoescape rules, stability + security checklists | 0.1.7 |
| [figma-to-code](skills/figma-to-code/) | Repo-first Figma MCP workflow for UI implementation, tokens, design-system rules, and Code Connect | 0.1.6 |
| [localhost-screenshots](skills/localhost-screenshots/) | Localhost screenshot capture and visual regression testing | 3.3.6 |
| [skill-architect](skills/skill-architect/) | Portable skill authoring/review rubric that bridges Skill Development, writing-skills, Anthropic/OpenAI skill-creator patterns, vendor adapters, and eval planning | 0.1.2 |

> **Stability note.** `code-to-figma`, `eleventy-nunjucks`, `figma-to-code`, and `skill-architect` are pre-1.0 (v0.x) — their trigger phrasing and prompt content may change in incompatible ways between minor releases. The other three skills (agent-memory, discord-harvest, localhost-screenshots) follow semver: breaking changes only on major bumps.

## Install

These skills are plain [Agent Skills](https://agentskills.io/specification): each skill is a folder with a `SKILL.md` entrypoint plus optional references/assets. Use any installer or agent runtime that can place those folders where your agent reads skills.

Recommended install path:

```bash
npx skills add t4sh/skills4sh                                # install all skills
npx skills add t4sh/skills4sh --skill agent-memory           # only agent-memory
npx skills add t4sh/skills4sh --skill code-to-figma          # only code-to-figma
npx skills add t4sh/skills4sh --skill discord-harvest        # only discord-harvest
npx skills add t4sh/skills4sh --skill eleventy-nunjucks      # only eleventy-nunjucks
npx skills add t4sh/skills4sh --skill figma-to-code          # only figma-to-code
npx skills add t4sh/skills4sh --skill localhost-screenshots  # only localhost-screenshots
npx skills add t4sh/skills4sh --skill skill-architect        # only skill-architect
```

Re-running the same command is safe and can be used to sync the installed skill copy with this repository.

For a noninteractive global/user-level install, pass the target agent explicitly:

```bash
npx skills add t4sh/skills4sh -g -a codex -y
```

Replace `codex` with your agent/runtime name when supported, such as `amp`, `cline`, `kimi-code-cli`, `opencode`, `warp`, or `zed`. The exact reload/restart behavior depends on the agent.

### Uninstall

```bash
npx skills remove agent-memory                               # remove agent-memory
npx skills remove code-to-figma                              # remove code-to-figma
npx skills remove discord-harvest                            # remove discord-harvest
npx skills remove eleventy-nunjucks                          # remove eleventy-nunjucks
npx skills remove figma-to-code                              # remove figma-to-code
npx skills remove localhost-screenshots                      # remove localhost-screenshots
npx skills remove skill-architect                           # remove skill-architect
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
