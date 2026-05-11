# Security Policy

This project follows the [OWASP Agentic Skills Top 10 (AST10)](https://owasp.org/www-project-agentic-skills-top-10/) framework to mitigate security risks in AI agent skills.

## Supported Versions

| Skill | Version | Supported |
|-------|---------|-----------|
| agent-memory | 2.7.0 | Yes |
| discord-harvest | 1.7.0 | Yes |
| eleventy-nunjucks | 0.1.0 | Yes |
| localhost-screenshots | 3.2.0 | Yes |

## Reporting a Vulnerability

**Do not open a public issue for security vulnerabilities.**

1. Email **t4sh@duck.com** with:
   - Affected skill(s) and version(s)
   - Description of the vulnerability
   - Steps to reproduce
   - Impact assessment

2. You will receive an acknowledgment within **48 hours**.

3. We aim to provide a fix or mitigation within **7 days** for critical issues.

## Per-Skill Security Manifests

Each skill has a canonical security manifest containing integrity hashes, permission rationale, execution context, and scanning results. These are the source of truth for OWASP compliance auditing.

| Skill | Manifest |
|-------|----------|
| agent-memory | [`.security/agent-memory.yaml`](.security/agent-memory.yaml) |
| discord-harvest | [`.security/discord-harvest.yaml`](.security/discord-harvest.yaml) |
| eleventy-nunjucks | [`.security/eleventy-nunjucks.yaml`](.security/eleventy-nunjucks.yaml) |
| localhost-screenshots | [`.security/localhost-screenshots.yaml`](.security/localhost-screenshots.yaml) |

## OWASP AST10 Compliance

This section maps each OWASP Agentic Skills Top 10 risk to the controls implemented in this repository.

### AST01 — Malicious Skills

| Control | Implementation |
|---------|----------------|
| Content hashes | Every file tracked in `skills-lock.json` with SHA-256 hashes |
| Hash in metadata | Each skill's SHA-256 hash tracked in `skills-lock.json` and `.security/<name>.yaml` |
| CI verification | `validate.yml` checks hashes haven't drifted on every PR |
| Canonical manifests | `.security/<name>.yaml` per skill with full file inventory |

### AST02 — Supply Chain Compromise

| Control | Implementation |
|---------|----------------|
| Immutable lock file (skills) | `skills-lock.json` pins all files to exact SHA-256 hashes |
| Immutable lock file (npm) | `npm-shrinkwrap.json` pins full transitive dependency tree with integrity hashes and is included in the published npm tarball |
| Exact dependency versions | `package.json` uses exact versions (e.g. `undici: 6.25.0`), no caret/tilde ranges |
| Single source of truth | All skills authored in this repo — no external registry pulls |
| Pre-publish guard | `.github/scripts/check-bin-tag-parity.sh` plus `bin/pack-check.mjs` (wired via `prepublishOnly`, `validate.yml`, `release.yml`, and `npm-publish.yml`) refuse publish when `bin/` has changed since the tag for the current `package.json` version or the tarball omits `npm-shrinkwrap.json` |
| CI hash verification | Automated drift detection on every push and PR (`validate.yml` runs `bin/hash-check.mjs`) |
| Pre-commit hash guard | `.githooks/pre-commit` runs `bin/hash-check.mjs` locally before any commit; contributors opt in via `bash bin/setup-hooks.sh` |

### AST03 — Over-Privileged Skills

| Control | Implementation |
|---------|----------------|
| Minimal permissions | Each skill declares only required permissions in `alwaysAllow` |
| Permission rationale | Every permission has a documented reason in `.security/<name>.yaml` permissions rationale |
| Audit trail | `.security/<name>.yaml` records full permission set with justifications |

| Skill | Permissions | Risk Tier |
|-------|-------------|-----------|
| agent-memory | None (all gated) | Low |
| discord-harvest | None (all gated) | Medium |
| eleventy-nunjucks | None (all gated) | Low |
| localhost-screenshots | None (all gated) | Low |

### AST04 — Insecure Metadata

| Control | Implementation |
|---------|----------------|
| Frontmatter validation | `validate.yml` checks name matches directory, required fields present |
| Author verification | `.security/<name>.yaml` repository field links to canonical source |
| Content hash | File hashes in `.security/<name>.yaml` allow registries to verify integrity |

### AST05 — Unsafe Deserialization

| Control | Implementation |
|---------|----------------|
| No executable YAML | SKILL.md frontmatter is declarative metadata only |
| Safe parsing | Skills are parsed by host agents using safe YAML loaders |
| No dynamic code in config | No install scripts; skills are pure markdown consumed by host agents |

### AST06 — Weak Isolation

| Control | Implementation |
|---------|----------------|
| Execution context declared | `.security/<name>.yaml` execution_context specifies sandbox, network, and filesystem scope |
| Network restrictions | agent-memory: none, localhost-screenshots: localhost-only, discord-harvest: outbound-only |
| No host-mode execution | Skills run inside the host agent's sandbox |
| Docker guidance | localhost-screenshots documents container sandboxing for shared environments |

### AST07 — Update Drift

| Control | Implementation |
|---------|----------------|
| Semantic versioning | All skills use semver in `metadata.version` |
| Version in lock file | `skills-lock.json` pairs version with file hashes |
| CI version-bump check | Validates version changes are accompanied by hash updates |

### AST08 — Poor Scanning

| Control | Implementation |
|---------|----------------|
| guardskills | Pinned to `guardskills@1.2.1`. `agent-memory` and `discord-harvest` scan without overrides; `eleventy-nunjucks` and `localhost-screenshots` have documented expected findings that must match this file before overrides are accepted. |
| CodeQL | `.github/workflows/codeql.yml` runs static analysis on push, PR, and a weekly cron (Mondays 06:00 UTC). Languages: `actions`, `javascript-typescript`. |
| Dependency review | `.github/workflows/dependency-review.yml` runs `actions/dependency-review-action` on every PR with `fail-on-severity: moderate` — blocks PRs that introduce known-vulnerable packages. |
| npm provenance | `.github/workflows/npm-publish.yml` currently authenticates with `NPM_TOKEN` and publishes with `npm publish --provenance`. Each tarball ships a SLSA v1 attestation linking it to this repo + this workflow + the specific commit; consumers verify via `npm audit signatures`. OIDC Trusted Publisher can replace token auth only after it is configured and verified on npmjs.com. |
| guardskills CI | `.github/workflows/guardskills.yml` matrix-scans all four skills (agent-memory, discord-harvest, eleventy-nunjucks, localhost-screenshots) on Node 22 and 24. Triggered on push, PR, and manual dispatch. |

### AST09 — No Governance

| Control | Implementation |
|---------|----------------|
| This document | Security policy with disclosure process |
| PR review checklist | `.github/PULL_REQUEST_TEMPLATE.md` includes security review items |
| Skill review workflow | Skill changes should go through PR review; branch protection recommended for team repos |
| Supported versions | Clear table of which versions receive security updates |

### AST10 — Cross-Platform Reuse

| Control | Implementation |
|---------|----------------|
| Canonical manifest | `.security/<name>.yaml` per skill with unified schema |
| Platform manifests | `.claude-plugin/marketplace.json` and `.cursor-plugin/plugin.json` aligned with canonical source |
| Consistent hashes | Same content hashes across all platform representations |

## Expected Security Findings

The following findings are expected and documented:

### eleventy-nunjucks

| Finding | Severity | File(s) | Explanation |
|---------|----------|---------|-------------|
| `R005_SECRET_READ` | HIGH/medium | `references/build-pipeline.md`, `references/data-cascade.md`, `references/eleventy-config-api.md`, `references/production-patterns.md`, `references/security-checklist.md`, `references/troubleshooting.md` | False positive. Triggered by instructional `grep`/`curl` snippets that teach how to audit for secrets — no credential reads. |
| `R008_ENV_ACCESS` | LOW | `references/data-cascade.md`, `references/eleventy-config-api.md`, `references/production-patterns.md` | Documented `process.env` usage in Eleventy config and build examples. |

### localhost-screenshots

| Finding | Severity | File(s) | Explanation |
|---------|----------|---------|-------------|
| `R005_SECRET_READ` | HIGH/medium | `SKILL.md` | False positive. Triggered by `--user-data-dir=/tmp/chrome-debug` (Chrome CDP debugging flag) and `process.env.HOME \|\| process.env.USERPROFILE, '.cache', 'localhost-screenshots'` (Playwright persistent browser profile path). These are code examples for browser automation — no credentials or secrets are read. The `user-data-dir` is a throwaway temp directory for remote debugging sessions. |
| `R005_SECRET_READ` | HIGH/medium | `references/playwright-patterns.md` | False positive. Triggered by `process.env.HOME \|\| process.env.USERPROFILE, '.cache', 'localhost-screenshots'` — a code example showing how to set up persistent browser sessions. Stores browser cookies/localStorage for multi-step screenshot workflows, not secrets. |
| `R009_FILE_STAGE` | LOW | `SKILL.md` | Triggered by `/tmp/chrome-debug` in the CDP debugging code example. This is a standard Chrome flag for isolated debugging profiles, not malicious temp file staging. |
| `R008_ENV_ACCESS` | LOW | `SKILL.md`, `references/playwright-patterns.md`, `references/visual-regression.md` | Code examples reference `process.env.HOME`/`USERPROFILE` for browser profile and session directories. |

## Security Scanning

Run security scans locally:

```bash
# guardskills (skill-specific; pinned to CI version)
npx guardskills@1.2.1 add t4sh/skills4sh --skill agent-memory --dry-run
npx guardskills@1.2.1 add t4sh/skills4sh --skill discord-harvest --dry-run
npx guardskills@1.2.1 add t4sh/skills4sh --skill eleventy-nunjucks --dry-run --force
npx guardskills@1.2.1 add t4sh/skills4sh --skill localhost-screenshots --dry-run

# Local scan-local (any skill folder, useful before or after pushing):
# npx guardskills scan-local skills/<name> --json

# Verify content hashes (includes references/ subdirectory)
for skill in agent-memory discord-harvest eleventy-nunjucks localhost-screenshots; do
  echo "=== $skill ==="
  find "skills/$skill" -type f -not -name '.DS_Store' | sort | while read -r f; do
    relpath="${f#skills/$skill/}"
    echo "  $relpath: $(shasum -a 256 "$f" | cut -d' ' -f1)"
  done
done
```
