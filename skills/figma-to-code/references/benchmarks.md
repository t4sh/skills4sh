# Figma-to-Code Skill Benchmarks

Use this file when comparing `t4sh/skills4sh` `figma-to-code` against other agent skills and planning improvements.

## Benchmark snapshot

| Field | Value |
|-------|--------|
| **Benchmark date** | 2026-05-18 |
| **skills.sh install counts** | Captured 2026-05-18 (rounded; change frequently) |
| **Last commit column** | Default branch tip via GitHub API (`gh api repos/{owner}/{repo}/commits?per_page=1`) |
| **This skill version** | `figma-to-code` v0.1.1 in `t4sh/skills4sh` |
| **skills4sh repo @ snapshot** | [t4sh/skills4sh](https://github.com/t4sh/skills4sh) — last commit 2026-05-18 |

Re-run the snapshot before a major skill revision. Install counts drift weekly; peer repos commit daily.

### Refresh last-commit dates

Before a major revision, refresh the snapshot manually:

1. Record the current UTC date with `date -u +%Y-%m-%d`.
2. For each GitHub repository in the tables, run `gh api repos/OWNER/REPO/commits?per_page=1 --jq '.[0].commit.committer.date'`.
3. For npm-only peers, run `npm view PACKAGE_NAME time.modified --json`.
4. Update the **Benchmark date** row and table **Last commit** column.

Keep commands manual and explicit; avoid shell loops or environment variables in this reference so security scanners do not treat benchmark maintenance instructions as runtime behavior.

---

## This skill (`t4sh/skills4sh`)

| Attribute | Value |
|-----------|--------|
| Install | `npx skills add t4sh/skills4sh --skill figma-to-code` |
| Registry | [skills.sh/t4sh/skills4sh/figma-to-code](https://skills.sh/t4sh/skills4sh/figma-to-code) |
| Differentiator | Repo-first unified commands: **implement**, **tokens**, **rules**, **code-connect** in one skill |
| Last commit @ snapshot | 2026-05-18 (`t4sh/skills4sh`; skill files may be ahead on branch) |

## Tier 1 — Direct Figma → code (Figma MCP)

| Skill | Source | Installs @ snapshot | Last commit @ snapshot | Benchmark focus |
|-------|--------|---------------------|-------------------------|-----------------|
| `implement-design` | [figma/mcp-server-guide](https://skills.sh/figma/mcp-server-guide) | ~5.9K | 2026-05-15 | Legacy name; 7-step implement workflow |
| `figma-implement-design` | figma/mcp-server-guide | ~4.0K | 2026-05-15 | Same repo; prefixed name; **skill boundaries** routing |
| `figma` | [openai/skills](https://skills.sh/openai/skills) | ~2.6K | 2026-05-12 | Umbrella MCP + config reference |
| `figma-implement-design` | openai/skills | ~2.3K | 2026-05-12 | Curated implement + boundary routing |
| `figma-to-code` (npm) | [figma-to-code-skill](https://www.npmjs.com/package/figma-to-code-skill) | npm | **2026-03-12** (npm `time.modified`; GitHub repo not public @ snapshot) | **Correction loops** + MCP call budget |
| `figma-to-code` | [AbsolutelySkilled/AbsolutelySkilled](https://github.com/AbsolutelySkilled/AbsolutelySkilled) | listing | 2026-05-18 | Conceptual handoff; verify repo `SKILL.md` before trusting |
| `f2c` / `figma-to-code` | [gautam-lulla/claude-skills](https://github.com/gautam-lulla/claude-skills) | skills.lc | 2026-01-22 | Full **Next.js + CMS** site builder — different product class |

## Tier 2 — Figma MCP companions (benchmark separately)

All figma/mcp-server-guide skills share one repository; **last commit** is the same for each row.

| Skill | Source | Installs @ snapshot | Last commit @ snapshot | Maps to our command |
|-------|--------|---------------------|-------------------------|---------------------|
| `figma-create-design-system-rules` / `create-design-system-rules` | figma/mcp-server-guide | ~1.6K / ~1.3K | 2026-05-15 | `/figma-to-code rules` |
| `code-connect-components` / `figma-code-connect*` | figma/mcp-server-guide | ~885+ | 2026-05-15 | `/figma-to-code code-connect` |
| `figma-use` | figma/mcp-server-guide | ~2.7K | 2026-05-15 | Out of scope (Figma **write**) |
| `figma-generate-design` | figma/mcp-server-guide | ~2.0K | 2026-05-15 | Out of scope (**code → Figma**) |
| `figma-generate-library` | figma/mcp-server-guide | ~1.4K | 2026-05-15 | DS build in Figma, not implement |

Official docs (not a git skill file): [Figma MCP — Implement Design](https://developers.figma.com/docs/figma-mcp-server/skill-figma-implement-design/) — treat docs as living; no commit pin.

## Tier 3 — Adjacent on skills.sh (not Figma MCP)

| Skill | Source | Installs @ snapshot | Last commit @ snapshot | Borrow for |
|-------|--------|---------------------|-------------------------|------------|
| `react:components` | [google-labs-code/stitch-skills](https://skills.sh/google-labs-code/stitch-skills/react:components) | ~44.7K | 2026-03-30 | Local cache + visual audit |
| `design-md` | stitch-skills | ~44.4K | 2026-03-30 | Semantic `DESIGN.md` |
| `extract-design-system` | [arvindrk/extract-design-system](https://skills.sh/arvindrk/extract-design-system/extract-design-system) | ~99.3K | 2026-05-10 | Token extraction from **websites** |
| `refero-design` | [referodesign/refero_skill](https://skills.sh/referodesign/refero_skill/refero-design) | ~2.3K | 2026-05-15 | Research reference, not implement |
| `impeccable`, `design-taste-frontend`, etc. | various | high | *not pinned* | Post-implement UI polish — pin repo on next review |

## Tier 4 — Outside skills.sh

| Source | Last updated @ snapshot | Notes |
|--------|-------------------------|--------|
| Cursor Figma plugin skills | *bundled* | `figma-use`, `figma-code-connect`, `figma-generate-design` — version follows Cursor plugin release, not a single public skill repo |
| [shadcndesign Agent Skills](https://www.shadcndesign.com/agent-skills) | *commercial site* | Figma → shadcn/ui + `globals.css` variables; no public git pin |
| [edenspiekermann/Skills](https://github.com/edenspiekermann/Skills) `apply-design-system` | 2026-03-24 | Reconnect frames to published DS |
| Community listings (Cult of Claude, ClaudSkills, etc.) | *verify on review* | Quality varies; record repo + commit when added to a future tier |

## Comparison matrix

Compared against peer state on **2026-05-18** (installs + commits above).

| Dimension | Figma `figma-implement-design` | pawanpaudel93 `figma-to-code-skill` | **skills4sh `figma-to-code`** |
|-----------|----------------------------------|-------------------------------------|--------------------------------|
| Scope | Implement + sibling pointers | Implement + correction loops | Unified implement / tokens / rules / code-connect |
| Repo-first | Yes | Yes + CSS diff loop | Yes — inspect before MCP params |
| MCP discovery | Tool names in prose | Efficiency table | Schema-first + server names + `mcp_auth` |
| Desktop vs remote | Good | Assumes MCP | URL types, branch retry, prototype/file-only |
| Security | Steering boundaries | Less emphasized | Untrusted design data in Boundaries |
| Verification | Screenshot compare | Playwright correction loop | Checklist + `localhost-screenshots` |
| Code Connect | Separate skill | Mentioned | In-skill + defer to `figma-code-connect` |
| Self-correction | Manual validate step | Automated per-component loops | **Correction loop** (see implementation-patterns) |

## Recommended peer review set

Re-check **last commit** and **installs** when revisiting this list.

| # | Peer | Last commit @ snapshot |
|---|------|-------------------------|
| 1 | [figma/mcp-server-guide `figma-implement-design`](https://skills.sh/figma/mcp-server-guide/figma-implement-design) | 2026-05-15 |
| 2 | [openai/skills `figma`](https://skills.sh/openai/skills/figma) | 2026-05-12 |
| 3 | [figma/mcp-server-guide `figma-create-design-system-rules`](https://skills.sh/figma/mcp-server-guide/figma-create-design-system-rules) | 2026-05-15 |
| 4 | [figma/mcp-server-guide `code-connect-components`](https://skills.sh/figma/mcp-server-guide/code-connect-components) | 2026-05-15 |
| 5 | [google-labs-code `react:components`](https://skills.sh/google-labs-code/stitch-skills/react:components) | 2026-03-30 |
| 6 | [figma-to-code-skill](https://www.npmjs.com/package/figma-to-code-skill) (npm) | 2026-03-12 |
| 7 | **This repo** `skills/figma-to-code/SKILL.md` | 2026-05-18 (repo); skill v0.1.1 |
