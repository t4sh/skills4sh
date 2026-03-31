# AI-Friendly Page Snapshots — Full Reference

Screenshots are pixels — useful for humans but opaque to AI agents. Capture structured page representations alongside screenshots for page structure, content hierarchy, and interactive elements.

## Accessibility Tree Snapshot

The accessibility tree shows what a screen reader sees: headings, links, buttons, form fields, landmarks, and their relationships.

```js
async function captureWithAccessibilityTree(page, screenshotPath) {
  await page.screenshot({ path: screenshotPath, fullPage: true });

  const snapshot = await page.accessibility.snapshot();
  const treePath = screenshotPath.replace('.png', '.a11y.json');
  fs.writeFileSync(treePath, JSON.stringify(snapshot, null, 2));

  return snapshot;
}

// The tree structure:
// {
//   "role": "WebArea",
//   "name": "Dashboard",
//   "children": [
//     { "role": "navigation", "name": "Main", "children": [...] },
//     { "role": "heading", "name": "Welcome back", "level": 1 },
//     { "role": "button", "name": "Create new project" },
//     ...
//   ]
// }
```

## DOM Snapshot (Serialized HTML)

For programmatic comparison or when you need the actual markup:

```js
async function captureWithDomSnapshot(page, screenshotPath) {
  await page.screenshot({ path: screenshotPath, fullPage: true });

  const domSnapshot = await page.evaluate(() => {
    const clone = document.documentElement.cloneNode(true);
    clone.querySelectorAll('script, [onclick], [onload]').forEach(el => el.remove());
    return clone.outerHTML;
  });

  const htmlPath = screenshotPath.replace('.png', '.snapshot.html');
  fs.writeFileSync(htmlPath, domSnapshot);

  const metrics = await page.evaluate(() => {
    const elements = document.querySelectorAll('header, nav, main, aside, footer, [role]');
    return Array.from(elements).map(el => ({
      tag: el.tagName.toLowerCase(),
      role: el.getAttribute('role'),
      id: el.id || undefined,
      class: el.className || undefined,
      rect: el.getBoundingClientRect().toJSON(),
      visible: el.offsetParent !== null,
    }));
  });

  const metricsPath = screenshotPath.replace('.png', '.metrics.json');
  fs.writeFileSync(metricsPath, JSON.stringify(metrics, null, 2));
}
```

## Interactive Elements Map

```js
const interactive = await page.evaluate(() => {
  const els = document.querySelectorAll('a, button, input, select, textarea, [role="button"], [role="link"], [tabindex]');
  return Array.from(els).map(el => ({
    tag: el.tagName.toLowerCase(),
    type: el.type || undefined,
    role: el.getAttribute('role') || undefined,
    text: el.textContent?.trim().slice(0, 80) || undefined,
    href: el.href || undefined,
    name: el.name || el.getAttribute('aria-label') || undefined,
    visible: el.offsetParent !== null,
  }));
});
fs.writeFileSync(`${basePath}.interactive.json`, JSON.stringify(interactive, null, 2));
```

## Incremental DOM Snapshots

Inspired by dev-browser's `snapshotForAI()`. Captures a full DOM snapshot on first call, then returns only changed elements on subsequent calls — reducing context window usage for multi-step workflows.

```js
const crypto = require('crypto');

class IncrementalSnapshot {
  constructor() {
    this.previousHash = new Map(); // selector → content hash
  }

  async capture(page) {
    const elements = await page.evaluate(() => {
      const nodes = document.querySelectorAll('*');
      const result = [];
      for (const node of nodes) {
        if (node.children.length > 0 && !node.closest('script,style')) {
          const path = getSelector(node);
          if (path) {
            result.push({
              selector: path,
              tag: node.tagName.toLowerCase(),
              text: node.textContent?.trim().slice(0, 200) || '',
              attrs: Object.fromEntries(
                Array.from(node.attributes)
                  .filter(a => ['class','id','role','aria-label','href','src','data-testid'].includes(a.name))
                  .map(a => [a.name, a.value])
              ),
              childCount: node.children.length,
            });
          }
        }
      }
      return result;

      function getSelector(el) {
        if (el.id) return `#${el.id}`;
        if (el.dataset?.testid) return `[data-testid="${el.dataset.testid}"]`;
        const tag = el.tagName.toLowerCase();
        const parent = el.parentElement;
        if (!parent) return tag;
        const siblings = Array.from(parent.children).filter(c => c.tagName === el.tagName);
        if (siblings.length === 1) return `${getSelector(parent)} > ${tag}`;
        const idx = siblings.indexOf(el) + 1;
        return `${getSelector(parent)} > ${tag}:nth-of-type(${idx})`;
      }
    });

    // First capture: return everything
    if (this.previousHash.size === 0) {
      for (const el of elements) {
        this.previousHash.set(el.selector, this._hash(el));
      }
      return { type: 'full', elements, changedCount: elements.length };
    }

    // Subsequent captures: return only changes
    const changed = [];
    const removed = new Set(this.previousHash.keys());
    const newHash = new Map();

    for (const el of elements) {
      const hash = this._hash(el);
      newHash.set(el.selector, hash);
      removed.delete(el.selector);

      if (this.previousHash.get(el.selector) !== hash) {
        changed.push(el);
      }
    }

    this.previousHash = newHash;

    return {
      type: 'incremental',
      changed,
      removed: Array.from(removed),
      changedCount: changed.length,
      removedCount: removed.size,
      totalElements: elements.length,
    };
  }

  _hash(el) {
    const str = JSON.stringify({ text: el.text, attrs: el.attrs, childCount: el.childCount });
    return crypto.createHash('md5').update(str).digest('hex').slice(0, 8);
  }
}

// Usage: multi-step workflow with incremental snapshots
const snap = new IncrementalSnapshot();

// First capture — full snapshot
const s1 = await snap.capture(page);
// s1 = { type: 'full', elements: [...all...], changedCount: 142 }

await page.click('#add-item');
await page.waitForSelector('.item-added');

// Second capture — only changes
const s2 = await snap.capture(page);
// s2 = { type: 'incremental', changed: [...3 elements...], removed: [], changedCount: 3 }
```

## Combined Full Capture Script

```js
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function fullCapture(baseUrl, route, breakpoints) {
  const browser = await chromium.launch();
  const routeName = route === '/' ? 'home' : route.slice(1).replace(/\//g, '-');
  const outDir = path.join('_screenshots', routeName);
  fs.mkdirSync(outDir, { recursive: true });

  for (const bp of breakpoints) {
    const page = await browser.newPage();
    await page.setViewportSize({ width: bp.width, height: bp.height });
    await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle' });

    const basePath = path.join(outDir, `${bp.name}-${bp.width}x${bp.height}`);

    // Visual screenshot
    await page.screenshot({ path: `${basePath}.png`, fullPage: true });

    // Accessibility tree
    const a11y = await page.accessibility.snapshot();
    fs.writeFileSync(`${basePath}.a11y.json`, JSON.stringify(a11y, null, 2));

    // Interactive elements map
    const interactive = await page.evaluate(() => {
      const els = document.querySelectorAll('a, button, input, select, textarea, [role="button"], [role="link"], [tabindex]');
      return Array.from(els).map(el => ({
        tag: el.tagName.toLowerCase(),
        type: el.type || undefined,
        role: el.getAttribute('role') || undefined,
        text: el.textContent?.trim().slice(0, 80) || undefined,
        href: el.href || undefined,
        name: el.name || el.getAttribute('aria-label') || undefined,
        visible: el.offsetParent !== null,
      }));
    });
    fs.writeFileSync(`${basePath}.interactive.json`, JSON.stringify(interactive, null, 2));

    await page.close();
  }

  await browser.close();
  console.log(`Full capture saved to ${outDir}/`);
}
```

## Output Structure

```
_screenshots/
  dashboard/
    mobile-375x812.png              # visual screenshot
    mobile-375x812.a11y.json        # accessibility tree
    mobile-375x812.interactive.json # interactive elements map
    desktop-1280x800.png
    desktop-1280x800.a11y.json
    desktop-1280x800.interactive.json
```
