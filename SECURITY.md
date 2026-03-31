# Security Policy

This project follows the [OWASP Agentic Skills Top 10 (AST10)](https://owasp.org/www-project-agentic-skills-top-10/) framework to mitigate security risks in AI agent skills.

## Supported Versions

| Skill | Version | Supported |
|-------|---------|-----------|
| agent-memory | 2.5.x | Yes |
| discord-harvest | 1.4.x | Yes |
| localhost-screenshots | 3.0.x | Yes |

## Reporting a Vulnerability

**Do not open a public issue for security vulnerabilities.**

1. Email **t4sh@duck.com** with:
   - Affected skill(s) and version(s)
   - Description of the vulnerability
   - Steps to reproduce
   - Impact assessment

2. You will receive an acknowledgment within **48 hours**.

3. We aim to provide a fix or mitigation within **7 days** for critical issues.

## OWASP AST10 Compliance

This section maps each OWASP Agentic Skills Top 10 risk to the controls implemented in this repository.

### AST01 — Malicious Skills

| Control | Implementation |
|---------|----------------|
| Content hashes | Every file tracked in `skills-lock.json` with SHA-256 hashes |
| Hash in metadata | Each `SKILL.md` includes `content_hash` in frontmatter |
| CI verification | `validate.yml` checks hashes haven't drifted on every PR |
| Canonical manifests | `.security/<name>.yaml` per skill with full file inventory |

### AST02 — Supply Chain Compromise

| Control | Implementation |
|---------|----------------|
| Immutable lock file | `skills-lock.json` pins all files to exact SHA-256 hashes |
| No version ranges | Dependencies (if any) locked to specific versions |
| Single source of truth | All skills authored in this repo — no external registry pulls |
| CI hash verification | Automated drift detection on every push and PR |

### AST03 — Over-Privileged Skills

| Control | Implementation |
|---------|----------------|
| Minimal permissions | Each skill declares only required permissions in `alwaysAllow` |
| Permission rationale | Every permission has a documented reason in `.security/<name>.yaml` permissions rationale |
| Audit trail | `.security/<name>.yaml` records full permission set with justifications |

| Skill | Permissions | Risk Tier |
|-------|-------------|-----------|
| agent-memory | Read, Glob, Grep | Low |
| discord-harvest | Read | Medium |
| localhost-screenshots | None (all gated) | Low |

### AST04 — Insecure Metadata

| Control | Implementation |
|---------|----------------|
| Frontmatter validation | `validate.yml` checks name matches directory, required fields present |
| Author verification | `.security/<name>.yaml` repository field links to canonical source |
| Content hash | `content_hash` in `.security/<name>.yaml` allows registries to verify integrity |

### AST05 — Unsafe Deserialization

| Control | Implementation |
|---------|----------------|
| No executable YAML | SKILL.md frontmatter is declarative metadata only |
| Safe parsing | Skills are parsed by host agents using safe YAML loaders |
| No dynamic code in config | Install scripts are separate from configuration |

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
| guardskills | All skills pass with SAFE rating |
| Snyk | Continuous vulnerability scanning (badge in README) |
| CodeQL | Static analysis on GitHub Actions (weekly + PR) |
| guardskills CI | Automated scanning on every PR via `guardskills.yml` workflow |

### AST09 — No Governance

| Control | Implementation |
|---------|----------------|
| This document | Security policy with disclosure process |
| PR review checklist | `.github/PULL_REQUEST_TEMPLATE.md` includes security review items |
| Skill approval workflow | All skill changes require PR review |
| Supported versions | Clear table of which versions receive security updates |

### AST10 — Cross-Platform Reuse

| Control | Implementation |
|---------|----------------|
| Canonical manifest | `.security/<name>.yaml` per skill with unified schema |
| Platform manifests | `.claude-plugin/marketplace.json` and `.cursor-plugin/plugin.json` generated from canonical source |
| Consistent hashes | Same content hashes across all platform representations |

## Expected Security Findings

The following findings are expected and documented:

### All skills

| Finding | Severity | File(s) | Explanation |
|---------|----------|---------|-------------|
| `R008_ENV_ACCESS` | LOW | `install.sh`, `install.ps1` | Scripts read `$HOME`/`$env:USERPROFILE` solely to determine the global install path (`~/.claude/skills/`). No credential extraction or sensitive data access. |

### agent-memory

| Finding | Severity | File(s) | Explanation |
|---------|----------|---------|-------------|
| `R008_ENV_ACCESS` | LOW | `bootstrap.sh` | Reads `$HOME` to locate global skill assets for initialization. |

### localhost-screenshots

| Finding | Severity | File(s) | Explanation |
|---------|----------|---------|-------------|
| `R005_SECRET_READ` | HIGH/medium | `SKILL.md` | False positive. Triggered by `--user-data-dir=/tmp/chrome-debug` (Chrome CDP debugging flag) and `process.env.HOME \|\| process.env.USERPROFILE, '.cache', 'localhost-screenshots'` (Playwright persistent browser profile path). These are code examples for browser automation — no credentials or secrets are read. The `user-data-dir` is a throwaway temp directory for remote debugging sessions. |
| `R005_SECRET_READ` | HIGH/medium | `reference/playwright-patterns.md` | False positive. Triggered by `process.env.HOME \|\| process.env.USERPROFILE, '.cache', 'localhost-screenshots'` — a code example showing how to set up persistent browser sessions. Stores browser cookies/localStorage for multi-step screenshot workflows, not secrets. |
| `R009_FILE_STAGE` | LOW | `SKILL.md` | Triggered by `/tmp/chrome-debug` in the CDP debugging code example. This is a standard Chrome flag for isolated debugging profiles, not malicious temp file staging. |
| `R008_ENV_ACCESS` | LOW | `SKILL.md`, `reference/playwright-patterns.md`, `reference/visual-regression.md` | Code examples reference `process.env.HOME`/`USERPROFILE` for browser profile and session directories. |

## Security Scanning

Run security scans locally:

```bash
# guardskills (skill-specific)
npx guardskills add t4sh/skills4sh --skill agent-memory --dry-run
npx guardskills add t4sh/skills4sh --skill discord-harvest --dry-run
npx guardskills add t4sh/skills4sh --skill localhost-screenshots --dry-run

# Verify content hashes
for skill in agent-memory discord-harvest localhost-screenshots; do
  echo "=== $skill ==="
  for f in skills/$skill/*; do
    [ -f "$f" ] && echo "  $(basename $f): $(shasum -a 256 "$f" | cut -d' ' -f1)"
  done
done
```
