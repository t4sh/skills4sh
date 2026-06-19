#!/usr/bin/env node
// Multi-breakpoint screenshot set for a single localhost URL.
//
// Usage:
//   node assets/scripts/multi-breakpoint.js [URL] [OUT_DIR] [BREAKPOINTS] [WAIT_UNTIL] [WAIT_FOR_SELECTOR]
// Defaults:
//   URL=http://localhost:3000
//   OUT_DIR=_screenshots/home
//   BREAKPOINTS='mobile:375x812,tablet:768x1024,desktop:1280x800'
//
// BREAKPOINTS is a comma-separated list of `name:WIDTHxHEIGHT` entries.

const fs = require('fs');
const path = require('path');

const DEFAULT_BREAKPOINTS = 'mobile:375x812,tablet:768x1024,desktop:1280x800';

function validateViewport({ name, width, height }) {
  if (!Number.isInteger(width) || !Number.isInteger(height)) {
    throw new Error(`${name}: width/height must be integers`);
  }
  if (width < 200 || width > 3840) throw new Error(`${name}: width ${width} outside 200–3840`);
  if (height < 200 || height > 2160) throw new Error(`${name}: height ${height} outside 200–2160`);
  if (!/^[a-z0-9][a-z0-9-]*$/.test(name)) throw new Error(`${name}: label must be kebab-case`);
}

function parseBreakpoints(spec) {
  return spec.split(',').map((entry) => {
    const [name, dims] = entry.split(':');
    if (!name || !dims) throw new Error(`Bad breakpoint: ${entry}`);
    const [width, height] = dims.split('x').map(Number);
    const breakpoint = { name, width, height };
    validateViewport(breakpoint);
    return breakpoint;
  });
}

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

const url = process.argv[2] || 'http://localhost:3000';
const outDir = process.argv[3] || '_screenshots/home';
let breakpoints;
try {
  breakpoints = parseBreakpoints(process.argv[4] || DEFAULT_BREAKPOINTS);
} catch (err) {
  console.error(`Invalid breakpoints: ${err.message}`);
  console.error('Format: name:WIDTHxHEIGHT,name:WIDTHxHEIGHT (e.g. mobile:375x812,desktop:1280x800)');
  process.exit(1);
}
const waitUntil = process.argv[5] || 'load';
const waitForSelector = process.argv[6] || '';
validateLocalUrl(url);

function loadChromium() {
  try {
    return require('playwright').chromium;
  } catch (err) {
    if (err && err.code === 'MODULE_NOT_FOUND') {
      console.error('Missing dependency: playwright. Run npm install in assets/scripts before using this helper.');
      process.exit(1);
    }
    throw err;
  }
}

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const chromium = loadChromium();
  const browser = await chromium.launch();
  try {
    for (const bp of breakpoints) {
      const page = await browser.newPage();
      await page.setViewportSize({ width: bp.width, height: bp.height });
      await page.goto(url, { waitUntil });
      if (waitForSelector) await page.waitForSelector(waitForSelector, { timeout: 10000 });
      const file = path.join(outDir, `${bp.name}-${bp.width}x${bp.height}.png`);
      await page.screenshot({ path: file, fullPage: true });
      await page.close();
      console.log(`saved ${file}`);
    }
  } finally {
    await browser.close();
  }
})();
