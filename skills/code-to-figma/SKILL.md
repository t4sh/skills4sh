---
name: code-to-figma
description: "This skill should be used when the user asks to 'sync code to Figma', 'export design tokens to Figma', 'set up a Figma sync pipeline', 'wire up the tokens-sync-to-figma plugin', 'generate a figma-export.json', 'create a page walker', or 'keep Figma up to date with the codebase'."
license: MIT
compatibility: macOS, Linux, or Windows with Node.js and the GitHub CLI (`gh`)
metadata:
  author: t4sh
  version: "0.1.3"
  tags: figma, design-tokens, code-to-figma, figma-sync, token-export, w3c-dtcg, gist, ci, tailwind, css, design-system
---

# Code to Figma

Generate a project-specific Figma export pipeline: a walker that reads compiled HTML and CSS, resolves class → token bindings, and pushes a structured JSON artifact to a GitHub Gist that the **`tokens-sync-to-figma`** Figma plugin consumes.

The pipeline is intentionally one-directional and CI-anchored. During `setup`, assess the project once, generate scripts, and wire CI. After that, every push that touches tokens or templates automatically updates the Gist — no agent, no Figma API key, no per-sync friction.

## Commands

| Command | Use when | Outcome |
|---|---|---|
| `/code-to-figma setup` | First time; no scripts exist yet | Walker + token scripts generated, Gist created, CI wired, config saved |
| `/code-to-figma sync` | Scripts exist; push current state to Gist | figma-export.json built and patched to Gist |
| `/code-to-figma update` | Stack or token naming changed significantly | Scripts regenerated, CI and config updated |
| `/code-to-figma status` | Check pipeline health | Gist age, CI status, script presence, config validity |

Default to `/code-to-figma setup` when no `figma-sync.config.json` or walker scripts are found.

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

### 2 — Generate the scaffold

Produce the following files. Adapt all paths, class selectors, token prefix maps, and CSS file paths to the actual project.

#### `scripts/figma-export/walk-<site>.mjs`

The project-specific walker. Use the reference implementation in [`references/walker-patterns.md`](references/walker-patterns.md) as the template.

Key functions to adapt:
- **`tokenPath(name)`** — maps CSS custom property names to W3C DTCG-style slash paths. Derive from the token naming convention found in step 1. Every prefix pattern must be listed; use `semantic/${name}` as the catch-all.
- **`parseClassVarMap(css)`** — framework-agnostic; copy verbatim from the reference.
- **`buildUtilityMap(themeVars)`** — Tailwind v4 only. If the project uses custom CSS, omit this and rely solely on `parseClassVarMap`.
- **`walkNodes(parent, ...)`** — adapt `TEXT_TAGS` and depth limit to the project's markup conventions.
- **Section detection** — replace the `section[id]` selector and header detection with whatever the project actually uses.

Output contract: `process.stdout.write(JSON.stringify({ meta, sections }, null, 2) + '\n')` — see [`references/figma-export-contract.md`](references/figma-export-contract.md).

#### `scripts/tokens-to-figma/convert-to-w3c.mjs`

Reads the project's CSS custom properties and emits a W3C DTCG JSON file (`<project>-tokens.w3c.json`) beside the script. The `tokenPath()` function here must match the one in the walker exactly. Use the reference in [`references/walker-patterns.md`](references/walker-patterns.md).

Generate the file during setup with `node scripts/tokens-to-figma/convert-to-w3c.mjs`, inspect the diff, and commit the `.w3c.json` output to the repo — it is the human-readable diff target for token changes.

#### `scripts/tokens-to-figma/push-to-figma.mjs`

Reads the walker output from `stdin` (or a file argument) and PATCHes the Gist. This script is project-agnostic — copy it verbatim from [`references/walker-patterns.md`](references/walker-patterns.md). It reads `GIST_TOKEN` from the environment and resolves the Gist ID from `GIST_ID`, `FIGMA_EXPORT_GIST_ID`, or `figma-sync.config.json`'s `gistId`.

#### `figma-sync.config.json`

Saved at the repo root. Records the frozen config so CI can run headlessly.

```json
{
  "walker": "scripts/figma-export/walk-<site>.mjs",
  "gistId": "<FIGMA_EXPORT_GIST_ID>",
  "tokenCollection": "<Figma variable collection name>",
  "figmaFileKey": "<Figma file key, optional>",
  "paths": {
    "html": "<path to compiled index.html>",
    "css":  "<path to compiled CSS directory>"
  }
}
```

#### `package.json` script entries

Add to the project's `package.json`:

```json
"figma:tokens": "node scripts/tokens-to-figma/convert-to-w3c.mjs",
"figma:export": "node scripts/figma-export/walk-<site>.mjs",
"figma:sync":   "node scripts/figma-export/walk-<site>.mjs | node scripts/tokens-to-figma/push-to-figma.mjs"
```

#### Generate and commit the token artifact

Run the converter once during setup, before the first sync:

```bash
node scripts/tokens-to-figma/convert-to-w3c.mjs
git status --short -- scripts/tokens-to-figma/*.w3c.json
```

Review the generated `<project>-tokens.w3c.json`, commit it with the scaffolded scripts, and regenerate it whenever token source files change.

#### `.github/workflows/figma-sync.yml`

CI workflow. See the full template in [`references/ci-and-gist-setup.md`](references/ci-and-gist-setup.md). Adapt the `paths:` trigger and build command to the project. Always use `node scripts/figma-export/walk-<site>.mjs` directly — never `pnpm figma:export` — so pnpm's script header does not contaminate the JSON written to the file.

### 3 — Create the Gist

**Disclosure:** the export can reveal design tokens, page structure, and unreleased UI names. Prefer a **secret gist** unless the user explicitly wants a public one. Secret gists are unlisted, not private access control — anyone with the raw URL can read them. Never include secrets, customer data, or private implementation details in `figma-export.json`.

POSIX shell:

```bash
printf '%s\n' '{"meta":{"generated":"placeholder"},"sections":[]}' \
  | gh gist create --secret --filename figma-export.json -
# Note the Gist ID from the URL: gist.github.com/<user>/<ID>
```

PowerShell:

```powershell
'{"meta":{"generated":"placeholder"},"sections":[]}' | gh gist create --secret --filename figma-export.json -
# Note the Gist ID from the URL: gist.github.com/<user>/<ID>
```

### 4 — Wire secrets

```bash
gh secret set FIGMA_EXPORT_GIST_ID --body "<gist-id>" --repo <org>/<repo>
gh secret set GIST_TOKEN --repo <org>/<repo>   # paste the PAT at the secure prompt
```

`GIST_TOKEN` must be a personal PAT with `gist` scope (or a fine-grained PAT with Gist read/write). `GITHUB_TOKEN` does not cover Gists. Do not put the PAT on the command line with `--body`; shell history and process logs can retain it.

### 5 — First sync

Run the walker locally to verify the output before relying on CI:

```bash
node scripts/figma-export/walk-<site>.mjs | jq '.sections | length'
```

Then trigger CI:

```bash
gh workflow run figma-sync.yml
```

### 6 — Connect the Figma plugin

In Figma, install the **`tokens-sync-to-figma`** plugin (from [skills4sh](https://github.com/t4sh/skills4sh)), paste the Gist raw URL, and click **Sync from CI**. The raw URL is:

```
https://gist.githubusercontent.com/<user>/<gist-id>/raw/figma-export.json
```

See [`references/ci-and-gist-setup.md`](references/ci-and-gist-setup.md) for the full plugin setup.

### Figma plugin-side contract

This skill produces the artifact; the Figma plugin consumes it. Keep the boundary explicit:

- The plugin manifest must allow only the network domains it needs for the raw Gist URL. During local hardening, `networkAccess.allowedDomains: ["none"]` should fail closed; production setup should allow the narrow GitHub/Gist raw host required by the chosen URL.
- The plugin should read or update local Figma variables through the official variables API (for example, local variable collection discovery) rather than inventing a parallel token store.
- The artifact is the source of truth for sync input: `figma-export.json` plus the generated `<project>-tokens.w3c.json`. Do not require a Figma API key in CI; writes happen inside the user-authorized plugin runtime.
- If the plugin cannot find the configured local variable collection, stop and ask the user to choose/create it in Figma rather than creating ambiguous duplicate collections.

---

## `/code-to-figma sync`

1. Confirm `figma-sync.config.json` exists and the walker path is valid.
2. Run: `node <walker> > figma-export.tmp.json`
3. Validate: `jq '.sections | length' figma-export.tmp.json`
4. Confirm `GIST_TOKEN` is exported or prefix the pusher command with it.
5. Push: `node scripts/tokens-to-figma/push-to-figma.mjs < figma-export.tmp.json`
6. Delete `figma-export.tmp.json` when done, then report sections and nodes exported and the Gist URL.

---

## `/code-to-figma update`

Use this when the framework output, token naming convention, section selectors, or CSS build paths changed enough that the existing walker may be stale.

1. Re-run the setup assessment against current compiled HTML/CSS and token files.
2. Update `walk-<site>.mjs`, `convert-to-w3c.mjs`, `figma-sync.config.json`, and CI paths together so `tokenPath()` and file paths stay aligned.
3. Regenerate the W3C token artifact: `node scripts/tokens-to-figma/convert-to-w3c.mjs`.
4. Validate the walker output: `node <walker> > figma-export.tmp.json && jq -e '.sections | type == "array"' figma-export.tmp.json`.
5. Push through `/code-to-figma sync` or CI after reviewing the script and `.w3c.json` diffs.

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

---

## Skill Boundaries

| User intent | Use |
|---|---|
| Export code tokens and page structure → Figma | This skill |
| Import a Figma design → code | **`figma-to-code`** skill |
| Edit Figma variables or components directly | The project's configured Figma write/design workflow (outside this skill) |
| Sync an existing Gist manually | `/code-to-figma sync` |

This skill does not edit Figma files. The plugin (`tokens-sync-to-figma`) is the Figma-side consumer — this skill produces the artifact it reads.

## Reference Files

| File | Load when |
|------|-----------|
| [references/walker-patterns.md](references/walker-patterns.md) | Generating or updating the walker, W3C converter, or generic Gist pusher; adapting `tokenPath()`, section detection, or Next.js static-export constraints |
| [references/figma-export-contract.md](references/figma-export-contract.md) | Validating walker JSON output shape (`meta`, `sections`, nodes, token references) |
| [references/ci-and-gist-setup.md](references/ci-and-gist-setup.md) | Wiring `figma-sync.yml`, GitHub secrets, first Gist push, or `tokens-sync-to-figma` plugin setup |
| [references/benchmarks.md](references/benchmarks.md) | Comparing peer skills on [skills.sh](https://skills.sh) or positioning this pipeline vs alternatives |

## Operating Principles

- **Read the compiled output, not the source.** Token bindings only become resolvable in built HTML+CSS. Source templates may use variables that haven't been substituted yet.
- **`tokenPath()` is the contract.** Both the walker and the W3C converter must use the same function. If they diverge, Figma variable names won't match the sections' token references.
- **Walker is project-specific; pusher is generic.** The walker understands the project's HTML shape; the pusher only knows the Gist API. Keep them separate.
- **Commit the W3C JSON.** The `.w3c.json` file is the human-readable diff surface for token changes. It belongs in the repo, not in `.gitignore`.
- **`node` not `pnpm` in CI.** pnpm writes a script header to stdout when running a lifecycle script, which corrupts a `> file.json` redirect. Always invoke the walker with `node` directly in CI steps.
