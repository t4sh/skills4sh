---
name: localhost-screenshots
description: "Use when taking screenshots of localhost sites, visual regression testing, responsive breakpoint captures, before/after comparisons, browser interaction workflows, pixel-diff regression, or any programmatic screenshot of locally running web pages. Supports Chrome MCP (quick), Playwright (systematic multi-breakpoint), and CDP connect (attach to running Chrome)."
license: MIT
compatibility: macOS, Linux, or Windows with Chrome or Playwright
metadata:
  author: t4sh
  version: "3.0.0"
  tags: screenshots, localhost, visual-regression, responsive, breakpoints, playwright, chrome, browser-automation, pixel-diff, accessibility, cdp, incremental-snapshots
---

# Localhost Screenshots

You are an expert in capturing, comparing, and documenting visual states of locally running web applications. Your goal is to produce accurate, comprehensive screenshot sets for debugging, visual regression testing, and responsive design documentation.

## Installation

```bash
npx skills add t4sh/skills4sh --skill localhost-screenshots
```

---

## What I Can Help With

- **Quick visual checks** — single screenshots for debugging layout or styling issues
- **Responsive breakpoint captures** — systematic screenshots across 8 standard viewports
- **Before/after comparisons** — visual regression testing with side-by-side HTML output and pixel-diff scoring
- **Interactive debugging** — executing JS in live browser context to inspect state
- **Visual documentation** — capturing full-page screenshots for design reviews or handoffs
- **Multi-step browser workflows** — login, navigate, interact, then capture (persistent sessions)
- **AI-friendly page analysis** — accessibility tree snapshots, DOM serialization, and incremental DOM diffs
- **Automated regression CI** — GitHub Actions workflow for baseline comparison on every PR

## Initial Assessment

Before taking screenshots, understand:

1. **Environment** — Is the dev server running? What port? What framework? Sandbox/VM or local?
2. **What You Need** — Quick debug screenshot or full breakpoint set? Before/after comparison?
3. **Scope** — Single page or multiple routes? Full page or specific element? Custom breakpoints?

---

## Tool Decision Matrix — Read This First

| Need | Tool | Why |
|------|------|-----|
| Quick visual check / debug | **Chrome MCP** | Connected to user's real browser, sees localhost |
| Verify a JS fix | **Chrome MCP** | Execute JS in live page context |
| One or two screenshots | **Chrome MCP** | Instant, no setup |
| Interactive debugging | **Chrome MCP** | Click, fill, inspect state in real browser |
| Systematic multi-breakpoint set | **Playwright** | Automated viewport resizing across 8 breakpoints |
| Before/after comparison | **Playwright** | Structured comparison HTML output with pixel-diff |
| Visual regression testing | **Playwright** | Repeatable, scriptable, consistent |
| Multi-step workflow (login → navigate → capture) | **Playwright (persistent)** | Session state survives across steps |
| AI-friendly page understanding | **Playwright** | Accessibility tree + DOM snapshot alongside screenshots |
| Attach to running Chrome (no extension) | **CDP connect** | Playwright API on user's actual browser session |
| Multi-step with page reuse across scripts | **Named page pattern** | Avoid re-navigating between agent turns |
| Headless CI captures | **Playwright `--headless`** | No display needed, faster execution |

---

## Chrome MCP — Quick Screenshots & Debugging

**Use when you need 1-2 screenshots or are debugging interactively.** Connects to the user's actual Chrome browser. No setup needed.

### Quick Screenshot Flow

```
# 1. Get/create a tab
mcp__Claude_in_Chrome__tabs_context_mcp({ createIfEmpty: true })

# 2. Navigate
mcp__Claude_in_Chrome__navigate({ url: "http://localhost:3000/dashboard/" })

# 3. Screenshot
mcp__Claude_in_Chrome__computer({ action: "screenshot" })

# 4. (Optional) Resize and screenshot again
mcp__Claude_in_Chrome__resize_window({ width: 375, height: 812 })
mcp__Claude_in_Chrome__computer({ action: "screenshot" })
```

### Debugging Patterns

```
# Check if a JS module loaded
mcp__Claude_in_Chrome__javascript_tool({
  action: "javascript_exec",
  text: "JSON.stringify(Object.keys(window.MyApp || {}))"
})

# Inspect computed styles
mcp__Claude_in_Chrome__javascript_tool({
  action: "javascript_exec",
  text: "JSON.stringify(getComputedStyle(document.querySelector('.target')).background)"
})

# Get page info
mcp__Claude_in_Chrome__javascript_tool({
  action: "javascript_exec",
  text: "JSON.stringify({ title: document.title, url: location.href })"
})
```

**When NOT to use Chrome MCP:** systematic multi-breakpoint sets, visual regression, before/after comparison HTML — use Playwright instead.

---

## Playwright — Systematic Multi-Breakpoint Screenshots

Use for automated, repeatable screenshot sets. **Always use Playwright's bundled Chromium — never Puppeteer, Selenium, or system Chrome. Always serve over HTTP — never `file://` paths.**

### Setup

```bash
node -e "require('playwright')" 2>/dev/null || npm install playwright 2>/dev/null
npx playwright install --with-deps chromium
```

### Standard Breakpoints

```js
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
```

### Canonical Screenshot Script

```js
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:8080';
const ROUTES = ['/'];

(async () => {
  const browser = await chromium.launch();
  for (const route of ROUTES) {
    const routeName = route === '/' ? 'home' : route.slice(1).replace(/\//g, '-');
    const routeDir = path.join('_screenshots', routeName);
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
})();
```

### Headless Mode (default) and Headed Mode

Playwright runs headless by default — no visible browser window, faster execution, ideal for CI.

```js
// Headless (default) — use for CI, automated captures
const browser = await chromium.launch();

// Headed — use for interactive debugging where you want to see the browser
const browser = await chromium.launch({ headless: false });
```

**Always use headless for CI pipelines and automated regression.** Only use headed mode when debugging interactively.

---

## CDP Connect — Attach to Running Chrome

Connect to a running Chrome instance via Chrome DevTools Protocol. Works without the Chrome MCP extension.

### Starting Chrome with Remote Debugging

```bash
# macOS
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-debug

# Linux
google-chrome --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-debug

# Windows (PowerShell)
& "C:\Program Files\Google\Chrome\Application\chrome.exe" `
  --remote-debugging-port=9222 --user-data-dir="$env:TEMP\chrome-debug"
```

### Connecting Playwright to Running Chrome

```js
const { chromium } = require('playwright');

async function connectToChrome() {
  const ports = [9222, 9223, 9224, 9225, 9226, 9227, 9228, 9229];
  for (const port of ports) {
    try {
      const browser = await chromium.connectOverCDP(`http://localhost:${port}`);
      console.log(`Connected to Chrome on port ${port}`);
      return browser;
    } catch { continue; }
  }
  throw new Error('No Chrome instance found with remote debugging enabled');
}

// Screenshot the currently active tab
const browser = await connectToChrome();
const pages = browser.contexts()[0]?.pages() || [];
if (pages.length > 0) {
  await pages[0].screenshot({ path: '_screenshots/current-tab.png', fullPage: true });
}
// Don't close — it's the user's browser
```

### When to Use CDP vs Chrome MCP

| Scenario | CDP | Chrome MCP |
|----------|-----|------------|
| Chrome extension not installed | **CDP** | Not available |
| Need Playwright API (viewport resize, waitForSelector) | **CDP** | Limited |
| Automated script | **CDP** | Not scriptable |
| Quick one-off screenshot | Either | **Chrome MCP** (simpler) |

---

## Named Page Persistence

For multi-step workflows where you need to reuse the same page state across multiple agent script executions — login once, then capture across breakpoints without re-authenticating.

```js
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const PROFILE_DIR = path.join(process.env.HOME || process.env.USERPROFILE, '.cache', 'localhost-screenshots', 'browser-profile');

// Launch with persistent context — cookies/localStorage survive across runs
const context = await chromium.launchPersistentContext(PROFILE_DIR, { headless: true });

// Get or create a named page by storing URL-to-name mapping
const PAGES_FILE = path.join(PROFILE_DIR, 'named-pages.json');

function getNamedPages() {
  if (fs.existsSync(PAGES_FILE)) return JSON.parse(fs.readFileSync(PAGES_FILE, 'utf-8'));
  return {};
}

function saveNamedPages(map) {
  fs.writeFileSync(PAGES_FILE, JSON.stringify(map, null, 2));
}

// Reuse existing page or create new one
async function getPage(context, name, url) {
  const pages = context.pages();
  const existing = pages.find(p => p.url().includes(url));
  if (existing) return existing;

  const page = await context.newPage();
  await page.goto(url, { waitUntil: 'networkidle' });
  const map = getNamedPages();
  map[name] = url;
  saveNamedPages(map);
  return page;
}

// Usage: login once, reuse across breakpoint captures
const dashboard = await getPage(context, 'dashboard', 'http://localhost:3000/dashboard');
```

---

## Stdin-Friendly Script Templates

Concise, heredoc-friendly scripts optimized for AI agent piping — minimal boilerplate, maximum efficiency.

### One-Shot Screenshot

```bash
node -e "
const pw = require('playwright');
(async () => {
  const b = await pw.chromium.launch();
  const p = await b.newPage();
  await p.setViewportSize({width:1280,height:800});
  await p.goto('http://localhost:3000', {waitUntil:'networkidle'});
  await p.screenshot({path:'_screenshots/quick.png',fullPage:true});
  await b.close();
})();
"
```

### Multi-Breakpoint One-Liner

```bash
node -e "
const pw=require('playwright'),fs=require('fs');
const bps=[{n:'mobile',w:375,h:812},{n:'tablet',w:768,h:1024},{n:'desktop',w:1280,h:800}];
(async()=>{
  const b=await pw.chromium.launch();
  fs.mkdirSync('_screenshots/home',{recursive:true});
  for(const bp of bps){
    const p=await b.newPage();
    await p.setViewportSize({width:bp.w,height:bp.h});
    await p.goto('http://localhost:3000',{waitUntil:'networkidle'});
    await p.screenshot({path:\`_screenshots/home/\${bp.n}-\${bp.w}x\${bp.h}.png\`,fullPage:true});
    await p.close();
  }
  await b.close();
})();
"
```

### Screenshot + Accessibility Snapshot

```bash
node -e "
const pw=require('playwright'),fs=require('fs');
(async()=>{
  const b=await pw.chromium.launch();
  const p=await b.newPage();
  await p.goto('http://localhost:3000',{waitUntil:'networkidle'});
  await p.screenshot({path:'_screenshots/page.png',fullPage:true});
  const tree=await p.accessibility.snapshot();
  fs.writeFileSync('_screenshots/page.a11y.json',JSON.stringify(tree,null,2));
  await b.close();
})();
"
```

---

## Incremental DOM Snapshots

For multi-step workflows, capture a full DOM snapshot on first call, then only changed elements on subsequent calls. Reduces context window usage.

```js
const crypto = require('crypto');

class IncrementalSnapshot {
  constructor() { this.prevHash = new Map(); }

  async capture(page) {
    const elements = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('*'))
        .filter(n => n.children.length > 0 && !n.closest('script,style'))
        .slice(0, 500)
        .map(el => ({
          selector: el.id ? `#${el.id}` : el.tagName.toLowerCase(),
          text: el.textContent?.trim().slice(0, 200) || '',
          childCount: el.children.length,
        }));
    });

    if (this.prevHash.size === 0) {
      for (const el of elements) this.prevHash.set(el.selector, this._hash(el));
      return { type: 'full', elements, changedCount: elements.length };
    }

    const changed = [];
    const newHash = new Map();
    for (const el of elements) {
      const h = this._hash(el);
      newHash.set(el.selector, h);
      if (this.prevHash.get(el.selector) !== h) changed.push(el);
    }
    this.prevHash = newHash;
    return { type: 'incremental', changed, changedCount: changed.length };
  }

  _hash(el) {
    return crypto.createHash('md5').update(JSON.stringify(el)).digest('hex').slice(0, 8);
  }
}
```

See [references/ai-snapshots.md](references/ai-snapshots.md) for the full implementation with selector generation.

---

## Security & Sandboxing

### Restrict File System Access

```js
const path = require('path');

function safePath(filePath) {
  const resolved = path.resolve(filePath);
  const allowed = path.resolve('_screenshots');
  if (!resolved.startsWith(allowed)) {
    throw new Error(`Path ${filePath} is outside allowed directory ${allowed}`);
  }
  return resolved;
}
```

### Disable Unnecessary Browser Features

```js
const browser = await chromium.launch({
  args: [
    '--disable-extensions',
    '--disable-background-networking',
    '--disable-sync',
    '--disable-translate',
    '--no-first-run',
    '--disable-default-apps',
  ],
});
```

### Network Isolation (CI)

```js
// Only allow localhost — block all external requests
const context = await browser.newContext();
await context.route('**/*', (route) => {
  const url = new URL(route.request().url());
  if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
    return route.continue();
  }
  return route.abort('blockedbyclient');
});
```

### Docker Sandboxing (shared environments)

For untrusted or shared environments, run Playwright inside a container:

```bash
docker run --rm -v $(pwd):/work -w /work mcr.microsoft.com/playwright:v1.52.0-noble \
  node capture-screenshots.js
```

This isolates the browser process from the host filesystem and network.

---

## Performance Expectations

| Task | Expected Time | Notes |
|------|--------------|-------|
| Chrome MCP single screenshot | ~1-2s | Already connected, no setup |
| Playwright single screenshot | ~3-5s | Includes browser launch |
| Full 8-breakpoint capture (1 route) | ~15-25s | New page per breakpoint |
| Full 8-breakpoint capture (5 routes) | ~60-90s | Sequential per route |
| Before/after with pixel-diff | ~40-60s | Two captures + diff computation |
| Pre-flight checks | ~1-2s | Quick validation, always run |
| Persistent context reuse | ~2-3s per capture | No browser relaunch |

**Tips for faster captures:**
- Use persistent contexts to avoid browser cold-start per session
- Run pre-flight once, not per breakpoint
- For CI, use `--headless` (default) — no GPU rendering overhead
- Named page patterns avoid re-navigation between agent turns

---

## Output Convention

**Always save to `_screenshots/` in the project root.** Non-negotiable.

```
_screenshots/
  {route-name}/
    mobile-sm-320x568.png
    mobile-375x812.png
    ...
    wide-1920x1080.png
  comparison.html           # before/after visual comparison
  diff/
    report.json             # pixel-diff analysis results
    diff-mobile-375x812.png
```

---

## What NOT to Do

- Do not use Puppeteer, JSDOM, Selenium, or WebDriver
- Do not look for system Chrome/Chromium or check `CHROME_PATH`
- Do not open HTML files via `file://` — always serve over HTTP
- Do not screenshot at only one viewport (capture all breakpoints unless told otherwise)
- Do not assume `localhost` is reachable from sandboxed VMs — verify first
- Do not waste time on Puppeteer workarounds when Chrome MCP is available

---

## Reference Files

For detailed patterns, templates, and full code, read these files from the `references/` directory:

| File | Contents |
|------|----------|
| [references/playwright-patterns.md](references/playwright-patterns.md) | Full Playwright setup, pre-flight checks, serving patterns, persistent sessions, breakpoint detection, stdin-friendly script templates |
| [references/visual-regression.md](references/visual-regression.md) | Pixel-diff scoring, comparison HTML generation, GitHub Actions CI/CD workflow |
| [references/interaction-templates.md](references/interaction-templates.md) | Auth flows, e-commerce flows, state variations, interactive mode, core interaction primitives |
| [references/ai-snapshots.md](references/ai-snapshots.md) | Accessibility tree, DOM snapshots, interactive element maps, incremental DOM diff with `IncrementalSnapshot` class |
| [references/troubleshooting.md](references/troubleshooting.md) | Common issues by project type (SSG, Next.js, Tailwind, WordPress), full "what not to do" list |

---

## Task-Specific Questions

1. Is your dev server already running? If so, what port?
2. Do you need all breakpoints or just a specific viewport?
3. Are there pages behind authentication or specific state?
4. Do you need before/after comparison or just current state?
5. Does your project use custom breakpoints (Tailwind screens, CSS media queries)?

---

## Related Skills

- **optimize** — performance issues visible in screenshots (layout shift, slow loading)
- **accessibility-review** — visual accessibility concerns
- **design-critique** — structured feedback on captured UI states
- **web-design-guidelines** — checking pages against interface best practices

---

## Tools Referenced

| Tool | Type | Purpose |
|------|------|---------|
| Chrome MCP | Built-in | Browser control via MCP extension |
| Playwright | `npm install playwright` | Headless browser automation |
| CDP | Built-in (Chrome) | Direct Chrome connection via `--remote-debugging-port` |
| pixelmatch | `npm install pixelmatch pngjs` | Pixel-level image comparison |
| `npx serve` | npm | Zero-config static file server |
