---
name: localhost-screenshots
description: "This skill should be used when the user asks to \"screenshot my site\", \"capture pages\", \"visual diff\", \"compare screenshots\", \"responsive screenshots\", \"check breakpoints\", \"visual regression\", or any request involving programmatic screenshots of a local dev server or localhost site across viewport breakpoints. Defines the exact Chrome/Playwright toolchain to avoid trial-and-error across browsers."
license: MIT
compatibility: macOS, Linux, or Windows with Chrome or Playwright
metadata:
  author: t4sh
  version: "3.2.0"
  tags: screenshots, localhost, visual-regression, responsive, breakpoints, playwright, chrome, browser-automation, pixel-diff, accessibility, cdp
---

# Localhost Screenshots

## Installation

```bash
npx skills add t4sh/skills4sh --skill localhost-screenshots
```

---

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

**Use a Chrome-connected MCP** for one or two screenshots or interactive debugging. It drives the user’s real browser, which can already reach their localhost dev server. No Playwright install required.

### MCP tool names (map to the host's server)

Identifiers differ by host. Map **capabilities** to the host server's actual tools:

| Step | Capability | Claude Chrome MCP (example) | Cursor `cursor-ide-browser` |
|------|------------|----------------------------|-----------------------------|
| Tab | Create or select tab | `…tabs_context_mcp({ createIfEmpty: true })` | `browser_tabs` (per server docs) |
| Navigate | Open URL | `…navigate({ url })` | `browser_navigate` |
| Screenshot | Capture viewport | `…computer({ action: "screenshot" })` | `browser_take_screenshot` |
| Resize | Viewport / window | `…resize_window({ width, height })` | Resize tools if available, or devtools |
| Run JS | Evaluate in page | `…javascript_tool({ action: "javascript_exec", text })` | Follow the server's evaluate / snapshot workflow |

Follow the MCP server's lock/snapshot rules (e.g. Cursor: snapshot before structural changes).

### Prerequisites

The user's dev server must be running (e.g., `npx @11ty/eleventy --serve --port=3000`).

### Quick screenshot flow (pattern)

1. Ensure a browser tab (create if empty).
2. Navigate to `http://localhost:<port>/<path>`.
3. Take a viewport screenshot.
4. Optionally resize, then screenshot again.

### Example: Claude Chrome MCP

```
mcp__Claude_in_Chrome__tabs_context_mcp({ createIfEmpty: true })
mcp__Claude_in_Chrome__navigate({ url: "http://localhost:3000/dashboard/" })
mcp__Claude_in_Chrome__computer({ action: "screenshot" })
mcp__Claude_in_Chrome__resize_window({ width: 375, height: 812 })
mcp__Claude_in_Chrome__computer({ action: "screenshot" })
```

### Example: Cursor IDE browser

Navigate with `browser_navigate`, then `browser_take_screenshot`. Use `browser_snapshot` before interactions; follow **cursor-ide-browser** server instructions for lock/unlock if required.

### Debugging patterns (run JS in page)

Payload examples (wrap in the MCP's JS action):

```js
JSON.stringify(Object.keys(window.MyApp || {}))
```

```js
JSON.stringify(getComputedStyle(document.querySelector('.target')).background)
```

```js
JSON.stringify(document.querySelector('.target').getBoundingClientRect())
```

```js
JSON.stringify({ title: document.title, url: location.href, stylesheets: document.querySelectorAll('link[rel=stylesheet]').length })
```

**Claude Chrome MCP** shape:

```
mcp__Claude_in_Chrome__javascript_tool({
  action: "javascript_exec",
  text: "<escaped one-line string>"
})
```

### When NOT to Use Chrome MCP for Screenshots

- When all 8 breakpoints need capture systematically — use Playwright
- When repeatable, scriptable visual regression is required — use Playwright
- When generating a before/after comparison HTML — use Playwright

---

## Playwright — Systematic Multi-Breakpoint Screenshots

Use Playwright for automated, repeatable screenshot sets across all breakpoints. This is the right tool for visual regression testing and comprehensive responsive documentation.

### Golden Rules

1. **Always use Playwright’s bundled Chromium.** Never use Puppeteer, Selenium, or system Chrome. Do not check for installed browsers.
2. **Prefer HTTP; `file://` only for self-contained static HTML.** Serve over HTTP whenever a dev server, build output, or `npx serve` is available. `file://` is acceptable *only* when the page has no `fetch`/XHR to sibling files, no `<script type="module">`, no service workers, and no absolute `/asset` paths — otherwise those will break silently. When in doubt, serve over HTTP.

### Setup (run once per session)

```bash
node -e “require(‘playwright’)” 2>/dev/null || npm install playwright 2>/dev/null
npx playwright install --with-deps chromium
```

Do not use `@latest` — let the project’s lockfile control the version.

### Quick workflow

1. Ensure the site is served over HTTP (user’s dev server, or `npx serve _site -l 3000 &`).
2. Verify the server responds before screenshotting (see [playwright-patterns.md](references/playwright-patterns.md) § “Verifying the Server”).
3. Capture all 8 standard breakpoints (320–1920px) unless the user asks for specific sizes. Check the project’s CSS/Tailwind config for custom breakpoints first.
4. Save to `_screenshots/` in the project folder.

For the **canonical screenshot script**, **standard breakpoints array**, **serving patterns**, **server verification**, **waiting for dynamic content**, **element screenshots**, **persistent sessions**, and **when the dev server isn’t running** — see [references/playwright-patterns.md](references/playwright-patterns.md).

### Output structure

```
_screenshots/
  home/
    mobile-sm-320x568.png
    mobile-375x812.png
    ...
    wide-1920x1080.png
  about/
    ...
```

### Before/after visual comparison

Run the canonical script twice (`_screenshots/before`, `_screenshots/after`), then generate a comparison HTML. For the comparison script and pixel-diff scoring, see [references/visual-regression.md](references/visual-regression.md).

### Key API notes

- `chromium.launch()` — no arguments, uses Playwright’s bundled Chromium
- `waitUntil: ‘networkidle’` — good for static sites. SPAs with analytics/websockets may never go idle — use `load` + `waitForSelector` instead
- `fullPage: true` — captures entire scrollable page
- Create a **new page per breakpoint** — avoids leftover state
- `page.setViewportSize()` — set before navigating for accurate responsive rendering

---

## What NOT to Do

See [references/troubleshooting.md](references/troubleshooting.md) § "What NOT to Do" for the full list. Key items: no Puppeteer, no JSDOM, no system Chrome binaries, no `file://` paths, always capture all breakpoints.

---

## Related Skills

**Built-in (Claude Code):**
- **dev-browser** — browser automation with persistent page state. Useful for interactive captures and manual navigation before screenshotting

**On skills.sh:**
- **[screenshot-local](https://skills.sh/antjanus/skillbox/screenshot-local)** — shot-scraper (Playwright-based) for localhost captures with custom viewports, element targeting, and batch YAML configs. Lighter-weight alternative when a full regression pipeline isn't needed
- **[visual-regression-tester](https://skills.sh/patricio0312rev/skills/visual-regression-tester)** — automated visual regression via Playwright, Chromatic, or Percy with multi-viewport and CI/CD. Complements the pixel-diff reference in this skill
- **[playwright-responsive-screenshots](https://skills.sh/dawiddutoit/custom-claude/playwright-responsive-screenshots)** — MCP-only responsive captures at 3 breakpoints (mobile/tablet/desktop). Lighter scope; `localhost-screenshots` is a superset: two tracks (Chrome MCP for debug + Playwright for regression), 8 breakpoints with Tailwind/media-query detection, guided Playwright setup, in-page JS debugging, pre-flight checks, persistent sessions, visual-regression pipeline with pixel-diff, and framework-specific troubleshooting

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
