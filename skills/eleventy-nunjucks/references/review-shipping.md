# Review, pre-merge, and pre-deploy

Use this file for PR template checks, grep-based regression sweeps, stability walkthroughs before merge or ship, and common authoring snippets. For XSS, CSP, headers, and passthrough audits, use `security-checklist.md`. For build tooling, use `build-pipeline.md`.

## Anti-patterns

| Avoid | Why | Prefer |
|---|---|---|
| `{% extends %}` + `{% block %}` for site shell | Bypasses Eleventy data cascade and per-page frontmatter | `layout:` frontmatter; child body via `content` with the safe filter in the layout |
| `dump` chained to `safe` inside `<script>` | JSON-escaped, not JS-safe — `</script>` breakout | `jsonScript` / `jsonCompact` (`filters.md`) |
| Global `autoescape: false` | Broad XSS surface | Default on; per-value safe filter with justification |
| safe filter on CMS / form / external HTML | Direct XSS | Sanitize (e.g. DOMPurify) upstream |
| `markdown-it({ html: true })` on untrusted markdown | HTML injection | `html: false`; shortcodes for controlled HTML |
| `addPassthroughCopy("src/**/*")` | May ship secrets and tooling | Explicit `{ src: dest }` maps |
| Hardcoded colors / arbitrary px in templates | Breaks token system | CSS variables from design tokens |
| Reimplementing `where` / `limit` / `sort_by` per repo | Subtle drift across projects | Canonical set in `filters.md` |
| `_site/` output when deploy expects `out/` | Broken deploy scripts | `output: "out"` (or match host) |
| `{% import %}` using `page.*` / `site.*` without `with context` | Undefined inside macros | `with context` or explicit args |
| `eleventy.before` for static asset copy | Slower than passthrough | `addPassthroughCopy` |
| New section files without `-NN` variant | Blocks safe iteration | `<domain>-NN.njk`; switch includes to promote |
| `concurrently` without `--kill-others-on-fail` | Stale CSS while 11ty still runs | Always pass `--kill-others-on-fail` |
| Polling `/version.json` with CORS under strict CSP | Painful preflights | Build SHA in `<meta>` read at runtime |
| Skipping Prettier on `.njk` | Format drift | `prettier-plugin-jinja-template` + CI `format:check` |

## Syntax and security greps

Run from project root; set `file` or adjust paths per repo layout.

### Unclosed block tags

```bash
for kw in if for block macro autoescape raw; do
  open=$(grep -cE "{%[- ]*$kw\b" "$file")
  close=$(grep -cE "{%[- ]*end$kw\b" "$file")
  [ "$open" != "$close" ] && echo "$file: $kw mismatch ($open / $close)"
done
```

### Forbidden `extends` / `block` in `src/`

```bash
grep -rnE "{%[- ]*extends\b|{%[- ]*block\b" src/ && echo "FAIL: use layout: frontmatter and content slot with safe filter"
```

### `| safe` and `| dump` review

```bash
grep -rnE "\|\s*safe\b" src/
grep -rnE "\| *dump *\| *safe" src/
```

### Inline `<script>` without JSON escape filters

```bash
grep -rnE "<script>[^<]*{{[^|]+}}[^<]*</script>" src/ \
  | grep -v "jsonScript\|jsonCompact"
```

### `import` / `from` without `with context` when macros touch `page` / `site`

```bash
grep -rnE "{%\s*(import|from)\s+\"" src/ | while read -r line; do
  file=$(cut -d: -f1 <<< "$line")
  grep -q "with context" <<< "$line" && continue
  macro=$(grep -oE '"[^"]+"' <<< "$line" | head -1 | tr -d '"')
  grep -qE "page\.|site\." "src/_includes/$macro" 2>/dev/null \
    && echo "$line — imports $macro which references page/site without 'with context'"
done
```

### Hardcoded hex / px in templates

```bash
grep -rnE "#[0-9a-fA-F]{3,8}|: *[0-9]+px" src/_includes/sections/ src/pages/ \
  | grep -v "// allow"
```

### Missing `permalink` where flat-HTML convention applies

```bash
grep -L "^permalink:" src/pages/*.njk
```

### Markdown `html: true`

```bash
grep -nE "markdownIt\(\{[^}]*html:\s*true" .eleventy.js eleventy.config.* 2>/dev/null
```

## Stability checklist — pre-merge / pre-deploy

### Build

- [ ] `pnpm build` (or `npm run build`) completes clean
- [ ] `out/` page count matches expectations
- [ ] No `[11ty] Problem writing` in logs
- [ ] `pnpm lint && pnpm format:check` green
- [ ] Every `.njk` formatted (Prettier + jinja-template parser)

### Templates

- [ ] Pages have `title` and `description` where the layout expects them
- [ ] `permalink` set if the project uses flat `.html` URLs
- [ ] No `{% extends %}` / `{% block %}` for layout chains
- [ ] Layout slots use `{{ content | safe }}` where HTML output is intended
- [ ] Each `| safe` justified
- [ ] No `| dump | safe` in committed sources
- [ ] Macro imports that need `page` / `site` use `with context`

### Data cascade

- [ ] `_data/*.js` env reads have fallbacks for CI
- [ ] No accidental frontmatter shadow of global keys
- [ ] `eleventyComputed` only references upstream keys
- [ ] Pagination aliases and routes do not collide

### Pipeline

- [ ] `concurrently` uses `--kill-others-on-fail` where applicable
- [ ] Tailwind (or CSS) written before or watched by 11ty as designed
- [ ] `clean` removes `out/` and generated CSS if applicable
- [ ] Dev server port matches `package.json` / `setServerOptions`

### Dev / CSP

- [ ] `addWatchTarget` covers asset dirs that must rebuild
- [ ] Live reload verified on representative edits
- [ ] CSP meta not emitted when `runMode == "serve"` (see `production-patterns.md`)

### CI

- [ ] CI runs lint, format check, build
- [ ] No unexpected untracked files after build
- [ ] Build SHA / metadata surfaced as designed (if used)

## Common page recipes

### Marketing `.njk` page

```nunjucks
---
layout: layouts/page.njk
permalink: /products.html
title: Products
description: One-line meta description.
ogType: website
---
{% include "sections/hero/hero-01.njk" %}
{% include "sections/cta/cta-01.njk" %}
```

### Agent-facing `.md` page

```markdown
---
layout: layouts/base.njk
permalink: /products.md
title: Products
---

# Products

Plain markdown. Shortcodes work with `markdownTemplateEngine: "njk"`.
{% year %}
```

### JSON-LD from `_data`

```js
// src/_data/seoPricing.js
import pricing from "./pricing.json" with { type: "json" };

export default {
  jsonLd: {
    "@context": "https://schema.org",
    "@type": "Product",
    name: "Example",
    offers: pricing.tiers.map((t) => ({
      "@type": "Offer",
      name: t.name,
      priceCurrency: "USD",
      price: t.price,
    })),
  },
};
```

```nunjucks
<script type="application/ld+json">
  {{ seoPricing.jsonLd | jsonScript | safe }}
</script>
```
