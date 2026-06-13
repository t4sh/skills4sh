# Visual Regression — Full Reference

## Prefer Playwright Test screenshot assertions when available

When the project already uses the Playwright test runner, prefer native screenshot assertions before custom pixel-diff scripts. Playwright waits until screenshots stabilize, supports page and locator baselines, and exposes masking and diff thresholds in assertion options.

```js
import { test, expect } from '@playwright/test';

test('homepage visual baseline', async ({ page }) => {
  await page.goto('http://localhost:3000/', { waitUntil: 'load' });
  await expect(page).toHaveScreenshot('homepage.png', {
    animations: 'disabled',
    maxDiffPixelRatio: 0.01,
  });
});

test('hero visual baseline', async ({ page }) => {
  await page.goto('http://localhost:3000/', { waitUntil: 'load' });
  await expect(page.locator('.hero')).toHaveScreenshot('hero.png', {
    mask: [page.locator('[data-dynamic]')],
  });
});
```

Use the custom comparison and `pixelmatch` sections below when the task is an ad hoc before/after review, when the repository does not use Playwright Test, or when the user needs a standalone HTML comparison artifact.

## Before/After Comparison HTML

```js
const fs = require('fs');
const path = require('path');

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

function generateSideBySideComparison(beforeDir, afterDir, outputPath) {
  const beforeFiles = fs.readdirSync(beforeDir).filter(f => f.endsWith('.png'));
  const afterFiles = fs.readdirSync(afterDir).filter(f => f.endsWith('.png'));
  const breakpoints = [...new Set([...beforeFiles, ...afterFiles])].sort();

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
npm install pixelmatch pngjs
```

```js
const { PNG } = require('pngjs');
const pixelmatch = require('pixelmatch');
const fs = require('fs');
const path = require('path');

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

function diffAllBreakpoints(beforeDir, afterDir, diffDir) {
  fs.mkdirSync(diffDir, { recursive: true });
  const beforeFiles = fs.readdirSync(beforeDir).filter(f => f.endsWith('.png'));
  const afterFiles = fs.readdirSync(afterDir).filter(f => f.endsWith('.png'));
  const files = [...new Set([...beforeFiles, ...afterFiles])].sort();
  const results = [];

  for (const file of files) {
    const beforePath = path.join(beforeDir, file);
    const afterPath = path.join(afterDir, file);
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
    const result = diffScreenshots(
      beforePath,
      afterPath,
      path.join(diffDir, `diff-${file}`)
    );
    results.push({ breakpoint: file.replace('.png', ''), ...result });
  }

  const report = {
    timestamp: new Date().toISOString(),
    totalBreakpoints: results.length,
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
  const beforeFiles = fs.readdirSync(beforeDir).filter(f => f.endsWith('.png'));
  const afterFiles = fs.readdirSync(afterDir).filter(f => f.endsWith('.png'));
  const diffFiles = fs.existsSync(diffDir) ? fs.readdirSync(diffDir).filter(f => f.startsWith('diff-') && f.endsWith('.png')).map(f => f.slice(5)) : [];
  const breakpoints = [...new Set([...beforeFiles, ...afterFiles, ...diffFiles])].sort();
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
  const diffPath = path.join(diffDir, 'diff-' + f);
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

1. Run the canonical screenshot script, saving to `_screenshots/before/`
2. User makes their changes
3. Run the same script again, saving to `_screenshots/after/`
4. Run `diffAllBreakpoints('_screenshots/before', '_screenshots/after', '_screenshots/diff')`
5. Generate comparison HTML: `generateComparison(beforeDir, afterDir, diffDir, '_screenshots/comparison.html')`

## GitHub Actions Visual Regression Workflow

Save as `.github/workflows/visual-regression.yml`. Do not write Playwright `storageState` files under `_screenshots/`; they contain plaintext cookies/localStorage and must not be uploaded as artifacts.

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
      - uses: actions/setup-node@v4
        with:
          node-version: 20

      # ── Baseline: capture screenshots from the base branch ──
      - name: Checkout base branch
        uses: actions/checkout@v4
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
        run: node scripts/capture-screenshots.js --output _screenshots/before

      - name: Stop dev server (base)
        run: kill $(lsof -t -i:3000) || true

      # ── Current: capture screenshots from the PR branch ──
      - name: Checkout PR branch
        uses: actions/checkout@v4
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
        run: node scripts/capture-screenshots.js --output _screenshots/after

      # ── Diff and report ──
      - name: Run pixel diff
        run: node scripts/diff-screenshots.js

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
        uses: actions/upload-artifact@v4
        with:
          name: visual-regression-report
          path: _screenshots/
          retention-days: 14

      - name: Comment on PR
        if: always()
        uses: actions/github-script@v7
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
