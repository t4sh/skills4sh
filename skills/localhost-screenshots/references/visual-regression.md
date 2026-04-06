# Visual Regression — Full Reference

## Before/After Comparison HTML

```js
const fs = require('fs');
const path = require('path');

function generateComparison(beforeDir, afterDir, outputPath) {
  const breakpoints = fs.readdirSync(beforeDir).filter(f => f.endsWith('.png')).sort();

  const html = `<!DOCTYPE html><html><head>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: system-ui, -apple-system, sans-serif; padding: 24px; background: #f5f5f5; }
  h1 { margin-bottom: 24px; }
  .controls { position: sticky; top: 0; background: #f5f5f5; padding: 12px 0; z-index: 10;
              display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 16px; border-bottom: 1px solid #ddd; }
  .controls button { padding: 6px 14px; border: 1px solid #ccc; border-radius: 4px;
                     background: white; cursor: pointer; font-size: 13px; }
  .controls button.active { background: #333; color: white; border-color: #333; }
  .pair { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 32px;
          background: white; padding: 16px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
  .pair h3 { font-size: 14px; color: #666; margin-bottom: 8px; }
  .pair img { width: 100%; border: 1px solid #eee; border-radius: 4px; }
  .breakpoint-label { font-size: 18px; font-weight: 600; margin: 24px 0 12px; color: #333; }
</style></head><body>
<h1>Visual Comparison</h1>
${breakpoints.map(f => {
  const name = f.replace('.png', '');
  return `<div class="breakpoint-label">${name}</div>
<div class="pair">
  <div><h3>Before</h3><img src="${path.relative(path.dirname(outputPath), path.join(beforeDir, f))}"></div>
  <div><h3>After</h3><img src="${path.relative(path.dirname(outputPath), path.join(afterDir, f))}"></div>
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
  const files = fs.readdirSync(beforeDir).filter(f => f.endsWith('.png'));
  const results = [];

  for (const file of files) {
    const result = diffScreenshots(
      path.join(beforeDir, file),
      path.join(afterDir, file),
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
  const breakpoints = fs.readdirSync(beforeDir).filter(f => f.endsWith('.png')).sort();
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
  .controls { position: sticky; top: 0; background: #f5f5f5; padding: 12px 0; z-index: 10;
              display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 16px; border-bottom: 1px solid #ddd; }
  .controls button { padding: 6px 14px; border: 1px solid #ccc; border-radius: 4px;
                     background: white; cursor: pointer; font-size: 13px; }
  .controls button.active { background: #333; color: white; border-color: #333; }
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
  <p><span class="pass">${report.passed} passed</span> · <span class="fail">${report.failed} failed</span> · ${report.totalBreakpoints} breakpoints</p>
  <p style="font-size:13px;color:#666;margin-top:4px;">Generated ${report.timestamp}</p>
</div>` : ''}
${breakpoints.map(f => {
  const name = f.replace('.png', '');
  const result = report?.results?.find(r => r.breakpoint === name);
  const stat = result
    ? `<span class="diff-stat ${result.passed ? 'pass' : 'fail'}">${result.diffPercent}% changed (${result.mismatchedPixels.toLocaleString()} px)</span>`
    : '';
  return `<div class="breakpoint-label">${name} ${stat}</div>
<div class="triple">
  <div><h3>Before</h3><img src="${path.relative(path.dirname(outputPath), path.join(beforeDir, f))}"></div>
  <div><h3>After</h3><img src="${path.relative(path.dirname(outputPath), path.join(afterDir, f))}"></div>
  <div><h3>Diff</h3><img src="${path.relative(path.dirname(outputPath), path.join(diffDir, 'diff-' + f))}"></div>
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

Save as `.github/workflows/visual-regression.yml`:

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

      - name: Install Playwright
        run: npx playwright install --with-deps chromium

      # ── Baseline: capture screenshots from the base branch ──
      - name: Checkout base branch
        uses: actions/checkout@v4
        with:
          ref: ${{ github.event.pull_request.base.sha }}

      - run: npm ci

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
            const report = JSON.parse(fs.readFileSync('_screenshots/diff/report.json', 'utf-8'));
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
