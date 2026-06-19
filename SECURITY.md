# Security Policy

This project follows the [OWASP Agentic Skills Top 10 (AST10)](https://owasp.org/www-project-agentic-skills-top-10/) framework to mitigate security risks in AI agent skills.

## Supported Versions

| Skill | Version | Supported |
|-------|---------|-----------|
| agent-memory | 2.7.5 | Yes |
| code-to-figma | 0.1.4 | Yes |
| discord-harvest | 1.7.6 | Yes |
| eleventy-nunjucks | 0.1.6 | Yes |
| figma-to-code | 0.1.5 | Yes |
| localhost-screenshots | 3.3.5 | Yes |
| skill-architect | 0.1.1 | Yes |

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
| code-to-figma | [`.security/code-to-figma.yaml`](.security/code-to-figma.yaml) |
| discord-harvest | [`.security/discord-harvest.yaml`](.security/discord-harvest.yaml) |
| eleventy-nunjucks | [`.security/eleventy-nunjucks.yaml`](.security/eleventy-nunjucks.yaml) |
| figma-to-code | [`.security/figma-to-code.yaml`](.security/figma-to-code.yaml) |
| localhost-screenshots | [`.security/localhost-screenshots.yaml`](.security/localhost-screenshots.yaml) |
| skill-architect | [`.security/skill-architect.yaml`](.security/skill-architect.yaml) |

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

#### Release-integrity chain (consumer-verifiable)

The `skills-lock.json` file is not separately signed — it doesn't need to be, because the **release commit and tag are both signed and GitHub-verifies them independently**, and the published tarball carries a SLSA v1 provenance attestation that pins back to a specific commit SHA. The chain a consumer can verify:

1. **Release tag is annotated and SSH-signed.** Enforced locally by `git tag -a` (with `tag.gpgsign=true`) and verified at publish by `bin/release-check.mjs` via GitHub's `/git/tags/<sha>` API — `verification.verified` must be `true`.
2. **Release commit is GitHub-verified.** Since v0.4.1, `bin/release-check.mjs` also asserts `commit.verification.verified === true` for the tag's target commit via `/commits/<sha>`. Tag and commit signatures are independent in git; both must hold.
3. **Tarball provenance attests the build environment.** `npm publish --provenance` from OIDC Trusted Publisher produces a SLSA v1 attestation linking the tarball to (repo, workflow, commit SHA). Anyone can verify with `npm audit signatures skills4sh@<v>`. The attestation is published to the Sigstore transparency log — `https://search.sigstore.dev/?logIndex=<n>` (the index is printed in the publish workflow's log).
4. **`gitHead` published with the tarball matches.** `bin/verify-published.mjs` (runs as the last step of `npm-publish.yml`) asserts the registry-side `gitHead` field on the published version equals the commit just shipped.

Chain in one sentence: **maintainer-signed commit → maintainer-signed tag pointing at that commit → SLSA-attested tarball produced by GitHub Actions OIDC from that commit → registry metadata records that same commit SHA.** Any link broken by an attacker would fail at least one of the four verifications above.

**Residual risk: single maintainer.** All four links above resolve to the same maintainer identity (the SSH key on the repo's verification status). Compromise of that key would let an attacker forge each link. Real multi-key governance (release-signing key separate from commit-signing key, m-of-n quorum) is the only architectural fix — out of scope at single-maintainer scale, but flagged here for future v1.0+ governance.

### AST03 — Over-Privileged Skills

| Control | Implementation |
|---------|----------------|
| Minimal permissions | Each skill declares only required permissions in `alwaysAllow` |
| Permission rationale | Every permission has a documented reason in `.security/<name>.yaml` permissions rationale |
| Audit trail | `.security/<name>.yaml` records full permission set with justifications |

| Skill | Permissions | Risk Tier |
|-------|-------------|-----------|
| agent-memory | None (all gated) | Low |
| code-to-figma | None (all gated) | Medium |
| discord-harvest | None (all gated) | Medium |
| eleventy-nunjucks | None (all gated) | Low |
| figma-to-code | None (all gated) | Low |
| localhost-screenshots | None (all gated) | Low |
| skill-architect | None (all gated) | Low |

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
| No dynamic code in config | No install scripts and no auto-executed runtime code; optional helper scripts under `assets/` are inert unless explicitly run |

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
| guardskills | Pinned to `guardskills@1.2.1`. `agent-memory`, `discord-harvest`, `figma-to-code`, and `skill-architect` scan without overrides; `code-to-figma`, `eleventy-nunjucks`, and `localhost-screenshots` have documented expected findings that must match this file before overrides are accepted. |
| CodeQL | `.github/workflows/codeql.yml` runs static analysis on push, PR, and a weekly cron (Mondays 06:00 UTC). Languages: `actions`, `javascript-typescript`. |
| Dependency review | `.github/workflows/dependency-review.yml` runs `actions/dependency-review-action` on every PR with `fail-on-severity: moderate` — blocks PRs that introduce known-vulnerable packages. |
| GitHub Actions SHA-pinning | All `uses:` directives across every workflow are pinned to a commit SHA (with a trailing `# vX.Y.Z` comment for human readability). Floating major tags (`@v4`) would expose CI to upstream compromise — see e.g. the tj-actions/changed-files 2025 incident. `.github/dependabot.yml` opens grouped weekly PRs to keep the SHAs moving forward; each upgrade PR hits the full required-checks matrix before merge. |
| npm provenance & publish auth | `.github/workflows/npm-publish.yml` authenticates via **OIDC Trusted Publisher** (no `NPM_TOKEN` secret since v0.3.9). The GitHub Actions OIDC token both authenticates the registry `PUT` and signs the SLSA v1 provenance attestation. Trusted Publisher binding on npmjs.com: Repository `t4sh/skills4sh`, Workflow `npm-publish.yml`. Package "Publishing access" is set to "Require 2FA and disallow tokens". Runner uses Node 24 / npm ≥ 11.5 (Trusted Publisher publish-auth requires npm 11+; Node 22's bundled npm 10 can only sign provenance, not authenticate publishes). Consumers verify each tarball via `npm audit signatures`. |
| guardskills CI | `.github/workflows/guardskills.yml` matrix-scans all seven skills (agent-memory, code-to-figma, discord-harvest, eleventy-nunjucks, figma-to-code, localhost-screenshots, skill-architect) on Node 22 and 24. Triggered on push, PR, and manual dispatch. |

### AST09 — No Governance

| Control | Implementation |
|---------|----------------|
| This document | Security policy with disclosure process |
| PR review checklist | `.github/PULL_REQUEST_TEMPLATE.md` includes security review items |
| Skill review workflow | Skill changes should go through PR review; branch protection recommended for team repos |
| Supported versions | Clear table of which versions receive security updates |
| Branch-protection drift detection | `.github/workflows/branch-protection-drift.yml` runs daily (06:15 UTC) and on every PR; asserts that the live protection config on `refs/heads/main` matches the checked-in expected state at `.github/branch-protection.expected.json`. Requires a `BRANCH_PROTECTION_TOKEN` secret (fine-grained PAT with `Administration: Read-only` — default `GITHUB_TOKEN` doesn't support that scope). Since v0.4.3 the workflow **fails hard** when the secret is absent (was previously skip-with-exit-0): once the check is in the required-status-checks list, silently passing on missing secret would be a bypass vector. Dependabot-triggered runs are the one exception — Dependabot has a separate secret store, so those skip cleanly. |
| Signed commits enforced at branch level | `required_signatures: true` on `refs/heads/main` since v0.4.2. Every commit pushed to main must be GitHub-verified (SSH or GPG). Complements the release-time commit-signature check in `bin/release-check.mjs` by enforcing the invariant at *every* push, not just at publish. |

### AST10 — Cross-Platform Reuse

| Control | Implementation |
|---------|----------------|
| Canonical manifest | `.security/<name>.yaml` per skill with unified schema |
| Platform manifests | `.claude-plugin/marketplace.json` and `.cursor-plugin/plugin.json` aligned with canonical source |
| Consistent hashes | Same content hashes across all platform representations |

## Expected Security Findings

The following findings are expected and documented:

### code-to-figma

| Finding | Severity | File(s) | Explanation |
|---------|----------|---------|-------------|
| `R005_SECRET_READ` | HIGH/medium | `references/walker-patterns.md` | False positive (acknowledged). The generic `push-to-figma.mjs` template reads `process.env.GIST_TOKEN` to authenticate a Gist PATCH — sourcing the token from the environment instead of hardcoding it is the secure pattern. No secret file or credential store is read; the script is an adaptable template, not executed by the skill. |
| `R008_ENV_ACCESS` | LOW | `references/ci-and-gist-setup.md`, `references/walker-patterns.md` | CI/template snippets reference `GIST_TOKEN` / `GIST_ID` via GitHub Actions secrets and `process.env`, while the local pusher may read `gistId` from config — the recommended pattern, shown as instructional examples. |
| `R009_FILE_STAGE` | LOW | `SKILL.md`, `references/ci-and-gist-setup.md` | Instructional `/tmp/figma-export*.json` staging in the sync/verify and Gist-setup command examples — documentation, not skill-side file staging. |

### eleventy-nunjucks

| Finding | Severity | File(s) | Explanation |
|---------|----------|---------|-------------|
| `R005_SECRET_READ` | HIGH/medium | `references/build-pipeline.md`, `references/data-cascade.md`, `references/eleventy-config-api.md`, `references/production-patterns.md`, `references/security-checklist.md`, `references/troubleshooting.md` | False positive. Triggered by instructional `grep`/`curl` snippets that teach how to audit for secrets — no credential reads. |
| `R008_ENV_ACCESS` | LOW | `references/data-cascade.md`, `references/eleventy-config-api.md`, `references/production-patterns.md` | Documented `process.env` usage in Eleventy config and build examples. |

### localhost-screenshots

| Finding | Severity | File(s) | Explanation |
|---------|----------|---------|-------------|
| `R005_SECRET_READ` | HIGH/medium | `references/playwright-patterns.md` | False positive. The Persistent Browser Sessions example references `process.env.HOME` / `USERPROFILE` to compute a `~/.cache/localhost-screenshots/` profile directory — no credentials or secrets are read; the path stores browser cookies/localStorage for multi-step screenshot workflows. |
| `R005_SECRET_READ` | HIGH/medium | `references/interaction-templates.md` | False positive. The Auth → Dashboard template reads `process.env.DEMO_USER` / `DEMO_PASS` as an example of sourcing demo-environment credentials from the environment instead of hardcoding them — this is the secure pattern guardskills R005 is intended to encourage. |
| `R008_ENV_ACCESS` | LOW | `references/playwright-patterns.md` | Code examples reference `process.env.HOME` / `USERPROFILE` for the optional persistent-session browser-profile directory used in multi-step screenshot workflows. |
| `R008_ENV_ACCESS` | LOW | `references/visual-regression.md` | Code examples reference environment variables (`PORT`, etc.) in the CI workflow snippet. |
| `R008_ENV_ACCESS` | LOW | `references/interaction-templates.md` | Login-flow template reads `process.env.DEMO_USER` / `DEMO_PASS` so example credentials live in the environment rather than being hardcoded. |

**Resolved in 3.3.0** — the following 3.2.0 findings are no longer flagged:

- `COMMAND_EXECUTION` (HIGH) — `sudo npx playwright install-deps` removed; `node -e "require('playwright')"` checks replaced with an explicit `playwright@1.58.2` install before browser setup; stdin `node -e "…"` templates moved to versioned `assets/scripts/*.js`.
- `PROMPT_INJECTION` (HIGH) — captured page content (ARIA snapshot, DOM snapshot, interactive map) is now wrapped in an `{ boundary: "untrusted-page-content", source, … }` envelope, with an explicit boundary section in `SKILL.md`.
- `R009_FILE_STAGE` — the `/tmp/chrome-debug` CDP example was removed; no temp-file staging strings remain.

## Known Non-Issues

Audit cycles have repeatedly raised the items below as concerns; each has been investigated and determined to be a non-issue for this codebase. Documenting them here to preempt future re-raises.

| Concern | Why it isn't an issue here |
|---|---|
| **Symlinks inside a skill bundle could be malicious** (e.g., `references/docs.md` symlinked to `/etc/passwd`) | The installer calls [`writeFile()`](bin/install.mjs) for every downloaded file, never `symlink()`. A symlink in the source repo arrives via `raw.githubusercontent.com` as a regular blob containing the link-target string. The user gets a regular file with the literal path inside — never an actual symlink. No code path in `installSkill()` constructs symlinks. |
| **Hash comparison is not timing-safe (`===`)** | Constant-time comparison matters when an attacker can probe the comparison via timing (e.g., remote authentication oracles). Here, the comparison is between a locally-computed SHA-256 and a locally-cached lockfile value — no remote oracle exists, no probe vector. Standard string equality is correct. |
| **Dependabot PRs skip branch-protection-drift verification** | The workflow has an intentional carve-out at [`branch-protection-drift.yml`](.github/workflows/branch-protection-drift.yml) when `github.actor == "dependabot[bot]"` because Dependabot has a separate secret store and can't see `BRANCH_PROTECTION_TOKEN`. Threat assessment: Dependabot has no write access to branch-protection settings, and the daily cron run (with the regular secret) catches any drift within 24 hours regardless of PR cadence. The skip is a usability tradeoff with no real security impact. If you want the check on Dependabot PRs anyway, add the secret to Settings → Secrets and variables → Dependabot. |
| **`SKIP_BIN_TAG_PARITY=1` env var bypasses the bin/tag-parity guard** | Documented bypass at [`check-bin-tag-parity.sh:24`](.github/scripts/check-bin-tag-parity.sh) for emergency hotfix / republish-after-unpublish scenarios. **Boundary: this is local-only.** The CI publish workflow (`npm-publish.yml`) runs the script directly via `bash .github/scripts/check-bin-tag-parity.sh` and does NOT propagate environment variables from outside; an attacker would need write access to the workflow file itself to exploit this from CI. Since the OIDC Trusted Publisher binding is keyed on this exact workflow file path, modifying the workflow breaks publish auth. The bypass therefore only helps a maintainer running `npm publish` locally — a path that requires admin + valid npm credentials independently. |

## Security Scanning

Run security scans locally:

```bash
# guardskills (skill-specific; pinned to CI version)
npx guardskills@1.2.1 add t4sh/skills4sh --skill agent-memory --dry-run
npx guardskills@1.2.1 add t4sh/skills4sh --skill code-to-figma --dry-run --force
npx guardskills@1.2.1 add t4sh/skills4sh --skill discord-harvest --dry-run
npx guardskills@1.2.1 add t4sh/skills4sh --skill eleventy-nunjucks --dry-run --force
npx guardskills@1.2.1 add t4sh/skills4sh --skill figma-to-code --dry-run
npx guardskills@1.2.1 add t4sh/skills4sh --skill localhost-screenshots --dry-run
npx guardskills@1.2.1 add t4sh/skills4sh --skill skill-architect --dry-run

# Local scan-local (any skill folder, useful before or after pushing):
# npx guardskills scan-local skills/<name> --json

# Verify content hashes (includes references/ subdirectory)
for skill in agent-memory code-to-figma discord-harvest eleventy-nunjucks figma-to-code localhost-screenshots skill-architect; do
  echo "=== $skill ==="
  find "skills/$skill" -type f -not -name '.DS_Store' | sort | while read -r f; do
    relpath="${f#skills/$skill/}"
    echo "  $relpath: $(shasum -a 256 "$f" | cut -d' ' -f1)"
  done
done
```
