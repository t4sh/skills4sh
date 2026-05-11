# Changelog

All notable changes to **skills4sh** are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Per-skill versions evolve independently from the package version. See [SECURITY.md](SECURITY.md) for supported versions.

## [Unreleased]

### Changed
- `.github/workflows/npm-publish.yml` — runner upgraded from Node 22 (npm 10.9) to Node 24 (npm 11.x). Discovered during the v0.3.9 OIDC migration: npm 10 signs SLSA provenance via OIDC but does not authenticate the registry `PUT` via OIDC, falling back to `_authToken` which is absent under Trusted Publisher (registry returns 404). npm 11.5+ added OIDC publish-auth. Node 24 ships with npm 11 natively, avoiding the npm 10→11 in-place self-upgrade failure mode (`MODULE_NOT_FOUND: 'promise-retry'`). `engines.node` and consumer compatibility are unchanged.
- `SECURITY.md` — `AST08 → npm provenance` row rewritten to reflect OIDC Trusted Publisher as the auth path. Documents the npm ≥ 11.5 / Node 24 runner requirement, the npmjs.com binding fields, and that no `NPM_TOKEN` secret exists.

### Removed
- `NPM_TOKEN` repo secret. No publish secret remains; nothing to rotate, nothing to leak.

## [0.3.9] — 2026-05-11

### Security
- **npm publish auth migrated to OIDC Trusted Publisher.** `npm-publish.yml` no longer references `NPM_TOKEN` / `NODE_AUTH_TOKEN`; the GitHub Actions OIDC token authenticates the publish against the Trusted Publisher binding configured on npmjs.com (Repository: `t4sh/skills4sh`, Workflow: `npm-publish.yml`). The same token signs the provenance attestation. **There is no long-lived publish secret to rotate or leak.** Previous token-based flow (v0.3.0 — v0.3.8) is superseded.

### Fixed
- **`validate.yml` shallow clone bypassed the v0.3.8 semver monotonicity check.** `actions/checkout@v4` defaults to `fetch-depth: 1`, which hides `HEAD^` from `bin/drift-check.mjs`'s `git show` call — the check was silently skipping in CI on push events. Set `fetch-depth: 2` so the previous-commit comparison runs in CI as designed.

## [0.3.8] — 2026-05-11

### Added
- `CONTRIBUTING.md` documenting the skill-authoring workflow (frontmatter contract, seven-place version-sync surface, `.security/<name>.yaml` manifest schema, hook setup, PR expectations).
- `CHANGELOG.md` (this file) — reconstructed from git history; reflects per-tag release notes.
- `bin/install.mjs`: explicit stderr deprecation warning when `--force` is passed; flag remains a no-op (re-runs are idempotent by content hash). To be removed in v1.0.
- `bin/guardskills-check.mjs`: default-deny severity floor — HIGH and CRITICAL findings require an explicit `acknowledged: true` field on the corresponding `.security/<name>.yaml` `expected_findings` entry. Closes a third-party audit gap where a real HIGH finding could be silenced by pre-declaration.
- `bin/drift-check.mjs`: semver monotonicity check — SKILL.md `metadata.version` may not decrease between commits. Compares against `HEAD^` via `git show`; skips gracefully when previous version is not available (initial commit, shallow clone).
- `README.md`: stability note flagging `eleventy-nunjucks` as pre-1.0.

### Changed
- `.security/eleventy-nunjucks.yaml`: 6 HIGH-severity `expected_findings` entries now carry `acknowledged: true` (no behavior change; explicit acknowledgement per new severity-floor policy).
- `.security/localhost-screenshots.yaml`: 2 HIGH-severity `expected_findings` entries now carry `acknowledged: true`.
- `package.json#files` now includes `CHANGELOG.md`.

## [0.3.7] — 2026-05-11

### Security
- `localhost-screenshots` 3.3.0 — cleared Agent Trust Hub HIGH findings:
  - Removed `sudo npx playwright install-deps`; replaced `node -e "…"` existence check with `test -d node_modules/playwright`.
  - Added an `Untrusted Content Boundary` section to SKILL.md; bundled `assets/scripts/screenshot-a11y.js` enforces `{ boundary: 'untrusted-page-content', source, … }` envelope on accessibility-tree, DOM, and interactive-map captures.
  - Documented `npm ci` + lockfile pinning; gated `ignoreHTTPSErrors` to localhost-only hostnames.

## [0.3.6] — 2026-05-11

### Fixed
- CI: restored validate workflow and made the guardskills PR matrix always-on.
- CI: dropped pull-request path filters on validate + release-guards so guards always run, regardless of which paths a PR touches.
- First release commit verified by GitHub as signed.

## [0.3.5] — 2026-05-11

### Changed
- CI: avoid misleading completeness success output in `release.yml`.
- Hardened the v0.3.5 publish gates and tightened pre-publish guards.

### Added
- `tests/integration.test.mjs` — fixture-backed installer integration coverage (rate limit, hash mismatch, atomic install preservation, dry-run, real `npm pack` + install).

### Docs
- README: clarified install paths and security posture.

## [0.3.4] — 2026-05-11

### Changed
- Trimmed the published tarball (`package.json#files`) to only what consumers need.
- Made `.githooks` wiring opt-in via `bin/setup-hooks.sh` — the `prepare` script no longer mutates downstream consumers' `.git/config`.

## [0.3.3] — 2026-05-11

### Changed
- CI: migrated `npm-publish.yml` to OIDC Trusted Publisher; fixed `verify-published.mjs` step.

### Docs
- Documented the OIDC publish posture in SECURITY.md.

### Note
- First version published via OIDC Trusted Publisher.

## [0.3.2] — 2026-05-11

### Fixed
- Silent-bin bug when invoked via the npm-installed symlink at `node_modules/.bin/skills4sh`. The CLI guard now resolves the symlink with `realpathSync` before comparing against `import.meta.url`; otherwise the entry-point check fails and the CLI prints nothing.

## [0.3.1] — 2026-05-11

### Security
- Supply-chain hardening (no API changes):
  - Switched `package-lock.json` → `npm-shrinkwrap.json` so transitive dependencies (undici) ship locked.
  - Added `npm-publish.yml` with OIDC provenance + SLSA v1 attestation.
  - Pinned `guardskills@1.2.1`; allowlisted documented false positives.
  - Aligned and hardened SECURITY.md (AST10 mapping).
  - Added pre-commit `hash-check.mjs` hook in `.githooks/pre-commit`.
  - Added `release.yml` to replicate the `prepublishOnly` check in CI on tag push.

### Added
- 46 installer unit tests (`tests/installer.test.mjs`); main-guard refactor on `bin/install.mjs` so tests can import pure functions without running the CLI.

### Docs
- README: aligned install-path claim with `bin/install.mjs` `DEFAULT_DEST` (`~/.claude/skills`).

## [0.3.0] — 2026-05-11

### Added
- `eleventy-nunjucks` skill (initial v0.1.0).
- `bin/tag-parity` guard (`.github/scripts/check-bin-tag-parity.sh`) — refuses to publish if `bin/` diverges from the tag for the version in `package.json`. Motivated by an actual v0.2.0 incident where the tarball's `bin/` did not match its tag.

## [0.2.0] — 2026-04-19

### Added
- CI: enforce version parity between `package.json`, `.claude-plugin/marketplace.json`, and `.cursor-plugin/plugin.json` via `verify-versions.sh`.

## [0.1.1] — 2026-04-19

### Added
- Initial public release of the `skills4sh` package.

[Unreleased]: https://github.com/t4sh/skills4sh/compare/v0.3.9...HEAD
[0.3.9]: https://github.com/t4sh/skills4sh/compare/v0.3.8...v0.3.9
[0.3.8]: https://github.com/t4sh/skills4sh/compare/v0.3.7...v0.3.8
[0.3.7]: https://github.com/t4sh/skills4sh/compare/v0.3.6...v0.3.7
[0.3.6]: https://github.com/t4sh/skills4sh/compare/v0.3.5...v0.3.6
[0.3.5]: https://github.com/t4sh/skills4sh/compare/v0.3.4...v0.3.5
[0.3.4]: https://github.com/t4sh/skills4sh/compare/v0.3.3...v0.3.4
[0.3.3]: https://github.com/t4sh/skills4sh/compare/v0.3.2...v0.3.3
[0.3.2]: https://github.com/t4sh/skills4sh/compare/v0.3.1...v0.3.2
[0.3.1]: https://github.com/t4sh/skills4sh/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/t4sh/skills4sh/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/t4sh/skills4sh/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/t4sh/skills4sh/releases/tag/v0.1.1
