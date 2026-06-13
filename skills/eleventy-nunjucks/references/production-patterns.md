# Production patterns reference

Patterns for production-ready 11ty sites: CSP, View Transitions, theme system, after-build hooks, OG image generation, JSON-LD inlining, sitemap/robots, and the nginx serving model.

## CSP — authoring the policy

### Where to deliver

| Directive | Delivery |
|---|---|
| `default-src`, `script-src`, `style-src`, `img-src`, `font-src`, `connect-src`, `form-action`, `object-src`, `base-uri`, `upgrade-insecure-requests`, `worker-src` | `<meta http-equiv="Content-Security-Policy">` in `<head>` |
| `frame-ancestors` | **HTTP header only** (silently ignored from `<meta>` per CSP3) |
| `report-uri`, `report-to` | **HTTP header only** |

### Meta tag — gated on build mode

```nunjucks
{% if eleventy.env.runMode == "build" %}
  <meta
    http-equiv="Content-Security-Policy"
    content="default-src 'self';
             base-uri 'self';
             object-src 'none';
             upgrade-insecure-requests;
             script-src 'self';
             style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
             font-src 'self' https://fonts.gstatic.com data:;
             img-src 'self' data: blob:;
             connect-src 'self';
             form-action 'self' mailto:;
             worker-src 'none';"
  />
{% endif %}
```

The `runMode == "build"` gate is required — `eleventy --serve` injects live-reload scripts that violate any reasonable `script-src 'self'`. Without the gate, dev mode shows console errors on every page.

### nginx HTTP header

```nginx
# example.com.conf (or your project's vhost)
add_header Content-Security-Policy "frame-ancestors 'none'" always;
add_header X-Frame-Options "DENY" always;
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;
```

The `always` flag is important — without it, nginx skips the header on error responses (404, 500), leaving them unprotected.

### Verify after deploy

```bash
$ curl -sI https://example.com/ | grep -iE 'content-security-policy|x-frame-options|strict-transport-security|x-content-type|referrer-policy|permissions-policy'
```

### Inline scripts / styles — when required

For inline `<script>` blocks (analytics, data hydration), use one of:

1. **A nonce** — generate per-request, include in the policy: `script-src 'self' 'nonce-{{ nonce }}'`. Requires server-side rendering or edge logic; not directly compatible with static sites.
2. **A hash** — `script-src 'self' 'sha256-{{ scriptHash }}'`. Requires computing the hash for every inline script and including it in the policy. Build-time generation is possible but error-prone.
3. **External files** — move everything to `src/assets/js/*.js`, served with `'self'`. **Preferred for static sites.**

JSON-LD blocks (`<script type="application/ld+json">…</script>`) are **exempt from `script-src`** because the type is not executable JS. Same for speculation rules (`<script type="speculationrules">`).

## View Transitions API contract

Once opted in, the soft-nav lifecycle becomes a contract — ship the whole thing:

### Lifecycle events

```js
// theme-boot.js (head, blocking, before paint)
document.documentElement.addEventListener("site:page-loaded",       reinit);
document.documentElement.addEventListener("site:before-page-unload", cleanup);

function reinit() {
  // Re-bind all JS modules. Called on initial load AND every soft-nav.
  initNav();
  initObservers();
  initThemeToggle();
}

function cleanup() {
  // Tear down listeners and timers that won't survive the DOM swap.
  removeNavHandlers();
  disconnectObservers();
}
```

| Event | Fires when | Modules must |
|---|---|---|
| `site:page-loaded` | After initial page load AND after every soft-nav | Attach listeners, init observers |
| `site:before-page-unload` | Just before a soft-nav swaps the DOM | Remove listeners, disconnect observers |

### Scroll contract

```js
// page-router.js
if ("scrollRestoration" in history) history.scrollRestoration = "manual";
```

| Navigation type | Scroll behavior |
|---|---|
| Forward (link click) | Scroll to top, or to `#hash` target if present |
| Back / Forward (browser buttons) | Restore exact scroll position the user left at |
| Same-page `#hash` | Smooth-scroll to target, offset by fixed nav + breathing room |

CSS fallback for browsers without View Transitions API:

```css
[id] {
  scroll-margin-top: calc(var(--nav-height) + var(--breathing-room));
}
```

### Sanitize swapped HTML

The DOM swap happens via `innerHTML` (or equivalent). User-controlled content in the swapped HTML is an XSS vector. Sanitize with DOMPurify:

```js
import DOMPurify from "/assets/js/vendor/purify.min.js";

const clean = DOMPurify.sanitize(rawHTML, {
  ADD_TAGS: ["style"],        // preserve per-page <style> blocks
  ADD_ATTR: ["target", "rel"],
});
container.innerHTML = clean;
```

`ADD_TAGS: ["style"]` is load-bearing — without it, page-specific styles get stripped, and the new page renders with stale CSS.

## Theme system — light-first with decay

The pattern: default light, opt-in dark, decay back to light after 6 hours of no further interaction.

### `theme-boot.js` — runs in `<head>`, blocking, before paint

```html
<head>
  <script>
    // Inline; must run before <body> renders to avoid FOUC.
    (function () {
      const STAMP_KEY = "site-theme-dark-at";
      const TTL_HOURS = 6;
      const stamp = localStorage.getItem(STAMP_KEY);
      if (stamp) {
        const elapsedMs = Date.now() - Number(stamp);
        const ttlMs = TTL_HOURS * 60 * 60 * 1000;
        if (elapsedMs > ttlMs) {
          localStorage.removeItem(STAMP_KEY);
        } else {
          document.documentElement.classList.add("dark");
        }
      }
    })();
  </script>
  <link rel="stylesheet" href="/assets/css/tailwind.css" />
</head>
```

### `theme-toggle.js` — runs after DOM ready, deferred

```js
// theme-toggle.js
const STAMP_KEY = "site-theme-dark-at";
const toggle = document.querySelector('[data-theme-toggle]');

if (toggle) {
  toggle.addEventListener("click", () => {
    const isDark = document.documentElement.classList.toggle("dark");
    if (isDark) localStorage.setItem(STAMP_KEY, String(Date.now()));
    else        localStorage.removeItem(STAMP_KEY);
  });
}
```

### Tailwind v4 — dark selector

```css
@import "tailwindcss";

/* Define dark variant against html.dark */
@variant dark (&:where(.dark, .dark *));
```

Use:

```html
<div class="bg-white dark:bg-zinc-900 text-black dark:text-white">…</div>
```

## After-build hooks

`eleventy.after` runs once per build. Use for post-processing that's atomic with the build.

### Pattern 1 — file mirror

```js
eleventyConfig.on("eleventy.after", async ({ directories }) => {
  const fs   = await import("fs");
  const path = await import("path");
  const src  = path.join(directories.output, "protocol.md");
  const dst  = path.join(directories.output, "skill.md");
  if (fs.existsSync(src)) fs.copyFileSync(src, dst);
});
```

### Pattern 2 — manifest write

```js
eleventyConfig.on("eleventy.after", async ({ directories, results }) => {
  const fs = await import("fs");
  const path = await import("path");
  const manifest = {
    builtAt: new Date().toISOString(),
    sha: process.env.COMMIT_SHA || "dev",
    pages: results.map((r) => ({ url: r.url, outputPath: r.outputPath })),
  };
  fs.writeFileSync(
    path.join(directories.output, "build-manifest.json"),
    JSON.stringify(manifest, null, 2),
  );
});
```

### Pattern 3 — runMode gate

```js
eleventyConfig.on("eleventy.after", async ({ runMode, directories }) => {
  if (runMode !== "build") return;   // only after one-shot build, not after each --serve rebuild
  // … do something expensive (resize images, ship to CDN, ping a webhook)
});
```

## OG image generation

Pattern from a production site: every page gets a 1200×630 PNG with its title baked in.

### Workflow

1. **Build the site once** → `out/**/*.html`
2. **Walk the output**, parse `og:title`, render a Satori/Resvg/Playwright canvas per page
3. **Write PNGs** to `src/assets/images/og/<canonical-path>.png`
4. **Re-run the build** → PNGs are passthrough-copied to `out/`
5. **Maintain a manifest** (`scripts/og-image-manifest.json`) so unchanged pages aren't regenerated

```json
// scripts/og-image-manifest.json
{
  "/pricing": { "headline": "Pricing", "ogType": "website", "hash": "a1b2c3d4" },
  "/blog/post": { "headline": "Post Title", "ogType": "article", "hash": "e5f6g7h8" }
}
```

A separate check script (`scripts/check-og-images.mjs`) walks `out/`, confirms each page's `og:image` resolves to an existing PNG, and re-hashes the title — failing CI if drift is detected.

## JSON-LD inlining

Inline schema.org payloads as `<script type="application/ld+json">`. The script type is **not** executable, so CSP `script-src` rules don't apply.

### Pattern 1 — static payload per page type

```js
// src/_data/seoHome.js
module.exports = {
  jsonLd: {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "Organization", "name": "Example Site", "url": "https://example.com" },
      { "@type": "WebSite",      "name": "Example Site", "url": "https://example.com" },
    ],
  },
};
```

```nunjucks
{# pages/index.njk #}
<script type="application/ld+json">
  {{ seoHome.jsonLd | jsonScript | safe }}
</script>
```

### Pattern 2 — generated from data

```js
// src/_data/seoPricing.js
const pricing = require("./pricing.json");
module.exports = {
  jsonLd: {
    "@context": "https://schema.org",
    "@type":    "Product",
    "name":     "Platform",
    "offers": pricing.tiers.map((t) => ({
      "@type": "Offer", "name": t.name, "priceCurrency": "USD", "price": t.price,
    })),
  },
};
```

### Pattern 3 — inline per-page in template

For pages that need access to `page.*` or computed data:

```nunjucks
{# pages/blog/post.njk #}
<script type="application/ld+json">
  {{
    {
      "@context": "https://schema.org",
      "@type":    "Article",
      "headline": title,
      "datePublished": date,
      "url":      site.baseUrl + (page.url | normalize_path)
    } | jsonScript | safe
  }}
</script>
```

## Sitemap + robots.txt

### sitemap.xml — generated by 11ty

```nunjucks
{# src/pages/sitemap.xml.njk #}
---
permalink: /sitemap.xml
eleventyExcludeFromCollections: true
---
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
{% for page in collections.all %}
  {% if not page.data.eleventyExcludeFromCollections and not page.data.sitemap_exclude %}
  <url>
    <loc>{{ site.baseUrl }}{{ page.url | normalize_path }}</loc>
    <lastmod>{{ page.date | sitemapDate }}</lastmod>
  </url>
  {% endif %}
{% endfor %}
</urlset>
```

### robots.txt — passthrough

```
# src/robots.txt
User-agent: *
Allow: /
Disallow: /preview/
Disallow: /draft/

Sitemap: https://example.com/sitemap.xml
```

```js
eleventyConfig.addPassthroughCopy({ "src/robots.txt": "robots.txt" });
```

## nginx serving model

```nginx
server {
  listen 443 ssl http2;
  server_name example.com;
  root /opt/example/out/main;
  index index.html;

  # Flat-permalink pattern
  location / {
    try_files $uri $uri.html $uri/ =404;
  }

  # Static assets — long cache
  location /assets/ {
    add_header Cache-Control "public, max-age=31536000, immutable" always;
  }

  # HTML — short cache, must-revalidate
  location ~ \.html$ {
    add_header Cache-Control "public, max-age=300, must-revalidate" always;
  }

  # Security headers
  add_header Content-Security-Policy "frame-ancestors 'none'" always;
  add_header X-Frame-Options "DENY" always;
  add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
  add_header X-Content-Type-Options "nosniff" always;
  add_header Referrer-Policy "strict-origin-when-cross-origin" always;
}
```

The `try_files $uri $uri.html $uri/` line is what makes the flat-permalink pattern work — `/pricing` finds `/pricing.html`, `/blog/` finds `/blog/index.html`, anything else 404s.

## Build SHA injection

```js
// .eleventy.js
eleventyConfig.addGlobalData("build", () => ({
  sha:     process.env.COMMIT_SHA || "dev",
  builtAt: process.env.BUILT_AT  || new Date().toISOString(),
}));
```

```nunjucks
{# base.njk #}
<meta name="site-build-sha"      content="{{ build.sha }}" />
<meta name="site-build-built-at" content="{{ build.builtAt }}" />
```

Client-side `version-banner.js` polls a `/version.json` (or reads the meta on load) and prompts users to refresh when SHA changes.
