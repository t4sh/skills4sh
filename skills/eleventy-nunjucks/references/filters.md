# Filters reference

Copy-paste-ready filter implementations. Drop these into the project's `.eleventy.js`.

## Why a canonical filter set?

Three reasons, in order:

1. **Templates become portable.** A `.njk` file that uses `{{ items | where("status", "active") | sort_by("date") }}` works in any project that ships this set.
2. **Subtle bugs are pre-fixed.** The canonical implementations handle the gotchas (non-array input, type coercion in `where`, null-safe `keys`/`values`).
3. **Reviewers know what's safe.** A reviewer seeing `| jsonScript | safe` knows it's the project's escape filter, not a bypass.

## The universal nine — content filters

```js
// .eleventy.js / eleventy.config.js
const markdownIt = require("markdown-it");

module.exports = function (eleventyConfig) {
  const md = markdownIt({ html: false, linkify: true, typographer: true });
  eleventyConfig.setLibrary("md", md);

  // 1. md — render a markdown string through markdown-it
  //    Use when a string field (frontmatter, JSON data) contains markdown.
  eleventyConfig.addFilter("md", (content) => md.render(content || ""));

  // 2. dump — cycle-safe JSON for debugging in a <pre>.
  //    NEVER use inside <script>. Use jsonScript / jsonCompact for that.
  eleventyConfig.addFilter("dump", (obj) => {
    const seen = new WeakSet();
    return JSON.stringify(obj, (key, value) => {
      if (typeof value === "object" && value !== null) {
        if (seen.has(value)) return "[Circular]";
        seen.add(value);
      }
      return value;
    }, 2);
  });

  // 3. slice — JS-style array slicing. Overrides Nunjucks' built-in.
  //    Returns input unchanged if not an array (so chains don't break).
  eleventyConfig.addFilter("slice", (arr, start, end) => {
    if (!Array.isArray(arr)) return arr;
    return arr.slice(start, end);
  });

  // 4. limit — alias for slice(0, count).
  eleventyConfig.addFilter("limit", (arr, count) => {
    if (!Array.isArray(arr)) return arr;
    return arr.slice(0, count);
  });

  // 5. where — filter array by key === value, coercing both sides to string.
  //    String coercion is load-bearing: it matches JSON int 5 against template "5".
  eleventyConfig.addFilter("where", (arr, key, val) => {
    if (!Array.isArray(arr)) return arr;
    const target = String(val);
    return arr.filter((item) => String(item[key]) === target);
  });

  // 6. sort_by — sort array of objects by key. Returns a copy.
  //    For descending: chain with reverse: {{ items | sort_by("date") | reverse }}
  eleventyConfig.addFilter("sort_by", (arr, key) => {
    if (!Array.isArray(arr)) return arr;
    return [...arr].sort((a, b) => (a[key] > b[key] ? 1 : -1));
  });

  // 7. json — parse a JSON string. Safe-falls back to input on parse failure.
  //    Useful when frontmatter or data files contain stringified JSON.
  eleventyConfig.addFilter("json", (str) => {
    try { return JSON.parse(str); } catch { return str; }
  });

  // 8. keys — Object.keys with null-safety.
  eleventyConfig.addFilter("keys",   (obj) => (obj ? Object.keys(obj)   : []));

  // 9. values — Object.values with null-safety.
  eleventyConfig.addFilter("values", (obj) => (obj ? Object.values(obj) : []));
};
```

## Path filter — `normalize_path`

Required for any project deploying behind nginx with `try_files $uri $uri.html`. Strips `.html`, `index.html`, trailing slash, query, and hash so active-nav matching and canonical URLs agree.

```js
/**
 * Strip query/hash, .html / /index.html suffix, and trailing slash (except root).
 * Required because pages with explicit `permalink: foo.html` (the flat-permalink
 * convention paired with nginx `try_files $uri.html`) yield page.url like
 * `/sales-crm/lead-management.html`, while subnav comparisons want the canonical
 * `/sales-crm/lead-management` form.
 *
 * Examples:
 *   "/pricing.html"           → "/pricing"
 *   "/sales-crm/index.html"   → "/sales-crm"
 *   "/?utm=x"                 → "/"
 *   "/foo/#bar"               → "/foo"
 *   "/"                       → "/"   (root is preserved)
 */
eleventyConfig.addFilter("normalize_path", (url) => {
  if (!url || typeof url !== "string") return "/";
  let p = url.split("?")[0].split("#")[0] || "/";
  if      (p.endsWith("/index.html")) p = p.slice(0, -"/index.html".length) || "/";
  else if (p.endsWith(".html"))       p = p.slice(0, -".html".length)       || "/";
  if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1);
  return p || "/";
});
```

### Usage

```nunjucks
{# In nav.njk — highlight current page regardless of .html / / / # variants #}
{% set here = page.url | normalize_path %}
{% for link in nav.links %}
  <a href="{{ link.href }}" {% if link.href == here %}aria-current="page"{% endif %}>
    {{ link.label }}
  </a>
{% endfor %}

{# In base.njk — canonical URL agrees with sitemap #}
<link rel="canonical" href="{{ site.baseUrl }}{{ page.url | normalize_path }}" />
```

## Security filter — `jsonScript`

`JSON.stringify` is **not** safe inside `<script>` tags. String values may contain `</script>`, `<!--`, U+2028 (line separator), or U+2029 (paragraph separator) — any of which breaks out of the script context or causes silent parse errors.

```js
/**
 * Safely embed a value inside a <script> tag.
 *
 * Escapes:
 *   <        → <  (prevents </script> breakout)
 *   >        → >  (defensive — paired with < escape)
 *   &        → &  (HTML-safe)
 *   U+2028   →    (line separator — silent JS parse error)
 *   U+2029   →    (paragraph separator — silent JS parse error)
 *
 * The escapes are JS-string-literal escapes; JSON.parse decodes them back to
 * the original characters losslessly. Consumers see the original strings.
 *
 * Use as: <script>window.X = {{ obj | jsonScript | safe }};</script>
 */
eleventyConfig.addFilter("jsonScript", (val) =>
  JSON.stringify(val ?? null)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029"),
);
```

### Companion — `jsonCompact`

A leaner variant that only escapes `<` (sufficient for non-user-derived data):

```js
eleventyConfig.addFilter("jsonCompact", (obj) =>
  JSON.stringify(obj).replace(/</g, "\\u003c"),
);
```

Pick based on the data source:
- **`jsonScript`** for any data that includes user-controlled strings (CMS, forms, satellite repo content)
- **`jsonCompact`** for authored configuration (`site.json`, `nav.json`) — smaller output

Never use plain `JSON.stringify` in templates; never use `| dump | safe`.

## Format filters — copy-paste set

Patterns from real projects. Take what's relevant.

### `localeString` — locale-formatted numbers

```js
// {{ 1800 | localeString }} → "1,800"
eleventyConfig.addFilter("localeString", (n) =>
  typeof n === "number" ? n.toLocaleString("en-US") : n,
);
```

### `formatDate` — month + year

```js
const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
// {{ "2026-05" | formatDate }} → "May 2026"
// {{ null     | formatDate }} → "Present"
eleventyConfig.addFilter("formatDate", (value) => {
  if (!value) return "Present";
  const iso = value instanceof Date ? value.toISOString() : String(value);
  const [year, month] = iso.split("-").map(Number);
  return `${MONTHS_SHORT[month - 1]} ${year}`;
});
```

### `formatFullDate` — full month + day + year

```js
const MONTHS_FULL = ["January","February","March","April","May","June",
                     "July","August","September","October","November","December"];
// {{ "2026-05-11" | formatFullDate }} → "May 11, 2026"
eleventyConfig.addFilter("formatFullDate", (value) => {
  if (!value) return "";
  const iso = value instanceof Date ? value.toISOString() : String(value);
  const [year, month, day] = iso.split("-").map(Number);
  return `${MONTHS_FULL[month - 1]} ${day}, ${year}`;
});
```

### `sitemapDate` — Date/string → ISO day

```js
// {{ page.date | sitemapDate }} → "2026-05-11"
eleventyConfig.addFilter("sitemapDate", (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
});
```

Use this for `page.date` in `sitemap.xml`. Do not pass a format argument to the month/year `formatDate` filter above; it intentionally accepts only one `YYYY-MM` string.

### `duration` — months between two dates → "X yrs Y mos"

```js
// {{ "2022-03" | duration("2024-06") }} → "2 yrs 3 mos"
// {{ "2025-01" | duration(null)      }} → uses current month for end
eleventyConfig.addFilter("duration", (startDate, endDate) => {
  if (!startDate) return "";
  const [sy, sm] = startDate.split("-").map(Number);
  let ey, em;
  if (endDate) { [ey, em] = endDate.split("-").map(Number); }
  else { const now = new Date(); ey = now.getFullYear(); em = now.getMonth() + 1; }
  let total = (ey - sy) * 12 + (em - sm);
  if (total < 0) total = 0;
  const years  = Math.floor(total / 12);
  const months = total % 12;
  const parts = [];
  if (years  > 0) parts.push(`${years} yr${years   > 1 ? "s" : ""}`);
  if (months > 0) parts.push(`${months} mo${months > 1 ? "s" : ""}`);
  return parts.join(" ") || "< 1 mo";
});
```

## Lookup filters

For projects with relational data in `_data/*.json` (profiles, jobs, companies):

```js
// {{ slug | findBy(data, "slug") }} — generic finder
eleventyConfig.addFilter("findBy", (val, arr, key) => {
  if (!Array.isArray(arr)) return null;
  return arr.find((item) => item[key] === val) || null;
});

// Or per-collection wrappers if templates use them often:
eleventyConfig.addFilter("findProfile", (slug, profiles) =>
  Array.isArray(profiles) ? profiles.find((p) => p.slug === slug) || null : null
);
```

Generic `findBy` is preferable; per-collection wrappers add maintenance burden for marginal readability gain.

## Writing a new filter — checklist

Before adding a filter, walk this list:

- [ ] **Does it exist already?** Grep the project's `.eleventy.js` and the Nunjucks built-ins. Existing filter conventions: `md`, `dump`, `slice`, `limit`, `where`, `sort_by`, `json`, `keys`, `values`, `safe`, `escape`, `length`, `join`, `default`, `groupby`, `dictsort`, `batch`. Nunjucks `groupby` returns an object (`{ key: [items] }`), so iterate it with `{% for k, items in x | groupby("key") %}` rather than documenting custom pair arrays.
- [ ] **Null-safe input.** Return the input unchanged if it's the wrong type; don't throw.
- [ ] **No side effects.** Filters render during build, including on retries — no fetches, no writes, no random.
- [ ] **Deterministic.** Same input → same output. `Math.random()` breaks incremental builds and visual diffs.
- [ ] **Document the gotcha.** If the filter does something subtle (string coercion in `where`, `dump` not safe in scripts), add a `/** … */` block.
- [ ] **One-liner test in the template** before committing: `{{ value | newFilter | dump }}` and check the output.

## Async filters

Prefer synchronous, pure filters. If async is unavoidable, keep inputs local and deterministic; do network refreshes in a separate audited prebuild step that writes normalized data for `_data/*.js` to read.

```js
eleventyConfig.addAsyncFilter("titleFor", async (url, titles = {}) => {
  return titles[url] ?? url;
});
```

**Caveats:**
- Async filters slow the build linearly with the number of usages
- No network IO inside filters: retries multiply calls, make builds non-deterministic, and expose templates to untrusted third-party content
- Failure mode matters: an unhandled rejection aborts the build with no partial output
- Prefer loading precomputed data in `_data/*.js` and passing it into the filter

## Shortcodes vs filters — quick rule

| Use a **filter** when | Use a **shortcode** when |
|---|---|
| Input value → transformed value | Generating new content from arguments |
| `{{ x \| filter(args) }}` reads naturally | `{% shortcode(args) %}` is the call site |
| The result is a string, array, or object | The result is a chunk of HTML/markup |
| Composes well with other filters | Stands alone, often emits multiple elements |

```js
// Filter — transforms input
eleventyConfig.addFilter("uppercase", (s) => s.toUpperCase());
// {{ "hello" | uppercase }} → HELLO

// Shortcode — generates content
eleventyConfig.addShortcode("year", () => `${new Date().getFullYear()}`);
// © {% year %}             → © 2026

// Paired shortcode — wraps content.
// Nunjucks keyword args arrive as an object, so normalize positional and keyword forms.
eleventyConfig.addPairedShortcode("callout", (content, options = "info") => {
  const type = typeof options === "string" ? options : options?.type || "info";
  return `<aside class="callout callout-${type}">${content}</aside>`;
});
// {% callout "warn" %}Heads up{% endcallout %}
// {% callout type="warn" %}Heads up{% endcallout %}
```
