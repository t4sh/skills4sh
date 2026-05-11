# Eleventy v3 configuration API

Use this file when wiring or auditing `.eleventy.js` / `eleventy.config.js`, migrating from v2, or looking up config methods. For directory layout and scripts shape, see `conventions.md`. For filter implementations, see `filters.md`. For merge order of data, see `data-cascade.md`.

## v2 → v3 — bake into reviews and migrations

| Change | Action |
|---|---|
| **ESM-first** | Prefer `export default async function(eleventyConfig) {...}`. CJS `module.exports = function(...)` still works |
| **ESM plugins from CJS config** | `const { HtmlBasePlugin } = await import("@11ty/eleventy")` |
| **Top-level await** | `eleventy.config.js` may be async |
| **Browsersync removed** | Use `@11ty/eleventy-dev-server` via `setServerOptions({...})` |
| **Image plugin v4+** | `eleventyImageTransformPlugin` from `@11ty/eleventy-img`; `returnType: "html"` + `htmlOptions.imgAttributes` |
| **WebC / Vue / JSX** | Separate plugins — not in core |
| **Preferred config filename** | `eleventy.config.js` (or `.mjs` / `.cjs`); `.eleventy.js` still resolved |
| **Node minimum** | `>=18` (v2 allowed `>=14`) |

Upgrade path: rename config as needed → remove Browsersync assumptions → fix sync-only filter assumptions where async is required → update plugin imports.

## Canonical config skeletons

### CJS (lab-sites / krawler / atari lineage)

```js
const markdownIt = require("markdown-it");

module.exports = function (eleventyConfig) {
  // html: false → .md cannot inject raw HTML (safer for agent-facing .md)
  // html: true  → .md may include HTML (trusted authoring only)
  const md = markdownIt({ html: false, linkify: true, typographer: true });
  eleventyConfig.setLibrary("md", md);

  eleventyConfig.addPassthroughCopy({ "src/assets/css": "assets/css" });
  eleventyConfig.addPassthroughCopy({ "src/assets/js": "assets/js" });
  eleventyConfig.addPassthroughCopy({ "src/assets/images": "assets/images" });

  eleventyConfig.addFilter("md", (s) => md.render(s || ""));
  eleventyConfig.addFilter("dump", (obj) => JSON.stringify(obj, null, 2));
  eleventyConfig.addFilter("slice", (arr, a, b) => (Array.isArray(arr) ? arr.slice(a, b) : arr));
  eleventyConfig.addFilter("limit", (arr, n) => (Array.isArray(arr) ? arr.slice(0, n) : arr));
  eleventyConfig.addFilter("where", (arr, k, v) =>
    Array.isArray(arr) ? arr.filter((i) => String(i[k]) === String(v)) : arr,
  );
  eleventyConfig.addFilter("sort_by", (arr, k) =>
    Array.isArray(arr) ? [...arr].sort((a, b) => (a[k] > b[k] ? 1 : -1)) : arr,
  );
  eleventyConfig.addFilter("json", (s) => {
    try {
      return JSON.parse(s);
    } catch {
      return s;
    }
  });
  eleventyConfig.addFilter("keys", (o) => (o ? Object.keys(o) : []));
  eleventyConfig.addFilter("values", (o) => (o ? Object.values(o) : []));

  eleventyConfig.addShortcode("year", () => `${new Date().getFullYear()}`);

  eleventyConfig.addWatchTarget("src/assets/");
  eleventyConfig.setServerOptions({ liveReload: true, domDiff: true, port: 3000 });

  return {
    dir: { input: "src/pages", includes: "../_includes", data: "../_data", output: "out" },
    templateFormats: ["njk", "md", "html"],
    htmlTemplateEngine: "njk",
    markdownTemplateEngine: "njk",
  };
};
```

### ESM (v3-native)

```js
import markdownIt from "markdown-it";

export default async function (eleventyConfig) {
  const md = markdownIt({ html: false, linkify: true, typographer: true });
  eleventyConfig.setLibrary("md", md);

  eleventyConfig.addPassthroughCopy({ "src/assets/css": "assets/css" });
  eleventyConfig.addPassthroughCopy({ "src/assets/js": "assets/js" });
  eleventyConfig.addPassthroughCopy({ "src/assets/images": "assets/images" });

  const { HtmlBasePlugin } = await import("@11ty/eleventy");
  eleventyConfig.addPlugin(HtmlBasePlugin);

  // … filters / shortcodes …

  return {
    dir: { input: "src/pages", includes: "../_includes", data: "../_data", output: "out" },
    templateFormats: ["njk", "md", "html"],
    htmlTemplateEngine: "njk",
    markdownTemplateEngine: "njk",
  };
};
```

## Markdown engine

`markdown-it({ html: ?, linkify: true, typographer: true })`

| `html` | Use when |
|---|---|
| `false` | Agent-facing `.md`, CMS content, or any untrusted markdown |
| `true` | Hand-authored prose only; never for user-supplied markdown |

`false` → `true` re-opens XSS surfaces that CSP and JSON-LD inlining may assume are closed.

## Configuration method lookup

### Filters and shortcodes

```js
eleventyConfig.addFilter(name, fn);
eleventyConfig.addAsyncFilter(name, asyncFn);
eleventyConfig.addShortcode(name, fn);
eleventyConfig.addPairedShortcode(name, fn);
```

### Passthrough copy

```js
eleventyConfig.addPassthroughCopy("static");
eleventyConfig.addPassthroughCopy("public/**/*.svg");
eleventyConfig.addPassthroughCopy({ "src/static": "/" });
eleventyConfig.setServerPassthroughCopyBehavior("passthrough");
```

Prefer `{ src: dest }` mappings over broad globs so `.env`, keys, and `node_modules` never ship.

### Watch and global data

```js
eleventyConfig.addWatchTarget("src/assets/");
eleventyConfig.addGlobalData("build", () => ({
  sha: process.env.COMMIT_SHA || "dev",
  builtAt: process.env.BUILT_AT || new Date().toISOString(),
}));
```

### Dev server

```js
eleventyConfig.setServerOptions({
  liveReload: true,
  domDiff: true,
  port: 3000,
  watch: [],
  showAllHosts: false,
  encoding: "utf-8",
  https: {},
  indexFileName: "index.html",
  onRequest: {},
});
```

### Events

```js
eleventyConfig.on("eleventy.before", async ({ directories, runMode, outputMode }) => {});
eleventyConfig.on("eleventy.after", async ({ directories, results, runMode, outputMode }) => {});
```

| Argument | Values |
|---|---|
| `runMode` | `"build"` / `"watch"` / `"serve"` |
| `outputMode` | `"fs"` / `"json"` |

### Plugins (examples)

```js
import { eleventyImageTransformPlugin } from "@11ty/eleventy-img";
import pluginSyntaxHighlight from "@11ty/eleventy-plugin-syntaxhighlight";
import pluginNavigation from "@11ty/eleventy-navigation";
import pluginRss from "@11ty/eleventy-plugin-rss";

eleventyConfig.addPlugin(eleventyImageTransformPlugin, {
  formats: ["avif", "webp", "jpeg"],
  widths: ["auto", 400, 800, 1200],
  htmlOptions: { imgAttributes: { loading: "lazy", decoding: "async" } },
});
```

### Collections

```js
eleventyConfig.addCollection("posts", (api) =>
  api.getFilteredByTag("post").sort((a, b) => a.date - b.date),
);
```

Templates: `collections.all`, `collections.<name>`, `api.getAll()`, `api.getAllSorted()`, `api.getFilteredByGlob(glob)`.

### Frontmatter keys

| Key | Role |
|---|---|
| `permalink` | Output URL; templating supported; `false` skips write |
| `layout` | Resolved under `dir.includes` (or `dir.layouts` if set) |
| `eleventyExcludeFromCollections` | `true` excludes from collections — pair with `permalink: false` for hidden pages |
| `tags` | String or array; builds collections |
| `eleventyComputed` | Runs last; sees full merged cascade |

## Permalinks and `normalize_path`

For nginx `try_files $uri $uri.html`, flat permalinks often use `permalink: /path.html`. Then `page.url` includes `.html`, which breaks naive nav matching. Add the `normalize_path` filter from `filters.md` and compare nav hrefs to `page.url | normalize_path`.

## Inline JSON in `<script>`

Never `{{ obj | dump | safe }}` inside executable `<script>`. Use `jsonScript` / `jsonCompact` from `filters.md`:

```nunjucks
<script>
  window.__SITE__ = {{ site | jsonScript | safe }};
</script>
```

## After-build hook example

```js
eleventyConfig.on("eleventy.after", async ({ directories, runMode, outputMode }) => {
  const fs = await import("fs");
  const path = await import("path");
  const src = path.join(directories.output, "protocol.md");
  const dst = path.join(directories.output, "skill.md");
  if (fs.existsSync(src)) fs.copyFileSync(src, dst);
});
```

## CSP meta vs dev server

Gate CSP `<meta>` on build so `--serve` live-reload is not blocked — see `production-patterns.md`. Remember `frame-ancestors` only works as an HTTP header.

## Authoritative upstream docs

When API details drift, fetch current Eleventy and Nunjucks docs (e.g. context7: `/11ty/11ty-website`, `/mozilla/nunjucks`).
