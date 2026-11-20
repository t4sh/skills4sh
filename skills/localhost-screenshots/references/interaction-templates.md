# Interaction Templates — Full Reference

Use this common setup with each template. Open the first URL with `gotoLocal` so the navigation guard remains active through clicks, form submissions, and reloads. Pass the requested viewport when taking a sized capture.

```js
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const { gotoLocal, captureVerifiedPng } = require('<skill-dir>/assets/scripts/local-guard.js');

async function saveScreenshot(page, file, viewport = page.viewportSize()) {
  const { png } = await captureVerifiedPng(page, viewport, { fullPage: true });
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, png);
}
```

## Core Interaction Primitives

```js
// Click an element
await page.click('button.submit');
await page.click('text=Sign In');           // by visible text
await page.click('[data-testid="menu"]');   // by test ID

// Fill form fields
await page.fill('#email', 'user@example.com');
await page.fill('input[name="search"]', 'dashboard widgets');

// Select from dropdown
await page.selectOption('select#role', 'admin');

// Check/uncheck
await page.check('#remember-me');
await page.uncheck('#newsletter');

// Hover (for tooltips, dropdowns)
await page.hover('.user-avatar');
await saveScreenshot(page, '_screenshots/tooltip-visible.png');

// Scroll to element before capture
await page.locator('.footer-section').scrollIntoViewIfNeeded();

// Keyboard input
await page.press('#search', 'Enter');
await page.keyboard.type('Hello world');

// Wait for navigation after click
await page.click('a.dashboard-link');
await page.waitForURL('**/dashboard');
```

## Template 1: Auth → Dashboard → Screenshot

```js
(async () => {
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext();
    const page = await context.newPage();

    // Step 1: Login — credentials come from the environment, never hardcoded.
    // Set DEMO_USER / DEMO_PASS before running, or wire to a secrets manager.
    await gotoLocal(page, 'http://localhost:3000/login');
    await page.fill('#email',    process.env.DEMO_USER || 'demo@example.com');
    await page.fill('#password', process.env.DEMO_PASS || '');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');

    // Step 2: Navigate to target page
    await page.click('nav a[href="/settings"]');
    await page.waitForSelector('.settings-panel');

    // Step 3: Capture across breakpoints
    const BREAKPOINTS = [
      { name: 'mobile', width: 375, height: 812 },
      { name: 'desktop', width: 1280, height: 800 },
    ];

    // Exception to the canonical "new page per breakpoint" rule: this flow keeps one
    // authenticated page so login/session state survives across breakpoint captures.
    for (const bp of BREAKPOINTS) {
      await page.setViewportSize({ width: bp.width, height: bp.height });
      await saveScreenshot(page, `_screenshots/settings/${bp.name}-${bp.width}x${bp.height}.png`, bp);
    }
  } finally {
    await browser.close();
  }
})();
```

## Template 2: E-commerce Flow

```js
(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();


    // Browse products
    await gotoLocal(page, 'http://localhost:3000/products');
    await page.waitForSelector('.product-card');
    await saveScreenshot(page, '_screenshots/checkout-flow/01-products.png');

    // Add to cart
    await page.click('.product-card:first-child button.add-to-cart');
    await page.waitForSelector('.cart-badge');
    await saveScreenshot(page, '_screenshots/checkout-flow/02-added-to-cart.png');

    // Open cart
    await page.click('.cart-icon');
    await page.waitForSelector('.cart-drawer');
    await saveScreenshot(page, '_screenshots/checkout-flow/03-cart-open.png');

    // Proceed to checkout
    await page.click('button.checkout');
    await page.waitForURL('**/checkout');
    await saveScreenshot(page, '_screenshots/checkout-flow/04-checkout.png');
  } finally {
    await browser.close();
  }
})();
```

## Template 3: State Variations

```js
(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();


    await gotoLocal(page, 'http://localhost:3000/dashboard');

    // Empty state
    await page.evaluate(() => localStorage.setItem('tasks', '[]'));
    await page.reload({ waitUntil: 'load' });
    await saveScreenshot(page, '_screenshots/states/empty.png');

    // Populated state
    await page.evaluate(() => {
      localStorage.setItem('tasks', JSON.stringify([
        { id: 1, title: 'Design review', done: false },
        { id: 2, title: 'Ship feature', done: true },
      ]));
    });
    await page.reload({ waitUntil: 'load' });
    await saveScreenshot(page, '_screenshots/states/populated.png');

    // Error state — intercept API.
    // Route interception is a screenshotting/test tool. Use it to capture rare states;
    // never use it to mask real production traffic or to bypass server-side auth.
    await page.route('**/api/tasks', (route) =>
      route.fulfill({ status: 500, body: 'Internal Server Error' })
    );
    await page.reload({ waitUntil: 'load' });
    await saveScreenshot(page, '_screenshots/states/error.png');
  } finally {
    await browser.close();
  }
})();
```

## Interactive Mode

Keep the browser alive for iterative debugging:

```js
(async () => {
  const browser = await chromium.launch({ headless: false }); // visible browser
  try {
    const context = await browser.newContext();
    const page = await context.newPage();

    await gotoLocal(page, 'http://localhost:3000');
    console.log('Browser ready. Page:', page.url());

    // Inspect
    const title = await page.title();
    console.log(JSON.stringify({ boundary: 'untrusted-page-content', source: page.url(), title }));

    // Interact
    await page.click('nav a:first-child');
    await page.waitForLoadState('load');

    // Capture
    await saveScreenshot(page, '_screenshots/interactive-01.png');

    // Inspect again
    const ariaSnapshot = await page.locator('body').ariaSnapshot();
    console.log(JSON.stringify({
      boundary: 'untrusted-page-content',
      source: page.url(),
      ariaSnapshot: ariaSnapshot.slice(0, 500),
    }, null, 2));

    // More interaction...
    await page.fill('#search', 'test query');
    await page.press('#search', 'Enter');
    await page.waitForSelector('.search-results');

    // Capture the result
    await saveScreenshot(page, '_screenshots/interactive-02.png');
  } finally {
    await browser.close();
  }
})();
```
