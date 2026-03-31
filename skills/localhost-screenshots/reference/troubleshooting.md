# Troubleshooting — Full Reference

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

## What NOT to Do

- **Do not use Puppeteer** — separate headless browser that can't reach localhost from sandbox
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
- **Do not waste time on Puppeteer workarounds** when Chrome MCP is already connected
