---
id: sessions/20261121-skills-review-v080-release
type: session
title: "November skills review and skills4sh 0.8.0 release"
description: >-
  Reviewed all six skills as an executing agent, fixed defects and stale facts,
  applied ten maintainer decisions, and released skills4sh 0.8.0 with five
  skill majors.
tags: [session, review, release, swot, localhost-screenshots, discord-harvest, eleventy-nunjucks, agent-memory, init-rulebook, skill-architect]
source: claude-code
created: 2026-11-21
updated: 2026-11-21
status: active
---

## What Happened

- Reviewed all six skills on 2026-11-20: each was walked as an executing agent, its dated facts were checked against primary sources, and a SWOT was written. The review found behaviour that was wrong in four skills and stale facts in five.
- Fixed the defects, each with a regression test that fails on the old code. The main ones: `discord-harvest` archived redirect bodies as assets; the `localhost-screenshots` redirect guard did not hold, because Playwright route handlers never see redirect hops; its comparison could report "0 compared, 0 failed"; `eleventy-nunjucks` date filters printed `NaN`; `skill-architect`'s description contained angle brackets.
- Refreshed stale facts on 2026-11-21: Eleventy 3.1.8, Build Awesome 4.0.0-alpha.12, Playwright 1.65.1, pixelmatch 8.0.0, Portless 0.18.1, Codex 0.171.0, and native `AGENTS.md` loading in Claude Code (v2.1.277+) and Cursor.
- Applied the ten decisions in [decisions/skills-review-2026-11](../decisions/skills-review-2026-11.md).
- A maintainer revision (`a60a462`) hardened the new capture scripts: 2xx and viewport checks before saving, and `capture.json` as the authority for comparisons. A follow-up closed the remaining repo-side gaps.
- Squash-merged PR #62 as `cfd6e11 feat(skills)!: 🌟 release the November skills review in v0.8.0 (#62)`. The first CI run failed only on CodeQL, which flagged a single-occurrence `replace` in `bin/upstream-check.mjs`; fixed before merge.
- Released skills4sh 0.8.0: signed tag `v0.8.0` on `cfd6e11`, GitHub release, npm publish through Trusted Publishing. Verified afterwards: npm serves 0.8.0 with `gitHead` `cfd6e11`, `latest` points at it, registry signatures and provenance attestations verify, and `node bin/verify-published.mjs` passes locally.

## Decisions Made

- Versions, each one increment above what `main` had, bumped once at release and not per commit: package 0.8.0; `agent-memory` 3.0.0; `discord-harvest` 3.0.0; `init-rulebook` 2.0.0; `localhost-screenshots` 4.0.0; `skill-architect` 2.0.0; `eleventy-nunjucks` 1.1.0.
- The ten review decisions and how to apply them are in the linked decision record.

## Open Threads

- The `npm-publish.yml` run for v0.8.0 shows failed, but the release succeeded. `Publish to npm` logged `+ skills4sh@0.8.0` at 21:57:05 UTC on 2026-11-20; `Verify published registry metadata` gave up at 22:02:19 UTC, and the registry served the version shortly after. The lag exceeded the roughly five-minute budget in `bin/verify-published.mjs` (earlier measurements were 126s and 158s). Per the runbook the run is left as is. Raising the budget changes `bin/`, which forces a package bump under the bin/tag parity rule, so fold it into the next release.
- No skill was forward-tested by a fresh agent in this round; the new eval scenarios are expectations, not recorded runs.
- Not verified: the `localhost-screenshots` redirect guard against HTTPS or Portless targets and on Linux or Windows; its host-browser path against a live host tool; the pixelmatch threshold measurements on any page or machine other than one fixture on macOS.
- CI and the publish workflow build the helper environment with the runner's `python3`. The pinned PyYAML 6.0.3 has no wheel for Python 3.15, so those jobs will fail when the runner's default Python reaches 3.15 unless the pin or the interpreter choice changes first.
- `discord_api` keeps the bot token in a mode-600 temp file while `curl` runs. It is removed on return and on INT, TERM and HUP; only `SIGKILL` can leave it behind.
- `bin/drift-check.mjs` slugs headings differently from GitHub when a heading contains inline code, so linked headings avoid backticks.
- Three calls are left for the maintainer; see the decision record.
