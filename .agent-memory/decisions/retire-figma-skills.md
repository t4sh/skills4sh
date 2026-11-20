---
id: decisions/retire-figma-skills
type: decision
title: "Retire code-to-figma and figma-to-code"
description: >-
  Both Figma skills and the tokens-sync-to-figma plugin were removed on
  2026-11-20; the maintainer moved from Figma to Paper and Figma's official
  skills cover the workflows.
tags: [decision, figma, paper, retirement, code-to-figma, figma-to-code]
source: claude-code
created: 2026-11-20
updated: 2026-11-20
status: active
---

## Decision

`code-to-figma`, `figma-to-code`, and the `tokens-sync-to-figma` plugin are retired. They were removed from the repository in PR #60 (`9824a1f`). The repository now ships six skills and has no `plugins/` directory.

**Why:**

- The maintainer stopped using Figma and is moving to Paper, so the skills have no owner who exercises them.
- Figma's official skills ([figma/mcp-server-guide](https://github.com/figma/mcp-server-guide/tree/main/skills), checked 2026-11-10 at `9d296d07`, v2.2.193) cover the same ground: `figma-design-to-code` mandates reuse of project components, tokens, and Code Connect; `figma-generate-library` reconciles code tokens with Figma variables; `figma-generate-design` and `figma-code-workflows` push page structure into Figma; `figma-code-connect` owns Code Connect templates.
- The retirement trigger recorded at 0.7.0 was met: the `tokens-sync-to-figma` plugin was never published to the Figma Community.
- Adoption was small: 134 and 151 installs on skills.sh on 2026-11-10.

**How to apply:**

- Do not re-add Figma skills or propose Figma-based workflows for this repository.
- A Paper equivalent has not been requested; treat it as a new skill proposal if it comes up, not a port.
- Before the retirement, the only capabilities with no upstream equivalent were unattended CI token sync without a Figma credential, and durable design-system rules generation (Figma removed its own rules skill around 2026-05). These are the starting points if a successor is ever scoped.
- The retired skill content remains in git history before `9824a1f`.
