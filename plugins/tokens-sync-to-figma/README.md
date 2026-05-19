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

### "…and back"

The plugin itself is one-directional (code → Figma): it never writes back to your repo. The round-trip is closed by **variables**, not by the plugin overwriting code. Because every imported property is bound to a named variable in the `Design Tokens` collection (rather than a hard-coded value), designers edit *tokens*, not detached styles. Those token names match the code-side tokens 1:1, so a design change is expressed in the same vocabulary the codebase uses — making it reviewable and portable back into code by your normal token workflow. The codebase stays the source of truth; Figma stays a faithful, re-syncable mirror.

## Setup in Figma

| Requirement | Why |
|---|---|
| A local variable collection named **`Design Tokens`** | The plugin binds every property by variable name into this collection. |
| A mode named **`Light`** (or any first mode) | Used to resolve fallback colors/fonts when a binding can't be applied. |
| Variable names that match the token paths in `figma-export.json` | Lookup is by exact name; unmatched tokens fall back to a neutral default. |

The collection and variables are **not created by the plugin** — generate them from the same code tokens (e.g. a Variables import step) so both sides share one naming scheme.

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

All `*Token` fields are optional. A missing or unmatched token falls back to a sane default (neutral grey / Inter / 14px) rather than failing the import.

## Install (local / unpublished)

1. Figma → **Plugins → Development → Import plugin from manifest…**
2. Select `plugins/tokens-sync-to-figma/manifest.json`.
3. Run **Tokens sync to Figma**, paste the Gist raw URL, click **Sync from CI**.

## Manifest access

- `documentAccess: "dynamic-page"` — required by current Figma; pages/variables are loaded via the async APIs (`getLocalVariablesAsync`, `loadAllPagesAsync`, `setCurrentPageAsync`).
- `networkAccess.allowedDomains: ["https://gist.githubusercontent.com"]` — the only outbound host; the plugin fetches the export JSON and nothing else.

## License

MIT — see the repository [LICENSE](../../LICENSE).
