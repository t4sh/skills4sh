# Conventions reference

Deep dive on Eleventy defaults and an opinionated production profile for directory layout, config shape, and scripts. Read when bootstrapping a new 11ty + Nunjucks project, porting a site, or judging whether the project should adopt the profile.

## Eleventy defaults versus this profile

| Surface | Eleventy default | Optional production profile below |
|---|---|---|
| Input | Project root (`.`) | `src/pages/` or flat `src/` |
| Includes / data | `_includes` / `_data` under input | Same names, adjusted relative to the selected input |
| Output | `_site/` | `out/` when deploy tooling is already built around it |
| Markdown / HTML preprocessor | Liquid | Nunjucks when the project selects `njk` |
| CSS pipeline | None prescribed | Optional Tailwind v4 workflow |

## Setup — new project on stable v3

Use this for a "set up Eleventy" request when no Eleventy project exists yet. In an existing project, skip it and follow the checked-in config. Commands use npm; substitute the package manager the repository already uses. Verified end to end with Eleventy 3.1.8 on Node 22, 2026-11-21; source: [Get Started](https://www.11ty.dev/docs/).

| Step | Action | Done when |
|---|---|---|
| 1 | `node --version` | It prints a supported LTS (22, 24, or 26); Eleventy v3 itself requires `>=18` |
| 2 | `npm init -y`, then `npm pkg set type="module"` for an ESM project | `package.json` exists with `"type": "module"` |
| 3 | `npm install @11ty/eleventy` | `npx @11ty/eleventy --version` prints the installed `3.x` version |
| 4 | Add the minimal `eleventy.config.js` below | The file exports a function that returns the input and output directories |
| 5 | Add `src/_includes/base.njk` containing `{{ content \| safe }}` and `src/index.njk` with `layout: base.njk` front matter | Both files exist under the configured input directory |
| 6 | Add the scripts `"build": "eleventy"` and `"dev": "eleventy --serve"`, then run the build | The build reports `Wrote 1 file` and `_site/index.html` contains the layout shell around the page body |

```js
// eleventy.config.js — ESM
export default function (eleventyConfig) {
  return {
    dir: { input: "src", output: "_site" },
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
  };
}
```

A config file is optional: without one, Eleventy reads the project root, writes `_site/`, and preprocesses `.md` and `.html` with Liquid. Add the Tailwind, lint, and directory profile below only when the project asks for it; use `eleventy-config-api.md` for filters, plugins, and passthrough copy.

## Project layout — full anatomy

> **Example deployment profile.** This section describes one project's deployment setup, not Eleventy or Nunjucks guidance. Load it only when the user asks for this kind of deployment work or the project already uses this pattern.

A project using this production profile typically looks like this:

```
my-site/
├── .eleventy.js                  # OR another supported config name; keep only the intended first match
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
│   └── tailwind.input.css        # @import "tailwindcss" + @theme blocks (Tailwind v4)
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
│   ├── pages/                    # Variant A only — see § Two example `dir` configurations
│   │   ├── index.njk
│   │   └── *.{njk,md,html}
│   ├── robots.txt
│   └── sitemap.xsl
├── scripts/                      # optional — build tooling (inline-build, og-generate, etc.)
└── docs/                         # optional — design specs, content briefs
```

## Two example `dir` configurations

> **Example deployment profile.** This section describes one project's deployment setup, not Eleventy or Nunjucks guidance. Load it only when the user asks for this kind of deployment work or the project already uses this pattern.

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

## Opinionated production-profile patterns

> **Example deployment profile.** This section describes one project's deployment setup, not Eleventy or Nunjucks guidance. Load it only when the user asks for this kind of deployment work or the project already uses this pattern.

Apply these only when they match the checked-in project and its deployment contract.

### 1. Use `out/` when the deployment profile expects it

```js
return { dir: { /* … */ output: "out" } };
```

Why: some deployments already calibrate nginx roots, CI pipelines, and ignore rules to `out/`. Keep Eleventy’s `_site/` default when no deployment contract requires a change.

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

Use only mappings for assets the project actually owns. Add specific entries for `robots.txt`, `sitemap.xsl`, `public/`, or domain-specific docs (`*.md` agent files) on top.

### 5. Asset watch target

```js
eleventyConfig.addWatchTarget("src/assets/");
```

Templates and passthrough-copied files are watched during `--serve` without this line; it is needed only for files Eleventy neither renders nor copies. A watch target does not cover gitignored files: Eleventy skips `.gitignore` paths when watching, so this profile's generated, gitignored `src/assets/css/tailwind.css` never triggers a rebuild, and the copy in the output directory stays stale until another change rebuilds the site. Serve passthrough files from source during `--serve` instead:

```js
eleventyConfig.setServerPassthroughCopyBehavior("passthrough");
```

The dev server then reads the stylesheet from `src/` and live-reloads when Tailwind rewrites it; builds without `--serve` still copy. `eleventyConfig.setUseGitIgnore(false)` also restores watching, but every other gitignored path under the input directory must then be excluded through `.eleventyignore`. Verified on Eleventy 3.1.8, 2026-11-21; see [passthrough copy](https://www.11ty.dev/docs/copy/) and [watch and serve](https://www.11ty.dev/docs/watch-serve/).

### 6. Dev server port matches the script

```js
eleventyConfig.setServerOptions({ liveReload: true, domDiff: true, port: 3000 });
```

Set the port in **one place** — either here or in the `package.json` script (`eleventy --serve --port=3001`). If they differ, the port flag wins, and confusion follows.

## Scripts shape

> **Example deployment profile.** This section describes one project's deployment setup, not Eleventy or Nunjucks guidance. Load it only when the user asks for this kind of deployment work or the project already uses this pattern.

Example `package.json` scripts for the optional Tailwind v4 + 11ty profile:

```json
{
  "scripts": {
    "dev":           "pnpm run build:tailwind && concurrently --kill-others-on-fail --names tw,11ty --prefix-colors blue,green \"pnpm run dev:tailwind\" \"pnpm run dev:eleventy\"",
    "dev:tailwind":  "tailwindcss -i styles/tailwind.input.css -o src/assets/css/tailwind.css --watch",
    "dev:eleventy":  "eleventy --serve --port=3000",
    "build":         "pnpm run build:tailwind && eleventy",
    "build:tailwind":"tailwindcss -i styles/tailwind.input.css -o src/assets/css/tailwind.css --minify",
    "clean":         "node -e \"const fs=require('fs'); fs.rmSync('out',{recursive:true,force:true}); fs.rmSync('src/assets/css/tailwind.css',{force:true});\"",
    "lint":          "pnpm run lint:js && pnpm run lint:css",
    "lint:js":       "eslint src/assets/js/",
    "lint:css":      "stylelint \"src/assets/css/**/*.css\"",
    "format":        "prettier --write \"src/**/*.{css,js,json,njk}\"",
    "format:check":  "prettier --check \"src/**/*.{css,js,json,njk}\"",
    "verify":        "pnpm run lint && pnpm run format:check"
  }
}
```

The `tailwindcss` command comes from the `@tailwindcss/cli` package; `tailwindcss` v4 itself ships no binary. Install both as dev dependencies (`pnpm add -D tailwindcss @tailwindcss/cli`), plus `concurrently` for the `dev` script. Checked against npm `bin` metadata for 4.3.5, 2026-11-21.

Substitutions:
- pnpm → npm/yarn/bun based on project's `packageManager` field
- port 3000 → whatever conflict-free port the project owns

## File-naming conventions

> **Example deployment profile.** This section describes one project's deployment setup, not Eleventy or Nunjucks guidance. Load it only when the user asks for this kind of deployment work or the project already uses this pattern.

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

Numbered variants are optional. If the project adopts them:
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
| Package manager | `pnpm`, `npm`, `bun` | Match the existing `packageManager` field; don't switch unasked |
| Node engine | v3 package floor `>=18`; supported deployments `>=22`, `>=24`, or `>=26` | Use a supported LTS: Node 26 is the Active LTS and preferred for new work; Node 24 and 22 are in maintenance and remain supported (Node release schedule, checked 2026-11-21). Never recommend EOL Node 18 or 20 for new deployments. |
| Dev port | `3000`, `3001`, `8080` | Pick something unique per project so multiple dev servers can coexist |
| Markdown `html` | `false` (safer) / `true` (more flexible) | `false` if any input is user-contributed; `true` if 100% authored content |
| Output flatten | `out/` only / `out/` + `out-standalone/` + `out-spa/` | Add flatten variants only when offline / portable deployment is required |
| Theme system | None / light-first / dark-first | Match the design brief; default to light-first |

## When to deviate

Convention is the default — not the prison. Deviate when:

- **The project is one HTML file.** Skip the section/macro/data structure; just a single `.njk` + minimal config.
- **The deploy configuration selects a different output directory.** Match its configured value; do not assume a host requires `dist/`.
- **The project is a JSON API, not a website.** Pagination + `permalink: foo.json` + `eleventyExcludeFromCollections: true` is a valid pattern; the `_includes/` machinery is overkill.

Document any deviation in `AGENTS.md` so future agents don't try to "fix" it.
