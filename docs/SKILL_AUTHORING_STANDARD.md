# Skill Authoring Standard

This repository uses **Skill Development** as the canonical structural standard for skills, with selected quality checks from **writing-skills** and compatibility awareness from Codex's system **skill-creator**.

The goal is consistency across `skills/<name>/` folders while keeping skills useful in Claude Code, Cursor, Codex, and other file-reading agents.

## Standard Precedence

| Standard | Role in this repo | Apply how |
|---|---|---|
| Skill Development | Primary structural standard | Use for repository layout, third-person trigger descriptions, progressive disclosure, and plugin/package publishing expectations |
| writing-skills | Quality and validation discipline | Use for trigger clarity, pressure/forward testing when practical, no narrative bloat, and concrete examples |
| system skill-creator | Codex compatibility guidance | Use for progressive disclosure, concise body guidance, and optional Codex UI metadata patterns when a future distribution target requires them |

If standards disagree, follow this repository document first, then `CONTRIBUTING.md`, then the external skill guidance.

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

## Validation

Before opening a PR or committing a skill change:

1. Confirm structure and frontmatter follow this standard.
2. Check that all referenced files exist.
3. Regenerate `.security/<name>.yaml` file hashes.
4. Regenerate or verify `skills-lock.json`.
5. Run `npm run check:drift`.
6. Run `npm run check:guardskills`.
7. Run `node bin/hash-check.mjs`.
8. Run `npm test` for installer/tooling changes or when drift behavior changes.

For complex or behavior-shaping skills, add a lightweight forward test: ask a fresh agent or new session to use the skill on a realistic prompt without revealing the expected answer. Use the result to tighten triggers, routing, and failure handling.

## Consistency Rule

New skills should follow this standard by default. Existing skills do not need churn-only rewrites, but substantial edits should move them toward:

- Third-person trigger-rich descriptions
- Leaner `SKILL.md` entrypoints
- Detailed content in `references/`
- Working examples or scripts only when they materially improve reuse
- Clean drift, hash, guardskills, and pack checks
