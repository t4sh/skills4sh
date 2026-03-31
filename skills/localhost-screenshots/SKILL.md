---
name: localhost-screenshots
description: "Use when taking screenshots of localhost sites, visual regression testing, responsive breakpoint captures, before/after comparisons, or any programmatic screenshot of locally running web pages. Supports Chrome MCP (quick) and Playwright (systematic multi-breakpoint)."
license: MIT
compatibility: macOS, Linux, or Windows with Chrome or Playwright
metadata:
  author: t4sh
  version: "1.1.0"
  tags: screenshots, localhost, visual-regression, responsive, breakpoints, playwright, chrome
---

# Localhost Screenshots

You are an expert in capturing, comparing, and documenting visual states of locally running web applications. Your goal is to produce accurate, comprehensive screenshot sets for debugging, visual regression testing, and responsive design documentation.

## What I Can Help With

- **Quick visual checks** — single screenshots for debugging layout or styling issues
- **Responsive breakpoint captures** — systematic screenshots across 8 standard viewports
- **Before/after comparisons** — visual regression testing with side-by-side HTML output
- **Interactive debugging** — executing JS in live browser context to inspect state
- **Visual documentation** — capturing full-page screenshots for design reviews or handoffs

## Initial Assessment

Before taking screenshots, understand:

1. **Environment**
   - Is the dev server already running? What port?
   - What framework/build tool? (Next.js, Vite, 11ty, etc.)
   - Is this running in a sandbox/VM or locally?

2. **What You Need**
   - Quick debug screenshot or full breakpoint set?
   - Specific pages/routes or the whole site?
   - Before/after comparison needed?

3. **Scope**
   - Single page or multiple routes?
   - Full page or specific element?
   - Custom breakpoints or standard set?

---

This skill supports two approaches depending on the task:

- **Chrome MCP** — for quick debugging, single screenshots, and interactive verification
- **Playwright** — for systematic multi-breakpoint screenshot sets and visual regression

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
  text: "JSON.stringify(Object.keys(window.AtariKit || {}))"
})
```

**Inspect computed styles:**
```
mcp__Claude_in_Chrome__javascript_tool({
  action: "javascript_exec",
  text: "JSON.stringify(getComputedStyle(document.querySelector('.nav-profile-badge')).background)"
})
```

**Measure element positions (gap debugging):**
```
mcp__Claude_in_Chrome__javascript_tool({
  action: "javascript_exec",
  text: "JSON.stringify(document.querySelector('.dash-post-actions').getBoundingClientRect())"
})
```

**Simulate auth flow:**
```
mcp__Claude_in_Chrome__javascript_tool({
  action: "javascript_exec",
  text: "sessionStorage.setItem('krawler-auth', JSON.stringify({name:'Test',handle:'test',slug:'test',avatar:'Test'})); window.AtariKit.navProfile.init();"
})
```

**Get page info:**
```
mcp__Claude_in_Chrome__javascript_tool({
  action: "javascript_exec",
  text: "JSON.stringify({ title: document.title, url: location.href, navExists: !!document.getElementById('main-nav') })"
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

### Verifying the server is up before screenshotting

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

### Key API details

- `chromium.launch()` — no arguments needed, uses Playwright's bundled Chromium
- `waitUntil: 'networkidle'` — waits until no network requests for 500ms; important for 11ty sites that load assets
- `fullPage: true` — captures the entire scrollable page, not just the viewport
- `page.setViewportSize()` — set before navigating for accurate responsive rendering
- Create a **new page per breakpoint** — ensures clean rendering without leftover state

### Output location

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
  .controls { position: sticky; top: 0; background: #f5f5f5; padding: 12px 0; z-index: 10;
              display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 16px; border-bottom: 1px solid #ddd; }
  .controls button { padding: 6px 14px; border: 1px solid #ccc; border-radius: 4px;
                     background: white; cursor: pointer; font-size: 13px; }
  .controls button.active { background: #333; color: white; border-color: #333; }
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

### Detecting Project Breakpoints

Before using the default breakpoints, check if the project defines its own:

```bash
# Tailwind: check tailwind.config.js for custom screens
grep -r "screens" tailwind.config.* 2>/dev/null

# CSS: find @media breakpoints
grep -roh '@media.*max-width:\s*[0-9]*px' src/ --include="*.css" 2>/dev/null | sort -u
grep -roh '@media.*min-width:\s*[0-9]*px' src/ --include="*.css" 2>/dev/null | sort -u
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

### Playwright Pre-Flight Checks

Before running any Playwright screenshot task, run these checks in order. **Do not skip steps — each one prevents a class of broken screenshots.**

#### 1. Verify Playwright is installed

```bash
npx playwright --version
```

If missing or outdated:
```bash
npm install playwright@latest 2>/dev/null
npx playwright install --with-deps chromium
```

#### 2. Verify Chromium browser is available

```bash
npx playwright install chromium --dry-run 2>&1 || npx playwright install chromium
```

Do **not** check for system Chrome/Chromium — Playwright ships its own bundled Chromium. If `install --with-deps` fails on Linux, fall back to:
```bash
npx playwright install chromium
sudo npx playwright install-deps chromium
```

#### 3. Verify the dev server is reachable

```js
const { chromium } = require('playwright');
const browser = await chromium.launch();
const page = await browser.newPage();

try {
  const response = await page.goto('http://localhost:PORT', { timeout: 5000 });
  if (!response || !response.ok()) {
    throw new Error(`Server returned ${response?.status()} — is the dev server running?`);
  }
  console.log('✓ Server reachable');
} catch (e) {
  console.error(`✗ Cannot reach localhost:PORT — ${e.message}`);
  // Abort: do not proceed to screenshots
} finally {
  await page.close();
  await browser.close();
}
```

Common failures:
- `ERR_CONNECTION_REFUSED` — dev server not running or wrong port
- `TIMEOUT` — server is starting up, retry after 2-3 seconds
- Sandboxed VM — host `localhost` is unreachable; must build and serve inside the VM

#### 4. Verify stylesheets are loading

```js
const stylesheetCount = await page.evaluate(
  () => document.querySelectorAll('link[rel="stylesheet"], style').length
);
if (stylesheetCount === 0) {
  console.warn('⚠ No stylesheets detected — page will render unstyled');
  console.warn('  Are you serving via HTTP? file:// paths break relative CSS imports');
}
```

If zero stylesheets:
- You're likely opening via `file://` instead of HTTP — serve over HTTP
- The build step hasn't run — CSS hasn't been generated
- Asset paths are wrong — check the base URL config in the framework

#### 5. Verify page content has loaded

```js
// Wait for network to settle
await page.goto(url, { waitUntil: 'networkidle' });

// Check the page isn't blank or showing an error
const bodyText = await page.evaluate(() => document.body?.innerText?.trim().slice(0, 200));
if (!bodyText || bodyText.length < 10) {
  console.warn('⚠ Page body is empty or near-empty — likely a loading/hydration issue');
}

// For SPAs: wait for the app root to have content
const appRoot = await page.evaluate(() => {
  const root = document.querySelector('#__next, #root, #app, main');
  return root ? root.children.length : -1;
});
if (appRoot === 0) {
  console.warn('⚠ App root has no children — JS may not have hydrated yet');
  // Wait for a specific selector instead of relying on networkidle
  await page.waitForSelector('main > *', { timeout: 10000 });
}
```

#### 6. Check for obstructing overlays

```js
// Detect common overlays that ruin screenshots
const overlays = await page.evaluate(() => {
  const selectors = [
    '[class*="cookie"]', '[class*="consent"]', '[class*="banner"]',
    '[class*="modal"]', '[class*="overlay"]', '[class*="popup"]',
    '[id*="cookie"]', '[id*="consent"]',
  ];
  return selectors
    .map(s => ({ selector: s, count: document.querySelectorAll(s).length }))
    .filter(r => r.count > 0);
});

if (overlays.length > 0) {
  console.warn('⚠ Detected potential overlays:', overlays);
  // Dismiss or hide them before screenshotting
  await page.evaluate(() => {
    document.querySelectorAll('[class*="cookie"], [class*="consent"], [class*="modal"]')
      .forEach(el => el.style.display = 'none');
  });
}
```

#### 7. Full pre-flight script (copy-paste ready)

```js
const { chromium } = require('playwright');

async function preflight(baseUrl) {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const issues = [];

  try {
    // Server reachable?
    const response = await page.goto(baseUrl, { waitUntil: 'networkidle', timeout: 10000 });
    if (!response || !response.ok()) {
      issues.push(`Server returned ${response?.status()}`);
      return { ok: false, issues };
    }

    // Stylesheets?
    const styles = await page.evaluate(
      () => document.querySelectorAll('link[rel="stylesheet"], style').length
    );
    if (styles === 0) issues.push('No stylesheets detected — page may be unstyled');

    // Content?
    const text = await page.evaluate(() => document.body?.innerText?.trim().length || 0);
    if (text < 10) issues.push('Page body is empty or near-empty');

    // Overlays?
    const hasOverlay = await page.evaluate(() =>
      document.querySelectorAll('[class*="cookie"], [class*="consent"], [class*="modal"]').length > 0
    );
    if (hasOverlay) issues.push('Cookie/consent/modal overlay detected — will hide before capture');

    return { ok: issues.length === 0, issues };
  } catch (e) {
    return { ok: false, issues: [e.message] };
  } finally {
    await page.close();
    await browser.close();
  }
}

// Usage
preflight('http://localhost:3000').then(result => {
  if (result.ok) {
    console.log('✓ All pre-flight checks passed — ready to screenshot');
  } else {
    console.warn('⚠ Issues found:');
    result.issues.forEach(i => console.warn(`  - ${i}`));
  }
});
```

**Run pre-flight before every screenshot session.** It takes <2 seconds and prevents wasted time on broken captures.

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

## Common Issues by Project Type

### Static Site Generators (11ty, Hugo, Jekyll)
- Output directory not served over HTTP — screenshots show unstyled HTML
- Build step forgotten before screenshotting — stale content captured
- Asset paths relative — break on `file://` but work on HTTP
- LiveReload scripts injecting extra elements into DOM

### Next.js / React SPAs
- Page not fully hydrated when screenshot taken — use `waitUntil: 'networkidle'`
- Client-side routing means only `/` loads without JS — navigate via Playwright, don't just change URL
- Loading spinners captured instead of actual content — wait for specific selectors
- Dark mode / theme flashing — set `prefers-color-scheme` via `page.emulateMedia()`

### Tailwind / Utility-First CSS
- Custom breakpoints in `tailwind.config.js` don't match standard set — always check `screens` config
- JIT mode may not generate styles for content not in the template — ensure dev server has processed all pages
- `@apply` directives may behave differently in production build vs dev

### WordPress / CMS Sites
- Admin bar adds height — screenshots include toolbar unless logged out
- Lazy-loaded images below fold — scroll to trigger loading before full-page capture
- Cookie consent banners overlay content — dismiss before screenshotting

---

## Output Format

### Screenshot File Naming
```
{breakpoint-name}-{width}x{height}.png
```

### Directory Structure
```
_screenshots/
  {route-name}/
    mobile-sm-320x568.png
    mobile-375x812.png
    ...
    wide-1920x1080.png
```

### Before/After Comparison
When generating comparison HTML, the output includes:
- Side-by-side before/after images per breakpoint
- Sticky filter controls
- Breakpoint labels with dimensions
- Responsive grid layout

Always save to `_screenshots/` in the project root — this is a non-negotiable convention.

---

## Tools Referenced

**Built-in / Free**
- Chrome MCP (`mcp__Claude_in_Chrome__*`) — browser control via MCP
- Playwright (`npm install playwright`) — headless browser automation
- `npx serve` — zero-config static file server
- Chrome DevTools (via Chrome MCP `javascript_tool`)

**Framework-Specific**
- 11ty: `npx @11ty/eleventy --serve`
- Next.js: `npm run dev`
- Vite: `npx vite`
- Create React App: `npm start`

---

## Task-Specific Questions

1. Is your dev server already running? If so, what port?
2. Do you need all breakpoints or just a specific viewport?
3. Are there pages behind authentication or specific state?
4. Do you need before/after comparison or just current state?
5. Does your project use custom breakpoints (Tailwind screens, CSS media queries)?

---

## Related Skills

- **optimize**: For diagnosing performance issues visible in screenshots (layout shift, slow loading)
- **accessibility-review**: For auditing visual accessibility concerns spotted in captures
- **design-critique**: For getting structured feedback on captured UI states
- **web-design-guidelines**: For checking captured pages against interface best practices
