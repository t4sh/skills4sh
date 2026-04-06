---
name: localhost-screenshots
description: "Take screenshots of locally running websites (localhost) across all viewport breakpoints for visual comparison, regression testing, or documentation. Use this skill whenever the user mentions screenshots, visual comparison, visual regression, capturing pages, responsive screenshots, breakpoint testing, or taking snapshots of a local dev server, localhost site, 11ty site, or any site running on localhost. Also triggers on 'screenshot my site', 'capture pages', 'visual diff', 'compare screenshots', 'before/after screenshots', 'responsive screenshots', 'check breakpoints', or any request involving programmatic screenshots of web pages running locally. ALWAYS use this skill instead of guessing at screenshot approaches — it defines the exact toolchain and avoids wasted time trying different browsers or tools."
license: MIT
compatibility: macOS, Linux, or Windows with Chrome or Playwright
metadata:
  author: t4sh
  version: "3.1.0"
  tags: screenshots, localhost, visual-regression, responsive, breakpoints, playwright, chrome, browser-automation, pixel-diff, accessibility, cdp
---

# Localhost Screenshots

This skill captures screenshots of locally running websites. It supports two primary approaches depending on the task:

- **Chrome MCP** — for quick debugging, single screenshots, and interactive verification
- **Playwright** — for systematic multi-breakpoint screenshot sets and visual regression

For niche scenarios (CDP attach, persistent sessions, AI snapshots, CI workflows), see the [Reference Files](#reference-files) section.

## Tool Decision Matrix — Read This First

| Need | Tool | Why |
|------|------|-----|
| Quick visual check / debug | **Chrome MCP** | Already connected to user's real browser, sees localhost |
| Verify a JS fix | **Chrome MCP** | Execute JS in live page context |
| One or two screenshots | **Chrome MCP** | Instant, no setup |
| Interactive debugging | **Chrome MCP** | Click, fill, inspect state in real browser |
| Systematic multi-breakpoint set | **Playwright** | Automated viewport resizing across 8 breakpoints |
| Before/after comparison | **Playwright** | Structured comparison HTML output |
| Visual regression testing | **Playwright** | Repeatable, scriptable, consistent |

---

## Chrome MCP — Quick Screenshots & Debugging

**Use Chrome MCP when you need 1-2 screenshots or are debugging interactively.** It connects to the user's actual Chrome browser, which can already reach their localhost dev server. No setup, no serving files, no Playwright install.

### Prerequisites

The user's dev server must be running (e.g., `npx @11ty/eleventy --serve --port=3000`).

### Quick Screenshot Flow

```
# 1. Get/create a tab
mcp__Claude_in_Chrome__tabs_context_mcp({ createIfEmpty: true })

# 2. Navigate to the page
mcp__Claude_in_Chrome__navigate({ url: "http://localhost:3000/dashboard/" })

# 3. Take a screenshot
mcp__Claude_in_Chrome__computer({ action: "screenshot" })

# 4. (Optional) Resize for a different viewport and screenshot again
mcp__Claude_in_Chrome__resize_window({ width: 375, height: 812 })
mcp__Claude_in_Chrome__computer({ action: "screenshot" })
```

### Debugging Patterns with Chrome MCP

**Check if a JS module loaded:**
```
mcp__Claude_in_Chrome__javascript_tool({
  action: "javascript_exec",
  text: "JSON.stringify(Object.keys(window.MyApp || {}))"
})
```

**Inspect computed styles:**
```
mcp__Claude_in_Chrome__javascript_tool({
  action: "javascript_exec",
  text: "JSON.stringify(getComputedStyle(document.querySelector('.target')).background)"
})
```

**Measure element positions (gap debugging):**
```
mcp__Claude_in_Chrome__javascript_tool({
  action: "javascript_exec",
  text: "JSON.stringify(document.querySelector('.target').getBoundingClientRect())"
})
```

**Get page info:**
```
mcp__Claude_in_Chrome__javascript_tool({
  action: "javascript_exec",
  text: "JSON.stringify({ title: document.title, url: location.href, stylesheets: document.querySelectorAll('link[rel=stylesheet]').length })"
})
```

### When NOT to Use Chrome MCP for Screenshots

- When you need all 8 breakpoints captured systematically — use Playwright
- When you need repeatable, scriptable visual regression — use Playwright
- When generating a before/after comparison HTML — use Playwright

---

## Playwright — Systematic Multi-Breakpoint Screenshots

Use Playwright for automated, repeatable screenshot sets across all breakpoints. This is the right tool for visual regression testing and comprehensive responsive documentation.

### Golden Rules

**1. Always use Playwright's bundled Chromium. Never use Puppeteer, Selenium, or system Chrome.** Do not check for installed browsers. Playwright ships its own Chromium.

**2. NEVER open HTML files via `file://` paths. Always serve them over HTTP.** This is the #1 cause of unstyled screenshots. Relative CSS/JS paths won't resolve without an HTTP server.

### Serving the Site (CRITICAL for Playwright)

Before taking Playwright screenshots, ensure the site is served over HTTP.

**If the user's dev server is already running** (they told you the port, or you can confirm it):
```js
const BASE_URL = 'http://localhost:8080'; // use their port
```

**If you have the built output directory** (e.g., 11ty's `_site/` folder):
```bash
npx serve _site -l 3000 &
```
Then use `http://localhost:3000` as the base URL.

**If you need to build and serve** (project source is available but not built):
```bash
npx @11ty/eleventy                    # build the site
npx serve _site -l 3000 &            # serve the output
```

**In a sandboxed environment (like Cowork)** where the user's host localhost is unreachable:
The VM cannot access `localhost` on the user's machine. You MUST either build the site inside the VM, or serve the static files that are available in the mounted workspace. Never assume `localhost:8080` is reachable — test it first.

### Verifying the Server Is Up Before Screenshotting

Always confirm the server is responding before taking screenshots:
```js
const testPage = await browser.newPage();
try {
  const response = await testPage.goto(BASE_URL, { timeout: 5000 });
  if (!response || !response.ok()) {
    throw new Error(`Server returned ${response?.status()}`);
  }
  const stylesheetCount = await testPage.evaluate(
    () => document.querySelectorAll('link[rel="stylesheet"], style').length
  );
  if (stylesheetCount === 0) {
    console.warn('WARNING: No stylesheets detected — page may render unstyled');
  }
} finally {
  await testPage.close();
}
```

### Setup (run once per session)

```bash
npm install playwright@latest 2>/dev/null
npx playwright install --with-deps chromium
```

That's it. No `apt-get install chromium`, no `which google-chrome`. Playwright handles everything.

### Standard Breakpoints

Every screenshot task captures **all standard breakpoints** unless the user explicitly asks for a single size.

```js
const BREAKPOINTS = [
  { name: 'mobile-sm',  width: 320,  height: 568  },  // iPhone SE / small phones
  { name: 'mobile',     width: 375,  height: 812  },  // iPhone X / standard phones
  { name: 'mobile-lg',  width: 428,  height: 926  },  // iPhone Pro Max / large phones
  { name: 'tablet',     width: 768,  height: 1024 },  // iPad / portrait tablet
  { name: 'tablet-lg',  width: 1024, height: 1366 },  // iPad Pro / landscape tablet
  { name: 'desktop',    width: 1280, height: 800  },  // Standard laptop
  { name: 'desktop-lg', width: 1440, height: 900  },  // Large laptop
  { name: 'wide',       width: 1920, height: 1080 },  // Full HD monitor
];
```

If the user's project has custom breakpoints (check their CSS for `@media` queries, or their tailwind config for `screens`), use those instead of or in addition to the defaults.

### Canonical Screenshot Script

```js
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:8080'; // adjust port as needed

const BREAKPOINTS = [
  { name: 'mobile-sm',  width: 320,  height: 568  },
  { name: 'mobile',     width: 375,  height: 812  },
  { name: 'mobile-lg',  width: 428,  height: 926  },
  { name: 'tablet',     width: 768,  height: 1024 },
  { name: 'tablet-lg',  width: 1024, height: 1366 },
  { name: 'desktop',    width: 1280, height: 800  },
  { name: 'desktop-lg', width: 1440, height: 900  },
  { name: 'wide',       width: 1920, height: 1080 },
];

const ROUTES = ['/']; // add routes as needed: '/about', '/blog', etc.

(async () => {
  const browser = await chromium.launch();
  const outDir = '_screenshots';

  for (const route of ROUTES) {
    const routeName = route === '/' ? 'home' : route.slice(1).replace(/\//g, '-');
    const routeDir = path.join(outDir, routeName);
    fs.mkdirSync(routeDir, { recursive: true });

    for (const bp of BREAKPOINTS) {
      const page = await browser.newPage();
      await page.setViewportSize({ width: bp.width, height: bp.height });
      await page.goto(`${BASE_URL}${route}`, { waitUntil: 'networkidle' });
      await page.screenshot({
        path: path.join(routeDir, `${bp.name}-${bp.width}x${bp.height}.png`),
        fullPage: true,
      });
      await page.close();
    }
  }

  await browser.close();
  console.log(`Done. Screenshots saved to ${outDir}/`);
})();
```

### Key API Details

- `chromium.launch()` — no arguments needed, uses Playwright's bundled Chromium
- `waitUntil: 'networkidle'` — waits until no network requests for 500ms; important for sites that load assets
- `fullPage: true` — captures the entire scrollable page, not just the viewport
- `page.setViewportSize()` — set before navigating for accurate responsive rendering
- Create a **new page per breakpoint** — ensures clean rendering without leftover state

### Output Location

**Always save screenshots to `_screenshots/` in the current project folder.** This is a convention — not negotiable.

```
_screenshots/
  home/
    mobile-sm-320x568.png
    mobile-375x812.png
    mobile-lg-428x926.png
    tablet-768x1024.png
    tablet-lg-1024x1366.png
    desktop-1280x800.png
    desktop-lg-1440x900.png
    wide-1920x1080.png
  about/
    mobile-sm-320x568.png
    ...
```

### Before/After Visual Comparison

For visual regression, capture two sets and generate an HTML comparison page:

```js
const fs = require('fs');
const path = require('path');

function generateComparison(beforeDir, afterDir, outputPath) {
  const breakpoints = fs.readdirSync(beforeDir).filter(f => f.endsWith('.png')).sort();

  const html = `<!DOCTYPE html><html><head>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: system-ui, -apple-system, sans-serif; padding: 24px; background: #f5f5f5; }
  h1 { margin-bottom: 24px; }
  .pair { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 32px;
          background: white; padding: 16px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
  .pair h3 { font-size: 14px; color: #666; margin-bottom: 8px; }
  .pair img { width: 100%; border: 1px solid #eee; border-radius: 4px; }
  .breakpoint-label { font-size: 18px; font-weight: 600; margin: 24px 0 12px; color: #333; }
</style></head><body>
<h1>Visual Comparison</h1>
${breakpoints.map(f => {
  const name = f.replace('.png', '');
  return `<div class="breakpoint-label">${name}</div>
<div class="pair">
  <div><h3>Before</h3><img src="${path.relative(path.dirname(outputPath), path.join(beforeDir, f))}"></div>
  <div><h3>After</h3><img src="${path.relative(path.dirname(outputPath), path.join(afterDir, f))}"></div>
</div>`;
}).join('\n')}
</body></html>`;

  fs.writeFileSync(outputPath, html);
}
```

#### Workflow for before/after

1. Run the canonical screenshot script, saving to `_screenshots/before/`
2. User makes their changes
3. Run the same script again, saving to `_screenshots/after/`
4. Generate the comparison HTML

### Waiting for Content

If the page has dynamic content or lazy-loaded images:

```js
// Wait for a specific element
await page.waitForSelector('.hero-image', { timeout: 10000 });

// Wait for all images to load
await page.evaluate(() => {
  return Promise.all(
    Array.from(document.images)
      .filter(img => !img.complete)
      .map(img => new Promise(resolve => {
        img.onload = img.onerror = resolve;
      }))
  );
});

// Last resort: fixed delay after networkidle
await page.waitForTimeout(500);
```

### Screenshot a Specific Element

```js
const element = await page.locator('.main-content');
await element.screenshot({ path: 'content-only.png' });
```

### Detecting Project Breakpoints

Before using the default breakpoints, check if the project defines its own:

```bash
# Tailwind: check tailwind.config.js for custom screens
grep -r "screens" tailwind.config.* 2>/dev/null

# CSS: find @media breakpoints
grep -roh '@media.*max-width:\s*[0-9]*px' src/ --include="*.css" 2>/dev/null | sort -u
grep -roh '@media.*min-width:\s*[0-9]*px' src/ --include="*.css" 2>/dev/null | sort -u
```

### When the Dev Server Isn't Running

If no server is running, you need to serve the files yourself:

**Option A: Serve a pre-built output directory (fastest)**

```js
const { exec } = require('child_process');

const server = exec('npx serve _site -l 3000 --no-clipboard', { cwd: projectDir });
const BASE_URL = 'http://localhost:3000';

let ready = false;
for (let i = 0; i < 15; i++) {
  try {
    const testPage = await browser.newPage();
    await testPage.goto(BASE_URL, { timeout: 2000 });
    await testPage.close();
    ready = true;
    break;
  } catch {
    await new Promise(r => setTimeout(r, 1000));
  }
}
if (!ready) throw new Error('HTTP server failed to start within 15s');

// ... take screenshots ...

server.kill();
```

**Option B: Build and serve**

```js
const { execSync, exec } = require('child_process');
execSync('npx @11ty/eleventy', { cwd: projectDir, stdio: 'inherit' });
const server = exec('npx serve _site -l 3000 --no-clipboard', { cwd: projectDir });
// ... same wait loop as above ...
```

### Troubleshooting

If `npx playwright install --with-deps chromium` fails:
```bash
npx playwright install chromium
sudo npx playwright install-deps chromium
```

If the site uses self-signed HTTPS locally:
```js
const context = await browser.newContext({ ignoreHTTPSErrors: true });
const page = await context.newPage();
```

---

## What NOT to Do

- **Do not use Puppeteer** — it's a separate headless browser that can't reach localhost from sandbox
- **Do not use JSDOM** — missing browser APIs (matchMedia, IntersectionObserver, sessionStorage)
- Do not look for system Chrome or Chromium installations
- Do not use `google-chrome`, `chromium-browser`, or any system binary
- Do not use Selenium or WebDriver
- Do not use `capture-website-cli` or similar npm screenshot wrappers
- Do not check for `CHROME_PATH` or `PUPPETEER_EXECUTABLE_PATH` environment variables
- Do not install Chrome via apt, snap, or any package manager
- Do not take screenshots at only one viewport size (always capture all breakpoints unless explicitly told otherwise)
- **Do not open HTML files via `file://` paths** — CSS/JS paths won't resolve without an HTTP server
- Do not assume the user's host `localhost` is reachable from a sandboxed VM — always verify connectivity first
- **Do not waste time on Puppeteer → serve → connect workarounds** when Chrome MCP is already connected

---

## Reference Files

For advanced patterns (CDP attach, persistent sessions, pixel-diff, AI snapshots, CI workflows), read these files from the `references/` directory:

| File | Contents |
|------|----------|
| [references/playwright-patterns.md](references/playwright-patterns.md) | Pre-flight checks, serving patterns, persistent sessions, breakpoint detection, stdin-friendly script templates |
| [references/visual-regression.md](references/visual-regression.md) | Pixel-diff scoring, comparison HTML generation, GitHub Actions CI/CD workflow |
| [references/interaction-templates.md](references/interaction-templates.md) | Auth flows, e-commerce flows, state variations, interactive mode, core interaction primitives |
| [references/ai-snapshots.md](references/ai-snapshots.md) | Accessibility tree, DOM snapshots, interactive element maps, incremental DOM diff |
| [references/troubleshooting.md](references/troubleshooting.md) | Common issues by project type (SSG, Next.js, Tailwind, WordPress) |
