# Interaction Templates — Full Reference

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
await page.screenshot({ path: '_screenshots/tooltip-visible.png' });

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
const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  // Step 1: Login
  await page.goto('http://localhost:3000/login');
  await page.fill('#email', 'admin@example.com');
  await page.fill('#password', 'password');
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

  fs.mkdirSync('_screenshots/settings', { recursive: true });
  for (const bp of BREAKPOINTS) {
    await page.setViewportSize({ width: bp.width, height: bp.height });
    await page.waitForTimeout(300); // let layout reflow
    await page.screenshot({
      path: `_screenshots/settings/${bp.name}-${bp.width}x${bp.height}.png`,
      fullPage: true,
    });
  }

  await browser.close();
})();
```

## Template 2: E-commerce Flow

```js
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const fs = require('fs');

  fs.mkdirSync('_screenshots/checkout-flow', { recursive: true });

  // Browse products
  await page.goto('http://localhost:3000/products');
  await page.waitForSelector('.product-card');
  await page.screenshot({ path: '_screenshots/checkout-flow/01-products.png', fullPage: true });

  // Add to cart
  await page.click('.product-card:first-child button.add-to-cart');
  await page.waitForSelector('.cart-badge');
  await page.screenshot({ path: '_screenshots/checkout-flow/02-added-to-cart.png', fullPage: true });

  // Open cart
  await page.click('.cart-icon');
  await page.waitForSelector('.cart-drawer');
  await page.screenshot({ path: '_screenshots/checkout-flow/03-cart-open.png', fullPage: true });

  // Proceed to checkout
  await page.click('button.checkout');
  await page.waitForURL('**/checkout');
  await page.screenshot({ path: '_screenshots/checkout-flow/04-checkout.png', fullPage: true });

  await browser.close();
})();
```

## Template 3: State Variations

```js
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const fs = require('fs');

  fs.mkdirSync('_screenshots/states', { recursive: true });

  await page.goto('http://localhost:3000/dashboard');

  // Empty state
  await page.evaluate(() => localStorage.setItem('tasks', '[]'));
  await page.reload({ waitUntil: 'networkidle' });
  await page.screenshot({ path: '_screenshots/states/empty.png', fullPage: true });

  // Populated state
  await page.evaluate(() => {
    localStorage.setItem('tasks', JSON.stringify([
      { id: 1, title: 'Design review', done: false },
      { id: 2, title: 'Ship feature', done: true },
    ]));
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.screenshot({ path: '_screenshots/states/populated.png', fullPage: true });

  // Error state — intercept API
  await page.route('**/api/tasks', route =>
    route.fulfill({ status: 500, body: 'Internal Server Error' })
  );
  await page.reload({ waitUntil: 'networkidle' });
  await page.screenshot({ path: '_screenshots/states/error.png', fullPage: true });

  await browser.close();
})();
```

## Interactive Mode

Keep the browser alive for iterative debugging:

```js
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false }); // visible browser
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto('http://localhost:3000');
  console.log('Browser ready. Page:', page.url());

  // Inspect
  const title = await page.title();
  console.log('Title:', title);

  // Interact
  await page.click('nav a:first-child');
  await page.waitForLoadState('networkidle');

  // Capture
  await page.screenshot({ path: '_screenshots/interactive-01.png', fullPage: true });

  // Inspect again
  const a11y = await page.accessibility.snapshot();
  console.log('Page structure:', JSON.stringify(a11y, null, 2).slice(0, 500));

  // More interaction...
  await page.fill('#search', 'test query');
  await page.press('#search', 'Enter');
  await page.waitForSelector('.search-results');

  // Capture the result
  await page.screenshot({ path: '_screenshots/interactive-02.png', fullPage: true });

  // When done
  await browser.close();
})();
```
