#!/usr/bin/env node
// Before/after comparison of two capture directories, with an offline HTML report.
// Run from the project root: node "<skill-dir>/assets/scripts/compare.js" --help
// Needs pixelmatch 8 and pngjs 7, resolved from the current project first, then from beside
// this script. It opens no network connection and launches no browser.

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const HELP = `Usage: node compare.js --before DIR --after DIR --out DIR [options]

Pairs PNG files by their path relative to --before and --after (subdirectories included),
counts differing pixels per pair, and writes into --out only. When capture.json exists,
it is authoritative: only successful captures from that run are compared.
  report.json   every pair and the totals
  report.html   before / after / diff for every pair; opens offline, loads nothing remote
  <subdir>/diff-<name>.png   one diff image per pair that differs

  --before DIR           Baseline captures. Required.
  --after DIR            Captures to check against the baseline. Required.
  --out DIR              Output directory, not inside --before or --after. Required.
  --threshold N          Per-pixel colour sensitivity from 0 to 1; smaller is stricter. Default: 0.05
  --max-diff-pixels N    Differing pixels allowed in a pair before it counts as different. Default: 0
  --max-diff-percent P   The same allowance as a percentage of the pair's pixels.
  --window-size N        Count the densest N x N square of differing pixels, not the whole image.
  --include-aa           Count anti-aliased pixels as differences too.
  --json                 Print the report as JSON instead of text.
  --help                 Show this text.

Exit codes:
  0  every pair was compared and is within the allowance
  1  a complete comparison found visual differences
  2  incomplete comparison or setup error: a capture failed, an image is missing or unreadable,
     no readable pair exists, bad arguments, or a missing dependency or directory`;

const PINNED = 'pixelmatch@8.0.0 pngjs@7.0.0';

function fail(message) {
  console.error(message);
  process.exit(2);
}

function parseArgs(argv) {
  const options = {};
  const valued = ['before', 'after', 'out', 'threshold', 'max-diff-pixels', 'max-diff-percent', 'window-size'];
  const flags = ['include-aa', 'json', 'help'];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) fail(`Unexpected argument: ${arg}\nRun with --help for usage.`);
    const [name, inline] = arg.slice(2).split(/=(.*)/s);
    if (flags.includes(name)) {
      options[name] = true;
    } else if (valued.includes(name)) {
      const value = inline !== undefined ? inline : argv[i += 1];
      if (value === undefined || value === '') fail(`Missing value for --${name}\nRun with --help for usage.`);
      options[name] = value;
    } else {
      fail(`Unknown option: --${name}\nRun with --help for usage.`);
    }
  }
  return options;
}

function numberOption(options, name, { min, max, integer }) {
  if (options[name] === undefined) return undefined;
  const value = Number(options[name]);
  if (!Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) {
    fail(`--${name} must be ${integer ? 'a whole number' : 'a number'} from ${min} to ${max}`);
  }
  return value;
}

// Project first, then beside this script. Counts from pixelmatch 7 and earlier use a different
// colour metric and those versions ignore --window-size, so anything below 8 is skipped.
function loadDependencies() {
  const found = [];
  for (const dir of [process.cwd(), __dirname]) {
    try {
      const manifest = require.resolve('pixelmatch/package.json', { paths: [dir] });
      const { version, main } = JSON.parse(fs.readFileSync(manifest, 'utf8'));
      if (Number(version.split('.')[0]) < 8) {
        found.push(`pixelmatch ${version} at ${path.dirname(manifest)}`);
        continue;
      }
      const { PNG } = require(require.resolve('pngjs', { paths: [dir] }));
      return { PNG, version, entry: path.join(path.dirname(manifest), main || 'index.js') };
    } catch (err) {
      if (!err || err.code !== 'MODULE_NOT_FOUND') throw err;
    }
  }
  return fail(`Missing dependency: compare.js needs pixelmatch 8 and pngjs.${found.length ? ` Found only ${found.join(', ')}.` : ''} `
    + `Install them in the project you run this command from (for example npm install --save-dev --save-exact ${PINNED}), then rerun from that project root.`);
}

// Every PNG under dir as a '/'-separated path relative to it.
function listPngs(dir) {
  return fs.readdirSync(dir, { recursive: true })
    .map((entry) => String(entry).split(path.sep).join('/'))
    .filter((entry) => entry.toLowerCase().endsWith('.png'));
}

function routeDirectory(route) {
  const name = route.replace(/^\/+/, '').replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^[-.]+|[-.]+$/g, '');
  return name || 'home';
}

function readCaptureManifest(dir) {
  const manifestPath = path.join(dir, 'capture.json');
  if (!fs.existsSync(manifestPath)) return null;

  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch (err) {
    fail(`Invalid capture manifest ${manifestPath}: ${err.message}`);
  }
  if (manifest?.state !== undefined && manifest.state !== 'complete') {
    fail(`Capture is still in progress or incomplete in ${manifestPath}: wait for a running capture to finish, or rerun capture.js if it was interrupted or could not start, then compare again.`);
  }
  if (!manifest || typeof manifest !== 'object' || !Array.isArray(manifest.routes) || !Array.isArray(manifest.breakpoints)
    || !Array.isArray(manifest.results) || !Number.isInteger(manifest.expected)) {
    fail(`Invalid capture manifest ${manifestPath}: routes, breakpoints, expected and results are required.`);
  }
  if (manifest.routes.length === 0 || manifest.breakpoints.length === 0
    || manifest.routes.some((route) => typeof route !== 'string' || !route.startsWith('/'))
    || new Set(manifest.routes).size !== manifest.routes.length
    || manifest.breakpoints.some((breakpoint) => typeof breakpoint !== 'string' || !/^[a-z0-9][a-z0-9-]*:\d+x\d+$/.test(breakpoint))
    || new Set(manifest.breakpoints).size !== manifest.breakpoints.length) {
    fail(`Invalid capture manifest ${manifestPath}: routes or breakpoints are malformed.`);
  }
  if (manifest.expected !== manifest.routes.length * manifest.breakpoints.length
    || manifest.results.length !== manifest.expected) {
    fail(`Invalid capture manifest ${manifestPath}: result count does not match routes × breakpoints.`);
  }
  const successCount = manifest.results.filter((result) => result?.ok === true).length;
  const failureCount = manifest.results.filter((result) => result?.ok === false).length;
  if ((manifest.saved !== undefined || manifest.failed !== undefined)
    && (!Number.isInteger(manifest.saved) || !Number.isInteger(manifest.failed)
      || manifest.saved !== successCount || manifest.failed !== failureCount)) {
    fail(`Invalid capture manifest ${manifestPath}: saved/failed counts do not match the results.`);
  }

  const remaining = new Set();
  for (const route of manifest.routes) {
    for (const breakpoint of manifest.breakpoints) remaining.add(`${route}\0${breakpoint}`);
  }
  const files = new Map();
  for (const result of manifest.results) {
    if (!result || typeof result.ok !== 'boolean' || typeof result.file !== 'string'
      || typeof result.route !== 'string' || typeof result.breakpoint !== 'string'
      || !Number.isInteger(result.width) || !Number.isInteger(result.height)) {
      fail(`Invalid capture manifest ${manifestPath}: a result is missing required fields.`);
    }
    const dimensions = `${result.width}x${result.height}`;
    const key = `${result.route}\0${result.breakpoint}:${dimensions}`;
    if (!remaining.delete(key)) {
      fail(`Invalid capture manifest ${manifestPath}: unexpected or duplicate result for ${result.route} at ${result.breakpoint}.`);
    }
    const name = `${routeDirectory(result.route)}/${result.breakpoint}-${dimensions}.png`;
    // Legacy file paths include the original --out prefix. Resolve only the
    // known route/breakpoint suffix against the directory supplied today.
    const legacyFile = result.file.replace(/\\/g, '/');
    const matches = result.relativeFile !== undefined ? result.relativeFile === name
      : legacyFile === name || legacyFile.endsWith(`/${name}`);
    if (!matches) fail(`Invalid capture manifest ${manifestPath}: result file does not match its route and breakpoint.`);
    if (files.has(name)) fail(`Invalid capture manifest ${manifestPath}: multiple results name the same output file.`);
    const file = path.join(dir, name);
    const entry = { capture: result };
    if (result.ok) {
      if (fs.statSync(file, { throwIfNoEntry: false })?.isFile()) entry.file = file;
      else entry.error = 'successful capture file is missing';
    }
    files.set(name, entry);
  }
  return files;
}

function standaloneFiles(dir) {
  return new Map(listPngs(dir).map((file) => [file, { file: path.join(dir, file) }]));
}

function isInside(child, parent) {
  const relative = path.relative(parent, child);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// A relative link from the report to an image, safe in an attribute and as a URL.
function href(fromDir, file) {
  const relative = path.relative(fromDir, file).split(path.sep).map(encodeURIComponent).join('/');
  return escapeHtml(relative);
}

const LABELS = {
  same: 'same',
  different: 'different',
  'size-changed': 'size changed',
  'missing-before': 'only in after',
  'missing-after': 'only in before',
  unreadable: 'unreadable',
  'capture-failed-before': 'capture failed before',
  'capture-failed-after': 'capture failed after',
  'route-mismatch': 'route mismatch',
};

function describe(result) {
  if (result.status === 'missing-before' || result.status === 'missing-after'
    || result.status === 'capture-failed-before' || result.status === 'capture-failed-after'
    || result.status === 'route-mismatch') return result.error || LABELS[result.status];
  if (result.status === 'unreadable') return result.error;
  const pixels = `${result.diffPixels.toLocaleString('en-US')} px${result.windowSize ? ` in the densest ${result.windowSize}x${result.windowSize} square` : ` (${result.diffPercent}%)`}`;
  if (result.status === 'size-changed') return `${result.before.width}x${result.before.height} -> ${result.after.width}x${result.after.height}, ${pixels}`;
  return pixels;
}

function renderHtml(report, outDir) {
  const figure = (title, file) => `<figure><figcaption>${title}</figcaption>${file
    ? `<a href="${href(outDir, file)}"><img loading="lazy" alt="${title}" src="${href(outDir, file)}"></a>`
    : '<p class="none">none</p>'}</figure>`;
  const pair = (result) => `<details${result.status === 'same' ? '' : ' open'}>
<summary><span class="tag ${result.status === 'same' ? 'ok' : 'bad'}">${escapeHtml(LABELS[result.status])}</span> <code>${escapeHtml(result.name)}</code> <span class="note">${escapeHtml(describe(result))}</span></summary>
<div class="row">${figure('Before', result.beforeFile)}${figure('After', result.afterFile)}${figure('Diff', result.diffFile)}</div>
</details>`;
  const t = report.totals;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Visual comparison</title>
<style>
  * { box-sizing: border-box; }
  body { font: 15px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; margin: 0; padding: 24px; background: #f6f7f9; color: #1a1d23; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  .meta { color: #555c68; margin: 0 0 20px; overflow-wrap: anywhere; }
  details { background: #fff; border: 1px solid #dfe3e8; border-radius: 8px; margin-bottom: 12px; }
  summary { padding: 10px 14px; cursor: pointer; overflow-wrap: anywhere; }
  .tag { display: inline-block; padding: 1px 8px; border-radius: 999px; font-size: 13px; font-weight: 600; }
  .ok { background: #dcfce7; color: #14532d; }
  .bad { background: #fee2e2; color: #7f1d1d; }
  .note { color: #555c68; }
  .row { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; padding: 0 14px 14px; }
  figure { margin: 0; min-width: 0; }
  figcaption { font-size: 13px; color: #555c68; margin-bottom: 4px; }
  img { display: block; max-width: 100%; height: auto; border: 1px solid #dfe3e8; }
  .none { margin: 0; color: #555c68; }
  @media (max-width: 720px) { .row { grid-template-columns: minmax(0, 1fr); } }
  @media (prefers-color-scheme: dark) {
    body { background: #14161a; color: #e8eaed; }
    details { background: #1d2026; border-color: #343a44; }
    .meta, .note, figcaption, .none { color: #a3abb8; }
    img { border-color: #343a44; }
  }
</style></head><body>
<h1>Visual comparison</h1>
<p class="meta">${t.different + t.sizeChanged + t.missing + t.unreadable + t.captureFailed + t.routeMismatches} of ${t.pairs} incomplete or different: ${t.same} same, ${t.different} different, ${t.sizeChanged} size changed, ${t.missing} on one side only, ${t.unreadable} unreadable, ${t.captureFailed} capture failed, ${t.routeMismatches} route mismatch. ${t.compared} compared.<br>
Before <code>${escapeHtml(report.before)}</code> · After <code>${escapeHtml(report.after)}</code><br>
Per-pixel threshold ${escapeHtml(report.options.threshold)}, allowance ${escapeHtml(report.options.allowance)}${report.options.windowSize ? `, window ${escapeHtml(report.options.windowSize)}` : ''}, pixelmatch ${escapeHtml(report.pixelmatch)} · ${escapeHtml(report.generated)}</p>
${report.results.filter((r) => r.status !== 'same').map(pair).join('\n')}
${report.results.filter((r) => r.status === 'same').map(pair).join('\n')}
</body></html>
`;
}

const options = parseArgs(process.argv.slice(2));
if (options.help) {
  console.log(HELP);
  process.exit(0);
}
for (const name of ['before', 'after', 'out']) {
  if (!options[name]) fail(`Missing --${name}\nRun with --help for usage.`);
}
const threshold = numberOption(options, 'threshold', { min: 0, max: 1 }) ?? 0.05;
const maxDiffPercent = numberOption(options, 'max-diff-percent', { min: 0, max: 100 });
const maxDiffPixels = numberOption(options, 'max-diff-pixels', { min: 0, max: Number.MAX_SAFE_INTEGER, integer: true });
const windowSize = numberOption(options, 'window-size', { min: 2, max: 4096, integer: true });
if (maxDiffPercent !== undefined && maxDiffPixels !== undefined) fail('Use --max-diff-pixels or --max-diff-percent, not both.');
if (maxDiffPercent !== undefined && windowSize !== undefined) fail('--window-size counts pixels in one square; use it with --max-diff-pixels.');

const beforeDir = path.resolve(options.before);
const afterDir = path.resolve(options.after);
const outDir = path.resolve(options.out);
for (const [name, dir] of [['before', beforeDir], ['after', afterDir]]) {
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) fail(`--${name} is not a directory: ${options[name]}`);
}
if (beforeDir === afterDir) fail('--before and --after are the same directory; a capture compared with itself proves nothing.');
if (isInside(outDir, beforeDir) || isInside(outDir, afterDir)) fail('--out must not be inside --before or --after.');

const beforeCapture = readCaptureManifest(beforeDir);
const afterCapture = readCaptureManifest(afterDir);
const captureMode = Boolean(beforeCapture || afterCapture);
const beforeFiles = beforeCapture ?? standaloneFiles(beforeDir);
const afterFiles = afterCapture ?? standaloneFiles(afterDir);
const names = [...new Set([...beforeFiles.keys(), ...afterFiles.keys()])].sort();
const paired = names.filter((name) => beforeFiles.get(name)?.file && afterFiles.get(name)?.file).length;
if (paired === 0 && !captureMode) {
  fail(`Nothing to compare: ${names.length} PNG file(s) found, none present under both ${options.before} and ${options.after}. `
    + 'Pass the two top-level capture directories, and check that both captures ran with the same routes and breakpoints.');
}

(async () => {
  const { PNG, version, entry } = loadDependencies();
  const pixelmatch = (await import(pathToFileURL(entry).href)).default;

  const pad = (image, width, height) => {
    if (image.width === width && image.height === height) return image;
    const padded = new PNG({ width, height });
    PNG.bitblt(image, padded, 0, 0, image.width, image.height, 0, 0);
    return padded;
  };

  const results = [];
  for (const name of names) {
    const beforeEntry = beforeFiles.get(name);
    const afterEntry = afterFiles.get(name);
    const beforeResult = beforeEntry?.capture;
    const afterResult = afterEntry?.capture;
    const label = name.replace(/\.png$/i, '');
    const beforeFile = beforeEntry?.file ?? null;
    const afterFile = afterEntry?.file ?? null;
    const hasBefore = Boolean(beforeEntry?.file);
    const hasAfter = Boolean(afterEntry?.file);
    if (beforeResult && afterResult && beforeResult.route !== afterResult.route) {
      results.push({
        name: label,
        status: 'route-mismatch',
        error: `different requested routes share ${name}: ${beforeResult.route} and ${afterResult.route}`,
        beforeFile: beforeResult.ok ? beforeFile : null,
        afterFile: afterResult.ok ? afterFile : null,
        diffFile: null,
      });
      continue;
    }
    if (beforeResult && !beforeResult.ok) {
      results.push({ name: label, status: 'capture-failed-before', error: beforeResult.error || 'capture failed', beforeFile: null, afterFile: hasAfter ? afterFile : null, diffFile: null });
      continue;
    }
    if (afterResult && !afterResult.ok) {
      results.push({ name: label, status: 'capture-failed-after', error: afterResult.error || 'capture failed', beforeFile: hasBefore ? beforeFile : null, afterFile: null, diffFile: null });
      continue;
    }
    if (beforeEntry?.error || afterEntry?.error) {
      results.push({
        name: label,
        status: 'unreadable',
        error: beforeEntry?.error || afterEntry?.error,
        beforeFile: beforeEntry?.file || null,
        afterFile: afterEntry?.file || null,
        diffFile: null,
      });
      continue;
    }
    if (!hasBefore || !hasAfter) {
      results.push({
        name: label, status: hasBefore ? 'missing-after' : 'missing-before',
        beforeFile: hasBefore ? beforeFile : null, afterFile: hasAfter ? afterFile : null, diffFile: null,
      });
      continue;
    }
    let before;
    let after;
    try {
      before = PNG.sync.read(fs.readFileSync(beforeFile));
      after = PNG.sync.read(fs.readFileSync(afterFile));
    } catch (err) {
      results.push({
        name: label, status: 'unreadable', error: `not a readable PNG: ${String(err.message).split('\n')[0]}`,
        beforeFile, afterFile, diffFile: null,
      });
      continue;
    }
    const width = Math.max(before.width, after.width);
    const height = Math.max(before.height, after.height);
    const sizeChanged = before.width !== after.width || before.height !== after.height;
    const diff = new PNG({ width, height });
    const diffPixels = pixelmatch(pad(before, width, height).data, pad(after, width, height).data, diff.data, width, height, {
      threshold, includeAA: Boolean(options['include-aa']), ...(windowSize ? { windowSize } : {}),
    });
    const allowed = maxDiffPercent !== undefined ? Math.floor((maxDiffPercent / 100) * width * height) : (maxDiffPixels ?? 0);
    const status = sizeChanged ? 'size-changed' : diffPixels > allowed ? 'different' : 'same';
    let diffFile = null;
    if (diffPixels > 0 || sizeChanged) {
      diffFile = path.join(outDir, path.dirname(name), `diff-${path.basename(name)}`);
      fs.mkdirSync(path.dirname(diffFile), { recursive: true });
      fs.writeFileSync(diffFile, PNG.sync.write(diff));
    }
    results.push({
      name: label, status, diffPixels, diffPercent: Number(((diffPixels / (width * height)) * 100).toFixed(4)), allowed,
      ...(windowSize ? { windowSize } : {}),
      before: { width: before.width, height: before.height }, after: { width: after.width, height: after.height },
      beforeFile, afterFile, diffFile,
    });
  }

  const count = (...statuses) => results.filter((r) => statuses.includes(r.status)).length;
  const report = {
    generated: new Date().toISOString(),
    before: options.before,
    after: options.after,
    out: options.out,
    pixelmatch: version,
    options: {
      threshold,
      allowance: maxDiffPercent !== undefined ? `${maxDiffPercent}% of pixels` : `${maxDiffPixels ?? 0} px`,
      ...(windowSize ? { windowSize } : {}),
      includeAA: Boolean(options['include-aa']),
    },
    totals: {
      pairs: results.length,
      compared: count('same', 'different', 'size-changed'),
      same: count('same'),
      different: count('different'),
      sizeChanged: count('size-changed'),
      missing: count('missing-before', 'missing-after'),
      unreadable: count('unreadable'),
      captureFailed: count('capture-failed-before', 'capture-failed-after'),
      routeMismatches: count('route-mismatch'),
    },
    results,
  };

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'report.html'), renderHtml(report, outDir));
  // Paths in report.json are relative to the directory the command ran from, like the arguments.
  const relative = (file) => (file ? path.relative(process.cwd(), file).split(path.sep).join('/') : null);
  const portable = {
    ...report,
    results: results.map((r) => ({ ...r, beforeFile: relative(r.beforeFile), afterFile: relative(r.afterFile), diffFile: relative(r.diffFile) })),
  };
  fs.writeFileSync(path.join(outDir, 'report.json'), `${JSON.stringify(portable, null, 2)}\n`);

  const t = report.totals;
  const incomplete = paired === 0 || t.missing > 0 || t.unreadable > 0 || t.captureFailed > 0 || t.routeMismatches > 0;
  const differing = t.different + t.sizeChanged;
  if (options.json) {
    console.log(JSON.stringify(portable, null, 2));
  } else {
    for (const r of results) console.log(`${LABELS[r.status].padEnd(14)} ${r.name}  ${describe(r)}`);
    console.log(`${differing} of ${t.pairs} differ (${t.compared} compared: ${t.same} same, ${t.different} different, ${t.sizeChanged} size changed; ${t.missing} on one side only; ${t.unreadable} unreadable; ${t.captureFailed} capture failed; ${t.routeMismatches} route mismatch)`);
    console.log(`report: ${path.join(options.out, 'report.html')} and ${path.join(options.out, 'report.json')}`);
  }
  process.exit(incomplete ? 2 : differing ? 1 : 0);
})().catch((err) => {
  console.error(String((err && err.stack) || err));
  process.exit(2);
});
