# Code-to-Figma Skill Benchmarks

Use this file when comparing `t4sh/skills4sh` `code-to-figma` against other agent skills and tools, and when planning improvements.

## Benchmark snapshot

| Field | Value |
|-------|--------|
| **Benchmark date** | 2026-05-20 |
| **skills.sh data** | Captured 2026-05-19 from skill listing pages (descriptions; install counts drift) |
| **This skill version @ snapshot** | `code-to-figma` v0.1.2 in `t4sh/skills4sh` |
| **Paired plugin** | `tokens-sync-to-figma` (Figma-side consumer in this repo) |

Re-run the snapshot before a major skill revision. Peer listings change; verify each source page before trusting it.

### Refresh peer data

Before a major revision, refresh manually:

1. Record the current UTC date with `date -u +%Y-%m-%d`.
2. For each GitHub repository in the tables, run `gh api repos/OWNER/REPO/commits?per_page=1 --jq '.[0].commit.committer.date'`.
3. Re-read each skills.sh listing page to confirm scope and direction.

Keep commands manual and explicit; avoid shell loops or environment variables in this reference so security scanners do not treat benchmark maintenance instructions as runtime behavior.

---

## This skill (`t4sh/skills4sh`)

| Attribute | Value |
|-----------|--------|
| Differentiator | CI-anchored, zero-credential **code → Figma** pipeline generation; pairs with the `tokens-sync-to-figma` plugin |
| Direction | One-directional: code → Gist → Figma (the reverse leg is the `figma-to-code` skill) |

## Peer comparison

Compared against peer state on **2026-05-19** (skills.sh listing pages).

| Skill / tool | Source | Direction | Mediation | Closest overlap |
|--------------|--------|-----------|-----------|-----------------|
| `sync-figma-token` | [firebenders/sync-figma-token-skill](https://skills.sh/firebenders/sync-figma-token-skill/sync-figma-token) | Bidirectional (code ↔ Figma variables) | Agent + Figma API via `figma-use`; dry-run + explicit approval gate | **Closest competitor** — same domain, but agent/API-mediated and approval-gated |
| `design-tokens` | [julianoczkowski/designer-skills](https://skills.sh/julianoczkowski/designer-skills/design-tokens) | Code-only token scaffolding | Agent; filesystem scan | Complementary upstream — *produces* tokens this skill later exports; no Figma leg |
| `figma-plugin-development` | mcpmarket.com (Vercel-gated; identity inferred) | N/A (authoring) | Agent | Orthogonal — builds Figma plugins; does not sync tokens |

## Positioning

| Axis | `code-to-figma` (+ `tokens-sync-to-figma`) | `sync-figma-token` |
|------|---------------------------------------------|---------------------|
| Setup friction | Front-loaded once (walker + CI + Gist) | Standing (Figma API token, `figma-use`, agent) |
| Per-sync friction | Zero — CI on push; designer one-click in plugin | Per-run agent + human approval |
| Direction | One-way by design (reverse = `figma-to-code`) | Bidirectional parity |
| Credentials at sync | None | Figma API / Dev-Mode |
| Source of truth | Committed code via CI snapshot | Negotiated parity |

The deliberate trade: this skill does **less** (one-way, no diff/approval) to achieve the lowest recurring friction and a zero-credential sync path. Bidirectionality is intentionally delegated to the `figma-to-code` skill rather than folded in here.

## Recommended peer review set

Re-check scope and direction when revisiting this list.

| # | Peer | Source |
|---|------|--------|
| 1 | `sync-figma-token` | [firebenders/sync-figma-token-skill](https://skills.sh/firebenders/sync-figma-token-skill/sync-figma-token) |
| 2 | `design-tokens` | [julianoczkowski/designer-skills](https://skills.sh/julianoczkowski/designer-skills/design-tokens) |
| 3 | `figma-to-code` (this repo — the reverse leg) | `skills/figma-to-code/SKILL.md` (see current frontmatter; v0.1.3 at this snapshot) |
| 4 | **This repo** `skills/code-to-figma/SKILL.md` | See current frontmatter; v0.1.2 at this snapshot |
