# Skill Authoring Standard

This repository uses **Skill Development** as the canonical structural standard for skills, with selected quality checks from **writing-skills** and compatibility awareness from Codex's system **skill-creator**.

The goal is consistency across `skills/<name>/` folders while keeping skills useful in Claude Code, Cursor, Codex, and other file-reading agents.

## Standard Precedence

| Standard | Role in this repo | Apply how |
|---|---|---|
| **This repo's distribution contract** — `license` / `compatibility` / `metadata` frontmatter, `.security/<name>.yaml`, `skills-lock.json`, drift / guardskills / hash CI, semver monotonicity, cross-agent compatibility | **Binding and CI-enforced; supersedes the three external rubrics on any conflict** | Mandatory for every skill — see **Frontmatter** and **Review & Audit Discipline** |
| Skill Development | Primary structural standard | Use for repository layout, third-person trigger descriptions, progressive disclosure, and plugin/package publishing expectations |
| writing-skills | Quality and validation discipline | Use for trigger clarity, pressure/forward testing when practical, no narrative bloat, and concrete examples. See **Review & Audit Discipline** for how findings must be evidenced |
| system skill-creator | Codex compatibility guidance | Use for progressive disclosure, concise body guidance, and optional Codex UI metadata patterns when a future distribution target requires them |

The three external rubrics shape content and structure; this repo's distribution contract governs packaging, security, and release, and is the layer enforced in CI. If standards disagree, follow this repository document first, then `CONTRIBUTING.md`, then the external skill guidance.

## Required Layout

Every skill lives in:

```text
skills/<skill-name>/
├── SKILL.md
├── references/          # optional, recommended for detailed guidance
└── assets/              # optional, for icons and static files
```

Do not add auxiliary files such as per-skill README, changelog, or install docs unless a future repository rule explicitly allows them. Put durable user-facing docs in the root README or references where they are loaded only when needed.

## Frontmatter

Allowed `SKILL.md` frontmatter fields:

```yaml
---
name: <directory-name>
description: "This skill should be used when ..."
license: MIT
compatibility: macOS, Linux, or Windows
metadata:
  author: t4sh
  version: "0.1.0"
  tags: comma, separated, keywords
---
```

Rules:

- `name` must match the directory.
- `description` is the retrieval surface. Use third person and include concrete user phrases, file types, tools, error text, or situations that should trigger the skill.
- The description may include a short usefulness clause after trigger phrases, but must not become a full workflow summary.
- `metadata.version` is the skill version. Bump it for updates after the skill has landed on `main`; new-skill review commits before first merge may keep the same initial version.
- `tags` should include search synonyms, tool names, and domain terms.

## Body Size

Use progressive disclosure instead of forcing every detail into `SKILL.md`.

| Skill type | Target body size |
|---|---:|
| Simple reference or narrow command | 300-700 words |
| Normal workflow skill | 1,000-2,000 words |
| Complex workflow skill | 2,000-3,500 words with justification |
| Above 3,500 words | Extract detail to `references/` before merge unless there is a clear review reason |

The body should contain triggers already implied by the description only when they help route commands after the skill loads. Detailed examples, URL matrices, long troubleshooting, API notes, and comparison tables belong in `references/`.

## Writing Style

- Use objective, imperative instructions: "Inspect the repository", "Run the drift check".
- Avoid second-person phrasing where possible.
- Prefer tables for routing, command choice, and quick references.
- Use one strong example per common workflow; put extended examples in references.
- Avoid narrative session history. Skills describe reusable behavior, not how one session solved a problem.

## Progressive Disclosure

Keep `SKILL.md` as the entrypoint:

- Core purpose and boundaries
- Command or workflow routing
- Essential operating procedure
- Failure handling that changes immediate behavior
- Verification checklist
- Links to exact reference files and when to read them

Move to `references/`:

- Detailed patterns
- Long matrices
- Advanced edge cases
- Benchmark comparisons
- Full troubleshooting playbooks
- Examples longer than a few bullets

Every reference file must be linked from `SKILL.md`, and links must resolve within the skill folder.

## Review & Audit Discipline

Any check against this standard — authoring a new skill, editing one, or auditing the set — must produce findings that meet five properties. They are what the repo already expects of code review, adapted from `skill-development` (structure and the skill-reviewer step), `writing-skills` (test-first discipline), and `skill-creator` (evals). A finding or check that cannot meet them is an opinion, not a result.

| Property | What it requires | How it is satisfied here | Grounded in |
|---|---|---|---|
| **Source-cited** | Every claim names its evidence: a `file:line` in the skill, a command plus its output, or an external authority (official docs, a spec). No assertions from memory; no counts from an unverified `grep`. | Findings quote `skills/<name>/…:line`; factual claims about a tool or API link the primary source; an "N violations" count is confirmed against sampled files before it is reported. | writing-skills core principle ("if you didn't watch it fail, you don't know what it teaches"); code-review lens |
| **Fixture-tested** | Behavior-shaping guidance and embedded code or commands are exercised against a fixture before merge — a forward test (fresh agent, realistic prompt, expected answer withheld) or a runnable eval — not judged by reading alone. | Complex or behavior-shaping skills get a forward test; embedded scripts and snippets are executed in a sandbox; objectively-verifiable skills carry `evals/` prompts plus assertions. | writing-skills (RED→GREEN→REFACTOR, the Iron Law); skill-creator (`evals.json` + assertions) |
| **Narrow and mechanical** | Each check is one deterministic pass/fail gate. Anything a regex or validator can decide is automated; prose and human judgment are reserved for what automation cannot decide. | Frontmatter fields, name/directory match, link resolution, file hashes, drift, and guardskills are validator-decided; the standard's prose covers only judgment calls (trigger quality, body altitude, narrative bloat). | writing-skills ("mechanical constraints … automate it — save documentation for judgment calls") |
| **Visible in CI** | The mechanical gates run in CI on every skill change and their pass/fail shows in the PR, not only on the author's machine. | `check:drift`, `check:guardskills`, hash-check, and `npm test` run in CI; a red check blocks merge. | repo tooling (`package.json` scripts, `bin/hash-check.mjs`) |
| **Reviewed like any other code** | Skill changes go through the same PR review as code — diffed, read by a second reviewer (a human, or the skill-reviewer / code-review agent), never pushed straight to `main`. | Skill diffs are reviewed in a PR; the skill-reviewer agent checks description quality, organization, and progressive disclosure; embedded code gets the code-review lens. | skill-development (Step 5, skill-reviewer agent); writing-skills ("deploying untested skills = deploying untested code") |

### Audit packet order (checklist first, patch second)

For any skill or skill-standard change, prepare the review packet before editing:

1. Derive a checklist from this standard and the relevant skill rubric.
2. Fill an evidence table before edits with one row per objective rule or judgment claim: standard-derived check, `file:line` or command evidence, mechanical command/grep, result, and patch decision.
3. Run mechanical grep/checks for every objective rule touched. Do not rely on prose review for anything a script can decide.
4. Patch only after the checklist and evidence table exist, then update the PR's **Skill authoring audit** section.

The PR body is CI-checked for this packet on pull requests that touch `skills/`, `.security/`, `skills-lock.json`, or skill authoring rules/tooling.

### Mechanical gate (narrow, CI-visible)

Run before opening a PR; CI re-runs the same checks.

1. `npm run check:skill-standard` — allowed frontmatter fields only, required repo metadata present, third-person trigger description, no per-skill install docs/commands, no auxiliary README/changelog/install docs, and `SKILL.md` body below the hard 3,500-word threshold.
2. Every `references/` file is linked from `SKILL.md`, and every link resolves within the skill folder (`npm run check:drift`).
3. Regenerate `.security/<name>.yaml` file hashes.
4. Regenerate or verify `skills-lock.json`.
5. `npm run check:drift`
6. `npm run check:guardskills`
7. `node bin/hash-check.mjs`
8. `npm run check:pr-skill-audit` — on PRs, verifies the evidence table and checklist-before-patch attestations when skill content or skill-standard tooling changes.
9. `npm test` — for checker/tooling changes and any skill-standard rule changes.

### Judgment gate (cite + fixture, cannot be automated)

For anything the mechanical gate cannot decide — trigger quality, body altitude, narrative bloat, whether embedded code is correct:

- **Cite it.** Quote the `file:line`, and for a factual or tool claim link the primary source.
- **Fixture-test it.** For complex or behavior-shaping skills, run a forward test: a fresh agent or new session uses the skill on a realistic prompt with the expected answer withheld. Use the result to tighten triggers, routing, and failure handling. Execute embedded scripts and snippets in a sandbox rather than vouching for them by reading.
- **Review it.** Treat the finding like a code-review comment: specific, evidence-backed, and actionable.

## Consistency Rule

New skills should follow this standard by default. Existing skills do not need churn-only rewrites, but substantial edits should move them toward:

- Third-person trigger-rich descriptions
- Leaner `SKILL.md` entrypoints
- Detailed content in `references/`
- Working examples or scripts only when they materially improve reuse
- Clean drift, hash, guardskills, and pack checks
