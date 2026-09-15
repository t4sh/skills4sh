# skills4sh

Practical skills for developers and their agents: preserve project understanding, turn designs into code, verify interfaces, and maintain reusable workflows.

Each skill is an [Agent Skills](https://agentskills.io/specification) folder. The core workflows are portable. Installation paths and host-specific capabilities are documented separately; each skill tells the agent when differences in tools, permissions, or instruction loading affect execution.

## Choose a skill

| Skill | What it helps you do | Version |
|-------|---------------------|---------|
| [agent-memory](skills/agent-memory/) | Share project decisions, rationale, conventions, and handoffs across developers and agents through Git | 2.7.7 |
| [code-to-figma](skills/code-to-figma/) | Build a CI pipeline that exports design tokens and page structure for a Figma plugin to consume | 0.2.0 |
| [discord-harvest](skills/discord-harvest/) | Archive Discord images and attachments, and catalog shared links, using authorized bot access or supplied exports | 2.0.0 |
| [eleventy-nunjucks](skills/eleventy-nunjucks/) | Build, debug, and review Eleventy sites and Nunjucks templates, with a separate Build Awesome prerelease migration guide | 0.1.9 |
| [figma-to-code](skills/figma-to-code/) | Implement Figma designs in your codebase, map design tokens, and establish component mappings and project rules | 0.1.7 |
| [localhost-screenshots](skills/localhost-screenshots/) | Capture responsive screenshots and compare interface changes on a local development server | 3.3.7 |
| [skill-architect](skills/skill-architect/) | Create, review, and improve skills with clear triggers, reusable procedures, and meaningful verification | 0.1.4 |

## Three places to start

### agent-memory — a shared brain for your codebase and team

**The repo is the room. Git carries the context.**

Preserve decisions, rationale, conventions, and handoffs as reviewable Markdown alongside the code. Commit and share that context so another developer—and their agent—can pick up the reasoning behind the work. It helps a solo developer resume a project, a team onboard a colleague, or collaborators continue across different agent tools.

Memory belongs to the project. Branches can carry exploratory thinking; review and merge establish what the team accepts. For work spanning repositories, record relevant context in each project and reference shared decisions deliberately. The skill does not automatically synchronize memory between repositories or provide per-person access controls.

> Try: “Save why we chose this approach in project memory so the next developer and their agent can continue from here.”

### skill-architect — make skills easier to find, follow, and verify

Turn a useful working method into a reusable skill, or audit an existing one for vague triggers, confusing steps, stale guidance, and missing checks. It helps keep the entry point concise, move detail into references, and distinguish mechanical validation from behavior that needs an actual trial.

> Try: “Review this skill: would an agent know when to load it, what to do, and how to verify completion?”

### localhost-screenshots — see what changed

Give interface work visible evidence. Capture a local page at requested viewport sizes, compare before and after, and investigate responsive layout problems. Use a connected Chrome workflow for quick inspection or Playwright for repeatable capture sets and visual comparisons.

> Try: “Capture this local page at desktop and mobile sizes, then compare it with the screenshots from before the layout change.”

## Install and try it

These are plain [Agent Skills](https://agentskills.io/specification): folders with a `SKILL.md` entry point plus optional references and assets. Choose one skill from the table, install it, and ask your agent to use it on a relevant task.

```bash
npx skills@latest add t4sh/skills4sh --skill agent-memory --copy
```

Replace `agent-memory` with any skill name above. The interactive installer lets you choose the target agents. To browse the collection without installing:

```bash
npx skills@latest add t4sh/skills4sh --list
```

For a global install targeting Codex:

```bash
npx skills@latest add t4sh/skills4sh --skill agent-memory --copy -g -a codex
```

Replace `codex` with a supported target such as `claude-code`, `cursor`, `grok`, `openclaw`, or `github-copilot`. The [skills CLI supported-agents table](https://github.com/vercel-labs/skills#supported-agents) lists current `--agent` values and paths. Reload or restart as required by the host.

| Runtime | `--agent` | Project root | Global root |
|---|---|---|---|
| Claude Code | `claude-code` | `.claude/skills/` | `~/.claude/skills/` |
| Codex | `codex` | `.agents/skills/` | `~/.codex/skills/` |
| Cursor | `cursor` | `.agents/skills/` | `~/.cursor/skills/` |
| GitHub Copilot | `github-copilot` | `.agents/skills/` | `~/.copilot/skills/` |
| Grok | `grok` | `.grok/skills/` | `~/.grok/skills/` |
| OpenClaw | `openclaw` | `skills/` | `~/.openclaw/skills/` |
| Generic / shared | host default | `.agents/skills/` | `~/.agents/skills/` |

Pointer files (`AGENTS.md`, `CLAUDE.md`, Cursor rules, and similar) are documented per skill when a workflow writes them — see `agent-memory` [agent-pointers.md](skills/agent-memory/references/agent-pointers.md). They do not change the skill's commands.

### Skill scope is different from memory scope

| Item | Where it belongs |
|------|------------------|
| **Project skill installation** | In the current project, available to agents configured to read it; share through Git when appropriate |
| **Global skill installation** (`-g`) | In your user directory, reusable across projects |
| **Project memory** | In that project's `.agent-memory/`, shared only when deliberately committed and distributed |
| **Agent-native memory** | In the agent's own managed store, separate from this skill's project memory |

**Installing `agent-memory` globally makes the workflow reusable. It does not create one global memory shared across all your projects.**

Installing a skill also does not provision its dependencies. Figma workflows need the relevant Figma access and tools; screenshot workflows need a running local site and browser tooling. Check each skill's compatibility notes for macOS, Windows, Linux, and runtime requirements.

### Try the other workflows

| Skill | Example request |
|-------|-----------------|
| code-to-figma | “Set up a pipeline to export this repository's design tokens and page structure for the Figma plugin.” |
| figma-to-code | “Implement this Figma design using our existing components and tokens.” |
| discord-harvest | “Archive the images and attachments from this Discord export.” |
| eleventy-nunjucks | “Help me debug the layout chain in this Eleventy site.” |

<details>
<summary>Update, install the collection, or uninstall</summary>

Update an installed skill from upstream. Preserve any local customizations before updating or reinstalling:

```bash
npx skills@latest update agent-memory
```

To install every skill in this repository, choose the target agents interactively:

```bash
npx skills@latest add t4sh/skills4sh --skill '*' --copy
```

Remove a selected skill:

```bash
npx skills@latest remove agent-memory
```

Add `-g` to remove from global scope. Broad removal commands can remove skills from other repositories too; select the skill you intend to remove.

</details>

<details>
<summary>Alternative installer: <code>npx skills4sh</code></summary>

The supporting installer offers explicit destination control, installation without Git, and selection of a branch or commit with `--ref`.

```bash
npx skills4sh --skill agent-memory
npx skills4sh --all
npx skills4sh remove agent-memory
```

It copies files, defaults to `~/.claude/skills/`, and requires Node 22+. Override the destination with `--dest <dir>` for your agent's skill directory. Its bulk removal command removes every skill in the destination, including skills installed from elsewhere.

</details>

## Structure and verification

```text
skills/<skill-name>/
├── SKILL.md          # Metadata, triggers, and operating instructions
├── LICENSE
├── references/       # Optional supporting documentation
└── assets/           # Optional icons, fixtures, or helper scripts
```

Repository checks validate skill metadata, reference links, version consistency, and file hashes. Security scans use pinned [guardskills](https://www.npmjs.com/package/guardskills) `1.2.1`, with documented expected findings. These checks cover specific properties; behavioral fixtures and review provide additional evidence, and an eval scenario alone is not a recorded passing result.

See [SECURITY.md](SECURITY.md) for scan details, expected findings, and vulnerability reporting; [`.security/`](.security/) contains per-skill integrity manifests. The [skill authoring standard](docs/SKILL_AUTHORING_STANDARD.md) describes the review and verification requirements.

Skill files do not execute themselves. Agents may follow their instructions and run optional helpers when the task and permissions allow.

> **Stability:** `code-to-figma`, `eleventy-nunjucks`, `figma-to-code`, and `skill-architect` are pre-1.0: prompt content and triggers may change incompatibly between minor releases. `agent-memory`, `discord-harvest`, and `localhost-screenshots` reserve breaking changes for major versions.

## License

MIT — see [LICENSE](LICENSE).
