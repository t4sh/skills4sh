# Changelog

All notable changes to **skills4sh** are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Per-skill versions evolve independently from the package version. See [SECURITY.md](SECURITY.md) for supported versions.

## [Unreleased]

## [0.4.11] — 2026-06-13

### Added
- Added a mandatory PR skill-audit packet for skill and skill-standard changes, requiring evidence-first review, standard-derived checklist attestation, and mechanical checks for objective rules.

### Changed
- Refined all bundled skills from the full review pass without changing their runtime dependencies: agent-memory 2.7.3, code-to-figma 0.1.3, discord-harvest 1.7.4, eleventy-nunjucks 0.1.4, figma-to-code 0.1.4, and localhost-screenshots 3.3.3.
- Updated package and plugin metadata to 0.4.11.


### Added
- GitHub issue forms for bug reports, feature requests, suggestions, and questions, each requiring the affected skill, plugin, or general repository area.
- Folder-local MIT `LICENSE` files for every skill and plugin so individually installed bundles carry their license text.

### Changed
- PR template now requires a `feature/`, `fix/`, `docs/`, `chore/`, or `update/` category, affected-area selection, and explicit mandatory-check reporting for all PRs.
- Contributor guidance now documents issue form usage, PR categories, and package/payload verification expectations.
- Package metadata bumped to 0.4.9 and skill bundle patch versions bumped for the per-folder license inclusion.
- **`eleventy-nunjucks` 0.1.1** constrains third-party fetch examples: build data now prefers checked-in/generated JSON, async filters are documented as local/deterministic only, and upstream-doc lookup is framed as constrained official-doc reference material.

## [0.4.7] — 2026-05-12

Closes 6 internal code-review findings, including one critical safety bug that defeated the v0.4.6 size cap. **No breaking change for normal users.**

### Security (Critical)
- **Size cap is now stream-enforced**, not buffer-enforced. v0.4.6's `fetchRaw` advertised a 50 MiB per-file size cap but actually called `await res.arrayBuffer()` BEFORE checking the buffer length — an attacker-controlled server (the threat model the cap was supposed to defend against) could send a body without Content-Length or with a deliberately small/false Content-Length and OOM the process before any check fired. v0.4.7 uses `res.body.getReader()` with a running byte counter that aborts the stream as soon as the cap is exceeded, even on chunked-encoded responses with no Content-Length header. The Content-Length check is kept as an upfront optimization (rejects without ever opening the stream) but is no longer the only line of defense.

### Changed
- **YAML block-scalar `reason:` fields now supported.** `parseExpectedFindings` correctly parses literal (`|`), folded (`>`), and chomping (`|-` / `>-`) styles. Multi-line rationale text is captured fully (was being silently truncated to the marker `"|"` or `">"` itself, which would then fail `validateAcknowledgedReasons` with a confusing 1-character-reason error). Current bundled manifests all use single-line scalars; this just removes the footgun for future skills.
- **`--version` is now strict — must be the sole argument.** Pre-v0.4.7 `skills4sh --skill foo --version` silently exited 0 with just the version, never installing. Now combining `--version` (or `-v`) with any other argument is rejected with `unknown argument: --version`. The standalone form (`skills4sh --version`) still works.

### Documentation
- **`BRANCH_PROTECTION.md` recovery escape hatch documented.** Now that `enforce_admins: true` blocks all admin direct pushes to main, a broken-required-check scenario could lock the maintainer out. Documents the temporary-disable / push-fix / re-enable cycle via `gh api`.
- **`--help` describes the v0.4.6 dry-run/verify behavior** — `--dry-run` now fetches the lockfile (one extra network call per dry-run). Worth knowing for users near GitHub API rate limits.

### Tests
- 153 → **161** (+8): streaming-abort, block-scalar parsing (5 cases), strict `--version` (2 cases).

## [0.4.6] — 2026-05-12

Closes the remaining fresh-audit polish items, plus four cosmetic / documentation fixes the auditor surfaced. No breaking change for normal install/list flows; **`skills4sh` against a repo without `skills-lock.json` now requires explicit `--no-verify`** (closes the silent-lockfile-removal downgrade attack).

### Security
- **Missing `skills-lock.json` is now a hard error.** Pre-v0.4.6 silently skipped verification with a warning if a repo had no lockfile. That was a downgrade-attack vector — an attacker who could push a malicious commit removing the lockfile would silently disable hash verification on the next install of that ref. New behavior: missing lockfile is an error with a directed message explaining the fix (`--no-verify` for repos that genuinely don't have one, or fix the source repo).
- **Per-file 50 MiB size cap on downloads.** `fetchRaw` now checks `Content-Length` headers before reading the body and the actual buffer length after. Refuses downloads exceeding the cap with a `413`-style error. Defensive against `--repo` installs pointed at attacker-controlled sources; current bundled skills are hash-pinned so they can't grow silently anyway.
- **`acknowledged: true` expected_findings now require a non-empty `reason:`.** New `validateAcknowledgedReasons()` exported from `bin/lib/parsers.mjs`, wired into `drift-check` per skill. Minimum reason length is 20 characters — enough to rule out rubber-stamping like `"false positive"` without explanation, lenient enough to accept normal rationale.

### Added
- **`--version` / `-v` flag** — prints version to stdout and exits 0. Standard CLI affordance for scripted tooling.

### Changed
- **Dry-run runs verification too.** Pre-v0.4.6 dry-run returned BEFORE `verifyAgainstLock()`, so `skills4sh --dry-run` against a repo with a missing lockfile would falsely report "would install" — a real install would fail. Verification now runs first; dry-run output reflects what a real install would actually do.
- **Parse-error output is quieter** — no more dumping the full help text on every unknown-flag error. Just the error + one-line hint (`Run \`skills4sh --help\` for usage.`). Less noise in CI logs.
- **Dry-run error path emits JSON envelope on stdout** — `{ schemaVersion: 1, command, dryRun: true, error: { message, code, status } }`. Tooling that parses dry-run JSON keeps getting parseable output even on failure paths. Human-facing error still goes to stderr.
- **Hash-verification log moved to stderr** — was `console.log`, now `console.error`. Status message, not output. Critical for `--dry-run` where stdout must contain only the JSON envelope.

### Documentation
- **`SECURITY.md` "Known Non-Issues" section.** Documents four concerns audit cycles repeatedly raise that don't apply to this codebase: (a) symlinks inside skill bundles can't smuggle real symlinks because `installSkill` only uses `writeFile()`, (b) hash comparison is not timing-safe by design (no remote oracle), (c) Dependabot drift-check skip is an accepted tradeoff with no real impact (daily cron catches drift independently), (d) `SKIP_BIN_TAG_PARITY=1` is local-publish-only — CI runs the script directly and OIDC binding is keyed to the workflow file.
- **`CHANGELOG.md`** historical fix — v0.3.10 entry said "6 workflow files" but the actual count was 7 (branch-protection-drift.yml was added in the same release).

### Tests
- 138 → **153** (+15 covering reason validation, `--version`, parse-error quietness, dry-run error envelope, lockfile-404 hard error, lockfile-404 + `--no-verify` opt-in, oversized-file cap).

## [0.4.5] — 2026-05-12

Closes six fresh-eyes audit findings in a single release. Four CLI safety + UX fixes, two test-coverage fills. **No breaking change for normal install/list flows**; the `remove --all` path now requires explicit `--yes` confirmation (was previously silent destructive bulk).

### Added (CLI safety + UX)
- **`remove --all` requires `--yes`.** Destructive bulk op was previously silent. Without `--yes` it now exits 1 with a directed error: `remove --all requires explicit confirmation. Re-run with --yes:` …
- **`--force` in `remove` is now meaningfully implemented** (was previously documented as "NOT IMPLEMENTED"). Two real uses:
  1. Remove a half-installed directory missing its SKILL.md gate (was the only escape hatch).
  2. With a symlink path, unlinks the symlink itself WITHOUT following it (target preserved).
  3. Cannot be combined with `--all` — bulk + force defeats the safety net; rejected at `removeMain` before any iteration.
- **Symlink-safe remove.** `removeSkill` now uses `lstat` to detect symlinks BEFORE following. Default behavior: refuse with directed error. With `--force`: unlink the symlink only — never follow it. Closes a class of "user has `~/.claude/skills/foo` symlinked elsewhere; bulk rm follows the link" scenarios.
- **Versioned `--dry-run` output schema** for both install and remove. Output now wraps in `{ schemaVersion: 1, command: "install"|"remove", dryRun: true, ... }`. Downstream tooling that parses dry-run JSON now has a stable contract; future field additions don't silently break parsers.

### Added (test coverage — fills the "verifiers verified" gap)
- **`bin/drift-check.mjs` is now importable** as `runDriftChecks(rootDir)`. CLI invocation still works as before (top-level call against `process.cwd()`); tests can now exercise the full check pipeline against fixture repos in tmpdirs without spawning subprocesses.
- **`tests/drift-check.test.mjs` (new, 12 tests)** — fixture-based e2e coverage of the drift checker. Builds a complete fixture repo (skills/, .security/, lockfile, README, AGENTS, SECURITY, plugin manifests) and exercises: clean baseline, hash mismatch, version mismatch, missing skill rows, schema-invalid manifest (bad enum value), broken markdown link, anchored link, external URL, code-fenced link, and link escaping skill dir.
- **Markdown-link validation** (item 6) added to drift-check. Every relative-path link in a `*.md` file under each skill must resolve to a file in the skill's inventory. External URLs / `mailto:` / `#anchor`-only / code-fenced links are correctly excluded. Links escaping the skill directory (`../../etc/passwd`) are rejected. The current four bundled skills all pass.

### Stats
- Test count: 118 → **138** (+20: 13 for items 1-4, 12 for items 5-6, minus 5 reorganized).
- No public CLI API breakage for install/list. `remove --all` now requires `--yes` (was silent before; arguably the prior behavior was a bug — the destructive op had no confirmation gate).

## [0.4.4] — 2026-05-12

### Fixed
- **`bin/clean-package-for-publish.mjs`: scripts now stripped from npm registry metadata too, not just the tarball.** v0.4.3's postpack restored `package.json` BEFORE `npm publish` constructed the registry metadata POSTed to npm. Result: tarball was clean (consumer install path was correct), but `npm view skills4sh@0.4.3 scripts` and `https://registry.npmjs.org/skills4sh/0.4.3` still exposed the dev scripts. v0.4.3 verified the audit's consumer-install concern (tarball clean) but missed the metadata-exposure half.

   New behavior: `postpack` checks `process.env.npm_command` — if it's `"publish"`, restore is deferred to a new `postpublish` hook that runs *after* the registry metadata is sent. For plain `npm pack`, `postpack` restores as before (no publish follows). 5 new unit tests pin this distinction (full publish simulation, pack-only path, mixed cases).

   After this fix:
   ```bash
   curl -sL https://registry.npmjs.org/skills4sh/0.4.4 | jq .scripts  # → null
   ```

## [0.4.3] — 2026-05-12

Closes three parallel-audit findings. No public CLI surface change.

### Fixed
- **`bin/install.mjs`: SIGINT/SIGTERM cleanup no longer deletes the backup mid-update.** v0.4.2's cleanup handler unconditionally `rm`s both `stagingDir` and `backupDir`. If a signal arrived during the narrow "backed-up" window (after the old skill was moved aside to `backupDir`, before `stagingDir` was renamed into place), the backup — the only intact copy of the user's old skill — would be destroyed.

   New behavior: cleanup is state-aware via a pure `interruptCleanupPlan(state)` function. In the `backed-up` state it *restores* from backup rather than deleting. The backup is only deleted after promotion succeeds (state = `promoted`). Invariant pinned by 4 new unit tests in `tests/installer.test.mjs`.

- **Published `package.json` no longer exposes dev scripts whose target files aren't in the tarball.** Previously `npm view skills4sh@0.4.2 scripts` listed `test`, `check:drift`, `check:guardskills`, `check:pack`, `check:release`, `setup:hooks`, `prepublishOnly` — all of which reference `bin/*-check.mjs`, `tests/`, or `.github/scripts/` that aren't shipped in the tarball. A consumer who ran `npm run check:drift` after installing would hit "module not found."

   New behavior: `bin/clean-package-for-publish.mjs` runs as `prepack` (strips `scripts` from `package.json`, backs up to `package.json.prepack.bak`) and as `postpack` (restores from backup). `bin/pack-check.mjs` now asserts the published `package.json` has no `scripts` field, preventing a misconfigured hook from silently shipping a dirty manifest. 8 new tests in `tests/clean-package-for-publish.test.mjs` cover both halves of the cycle (including the recovery-from-stale-`.bak` case).

- **`.github/workflows/branch-protection-drift.yml` no longer exits 0 when `BRANCH_PROTECTION_TOKEN` is absent.** Once this workflow became a required-status-check (post-v0.4.2), the skip-on-no-secret path turned into a bypass vector: anyone with permission to delete repo secrets could disable the drift control while keeping green CI. New behavior: hard fail when secret absent, with the one carve-out for Dependabot-triggered runs (Dependabot has a separate secret store and can't see regular repo secrets; skipping there keeps action-upgrade PRs unblocked without leaving a generic bypass open).

### Added
- `bin/clean-package-for-publish.mjs` — prepack/postpack helper. Idempotent; logs to stderr so `npm pack --json` output isn't polluted.
- `interruptCleanupPlan(state)` exported from `bin/install.mjs` so the state-machine invariant is unit-tested.
- 12 new tests (101 → 113 total).

## [0.4.2] — 2026-05-12

Tooling-hardening pack. Closes the meta-verification gap surfaced by the fresh-eyes audit and adds robustness around the installer's failure modes. No public CLI surface change beyond the new `npm test` script.

### Added
- **`bin/lib/parsers.mjs`** — pure helpers (parsers, semver, schema validators) shared between `drift-check.mjs` and `guardskills-check.mjs`, now testable in isolation.
- **Hand-rolled schema validation for `.security/<name>.yaml`** in `validateSecurityManifest()`. Validates presence of all required blocks (skill, integrity, permissions, execution_context), enforces enum constraints (`risk_tier`, `network`, `filesystem`, `shell`, `hash_algorithm: sha256`), and requires `SKILL.md` in `integrity.files`. Zero new npm dependencies — consistent with the package's no-runtime-deps posture.
- **42 unit tests for `bin/lib/parsers.mjs`** (`tests/parsers.test.mjs`) — covering `compareSemver`, `parseSkillFrontmatter`, `parseSecurityManifest`, `validateSecurityManifest`, `parseExpectedFindings`, and `findUnacknowledgedBlocking` (guardskills severity-floor logic). Total test count now 100 (53 installer + 6 integration + 42 parsers, minus 1 reclassified).
- **`npm test` script** — `node --test tests/*.test.mjs`. Closes the drift where CONTRIBUTING.md referenced `npm test` but `package.json` had no such script.

### Security / Robustness
- **Installer staging directory uses crypto-random suffix** instead of `process.pid`. Two concurrent invocations on the same destination (rare but possible in containers / re-execed wrappers) no longer collide. `bin/install.mjs` now uses `randomBytes(6).toString("hex")`.
- **SIGINT / SIGTERM cleanup handler** registered around the staging dir for the duration of each `installSkill` call. An interrupt mid-download no longer leaks `.tmp-*` orphans.
- **Rollback-safe install (backup → rename → restore-on-fail).** Previously, the installer did `rm(skillDir)` *then* `rename(stagingDir, skillDir)` — if the rename failed after the rm, the previous skill was gone with no recovery. New flow: rename existing skill to `.backup-<random>`, rename staging into place, remove backup on success. On any failure, restore the backup automatically; if restore also fails, the error message surfaces both paths so the user can recover manually.
- **GitHub branch protection enforces signed commits at the branch level.** `required_signatures: true` is now live on `refs/heads/main`; complements the existing release-time commit-signature verification in `bin/release-check.mjs`. The snapshot at `.github/branch-protection.expected.json` is updated to match.
- **`branch-protection-drift.yml` trigger changed to run on every PR** (no path filter), so it can serve as a required branch-protection context. The skip-on-no-secret behavior keeps it cheap (~5s) for PRs when no PAT is configured.

### Changed
- `bin/drift-check.mjs` and `bin/guardskills-check.mjs` now import from `bin/lib/parsers.mjs` instead of inlining the parsers. Behavior is unchanged; the refactor exists so the helpers are unit-testable.
- `bin/drift-check.mjs` now invokes `validateSecurityManifest()` for each skill — any `.security/*.yaml` missing a required field, with an invalid enum value, or lacking a `SKILL.md` hash will fail the drift check loudly.

### Pending maintainer action (one-click in GH UI)
- Add `assert protection matches .github/branch-protection.expected.json` to the required-status-checks list at Settings → Branches → Edit rule for `main`. (The check itself runs and asserts no drift on every PR after this release; only the *required* gate needs to be set in the UI. The sandbox blocked me from doing this via API.)

## [0.4.1] — 2026-05-11

### Security
- **`bin/release-check.mjs` now also verifies the release commit's signature** (in addition to the tag's). The tag-signature check that's been in place since v0.3.0 attests "this tag was created by the maintainer"; the new commit-signature check attests "the *source code* shipped at this tag was committed by the maintainer." Tag and commit signatures are independent in git (`tag.gpgsign` and `commit.gpgsign` are separate config keys), so both must hold to close the lock-file integrity gap from the external audit (Tier 1c). Closes the audit-flagged "lock file not separately signed" concern via the existing signing chain rather than introducing a new signing mechanism.
- **`SECURITY.md` AST02 — release-integrity chain documented in full.** New subsection enumerates the four-link consumer-verifiable chain: signed commit → signed tag pointing at that commit → SLSA-attested tarball produced by GitHub Actions OIDC from that commit → registry `gitHead` recording the same commit SHA. Acknowledges single-maintainer as the residual architectural risk (flagged for v1.0+ governance).

### Changed
- All GitHub Actions bumped to latest majors via Dependabot PR #1: `actions/checkout` v4.3.1 → v6.0.2; `actions/setup-node` v4.4.0 → v6.4.0; `actions/setup-python` v5.6.0 → v6.2.0; `github/codeql-action` v3 → v4.35.4; `actions/dependency-review-action` v4.9.0 → v5.0.0. All checks passed on the rebased PR before merge.

## [0.4.0] — 2026-05-11

### Added
- **`skills4sh remove` uninstall command.** Completes the installer lifecycle (previously users had to `rm -rf ~/.claude/skills/<name>` manually). Three forms:
  ```bash
  skills4sh remove <name>             # uninstall a single skill from --dest
  skills4sh remove --all              # uninstall every installed skill from --dest
  skills4sh remove <name> --dry-run   # print what would be deleted, no disk write
  ```
  Pure-local — never makes a GitHub fetch and never needs `GITHUB_TOKEN`.

  **Safety: only directories under `--dest` that contain a `SKILL.md` are eligible for removal.** Sibling files, unrelated directories, and anything without a `SKILL.md` are left untouched. Refuses destructive ops on misconfigured paths — the user must `rm` manually if they really need to delete something outside this contract.

  Closes Tier-2 #6 from the external audit (lifecycle UX gap).

### Changed
- README install section gains an "Uninstall" subsection with the three command forms.

### Bumped
- `0.3.11` → `0.4.0`. Minor bump because new public CLI surface (`remove` subcommand). Installer code is otherwise unchanged from v0.3.11; existing install/list flows behave identically.

## [0.3.11] — 2026-05-11

### Changed
- **`discord-harvest` 1.7.0 → 1.7.1.** Added a top-line **Trust Boundary — Read Before Running** section immediately after Installation and before "What I Can Help With". Surfaces the previously-implicit fact that the skill archives untrusted Discord content (filenames, embed titles, message text from arbitrary, sometimes-adversarial users) and enumerates the specific defenses already in place: fixed operation set with no instruction-following, `flag_suspicious()` social-engineering detection, no message text persisted, CDN allowlist on downloads (no third-party URL fetching), filename sanitization against path traversal. Code-level behavior is unchanged from 1.7.0 — this is a documentation/expectation-setting change addressing a third-party audit recommendation.

## [0.3.10] — 2026-05-11

### Security
- **All GitHub Actions are now SHA-pinned.** Every `uses:` directive across the 7 workflow files references a commit SHA (`actions/checkout@34e114876…`) with a `# vX.Y.Z` comment for human readability. Floating major tags (`@v4`) reflect whatever upstream pushes to that ref; an upstream account compromise would land on every CI run on the next refresh — the same class of attack as the tj-actions/changed-files 2025 incident. Pinning to SHAs freezes that surface; Dependabot moves it forward under review.
- **`.github/dependabot.yml` added** for the `github-actions` ecosystem. Weekly grouped PRs, batched so a single security gate covers the batch. Each PR hits the full required-checks matrix (validate, guardskills, codeql, dependency-review, release-guards) before merge.
- **Branch-protection drift detection (opt-in).** New workflow `.github/workflows/branch-protection-drift.yml` plus checked-in snapshot `.github/branch-protection.expected.json` capture the intended `refs/heads/main` protection state (14 required status checks, strict mode, linear history, no force-push, no deletion, conversation resolution required). The workflow is inert by default — the default `GITHUB_TOKEN` does not support `Administration: read`. Setting a `BRANCH_PROTECTION_TOKEN` repo secret (fine-grained PAT scoped to this repo, `Administration: Read-only`) enables the daily drift assertion. Without the secret the workflow logs the setup recipe and exits cleanly.

### Changed
- `.github/workflows/npm-publish.yml` — runner upgraded from Node 22 (npm 10.9) to Node 24 (npm 11.x) in the prior unreleased period. Captured here for completeness.
- `SECURITY.md` — AST08 row updated to reflect OIDC Trusted Publisher + SHA-pinning. AST09 row updated to reference the new branch-protection drift control.

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

[Unreleased]: https://github.com/t4sh/skills4sh/compare/v0.4.7...HEAD
[0.4.7]: https://github.com/t4sh/skills4sh/compare/v0.4.6...v0.4.7
[0.4.6]: https://github.com/t4sh/skills4sh/compare/v0.4.5...v0.4.6
[0.4.5]: https://github.com/t4sh/skills4sh/compare/v0.4.4...v0.4.5
[0.4.4]: https://github.com/t4sh/skills4sh/compare/v0.4.3...v0.4.4
[0.4.3]: https://github.com/t4sh/skills4sh/compare/v0.4.2...v0.4.3
[0.4.2]: https://github.com/t4sh/skills4sh/compare/v0.4.1...v0.4.2
[0.4.1]: https://github.com/t4sh/skills4sh/compare/v0.4.0...v0.4.1
[0.4.0]: https://github.com/t4sh/skills4sh/compare/v0.3.11...v0.4.0
[0.3.11]: https://github.com/t4sh/skills4sh/compare/v0.3.10...v0.3.11
[0.3.10]: https://github.com/t4sh/skills4sh/compare/v0.3.9...v0.3.10
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
