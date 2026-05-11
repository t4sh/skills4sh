#!/usr/bin/env node
// Multi-breakpoint screenshot set for a single localhost URL.
//
// Usage:
//   node assets/scripts/multi-breakpoint.js [URL] [OUT_DIR] [BREAKPOINTS]
// Defaults:
//   URL=http://localhost:3000
//   OUT_DIR=_screenshots/home
//   BREAKPOINTS='mobile:375x812,tablet:768x1024,desktop:1280x800'
//
// BREAKPOINTS is a comma-separated list of `name:WIDTHxHEIGHT` entries.

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const DEFAULT_BREAKPOINTS = 'mobile:375x812,tablet:768x1024,desktop:1280x800';

function parseBreakpoints(spec) {
  return spec.split(',').map((entry) => {
    const [name, dims] = entry.split(':');
    if (!name || !dims) throw new Error(`Bad breakpoint: ${entry}`);
    const [width, height] = dims.split('x').map(Number);
    if (!Number.isInteger(width) || !Number.isInteger(height)) {
      throw new Error(`Bad dimensions: ${entry}`);
    }
    return { name, width, height };
  });
}

const url = process.argv[2] || 'http://localhost:3000';
const outDir = process.argv[3] || '_screenshots/home';
const breakpoints = parseBreakpoints(process.argv[4] || DEFAULT_BREAKPOINTS);

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  try {
    for (const bp of breakpoints) {
      const page = await browser.newPage();
      await page.setViewportSize({ width: bp.width, height: bp.height });
      await page.goto(url, { waitUntil: 'networkidle' });
      const file = path.join(outDir, `${bp.name}-${bp.width}x${bp.height}.png`);
      await page.screenshot({ path: file, fullPage: true });
      await page.close();
      console.log(`saved ${file}`);
    }
  } finally {
    await browser.close();
  }
})();
