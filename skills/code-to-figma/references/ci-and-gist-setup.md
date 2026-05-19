# CI and Gist setup

End-to-end guide for wiring the figma-sync pipeline in a new project.

---

## 1 — Create the Gist

One-time, run locally:

```bash
echo '{"meta":{"generated":"placeholder"},"sections":[]}' > /tmp/figma-export-init.json
gh gist create --public --filename figma-export.json /tmp/figma-export-init.json
# Output: https://gist.github.com/<user>/<gist-id>
```

Note the Gist ID (the long hex string in the URL). The **raw URL** for the plugin is:

```
https://gist.githubusercontent.com/<user>/<gist-id>/raw/figma-export.json
```

---

## 2 — Set repo secrets

```bash
gh secret set FIGMA_EXPORT_GIST_ID --body "<gist-id>"        --repo <org>/<repo>
gh secret set GIST_TOKEN            --body "<PAT-gist-scope>" --repo <org>/<repo>
```

**`GIST_TOKEN`** must be a personal access token (PAT) with `gist` scope, owned by the same GitHub account that owns the Gist. `GITHUB_TOKEN` (the built-in Actions token) is repo-scoped and **cannot** patch Gists.

Create a PAT at [github.com/settings/tokens](https://github.com/settings/tokens). For a fine-grained PAT: "Gists" permission, read and write. No other scopes needed.

---

## 3 — CI workflow template

The template below assumes **pnpm + Turborepo + static export**. Adapt the setup/build steps to the detected stack: swap `pnpm/action-setup` + `pnpm install` for the project's package manager (npm `actions/setup-node` cache `npm` + `npm ci`; yarn/bun equivalents), and replace the `pnpm turbo run build` line with the project's real build (`next build` with `output: 'export'`, `npm run build`, `eleventy`, etc.). Only the `node scripts/figma-export/walk-*.mjs` and Gist-patch steps are stack-agnostic.

```yaml
name: Figma sync

on:
  workflow_dispatch:
  push:
    branches: [main]
    paths:
      - 'apps/<site>/**'          # ← adapt to where the site lives
      - 'packages/tokens/**'
      - 'scripts/figma-export/**'
      - '.github/workflows/figma-sync.yml'

concurrency:
  group: figma-sync
  cancel-in-progress: true

jobs:
  export:
    name: Walk + Gist patch
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        # reads packageManager from package.json

      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: pnpm

      - name: Install
        run: pnpm install --frozen-lockfile

      - name: Build site
        run: pnpm turbo run build --filter="<site>..."   # ← adapt build command
        env:
          COMMIT_SHA: ${{ github.sha }}

      - name: Walk HTML → figma-export.json
        # Use `node` directly, NOT `pnpm <script>`.
        # pnpm writes a script header to stdout which corrupts the JSON file.
        run: node scripts/figma-export/walk-<site>.mjs > /tmp/figma-export.json

      - name: Validate + log summary
        run: |
          sections=$(jq '.sections | length' /tmp/figma-export.json)
          nodes=$(jq '[.sections[].nodes | length] | add' /tmp/figma-export.json)
          echo "Sections: $sections  Nodes: $nodes"

      - name: Patch Gist
        env:
          GIST_TOKEN: ${{ secrets.GIST_TOKEN }}
          GIST_ID:    ${{ secrets.FIGMA_EXPORT_GIST_ID }}
        run: |
          content=$(jq -Rs . /tmp/figma-export.json)
          curl -s --fail -X PATCH \
            -H "Authorization: token $GIST_TOKEN" \
            -H "Content-Type: application/json" \
            -d "{\"files\":{\"figma-export.json\":{\"content\":$content}}}" \
            "https://api.github.com/gists/$GIST_ID" \
            | jq -r '"Gist updated: https://gist.github.com/\(.owner.login)/\(.id)"'
```

> **Why `node` not `pnpm <script>`**: pnpm's script runner writes a `> package-name@version scriptname` header to stdout before the script runs. When stdout is redirected to a file (`> /tmp/figma-export.json`), that header lands in the file and makes it invalid JSON. Calling `node` directly sidesteps this.

---

## 4 — Verify locally before relying on CI

```bash
# Build the site first
pnpm build   # or equivalent

# Run the walker
node scripts/figma-export/walk-<site>.mjs | jq '.sections | length'

# Push manually
GIST_TOKEN=<your-pat> GIST_ID=<gist-id> \
  node scripts/figma-export/walk-<site>.mjs | node scripts/tokens-to-figma/push-to-figma.mjs
```

---

## 5 — Connect the Figma plugin

1. In Figma: **Plugins → Development → Import plugin from manifest** → select `plugins/tokens-sync-to-figma/manifest.json` from a local clone of [skills4sh](https://github.com/t4sh/skills4sh), **or** install from the Figma Community once published.
2. Run **Tokens sync to Figma**.
3. Paste the Gist raw URL and click **Sync from CI**.

The raw URL format:
```
https://gist.githubusercontent.com/<user>/<gist-id>/raw/figma-export.json
```

The plugin remembers the URL after the first paste.

### Prerequisite: `Design Tokens` variable collection (v1)

In v1 the plugin requires a pre-existing Figma variable collection named **`Design Tokens`** with a **`Light`** mode. Variable names must match the `*Token` paths in `figma-export.json` exactly.

Generate the collection from the same token source (e.g. import the `.w3c.json` via a Variables importer) so both sides share one naming scheme. This prerequisite is eliminated in plugin v1.1 when the Gist carries a `tokens` section.

---

## 6 — Trigger manually

```bash
gh workflow run figma-sync.yml
gh run list --workflow=figma-sync.yml --limit=3
```

---

## 7 — Check Gist freshness

```bash
gh api gists/<gist-id> --jq '.updated_at'
```

The plugin reports how old the snapshot is when it opens ("Figma reflects code as of 2026-05-19 (3 days old)").

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `jq: parse error: Invalid numeric literal at line 2` | pnpm script header in stdout | Use `node script.mjs >` not `pnpm figma:export >` |
| `GIST_TOKEN: ` (empty in CI log) | Secret not set | `gh secret set GIST_TOKEN ...` |
| `GIST_PATCH failed: 404` | GIST_ID wrong or Gist deleted | Check `gh api gists/<id>` |
| `GIST_PATCH failed: 403` | PAT missing `gist` scope | Create new PAT with gist scope |
| `ENOENT` on the walker's `readFileSync(... index.html)` | Next.js (or other SSR/streamed framework) emitted no static HTML file | Enable `output: 'export'` in `next.config` and rebuild, or point the walker at a fully-static prerendered route — see the Next.js note in `walker-patterns.md`. Do not guess a `.next/server/app/page.html` path. |
| `ENOENT` on the CSS read | CSS filename is content-hashed (Next.js `.next/static/css/*.css`) | Glob the hashed CSS name instead of hard-coding `tailwind.css`; feed all matched CSS into `parseClassVarMap` |
| Plugin shows 0 sections | Walker found no section elements | Check section selectors in walker; verify the built HTML exists at the expected path |
| Token binding fallback to grey | Token path not in variable collection | Confirm `tokenPath()` matches Figma variable names exactly |
