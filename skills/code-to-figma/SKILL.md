---
name: code-to-figma
description: "This skill should be used when the user asks to 'sync code to Figma', 'export design tokens to Figma', 'set up a Figma sync pipeline', 'wire up the tokens-sync-to-figma plugin', 'generate a figma-export.json', 'create a page walker', or 'keep Figma up to date with the codebase'. It is the code → Figma direction of the design-token round-trip and pairs with the tokens-sync-to-figma plugin."
license: MIT
compatibility: macOS, Linux, or Windows with Node.js and the GitHub CLI (`gh`)
metadata:
  author: t4sh
  version: "0.1.0"
  tags: figma, design-tokens, code-to-figma, figma-sync, token-export, w3c-dtcg, gist, ci, tailwind, css, design-system
---

# Code to Figma

Generate a project-specific Figma export pipeline: a walker that reads compiled HTML and CSS, resolves class → token bindings, and pushes a structured JSON artifact to a GitHub Gist that the **`tokens-sync-to-figma`** Figma plugin consumes.

The pipeline is intentionally one-directional and CI-anchored. Claude does the intelligent work once (assessing the project, generating scripts, wiring CI). After that every push that touches tokens or templates automatically updates the Gist — no agent, no Figma API key, no per-sync friction.

## What I Can Help With

- **Set up a new pipeline** — assess the project, generate walker + token scripts, create the Gist, wire CI.
- **Sync now** — run the existing walker and push to the Gist without reassessing.
- **Update the walker** — regenerate scripts after a major redesign or stack change.
- **Check status** — report Gist age, CI wiring, and whether scripts exist and match the project.

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

Commit the `.w3c.json` output to the repo — it is the human-readable diff target for token changes.

#### `scripts/tokens-to-figma/push-to-figma.mjs`

Reads the walker output from `stdin` (or a file argument) and PATCHes the Gist. This script is project-agnostic — copy it verbatim from [`references/ci-and-gist-setup.md`](references/ci-and-gist-setup.md).

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
"figma:export": "node scripts/figma-export/walk-<site>.mjs",
"figma:sync":   "node scripts/figma-export/walk-<site>.mjs | node scripts/tokens-to-figma/push-to-figma.mjs"
```

#### `.github/workflows/figma-sync.yml`

CI workflow. See the full template in [`references/ci-and-gist-setup.md`](references/ci-and-gist-setup.md). Adapt the `paths:` trigger and build command to the project. Always use `node scripts/figma-export/walk-<site>.mjs` directly — never `pnpm figma:export` — so pnpm's script header does not contaminate the JSON written to the file.

### 3 — Create the Gist

```bash
echo '{"meta":{"generated":"placeholder"},"sections":[]}' > /tmp/figma-export-init.json
gh gist create --public --filename figma-export.json /tmp/figma-export-init.json
# Note the Gist ID from the URL: gist.github.com/<user>/<ID>
```

### 4 — Wire secrets

```bash
gh secret set FIGMA_EXPORT_GIST_ID --body "<gist-id>" --repo <org>/<repo>
gh secret set GIST_TOKEN --body "<PAT-with-gist-scope>" --repo <org>/<repo>
```

`GIST_TOKEN` must be a personal PAT with `gist` scope (or a fine-grained PAT with Gist read/write). `GITHUB_TOKEN` does not cover Gists.

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

---

## `/code-to-figma sync`

1. Confirm `figma-sync.config.json` exists and the walker path is valid.
2. Run: `node <walker> > /tmp/figma-export.json`
3. Validate: `jq '.sections | length' /tmp/figma-export.json`
4. Push: `node scripts/tokens-to-figma/push-to-figma.mjs < /tmp/figma-export.json`
5. Report sections and nodes exported, and the Gist URL.

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
| Edit Figma variables or components directly | Figma write MCP skill |
| Sync an existing Gist manually | `/code-to-figma sync` |

This skill does not edit Figma files. The plugin (`tokens-sync-to-figma`) is the Figma-side consumer — this skill produces the artifact it reads.

See [`references/benchmarks.md`](references/benchmarks.md) for peer skills on [skills.sh](https://skills.sh) and positioning notes.

## Operating Principles

- **Read the compiled output, not the source.** Token bindings only become resolvable in built HTML+CSS. Source templates may use variables that haven't been substituted yet.
- **`tokenPath()` is the contract.** Both the walker and the W3C converter must use the same function. If they diverge, Figma variable names won't match the sections' token references.
- **Walker is project-specific; pusher is generic.** The walker understands the project's HTML shape; the pusher only knows the Gist API. Keep them separate.
- **Commit the W3C JSON.** The `.w3c.json` file is the human-readable diff surface for token changes. It belongs in the repo, not in `.gitignore`.
- **`node` not `pnpm` in CI.** pnpm writes a script header to stdout when running a lifecycle script, which corrupts a `> file.json` redirect. Always invoke the walker with `node` directly in CI steps.
