# Filters reference

Opt-in filter recipes for an existing Eleventy configuration. Match the project's module format and register only helpers its templates need. This reference is the canonical implementation source; configuration examples link here instead of duplicating implementations.

## Content filters — opt in individually

The compatibility recipes named `slice` and `dump` override Nunjucks built-ins. Preserve existing semantics unless the project deliberately adopts these replacements and tests affected templates. Prefer distinct names for new helpers when a built-in already exists.

The block below is CommonJS. In an ESM project (`"type": "module"` or an `.mjs` config), replace the `require` line with `import markdownIt from "markdown-it";` and `module.exports = function` with `export default function`; the filter bodies are unchanged.

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
    return arr.filter((item) => item != null && String(item[key]) === target);
  });

  // 6. sort_by — stable ascending sort; equal keys retain input order.
  //    Null/missing keys sort last. Returns a copy; use comparable key types.
  //    For descending: chain with reverse: {{ items | sort_by("date") | reverse }}
  eleventyConfig.addFilter("sort_by", (arr, key) => {
    if (!Array.isArray(arr)) return arr;
    return [...arr].sort((a, b) => {
      const av = a?.[key], bv = b?.[key];
      if (av == null) return bv == null ? 0 : 1;
      if (bv == null) return -1;
      return av > bv ? 1 : av < bv ? -1 : 0;
    });
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

> **Example deployment profile.** This section describes one project's deployment setup, not Eleventy or Nunjucks guidance. Load it only when the user asks for this kind of deployment work or the project already uses this pattern.

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

`JSON.stringify` is **not** safe inside `<script>` tags. String values may contain `</script>`, `<!--`, U+2028 (line separator), or U+2029 (paragraph separator). Escaping `<` prevents HTML-parser breakout; the additional escapes preserve compatibility with older JavaScript consumers.

```js
/**
 * Safely embed a value inside a <script> tag.
 *
 * Escapes:
 *   <        → \u003c  (prevents </script> breakout)
 *   >        → \u003e  (defensive — paired with < escape)
 *   &        → \u0026  (HTML-safe)
 *   U+2028   → \u2028  (legacy JavaScript compatibility)
 *   U+2029   → \u2029  (legacy JavaScript compatibility)
 *
 * The escapes are JS-string-literal escapes; JSON.parse decodes them back to
 * the original characters losslessly. Consumers see the original strings.
 *
 * Use as: <script>window.X = {{ obj | jsonScript | safe }};</script>
 */
eleventyConfig.addFilter("jsonScript", (val) =>
  (JSON.stringify(val ?? null) ?? "null")
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029"),
);
```

### Companion — `jsonCompact`

A compatibility alias for existing templates; use the same serializer and failure behavior:

```js
eleventyConfig.addFilter("jsonCompact", (obj) =>
  eleventyConfig.getFilter("jsonScript")(obj),
);
```

Use `jsonScript` for new templates. Retain `jsonCompact` only for existing call sites; both require JSON-serializable values. Circular values and BigInt should fail with a clear build error.

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
// Unreadable input (no leading YYYY-MM, or a month outside 01–12) → ""
eleventyConfig.addFilter("formatDate", (value) => {
  if (!value) return "Present";
  const iso = value instanceof Date && !Number.isNaN(value.getTime()) ? value.toISOString() : String(value);
  const match = /^(\d{4})-(\d{2})(?!\d)/.exec(iso);
  const month = match && MONTHS_SHORT[Number(match[2]) - 1];
  return month ? `${month} ${match[1]}` : "";
});
```

### `formatFullDate` — full month + day + year

```js
const MONTHS_FULL = ["January","February","March","April","May","June",
                     "July","August","September","October","November","December"];
// {{ "2026-05-11" | formatFullDate }} → "May 11, 2026"
// {{ page.date    | formatFullDate }} → Date objects and ISO datetime strings work too
eleventyConfig.addFilter("formatFullDate", (value) => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) value = value.toISOString();
  if (typeof value !== "string") return "";
  const match = /^(\d{4}-\d{2}-\d{2})(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})?)?$/.exec(value);
  if (!match || Number.isNaN(Date.parse(value))) return "";
  // Date.parse can roll February 29 into March. Check the written calendar day
  // independently of the time and offset, so a valid offset never shifts it.
  const day = new Date(match[1] + "T00:00:00Z");
  if (day.toISOString().slice(0, 10) !== match[1]) return "";
  return `${MONTHS_FULL[day.getUTCMonth()]} ${day.getUTCDate()}, ${match[1].slice(0, 4)}`;
});
```

Accepts a `Date` (`page.date`, YAML front-matter dates), a `YYYY-MM-DD` string, or an ISO datetime string; anything else returns `""`. Eleventy front-matter and filename dates are midnight UTC, so the filter reads the UTC day and never calls local-time getters such as `getDate()`, which print the previous day on machines west of UTC. See [Eleventy content dates](https://www.11ty.dev/docs/dates/).

### `sitemapDate` — Date/string → ISO day

```js
// {{ page.date | sitemapDate }} → "2026-05-11"
eleventyConfig.addFilter("sitemapDate", (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
});
```

Use this for `page.date` in `sitemap.xml`. Do not pass a format argument to the month/year `formatDate` filter above; it reads only a leading `YYYY-MM` and returns an empty string for anything else.

### `duration` — months between two dates → "X yrs Y mos"

```js
// {{ "2022-03" | duration("2024-06") }} → "2 yrs 3 mos"
// {{ "2025-01" | duration(null)      }} → uses current month for end
// A Date is read as its UTC month; unreadable input → ""
eleventyConfig.addFilter("duration", (startDate, endDate) => {
  const yearMonth = (value) => {
    const iso = value instanceof Date && !Number.isNaN(value.getTime()) ? value.toISOString() : String(value);
    const match = /^(\d{4})-(\d{2})(?!\d)/.exec(iso);
    const month = match ? Number(match[2]) : 0;
    return month >= 1 && month <= 12 ? [Number(match[1]), month] : null;
  };
  const start = startDate ? yearMonth(startDate) : null;
  if (!start) return "";
  let end;
  if (endDate) { end = yearMonth(endDate); if (!end) return ""; }
  else { const now = new Date(); end = [now.getFullYear(), now.getMonth() + 1]; }
  const [sy, sm] = start, [ey, em] = end;
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
  return arr.find((item) => item != null && item[key] === val) || null;
});

// Or per-collection wrappers if templates use them often:
eleventyConfig.addFilter("findProfile", (slug, profiles) =>
  Array.isArray(profiles) ? profiles.find((p) => p != null && p.slug === slug) || null : null
);
```

Generic `findBy` is preferable; per-collection wrappers add maintenance burden for marginal readability gain.

## Writing a new filter — checklist

Before adding a filter, walk this list:

- [ ] **Does it exist already?** Grep the project's active config file, the Nunjucks built-ins, and Eleventy's universal filters (`url`, `slugify`, `log`, `inputPathToUrl`, `getPreviousCollectionItem` / `getNextCollectionItem` / `getCollectionItemIndex`; see [Eleventy filters](https://www.11ty.dev/docs/filters/)). Existing filter conventions: `md`, `dump`, `slice`, `limit`, `where`, `sort_by`, `json`, `keys`, `values`, `safe`, `escape`, `length`, `join`, `default`, `groupby`, `dictsort`, `batch`. Nunjucks `groupby` returns an object (`{ key: [items] }`), so iterate it with `{% for k, items in x | groupby("key") %}` rather than documenting custom pair arrays.
- [ ] **Null-safe input.** Define malformed-input behavior explicitly. The array recipes preserve non-array input; `where` skips null members and `sort_by` puts missing keys last. Serialization errors should fail the build rather than emit invalid script data.
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
- Async cost depends on work, repetition, caching, and loop scheduling; measure before optimizing
- No network IO inside filters: retries multiply calls, make builds non-deterministic, and expose templates to untrusted third-party content
- Failure mode matters: an unhandled rejection fails the build; earlier files may already have been written, so publish only after the complete build passes
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

// Shortcode return values are written to the page as-is; autoescape never sees them.
// Escape every argument that is interpolated into markup.
const escapeHtml = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (ch) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);

// Paired shortcode — wraps content.
// Nunjucks keyword args arrive as an object, so normalize positional and keyword forms.
eleventyConfig.addPairedShortcode("callout", (content, options = "info") => {
  const type = typeof options === "string" ? options : options?.type || "info";
  return `<aside class="callout callout-${escapeHtml(type)}">${content}</aside>`;
});
// {% callout "warn" %}Heads up{% endcallout %}
// {% callout type="warn" %}Heads up{% endcallout %}
```

**Shortcode output bypasses autoescape.** Eleventy marks every shortcode return value as safe HTML, so `{% badge user.name %}` emits `user.name` unescaped unless the shortcode escapes it (filter return values are still autoescaped). Escape each interpolated argument as above, and keep attribute values quoted. The paired `content` argument is the already-rendered body: `{{ value }}` inside it was autoescaped, and authored HTML passes through by design, so do not escape it again. Verified on Eleventy 3.1.8, 2026-11-21.
