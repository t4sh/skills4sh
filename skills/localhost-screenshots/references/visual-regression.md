# Visual Regression — Full Reference

## Prefer Playwright Test screenshot assertions when available

When the project already uses the Playwright test runner, prefer native screenshot assertions before custom pixel-diff scripts. Playwright waits until screenshots stabilize, supports page and locator baselines, and exposes masking and diff thresholds in assertion options.

```js
import { test, expect } from '@playwright/test';
// gotoLocal: the Local Navigation Guard block from playwright-patterns.md, kept in a helper the tests import.

test('homepage visual baseline', async ({ page }) => {
  await gotoLocal(page, 'http://localhost:3000/', { waitUntil: 'load' });
  await expect(page).toHaveScreenshot('homepage.png', {
    animations: 'disabled',
    maxDiffPixelRatio: 0.01,
  });
});

test('hero visual baseline', async ({ page }) => {
  await gotoLocal(page, 'http://localhost:3000/', { waitUntil: 'load' });
  await expect(page.locator('.hero')).toHaveScreenshot('hero.png', {
    mask: [page.locator('[data-dynamic]')],
  });
});
```

Use the custom comparison and `pixelmatch` sections below when the task is an ad hoc before/after review, when the repository does not use Playwright Test, or when the user needs a standalone HTML comparison artifact.

## Before/After Comparison HTML

Save the JavaScript examples as ES modules (`.mjs`, or `.js` in a `type: module` project). The enhanced HTML generator reuses `fs`, `path`, `escapeHtml`, `htmlPath`, and `listPngs` from this first example; combine them without duplicate imports. All three functions walk subdirectories (Node.js 20.1+ `readdirSync` `recursive`), so they read the canonical `<dir>/<route>/<breakpoint>.png` layout as well as a flat directory.

```js
import fs from 'node:fs';
import path from 'node:path';

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function htmlPath(fromFile, toFile) {
  return path.relative(path.dirname(fromFile), toFile).split(path.sep).join('/');
}

// Every PNG under dir, as '/'-separated paths relative to it (for example home/mobile-375x812.png).
function listPngs(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { recursive: true })
    .map(f => String(f).split(path.sep).join('/'))
    .filter(f => f.endsWith('.png'));
}

function generateSideBySideComparison(beforeDir, afterDir, outputPath) {
  const breakpoints = [...new Set([...listPngs(beforeDir), ...listPngs(afterDir)])].sort();
  if (breakpoints.length === 0) throw new Error(`No PNG screenshots under ${beforeDir} or ${afterDir}`);

  const html = `<!DOCTYPE html><html><head>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: system-ui, -apple-system, sans-serif; padding: 24px; background: #f5f5f5; }
  h1 { margin-bottom: 24px; }
  .pair { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 32px;
          background: white; padding: 16px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
  .pair h3 { font-size: 14px; color: #666; margin-bottom: 8px; }
  .pair img { width: 100%; border: 1px solid #eee; border-radius: 4px; }
  .breakpoint-label { font-size: 18px; font-weight: 600; margin: 24px 0 12px; color: #333; }
</style></head><body>
<h1>Visual Comparison</h1>
${breakpoints.map(f => {
  const name = f.replace('.png', '');
  const beforePath = path.join(beforeDir, f);
  const afterPath = path.join(afterDir, f);
  const beforeSrc = fs.existsSync(beforePath) ? escapeHtml(htmlPath(outputPath, beforePath)) : '';
  const afterSrc = fs.existsSync(afterPath) ? escapeHtml(htmlPath(outputPath, afterPath)) : '';
  return `<div class="breakpoint-label">${escapeHtml(name)}</div>
<div class="pair">
  <div><h3>Before</h3>${beforeSrc ? `<img src="${beforeSrc}">` : '<p>Missing before screenshot</p>'}</div>
  <div><h3>After</h3>${afterSrc ? `<img src="${afterSrc}">` : '<p>Missing after screenshot</p>'}</div>
</div>`;
}).join('\n')}
</body></html>`;

  fs.writeFileSync(outputPath, html);
}
```

## Pixel-Diff Scoring

```bash
# Install pixelmatch (one-time)
npm install --save-dev --save-exact pixelmatch@7.2.0 pngjs@7.0.0
```

Keep `pixelmatch@7.2.0`. `pixelmatch@8.0.0` (2026-10-06) replaces the colour metric, so its diff counts differ and the 0.5% pass line below has not been re-tuned for it; it is not adopted here (checked 2026-11-21, [release notes](https://github.com/mapbox/pixelmatch/releases/tag/v8.0.0)).

```js
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import fs from 'node:fs';
import path from 'node:path';

function diffScreenshots(beforePath, afterPath, diffPath, threshold = 0.1) {
  const before = PNG.sync.read(fs.readFileSync(beforePath));
  const after = PNG.sync.read(fs.readFileSync(afterPath));

  const width = Math.max(before.width, after.width);
  const height = Math.max(before.height, after.height);

  function padImage(img, w, h) {
    if (img.width === w && img.height === h) return img;
    const padded = new PNG({ width: w, height: h });
    PNG.bitblt(img, padded, 0, 0, img.width, img.height, 0, 0);
    return padded;
  }

  const paddedBefore = padImage(before, width, height);
  const paddedAfter = padImage(after, width, height);
  const diff = new PNG({ width, height });

  const mismatchedPixels = pixelmatch(
    paddedBefore.data, paddedAfter.data, diff.data,
    width, height,
    { threshold }  // 0.1 = strict, 0.3 = lenient (anti-aliasing tolerant)
  );

  fs.writeFileSync(diffPath, PNG.sync.write(diff));

  const totalPixels = width * height;
  const diffPercent = ((mismatchedPixels / totalPixels) * 100).toFixed(2);

  return {
    mismatchedPixels,
    totalPixels,
    diffPercent: parseFloat(diffPercent),
    dimensions: { width, height },
    passed: parseFloat(diffPercent) < 0.5,  // < 0.5% difference = pass
  };
}

// Walks both trees, so the canonical <dir>/<route>/<breakpoint>.png layout and a flat
// directory both work. Keys are '/'-separated paths relative to beforeDir/afterDir.
function diffAllBreakpoints(beforeDir, afterDir, diffDir) {
  const pngs = dir => fs.readdirSync(dir, { recursive: true })
    .map(f => String(f).split(path.sep).join('/'))
    .filter(f => f.endsWith('.png'));
  const files = [...new Set([...pngs(beforeDir), ...pngs(afterDir)])].sort();
  const results = [];

  for (const file of files) {
    const beforePath = path.join(beforeDir, file);
    const afterPath = path.join(afterDir, file);
    const diffPath = path.join(diffDir, path.dirname(file), `diff-${path.basename(file)}`);
    fs.mkdirSync(path.dirname(diffPath), { recursive: true });
    if (!fs.existsSync(beforePath) || !fs.existsSync(afterPath)) {
      results.push({
        breakpoint: file.replace('.png', ''),
        passed: false,
        missing: !fs.existsSync(beforePath) ? 'before' : 'after',
        mismatchedPixels: 0,
        totalPixels: 0,
        diffPercent: 100,
      });
      continue;
    }
    const result = diffScreenshots(beforePath, afterPath, diffPath);
    results.push({ breakpoint: file.replace('.png', ''), ...result });
  }

  // An empty comparison is a failed run, never a pass: wrong directory, or capture did not run.
  const compared = results.filter(r => !r.missing).length;
  if (compared === 0) {
    throw new Error(`Nothing to compare: ${files.length} PNG file(s) found, none present under both ${beforeDir} and ${afterDir}`);
  }

  const report = {
    timestamp: new Date().toISOString(),
    totalBreakpoints: results.length,
    compared,
    passed: results.filter(r => r.passed).length,
    failed: results.filter(r => !r.passed).length,
    results,
  };

  fs.writeFileSync(path.join(diffDir, 'report.json'), JSON.stringify(report, null, 2));
  return report;
}
```

## Enhanced Comparison HTML with Diff Overlay

```js
function generateComparison(beforeDir, afterDir, diffDir, outputPath) {
  // diff-<name>.png sits beside the same relative path under diffDir.
  const diffFiles = listPngs(diffDir)
    .filter(f => path.posix.basename(f).startsWith('diff-'))
    .map(f => path.posix.join(path.posix.dirname(f), path.posix.basename(f).slice(5)));
  const breakpoints = [...new Set([...listPngs(beforeDir), ...listPngs(afterDir), ...diffFiles])].sort();
  if (breakpoints.length === 0) throw new Error(`No PNG screenshots under ${beforeDir} or ${afterDir}`);
  const reportPath = path.join(diffDir, 'report.json');
  const report = fs.existsSync(reportPath) ? JSON.parse(fs.readFileSync(reportPath, 'utf-8')) : null;

  const html = `<!DOCTYPE html><html><head>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: system-ui, -apple-system, sans-serif; padding: 24px; background: #f5f5f5; }
  h1 { margin-bottom: 8px; }
  .summary { margin-bottom: 24px; padding: 16px; background: white; border-radius: 8px;
             box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
  .summary .pass { color: #16a34a; font-weight: 600; }
  .summary .fail { color: #dc2626; font-weight: 600; }
  .triple { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; margin-bottom: 32px;
            background: white; padding: 16px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
  .triple h3 { font-size: 14px; color: #666; margin-bottom: 8px; }
  .triple img { width: 100%; border: 1px solid #eee; border-radius: 4px; }
  .diff-stat { font-size: 12px; padding: 4px 8px; border-radius: 4px; display: inline-block; margin-top: 4px; }
  .diff-stat.pass { background: #dcfce7; color: #166534; }
  .diff-stat.fail { background: #fef2f2; color: #991b1b; }
  .breakpoint-label { font-size: 18px; font-weight: 600; margin: 24px 0 12px; color: #333; }
</style></head><body>
<h1>Visual Regression Report</h1>
${report ? `<div class="summary">
  <p><span class="pass">${escapeHtml(report.passed)} passed</span> · <span class="fail">${escapeHtml(report.failed)} failed</span> · ${escapeHtml(report.totalBreakpoints)} breakpoints</p>
  <p style="font-size:13px;color:#666;margin-top:4px;">Generated ${escapeHtml(report.timestamp)}</p>
</div>` : ''}
${breakpoints.map(f => {
  const name = f.replace('.png', '');
  const result = report?.results?.find(r => r.breakpoint === name);
  const stat = result
    ? `<span class="diff-stat ${result.passed ? 'pass' : 'fail'}">${result.missing ? `missing ${escapeHtml(result.missing)}` : `${escapeHtml(result.diffPercent)}% changed (${escapeHtml(result.mismatchedPixels.toLocaleString())} px)`}</span>`
    : '';
  const beforePath = path.join(beforeDir, f);
  const afterPath = path.join(afterDir, f);
  const diffPath = path.join(diffDir, path.dirname(f), 'diff-' + path.basename(f));
  const beforeSrc = fs.existsSync(beforePath) ? escapeHtml(htmlPath(outputPath, beforePath)) : '';
  const afterSrc = fs.existsSync(afterPath) ? escapeHtml(htmlPath(outputPath, afterPath)) : '';
  const diffSrc = fs.existsSync(diffPath) ? escapeHtml(htmlPath(outputPath, diffPath)) : '';
  return `<div class="breakpoint-label">${escapeHtml(name)} ${stat}</div>
<div class="triple">
  <div><h3>Before</h3>${beforeSrc ? `<img src="${beforeSrc}">` : '<p>Missing before screenshot</p>'}</div>
  <div><h3>After</h3>${afterSrc ? `<img src="${afterSrc}">` : '<p>Missing after screenshot</p>'}</div>
  <div><h3>Diff</h3>${diffSrc ? `<img src="${diffSrc}">` : '<p>No diff image</p>'}</div>
</div>`;
}).join('\n')}
</body></html>`;

  fs.writeFileSync(outputPath, html);
}
```

## Workflow

1. Capture the baseline: run the [canonical screenshot script](playwright-patterns.md#canonical-screenshot-script) with `_screenshots/before` as its argument. It writes `_screenshots/before/<route>/<breakpoint>.png`. If the change is already in the working tree, get the baseline from [Baseline when the change is already made](#baseline-when-the-change-is-already-made) instead.
2. User makes their changes
3. Run the same script, same routes and breakpoints, with `_screenshots/after`
4. Run `diffAllBreakpoints('_screenshots/before', '_screenshots/after', '_screenshots/diff')`. Pass the two top-level directories; it pairs files by relative path and throws when no file exists on both sides.
5. Generate comparison HTML: `generateComparison(beforeDir, afterDir, diffDir, '_screenshots/comparison.html')`

**Done when** all of these hold; otherwise report the comparison as failed or incomplete, not as "no differences":

- `diffAllBreakpoints` returned without throwing and `_screenshots/diff/report.json` exists.
- `report.totalBreakpoints` equals routes × breakpoints and `report.compared` equals it too. A lower `compared` means some results carry `missing: 'before'` or `'after'`; name them.
- `_screenshots/comparison.html` exists.
- The reply states `passed`, `failed`, the pass line used (under 0.5% changed pixels), each failed or missing entry, and the paths of the report and HTML. "0 failed" may be reported only together with a non-zero `compared`.

### Baseline when the change is already made

The "before" state then exists only in version control or on the user's side. Never stash, reset, restore, check out over, or otherwise move the user's uncommitted work to recreate it.

1. **Ask first** whether a baseline already exists: earlier screenshots, a second checkout, or a running copy of the old version on another port. Use it if so.
2. **Otherwise use a separate worktree, with the user's agreement** (it creates a directory, installs dependencies, and starts a second server). `git worktree add --detach <path-outside-the-project> <base-ref>` checks the base out beside the working tree and leaves the working tree untouched. Use `HEAD` as `<base-ref>` when the change is uncommitted, or the commit before the change (for a branch, `git merge-base HEAD <default-branch>`) when it is committed. Install dependencies there, start that copy on a different port, and capture `before` from that port. Capture `after` from the user's running server. Stop the second server and run `git worktree remove <path>` afterwards; remove only the worktree this task created.
3. **If neither is possible** (no git history, the base no longer builds, the user declines), capture `after` only and say that no baseline exists. Do not diff a capture against itself or against an unrelated state.

The two captures differ in port. Keep routes, breakpoints, viewport sizes, and seed data identical, and say which base ref the baseline came from.

## GitHub Actions Visual Regression Workflow

Save as `.github/workflows/visual-regression.yml`. Do not write Playwright `storageState` files under `_screenshots/`; they contain plaintext cookies/localStorage and must not be uploaded as artifacts.

`scripts/capture-screenshots.js` and `scripts/diff-screenshots.mjs` are files the project adds: the first is the [canonical screenshot script](playwright-patterns.md#canonical-screenshot-script) (output directory as its argument), the second calls `diffAllBreakpoints` and `generateComparison` from above. The diff step exits non-zero when nothing was compared; visual differences only raise a warning. Action majors and the Node.js line were checked on 2026-11-21: `actions/checkout` v7, `actions/setup-node` v7, `actions/upload-artifact` v7, `actions/github-script` v9, and Node.js 24 (LTS; Node.js 20 reached end of life on 2026-04-30, and Playwright 1.65 lists 22, 24, or 26). Pin each action to a commit SHA where the repository's policy requires it.

```yaml
name: Visual Regression
on:
  pull_request:
    branches: [main]

permissions:
  contents: read
  pull-requests: write

jobs:
  visual-regression:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/setup-node@v7
        with:
          node-version: 24

      # ── Baseline: capture screenshots from the base branch ──
      - name: Checkout base branch
        uses: actions/checkout@v7
        with:
          ref: ${{ github.event.pull_request.base.sha }}

      - run: npm ci

      - name: Install Playwright browsers (base lockfile)
        run: npm exec -- playwright install --with-deps chromium

      - name: Start dev server (base)
        run: npm run dev &
        env:
          PORT: 3000

      - name: Wait for server (base)
        run: npx wait-on http://localhost:3000 --timeout 30000

      - name: Capture baseline screenshots
        run: node scripts/capture-screenshots.js _screenshots/before

      - name: Stop dev server (base)
        run: kill $(lsof -t -i:3000) || true

      # ── Current: capture screenshots from the PR branch ──
      - name: Checkout PR branch
        uses: actions/checkout@v7
        with:
          clean: false

      - run: npm ci

      - name: Install Playwright browsers (PR lockfile)
        run: npm exec -- playwright install --with-deps chromium

      - name: Start dev server (PR)
        run: npm run dev &
        env:
          PORT: 3000

      - name: Wait for server (PR)
        run: npx wait-on http://localhost:3000 --timeout 30000

      - name: Capture current screenshots
        run: node scripts/capture-screenshots.js _screenshots/after

      # ── Diff and report ──
      - name: Run pixel diff
        run: node scripts/diff-screenshots.mjs

      - name: Check results
        run: |
          if [ ! -f _screenshots/diff/report.json ]; then
            echo "::warning::Visual regression report was not generated"
            exit 0
          fi
          FAILED=$(node -e "const r=require('./_screenshots/diff/report.json'); console.log(r.failed)")
          if [ "$FAILED" -gt 0 ]; then
            echo "::warning::$FAILED breakpoints have visual differences > 0.5%"
          fi

      - name: Upload artifacts
        if: always()
        uses: actions/upload-artifact@v7
        with:
          name: visual-regression-report
          path: _screenshots/
          retention-days: 14

      - name: Comment on PR
        if: always()
        uses: actions/github-script@v9
        with:
          script: |
            const fs = require('fs');
            const reportPath = '_screenshots/diff/report.json';
            if (!fs.existsSync(reportPath)) {
              core.warning('Visual regression report was not generated; skipping PR comment.');
              return;
            }
            const report = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));
            const body = `### Visual Regression Results\n\n` +
              `**${report.passed}** passed · **${report.failed}** failed · ${report.totalBreakpoints} breakpoints\n\n` +
              report.results.map(r =>
                `| ${r.breakpoint} | ${r.passed ? '✅' : '❌'} | ${r.diffPercent}% |`
              ).join('\n') +
              `\n\nDownload the full report from the workflow artifacts.`;
            github.rest.issues.createComment({
              owner: context.repo.owner,
              repo: context.repo.repo,
              issue_number: context.issue.number,
              body,
            });
```
