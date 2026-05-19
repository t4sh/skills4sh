# figma-export.json contract

The Gist artifact consumed by the `tokens-sync-to-figma` Figma plugin.

## v1 shape — `{ meta, sections[] }`

```jsonc
{
  "meta": {
    "generated": "2026-05-19T12:00:00Z",  // ISO timestamp — shown in plugin done message
    "source": "apps/site/out/index.html", // optional, for traceability
    "variableCollection": "Design Tokens",   // Figma variable collection name, optional
    "figmaFile": "<file-key>"                // optional
  },
  "sections": [
    {
      "id": "hero",           // used in frame name: "<id> · <name>"
      "name": "Hero",
      "tag": "header",        // HTML tag, informational only
      "variant": "default",   // optional: "dark" | "dim" | "default"

      // All *Token fields are optional. Missing or unmatched → sane default.
      "bgToken":            "color/bg/default",       // COLOR variable
      "borderToken":        "color/border/subtle",    // COLOR variable

      "nodes": [
        {
          "tag": "h1",
          "text": "Ship faster",                      // first 200 chars
          "fontFamilyToken":   "font/family/display", // STRING variable
          "fontSizeToken":     "font/size/2xl",       // FLOAT variable
          "letterSpacingToken":"font/tracking/tight", // FLOAT variable
          "colorToken":        "color/text/strong"    // COLOR variable
        }
      ]
    }
  ]
}
```

## v1.1 shape — `{ meta, tokens, sections[] }` (future)

Adds a `tokens` key containing a W3C DTCG token tree. The plugin v1.1 will create or update the Figma variable collection from this before building frames — eliminating the manual prerequisite. The `code-to-figma` skill will populate this from the `convert-to-w3c.mjs` output.

## Token field → Figma variable type

| Field | Figma type | What it binds |
|---|---|---|
| `bgToken` | COLOR | Frame background fill |
| `borderToken` | COLOR | Frame stroke |
| `colorToken` | COLOR | Text fill |
| `fontFamilyToken` | STRING | Font family (first stack entry) |
| `fontSizeToken` | FLOAT | Font size in px |
| `letterSpacingToken` | FLOAT | Letter spacing in px |

## Failure behaviour (plugin)

- Missing or unmatched token → falls back to neutral default (grey / Inter / 14px), does not abort
- Malformed JSON (no `sections` array, non-array `nodes`) → rejected before any page is touched
- Wrong Gist URL → error shown before Sync button is enabled

## Token path format

Slash-delimited paths matching Figma variable names in the `Design Tokens` collection:

```
palette/beige/50
typography/scale/xl
color/bg/default
font/family/display
font/tracking/tight
```

The `tokenPath()` function in the walker must produce paths that exactly match variable names in the collection. Lookup is case-sensitive.
