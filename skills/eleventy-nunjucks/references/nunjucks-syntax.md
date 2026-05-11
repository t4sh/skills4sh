# Nunjucks syntax reference

Deep dive on Nunjucks tags, control flow, macros, scoping, and async behavior. Read when the main skill summary is not enough for tags, imports, or macro scope.

## Output expressions

```nunjucks
{{ user.name }}                      {# Property access #}
{{ users[0] }}                       {# Array index #}
{{ user["full name"] }}              {# Bracket key (when not a valid identifier) #}
{{ a + b }}                          {# Concatenation / numeric add #}
{{ a if cond else b }}               {# Ternary #}
{{ count or "none" }}                {# Short-circuit OR (falsy → "none") #}
{{ items | length }}                 {# Filter pipe #}
{{ user.name | upper | trim }}       {# Chained filters #}
```

**Undefined access is silent by default.** `{{ a.b.c }}` on a missing `a` renders an empty string. Set `throwOnUndefined: true` in the environment to surface bugs (NOTE: 11ty doesn't expose this directly — use a custom error filter or rely on test pages).

## Comments

```nunjucks
{# This line is not rendered. Comments do not nest. #}
```

Comments are stripped at compile time — they have zero runtime cost and aren't visible in browser source.

## Conditionals

```nunjucks
{% if user.admin %}
  <a href="/admin">Admin</a>
{% elif user.member %}
  <a href="/account">Account</a>
{% else %}
  <a href="/login">Sign in</a>
{% endif %}
```

Falsy values: `false`, `null`, `undefined`, `0`, `""`, `[]` (empty array), `{}` (empty object — yes, this is different from Python/JS).

```nunjucks
{% if "admin" in user.roles %}…{% endif %}    {# membership #}
{% if user.email and not user.banned %}…{% endif %}
```

## Loops

### Array iteration

```nunjucks
{% for item in items %}
  <li>{{ loop.index }}. {{ item.label }}</li>
{% else %}
  <li>No items.</li>     {# fires when items is empty/undefined #}
{% endfor %}
```

| `loop` variable | Meaning |
|---|---|
| `loop.index` | 1-based current index |
| `loop.index0` | 0-based current index |
| `loop.revindex` | Items remaining (1-based) |
| `loop.revindex0` | Items remaining (0-based) |
| `loop.first` | `true` on first iteration |
| `loop.last` | `true` on last iteration |
| `loop.length` | Total count |

### Object iteration

```nunjucks
{% for key, value in user %}
  <dt>{{ key }}</dt><dd>{{ value }}</dd>
{% endfor %}
```

### Async iteration

```nunjucks
{# Use asyncEach / asyncAll only when the loop body contains async filters or extensions. #}
{# Regular {% for %} will fail if filters in the body are async. #}
{% asyncEach item in items %}
  <li>{{ item.url | fetchTitle }}</li>
{% endeach %}
```

`asyncAll` runs iterations in parallel; `asyncEach` runs sequentially. Prefer `asyncAll` unless ordering matters or rate limits are a concern.

## Variables

### `set` — assignment

```nunjucks
{% set page_title = title or site.name %}
{% set items = [1, 2, 3] %}
{% set user = { name: "Ada", email: "ada@x" } %}
```

Scope: limited to the current block. To modify a variable from outer scope, use `set` at the outer scope first.

### `set` block — capture rendered output

```nunjucks
{% set nav %}
  <nav>
    {% for link in nav.links %}<a href="{{ link.href }}">{{ link.label }}</a>{% endfor %}
  </nav>
{% endset %}

{# Now `nav` is a string containing the rendered HTML #}
<header>{{ nav | safe }}</header>
```

Useful when rendering the same content multiple times.

## Includes

```nunjucks
{% include "sections/hero/hero-01.njk" %}
```

- **Inherits parent scope.** All variables (`page`, `site`, `title`, etc.) are visible inside the included file.
- **Cached.** The same template path resolves to the same compiled template; passing different `{% set %}` values is the way to vary the output.

### Optional includes

```nunjucks
{% include "optional-cta.njk" ignore missing %}
```

Renders nothing if the file doesn't exist. Useful for opt-in section overrides.

### Dynamic includes

```nunjucks
{% set tpl = "sections/hero/hero-" + variant + ".njk" %}
{% include tpl %}
```

Path is resolved at render time. Cached by string value, so vary in finite ways (don't generate paths from user input).

## Imports + macros

### Defining a macro

```nunjucks
{# src/_includes/macros/button.njk #}
{% macro button(label, href, variant="primary", icon=null) %}
  <a href="{{ href }}" class="btn btn-{{ variant }}">
    {% if icon %}<svg>…{{ icon }}…</svg>{% endif %}
    <span>{{ label }}</span>
  </a>
{% endmacro %}
```

### Importing as namespace

```nunjucks
{% import "macros/button.njk" as ui %}
{{ ui.button("Sign up", "/signup") }}
{{ ui.button("Sign in", "/signin", variant="ghost") }}
```

### Selective import + alias

```nunjucks
{% from "macros/button.njk" import button, link as anchor %}
{{ button("Buy", "/buy") }}
{{ anchor("Read more", "/blog") }}
```

### The `with context` trap

```nunjucks
{# By default, imported macros do NOT see the current scope. #}
{% import "macros/page-link.njk" as nav %}
{{ nav.pageLink(page) }}      {# ❌ — `page` is undefined inside the macro #}

{# Fix — pass current context: #}
{% import "macros/page-link.njk" as nav with context %}
{{ nav.pageLink() }}          {# ✅ #}
```

This differs from `{% include %}`, which always inherits scope.

### `caller()` — paired macros

```nunjucks
{# macros/card.njk #}
{% macro card(title) %}
  <article class="card">
    <h3>{{ title }}</h3>
    <div>{{ caller() }}</div>
  </article>
{% endmacro %}

{# usage #}
{% from "macros/card.njk" import card %}
{% call card("Pricing") %}
  <p>Per-token, no minimums.</p>
  <a href="/pricing">See plans →</a>
{% endcall %}
```

## Whitespace control

Default: tags emit no whitespace, but newlines around them are preserved → HTML often ends up with stray blank lines.

```nunjucks
{# Strip whitespace on a specific tag — hyphens inside the tag delimiter #}
{%- if x -%}                    {# strip both sides #}
{%- if x %}                     {# strip leading whitespace only #}
{% if x -%}                     {# strip trailing whitespace only #}
{{- value -}}                   {# same for expressions #}
```

### Global trim — environment options

Eleventy doesn't expose these in `setNunjucksEnvironmentOptions` directly; to enable, configure via `eleventyConfig.setNunjucksEnvironmentOptions({ trimBlocks: true, lstripBlocks: true })`:

| Option | Effect |
|---|---|
| `trimBlocks: true` | Removes `\n` immediately after a `{% … %}` tag |
| `lstripBlocks: true` | Removes leading spaces/tabs before a `{% … %}` tag |

Both affect `{% %}` only — never `{{ }}`. For per-tag control, use the hyphen syntax.

## The `extends` / `block` anti-pattern in 11ty

Standalone Nunjucks supports template inheritance:

```nunjucks
{# DO NOT USE THIS IN 11TY #}
{% extends "base.njk" %}
{% block content %}<p>Page content</p>{% endblock %}
```

**In 11ty, this bypasses the data cascade** — frontmatter from the child template is never merged into the parent. Use `layout:` frontmatter and render the child body through `content` with the safe filter in parent layouts (see main `SKILL.md` layout reminder).

## `raw` — escape Nunjucks parsing

To output literal `{{ }}` or `{% %}`:

```nunjucks
{% raw %}
  Use {% raw %}...{% endraw %} to output literal Nunjucks syntax.
  Example: {{ user.name }} renders as-is, not as a variable.
{% endraw %}
```

Common cases: code examples in documentation pages, embedded templates for downstream tooling.

## `autoescape` blocks

```nunjucks
{# Default: HTML escape applied to all {{ }} #}
{{ "<b>x</b>" }}                          {# &lt;b&gt;x&lt;/b&gt; #}

{# Disable for a block — rare, audit carefully #}
{% autoescape false %}
  {{ trusted_html }}                       {# raw output #}
{% endautoescape %}
```

Prefer per-value `| safe` over `{% autoescape false %}` blocks — narrower blast radius.

## Built-in filters — full table

| Filter | Effect | Example |
|---|---|---|
| `safe` | Mark output as already-safe HTML | `{{ html \| safe }}` |
| `escape` (alias `e`) | Force HTML escape | `{{ raw \| escape }}` |
| `upper` / `lower` | Case conversion | `{{ "Hi" \| upper }}` → `HI` |
| `capitalize` | First char upper, rest lower | `{{ "hello world" \| capitalize }}` → `Hello world` |
| `title` | Title Case each word | `{{ "hello world" \| title }}` → `Hello World` |
| `trim` | Strip surrounding whitespace | `{{ "  x  " \| trim }}` → `x` |
| `replace(from, to)` | Substring replace | `{{ "a-b" \| replace("-", " ") }}` → `a b` |
| `truncate(n)` | Cut to n chars + `...` | `{{ longstr \| truncate(80) }}` |
| `striptags` | Remove HTML tags | `{{ "<b>x</b>" \| striptags }}` → `x` |
| `length` | String/array/object size | `{{ items \| length }}` |
| `join(sep)` | Array → string | `{{ tags \| join(", ") }}` |
| `reverse` | Reverse copy | `{{ items \| reverse }}` |
| `sort` | Sorted copy | `{{ tags \| sort }}` |
| `first` / `last` | Array endpoints | `{{ items \| first }}` |
| `sum` | Numeric sum | `{{ prices \| sum }}` |
| `random` | Random element | `{{ quotes \| random }}` |
| `groupby("key")` | Group objects → `[key, items]` pairs | `{{ posts \| groupby("category") }}` |
| `dictsort` | Sorted object as `[k,v]` pairs | `{{ config \| dictsort }}` |
| `batch(n)` | Chunk into n-sized groups | `{{ items \| batch(3) }}` |
| `default(val, true)` | Fallback for undefined; pass `true` for falsy | `{{ name \| default("Anon", true) }}` |
| `int` / `float` / `string` | Coerce types | `{{ "5" \| int }}` |
| `abs` / `round(n)` | Number math | `{{ -3.7 \| abs \| round(1) }}` |
| `urlencode` | URI-encode | `{{ search \| urlencode }}` |
| `wordcount` | Token count | `{{ body \| wordcount }}` |
| `dump` / `dump(2)` | `JSON.stringify`, optional indent | `<pre>{{ obj \| dump(2) }}</pre>` |

## Async filter authoring

```js
// Standalone Nunjucks API — note the 3rd `true` arg
env.addFilter("fetchTitle", function (url, callback) {
  fetch(url)
    .then((r) => r.text())
    .then((html) => callback(null, html.match(/<title>(.*?)<\/title>/)?.[1] ?? url))
    .catch((err) => callback(err));
}, true);  // ← marks this as async

// Eleventy — prefer addAsyncFilter or addFilter with async fn (v3 handles both)
eleventyConfig.addAsyncFilter("fetchTitle", async (url) => {
  const r = await fetch(url);
  const html = await r.text();
  return html.match(/<title>(.*?)<\/title>/)?.[1] ?? url;
});
```

**Constraints:**
- Templates using async filters must be rendered through async render paths
- Eleventy handles this automatically; standalone Nunjucks needs `env.render` with a callback or `renderString` returning a Promise
- An async filter in a `{% for %}` loop without `asyncEach`/`asyncAll` will fail

## Jinja2 divergence — what's different

| Feature | Nunjucks | Jinja2 |
|---|---|---|
| `do` tag | Not built-in (add via extension) | Built-in |
| Macro context | Doesn't auto-inherit | Inherits parent scope |
| `groupby` return | Array of `[key, items]` pairs | Dict-like (with `grouper` attribute) |
| `truncate` default | `length=255, killwords=false, end="..."` | Same defaults |
| Whitespace control | `{%- -%}`, `trimBlocks`, `lstripBlocks` | Same |
| Async iteration | `asyncEach` / `asyncAll` (needed for async filters) | Not needed (sync engine) |

Most Jinja2 templates port to Nunjucks unchanged. The two areas that bite: macro context inheritance and `groupby` shape.

## Browser usage

Nunjucks can render in the browser via `WebLoader`, but for 11ty projects this is **always server-side** at build time. Skip browser-mode unless embedding Nunjucks rendering in a SPA — in that case, pre-compile via `nunjucks-precompile` and ship the `.js` bundle:

```bash
npx nunjucks-precompile templates/ > templates.js
```

The compiled bundle is much smaller than the runtime + uncompiled templates.
