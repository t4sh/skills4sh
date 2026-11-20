# Vendor adapters

Use vendor adapters to preserve a portable core while serving specific agent ecosystems.

## Adapter principle

Keep this split:

| Layer | Owner | Example |
|---|---|---|
| Portable syntax | [Agent Skills specification](https://agentskills.io/specification) | `SKILL.md`, core frontmatter, optional `scripts/`, `references/`, and `assets/` |
| Portable skill | `SKILL.md` and references | workflow, triggers, checks, quality rubric |
| Repository contract | local repo docs and CI | frontmatter, security manifests, hashes, lockfiles |
| Vendor adapter | vendor-specific metadata or notes | `agents/openai.yaml`, Claude plugin metadata, Antigravity conventions |

Never let one vendor's metadata overwrite the portable skill contract. Experimental portable fields such as `allowed-tools` still require explicit support from the target runtime and local repository schema.

## Coverage policy

Adapter coverage is a local packaging policy, not an automatic portable-skill defect.

Use this order:

1. Read local repo conventions to determine whether adapter files are required, recommended, or intentionally selective.
2. If adapters are required, report missing or stale adapter metadata as a packaging gap and verify it against local drift/hash checks.
3. If no rule exists, report partial adapter coverage as a policy decision and recommend either consistent adapter coverage or a documented selective-coverage rationale.
4. Validate that adapter metadata does not rewrite, dilute, or contradict the portable `SKILL.md` contract.

## Description characters

Keep `<` and `>` out of frontmatter descriptions on every host. Checked 2026-11-21:

| Host or tool | Behavior | Source |
|---|---|---|
| Anthropic `skill-creator` validator | Fails with `Description cannot contain angle brackets (< or >)` | [`quick_validate.py`](https://github.com/anthropics/skills/blob/main/skills/skill-creator/scripts/quick_validate.py) |
| Codex bundled `skill-creator` validator | Fails with the same message | [`quick_validate.py` at `rust-v0.171.0`](https://github.com/openai/codex/blob/rust-v0.171.0/codex-rs/skills/src/assets/samples/skill-creator/scripts/quick_validate.py) |
| Claude Code v2.1.228 or later | Escapes angle brackets in skill-supplied text that reaches the model, such as the description | [Claude Code skills docs](https://code.claude.com/docs/en/skills) |

`validate_skill.py` fails a description that contains either character.

## Claude / Claude Code

Borrow from [Anthropic `Skill Development`](https://github.com/anthropics/claude-plugins-official/tree/main/plugins/plugin-dev/skills/skill-development):

- retrieval-focused descriptions with concrete trigger/use conditions
- lean `SKILL.md`
- progressive disclosure into references
- imperative writing style
- validation and review checklist

Generalize or isolate:

- Claude Code plugin paths
- `cc --plugin-dir` testing
- plugin marketplace packaging
- Claude-only wording

## [Anthropic `skill-creator`](https://www.skills.sh/anthropics/skills/skill-creator)

Treat as the quality harness, not the entire portable rubric.

Useful capabilities:

- baseline vs with-skill comparisons
- trigger evals
- description optimization
- blind comparison
- reviewer/grader/analyzer roles
- HTML review packets

Adapter rule: restore these ideas under non-colliding names such as `skill-evaluation-harness` or document them in `references/eval-methodology.md`. Do not reinstall upstream `skill-creator` over another same-slug skill without provenance checks.

## OpenAI / Codex

Borrow from [OpenAI `skill-creator`](https://github.com/openai/codex/tree/main/codex-rs/skills/src/assets/samples/skill-creator), which ships bundled with Codex (the earlier `openai/skills` repository is marked deprecated in its README):

- concise scaffold guidance
- explicit `agents/openai.yaml` interface metadata
- display name, short description, default prompt, icon, and brand color fields where supported

Keep OpenAI-specific metadata separate from the portable core. A portable skill may ship an adapter file only when the distribution target reads it.

Codex facts, checked 2026-11-21 against [Codex skills docs](https://developers.openai.com/codex/skills) (redirects to [Build skills](https://learn.chatgpt.com/docs/build-skills)), the bundled `~/.codex/skills/.system/skill-creator`, and `codex-cli 0.171.0`. Recheck these on Codex upgrades:

| Topic | Fact | Authoring consequence |
|---|---|---|
| Discovery roots | Repo `.agents/skills/` in each directory from the CWD up to the repo root; user `~/.agents/skills/`; admin `/etc/codex/skills/`; bundled system skills | Install portable skills under `.agents/skills/`; no Codex-only path is needed |
| `agents/openai.yaml` interface | `interface.display_name`, `interface.short_description` (25-64 characters), `interface.icon_small`, `interface.icon_large`, `interface.brand_color`, `interface.default_prompt` (one sentence that names the skill as `$skill-name`) | Quote every string; keep icons under the skill's `assets/` |
| `agents/openai.yaml` policy and dependencies | `policy.allow_implicit_invocation` defaults to `true`; `false` keeps the skill out of default context but still invocable as `$skill`. `dependencies.tools` declares MCP tools (`type: "mcp"`, `value`, `description`, `transport`, `url`) | Set `false` only for user-invoked skills; declare MCP dependencies here in addition to naming the required tools in `SKILL.md`, which other runtimes still rely on |
| `compatibility` frontmatter | Codex's bundled `skill-creator/scripts/quick_validate.py` rejects the specification's `compatibility` key (it allows only `name`, `description`, `license`, `allowed-tools`, `metadata`), but the Codex runtime loader accepts it: `codex debug prompt-input` listed all six skills4sh skills with `compatibility` present | Keep `compatibility`; treat the `quick_validate.py` failure as a known false positive, not a reason to drop the field |
| Skills-list budget | By default the initial skills list uses at most 2% of the model's context window, or 8,000 characters when the context window is unknown. With many skills installed, Codex shortens descriptions first and may omit some skills with a warning. `skills.max_context_tokens` sets a different budget, up to 10,000 tokens | Front-load the capability clause and the strongest quoted trigger. The docs give no fixed per-description length, so do not write to a character count |

`scaffold_skill.py --openai-yaml` writes a minimal `agents/openai.yaml` with `display_name`, `short_description`, `default_prompt`, and `allow_implicit_invocation: true`.

## Craft Agent

Craft-style skills are loaded by slug and `SKILL.md`. Keep instructions direct and make source/reference reads explicit when a skill requires them. Avoid assuming a browser, MCP source, or shell capability is active unless the skill checks and routes accordingly.

## Cursor, GitHub Copilot, Gemini CLI, and generic file-reading agents

Cursor, GitHub Copilot, and Gemini CLI document native Agent Skills discovery. Roots checked 2026-11-21 against each vendor's docs; recheck before relying on one:

| Runtime | Project roots | User roots | Source |
|---|---|---|---|
| Cursor | `.agents/skills/`, `.cursor/skills/`; for compatibility also `.claude/skills/`, `.codex/skills/` | `~/.agents/skills/`, `~/.cursor/skills/`; for compatibility also `~/.claude/skills/`, `~/.codex/skills/` | [Cursor skills docs](https://cursor.com/docs/skills) |
| GitHub Copilot | `.github/skills`, `.claude/skills`, `.agents/skills` | `~/.copilot/skills`, `~/.agents/skills`; supported locations depend on the Copilot surface | [About agent skills](https://docs.github.com/en/copilot/concepts/customizations/agent-skills) |
| Gemini CLI | `.gemini/skills/` or the `.agents/skills/` alias | `~/.gemini/skills/` or the `~/.agents/skills/` alias; within a tier the alias takes precedence | [Gemini CLI skills docs](https://geminicli.com/docs/cli/skills/) |

`.agents/skills/` is the one project root that these three, Codex, and Antigravity all document, so a portable install needs no per-editor copy.

For any other agent, assume it can read markdown files but may not understand vendor metadata. Keep the portable workflow useful from `SKILL.md` alone. Put editor-specific rules in references or repo-level agent instructions.

## Antigravity

Discovery roots, checked 2026-11-21 against the [Antigravity skills docs](https://antigravity.google/docs/skills): workspace skills load from `.agents/skills/` in the workspace root and in each parent folder up to the repository root (`.agent/skills` is still read for backward compatibility); global skills load from `~/.gemini/config/skills/`. The Antigravity CLI also reads `~/.gemini/antigravity-cli/skills/` and `~/.gemini/skills/`, which the Antigravity App does not.

For anything beyond discovery roots, treat Antigravity as a discovery-backed adapter, not a guessed standard. Before encoding Antigravity-specific rules:

1. Identify the exact skill-authoring/editing skill or official docs.
2. Read the source.
3. Extract only portable patterns into the portable rubric.
4. Put Antigravity-only path, metadata, or CLI behavior in this adapter file.

## Azure / Microsoft agent skills

Treat Microsoft Azure skills as an enterprise repository-pattern study:

- naming and discoverability
- service-family grouping
- security and compliance language
- versioning and documentation patterns
- how broad cloud domains are split into focused skills

Do not copy Azure service assumptions into generic skills. Use Azure patterns for enterprise-grade metadata and governance only after source inspection.

## Grok

Grok reads `AGENTS.md` and skills from `.grok/skills/` (project) and `~/.grok/skills/` (user). It may also scan `~/.agents/skills/`. Keep the portable workflow in `SKILL.md`; do not put Grok-only trigger language in descriptions.

Installer check: `npx skills@latest add <repo> --skill <name> --copy -g -a grok`

## OpenClaw

OpenClaw loads Agent Skills from workspace `skills/` first, then project `.agents/skills/`, `~/.agents/skills/`, and `~/.openclaw/skills/`. Use `{baseDir}` only in OpenClaw-specific helper notes. The portable workflow remains `SKILL.md` plus linked references.

Installer check: `npx skills@latest add <repo> --skill <name> --copy -g -a openclaw`

## Adapter review questions

Before adding an adapter, answer:

1. Is this requirement portable or vendor-only?
2. Does a generic agent still succeed without the adapter?
3. Can the adapter be regenerated or validated mechanically?
4. Does adding the adapter affect security manifests, hashes, plugin manifests, or lockfiles?
5. Is there a slug collision risk with an upstream skill?
