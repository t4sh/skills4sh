# Conventions reference

Deep dive on directory layout, config file shape, and implicit defaults the main `SKILL.md` summary omits. Read when bootstrapping a new 11ty + Nunjucks project, porting a site, or judging whether a deviation from lineage convention is justified.

## Project layout — full anatomy

A complete project typically looks like this:

```
my-site/
├── .eleventy.js                  # OR eleventy.config.js (v3 preferred name)
├── .editorconfig                 # 2-space indent, LF, UTF-8
├── .gitignore                    # out/, out-*/, node_modules/, .DS_Store, src/assets/css/tailwind.css
├── .prettierrc                   # plugins: ["prettier-plugin-jinja-template"]
├── .prettierignore               # out/, node_modules/, src/assets/css/tailwind.css (generated)
├── .stylelintrc.json             # extends: ["stylelint-config-standard"]
├── eslint.config.mjs             # flat config — eslint 10+
├── package.json                  # see "Scripts shape" below
├── README.md
├── AGENTS.md                     # optional — agent-facing instructions
├── styles/
│   └── tailwind.input.css        # @tailwind directives + @theme blocks (Tailwind v4)
├── src/
│   ├── _data/                    # JSON + computed JS data
│   │   ├── site.json             # baseUrl, name, description
│   │   ├── nav.json              # navigation tree
│   │   └── *.js                  # computed (env-driven, derived)
│   ├── _includes/
│   │   ├── layouts/
│   │   │   ├── base.njk          # <html>…<body>{{ content | safe }}</body></html>
│   │   │   └── page.njk          # layout: layouts/base.njk + nav/footer
│   │   ├── sections/
│   │   │   └── <domain>/
│   │   │       └── <name>-NN.njk # numbered variants
│   │   └── macros/
│   │       └── <name>.njk        # {% macro %} fragments
│   ├── assets/
│   │   ├── css/
│   │   │   ├── tokens.css        # CSS custom properties
│   │   │   ├── base.css          # @layer base
│   │   │   ├── components.css    # @layer components
│   │   │   └── utilities.css     # @layer utilities
│   │   ├── js/                   # vanilla ES modules; one file per concern
│   │   └── images/
│   ├── pages/                    # Variant A only — see § The two valid `dir` configurations
│   │   ├── index.njk
│   │   └── *.{njk,md,html}
│   ├── robots.txt
│   └── sitemap.xsl
├── scripts/                      # optional — build tooling (inline-build, og-generate, etc.)
└── docs/                         # optional — design specs, content briefs
```

## The two valid `dir` configurations

### A — pages in subdirectory

```js
return {
  dir: {
    input:    "src/pages",
    includes: "../_includes",
    data:     "../_data",
    output:   "out",
  },
};
```

Use when the project has >10 pages, or when a clean separation between URL surface (`src/pages/`) and composition machinery (`src/_includes/`, `src/_data/`) is preferred.

The `../` in `includes` and `data` is because those paths are **resolved relative to `input`** — not the project root.

### B — flat `src/`

```js
return {
  dir: { input: "src", output: "out", includes: "_includes", data: "_data" },
};
```

No `../` because `input` is the same level as `_includes/` and `_data/`. Use for small sites (<10 pages).

## Universal config patterns

Every project in the lineage applies these. Establish them in any new project too.

### 1. Output directory is `out/`, not `_site/`

```js
return { dir: { /* … */ output: "out" } };
```

Why: deploys assume `out/`. nginx roots, CI pipelines, and `.gitignore` entries are all calibrated to `out/`. Sticking with the Eleventy default `_site/` introduces friction at deploy time.

### 2. Three-way template formats

```js
return { templateFormats: ["njk", "md", "html"] };
```

`.njk` for templates. `.md` for prose-heavy content. `.html` as a passthrough escape hatch (rarely used — most "pure HTML" pages still get a `.njk` extension to enable shortcodes).

### 3. Both engines as Nunjucks

```js
return {
  htmlTemplateEngine:     "njk",
  markdownTemplateEngine: "njk",
};
```

`markdownTemplateEngine: "njk"` means **markdown files are preprocessed through Nunjucks before markdown rendering**. This allows `{% include %}`, `{% set %}`, `{{ var }}`, and shortcodes to work inside `.md` files — critical for agent-facing markdown that needs dynamic content.

### 4. Three passthrough mappings — minimum

```js
eleventyConfig.addPassthroughCopy({ "src/assets/css":    "assets/css" });
eleventyConfig.addPassthroughCopy({ "src/assets/js":     "assets/js" });
eleventyConfig.addPassthroughCopy({ "src/assets/images": "assets/images" });
```

These three are universal. Add specific entries for `robots.txt`, `sitemap.xsl`, `public/`, or domain-specific docs (`*.md` agent files) on top.

### 5. Asset watch target

```js
eleventyConfig.addWatchTarget("src/assets/");
```

Without this, edits to CSS/JS files don't trigger rebuilds during `--serve`. Live reload misses everything outside the page templates.

### 6. Dev server port matches the script

```js
eleventyConfig.setServerOptions({ liveReload: true, domDiff: true, port: 3000 });
```

Set the port in **one place** — either here or in the `package.json` script (`eleventy --serve --port=3001`). If they differ, the port flag wins, and confusion follows.

## Scripts shape

Minimum `package.json` scripts for a Tailwind v4 + 11ty project:

```json
{
  "scripts": {
    "dev":           "pnpm run build:tailwind && concurrently --kill-others-on-fail --names tw,11ty --prefix-colors blue,green 'pnpm run dev:tailwind' 'pnpm run dev:eleventy --port=3000'",
    "dev:tailwind":  "tailwindcss -i styles/tailwind.input.css -o src/assets/css/tailwind.css --watch",
    "dev:eleventy":  "eleventy --serve",
    "build":         "pnpm run build:tailwind && eleventy",
    "build:tailwind":"tailwindcss -i styles/tailwind.input.css -o src/assets/css/tailwind.css --minify",
    "clean":         "rm -rf out src/assets/css/tailwind.css",
    "lint":          "pnpm run lint:js && pnpm run lint:css",
    "lint:js":       "eslint src/assets/js/",
    "lint:css":      "stylelint 'src/assets/css/**/*.css'",
    "format":        "prettier --write 'src/**/*.{css,js,json,njk}'",
    "format:check":  "prettier --check 'src/**/*.{css,js,json,njk}'",
    "verify":        "pnpm run lint && pnpm run format:check"
  }
}
```

Substitutions:
- pnpm → npm/yarn/bun based on project's `packageManager` field
- port 3000 → whatever conflict-free port the project owns

## File-naming conventions

### Pages

- Lowercase, hyphen-separated: `pricing-tiers.njk`, `lead-management.md`
- Match the URL slug exactly (the `permalink` should be a transformation of the filename)
- Reserved names: `index.njk` is the root for its directory

### Sections

`<domain>-NN.njk` where `<domain>` is the section category and `NN` is a 2-digit variant number:

```
src/_includes/sections/
├── hero/
│   ├── hero-01.njk            # original
│   ├── hero-02.njk            # next iteration; old still callable
│   └── hero-catalog-01.njk    # different shape, separate variant series
├── cta/
│   ├── cta-01.njk
│   └── cta-with-form-01.njk
└── footer/
    └── footer-01.njk
```

The numbered variants are **load-bearing**:
- A new variant ships under a new number without breaking existing pages
- Old pages keep working with the old variant
- Promote a variant globally by changing one `{% include %}` per consumer page

### Macros

Lowercase, hyphen-separated, no version number (macros are versioned by argument signature):

```
src/_includes/macros/
├── button.njk          # {% macro button(label, href, variant) %}
├── chip.njk            # {% macro chip(text, color) %}
└── icon.njk            # {% macro icon(name, size) %}
```

If a macro's signature needs to change incompatibly, add a new macro (`button-v2`) rather than break consumers.

### Data files

- `_data/site.json` — site-wide constants (name, baseUrl, description)
- `_data/nav.json` — navigation tree
- `_data/<domain>.json` — domain data (apps, pricing, FAQ)
- `_data/<domain>.js` — computed/derived data (env-driven, JSON-LD payloads)
- `_data/seo*.json` / `_data/seo*.js` — SEO payloads by page type (one per `seoHome`, `seoPricing`, etc.)

## Cross-project comparison

Patterns to expect (and accept) varying between projects:

| Aspect | Common range | Pick to match the project |
|---|---|---|
| Package manager | `pnpm@10.x`, `npm`, `bun` | Match the existing `packageManager` field; don't switch unasked |
| Node engine | `>=18`, `>=20`, `>=22`, `>=24` | Match the deploy environment; 20 LTS is the baseline |
| Dev port | `3000`, `3001`, `8080` | Pick something unique per project so multiple dev servers can coexist |
| Markdown `html` | `false` (safer) / `true` (more flexible) | `false` if any input is user-contributed; `true` if 100% authored content |
| Output flatten | `out/` only / `out/` + `out-standalone/` + `out-spa/` | Add flatten variants only when offline / portable deployment is required |
| Theme system | None / light-first / dark-first | Match the design brief; default to light-first |

## When to deviate

Convention is the default — not the prison. Deviate when:

- **The project is one HTML file.** Skip the section/macro/data structure; just a single `.njk` + minimal config.
- **The deploy target enforces a different output directory** (e.g. Cloudflare Pages wants `dist/`). Match the deploy target.
- **The project is a JSON API, not a website.** Pagination + `permalink: foo.json` + `eleventyExcludeFromCollections: true` is a valid pattern; the `_includes/` machinery is overkill.

Document any deviation in `AGENTS.md` so future agents don't try to "fix" it.
