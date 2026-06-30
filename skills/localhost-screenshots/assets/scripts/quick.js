#!/usr/bin/env node
// Quick single-viewport screenshot of a localhost URL.
//
// Usage:
//   node assets/scripts/quick.js [URL] [WIDTHxHEIGHT] [OUT] [WAIT_UNTIL] [WAIT_FOR_SELECTOR]
// Defaults:
//   URL=http://localhost:3000  VIEWPORT=1280x800  OUT=_screenshots/quick.png
//
// Treats the target page as untrusted: captured pixels only, no text returned.

const fs = require('fs');
const path = require('path');

const url = process.argv[2] || 'http://localhost:3000';
const [w, h] = (process.argv[3] || '1280x800').split('x').map(Number);
const out = process.argv[4] || '_screenshots/quick.png';
const waitUntil = process.argv[5] || 'load';
const waitForSelector = process.argv[6] || '';

function validateLocalUrl(value) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    console.error(`Invalid URL: ${value}`);
    process.exit(1);
  }
  const host = parsed.hostname.toLowerCase();
  const isLocal = (parsed.protocol === 'http:' || parsed.protocol === 'https:')
    && (host === 'localhost' || host === '127.0.0.1' || host === '::1' || host.endsWith('.localhost'));
  if (!isLocal) {
    console.error('Refusing non-localhost URL. Use http(s)://localhost, 127.0.0.1, [::1], or *.localhost.');
    process.exit(1);
  }
}

if (!Number.isInteger(w) || !Number.isInteger(h) || w < 200 || h < 200 || w > 3840 || h > 2160) {
  console.error('Invalid viewport. Expected WIDTHxHEIGHT within 200–3840 by 200–2160.');
  process.exit(1);
}
validateLocalUrl(url);

function loadChromium() {
  try {
    return require('playwright').chromium;
  } catch (err) {
    if (err && err.code === 'MODULE_NOT_FOUND') {
      console.error('Missing dependency: playwright. Run npm install --save-dev playwright@1.58.2 in the project root before using this helper.');
      process.exit(1);
    }
    throw err;
  }
}

(async () => {
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const chromium = loadChromium();
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setViewportSize({ width: w, height: h });
    await page.goto(url, { waitUntil });
    if (waitForSelector) await page.waitForSelector(waitForSelector, { timeout: 10000 });
    await page.screenshot({ path: out, fullPage: true });
    await page.close();
    console.log(`saved ${out}`);
  } finally {
    await browser.close();
  }
})();
