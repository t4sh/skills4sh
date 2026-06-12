# Troubleshooting reference

Diagnosis recipes for common 11ty + Nunjucks failure modes. Each entry: symptom → likely cause → diagnosis → fix.

## Build / dev server issues

### `eleventy --serve` returns 404 for a newly-added page

**Likely causes (in priority order):**

1. The file extension isn't in `templateFormats` — check `.eleventy.js`
2. `permalink: false` in the frontmatter (page is generated but not written)
3. The page is in the wrong `dir.input` — check the project's variant (A vs B)
4. The dev server didn't pick up the new file — try a hard refresh / restart

**Diagnosis:**

```bash
# Confirm the page is in the build output
pnpm build
find out -name "newpage*"

# If found in out/ but 404 from --serve: server didn't reload, restart it
# If not in out/: check templateFormats and dir config
```

```js
// .eleventy.js — verify
return {
  dir: { input: "src/pages", … },              // ← matches your file's location?
  templateFormats: ["njk", "md", "html"],       // ← includes your file's extension?
};
```

### `eleventy --serve` shows old content after edits

**Cause:** Either the dev server didn't reload, or Tailwind hasn't recompiled.

**Diagnosis:**

```bash
# Confirm Tailwind is watching and writing
ls -la src/assets/css/tailwind.css
# Timestamp should update on every CSS-relevant edit

# Confirm 11ty's watch is including the file you edited
grep "addWatchTarget" .eleventy.js
```

**Fix:**
- Add `addWatchTarget("src/assets/")` if missing
- Kill and restart `pnpm dev` (the `--kill-others-on-fail` flag should make this automatic for crash recovery)
- Hard refresh the browser (`Cmd+Shift+R`)

### Build hangs and never exits

**Cause:** Most often an async filter or `_data/*.js` file that returns a Promise that never resolves.

**Diagnosis:**

```bash
# Run with verbose flag
DEBUG=Eleventy* pnpm build 2>&1 | tail -40

# Check for unresolved promises
grep -rE "async.*=>" src/_data/ .eleventy.js
```

**Fix:**
- Add timeouts to fetch calls in `_data/*.js`
- Wrap in `try/catch` and return a fallback value
- Move slow/external IO to a separate build step that writes JSON

### `Cannot find module '@11ty/eleventy'` after install

**Cause:** Lockfile drift or wrong package manager.

**Fix:**

```bash
# Identify package manager
cat package.json | grep packageManager
# pnpm — use pnpm; npm — use npm; bun — use bun

# Reinstall with the right manager
rm -rf node_modules
pnpm install --frozen-lockfile      # or npm ci / bun install --frozen-lockfile
```

### `EISDIR: illegal operation on a directory` on build

**Cause:** A passthrough copy mapping has `src` pointing to a file but `dest` ending with `/`, or vice versa.

**Fix:** Match `src` type to `dest` type:

```js
// File → file
eleventyConfig.addPassthroughCopy({ "src/robots.txt": "robots.txt" });

// Directory → directory
eleventyConfig.addPassthroughCopy({ "src/assets/css": "assets/css" });
```

---

## Template rendering issues

### Section appearing twice on the page

**Likely causes:**

1. The same `{% include %}` appears in both the page template AND its layout
2. Two layouts in the chain both include the section
3. A `{% for %}` loop is iterating over the wrong data

**Diagnosis:**

```bash
# Search for the section across templates
grep -rE "sections/<section-name>" src/_includes/ src/pages/
```

Trace the layout chain: page → layout1 → layout2 → base. Each layer's `{{ content | safe }}` already includes what the layer below rendered.

**Fix:**
- The section should appear in exactly one place in the chain
- If it's in a layout, it shouldn't be in the pages that use that layout

### `{{ content | safe }}` outputs literal `<p>…</p>` text instead of rendered HTML

**Cause:** The page template is `.md`, but `markdownTemplateEngine` isn't set to `njk`, OR the layout is rendering content from a markdown source without `| safe`.

**Diagnosis:**

```js
// .eleventy.js — verify
return {
  htmlTemplateEngine: "njk",
  markdownTemplateEngine: "njk",      // ← must be set
};
```

```nunjucks
{# Layout — verify #}
<main>{{ content | safe }}</main>      {# ✅ — safe is required #}
<main>{{ content }}</main>             {# ❌ — autoescaped, shows as text #}
```

### `Cannot read property 'X' of undefined` in template

**Cause:** Chained property access on a missing value. Nunjucks silently returns empty string for `{{ a.b.c }}` when `a` is undefined — but `{{ a.b.c }}` when `a` exists and `b` is undefined throws.

**Diagnosis:**

```nunjucks
{# Add a debug dump #}
<pre>{{ a | dump(2) }}</pre>
```

**Fix:**

```nunjucks
{# Use the default filter #}
{{ a.b.c | default("fallback") }}

{# Or check existence first #}
{% if a and a.b %}{{ a.b.c }}{% endif %}

{# Or use safe navigation via if expression #}
{{ (a.b.c if a and a.b else "") }}
```

### `Unexpected end of file` while parsing

**Cause:** An unclosed block (`{% if %}` without `{% endif %}`, `{% for %}` without `{% endfor %}`, `{% macro %}` without `{% endmacro %}`).

**Diagnosis:**

```bash
# Count open vs end for each block type in the affected file
for kw in if for block macro autoescape raw call; do
  open=$(grep -cE "{%[- ]*$kw\b" path/to/file.njk)
  close=$(grep -cE "{%[- ]*end$kw\b" path/to/file.njk)
  [ "$open" != "$close" ] && echo "$kw mismatch: $open / $close"
done
```

**Fix:** Walk every `{% if %}` and `{% for %}` in the file, top to bottom. Count brace nesting line by line. Often the issue is an `{% if %}` block that has an `{% elif %}` but no `{% else %}` mistakenly closed early.

### Macro doesn't see `page` or `site` variables

**Cause:** `{% import %}` doesn't inherit scope.

**Fix:**

```nunjucks
{# ❌ #}
{% import "macros/page-link.njk" as nav %}
{{ nav.pageLink() }}        {# `page` undefined inside the macro #}

{# ✅ #}
{% import "macros/page-link.njk" as nav with context %}
{{ nav.pageLink() }}
```

Or pass the variable explicitly:

```nunjucks
{% from "macros/page-link.njk" import pageLink %}
{{ pageLink(page) }}        {# pass page as arg #}
```

### Autoescape surprises — something escapes that shouldn't

**Diagnosis:** Identify whether the source string already contains entity-encoded characters.

```nunjucks
{# If `body` contains "Tom &amp; Jerry" already-encoded, autoescape will re-encode it to "Tom &amp;amp; Jerry" #}
{{ body }}                  {# Double-encoded #}
{{ body | safe }}           {# Single-encoded (correct) — but only if upstream is trusted #}
```

**Fix:** Decide whether the source should be encoded once or zero times. Then pick filter accordingly.

### `dump | safe` works in dev, breaks in production

**Cause:** The object contained a string with `</script>` in dev that happened to render fine, but in production the data is different and now breaks JS parsing.

**Fix:** Always use `jsonScript` for `<script>`-embedded data. Never `dump | safe`.

---

## Data cascade issues

### Variable available in `dump` but undefined in a sub-template

**Cause:** Variable is defined at the page level but referenced inside a macro imported without `with context`.

**Fix:** See "Macro doesn't see page or site variables" above.

### `_data/*.js` exports a function, template gets the function not the result

**Cause:** Eleventy calls `module.exports` as a function only if it's the top-level export of a data file. Calling `require()` on the data file from another data file does NOT auto-invoke; the function reference comes back, not the result.

```js
// src/_data/site.js — Eleventy calls this function and uses the return value
module.exports = function () {
  return { baseUrl: "https://example.com" };
};

// src/_data/seoHome.js
const site = require("./site");           // ← `site` is the function, not the result!

// Fix — either invoke it
const siteData = require("./site")();

// Or export site.js as an object:
// site.js → module.exports = { baseUrl: "https://example.com" };
```

### Frontmatter not overriding directory data

**Cause:** Directory data is at Level 4; frontmatter is at Level 6 — frontmatter should win. If it doesn't, the key names differ.

**Diagnosis:**

```nunjucks
<pre>{{ page | dump(2) }}</pre>
<pre>{{ site | dump(2) }}</pre>
```

Dump named context objects; Nunjucks has no `.` whole-context accessor. Two adjacent levels often have similar but not identical keys (`og_image` vs `ogImage`).

### `eleventyComputed` value is `[object Object]`

**Cause:** The computed value is a string-typed Nunjucks expression that evaluates to an object.

```yaml
# ❌
eleventyComputed:
  meta: "{ title: '{{ title }}' }"     # this is a string that looks like an object
```

```js
// ✅ — use a JS function in a .11tydata.js file
// pricing.11tydata.js
module.exports = {
  eleventyComputed: {
    meta: (data) => ({ title: data.title, og: data.ogImage }),
  },
};
```

---

## Tailwind / asset issues

### Tailwind classes work in some templates, not others

**Cause:** `@source` directive in `tailwind.input.css` doesn't cover all template directories.

**Fix:**

```css
@import "tailwindcss";
@source "../src/**/*.{njk,md,html,js}";   /* ← cover every template type */
```

### CSS file is generated but classes don't apply

**Cause:** The `<link rel="stylesheet">` in the layout points to the wrong path, or the passthrough copy didn't run.

**Diagnosis:**

```bash
# Open dev server, view-source on a page
# Verify the <link rel="stylesheet" href="..."> path
# curl that URL and confirm it returns CSS, not 404 or HTML
curl -I http://localhost:3000/assets/css/tailwind.css
```

**Fix:**

```nunjucks
{# base.njk — verify path matches the passthrough mapping #}
<link rel="stylesheet" href="/assets/css/tailwind.css" />
```

```js
// .eleventy.js — verify mapping
eleventyConfig.addPassthroughCopy({ "src/assets/css": "assets/css" });
```

### Tailwind compile order race — first page loads styleless

**Cause:** `pnpm dev` started 11ty before Tailwind wrote its first output.

**Fix:**

```json
"dev": "pnpm run build:tailwind && concurrently …"
```

The leading `pnpm run build:tailwind &&` is required — it produces the initial `tailwind.css` synchronously before `concurrently` kicks off the watchers.

---

## Markdown issues

### Shortcodes don't work inside `.md` files

**Cause:** `markdownTemplateEngine` not set, or set to something other than `njk`.

**Fix:**

```js
return {
  markdownTemplateEngine: "njk",        // ← critical
};
```

### `<` and `>` in markdown content render as `&lt;` `&gt;` literally

**Cause:** The `md` filter is using `markdown-it({ html: false })`, which escapes raw HTML in the markdown source.

**Fix decision:**
- If the markdown should NEVER contain HTML: keep `html: false` (safer)
- For trusted authored content only: `html: true`
- If sometimes-yes-sometimes-no: use shortcodes for the inline HTML; keep `html: false`

### Linkify isn't autolinking URLs

**Cause:** `linkify` not enabled.

**Fix:**

```js
const md = markdownIt({ html: false, linkify: true, typographer: true });
```

---

## Deploy issues

### CSP errors flood the console on dev but not prod

**Cause:** CSP `<meta>` is being emitted in dev mode, blocking `eleventy --serve` live-reload scripts.

**Fix:** Gate on `runMode`:

```nunjucks
{% if eleventy.env.runMode == "build" %}
  <meta http-equiv="Content-Security-Policy" content="…" />
{% endif %}
```

### `frame-ancestors` not enforced

**Cause:** Delivered via `<meta>` instead of HTTP header. Per CSP3, `frame-ancestors` from a meta tag is silently ignored.

**Fix:** Move to nginx:

```nginx
add_header Content-Security-Policy "frame-ancestors 'none'" always;
add_header X-Frame-Options "DENY" always;
```

### Pages 404 in production despite being in `out/`

**Cause:** nginx `try_files` doesn't match the actual file structure.

**Fix:** For flat-permalink (`permalink: /foo.html`):

```nginx
location / {
  try_files $uri $uri.html $uri/ =404;
}
```

For directory-permalink (`permalink: /foo/index.html`):

```nginx
location / {
  try_files $uri $uri/ =404;
}
```

### Soft-nav swap breaks page-specific scripts

**Cause:** Modules attached listeners on initial load; soft-nav swapped the DOM; listeners point to detached nodes.

**Fix:** Hook the lifecycle events:

```js
function init() { /* attach listeners */ }
function destroy() { /* detach listeners */ }
document.addEventListener("erpai:page-loaded", init);
document.addEventListener("erpai:before-page-unload", destroy);
```

### `version-banner.js` fires constantly

**Cause:** Polling `/version.json` from inline JS via `fetch` is hitting CORS preflight in CSP'd contexts.

**Fix:** Use a `<meta name="erpai-build-sha">` tag and read on each navigation, rather than fetching JSON:

```nunjucks
<meta name="erpai-build-sha" content="{{ build.sha }}" />
```

```js
const currentSha = document.querySelector('meta[name="erpai-build-sha"]').content;
// Compare on each navigation event
```

---

## Performance issues

### Build is slow (>30 seconds for a small site)

**Common culprits:**

1. `markdown-it` plugins — each adds overhead
2. Async filters used in many templates — they serialize the render
3. `_data/*.js` doing slow IO on every build
4. Passthrough copy of `node_modules/` or other large directories

**Diagnosis:**

```bash
DEBUG=Eleventy:* pnpm build 2>&1 | grep -E "render|copy" | head -20
```

**Fixes:**
- Move slow IO out of `_data/*.js` into a separate script that writes JSON once
- Replace async filters with computed `_data` where possible
- Audit `addPassthroughCopy` for accidentally-broad globs

### Live reload is slow

**Cause:** 11ty rebuilds the entire site on every change, including unaffected pages.

**Mitigations:**
- Eleventy v3 incremental builds are mostly automatic; check there's no `--ignore-initial` style flag overriding it
- Reduce `addWatchTarget` scope to just the files that actually require rebuilds
- Move large data sets to async-cached files

### Tailwind dev rebuild is slow

**Cause:** `@source` globs are too broad, scanning `node_modules/` or `out/`.

**Fix:**

```css
@source "../src/**/*.{njk,md,html,js}";       /* ← specific */
/* NOT: @source "../**/*"; */
```
