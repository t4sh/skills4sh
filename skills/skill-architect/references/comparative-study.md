# Comparative study: skill-authoring sources

Use this reference when comparing skill-development, skill-authoring, skill-editing, or skill-repo standards from upstream sources. The goal is to extract durable patterns for a portable skill-authoring standard that any working directory, project, collection, repository, or agent runtime can adapt.

## Primary motivation

`skill-architect` exists because several high-signal authoring skills overlap but solve different layers of the problem. The naming collision also matters: Anthropic and OpenAI both publish a `skill-creator` slug, so a local system needs a neutral architect skill that preserves the useful parts without treating same-name upstream skills as interchangeable.

| Source | What it optimizes | Patterns to reuse | Boundary |
|---|---|---|---|
| [Agent Skills open specification](https://agentskills.io/specification) | Portable interoperable syntax and folder contract | canonical frontmatter fields, progressive-disclosure directories, validation baseline | Experimental fields such as `allowed-tools` still require runtime and repository support |
| [Anthropic `Skill Development`](https://github.com/anthropics/claude-code/tree/main/plugins/plugin-dev/skills/skill-development) (`anthropics/claude-code`) | Claude Code plugin skill structure | trigger-rich descriptions, progressive disclosure, validation checklist, imperative style | Keep Claude plugin paths, commands, and packaging assumptions in adapters |
| [Anthropic `skill-creator`](https://github.com/anthropics/skills/tree/main/skills/skill-creator) (`anthropics/skills`) | skill creation plus iterative evaluation | eval loops, baseline comparisons, trigger optimization, blind comparison, review discipline | Use the quality harness selectively instead of making every skill use a heavyweight process |
| [OpenAI `skill-creator`](https://github.com/openai/skills/tree/main/skills/.system/skill-creator) (`openai/skills`) | Codex/OpenAI skill creation and interface metadata | concise scaffold guidance, `agents/openai.yaml`, OpenAI UI metadata fields | Keep Codex-specific metadata in adapters and preserve local frontmatter rules |

The synthesis model is: **open specification for syntax, portable rubric for quality, eval harness for evidence, vendor adapters for runtime details, and local CWD/project/repository conventions for binding distribution rules**.

## Benchmark sources

Use these sources as benchmarks for specific parts of `skill-architect` rather than as a single master rubric.

| Role | Source | Reusable pattern |
|---|---|---|
| Core authoring | [Anthropic `skill-creator`](https://github.com/anthropics/skills/tree/main/skills/skill-creator) | iterative skill creation, trigger optimization, eval-backed improvement |
| Core authoring | [Matt Pocock `write-a-skill`](https://github.com/mattpocock/skills/blob/383b6a06d59c4ce0ffcb14112bfd91265a86cf91/skills/write-a-skill/SKILL.md) | lightweight requirement gathering, drafting, review, finalization, progressive disclosure |
| Core authoring | [Obra `writing-skills`](https://github.com/obra/superpowers/blob/main/skills/writing-skills/SKILL.md) | test-driven documentation, pressure scenarios, behavior evidence, loophole closure |
| Plan handoff | [Obra `writing-plans`](https://github.com/obra/superpowers/blob/main/skills/writing-plans/SKILL.md) | zero-context plans with exact paths, commands, expected outputs, and review checkpoints |
| Session handoff | [Matt Pocock `handoff`](https://github.com/mattpocock/skills/blob/main/skills/productivity/handoff/SKILL.md) | fresh-agent continuity, artifact references, suggested skills, sensitive-data redaction |
| Audit reporting | [pbakaus `audit`](https://github.com/pbakaus/impeccable/blob/main/.agents/skills/impeccable/reference/audit.md) | severity-ranked findings, positive practices, remediation roadmap |
| Discovery | [Vercel `find-skills`](https://github.com/vercel-labs/skills/blob/main/skills/find-skills/SKILL.md) | source discovery by task, reputation, adoption, and ecosystem fit |
| Enterprise ecosystem | [Microsoft Azure skill family](https://github.com/microsoft/azure-skills/blob/main/skills/azure-ai/SKILL.md) | metadata consistency, governance posture, discoverability across a large skill collection |
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
- [Anthropic `skill-creator`](https://github.com/anthropics/skills/tree/main/skills/skill-creator) is the evaluation baseline.
- [OpenAI `skill-creator`](https://github.com/openai/skills/tree/main/skills/.system/skill-creator) is the vendor-adapter baseline and illustrates same-slug collision risk.
- [Matt Pocock `write-a-skill`](https://github.com/mattpocock/skills/blob/383b6a06d59c4ce0ffcb14112bfd91265a86cf91/skills/write-a-skill/SKILL.md) is the lightweight authoring-flow benchmark.
- [Obra `writing-skills`](https://github.com/obra/superpowers/blob/main/skills/writing-skills/SKILL.md) is the behavior-evidence benchmark.
- [Obra `writing-plans`](https://github.com/obra/superpowers/blob/main/skills/writing-plans/SKILL.md) and [Matt Pocock `handoff`](https://github.com/mattpocock/skills/blob/main/skills/productivity/handoff/SKILL.md) guide durable handoff artifacts for `plan`, `distill`, and `reconcile` modes.
- [pbakaus `audit`](https://github.com/pbakaus/impeccable/blob/main/.agents/skills/impeccable/reference/audit.md) guides audit report shape.
- [Vercel `find-skills`](https://github.com/vercel-labs/skills/blob/main/skills/find-skills/SKILL.md) guides ecosystem discovery and source triage.
- Azure and Antigravity guide adapter and ecosystem-convention checks.

## Source freshness and historical inputs

Rechecked September 13, 2026. These are inspected source revisions, not automatic adoption approvals. A newer repository release does not establish that an individual skill changed. Compare against the local decision history before calling an upstream pattern new.

| Inspected source | Pinned revision |
|---|---|
| `anthropics/skills/skills/skill-creator/SKILL.md` | [b0cbd3df skill-creator: drop ANTHROPIC_API_KEY requirement from description optimizer (#547)](https://github.com/anthropics/skills/blob/b0cbd3df1533b396d281a6886d5132f623393a9c/skills/skill-creator/SKILL.md) |
| `anthropics/claude-code/plugins/plugin-dev/skills/skill-development/SKILL.md` | [387dc35d feat: Add plugin-dev toolkit for comprehensive plugin development](https://github.com/anthropics/claude-code/blob/387dc35db708150c229d7ed2d34342042e417fa0/plugins/plugin-dev/skills/skill-development/SKILL.md) |
| `openai/skills/skills/.system/skill-creator/SKILL.md` | [4ab6e0fd Remove stale references in skill-creator (#110)](https://github.com/openai/skills/blob/4ab6e0fd99c6667163bc34173e3ed3a3fed75ebc/skills/.system/skill-creator/SKILL.md) |
| `openai/skills/skills/.system/skill-creator/references/openai_yaml.md` | [94fa1952 Add support for agents/openai.yaml in skill-creator (#76)](https://github.com/openai/skills/blob/94fa19526eea7676eb5ecde1b9d611d9889aa624/skills/.system/skill-creator/references/openai_yaml.md) |
| `obra/superpowers/skills/writing-skills/SKILL.md` | [d238a48f docs: fix dead references to pruned claude-code-tools.md/copilot-tools.md](https://github.com/obra/superpowers/blob/d238a48f5d6b8f51f822fea17d646cfe177747ee/skills/writing-skills/SKILL.md) |
| `obra/superpowers/skills/writing-plans/SKILL.md` | [b36e0829 Release v6.3.0: Devin CLI and Hermes Agent support, brainstorming three-path router, SDD/Codex efficiency fixes (#2125)](https://github.com/obra/superpowers/blob/b36e0829c6d0140e93cfef2ca599b1b07d4a7797/skills/writing-plans/SKILL.md) |
| `mattpocock/skills/skills/productivity/handoff/SKILL.md` | [d28dfdc3 Standardize cross-skill invocation on explicit "call the Skill tool" phrasing](https://github.com/mattpocock/skills/blob/d28dfdc39beadc3142a33359b5cfa4765dcbd0bc/skills/productivity/handoff/SKILL.md) |
| `pbakaus/impeccable/.agents/skills/impeccable/reference/audit.md` | [3e1f67c5 Sync generated provider output](https://github.com/pbakaus/impeccable/blob/3e1f67c52cb0f0ac8ea2dbc27646e544945f5813/.agents/skills/impeccable/reference/audit.md) |
| `vercel-labs/skills/skills/find-skills/SKILL.md` | [773fb2c7 docs(find-skills): remove redundant check command](https://github.com/vercel-labs/skills/blob/773fb2c7bbf16781670a3520affc4abd0c6151ae/skills/find-skills/SKILL.md) |
| `microsoft/azure-skills/skills/azure-ai/SKILL.md` | [9cd2049b Sync plugin files from GitHub-Copilot-for-Azure (#177)](https://github.com/microsoft/azure-skills/blob/9cd2049b35a580e5cd6e6a8288aff5c81e34b4d8/skills/azure-ai/SKILL.md) |

Matt Pocock's `write-a-skill` remains a historical input, not a currently maintained dependency. Its pinned source above is from `383b6a06 Moved to ./skills directory`; the current tree no longer contains that skill. Preserve useful lightweight authoring principles without importing its inconsistent line thresholds (100 versus 500) over the local rubric. Antigravity has no concrete inspected source in this comparison: treat it as an adapter category, not evidence for a new rule. References to Obra or standalone Skill Development identify source patterns; they do not require installing or invoking overlapping workflows.
