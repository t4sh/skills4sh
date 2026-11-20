# Eleventy v3 configuration API

Use this file when wiring or auditing `.eleventy.js` / `eleventy.config.js`, migrating from v2, or looking up config methods. For directory layout and scripts shape, see `conventions.md`. For filter implementations, see `filters.md`. For merge order of data, see `data-cascade.md`.

## v2 → v3 — bake into reviews and migrations

| Change | Action |
|---|---|
| **ESM and async config support** | v3 supports ESM and asynchronous callbacks. Match the project’s `package.json` `type` and existing extension; CJS remains supported. |
| **ESM plugins from CJS config** | `const { HtmlBasePlugin } = await import("@11ty/eleventy")` |
| **Async callback** | The exported configuration callback may be async; top-level `await` additionally requires an ESM config. |
| **Browsersync not in core (since v2)** | Use the bundled `@11ty/eleventy-dev-server` via `setServerOptions({...})`; Browsersync is opt-in through `@11ty/eleventy-server-browsersync` |
| **Image plugin v4+** | `eleventyImageTransformPlugin` from `@11ty/eleventy-img`; `htmlOptions.imgAttributes` and `returnType: "html"` need Image v6+ (`returnType` applies to the Image JS API/shortcodes). Image v7 is ESM-only and requires Node `>=22` (checked 2026-10-21) |
| **WebC / Vue / JSX** | Separate plugins — not in core |
| **Config discovery** | Eleventy v3 checks `.eleventy.js`, `eleventy.config.js`, `eleventy.config.mjs`, then `eleventy.config.cjs`; the first file found wins and the rest are ignored. The v4 prerelease checks `buildawesome.config.*` first; see `build-awesome-v4.md`. |
| **Node runtime** | Eleventy v3 declares Node `>=18`, but Node 18 and 20 are EOL. Use a supported LTS (Node 26 Active LTS preferred; Node 24 and 22 are maintenance LTS; schedule checked 2026-11-21). JSON import attributes still require a compatible runtime. |

Upgrade path: identify the config file Eleventy actually resolves → remove duplicate configs and Browsersync assumptions → fix sync-only filter assumptions where async is required → update plugin imports.

## Canonical config skeletons

The `dir` values and passthrough maps in both skeletons come from the example deployment profile; keep the project's own directories.

### CJS (existing CommonJS project profile)

```js
const markdownIt = require("markdown-it");

module.exports = function (eleventyConfig) {
  // html: false escapes raw Markdown HTML; it does not disable template execution.
  // html: true  → .md may include HTML (trusted authoring only)
  const md = markdownIt({ html: false, linkify: true, typographer: true });
  eleventyConfig.setLibrary("md", md);

  eleventyConfig.addPassthroughCopy({ "src/assets/css": "assets/css" });
  eleventyConfig.addPassthroughCopy({ "src/assets/js": "assets/js" });
  eleventyConfig.addPassthroughCopy({ "src/assets/images": "assets/images" });

  // Register only the project-selected recipes from references/filters.md.

  return {
    dir: { input: "src/pages", includes: "../_includes", data: "../_data", output: "out" },
    templateFormats: ["njk", "md", "html"],
    htmlTemplateEngine: "njk",
    markdownTemplateEngine: "njk",
  };
};
```

### ESM (supported in v3)

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

Treat authored `.md` templates and untrusted Markdown data differently. With `markdownTemplateEngine: "njk"`, Nunjucks executes before Markdown rendering. `html: false` does not make untrusted template source safe. Prefer passing external Markdown as data into the pure `md` filter. If processing an untrusted Markdown document directly, disable template preprocessing (`markdownTemplateEngine: false`) and isolate its frontmatter/configuration effects; disabling raw HTML alone is insufficient. Nunjucks [does not sandbox template execution](https://mozilla.github.io/nunjucks/api.html#user-defined-templates-warning).

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
| `outputMode` | `"fs"` / `"json"` / `"ndjson"` |

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

### First-party plugins bundled with v3 core

These ship inside `@11ty/eleventy` 3.x and need no extra install; each is opt-in. Built and inspected on Eleventy 3.1.8, 2026-11-21; details in the [plugin docs](https://www.11ty.dev/docs/plugins/).

```js
// eleventy.config.js — ESM. From a CommonJS config use:
//   const { RenderPlugin } = await import("@11ty/eleventy");  (inside an async config function)
import {
  HtmlBasePlugin,
  I18nPlugin,
  IdAttributePlugin,
  InputPathToUrlTransformPlugin,
  RenderPlugin,
} from "@11ty/eleventy";

export default function (eleventyConfig) {
  eleventyConfig.addPlugin(HtmlBasePlugin);                 // prefixes URLs when built with --pathprefix
  eleventyConfig.addPlugin(InputPathToUrlTransformPlugin);  // href="about.njk" becomes that page's output URL
  eleventyConfig.addPlugin(IdAttributePlugin);              // adds id attributes to <h1>–<h6>
  eleventyConfig.addPlugin(RenderPlugin);                   // renderTemplate / renderFile shortcodes, renderContent filter
  eleventyConfig.addPlugin(I18nPlugin, { defaultLanguage: "en" }); // locale_url and locale_links filters

  // Bundle plugin: declare each bundle, fill it with {% css %}…{% endcss %}, emit it with {% getBundle "css" %}.
  eleventyConfig.addBundle("css");

  // Virtual template: the path is relative to the input directory and selects the template language.
  eleventyConfig.addTemplate("virtual.njk", "<p>{{ label }}</p>", { label: "Virtual", permalink: "/virtual/" });

  // Preprocessor: return false to skip a template, a string to replace its raw content, nothing to leave it unchanged.
  eleventyConfig.addPreprocessor("drafts", "njk,md", (data) => {
    if (data.draft && process.env.ELEVENTY_RUN_MODE === "build") return false;
  });
}
```

| Feature | Template usage | Docs |
|---|---|---|
| InputPath to URL | `<a href="about.njk">` (transform) or `{{ "about.njk" \| inputPathToUrl }}` (universal filter, no plugin needed) | [inputpath-to-url](https://www.11ty.dev/docs/plugins/inputpath-to-url/) |
| Id Attribute | Automatic; existing `id` attributes are left alone | [id-attribute](https://www.11ty.dev/docs/plugins/id-attribute/) |
| Render | `{% renderTemplate "md" %}…{% endrenderTemplate %}`, `{% renderFile "./_includes/post.md" %}` | [render](https://www.11ty.dev/docs/plugins/render/) |
| i18n | `{{ "/about/" \| locale_url }}`, `{% for link in page.url \| locale_links %}`; content lives in language-code folders such as `en/` and `es/` | [i18n](https://www.11ty.dev/docs/plugins/i18n/) |
| Bundle | `{% css %}h1 { color: red; }{% endcss %}` in any template, `<style>{% getBundle "css" %}</style>` in the layout | [bundle](https://www.11ty.dev/docs/plugins/bundle/) |
| Virtual templates | Rendered like files; data comes from the third argument or front matter in the string | [virtual-templates](https://www.11ty.dev/docs/virtual-templates/) |
| Preprocessors | Run on template files, not layouts, before rendering | [config-preprocessors](https://www.11ty.dev/docs/config-preprocessors/) |

Render-plugin shortcodes are asynchronous and their output bypasses autoescape like any shortcode; render only trusted template source (see `SKILL.md` § Markdown trust).

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

> **Example deployment profile.** This section describes one project's deployment setup, not Eleventy or Nunjucks guidance. Load it only when the user asks for this kind of deployment work or the project already uses this pattern.

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

Prefer production HTTP headers. When a project uses a CSP `<meta>`, either omit it during `--serve` or provide a development policy that permits the actual live-reload script and WebSocket endpoints—see `production-patterns.md`. Remember `frame-ancestors` only works as an HTTP header.

## Authoritative upstream docs

When API details drift, consult [11ty.dev](https://www.11ty.dev/docs/), the canonical [`11ty/buildawesome`](https://github.com/11ty/buildawesome) repository, and the applicable Nunjucks release documentation. Project config and repository instructions still win.
