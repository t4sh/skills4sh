# Comparative study: skill-authoring sources

Use this reference when comparing skill-development, skill-authoring, skill-editing, or skill-repo standards from upstream sources. The goal is to extract durable patterns for a portable skill-authoring standard that any working directory, project, collection, repository, or agent runtime can adapt.

## Primary motivation

`skill-architect` exists because several high-signal authoring skills overlap but solve different layers of the problem. The naming collision also matters: Anthropic and OpenAI both publish a `skill-creator` slug, so a local system needs a neutral architect skill that preserves the useful parts without treating same-name upstream skills as interchangeable.

| Source | What it optimizes | Patterns to reuse | Boundary |
|---|---|---|---|
| [Anthropic `Skill Development`](https://github.com/anthropics/claude-code/tree/main/plugins/plugin-dev/skills/skill-development) (`anthropics/claude-code`) | Claude Code plugin skill structure | trigger-rich descriptions, progressive disclosure, validation checklist, imperative style | Keep Claude plugin paths, commands, and packaging assumptions in adapters |
| [Anthropic `skill-creator`](https://www.skills.sh/anthropics/skills/skill-creator) (`anthropics/skills`) | skill creation plus iterative evaluation | eval loops, baseline comparisons, trigger optimization, blind comparison, review discipline | Use the quality harness selectively instead of making every skill use a heavyweight process |
| [OpenAI `skill-creator`](https://github.com/openai/skills/tree/main/skills/.system/skill-creator) (`openai/skills`) | Codex/OpenAI skill creation and interface metadata | concise scaffold guidance, `agents/openai.yaml`, OpenAI UI metadata fields | Keep Codex-specific metadata in adapters and preserve local frontmatter rules |

The synthesis model is: **portable rubric first, quality harness second, vendor adapters third, local CWD/project/repository conventions respected when present**.

## Benchmark sources

Use these sources as benchmarks for specific parts of `skill-architect` rather than as a single master rubric.

| Role | Source | Reusable pattern |
|---|---|---|
| Core authoring | [Anthropic `skill-creator`](https://www.skills.sh/anthropics/skills/skill-creator) | iterative skill creation, trigger optimization, eval-backed improvement |
| Core authoring | [Matt Pocock `write-a-skill`](https://www.skills.sh/mattpocock/skills/write-a-skill) | lightweight requirement gathering, drafting, review, finalization, progressive disclosure |
| Core authoring | [Obra `writing-skills`](https://www.skills.sh/obra/superpowers/writing-skills) | test-driven documentation, pressure scenarios, behavior evidence, loophole closure |
| Plan handoff | [Obra `writing-plans`](https://www.skills.sh/obra/superpowers/writing-plans) | zero-context plans with exact paths, commands, expected outputs, and review checkpoints |
| Session handoff | [Matt Pocock `handoff`](https://www.skills.sh/mattpocock/skills/handoff) | fresh-agent continuity, artifact references, suggested skills, sensitive-data redaction |
| Audit reporting | [pbakaus `audit`](https://www.skills.sh/pbakaus/impeccable/audit) | severity-ranked findings, positive practices, remediation roadmap |
| Discovery | [Vercel `find-skills`](https://www.skills.sh/vercel-labs/skills/find-skills) | source discovery by task, reputation, adoption, and ecosystem fit |
| Enterprise ecosystem | [Microsoft Azure skill family](https://www.skills.sh/microsoft/azure-skills/azure-ai) | metadata consistency, governance posture, discoverability across a large skill collection |
| Runtime adapter | Antigravity authoring/editing sources | runtime-specific authoring and editing conventions for adapter boundaries |

## Comparison dimensions

Evaluate candidates against the same dimensions:

| Dimension | Questions |
|---|---|
| Retrieval surface | How does the skill describe when it should load? Does it use concrete phrases and contexts? |
| Structure | What files and directories are required or encouraged? |
| Progressive disclosure | What stays in `SKILL.md`, and what moves to references/assets/scripts? |
| Vendor assumptions | Does it assume Claude, Codex, Antigravity, Azure, a specific runtime, or a specific CLI? |
| Evaluation | Does it test triggers, output quality, baseline behavior, or pressure scenarios? |
| Tooling | Does it provide scaffold, validation, packaging, install helpers, or authoring templates? |
| Security and supply chain | Does it document provenance, hashes, permissions, scans, and collision risks? |
| Portability | Can another file-reading agent use the skill without semantic loss? |
| Handoff quality | Can a fresh agent/session act on the artifact without hidden conversation context? |

## Evidence rules

Do not import a pattern from a third-party skill based on summary alone.

Before promoting a rule into the portable rubric:

1. Read the source `SKILL.md` or repository file.
2. Record the file path or URL and date inspected when producing an audit or comparison output.
3. Identify whether the rule is content quality, runtime-specific metadata, local governance, or distribution UX.
4. Test the rule against at least one real skill in the current project, collection, or repository when practical.
5. Prefer the local documented standard when a candidate conflicts with the current working context.

## Current synthesis

- [Anthropic `Skill Development`](https://github.com/anthropics/claude-code/tree/main/plugins/plugin-dev/skills/skill-development) is the structural baseline.
- [Anthropic `skill-creator`](https://www.skills.sh/anthropics/skills/skill-creator) is the evaluation baseline.
- [OpenAI `skill-creator`](https://github.com/openai/skills/tree/main/skills/.system/skill-creator) is the vendor-adapter baseline and illustrates same-slug collision risk.
- [Matt Pocock `write-a-skill`](https://www.skills.sh/mattpocock/skills/write-a-skill) is the lightweight authoring-flow benchmark.
- [Obra `writing-skills`](https://www.skills.sh/obra/superpowers/writing-skills) is the behavior-evidence benchmark.
- [Obra `writing-plans`](https://www.skills.sh/obra/superpowers/writing-plans) and [Matt Pocock `handoff`](https://www.skills.sh/mattpocock/skills/handoff) guide durable handoff artifacts for `plan`, `distill`, and `reconcile` modes.
- [pbakaus `audit`](https://www.skills.sh/pbakaus/impeccable/audit) guides audit report shape.
- [Vercel `find-skills`](https://www.skills.sh/vercel-labs/skills/find-skills) guides ecosystem discovery and source triage.
- Azure and Antigravity guide adapter and ecosystem-convention checks.
