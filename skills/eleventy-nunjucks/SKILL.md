---
name: eleventy-nunjucks
description: "Eleventy v3 and Nunjucks operating guide for static-site authoring, templates, build pipelines, and security review. Use when the user asks to \"create an 11ty page\", \"add a Nunjucks filter\", \"fix my layout chain\", \"review my .njk template\", \"set up Eleventy\", \"set up Build Awesome\", or \"audit my static site\"; when working on 11ty, Eleventy, Build Awesome, or Nunjucks sites; when paths include `.eleventy.js`, `eleventy.config.js`, `.njk`, `src/_includes/`, or `src/_data/`; or when debugging Eleventy builds, permalinks, layout chains, filters, shortcodes, autoescape behavior, or static-site security."
license: MIT
compatibility: macOS, Linux, or Windows with Node >=18.20 (20 LTS recommended)
metadata:
  author: t4sh
  version: "0.1.4"
  tags: 11ty, eleventy, eleventy-v3, nunjucks, static-site, ssg, jamstack, tailwind, markdown-it, autoescape, xss-prevention, csp, design-tokens
---

# Eleventy + Nunjucks

Operational defaults for **Eleventy v3** and **Nunjucks** static sites — directory layout, configuration surface, filter inventory, autoescape rules, stability and security checks. Load this skill when authoring templates, editing build config, or reviewing static output before merge or deploy.

> **Naming note (June 2026):** Eleventy is also branded as **Build Awesome** — see the official [“Eleventy is now Build Awesome”](https://www.11ty.dev/blog/build-awesome/) announcement. Code identifiers remain compatible: npm package `@11ty/eleventy`, CLI `eleventy`, config `.eleventy.js` / `eleventy.config.js`, and docs at [11ty.dev](https://www.11ty.dev). This skill uses “Eleventy” for existing code and ecosystem terms; treat “Build Awesome” mentions in source material as synonymous.

## When this skill applies

Trigger on any of:

- Paths mentioning `.eleventy.js`, `eleventy.config.{js,mjs,cjs}`, `.njk`, `src/_includes/`, `src/_data/`
- `package.json` lists `@11ty/eleventy`
- Topics: 11ty, Eleventy, Nunjucks, SSG, JAMstack, static site, layout chain, permalink, collection, shortcode, filter, dev server, CSP, JSON-LD in templates

---

## Operating procedure

1. **Open the project's Eleventy config** (`.eleventy.js` or `eleventy.config.js`) and `package.json` scripts. This skill encodes common defaults; the checked-in config always wins.
2. **Open the reference file** that matches the task (table below). Avoid loading every reference unless the change is large.

Conventions and APIs here target **Eleventy v3 + Nunjucks 3** (May 2026). For upstream API drift, prefer current docs (e.g. context7 `/11ty/11ty-website`, `/mozilla/nunjucks`).

---

## Mental model (30 seconds)

| Topic | Common default |
|---|---|
| Eleventy | v3 — ESM-first configs, async-friendly, `@11ty/eleventy-dev-server` (not Browsersync) |
| Node | `>=18.20`; `>=20` LTS typical. JSON import-attribute examples require a runtime that supports `with { type: "json" }`. |
| Config name | `eleventy.config.js` preferred; `.eleventy.js` still valid |
| Engines | `.njk`, `.md`, `.html` — markdown runs **through** Nunjucks when `markdownTemplateEngine` is `njk` |
| Output dir | `out/` (not Eleventy's `_site/` default) |
| Input | Often `src/pages/` with `includes` / `data` as `../_includes`, `../_data` — or flat `src/` for small sites |
| Layouts | Under `src/_includes/layouts/`; chain via `layout:` in frontmatter |
| Sections / macros | `src/_includes/sections/…`, `src/_includes/macros/…` |
| Data | `src/_data/*.{json,js}` plus directory and template data — see `references/data-cascade.md` |
| CSS | Often Tailwind v4 CLI + `concurrently --kill-others-on-fail` — see `references/build-pipeline.md` |

---

## Non-negotiable rules

**Layout chain:** use `layout:` in frontmatter and `{{ content | safe }}` in parent layouts. **Do not** use `{% extends %}` / `{% block %}` for site shells — that bypasses Eleventy’s data cascade and frontmatter merge.

**Autoescape:** treat every `| safe` as a security boundary. Never mark user, CMS, or external HTML safe without sanitization. `dump` is for debug in `<pre>`, not inside executable `<script>`.

**Inline data in `<script>`:** use `jsonScript` or `jsonCompact` (see `references/filters.md`), not raw `JSON.stringify` or `dump | safe`.

**Flat permalinks + nginx `try_files $uri.html`:** `page.url` may end in `.html`. Ship `normalize_path` (see `references/filters.md`) for nav active state and canonical URLs.

**Passthrough copy:** prefer explicit `{ "src/path": "dest/path" }` maps — never copy `src/**/*` blindly.

**CSP `<meta>`:** emit only when `eleventy.env.runMode == "build"` so `--serve` live reload is not blocked. Deliver `frame-ancestors` via HTTP headers, not `<meta>`.

**Macros and scope:** `{% import %}` does not inherit page scope by default. If macros read `page.*` / `site.*`, use `with context` or pass arguments explicitly (see `references/nunjucks-syntax.md`).

**Markdown-it `html`:** keep `html: false` unless every markdown author is trusted; changing to `true` widens XSS risk.

**Before adding a new filter:** grep the project config for an existing filter with the same role — common 11ty projects duplicate `where` with incompatible coercion across files.

---

## Data cascade (merge order)

Higher steps override lower. When a variable is missing or wrong, walk this ladder top-down.

1. Eleventy defaults (`layout`, `tags`, …)
2. Global `src/_data/*.{json,js}`
3. `eleventyConfig.addGlobalData`
4. Directory data (`*.json`, `*.11tydata.js` beside templates)
5. Per-template data file (`*.11tydata.js` next to the template)
6. Template frontmatter (`---`)
7. `eleventyComputed` — runs last; reads everything above

Worked examples and pagination: `references/data-cascade.md`.

---

## Autoescape and the safe filter

Assume `foo` holds untrusted HTML such as a tag with an event handler.

| State | Result of `{{ foo }}` |
|---|---|
| `autoescape: true` (default) | Escaped — safe for text nodes |
| `autoescape: true` and value piped through the **safe** filter | Raw HTML — XSS if `foo` is untrusted |
| `autoescape: false` | Raw HTML — treat like global XSS risk |
| `autoescape: false` and **escape** filter applied | Escaped again |

Rules of thumb:

- Apply the `safe` filter only to trusted, sanitized HTML (or to the output of `jsonScript` / `jsonCompact` inside `<script>` as documented in `references/filters.md`).
- Avoid `{% autoescape false %}` except in tightly reviewed fragments; prefer narrowing with per-value filters.
- Markdown piped through a custom `md` filter is only as safe as `markdown-it`’s `html` flag — keep `html: false` for anything not fully trusted.

Full Nunjucks tag and macro rules: `references/nunjucks-syntax.md`.

---

## Reference files

| File | Load when |
|---|---|
| [references/eleventy-config-api.md](references/eleventy-config-api.md) | v2→v3 migration, config skeletons, `addFilter` / events / collections / server options |
| [references/conventions.md](references/conventions.md) | Directory layout, `dir` matrix, naming, scripts shape, when to deviate |
| [references/data-cascade.md](references/data-cascade.md) | Merge order, `eleventyComputed`, pagination, worked traces |
| [references/filters.md](references/filters.md) | Canonical filter source, `normalize_path`, `jsonScript`, async filters |
| [references/nunjucks-syntax.md](references/nunjucks-syntax.md) | Tags, macros, `with context`, built-in filters, `extends` vs 11ty layouts |
| [references/build-pipeline.md](references/build-pipeline.md) | Tailwind v4 + concurrently, lint/format, clean targets |
| [references/production-patterns.md](references/production-patterns.md) | CSP, View Transitions contract, nginx, after-build hooks, OG/JSON-LD patterns |
| [references/review-shipping.md](references/review-shipping.md) | PR greps, stability checklist, anti-patterns, page recipes |
| [references/security-checklist.md](references/security-checklist.md) | Pre-deploy XSS, headers, passthrough, secrets audit |
| [references/troubleshooting.md](references/troubleshooting.md) | 404 on `--serve`, double sections, autoescape surprises, hung builds |

---

## Related skills

**Same monorepo (skills4sh):** `agent-memory` (cross-session context), `localhost-screenshots` (visual regression for static sites).

**Ground truth wins:** when a project's checked-in `.eleventy.js` / `eleventy.config.js` disagrees with this skill, the project wins. Always read the actual config and `package.json` scripts before applying conventions from here.

---

## Minimal layout reminder

```nunjucks
{# Child page #}
---
layout: layouts/page.njk
title: Example
---
<section>Page body</section>
```

```nunjucks
{# layouts/page.njk #}
---
layout: layouts/base.njk
---
<main>{{ content | safe }}</main>
```

Each parent renders the child’s compiled body through `content`, then pipes through `safe` where the child emits HTML (11ty layouts that slot HTML always use `safe` on `content`).
