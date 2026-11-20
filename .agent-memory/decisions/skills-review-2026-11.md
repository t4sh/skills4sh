---
id: decisions/skills-review-2026-11
type: decision
title: "November 2026 skills review: positioning, manifest and tooling decisions"
description: >-
  Ten maintainer decisions from the 2026-11 review of all six skills, released
  as skills4sh 0.8.0: description rewrites, the localhost-screenshots
  reposition, manifest semantics, the scanner upgrade and the upstream check.
tags: [decision, review, release, localhost-screenshots, security-manifest, guardskills, upstream-drift, descriptions]
source: claude-code
created: 2026-11-21
updated: 2026-11-21
status: active
---

## Decision

The 2026-11-20 review walked each skill as an executing agent, checked its dated facts against primary sources, and produced a SWOT. Defects, stale facts and usability gaps were fixed; the items below needed a maintainer decision and were decided on 2026-11-21. All shipped in PR #62 (`cfd6e11`), package 0.8.0.

| # | Topic | Decision |
|---|---|---|
| 1 | Trigger descriptions | Full rewrite, accepting a major version, for `agent-memory`, `discord-harvest`, `init-rulebook`, `localhost-screenshots` and `skill-architect`. `eleventy-nunjucks` only gained the `buildawesome.config.*` path cue. |
| 2 | `eleventy-nunjucks` deployment profile | Keep the nginx / Tailwind / soft-navigation material, label it as one example profile, load it only on request. Delete or split it at 2.0, planned for Build Awesome v4 GA. |
| 3 | `localhost-screenshots` positioning | A local-only policy and verification layer over whatever browser the host has. The bundled Playwright scripts are one backend. |
| 4 | `localhost-screenshots` scripts | Bundle `capture.js` and `compare.js`; `capture.json` is authoritative for a comparison. |
| 5 | pixelmatch | 8.0.0, with defaults re-measured: per-pixel threshold 0.05, zero differing pixels allowed. |
| 6 | `agent-memory` checker | Ship an optional read-only Node script; the manual comparison stays as the fallback. |
| 7 | `skill-architect` entrypoint | Restructure to one eight-step procedure, about 1,600 words, non-negotiables first. |
| 8 | Security manifests | `shell` and `network` describe what a skill directs the agent to run and reach, not only what it bundles. |
| 9 | Scanner | guardskills pinned at 1.6.0. |
| 10 | Upstream drift | Weekly workflow plus `npm run check:upstream`; opens one tracking issue; never a pull-request gate. |

**Why:**

- Hosts now ship browsers, native memory, native `AGENTS.md` loading and first-party skill validators, so each skill has to state what it adds beyond the host. That drove decisions 1, 3 and 6.
- Every stale fact found had sat for weeks because nothing compared pinned versions and links with their sources (decision 10).
- All six manifests said `shell: none` while five skills direct shell commands; a repository that advertises its security posture cannot carry that (decision 8).
- The profile material is about a third of `eleventy-nunjucks` but removing it one month after 1.0 would be a breaking change with no migration path (decision 2).

**How to apply:**

- Manifest values: `shell: limited` for every current skill. Risk tier Low is local file work and a bounded set of local commands; Medium also handles a credential, installs and runs third-party packages in the user's project, or drives a browser. `discord-harvest`, `eleventy-nunjucks` and `localhost-screenshots` are Medium.
- A version stated in a skill is also listed in `.github/upstream-pins.json` with the files that state it. Change the pin and those files together, or the check reports the pin as out of sync.
- `localhost-screenshots`: the scripts stop a redirect to another host before the request is sent; a host browser can only detect it and discard the capture. Keep that distinction in any wording.
- `capture.js` marks `capture.json` as `in-progress` before it starts, even when the run then cannot start. This is deliberate: a failed rerun must not leave a manifest that makes older images look current. Do not "fix" it.
- `compare.js` must run on its own, so it keeps its own copy of `routeDirectory`; a test fails if the copies in `capture.js` and `compare.js` differ. Exit codes: 0 complete match, 1 complete comparison with differences, 2 incomplete or setup error.
- A skill description may not contain `<` or `>`; both validators enforce it.

## Left for the maintainer

- Whether the zero-pixel comparison default is too strict for captures taken on two machines (the CI template warns instead of failing for that reason).
- The default Discord `User-Agent` identity, currently `DiscordBot (https://github.com/t4sh/skills4sh, 1.0)`, overridable with `DISCORD_USER_AGENT`.
- Whether `init-rulebook` should keep its opt-in compaction-reload hook recipe, which edits a host settings file on the user's request.
