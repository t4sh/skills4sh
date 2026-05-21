# Tokens sync to Figma

A Figma plugin that keeps Figma in sync with the **design tokens that already live in your codebase**. Your code is the source of truth; this plugin pulls a CI-generated snapshot of it into Figma so designers see exactly what production renders.

## Why this plugin (the distinct point)

Most code↔Figma token tools are **agent- or API-mediated**: they need a Figma API token or Dev-Mode access, an MCP/agent runtime, and a human in the loop to approve each run. That is power at the cost of standing setup and per-use friction.

This plugin deliberately removes that dependency chain. **The recurring sync is a designer pasting one Gist URL and clicking one button — no agent, no Figma API token, no MCP, nothing to approve in-session.** The cost is paid once, up front (a CI job emits `figma-export.json`; the Gist URL is remembered after the first paste); from then on every sync reflects a *built and committed* state, never an in-session inference.

In one line: **CI-anchored, designer-operated, zero-credential token sync** — the lowest recurring-friction path to "Figma shows exactly what's in the code," with a least-privilege transport (a single allow-listed host and a documented JSON contract).

## The flow

```
┌─────────────┐   CI export    ┌──────────────┐   plugin fetch   ┌─────────┐
│  Codebase   │ ─────────────► │  GitHub Gist │ ───────────────► │  Figma  │
│ design      │  figma-        │  (raw JSON)  │   "Sync from CI" │  page   │
│ tokens      │  export.json   │              │                  │         │
└─────────────┘                └──────────────┘                  └─────────┘
        ▲                                                              │
        │              Figma variables mirror code tokens              │
        └──────────────────────────────────────────────────────────────┘
                 designers work against the same named tokens
```

1. **Code → export.** A CI job in your repo reads the real design tokens (colors, font families, sizes, letter-spacing, layout) and emits a single `figma-export.json` describing each page section and its token bindings.
2. **Export → Gist.** CI publishes that JSON to a GitHub Gist and exposes its **raw** URL.
3. **Gist → Figma.** A designer opens the plugin, pastes the Gist raw URL once (it is remembered), and clicks **Sync from CI**. The plugin rebuilds a page named **`Tokens Sync`**, one auto-layout frame per section, with every fill, font, size, and spacing **bound to a variable** in the local **`Design Tokens`** collection.

### One half of a deliberate pair

This plugin is **intentionally one-directional: code → Figma only.** It is the *freshness* leg — its single job is keeping Figma continuously current with code changes, with the lowest possible recurring friction. It never writes back to your repo.

The reverse leg (Figma → code) is a separate, explicitly different tool: the **`figma-to-code`** skill in this repo. That separation is the design, not a gap:

| Direction | Tool | Job |
|---|---|---|
| code → Figma | **this plugin** | Keep Figma a faithful, re-syncable mirror of committed code — zero-credential, designer-operated. |
| Figma → code | [`figma-to-code`](../../skills/figma-to-code/) skill | Bring design-side changes back into the codebase via the agent/MCP workflow. |

Because every imported property is bound to a *named* variable in the `Design Tokens` collection (not a hard-coded value), designers edit tokens whose names match the code-side tokens 1:1 — which is exactly what makes the `figma-to-code` leg tractable. The codebase stays the source of truth; this plugin keeps Figma honest about it.

Freshness is surfaced, not assumed: on open, the plugin reports how old the mirrored snapshot is (e.g. *"Figma reflects code as of 2026-05-19 (3 days old)"*) so a stale mirror is visible before anyone designs against it.

## Setup in Figma

| Requirement | Why |
|---|---|
| A local variable collection named **`Design Tokens`** | The plugin binds every property by variable name into this collection. |
| A mode named **`Light`** (or any first mode) | Used to resolve fallback colors/fonts when a binding can't be applied. |
| Variable names that match the token paths in `figma-export.json` | Lookup is by exact name; unmatched tokens fall back to a neutral default. |

The collection and variables are **not created by the plugin** — generate them from the same code tokens (e.g. a Variables import step) so both sides share one naming scheme.

> **v1 scope note.** Creating the variable collection is a one-time prerequisite you handle separately in v1. In v1.1 the Gist will carry a `tokens` section (W3C DTCG format) alongside `sections`, and the plugin will create or update the collection automatically on every sync — eliminating this prerequisite entirely. That work is paired with a companion `code-to-figma` skill that does the intelligent extraction on the code side and populates both halves of the Gist.

## `figma-export.json` contract

```jsonc
{
  "meta": { "generated": "2026-05-19T12:00:00Z" },   // ISO timestamp; shown in the done message
  "sections": [
    {
      "id": "hero",                 // used in the frame name "<id> · <name>"
      "name": "Hero",
      "bgToken": "color/bg/default", // COLOR variable name → frame background
      "nodes": [
        {
          "text": "Ship faster",
          "fontFamilyToken":   "font/family/display",  // STRING variable; first family in the stack is used
          "fontSizeToken":     "font/size/xl",         // FLOAT variable
          "letterSpacingToken":"font/tracking/tight",  // FLOAT variable
          "colorToken":        "color/text/strong"     // COLOR variable
        }
      ]
    }
  ]
}
```

All `*Token` fields are optional. A missing or unmatched token falls back to a sane default (neutral grey / Inter / 14px) rather than failing the import. A malformed export (no `sections` array, non-array `nodes`) is rejected **before** any page is touched — the mirror is never wiped for a bad artifact.

A complete, valid sample is in [`example/figma-export.json`](example/figma-export.json) — paste its Gist-hosted equivalent to try the plugin without wiring CI first.

## Generating the export in CI

The plugin does not care *how* the export is produced — only that the `{ meta, sections[] }` shape is honoured. [`example/generate-figma-export.mjs`](example/generate-figma-export.mjs) is an illustrative generator; adapt its `loadLayout()` to your real token source (Style Dictionary build, theme module, etc.). A minimal GitHub Actions step:

```yaml
- name: Publish figma-export.json
  run: |
    node example/generate-figma-export.mjs > figma-export.json
    gh gist edit "$FIGMA_EXPORT_GIST_ID" -f figma-export.json
  env:
    GH_TOKEN: ${{ secrets.GIST_TOKEN }}
    FIGMA_EXPORT_GIST_ID: ${{ vars.FIGMA_EXPORT_GIST_ID }}
```

The Gist's **raw** URL is what a designer pastes once into the plugin. After the first paste the URL and the preview-mode choice are remembered, so each subsequent refresh is a single click.

## Install (local / unpublished)

1. Figma → **Plugins → Development → Import plugin from manifest…**
2. Select `plugins/tokens-sync-to-figma/manifest.json`.
3. Run **Tokens sync to Figma**, paste the Gist raw URL, click **Sync from CI**.

## Manifest access

- `documentAccess: "dynamic-page"` — required by current Figma; pages/variables are loaded via the async APIs (`getLocalVariablesAsync`, `loadAllPagesAsync`, `setCurrentPageAsync`).
- `networkAccess.allowedDomains: ["https://gist.githubusercontent.com"]` — the only outbound host; the plugin fetches the export JSON and nothing else.

## Changelog

### 0.1.0

- Initial release: CI-anchored, zero-credential code → Figma token sync.
- Inspect-then-confirm flow with schema validation before any destructive rebuild.
- Optional preview page (build without replacing the canonical page).
- Continuous-freshness indicator: reports how old the mirrored snapshot is on open.
- Sample export + illustrative CI generator under `example/`.

## License

MIT - see [LICENSE](LICENSE) for Details. The root repository license is also available at [../../LICENSE](../../LICENSE).
