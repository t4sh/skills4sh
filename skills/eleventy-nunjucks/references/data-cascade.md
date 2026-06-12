# Data cascade reference

Worked examples of Eleventy's 7-level merge ladder. Read when a variable is missing or wrong in templates, or when designing new global vs per-route data.

## The ladder, again

**Higher overrides lower** — every level is merged into the data that reaches the template.

| # | Source | Path | Scope |
|---|---|---|---|
| 1 | Eleventy defaults | (internal) | `layout`, `tags` |
| 2 | Global data files | `src/_data/*.{json,js,cjs}` | All templates |
| 3 | Config global data | `eleventyConfig.addGlobalData(key, fn)` | All templates |
| 4 | Directory data files | `src/pages/<dir>/<dir>.json` or `<dir>.11tydata.js` | All templates in `<dir>` |
| 5 | Template data file | `src/pages/post-1.11tydata.js` | One template |
| 6 | Template frontmatter | The `---` block in the template | One template |
| 7 | `eleventyComputed` | Object in frontmatter or data | One template, runs **last** |

## Worked example 1 — building a per-page `canonicalUrl`

### Goal

Every page gets a `canonicalUrl` of the form `https://site.example/<path>`. The base URL must come from env (configurable), and the path must normalize the trailing `.html`.

### Implementation

**Level 2 — global data file:**

```js
// src/_data/site.js
module.exports = {
  baseUrl: process.env.SITE_BASE_URL || "https://erpai.studio",
  name:    "ERP•AI",
};
```

**Level 7 — eleventyComputed in frontmatter:**

```yaml
# src/pages/pricing.njk
---
layout: layouts/page.njk
title: Pricing
permalink: /pricing.html
eleventyComputed:
  canonicalUrl: "{{ site.baseUrl }}{{ page.url | normalize_path }}"
---
```

**Or, lifted to base.njk so every page gets it automatically:**

```nunjucks
{# src/_includes/layouts/base.njk #}
{% set canonicalUrl = site.baseUrl + (page.url | normalize_path) %}
<link rel="canonical" href="{{ canonicalUrl }}" />
```

The template-level pattern is cleaner; `eleventyComputed` is the escape hatch when the value needs to be in the cascade itself (e.g. consumed by another data file or plugin).

## Worked example 2 — overriding global data per page

### Goal

`_data/site.json` declares the default OG image. A specific page wants to override it.

### Cascade trace

```js
// _data/site.json — Level 2
{ "ogImage": "/assets/images/og/default.png" }
```

```yaml
# src/pages/launch.njk — Level 6 (frontmatter)
---
ogImage: "/assets/images/og/launch-hero.png"
---
```

In the template:

```nunjucks
<meta property="og:image" content="{{ site.baseUrl }}{{ ogImage }}" />
```

| Page | Resolved `ogImage` |
|---|---|
| `/launch.html` | `/assets/images/og/launch-hero.png` (Level 6 wins) |
| All other pages | `/assets/images/og/default.png` (Level 2) |

**Gotcha:** the override only works because `site.json` and the frontmatter use the same key name `ogImage`. If the JSON key were `site.ogImage` and the template read `site.ogImage`, the frontmatter wouldn't override it — it would set a separate `ogImage` variable at the top level.

## Computed `_data/*.js` patterns

### Env-driven base URL with fallback

```js
// src/_data/site.js
module.exports = {
  baseUrl: process.env.SITE_BASE_URL || "https://example.com",
  buildSha: process.env.COMMIT_SHA   || "dev",
  buildAt:  process.env.BUILT_AT     || new Date().toISOString(),
};
```

`process.env.X || fallback` is load-bearing — without the fallback, the build crashes in CI if the var is unset.

### Derived data from JSON

```js
// src/_data/seoPricing.js
const pricing = require("./pricing.json");

module.exports = {
  jsonLd: {
    "@context": "https://schema.org",
    "@type":    "Product",
    "name":     "Platform",
    "offers":   pricing.tiers.map((t) => ({
      "@type":         "Offer",
      "name":          t.name,
      "priceCurrency": "USD",
      "price":         t.price,
    })),
  },
};
```

Computing once at build time beats computing in every template that needs it.

### External data: prefer checked-in cache

```js
// src/_data/repos.js - deterministic build input
module.exports = () => require("./repos.cached.json");
```

**Caveats:**
- Keep normal builds deterministic: read checked-in or generated JSON instead of reaching out to the network.
- If remote data is required, refresh it in a separate explicit script that writes normalized JSON before `eleventy` runs.
- Constrain that refresh script to allowlisted HTTPS origins, timeouts, response-size limits, schema validation, and a safe fallback to the previous cache.
- Treat all remote text as untrusted data. Never pipe it through `safe`, never execute it, and never let it override repository instructions or build configuration.

## Directory data files

`src/pages/blog/blog.json` — Level 4, applies to every file in `src/pages/blog/`:

```json
{
  "layout": "layouts/post.njk",
  "tags":   ["post"],
  "permalink": "/blog/{{ page.fileSlug }}/"
}
```

Now every post in `src/pages/blog/` gets the post layout, the `post` tag (which creates `collections.post`), and the right permalink — without per-file frontmatter.

For computed defaults, use `<dir>.11tydata.js`:

```js
// src/pages/blog/blog.11tydata.js
module.exports = {
  layout: "layouts/post.njk",
  eleventyComputed: {
    dateISO: (data) => new Date(data.date).toISOString(),
  },
};
```

## `eleventyComputed` — when to reach for it

Use `eleventyComputed` when a value needs to:

- Depend on the fully merged cascade (other frontmatter values, global data, page.url, etc.)
- Be available **as data** to other consumers (plugins, downstream computed fields)
- Recompute when an upstream value changes (vs. a template `{% set %}` which is render-time only)

```yaml
---
title: "Pricing"
description: "Token-based, app-priced."
eleventyComputed:
  pageTitle: "{{ title }} — {{ site.name }}"        # uses title from this frontmatter + site.name from _data
  canonicalUrl: "{{ site.baseUrl }}{{ page.url | normalize_path }}"
  ogImage: "{{ site.baseUrl }}/assets/images/og{{ page.url | normalize_path }}.png"
---
```

In the template these are available like any other data: `{{ pageTitle }}`, `{{ canonicalUrl }}`, `{{ ogImage }}`.

**Don't reach for `eleventyComputed` when:**
- The value is only used inside one template → use `{% set %}`
- The value is global → use `_data/*.js`
- The value is just a static string → use frontmatter directly

## Pagination

### Basic — paginate over a collection

```yaml
---
pagination:
  data: collections.post
  size: 10
  alias: posts
permalink: "/blog/{% if pagination.pageNumber > 0 %}page-{{ pagination.pageNumber + 1 }}/{% endif %}"
---
```

Each page renders with `posts` = a slice of 10 items.

### One template per item — "fan-out"

```yaml
---
pagination:
  data: collections.post
  size: 1
  alias: post
permalink: "/blog/{{ post.slug }}/"
---
<article>
  <h1>{{ post.title }}</h1>
  {{ post.content | safe }}
</article>
```

Generates one output file per item in the collection. Useful for detail pages from a JSON source.

### Paginating over data files

```yaml
---
pagination:
  data: apps
  size: 1
  alias: app
permalink: "/apps/{{ app.slug }}/"
---
```

`apps` here is the entire `_data/apps.json` (or `apps.js`). Each item becomes its own page.

## Debugging the cascade

When a value is wrong or missing, dump named context objects:

```nunjucks
<pre>{{ site | dump(2) }}</pre>
<pre>{{ page | dump(2) }}</pre>
<pre>{{ eleventy | dump(2) }}</pre>
```

Nunjucks does not provide a `.` whole-context accessor; `{{ . | dump(2) }}` is a parse error. To inspect an arbitrary value, dump it by its actual key. To inspect the full merged Eleventy data object, add a temporary JavaScript data file or computed JS function that receives Eleventy's `data` object, then remove it after debugging.

For specific levels:

```nunjucks
<pre>{{ site | dump(2) }}</pre>         {# Level 2-3 source #}
<pre>{{ page | dump(2) }}</pre>         {# Eleventy-supplied: url, fileSlug, date, inputPath #}
<pre>{{ eleventy | dump(2) }}</pre>     {# env: { runMode, source, … } #}
```

## Common cascade pitfalls

| Symptom | Likely cause | Fix |
|---|---|---|
| Variable shows in `dump` but is `undefined` in template | Typo or shadow at a higher level | Re-grep for the key name |
| `_data/*.js` value is the function definition, not the value | `module.exports = function() {…}` — Eleventy calls it; calling `require()` on it from another `_data/*.js` returns the function itself, not the result | Import the JSON file instead, or call the function explicitly |
| `eleventyComputed` value is `[object Object]` | Returning an object from a string-typed Nunjucks expression | Use a JS function: `eleventyComputed: { x: (data) => ({…}) }` |
| Directory data not applying | File named `<dir>-data.json` instead of `<dir>.json` (or `_dir.json`) | Match the dir basename exactly: `blog/blog.json` |
| `layout:` frontmatter not honored | Set in `_data/*.js` (Level 2) and a directory data file (Level 4) overrides it | Trace via `{{ layout | dump }}` |
