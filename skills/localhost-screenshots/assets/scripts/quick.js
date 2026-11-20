#!/usr/bin/env node
// Quick single-viewport screenshot of a localhost URL.
//
// Usage (run from the project root; relative OUT lands in that project's _screenshots/):
//   node "<skill-dir>/assets/scripts/quick.js" [URL] [WIDTHxHEIGHT] [OUT] [WAIT_UNTIL] [WAIT_FOR_SELECTOR]
// Argument order: viewport comes BEFORE the output path (screenshot-a11y.js is the reverse).
// Defaults:
//   URL=http://localhost:3000  VIEWPORT=1280x800  OUT=_screenshots/quick.png
// Playwright resolves from the current project first, then from beside this script.
// Requires local-guard.js from the same folder (URL policy and the navigation guard).
//
// Treats the target page as untrusted: captured pixels only, no text returned.

const fs = require('fs');
const path = require('path');
const {
  localUrlProblem, gotoLocal, assertLocalPage, captureVerifiedPng, loadChromium, PLAYWRIGHT_MISSING,
} = require('./local-guard.js');

const url = process.argv[2] || 'http://localhost:3000';
const [w, h] = (process.argv[3] || '1280x800').split('x').map(Number);
const out = process.argv[4] || '_screenshots/quick.png';
const waitUntil = process.argv[5] || 'load';
const waitForSelector = process.argv[6] || '';

if (!Number.isInteger(w) || !Number.isInteger(h) || w < 200 || h < 200 || w > 3840 || h > 2160) {
  console.error('Invalid viewport. Expected WIDTHxHEIGHT within 200–3840 by 200–2160.');
  process.exit(1);
}
const urlProblem = localUrlProblem(url);
if (urlProblem) {
  console.error(urlProblem);
  process.exit(1);
}

(async () => {
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const chromium = loadChromium();
  if (!chromium) {
    console.error(PLAYWRIGHT_MISSING);
    process.exit(1);
  }
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setViewportSize({ width: w, height: h });
    await gotoLocal(page, url, { waitUntil });
    if (waitForSelector) {
      // A blocked navigation is the real cause when the wait fails on a browser error page.
      await page.waitForSelector(waitForSelector, { timeout: 10000 }).catch((err) => {
        assertLocalPage(page);
        throw err;
      });
    }
    const { png } = await captureVerifiedPng(page, { width: w, height: h }, { fullPage: true });
    fs.writeFileSync(out, png);
    await page.close();
    console.log(`saved ${out}`);
  } finally {
    await browser.close();
  }
})();
