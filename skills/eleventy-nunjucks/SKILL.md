---
name: eleventy-nunjucks
description: "Build, debug, and review Eleventy v3 sites and Nunjucks templates. Use when `package.json` includes `@11ty/eleventy` or `@awesome.me/buildawesome`; when paths include `.eleventy.js`, `eleventy.config.*`, `buildawesome.config.*`, `.njk`, `.11tydata.js`, or `.11ty.js`; when asked to \"create an 11ty page\", \"add a Nunjucks filter\", \"fix my layout chain\", \"review my .njk template\", \"set up Eleventy\", or \"migrate to Build Awesome\" (v4 prerelease); or when debugging Eleventy data cascades, shortcodes, autoescape, or `| safe` output. Standalone Nunjucks work is in scope; generic static-site, SSG, or CSP tasks need confirmed Eleventy or Nunjucks context."
license: MIT
compatibility: macOS, Linux, or Windows; Eleventy v3 supports Node >=18, but a supported LTS (Node 22, 24, or 26) is recommended
metadata:
  author: t4sh
  version: "1.1.0"
  tags: 11ty, eleventy, eleventy-v3, build-awesome, build-awesome-v4, nunjucks, static-site, ssg, jamstack, tailwind, markdown-it, autoescape, xss-prevention, csp, design-tokens
---

# Eleventy + Nunjucks

Operational defaults for **Eleventy v3** and **Nunjucks** static sites — directory layout, configuration surface, filter inventory, autoescape rules, stability and security checks.

> **Version boundary (rechecked November 21, 2026 via npm dist-tags and release notes):** Eleventy `3.1.8` (released 2026-11-03) is the stable production baseline and depends on Mozilla `nunjucks@^3.2.4`. If `npm view @11ty/eleventy dist-tags.latest` is newer than `3.1.8`, read the intervening release notes before relying on version-specific claims. Build Awesome `4.0.0-alpha.12` is a prerelease available through `@11ty/eleventy@canary` or `@awesome.me/buildawesome@alpha`. Keep stable guidance as the default and load [`references/build-awesome-v4.md`](references/build-awesome-v4.md) before any v4 install or migration.

---

## Operating procedure

1. **Open `package.json` and the active Eleventy config; search the lockfile for the resolved package version.** Identify module type, Node engine, and the first config filename Eleventy resolves. Checked-in project behavior always wins. Done when the resolved version, module type, and config path are known.
2. **Choose the track.** Use the stable v3 guidance by default. Done when one track is named with its evidence.
   - **v4:** the project uses a v4 canary, the Build Awesome package, or config that explicitly enables the generic `.data.*` / `.server.*` suffixes. Load `build-awesome-v4.md` and enforce its version-drift stop condition. Those filenames alone are not proof of v4: confirm package identity and resolved version first.
   - **Standalone Nunjucks (no Eleventy package):** use `nunjucks-syntax.md` and the autoescape rules. Eleventy features (`layout:`, the data cascade, shortcodes, `setAsync`) do not exist there; the project's own render or test command replaces gate item 1.
   - **Eleventy below v3:** report the version and stop before applying v3 config, ESM, or plugin guidance; Nunjucks syntax still applies, and upgrading needs the user's go-ahead.
   - **Liquid templates** (`.liquid`, or `.md` / `.html` on the default `liquid` preprocessor): Nunjucks syntax and autoescape rules do not apply; Liquid output is not escaped. Keep the engine unless asked to switch.
3. **Open the task-specific reference** from the core table below; load only the rows the task matches. For a new project, follow `conventions.md` § Setup. Done when the section governing the change is identified.

For upstream drift, prefer [11ty.dev](https://www.11ty.dev/docs/), [`11ty/buildawesome`](https://github.com/11ty/buildawesome), and the active package metadata; treat dated claims as revalidation markers.

### Completion gate

Before calling work complete, verify the project-specific result rather than only applying this skill's defaults:

1. The relevant Eleventy build, dev-server smoke check, or project test command passes.
2. Site shells that need layout frontmatter, cascade behavior, or layout chaining use Eleventy `layout:` and render `{{ content | safe }}` intentionally; any Nunjucks `extends` usage is reviewed as a separate inheritance path.
3. Every new or changed `| safe`, shortcode, custom autoescape extensions, inline JSON/script data path, and markdown `html` setting has been reviewed against the trust boundary.
4. The task-specific reference checklist was applied when relevant (`review-shipping.md` for PR review, `security-checklist.md` for deploy/security, etc.).
5. Rendered output or generated HTML was inspected for the touched page, layout, filter, shortcode, or data cascade.

---

## Mental model (30 seconds)

Read paths from the active project config.

| Topic | Framework behavior or project choice |
|---|---|
| Eleventy | Stable v3.1.8 by default; Build Awesome v4 remains prerelease and version-gated |
| Node | v3 package floor `>=18`; use a supported LTS (Node 26 Active LTS preferred; 24 and 22 are maintenance LTS). v4 prerelease requires `>=22.15`. |
| Config name | v3 search order: `.eleventy.js`, `eleventy.config.js`, `eleventy.config.mjs`, `eleventy.config.cjs`; the first match wins. v4 checks `buildawesome.config.*` first |
| Engines | `.njk`, `.md`, `.html` — markdown runs **through** Nunjucks when `markdownTemplateEngine` is `njk` |
| Output dir | Eleventy default `_site/`; preserve configured `dir.output` |
| Input | Eleventy default project root; preserve configured `dir.input` |
| Layouts | Resolve from configured layout/include directories; chain via `layout:` |
| Sections / macros | Follow existing include paths |
| Data | Use configured global-data directory plus directory/template data. See `references/data-cascade.md`. |
| CSS | Project-selected |

---

## Non-negotiable rules

**Layout chain:** prefer `layout:` and `{{ content | safe }}` for site shells that require Eleventy layout frontmatter, cascade behavior, or layout chaining. Nunjucks `{% extends %}` is supported, but frontmatter in the extended parent template is not processed.

**Autoescape:** treat every `| safe` as a security boundary. Never mark user, CMS, or external HTML safe without sanitization. `dump` is for debug in `<pre>`, not inside executable `<script>`.

**Inline data in `<script>`:** use `jsonScript` or `jsonCompact` (see `references/filters.md`), not raw `JSON.stringify` or `dump | safe`.

**Passthrough copy:** prefer explicit `{ "src/path": "dest/path" }` maps — never copy `src/**/*` blindly.

**Macros and scope:** `{% import %}` does not inherit page scope by default. If macros read `page.*` / `site.*`, use `with context` or pass arguments explicitly (see `references/nunjucks-syntax.md`).

**Markdown trust:** keep `html: false` for untrusted Markdown data. Nunjucks template source must be trusted: Markdown preprocessing executes before Markdown rendering, so `html: false` does not sandbox `.md` templates. Render untrusted text as data through the `md` filter; never compile it as Nunjucks source.

**Before adding a new filter:** inspect the project config and Nunjucks built-ins for an existing filter with the same role — common 11ty projects duplicate `where` with incompatible coercion across files.

---

## Data cascade (priority order)

Highest priority wins. When a variable is missing or wrong, trace this official order before considering Eleventy-supplied values such as `page`, `collections`, or `eleventy`.

1. `eleventyComputed`
2. Template frontmatter
3. Template data files
4. Directory data files, ascending through parent directories
5. Layout frontmatter
6. `eleventyConfig.addGlobalData`
7. Global data files

Worked examples and pagination: `references/data-cascade.md`.

---

## Autoescape and the safe filter

Assume `foo` holds untrusted HTML such as a tag with an event handler.

| State | Result of `{{ foo }}` |
|---|---|
| `autoescape: true` (default) | Escaped — safe for text nodes |
| `autoescape: true` and value piped through the **safe** filter | Raw HTML — XSS if `foo` is untrusted |
| `autoescape: false` | Raw HTML — treat like global XSS risk |
| `autoescape: false` and **escape** filter applied | Escaped once |

Rules of thumb:

- Apply the `safe` filter only to trusted, sanitized HTML (or to the output of `jsonScript` / `jsonCompact` inside `<script>` as documented in `references/filters.md`).
- Stock Nunjucks 3 has no `{% autoescape %}` block tag. Keep environment autoescaping enabled; review custom extensions separately.
- Markdown piped through a custom `md` filter is only as safe as `markdown-it`’s `html` flag — keep `html: false` for anything not fully trusted.
- Autoescape covers HTML text and quoted attribute values only: shortcode output, unquoted attributes, `javascript:` URLs, and inline event handlers need `references/security-checklist.md` §1.

Full Nunjucks tag and macro rules: `references/nunjucks-syntax.md`.

---

## Reference files

### Core references

| File | Load when |
|---|---|
| [references/eleventy-config-api.md](references/eleventy-config-api.md) | v2→v3 migration, config skeletons, method signatures (`addFilter` / events / collections / server options), first-party plugins |
| [references/build-awesome-v4.md](references/build-awesome-v4.md) | Build Awesome v4 prerelease detection, migration gates, Node/Nunjucks/data changes |
| [references/conventions.md](references/conventions.md) | New-project setup, Eleventy defaults, when to deviate |
| [references/data-cascade.md](references/data-cascade.md) | Merge order, wrong value in a page or layout, `eleventyComputed`, pagination, worked traces |
| [references/filters.md](references/filters.md) | Canonical filter source, date filters, `jsonScript`, async filters, shortcode escaping |
| [references/nunjucks-syntax.md](references/nunjucks-syntax.md) | Tags, macros, `with context`, built-in filters, async limits, `extends` vs 11ty layouts |
| [references/review-shipping.md](references/review-shipping.md) | PR greps, stability checklist, anti-patterns, page recipes |
| [references/security-checklist.md](references/security-checklist.md) | Template XSS review (§1, §4); pre-deploy headers, passthrough, secrets audit, by its scope table |
| [references/troubleshooting.md](references/troubleshooting.md) | 404 on `--serve`, missing layout, double sections, shortcodes in `.md`, autoescape surprises, hung builds |

### Example deployment profile (load on request)

One project's deployment setup, not Eleventy or Nunjucks guidance, and never a reason to migrate an existing project. Load these rows, and the sections carrying the same banner in the core files, only when the user asks for this kind of deployment work or the project already uses the pattern.

| File | Load when |
|---|---|
| [references/conventions.md](references/conventions.md) (bannered sections) | Directory layout, `dir` matrix, naming, scripts shape |
| [references/build-pipeline.md](references/build-pipeline.md) | Tailwind v4 + concurrently, lint/format, clean targets |
| [references/production-patterns.md](references/production-patterns.md) | CSP, optional soft-navigation contract, nginx, after-build hooks, OG/JSON-LD patterns |

Profile values: output `out/`; input `src/pages/` or `src/`; layouts `src/_includes/layouts/`; sections and macros `src/_includes/sections/…` and `src/_includes/macros/…`; data `src/_data/`; CSS through Tailwind v4 CLI + `concurrently --kill-others-on-fail`.

Profile rules:

**Flat permalinks + nginx `try_files $uri.html`:** `page.url` may end in `.html`. Ship `normalize_path` (see `references/filters.md`) for nav active state and canonical URLs.

**CSP:** prefer production HTTP headers. If the project uses a CSP `<meta>`, omit or adapt it during `--serve` so live reload is allowed. Deliver `frame-ancestors` via HTTP headers, never `<meta>`.

## Behavioral evaluations

**Authors/reviewers only:** use the [evaluation catalog](assets/evals/scenarios.json) when explicitly evaluating this skill; skip it during normal site work. Its cases cover track selection, layout debugging, Markdown trust, escaping review, date filters, async templates, project conventions, profile routing, audit paths, and retrieval boundaries. Keep assertions hidden from the acting agent and record observed results separately; scenarios are expectations, not recorded runs. Synthetic version inventories do not certify v4 execution, and description-only routing does not measure host discovery.

---

## Related skills

**Same monorepo (skills4sh):** `agent-memory` (cross-session context), `localhost-screenshots` (visual regression for static sites).

**Ground truth wins:** when a project's checked-in config or `package.json` scripts disagree with this skill, the project wins.

---

## Minimal layout reminder

Example: Child page

```nunjucks
---
layout: layouts/page.njk
title: Example
---
<section>Page body</section>
```

Example: layouts/page.njk

```nunjucks
---
layout: layouts/base.njk
---
<main>{{ content | safe }}</main>
```

Each layout renders the child’s compiled body with `{{ content | safe }}`.
