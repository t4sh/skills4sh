# Playwright Patterns — Full Reference

## Golden Rules

1. **Always use Playwright's bundled Chromium.** Never use Puppeteer, Selenium, or system Chrome. Do not check for installed browsers.
2. **NEVER open HTML files via `file://` paths.** Always serve them over HTTP. Relative CSS/JS paths won't resolve without an HTTP server.

## Setup (run once per session)

```bash
# Only install if not present
node -e "require('playwright')" 2>/dev/null || npm install playwright 2>/dev/null
npx playwright install --with-deps chromium
```

Do not use `@latest` — let the project's `package.json` or lockfile control the version.

If `npx playwright install --with-deps chromium` fails:
```bash
npx playwright install chromium
sudo npx playwright install-deps chromium
```

## Serving the Site

**If dev server is already running:**
```js
const BASE_URL = 'http://localhost:8080'; // use their port
```

**If built output exists (e.g., 11ty's `_site/`):**
```bash
npx serve _site -l 3000 &
```

**If need to build and serve:**
```bash
npx @11ty/eleventy          # build
npx serve _site -l 3000 &   # serve output
```

**In sandboxed environments** (Cowork, etc): The VM cannot access host `localhost`. Build inside the VM or serve mounted files. Always test connectivity first.

## Verifying the Server

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

## Standard Breakpoints

```js
const BREAKPOINTS = [
  { name: 'mobile-sm',  width: 320,  height: 568  },  // iPhone SE / small phones
  { name: 'mobile',     width: 375,  height: 812  },  // iPhone X / standard phones
  { name: 'mobile-lg',  width: 428,  height: 926  },  // iPhone Pro Max / large phones
  { name: 'tablet',     width: 768,  height: 1024 },  // iPad / portrait tablet
  { name: 'tablet-lg',  width: 1024, height: 1366 },  // iPad Pro / landscape tablet
  { name: 'desktop',    width: 1280, height: 800  },   // Standard laptop
  { name: 'desktop-lg', width: 1440, height: 900  },   // Large laptop
  { name: 'wide',       width: 1920, height: 1080 },   // Full HD monitor
];
```

Check for project-specific breakpoints before using defaults:
```bash
# Tailwind
grep -r "screens" tailwind.config.* 2>/dev/null

# CSS media queries
grep -roh '@media.*max-width:\s*[0-9]*px' src/ --include="*.css" 2>/dev/null | sort -u
grep -roh '@media.*min-width:\s*[0-9]*px' src/ --include="*.css" 2>/dev/null | sort -u
```

## Canonical Screenshot Script

```js
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:8080';
const ROUTES = ['/'];

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
- `waitUntil: 'networkidle'` — waits until no network requests for 500ms
- `fullPage: true` — captures the entire scrollable page, not just the viewport
- `page.setViewportSize()` — set before navigating for accurate responsive rendering
- Create a **new page per breakpoint** — ensures clean rendering without leftover state

## Persistent Browser Sessions

For multi-step workflows (login → navigate → interact → capture):

```js
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SESSION_DIR = path.join(process.env.HOME || process.env.USERPROFILE, '.cache', 'localhost-screenshots');
const STATE_FILE = path.join(SESSION_DIR, 'session-state.json');

async function getOrCreateSession(baseUrl) {
  fs.mkdirSync(SESSION_DIR, { recursive: true });
  const context = await chromium.launchPersistentContext(
    path.join(SESSION_DIR, 'browser-profile'),
    { headless: true }
  );
  if (fs.existsSync(STATE_FILE)) {
    const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
    await context.addCookies(state.cookies || []);
  }
  return context;
}

async function saveSession(context) {
  const cookies = await context.cookies();
  const state = { cookies, savedAt: new Date().toISOString() };
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}
```

| Scenario | Persistent? | Why |
|----------|-------------|-----|
| Public pages, no auth | No | Stateless is simpler |
| Pages behind login | **Yes** | Avoids re-authenticating per breakpoint |
| Multi-page workflow capture | **Yes** | Preserves navigation state |
| A/B test with specific cookies | **Yes** | Cookie state must survive across captures |
| Iterative debug-capture loop | **Yes** | Faster turnaround, no browser restart |

## Waiting for Content

```js
// Wait for a specific element
await page.waitForSelector('.hero-image', { timeout: 10000 });

// Wait for all images to load
await page.evaluate(() => {
  return Promise.all(
    Array.from(document.images)
      .filter(img => !img.complete)
      .map(img => new Promise(resolve => { img.onload = img.onerror = resolve; }))
  );
});

// Last resort: fixed delay after networkidle
await page.waitForTimeout(500);
```

## Screenshot a Specific Element

```js
const element = await page.locator('.main-content');
await element.screenshot({ path: 'content-only.png' });
```

## Self-Signed HTTPS

```js
const context = await browser.newContext({ ignoreHTTPSErrors: true });
const page = await context.newPage();
```

## When the Dev Server Isn't Running

**Option A: Serve a pre-built output directory**
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
  } catch { await new Promise(r => setTimeout(r, 1000)); }
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

## Pre-Flight Checks

Run before every screenshot session (~2 seconds, prevents wasted time on broken captures).

```js
const { chromium } = require('playwright');

async function preflight(baseUrl) {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const issues = [];

  try {
    const response = await page.goto(baseUrl, { waitUntil: 'networkidle', timeout: 10000 });
    if (!response || !response.ok()) {
      issues.push(`Server returned ${response?.status()}`);
      return { ok: false, issues };
    }

    const styles = await page.evaluate(
      () => document.querySelectorAll('link[rel="stylesheet"], style').length
    );
    if (styles === 0) issues.push('No stylesheets detected — page may be unstyled');

    const text = await page.evaluate(() => document.body?.innerText?.trim().length || 0);
    if (text < 10) issues.push('Page body is empty or near-empty');

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
```

### Individual Check Details

**Stylesheet check** — zero stylesheets means you're likely opening via `file://` instead of HTTP, or the build step hasn't run.

**Content check** — for SPAs, wait for the app root:
```js
const appRoot = await page.evaluate(() => {
  const root = document.querySelector('#__next, #root, #app, main');
  return root ? root.children.length : -1;
});
if (appRoot === 0) {
  await page.waitForSelector('main > *', { timeout: 10000 });
}
```

**Overlay detection and dismissal:**
```js
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
  await page.evaluate(() => {
    document.querySelectorAll('[class*="cookie"], [class*="consent"], [class*="modal"]')
      .forEach(el => el.style.display = 'none');
  });
}
```

### Common Pre-Flight Failures

- `ERR_CONNECTION_REFUSED` — dev server not running or wrong port
- `TIMEOUT` — server is starting up, retry after 2-3 seconds
- Sandboxed VM — host `localhost` is unreachable; must build and serve inside the VM
