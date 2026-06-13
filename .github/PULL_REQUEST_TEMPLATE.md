## Summary

<!-- 1-3 bullets describing the change and why it belongs in this PR. -->

## PR category

<!-- Pick the category that matches the branch/PR prefix. -->

- [ ] `feature/` — new capability or behavior
- [ ] `fix/` — bug fix or correctness/security fix
- [ ] `docs/` — documentation-only change
- [ ] `chore/` — maintenance, CI, release, dependencies, or repo hygiene
- [ ] `update/` — content refresh, version/hash sync, or non-behavioral skill/plugin update

## Affected area

<!-- Check every area touched. Name the exact skill/plugin where applicable. -->

- [ ] Skill: `agent-memory`
- [ ] Skill: `code-to-figma`
- [ ] Skill: `discord-harvest`
- [ ] Skill: `eleventy-nunjucks`
- [ ] Skill: `figma-to-code`
- [ ] Skill: `localhost-screenshots`
- [ ] Plugin: `tokens-sync-to-figma`
- [ ] Installer / CLI (`bin/`, package metadata, npm payload)
- [ ] CI / release / security (`.github/`, `.security/`, branch protection, publishing)
- [ ] Documentation only
- [ ] Repository / general maintenance

## Change type

- [ ] Bug fix
- [ ] Feature
- [ ] Suggestion / improvement
- [ ] Query / documentation clarification
- [ ] Security hardening
- [ ] Maintenance / release / dependency update

## Skill authoring audit

Required for any PR touching `skills/`, `.security/`, `skills-lock.json`, or skill authoring rules/tooling. CI validates that this section is filled for those PRs.

- [ ] Standard-derived checklist was completed before patching.
- [ ] Evidence table was prepared before edits.
- [ ] Mechanical grep/checks were run for every objective rule touched.

| Standard-derived check | Evidence gathered before edits | Mechanical command or grep | Result | Patch/decision |
|---|---|---|---|---|
| <!-- e.g. frontmatter contract --> | <!-- file:line, command output, or source --> | <!-- command run --> | <!-- pass/fail/count --> | <!-- no patch / patched file --> |

## Required local checks

Run the full local suite before requesting review. If a check is not applicable or cannot run, explain why in the Notes column.

| Check | Required for | Status / notes |
|---|---|---|
| `npm run check:skill-standard` | All PRs touching `skills/`, skill docs, or skill authoring rules | |
| `npm run check:drift` | All PRs | |
| `npm run check:guardskills` | All PRs touching skills or `.security/`; recommended for all PRs | |
| `node bin/hash-check.mjs` | All PRs touching `skills/` or `skills-lock.json`; recommended for all PRs | |
| `npm test` | All PRs | |
| `npm run check:pack` | Package payload, README/LICENSE, installer, or release metadata changes | |
| `npm run check:release` | Package version, release, or publish-path changes | |

CI still enforces the protected checks listed in [.github/BRANCH_PROTECTION.md](.github/BRANCH_PROTECTION.md). All PRs, including maintainer PRs, must wait for the required checks to pass before merge.

## OWASP AST10 Security Checklist

Complete this checklist for any PR that modifies files under `skills/`.

### Permissions (AST03)
- [ ] `alwaysAllow` in SKILL.md lists only the minimum required permissions
- [ ] Every permission has a rationale in `.security/<name>.yaml` `permissions.rationale`
- [ ] No new `Bash` or `Write` permissions added without justification

### Integrity (AST01/AST02)
- [ ] `skills-lock.json` updated with new SHA-256 hashes for all changed files
- [ ] Content hashes in `.security/<name>.yaml` updated to match
- [ ] `.security/<name>.yaml` updated with new hashes
- [ ] Version bumped in SKILL.md, skills-lock.json, and `.security/<name>.yaml` if behavior or installable bundle content changed
- [ ] If `package.json` version bumped: `.claude-plugin/marketplace.json`, `.cursor-plugin/plugin.json`, and `npm-shrinkwrap.json` bumped to match where required by CI
- [ ] If `package.json` version bumped: no `vX.Y.Z` tag or GitHub release will be created until after this PR is merged to `main`

### Metadata (AST04)
- [ ] SKILL.md `name` matches directory name
- [ ] `metadata.repository` points to this repo
- [ ] No misleading descriptions or impersonation of other tools

### Isolation (AST06)
- [ ] `.security/<name>.yaml` `execution_context` accurately reflects network and filesystem needs
- [ ] No new network access beyond what's documented
- [ ] Install scripts restricted to agent skill destination paths (`.agents/skills/`, `.claude/skills/`, or equivalent system default)

### Scanning (AST08)
- [ ] `npx guardskills add t4sh/skills4sh --skill <name> --dry-run` passes, or `npm run check:guardskills` passes for the touched skill
- [ ] Any new expected findings documented in SECURITY.md

### Governance (AST09)
- [ ] SECURITY.md updated if supported versions changed
- [ ] Breaking changes noted in PR description

## Plugin checklist

Complete this checklist for any PR that modifies files under `plugins/`.

- [ ] Plugin README documents setup, data flow / contract, external access scopes, and license
- [ ] No secrets, private hostnames, customer names, or project-internal identifiers are committed
- [ ] Host permissions and network domains are least-privilege and justified
- [ ] Executable plugin behavior has been tested in the host app or with the narrowest available local check

## Docs and contributor-facing UX

- [ ] Issue/PR guidance names the affected skill, plugin, or general area clearly
- [ ] New documentation links are relative where possible and resolve locally
- [ ] User-facing wording avoids internal-only jargon

## Test plan

<!-- List commands run and any manual verification. Do not claim checks that were not run. -->
