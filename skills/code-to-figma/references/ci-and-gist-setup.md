# CI and Gist setup

End-to-end guide for wiring the figma-sync pipeline in a new project.

---

## 1 — Create the Gist

One-time, run locally. **Disclosure:** the export can reveal design tokens, page structure, and unreleased UI names. Prefer a **secret gist** unless the user explicitly wants a public one. Secret gists are unlisted, not private access control — anyone with the raw URL can read them. Never include secrets, customer data, or private implementation details in `figma-export.json`.

POSIX shell:

```bash
printf '%s\n' '{"meta":{"generated":"placeholder"},"sections":[]}' \
  | gh gist create --secret --filename figma-export.json -
# Output: https://gist.github.com/<user>/<gist-id>
```

PowerShell:

```powershell
'{"meta":{"generated":"placeholder"},"sections":[]}' | gh gist create --secret --filename figma-export.json -
# Output: https://gist.github.com/<user>/<gist-id>
```

Note the Gist ID (the long hex string in the URL). The **raw URL** for the plugin is:

```
https://gist.githubusercontent.com/<user>/<gist-id>/raw/figma-export.json
```

---

## 2 — Set repo secrets

```bash
gh secret set FIGMA_EXPORT_GIST_ID --body "<gist-id>" --repo <org>/<repo>
gh secret set GIST_TOKEN --repo <org>/<repo>   # paste the PAT at the secure prompt
```

Do not put the PAT on the command line with `--body`; shell history and process logs can retain it. If you need a non-interactive shell, pipe from a secure secret manager into `gh secret set GIST_TOKEN --body-file - --repo <org>/<repo>`.

**`GIST_TOKEN`** must be a personal access token (PAT) with `gist` scope, owned by the same GitHub account that owns the Gist. `GITHUB_TOKEN` (the built-in Actions token) is repo-scoped and **cannot** patch Gists.

Create a PAT at [github.com/settings/tokens](https://github.com/settings/tokens). For a fine-grained PAT: "Gists" permission, read and write. No other scopes needed.

---

## 3 — CI workflow template

The template below assumes **pnpm + Turborepo + static export**. Adapt the setup/build steps to the detected stack: swap `pnpm/action-setup` + `pnpm install` for the project's package manager (npm `actions/setup-node` cache `npm` + `npm ci`; yarn/bun equivalents), and replace the `pnpm turbo run build` line with the project's real build (`next build` with `output: 'export'`, `npm run build`, `eleventy`, etc.). Replace the script paths with the exact files generated during setup if the project used different names. Only the walker, DTCG converter, and Gist-patch responsibilities are stack-agnostic.

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
      - 'scripts/tokens-to-figma/**'
      - '.github/workflows/figma-sync.yml'

concurrency:
  group: figma-sync
  cancel-in-progress: true

jobs:
  export:
    name: Walk + Gist patch
    runs-on: ubuntu-latest

    steps:
      # Pin third-party actions to audited full commit SHAs in real workflows.
      - uses: actions/checkout@<actions-checkout-v4-commit-sha>

      - uses: pnpm/action-setup@<pnpm-action-setup-v4-commit-sha>
        # reads packageManager from package.json

      - uses: actions/setup-node@<actions-setup-node-v4-commit-sha>
        with:
          node-version-file: .nvmrc
          cache: pnpm

      - name: Install
        run: pnpm install --frozen-lockfile

      - name: Build site
        run: pnpm turbo run build --filter="<site>..."   # ← adapt build command
        env:
          COMMIT_SHA: ${{ github.sha }}

      - name: Generate DTCG token artifact
        run: |
          node scripts/tokens-to-figma/convert-to-dtcg.mjs
          git diff --exit-code -- scripts/tokens-to-figma/*.w3c.json

      - name: Walk HTML → figma-export.json
        # Use `node` directly, NOT `pnpm <script>`.
        # pnpm writes a script header to stdout which corrupts the JSON file.
        run: node scripts/figma-export/walk-<site>.mjs > "$RUNNER_TEMP/figma-export.json"

      - name: Validate + log summary
        run: |
          jq -e '.sections | type == "array"' "$RUNNER_TEMP/figma-export.json" >/dev/null
          jq -e 'all(.sections[]; .nodes | type == "array")' "$RUNNER_TEMP/figma-export.json" >/dev/null
          sections=$(jq '.sections | length' "$RUNNER_TEMP/figma-export.json")
          nodes=$(jq '[.sections[].nodes | length] | add // 0' "$RUNNER_TEMP/figma-export.json")
          echo "Sections: $sections  Nodes: $nodes"

      - name: Validate and patch Gist
        env:
          GIST_TOKEN: ${{ secrets.GIST_TOKEN }}
          GIST_ID:    ${{ secrets.FIGMA_EXPORT_GIST_ID }}
        run: node scripts/tokens-to-figma/push-to-figma.mjs --file "$RUNNER_TEMP/figma-export.json"
```

> **Why `node` not `pnpm <script>`**: pnpm's script runner writes a `> package-name@version scriptname` header to stdout before the script runs. When stdout is redirected to a file (`> "$RUNNER_TEMP/figma-export.json"`), that header lands in the file and makes it invalid JSON. Calling `node` directly sidesteps this.

---

## 4 — Verify locally before relying on CI

```bash
# Build the site first
pnpm build   # or equivalent

# Run the walker; jq -e exits non-zero when sections is missing or not an array
node scripts/figma-export/walk-<site>.mjs | jq -e '.sections | type == "array"'

# Load the PAT from a secure secret manager into the environment; never type it
# on the command line. Replace the placeholder with your manager's read command.
export GIST_TOKEN="$(<secret-manager-read-command>)"

# Push manually. The pusher reads gistId from figma-sync.config.json by default.
node scripts/figma-export/walk-<site>.mjs | node scripts/tokens-to-figma/push-to-figma.mjs
unset GIST_TOKEN
```

---

## 5 — Connect the Figma plugin

1. In the Figma desktop app: **Plugins → Development → Import plugin from manifest** → select `plugins/tokens-sync-to-figma/manifest.json` from a local clone of [skills4sh](https://github.com/t4sh/skills4sh). The plugin is not published to the Figma Community; a development import from the repo clone is the only install path.
2. Run **Tokens sync to Figma**.
3. Paste the Gist raw URL and click **Sync from CI**.

The raw URL format:
```
https://gist.githubusercontent.com/<user>/<gist-id>/raw/figma-export.json
```

The plugin remembers the URL after the first paste.

### Prerequisite: Design Tokens variable collection

The plugin does not create or update Figma variables. It fetches only `figma-export.json` (`meta` + `sections`) from the Gist, binds each `*Token` field to an existing local variable whose name matches the token path exactly, and resolves fallback values from the **`Light`** mode (or first mode) of a local collection named **`Design Tokens`**. Unmatched tokens fall back to neutral defaults (grey / Inter / 14px).

Creating that collection is therefore a one-time prerequisite. Repeat it only when tokens are added, renamed, or removed; the plugin will not pick those changes up on its own. Build the collection from the committed `<project>-tokens.w3c.json` so both sides share one naming scheme, and do not describe the plugin as importing or synchronizing the DTCG artifact.

Token type mapping when creating variables: DTCG `color` → COLOR; `dimension`, `number`, `fontWeight`, `duration` → FLOAT (px or unitless value); `fontFamily` → STRING (first family in the stack). Use the slash-delimited token path as the variable name.

**Manual path (always available).** In the target Figma file, open the Variables panel, create a collection named `Design Tokens`, rename its first mode to `Light`, and add one variable per token from the `.w3c.json` using the mapping above. A Variables import plugin the team already trusts is equivalent if it preserves the exact names.

**Optional agent path (one-time, via the official Figma MCP).** When the user's agent session has the Figma MCP server connected and the `use_figma` tool is available to them, an agent can create the collection once from the `.w3c.json`. Figma documents `use_figma` as a remote-server tool for writing to Figma files, including variables ([Figma MCP tools and prompts](https://developers.figma.com/docs/figma-mcp-server/tools-and-prompts/), checked 2026-10-21). Availability depends on the user's Figma plan, seat, and MCP client; this guide does not verify it, so check the tool list before offering this path.

1. Load the official [`figma-use`](https://github.com/figma/mcp-server-guide/tree/main/skills/figma-use) skill before any `use_figma` call (checked 2026-10-21). For a reusable variable collection it directs agents to also load `figma-generate-library`.
2. Run a read-only `use_figma` call that lists local variable collections. If `Design Tokens` already exists, stop and ask whether to update it; never create a duplicate collection.
3. With the user's approval for the write, create `Design Tokens`, rename the default mode to `Light`, and create one variable per `.w3c.json` token with the mapping above and explicit `scopes` (`figma-use` requires setting them rather than keeping the default `ALL_SCOPES`). Return the collection ID, mode name, and variable count.
4. Compare the returned count with the number of tokens in the `.w3c.json`, then run **Sync from CI** and confirm that no tokens fall back to grey.

This agent step is setup only. CI, the Gist, and the recurring designer-run sync stay credential-free and agent-free.

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
| `GIST_TOKEN: ` (empty in CI log) | Secret not set | `gh secret set GIST_TOKEN --repo <org>/<repo>` |
| `Gist PATCH failed: 404` | GIST_ID wrong or Gist deleted | Check `gh api gists/<id>` |
| `Gist PATCH failed: 403` | PAT missing `gist` scope | Create new PAT with gist scope |
| `ENOENT` on the walker's `readFileSync(... index.html)` | Next.js (or other SSR/streamed framework) emitted no static HTML file | Enable `output: 'export'` in `next.config` and rebuild, or point the walker at a fully-static prerendered route — see the Next.js note in `walker-patterns.md`. Do not guess a `.next/server/app/page.html` path. |
| `ENOENT` on the CSS read | CSS filename is content-hashed (Next.js `.next/static/css/*.css`) | Glob the hashed CSS name instead of hard-coding `tailwind.css`; feed all matched CSS into `parseClassVarMap` |
| Plugin shows 0 sections | Walker found no section elements | Check section selectors in walker; verify the built HTML exists at the expected path |
| Token binding fallback to grey | Token path not in variable collection | Confirm `tokenPath()` matches Figma variable names exactly |
