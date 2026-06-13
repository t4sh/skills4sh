# Build pipeline reference

The dev/build/lint anatomy. Read this when setting up a new project's tooling or debugging a build that "worked yesterday."

## Dev mode — what's actually running

```
$ pnpm dev
  └── pnpm run build:tailwind                              # one-shot: write tailwind.css before 11ty starts
  └── concurrently --kill-others-on-fail --names tw,11ty
        ├── pnpm run dev:tailwind                          # tailwind --watch (continuous)
        │     └── writes to src/assets/css/tailwind.css
        └── pnpm run dev:eleventy --port=3000              # eleventy --serve
              ├── reads src/assets/css/tailwind.css (passed through)
              ├── watches src/, src/assets/ (addWatchTarget)
              └── serves http://localhost:3000 with live reload
```

### The flags that matter

```bash
concurrently \
  --kill-others-on-fail \      # one process exits non-zero → kill all
  --names tw,11ty \            # log prefix per process (tw | …, 11ty | …)
  --prefix-colors blue,green \ # color the prefix per process
  'pnpm run dev:tailwind' 'pnpm run dev:eleventy --port=3000'
```

**`--kill-others-on-fail` is load-bearing.** Without it:
- Tailwind's input CSS has a syntax error → tailwind exits with code 1 → 11ty keeps running against stale `tailwind.css` → the screen looks fine but new utilities don't apply
- 11ty's config has a syntax error → 11ty exits → tailwind keeps writing → CI thinks the build is happy

### Order of operations matters

```json
"dev": "pnpm run build:tailwind && concurrently …"
```

The `pnpm run build:tailwind` before `concurrently` is intentional — it produces the initial `tailwind.css` so 11ty's first read finds something. Skip it and the first page loads with no styles.

## Build mode

```bash
$ pnpm build
  └── pnpm run build:tailwind         # writes minified tailwind.css
        tailwindcss -i styles/tailwind.input.css -o src/assets/css/tailwind.css --minify
  └── eleventy                         # one-shot build to out/
```

Output:

```
out/
├── assets/
│   ├── css/tailwind.css                # passthrough copy
│   ├── js/*.js                         # passthrough copy
│   └── images/*                        # passthrough copy
├── index.html
├── pricing.html                        # or pricing/index.html, depending on permalink
└── …
```

Verify after a clean build:

```bash
$ ls out/ | head
$ find out -name '*.html' | wc -l       # page count
$ find out -size 0                       # any empty files?
$ du -sh out/                            # total size
```

## Tailwind v4 integration

### Input file

```css
/* styles/tailwind.input.css */
@import "tailwindcss";

@theme {
  /* Custom tokens that Tailwind picks up as utilities */
  --color-brand:       oklch(0.62 0.21 24);
  --color-brand-fg:    oklch(0.98 0.02 24);
  --font-display:      "Inter Tight", system-ui, sans-serif;
  --font-mono:         "JetBrains Mono", ui-monospace, monospace;
  --spacing-tight:     0.5rem;
  --radius-pill:       9999px;
}

/* Project-specific @layer blocks */
@layer base {
  body { background: var(--color-bg); color: var(--color-fg); }
}

@layer components {
  .btn-primary { /* … */ }
}
```

### CLI invocation

```bash
# Watch mode (dev)
tailwindcss -i styles/tailwind.input.css -o src/assets/css/tailwind.css --watch

# Production
tailwindcss -i styles/tailwind.input.css -o src/assets/css/tailwind.css --minify
```

### Source scanning

Tailwind v4 auto-detects sources via the `@source` directive (or its absence — it scans the working directory by default). For 11ty:

```css
/* tailwind.input.css */
@import "tailwindcss";
@source "../src/**/*.{njk,md,html,js}";
```

Explicit `@source` is recommended — it limits the scan to project template files and avoids accidentally picking up classes in `node_modules/`.

## Linting

### ESLint (JS)

```js
// eslint.config.mjs — flat config, ESLint 10+
import js from "@eslint/js";
import globals from "globals";

export default [
  js.configs.recommended,
  {
    files: ["src/assets/js/**/*.js"],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "module",
      globals: { ...globals.browser },
    },
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },
];
```

Run:

```bash
pnpm lint:js        # eslint src/assets/js/
pnpm lint:fix:js    # eslint --fix
```

### Stylelint (CSS)

```json
// .stylelintrc.json
{
  "extends": ["stylelint-config-standard"],
  "rules": {
    "selector-class-pattern": null,         // allow utility-style class names
    "no-descending-specificity": null,      // common in component CSS
    "color-function-notation": "modern"     // oklch(0 0 0) not oklch(0, 0, 0)
  }
}
```

Run:

```bash
pnpm lint:css       # stylelint 'src/assets/css/**/*.css'
pnpm lint:fix:css   # stylelint --fix
```

### Prettier with `prettier-plugin-jinja-template`

```json
// .prettierrc
{
  "plugins": ["prettier-plugin-jinja-template"],
  "overrides": [
    { "files": "*.njk", "options": { "parser": "jinja-template" } }
  ]
}
```

`.prettierignore`:

```
out/
out-*/
node_modules/
src/assets/css/tailwind.css    # generated; don't format
```

Run:

```bash
pnpm format         # prettier --write
pnpm format:check   # prettier --check (CI gate)
```

## Standalone + SPA build variants

Some projects ship flatten + SPA pipelines on top of the 11ty output. The script lives at `scripts/inline-build.mjs`:

### What `--standalone` does

```
out/                         out-standalone/
├── pricing/index.html  →    pricing.html      (flat HTML, asset URLs rewritten)
├── about/index.html    →    about.html        (same)
├── assets/css/…              (inlined into <style>)
├── assets/js/…               (inlined into <script>)
└── assets/images/…           (kept; image paths absolute)
```

Use case: a single drop-in folder of `.html` files that work without a web server. Drop in S3, Cloudflare R2, IPFS, a USB stick.

### What `--spa` does

```
out/                         out-spa/
├── pricing/index.html  ┐
├── about/index.html    │ →  app.html           (single file)
├── …                   ┘    └── inlined CSS, JS, all routes
                             └── client-side router switches sections
```

Use case: an offline-capable app, an iframe-embeddable widget, a Figma plugin.

### Invocation

```json
"build:standalone": "node scripts/inline-build.mjs",
"build:spa":        "node scripts/inline-build.mjs --spa",
"build:inline":     "pnpm run build:standalone && pnpm run build:spa",
"build:all":        "pnpm run build && pnpm run build:inline"
```

Create a project-local `scripts/inline-build.mjs` for this step. It should handle the responsibilities your site needs — typically asset URL rewriting, JSON-LD preservation, SPA routing fallbacks, and minification — rather than depending on a private project script.

## CI integration

Minimum CI surface for a static site:

```yaml
# .github/workflows/build.yml
name: Build
on: [push, pull_request]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with: { version: 10 }
      - uses: actions/setup-node@v4
        with: { node-version: "22", cache: "pnpm" }
      - run: pnpm install --frozen-lockfile
      - run: pnpm verify          # lint + format:check + any project-specific checks
      - name: Build metadata
        id: build-metadata
        run: echo "iso=$(date -u +'%Y-%m-%dT%H:%M:%SZ')" >> "$GITHUB_OUTPUT"
      - run: pnpm build
        env:
          COMMIT_SHA: ${{ github.sha }}
          BUILT_AT:   ${{ steps.build-metadata.outputs.iso }}
      - name: Check for stray output
        run: |
          test -f out/index.html || (echo "missing index.html"; exit 1)
          find out -name '.env*' -o -name '*.key' -o -name 'id_rsa*' | \
            { ! grep -q .; } || (echo "secret-shaped file in out/"; exit 1)
```

## Turborepo integration (monorepo)

If the project lives in a `turbo`-managed monorepo, declare the tasks:

```json
// turbo.json
{
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["out/**", "out-*/**"]
    },
    "dev": { "cache": false, "persistent": true },
    "lint": { "outputs": [] },
    "verify": { "dependsOn": ["lint", "format:check"], "outputs": [] }
  }
}
```

Then from the monorepo root:

```bash
turbo run build --filter=<your-package>
turbo run verify --filter=<your-package>
```

Turborepo caches `out/` by input hash. A rebuild that touches nothing under `src/` returns instantly from cache.

## Common pipeline failures

| Symptom | Likely cause | Fix |
|---|---|---|
| `dev` shows no styles initially | `build:tailwind` not run before `concurrently` | Add `pnpm run build:tailwind &&` to the dev script |
| Edits to CSS don't trigger reload | `addWatchTarget("src/assets/")` missing | Add to `.eleventy.js` |
| Build is fast locally, slow in CI | No `--minify` on Tailwind in CI | Match scripts; or accept the slowness |
| `out/` has dev-only files (e.g. `tailwind.css.map`) | Source-maps enabled in dev, not gated for prod | `--no-source-map` in build:tailwind |
| Prettier mangles `.njk` indentation | Plugin not installed or wrong parser | `pnpm add -D prettier-plugin-jinja-template` and check `.prettierrc` |
| `pnpm verify` passes locally, fails in CI | Locale, line endings, Node version drift | Pin `engines.node`, use `pnpm install --frozen-lockfile` |
| Inline-build flatten breaks links | Page references absolute paths the flatten script doesn't rewrite | Use relative paths in templates, or extend `inline-build.mjs` URL rewriter |
