---
id: context/next-package-release
type: context
title: "Next package release: rulebook, architect, and Portless support"
description: >-
  Track the pending package release, including separate init-rulebook review
  and implemented Portless support in localhost-screenshots awaiting release.
tags: [release-planning, init-rulebook, skill-architect, localhost-screenshots, portless]
source: codex
created: 2026-09-27
updated: 2026-09-28
status: active
expires: 2026-10-27
---

## Release status

Changes are drafted on `feature/init-rulebook-onboarding`. The proposed package
version is `0.6.0`, with `skill-architect` promoted to `1.0.0` and the new
`init-rulebook` initially versioned `0.1.0`. These are unpublished draft values.

The user review and refinements are incorporated. Final local release validation
is complete; open the version PR and wait for required hosted checks before merge.
The user authorized scoped local commits and PR creation, not tagging or publication.

The 2026-09-27 refinement positions `init-rulebook` as a personal agent rulebook
manager. Setup defaults to `~/.agents/AGENTS.md`; a configured or explicitly
chosen custom folder remains supported. Host discovery is separate: inspect the active host's working instruction
first and preserve equivalent pointers. Codex-specific configuration is a
conditional adapter, not a default for other hosts. Keep personal rules outside the installed skill, preserve existing
dotfiles links, and present the public projection only as an optional example.
The default path is a skill convention, not universal native host discovery.

## Remaining work

- [x] Incorporate the user's separate `init-rulebook` review and refinements.
- [x] Add [Portless](https://portless.sh/) support to `localhost-screenshots`:
  route discovery, exact origin/worktree preservation, readiness checks, and
  HTTPS trust troubleshooting. Existing helpers already accept `.localhost`;
  a single trailing DNS root dot is now accepted. Custom TLD/LAN/tunnel URLs remain outside
  the local-only policy.
- [x] Draft `localhost-screenshots` 3.4.0; synchronize metadata and hashes.
  Verified 30 helper regression tests, one isolated route-selection forward
  test, and real captures through an isolated Portless 0.15.6 HTTP proxy using
  all three helpers and existing Playwright 1.62.1. HTTPS URL acceptance was
  fixture-tested; live HTTPS trust was not. User's stopped routes were unchanged.
- [x] Fix review findings: reject Portless main-worktree substitution; gate the
  self-signed TLS snippet on verified provenance and authorization. Added exact
  `~/.agents/rules/*.md` evals for the default tree, real dotfiles symlink, and
  mismatched tree. Review-fix verification: 87 targeted tests and five isolated
  decision/loading evals passed; fresh host startup and live HTTPS remain untested.
- [x] Revalidate the final local release candidate and update changelog and PR
  audit packet before integration. Full tests: 346 passed, zero skipped.
  All eight standard/drift/hash/portable/security gates passed. Security
  scan results match existing acknowledged findings; this is not a zero-findings claim.
- [ ] Wait for required hosted PR checks and review before integration.
- [ ] Follow `docs/RELEASE_PROCESS.md`: merge the version PR before creating
  the signed release tag and GitHub release, then verify npm publication.

## Local migration verification — 2026-09-28

The complete local draft `skills/init-rulebook/` bundle was copied into
`~/.dotfiles/agents/skills/init-rulebook/`, reached through the existing
`~/.cursor/skills` and `~/.agents` links. Personal index/rule bytes and those
links were preserved. The dotfiles loader audit and its regression tests now
recognize the portable contract. Conditional selection requires affirmative
trigger evidence; publishing alone no longer implies production operations.
The eval catalog adds the explicit-production companion (24 cases total).

A fresh Cursor 3.22.7 chat used the installed skill and loaded nine applicable
rules from the 19-rule inventory. Native `/summarize` showed “Chat context
summarized”; the continuation reopened the skill, index, and all nine selected
rules, keeping both action gates deferred. This is one native run on the
existing host configuration, not a cross-host reliability claim.

Evidence: `/private/tmp/skills4sh-reports/init-rulebook-migration/`.
The install is from the unpublished working draft, not GitHub. Register the
upstream refresh source after publication; dotfiles currently still classifies
the skill as local-only in its generated Skillsfile. A private projection
handoff records this dependency. Do not run a remote refresh to replace the
draft before its source is published.

## Relevant files

- `skills/init-rulebook/SKILL.md`
- `skills/skill-architect/SKILL.md`
- `skills/localhost-screenshots/SKILL.md`
- `docs/SKILL_AUTHORING_STANDARD.md`
- `docs/RELEASE_PROCESS.md`

## Final review follow-ups — 2026-09-28

- Canonical path comparison accepts symlink aliases while preserving the literal
  inventory path; separate-directory mismatch remains a reported error.
- Setup discovers the active host first and preserves working Cursor wording;
  missing Codex pointers can still be created in the appropriate host file.
- Inventory and status explicitly use metadata for deferred rules. Fresh setup
  and documentation-status fixtures read only Core and Core/Docs respectively;
  Ops and future Publish contents remained unread. Fixture bytes stayed intact.
- The init catalog now contains 27 cases. Screenshot boundary fixtures include
  an actual external stylesheet; architect adjacent retrieval grades routing only.
- The installed local draft is synchronized. Native Cursor verification above
  predates the final prose clarifications; the final focused runs are isolated
  fixture evidence, not another native-host reliability benchmark.
- Remaining compatibility limits: live Portless HTTPS trust untested; Portless
  0.15.6 rejects a trailing-dot Host despite the helper URL classification accepting it.
  Other hosts/platforms await their native validation.

Release candidate evidence: `/private/tmp/skills4sh-reports/release-candidate/`.
Keep dotfiles-local migration commits and publication separate from this public
package PR. Register the GitHub refresh source only after the bundle is published.
