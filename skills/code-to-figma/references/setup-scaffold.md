# Code to Figma Setup Scaffold

Load this reference during `/code-to-figma setup` or `/code-to-figma update` after the project assessment identifies the framework, compiled HTML/CSS paths, token naming convention, and section structure.

### 2 — Generate the scaffold

Produce the following files. Adapt all paths, class selectors, token prefix maps, and CSS file paths to the actual project.

#### `scripts/figma-export/walk-<site>.mjs`

The project-specific walker. Use the reference implementation in [`references/walker-patterns.md`](walker-patterns.md) as the template.

Key functions to adapt:
- **`tokenPath(name)`** — maps CSS custom property names to W3C DTCG-style slash paths. Derive from the token naming convention found in step 1. Every prefix pattern must be listed; use `semantic/${name}` as the catch-all.
- **`parseClassVarMap(css)`** — framework-agnostic; copy verbatim from the reference.
- **`buildUtilityMap(themeVars)`** — Tailwind v4 only. If the project uses custom CSS, omit this and rely solely on `parseClassVarMap`.
- **`walkNodes(parent, ...)`** — adapt `TEXT_TAGS` and depth limit to the project's markup conventions.
- **Section detection** — replace the `section[id]` selector and header detection with whatever the project actually uses.

Output contract: `process.stdout.write(JSON.stringify({ meta, sections }, null, 2) + '\n')` — see [`references/figma-export-contract.md`](figma-export-contract.md).

#### `scripts/tokens-to-figma/convert-to-w3c.mjs`

Reads the project's CSS custom properties and emits a W3C DTCG JSON file (`<project>-tokens.w3c.json`) beside the script. The `tokenPath()` function here must match the one in the walker exactly. Use the reference in [`references/walker-patterns.md`](walker-patterns.md).

Generate the file during setup with `node scripts/tokens-to-figma/convert-to-w3c.mjs`, inspect the diff, and commit the `.w3c.json` output to the repo — it is the human-readable diff target for token changes.

#### `scripts/tokens-to-figma/push-to-figma.mjs`

Reads the walker output from `stdin` (or a file argument) and PATCHes the Gist. This script is project-agnostic — copy it verbatim from [`references/walker-patterns.md`](walker-patterns.md). It reads `GIST_TOKEN` from the environment and resolves the Gist ID from `GIST_ID`, `FIGMA_EXPORT_GIST_ID`, or `figma-sync.config.json`'s `gistId`.

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

CI workflow. See the full template in [`references/ci-and-gist-setup.md`](ci-and-gist-setup.md). Adapt the `paths:` trigger and build command to the project. Always use `node scripts/figma-export/walk-<site>.mjs` directly — never `pnpm figma:export` — so pnpm's script header does not contaminate the JSON written to the file.

### 3 — Create the Gist, wire secrets, run first sync, and connect the plugin

Use [`references/ci-and-gist-setup.md`](ci-and-gist-setup.md) as the single source of truth for:

- creating the secret Gist and recording the Gist ID
- setting `FIGMA_EXPORT_GIST_ID` and `GIST_TOKEN` without leaking the PAT into shell history
- running the first local walker validation and CI workflow
- connecting the `tokens-sync-to-figma` plugin to the raw Gist URL

Do not duplicate those commands here; update `ci-and-gist-setup.md` when Gist, secret, or plugin setup changes.

### Figma plugin-side contract

This skill produces the artifact; the Figma plugin consumes it. Keep the boundary explicit:

- The plugin manifest must allow only the network domains it needs for the raw Gist URL. During local hardening, `networkAccess.allowedDomains: ["none"]` should fail closed; production setup should allow the narrow GitHub/Gist raw host required by the chosen URL.
- The plugin should read or update local Figma variables through the official variables API (for example, local variable collection discovery) rather than inventing a parallel token store.
- The artifact is the source of truth for sync input: `figma-export.json` plus the generated `<project>-tokens.w3c.json`. Do not require a Figma API key in CI; writes happen inside the user-authorized plugin runtime.
- If the plugin cannot find the configured local variable collection, stop and ask the user to choose/create it in Figma rather than creating ambiguous duplicate collections.
