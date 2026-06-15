# Vendor adapters

Use vendor adapters to preserve a portable core while serving specific agent ecosystems.

## Adapter principle

Keep this split:

| Layer | Owner | Example |
|---|---|---|
| Portable skill | `SKILL.md` and references | workflow, triggers, checks |
| Repository contract | local repo docs and CI | frontmatter, security manifests, hashes, lockfiles |
| Vendor adapter | vendor-specific metadata or notes | `agents/openai.yaml`, Claude plugin metadata, Antigravity conventions |

Never let one vendor's metadata overwrite the portable skill contract.

## Claude / Claude Code

Borrow from [Anthropic `Skill Development`](https://github.com/anthropics/claude-code/tree/main/plugins/plugin-dev/skills/skill-development):

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

Borrow from [OpenAI `skill-creator`](https://github.com/openai/skills/tree/main/skills/.system/skill-creator):

- concise scaffold guidance
- explicit `agents/openai.yaml` interface metadata
- display name, short description, default prompt, icon, and brand color fields where supported

Keep OpenAI-specific metadata separate from the portable core. A portable skill may ship an adapter file only when the distribution target reads it.

## Craft Agent

Craft-style skills are loaded by slug and `SKILL.md`. Keep instructions direct and make source/reference reads explicit when a skill requires them. Avoid assuming a browser, MCP source, or shell capability is active unless the skill checks and routes accordingly.

## Cursor, VS Code Copilot, and generic file-reading agents

Assume the agent can read markdown files but may not understand vendor metadata. Keep the portable workflow useful from `SKILL.md` alone. Put editor-specific rules in references or repo-level agent instructions.

## Antigravity

Treat Antigravity as a discovery-backed adapter, not a guessed standard. Before encoding Antigravity-specific rules:

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

## Adapter review questions

Before adding an adapter, answer:

1. Is this requirement portable or vendor-only?
2. Does a generic agent still succeed without the adapter?
3. Can the adapter be regenerated or validated mechanically?
4. Does adding the adapter affect security manifests, hashes, plugin manifests, or lockfiles?
5. Is there a slug collision risk with an upstream skill?
