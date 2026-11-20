---
id: context/v080-post-release-audit-todo
type: context
title: "Pending repository work and deferred decisions after the 0.8.0 audit"
description: >-
  Open defects, verification gaps, maintenance work and deferred decisions for skills4sh,
  with closure criteria, source records and the disposition of older notes.
tags: [todo, audit, skills, verification, release, governance]
source: codex
created: 2026-11-21
updated: 2026-11-21
status: active
expires: 2026-12-21
---

The 2026-11-21 audit checked the published `v0.8.0` package against `main` after PR #63. All 78 skill files matched, all six installer hashes verified, and 542 tests passed with zero skips. The fixtures below exposed gaps in that coverage.

Mark an item complete here when its fix, verification result or maintainer decision has a durable reference. The review date applies to the inventory. Items with a release milestone can remain open beyond it.

## Workflows that can report success after failure

- [ ] **P1 · Screenshot comparison in CI.** An unreadable capture directory made `compare.js` exit 1 without writing a report. The example workflow converted that exit to a warning and succeeded. Handle input enumeration errors as exit 2. Verify that the CI example fails for an unreadable directory or a missing or stale report, and warns only for a fresh, complete comparison with visual differences. [Comparator](../../skills/localhost-screenshots/assets/scripts/compare.js) · [CI example](../../skills/localhost-screenshots/references/visual-regression.md)
- [ ] **P2 · Host-browser HTTP errors.** A local 404 in Chrome passed both URL checks and produced an 800×600 PNG. Require the expected main-document status when available. When the host cannot report it, verify a page-specific readiness signal and disclose the limitation. Exercise a normal page, an unexpected 404 and an intentionally requested error page through a live host browser tool. The existing system Chrome and script runs cover a different path. [Host-browser workflow](../../skills/localhost-screenshots/SKILL.md#host-browser-path)
- [ ] **P2 · Discord staging input.** Running the published Bash helper with a missing TSV printed a shell error, downloaded nothing and exited 0. Make failure to open the staging list return nonzero. Cover a missing list, an unreadable list and a valid list. [Download helper](../../skills/discord-harvest/references/code-examples.md#download-commands)

## Other findings from the 0.8.0 audit

- [ ] **Upstream drift tracking.** Simulated HTTP 503s left all nine pins and 90 checkable links unverified, yet the workflow would close an existing drift issue. Keep the issue open while a previously failing item is unverified. Test an outage followed by a verified recovery. [Checker](../../bin/upstream-check.mjs) · [Workflow](../../.github/workflows/upstream-drift.yml)
- [ ] **npm signature runbook.** Under npm 12.0.2, `npm audit signatures skills4sh@0.8.0` in an empty project failed because npm audits the installed dependency tree. Document and test verification in a temporary consumer project that installs the exact release with lifecycle scripts disabled, then runs `npm audit signatures`. This procedure verified the signature and provenance. Update both published instructions. [Runbook](../../docs/RELEASE_PROCESS.md#verify-npm) · [Security guide](../../SECURITY.md)
- [ ] **Eleventy deployment guidance.** The generic troubleshooting direction says “Move to nginx,” and the HTTP-header checklist calls an nginx check required. Describe the host-independent header fix first and label the nginx example as conditional. Verify that an agent reviewing a site on a different host can complete the checklist using that host’s configuration. [Troubleshooting](../../skills/eleventy-nunjucks/references/troubleshooting.md) · [Security checklist](../../skills/eleventy-nunjucks/references/security-checklist.md)
- [ ] **Memory calendar dates.** The checker rejected `--today 0099-12-31` because `Date.UTC` interprets years 0–99 as 1900–1999. Preserve the literal four-digit year. Test valid dates in years 0001 and 0099 and an impossible date in the same range. [Date validation](../../skills/agent-memory/assets/scripts/check-memory.mjs)
- [ ] **Release handoff evidence.** Correct the handoff’s claim that no fresh agents ran. Record the six repo-skill fixture runs on the feature branch and the separate native Codex startup check alongside the published-package results. Identify which revision each covered. In the startup check, two fresh Codex CLI 0.171.0 processes received the same arithmetic prompt from nested project directories. Only the project with the startup pointer returned the random label from its arithmetic rule. [Release handoff](../sessions/20261121-skills-review-v080-release.md#open-threads)

## Release tooling and repository settings

- [ ] **Registry visibility after publishing.** The 0.8.0 publish succeeded, but the verifier timed out after roughly five minutes. In the next release that changes the tooling, extend retries for transient metadata visibility, keep genuine metadata mismatches fatal, and update the runbook with the 0.8.0 incident. [Verifier](../../bin/verify-published.mjs) · [Runbook](../../docs/RELEASE_PROCESS.md) · [Release handoff](../sessions/20261121-skills-review-v080-release.md#open-threads)
- [ ] **CI and publish Python.** Both workflows use the runner’s default Python. Pin a supported interpreter or update PyYAML and its wheel hashes when a compatible 3.15 wheel is available. Verify that both workflows can build the isolated helper environment. [CI](../../.github/workflows/validate.yml) · [Publish](../../.github/workflows/npm-publish.yml) · [Pinned requirements](../../skills/skill-architect/assets/scripts/requirements.txt)
- [ ] **Repo-settings drift check.** The documented promotion to a required check is still open. Review its clean PR runs, then update the live rule and snapshot together or record a revised policy. Correct the guide’s REST description to match the GraphQL call in the workflow. [Promotion instructions](../../.github/REPO_SETTINGS.md#promoting-to-a-required-status-check) · [Workflow](../../.github/workflows/repo-settings-drift.yml)
- [ ] **Required GuardSkills coverage.** All six skills are scanned on Node 22 and 24. Only four skills have individually required scans. Decide whether the four jobs for `init-rulebook` and `skill-architect` should become required, and document the decision. This policy question comes from comparing the matrix with live protection. The guide says 19 required checks and the snapshot and live rule both listed 17 on 2026-11-21. Reconcile the count with the chosen policy. [Matrix](../../.github/workflows/guardskills.yml) · [Snapshot](../../.github/branch-protection.expected.json) · [Guide](../../.github/BRANCH_PROTECTION.md)

## Verification gaps

- [ ] **Screenshot redirect guard.** Exercise the current guard with trusted HTTPS and a real Portless route, and on Linux and Windows. Older real Portless HTTP captures passed. Portless 0.15.6 returned a 404 for a trailing-dot Host, so verify the case on the supported version before claiming compatibility. The live host-tool acceptance check is in the P2 HTTP-error item above. [Earlier Portless run](https://github.com/t4sh/skills4sh/pull/49) · [Release handoff](../sessions/20261121-skills-review-v080-release.md#open-threads)
- [ ] **Visual comparison measurements.** Measure unchanged and deliberately changed pages across machines and on more than one page. The per-pixel sensitivity was calibrated on one macOS fixture. A separate fixture detected a changed heading. Use the results for the pixel-allowance decision below. [Measurements and defaults](../../skills/localhost-screenshots/references/visual-regression.md)
- [ ] **Six skill eval catalogs.** Map recorded runs to scenario IDs and run the uncovered cases where behavioral evidence is needed. One fresh agent exercised each repo skill on the review branch, and six earlier `init-rulebook` scenarios ran at its 1.0 promotion. Codex project-relative startup and a particular Cursor startup/compaction setup have native evidence. Record host-specific results before extending those claims to other hosts or compaction paths. [October handoff](../sessions/20261021-v070-release.md#open-threads) · [Cursor run](https://github.com/t4sh/skills4sh/pull/49) · [November review](https://github.com/t4sh/skills4sh/pull/62)
- [ ] **Live Discord bot workflow.** Record an end-to-end run against Discord using an authorized bot and channel. Existing evidence covers local imports, fixtures, curl against a controlled service, and interruption handling. [October verification scope](https://github.com/t4sh/skills4sh/pull/55) · [November tests](https://github.com/t4sh/skills4sh/pull/62)

## Maintainer decisions and deferred milestones

- [ ] **Cross-machine pixel allowance.** After reviewing the measurements above, retain or relax the default of zero differing pixels. Record the allowed count separately from the per-pixel sensitivity. [Decision record](../decisions/skills-review-2026-11.md#left-for-the-maintainer)
- [ ] **Discord User-Agent.** Retain or change the default bot identity and record the rationale. An override already exists through `DISCORD_USER_AGENT`. [Decision record](../decisions/skills-review-2026-11.md#left-for-the-maintainer)
- [ ] **Compaction-reload hook.** Decide whether to keep the optional `init-rulebook` recipe that edits host settings on request. [Decision record](../decisions/skills-review-2026-11.md#left-for-the-maintainer)
- [ ] **Eleventy skill 2.0 / Build Awesome v4 GA.** Split or remove the opt-in nginx, Tailwind and soft-navigation profile at this milestone. The generic header checklist can be corrected earlier. [November decision](../decisions/skills-review-2026-11.md)
- [ ] **Installer v1.0.** Remove the deprecated install-mode `--force` no-op. Preserve the documented behavior of `remove --force`. [Installer help and warning](../../bin/install.mjs) · [Changelog](../../CHANGELOG.md)
- [ ] **Repository v1.0+ governance.** Revisit separate release-signing keys and multi-key approval if maintainer governance grows. The current policy accepts single-maintainer risk. [Security policy](../../SECURITY.md)

## Smaller maintenance items

- [ ] **Markdown heading fragments.** Linked headings currently avoid backticks because the drift checker and GitHub generate different fragments for inline code. If lifting that restriction, align the slugger and add fixtures for those links. [Checker](../../bin/drift-check.mjs) · [Release handoff](../sessions/20261121-skills-review-v080-release.md#open-threads)
- [ ] **Installer post-mortem reference.** Replace the literal `#TODO post-mortem link` with the incident reference for the already-fixed v0.3.1 invocation bug. [Source comment](../../bin/install.mjs)
- [ ] **Historical architect decision.** Update the active rubric decision’s “pending package release” sentence to reflect the shipped 1.0 promotion. [Decision](../decisions/skill-architect-central-rubric.md) · [v0.6.0 release](https://github.com/t4sh/skills4sh/releases/tag/v0.6.0)
- [ ] **Historical changelog coverage (optional).** Comparing tags with the changelog turned up missing comparison definitions for v0.5.2 and v0.5.4, and missing release headings for those two, v0.4.8 and v0.4.10. The previously stale Unreleased comparison has been corrected. [Changelog](../../CHANGELOG.md) · [October PR](https://github.com/t4sh/skills4sh/pull/55) · [Release history](https://github.com/t4sh/skills4sh/releases)

## Accepted limitations and recurring checks

- **Discord forced termination.** Normal return and handled signals clean up the mode-0600 credential file. SIGKILL can leave it behind. The release handoff records this risk without a planned redesign. [Release handoff](../sessions/20261121-skills-review-v080-release.md#open-threads)
- **Manual upstream links.** Verify the three skipped Discord Help Center links when relying on them. Automated requests received HTTP 403. The audit checked the other 90 links and all nine version pins. [Exception list](../../.github/upstream-pins.json)
- **Dependabot workflow PRs.** Their descriptions can fail the repository’s PR audit. The recorded procedure folds pending workflow updates into the release PR. The inventory found no open bot PR or alert. [Operations note](../sessions/20261120-figma-retirement-undici-fix.md)

## Closed items from earlier notes

- The project-relative native Codex startup check passed with a negative control. Its remaining documentation task is the release handoff item above.
- The v0.4.13 architect and description follow-ups, v0.4.14 review fixes, v0.5.x release checklists, v0.6.0 architect promotion and v0.7.x refresh holds have release or closure records. The changelog date in the published 0.7.0 tarball is historical. [June closeout](../sessions/20260619-pr26-release-cleanup.md) · [Archived plan](next-package-release.md) · [October handoff](../sessions/20261021-v070-release.md) · [Releases](https://github.com/t4sh/skills4sh/releases)
- Both Figma skills and their plugin were retired. Version 0.8.0 shipped the patched undici dependency. A Paper successor would require a new proposal. [Retirement decision](../decisions/retire-figma-skills.md) · [Operations note](../sessions/20261120-figma-retirement-undici-fix.md)
- Auto-delete for merged branches is enabled. Gitleaks and branch-protection drift are required. The proposed quality gate was conditional on a workflow that PR #11 did not add. Ubuntu CI now runs the Eleventy shell audit fixtures previously checked locally with BSD grep and ugrep. [PR #11](https://github.com/t4sh/skills4sh/pull/11) · [Protection snapshot](../../.github/branch-protection.expected.json) · [Shell fixtures](../../tests/eleventy-snippets.test.mjs) · [Validation workflow](../../.github/workflows/validate.yml)

## Inventory scope

The 2026-11-21 reconciliation covered public main through PR #63, the PR #64 branch, tracked project memory, 224 reachable commits, 64 PRs and their review records, and 37 GitHub releases. GitHub showed zero issues, zero open milestones, one open PR (#64) and zero open Dependabot, code-scanning or secret-scanning alerts. Discussions were disabled. Board-only draft items remain unverified because the inspection lacked GitHub Projects read access. [Issues](https://github.com/t4sh/skills4sh/issues) · [PR #64](https://github.com/t4sh/skills4sh/pull/64) · [Releases](https://github.com/t4sh/skills4sh/releases)
