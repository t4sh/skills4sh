# Naming and packaging

Use this reference when adding, renaming, installing, or packaging skills.

## Slug policy

Prefer stable, specific slugs that communicate the skill's role.

| Situation | Pattern |
|---|---|
| Portable standard or workflow | `skill-architect`, `agent-memory`, `localhost-screenshots` |
| Restored upstream behavior | prefix or suffix to avoid collisions, e.g. `anthropic-skill-creator-evals` |
| Vendor adapter | name by vendor and function, e.g. `openai-skill-adapter` |
| Generic upstream slug | avoid unless the local project, collection, or repository owns the behavior |

## Collision rule

Before installing or adding an upstream skill:

1. Check `skills-lock.json` or the agent lockfile for an existing slug.
2. Check whether the folder already exists.
3. Compare source, path, and hash before replacing anything.
4. If two sources use the same slug, rename the local, portable, or restored variant.
5. Preserve source provenance in the comparative study, changelog, or repository notes.

The `skill-creator` collision is the motivating example: Anthropic and OpenAI both publish a `skill-creator` slug with overlapping but distinct behavior.

## Packaging checklist

When adding a skill, follow the current working context's packaging contract: CWD conventions, project docs, repository rules, runtime metadata, and release gates. In `skills4sh`, examples of a complete implementation update:

- `skills/<name>/SKILL.md`
- `skills/<name>/LICENSE`
- linked files under `references/` and `assets/`
- `.security/<name>.yaml`
- `skills-lock.json`
- `README.md`
- `AGENTS.md`
- `SECURITY.md`
- `.cursor-plugin/plugin.json`
- `.claude-plugin/marketplace.json`

Then run:

```bash
npm run check:skill-standard
npm run check:drift
node bin/hash-check.mjs
npm test
```

Run guardskills when adding scripts, shell snippets, env references, network workflows, or security-sensitive guidance.

## Version policy

New skills often start at `0.1.0` unless the local project, collection, or repository has another release convention. Keep the same version across every place the local context records skill versions, such as:

- `SKILL.md` `metadata.version`
- `skills-lock.json`
- `.security/<name>.yaml`
- README and SECURITY tables

## Install docs

Do not put per-skill install sections or package-manager install commands in `SKILL.md`. Keep install commands in the root README or release docs so generated skills stay portable and CI-compliant.
