---
name: code-to-figma
description: "Sync code tokens and page structure to Figma via a CI + Gist pipeline. Use when asked to \"set up a Figma sync pipeline\", \"sync code to Figma\", \"export design tokens to Figma\", \"update the page walker\", or \"wire up the tokens-sync-to-figma plugin\"; when paths include `figma-sync.config.json`, `figma-export.json`, `scripts/tokens-to-figma/`, or `.github/workflows/figma-sync.yml`; or when checking figma-sync Gist or CI status. Not for agent-driven, one-off Figma writes such as creating variables or editing nodes (use `figma-use`) or generating screens (use `figma-generate-design`)."
license: MIT
compatibility: macOS, Linux, or Windows with Node.js, Git, `jq`, and the GitHub CLI (`gh`)
metadata:
  author: t4sh
  version: "0.3.0"
  tags: figma, design-tokens, code-to-figma, figma-sync, token-export, w3c-dtcg, gist, ci, tailwind, css, design-system
---

# Code to Figma

Generate a project-specific Figma export pipeline: a walker that reads compiled HTML and CSS, resolves class → token bindings, and pushes a structured JSON artifact to a GitHub Gist that the **`tokens-sync-to-figma`** Figma plugin consumes.

The pipeline is intentionally one-directional and CI-anchored. During `setup`, assess the project once, generate scripts, and wire CI. After that, every push that touches configured token or template paths automatically updates the Gist without a Figma API key. The bundled plugin rebuilds page structure using existing Figma variables; token-value changes require a separate collection update and readback before Figma parity can be claimed.

## Commands

| Command | Use when | Outcome |
|---|---|---|
| `/code-to-figma setup` | First time; no scripts exist yet | Walker + token scripts generated, Gist created, CI wired, config saved |
| `/code-to-figma sync` | Scripts exist; push current state to Gist | figma-export.json built and patched to Gist |
| `/code-to-figma update` | Stack or token naming changed significantly | Scripts regenerated, CI and config updated |
| `/code-to-figma status` | Check pipeline health | Gist age, CI status, script presence, config validity |

For an unqualified setup/sync request, default to `/code-to-figma setup` when no `figma-sync.config.json` or walker scripts are found. Preserve explicit read-only `status` requests: report a missing pipeline rather than creating one.

---

## `/code-to-figma setup`

### 1 — Assess the project

Read in this order before generating anything:

1. **Package manifest** — `package.json`, `pyproject.toml`, etc. Identify the framework (Next.js, Eleventy, SolidJS, plain HTML) and package manager.
2. **CSS / token files** — find the compiled output, not the source. Common paths:
   - Tailwind v4: `out/assets/css/tailwind.css` or equivalent build output
   - Custom CSS: look for a file with `--token-name: value;` custom property declarations
   - Style Dictionary: `tokens.json`, `variables.css`, or generated output in `dist/`
3. **Component CSS** — look for a `components.css` or `utilities.css` alongside the main CSS file
4. **Built HTML** — the compiled output page, not source templates. Common paths: `out/index.html`, `dist/index.html`, `_site/index.html`. **Next.js**: a default build emits no single HTML file; require `output: 'export'` (yields `out/index.html`) before proceeding — see the Next.js note in [`references/walker-patterns.md`](references/walker-patterns.md). If no static HTML artifact can be produced, stop and tell the user rather than guessing a path.
5. **Token naming convention** — read the CSS custom property names, extract the prefix-to-group mapping (e.g. `beige-*` → `palette/beige/`, `fs-*` → `typography/scale/`)
6. **Section structure** — scan the HTML for how sections are delimited: `<section id="...">`, `[data-section]`, `<article>`, header/footer landmarks, etc.

Ask one focused question if two genuinely different walker shapes are possible (e.g. sections identified by ID vs by class). Otherwise infer and state the choice.

### 2 — Generate and verify the scaffold

Create or update the project-specific walker, DTCG 2025.10 token converter, generic Gist pusher, `figma-sync.config.json`, package scripts, GitHub Actions workflow, Gist, secrets, first sync, and Figma plugin connection. Load [references/setup-scaffold.md](references/setup-scaffold.md) for the file specifications and [references/ci-and-gist-setup.md](references/ci-and-gist-setup.md) for the canonical Gist, secret, CI, and plugin setup commands.

Required local checks before relying on CI:

```bash
node scripts/tokens-to-figma/convert-to-dtcg.mjs
git status --short -- scripts/tokens-to-figma/*.w3c.json
node scripts/figma-export/walk-<site>.mjs | jq -e '.sections | type == "array"'
```

Keep the core boundary visible: CI produces `figma-export.json` and checks the committed `<project>-tokens.w3c.json`; the `tokens-sync-to-figma` plugin consumes only `figma-export.json`. Use the DTCG artifact separately to maintain Figma variables. Do not require a Figma API key in CI.

Setup is complete when the generated scripts run, the Gist contains the validated export, CI is wired, and the user has verified the plugin connection and variable values through [collection reconciliation](references/ci-and-gist-setup.md#reconcile-the-collection-on-every-token-change). If Figma access or manual steps are pending, report pipeline setup separately from Figma verification.

---

## `/code-to-figma sync`

1. Confirm `figma-sync.config.json` exists and the walker path is valid.
2. Build the current site with the project's build command, regenerate `node scripts/tokens-to-figma/convert-to-dtcg.mjs`, and review the `.w3c.json` diff, including changes to existing values and aliases. Then run `node <walker> > figma-export.tmp.json`.
3. Validate: `jq -e '.sections | type == "array"' figma-export.tmp.json` must exit 0; stop on failure.
4. Confirm `GIST_TOKEN` is already exported from a secret manager per [references/ci-and-gist-setup.md](references/ci-and-gist-setup.md#4--verify-locally-before-relying-on-ci); never type the PAT on the command line.
5. Push: `node scripts/tokens-to-figma/push-to-figma.mjs < figma-export.tmp.json`
6. Reconcile token changes with the Figma collection using [the reconciliation procedure](references/ci-and-gist-setup.md#reconcile-the-collection-on-every-token-change). Gist authorization does not authorize writes inside Figma. Report **export uploaded** and **Figma token parity verified/unverified** as separate statuses; without authorized Figma access or a manual readback, parity is unverified and the pending deltas are listed.
7. Delete `figma-export.tmp.json` when done, then report sections and nodes exported, the Gist URL, and the separate Figma verification status. Claim Figma parity only after collection values and the plugin result are verified.

---

## `/code-to-figma update`

Use this when the framework output, token naming convention, section selectors, or CSS build paths changed enough that the existing walker may be stale.

1. Re-run the setup assessment against current compiled HTML/CSS and token files.
2. Update `walk-<site>.mjs`, `convert-to-dtcg.mjs`, `figma-sync.config.json`, and CI paths together so `tokenPath()`, explicit token types, and file paths stay aligned.
3. Regenerate the DTCG token artifact: `node scripts/tokens-to-figma/convert-to-dtcg.mjs`.
4. Validate the walker output: `node <walker> > figma-export.tmp.json && jq -e '.sections | type == "array"' figma-export.tmp.json`.
5. Push through `/code-to-figma sync` or CI after reviewing the script and `.w3c.json` diffs, then reconcile collection changes and report export and Figma parity separately.

---

## `/code-to-figma status`

Report:

| Check | How |
|---|---|
| Walker script | Does `figma-sync.config.json` exist? Does the walker file exist? |
| Gist freshness | `gh api gists/<id> --jq '.updated_at'` — report how old the Gist is |
| CI wiring | Does `figma-sync.yml` exist? Does it have `workflow_dispatch`? |
| Secrets | `gh secret list --repo <org>/<repo>` — confirm `GIST_TOKEN` and `FIGMA_EXPORT_GIST_ID` are present |
| Last run | `gh run list --workflow=figma-sync.yml --limit=1` |
| Figma token parity | Compare the current `.w3c.json` with an available collection readback; report unverified when Figma access/readback is unavailable. Gist freshness alone is insufficient. |

---

## Skill Boundaries

| User intent | Use |
|---|---|
| Export code tokens and page structure → Figma | This skill |
| Import a Figma design → code | **`figma-to-code`** skill |
| Agent-driven, one-off Figma write: create or edit variables, collections, nodes, or components in a file during an agent session | Official **`figma-use`** skill with the `use_figma` MCP tool (plus `figma-generate-library` for reusable variable/token collections) — not this skill |
| Generate a one-off screen or design in Figma from code, HTML, or a live page | Official **`figma-generate-design`** skill or Figma MCP write tools (`generate_figma_design`, `html_to_figma`, `send_code_to_figma`) ([Figma MCP tools](https://developers.figma.com/docs/figma-mcp-server/tools-and-prompts/), checked 2026-10-21) — not this skill |
| Sync an existing Gist manually | `/code-to-figma sync` |

This skill does not edit Figma files. The plugin (`tokens-sync-to-figma`) is the Figma-side consumer — this skill produces the artifact it reads. The plugin binds to an existing `Design Tokens` collection; creating that collection once is a prerequisite, and its optional agent path hands off to `figma-use` (see [references/ci-and-gist-setup.md](references/ci-and-gist-setup.md#prerequisite-design-tokens-variable-collection)).

## Behavioral evals

**Authors/reviewers only:** use the [scenario catalog](assets/evals/scenarios.json) when explicitly evaluating this skill; skip it during normal task execution. It holds description-only routing prompts and isolated sync/readback fixtures; withhold labels and assertions from the executing agent. The catalog is not evidence of a passing run, and synthetic readbacks do not verify live Figma integration. Converter behavior is fixture-tested by `tests/walker-patterns-snippets.test.mjs`.

## Reference Files

| File | Load when |
|------|-----------|
| [references/walker-patterns.md](references/walker-patterns.md) | Generating or updating the walker, DTCG converter, or generic Gist pusher; adapting `tokenPath()`, explicit token taxonomy, section detection, or Next.js static-export constraints |
| [references/setup-scaffold.md](references/setup-scaffold.md) | Generating setup files, package scripts, Gist commands, GitHub secrets, first sync, or plugin-side contract details |
| [references/figma-export-contract.md](references/figma-export-contract.md) | Validating walker JSON output shape (`meta`, `sections`, nodes, token references) |
| [references/ci-and-gist-setup.md](references/ci-and-gist-setup.md) | Wiring `figma-sync.yml`, GitHub secrets, first Gist push, or `tokens-sync-to-figma` plugin setup |
| [references/benchmarks.md](references/benchmarks.md) | Comparing peer skills on [skills.sh](https://skills.sh) or positioning this pipeline vs alternatives |

## Operating Principles

- **Read the compiled output, not the source.** Token bindings only become resolvable in built HTML+CSS. Source templates may use variables that haven't been substituted yet.
- **`tokenPath()` and explicit `$type` mappings are the contract.** The walker and DTCG converter must use the same path function, and every exported token must have an intentional DTCG type. Never infer `$type` from the raw CSS value; fail on unknown taxonomy or non-conforming values.
- **Walker is project-specific; pusher is generic.** The walker understands the project's HTML shape; the pusher only knows the Gist API. Keep them separate.
- **Commit the DTCG JSON.** The `.w3c.json` file is the human-readable diff surface for token changes. It belongs in the repo, not in `.gitignore`.
- **`node` not `pnpm` in CI.** pnpm writes a script header to stdout when running a lifecycle script, which corrupts a `> file.json` redirect. Always invoke the walker with `node` directly in CI steps.
