#!/usr/bin/env node
// Systematic capture: every route at every breakpoint for one local origin.
// Run from the project root: node "<skill-dir>/assets/scripts/capture.js" --help
// Requires local-guard.js from the same folder (URL policy and the navigation guard).
//
// Treats the target page as untrusted: captured pixels only, no page text is returned.

const fs = require('fs');
const path = require('path');
const {
  localUrlProblem, gotoLocal, assertLocalPage, captureVerifiedPng, loadChromium, PLAYWRIGHT_MISSING,
} = require('./local-guard.js');

const HELP = `Usage: node capture.js --base-url URL --out DIR [options]

Captures every route at every breakpoint into DIR/<route>/<name>-<W>x<H>.png.
Nothing is written outside DIR. Run it twice (two DIRs) for a before/after set,
then pass both to compare.js.

  --base-url URL       Local origin: http(s)://localhost, 127.0.0.1, [::1] or *.localhost. Required.
  --out DIR            Output directory. Required.
  --routes LIST        Comma-separated paths on that origin. Default: /
  --breakpoints LIST   Comma-separated name:WIDTHxHEIGHT entries.
                       Default: the eight standard breakpoints, 320 to 1920 wide.
  --wait-until EVENT   load, domcontentloaded, networkidle or commit. Default: load
  --wait-for SELECTOR  Wait for this selector on every route before capturing.
  --expected-status N  Expected HTTP status for every route (for example 404 for error-page captures).
  --viewport-only      Capture the viewport instead of the full scrollable page.
  --json               Print the summary as JSON instead of text.
  --help               Show this text.

Each run also writes DIR/capture.json with the same summary.

Exit codes:
  0  every route was captured at every breakpoint
  1  at least one capture failed; the summary names each one
  2  usage or setup error; nothing was captured`;

const STANDARD_BREAKPOINTS = 'mobile-sm:320x568,mobile:375x812,mobile-lg:428x926,tablet:768x1024,'
  + 'tablet-lg:1024x1366,desktop:1280x800,desktop-lg:1440x900,wide:1920x1080';
const WAIT_UNTIL = ['load', 'domcontentloaded', 'networkidle', 'commit'];

function usageError(message) {
  console.error(`${message}\nRun with --help for usage.`);
  process.exit(2);
}

function parseArgs(argv) {
  const options = { routes: '/', breakpoints: STANDARD_BREAKPOINTS, 'wait-until': 'load' };
  const valued = ['base-url', 'out', 'routes', 'breakpoints', 'wait-until', 'wait-for', 'expected-status'];
  const flags = ['viewport-only', 'json', 'help'];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) usageError(`Unexpected argument: ${arg}`);
    const [name, inline] = arg.slice(2).split(/=(.*)/s);
    if (flags.includes(name)) {
      options[name] = true;
    } else if (valued.includes(name)) {
      const value = inline !== undefined ? inline : argv[i += 1];
      if (value === undefined || value === '') usageError(`Missing value for --${name}`);
      options[name] = value;
    } else {
      usageError(`Unknown option: --${name}`);
    }
  }
  return options;
}

function parseBreakpoints(spec) {
  const seen = new Set();
  return spec.split(',').map((entry) => {
    const [name, dims] = entry.trim().split(':');
    const [width, height] = (dims || '').split('x').map(Number);
    if (!name || !/^[a-z0-9][a-z0-9-]*$/.test(name)) throw new Error(`${entry}: label must be kebab-case`);
    if (!Number.isInteger(width) || !Number.isInteger(height)) throw new Error(`${entry}: expected name:WIDTHxHEIGHT`);
    if (width < 200 || width > 3840) throw new Error(`${name}: width ${width} outside 200–3840`);
    if (height < 200 || height > 2160) throw new Error(`${name}: height ${height} outside 200–2160`);
    const file = `${name}-${width}x${height}.png`;
    if (seen.has(file)) throw new Error(`${entry}: listed twice`);
    seen.add(file);
    return { name, width, height, file };
  });
}

// '/' -> home, '/docs/intro?tab=api' -> docs-intro-tab-api. Only [A-Za-z0-9._-] survives, so a
// route can never name a directory outside --out.
function routeDirectory(route) {
  const name = route.replace(/^\/+/, '').replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^[-.]+|[-.]+$/g, '');
  return name || 'home';
}

function parseRoutes(spec, baseUrl) {
  const base = new URL(baseUrl);
  const seen = new Map();
  return spec.split(',').map((entry) => {
    const route = entry.trim();
    if (!route.startsWith('/')) throw new Error(`${entry}: a route must start with /`);
    const url = new URL(route, base);
    if (url.origin !== base.origin) throw new Error(`${entry}: resolves to another origin`);
    const directory = routeDirectory(route);
    if (seen.has(directory)) throw new Error(`${route} and ${seen.get(directory)} would both be saved to ${directory}/`);
    seen.set(directory, route);
    return { route, url: url.href, directory };
  });
}

// Only an origin is reported for a refused navigation: the rest of that URL is chosen by the
// page or its server, not by the caller.
function describeFailure(err) {
  if (err && err.code === 'NON_LOCAL_NAVIGATION') {
    let origin = 'another host';
    try { origin = new URL(err.url).origin; } catch { /* keep the generic wording */ }
    return `refused: the page left the local host for ${origin}`;
  }
  return String((err && err.message) || err).split('\n')[0];
}

const options = parseArgs(process.argv.slice(2));
if (options.help) {
  console.log(HELP);
  process.exit(0);
}
if (!options['base-url']) usageError('Missing --base-url');
if (!options.out) usageError('Missing --out');
const expectedStatus = options['expected-status'] === undefined ? null : Number(options['expected-status']);
if (expectedStatus !== null && (!Number.isInteger(expectedStatus) || expectedStatus < 100 || expectedStatus > 599)) {
  usageError('--expected-status must be an HTTP status from 100 to 599');
}
const urlProblem = localUrlProblem(options['base-url']);
if (urlProblem) usageError(urlProblem);
if (!WAIT_UNTIL.includes(options['wait-until'])) usageError(`--wait-until must be one of: ${WAIT_UNTIL.join(', ')}`);

let breakpoints;
let routes;
try {
  breakpoints = parseBreakpoints(options.breakpoints);
  routes = parseRoutes(options.routes, options['base-url']);
} catch (err) {
  usageError(`Invalid --breakpoints or --routes: ${err.message}`);
}

const outDir = path.resolve(options.out);
fs.mkdirSync(outDir, { recursive: true });
const manifestPath = path.join(outDir, 'capture.json');
const writeManifest = (summary) => {
  const temporary = path.join(outDir, `capture.json.tmp-${process.pid}`);
  fs.writeFileSync(temporary, `${JSON.stringify(summary, null, 2)}\n`);
  fs.renameSync(temporary, manifestPath);
};
writeManifest({ state: 'in-progress', baseUrl: options['base-url'], out: options.out });
const chromium = loadChromium();
if (!chromium) usageError(PLAYWRIGHT_MISSING);

(async () => {
  const results = [];
  let browser;
  try {
    browser = await chromium.launch();
  } catch (err) {
    // Setup problem (for example the browser is not installed): print Playwright's own advice.
    console.error(String((err && err.message) || err));
    process.exit(2);
  }
  try {
    for (const { route, url, directory } of routes) {
      for (const bp of breakpoints) {
        const relativeFile = path.posix.join(directory, bp.file);
        const file = path.join(outDir, directory, bp.file);
        const result = {
          route, breakpoint: bp.name, width: bp.width, height: bp.height,
          file: path.join(options.out, directory, bp.file), relativeFile,
        };
        const page = await browser.newPage();
        try {
          await page.setViewportSize({ width: bp.width, height: bp.height });
          const response = await gotoLocal(page, url, { waitUntil: options['wait-until'] });
          result.status = response && response.status();
          result.finalUrl = page.url();
          result.viewport = await page.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight }));
          if (options['wait-for']) {
            // A blocked navigation is the real cause when the wait fails on a browser error page.
            await page.waitForSelector(options['wait-for'], { timeout: 10000 }).catch((err) => {
              assertLocalPage(page);
              throw err;
            });
          }
          const captured = await captureVerifiedPng(page, { width: bp.width, height: bp.height }, {
            fullPage: !options['viewport-only'], animations: 'disabled',
          }, expectedStatus);
          result.status = captured.responseStatus;
          result.finalUrl = captured.finalUrl;
          result.viewport = captured.viewport;
          fs.mkdirSync(path.dirname(file), { recursive: true });
          fs.writeFileSync(file, captured.png);
          result.ok = true;
        } catch (err) {
          result.ok = false;
          result.error = describeFailure(err);
        } finally {
          await page.close().catch(() => {});
        }
        results.push(result);
      }
    }
  } finally {
    await browser.close();
  }

  const failed = results.filter((r) => !r.ok);
  const summary = {
    state: 'complete',
    baseUrl: options['base-url'],
    out: options.out,
    routes: routes.map((r) => r.route),
    breakpoints: breakpoints.map((bp) => `${bp.name}:${bp.width}x${bp.height}`),
    expected: results.length,
    saved: results.length - failed.length,
    failed: failed.length,
    results,
  };
  writeManifest(summary);
  if (options.json) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    for (const r of results) console.log(r.ok ? `saved ${r.file}` : `FAILED ${r.route} ${r.breakpoint}: ${r.error}`);
    console.log(`${summary.saved} of ${summary.expected} captures saved to ${options.out}/ (${routes.length} route(s) x ${breakpoints.length} breakpoint(s))`);
  }
  process.exit(failed.length ? 1 : 0);
})().catch((err) => {
  console.error(String((err && err.message) || err).split('\n')[0]);
  process.exit(1);
});
