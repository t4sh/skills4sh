---
id: context/v080-post-release-audit-todo
type: context
title: "TODO: close the 0.8.0 post-release audit findings"
description: >-
  Reproductions and acceptance checks for three workflows that can report false success,
  plus follow-ups for upstream monitoring, npm verification, portability, dates and test evidence.
tags: [todo, audit, localhost-screenshots, discord-harvest, eleventy-nunjucks, agent-memory, release]
source: codex
created: 2026-11-21
updated: 2026-11-21
status: active
expires: 2026-12-21
---

The 2026-11-21 audit checked the published `v0.8.0` package against `main` after PR #63. All 78 skill files matched, all six installer hashes verified, and 542 tests passed with zero skips. The fixtures below exposed gaps in that coverage.

## Workflows that can report success after failure

- [ ] **P1 · Screenshot comparison in CI.** An unreadable capture directory made `compare.js` exit 1 without writing a report. The example workflow converted that exit to a warning and succeeded. Handle input enumeration errors as exit 2. Verify that the CI example fails for an unreadable directory or a missing or stale report, and warns only for a fresh, complete comparison with visual differences. [Comparator](../../skills/localhost-screenshots/assets/scripts/compare.js) · [CI example](../../skills/localhost-screenshots/references/visual-regression.md)
- [ ] **P2 · Host-browser HTTP errors.** A local 404 in Chrome passed both URL checks and produced an 800×600 PNG. Require the expected main-document status when available. When the host cannot report it, verify a page-specific readiness signal and disclose the limitation. Exercise a normal page, an unexpected 404 and an intentionally requested error page. [Host-browser workflow](../../skills/localhost-screenshots/SKILL.md#host-browser-path)
- [ ] **P2 · Discord staging input.** Running the published Bash helper with a missing TSV printed a shell error, downloaded nothing and exited 0. Make failure to open the staging list return nonzero. Cover a missing list, an unreadable list and a valid list. [Download helper](../../skills/discord-harvest/references/code-examples.md#download-commands)

## Other follow-ups

- [ ] **Upstream drift tracking.** Simulated HTTP 503s left all nine pins and 90 checkable links unverified, yet the workflow would close an existing drift issue. Keep the issue open while a previously failing item is unverified. Test an outage followed by a verified recovery. [Checker](../../bin/upstream-check.mjs) · [Workflow](../../.github/workflows/upstream-drift.yml)
- [ ] **npm signature runbook.** Under npm 12.0.2, `npm audit signatures skills4sh@0.8.0` in an empty project failed because npm audits the installed dependency tree. Document and test verification in a temporary consumer project that installs the exact release with lifecycle scripts disabled, then runs `npm audit signatures`. This procedure verified the signature and provenance. The separate registry-visibility timeout is already tracked in the release handoff. [Runbook](../../docs/RELEASE_PROCESS.md#verify-npm)
- [ ] **Eleventy deployment guidance.** The generic troubleshooting direction says “Move to nginx,” and the HTTP-header checklist calls an nginx check required. Describe the host-independent header fix first and label the nginx example as conditional. Verify that an agent reviewing a site on a different host can complete the checklist using that host’s configuration. [Troubleshooting](../../skills/eleventy-nunjucks/references/troubleshooting.md) · [Security checklist](../../skills/eleventy-nunjucks/references/security-checklist.md)
- [ ] **Memory calendar dates.** The checker rejected `--today 0099-12-31` because `Date.UTC` interprets years 0–99 as 1900–1999. Preserve the literal four-digit year. Test valid dates in years 0001 and 0099 and an impossible date in the same range. [Date validation](../../skills/agent-memory/assets/scripts/check-memory.mjs)
- [ ] **Release handoff evidence.** Record the six fresh-agent fixture runs on the feature branch and the separate native Codex startup check alongside the published-package results. Identify which revision each covered. In the startup check, two fresh processes received the same arithmetic prompt from nested project directories. Only the project with the startup pointer returned the random label from its arithmetic rule. [Release handoff](../sessions/20261121-skills-review-v080-release.md#open-threads)
