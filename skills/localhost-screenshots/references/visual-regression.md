# Visual Regression — Full Reference

## Prefer Playwright Test screenshot assertions when available

When the project already uses the Playwright test runner, prefer native screenshot assertions before custom pixel-diff scripts. Playwright waits until screenshots stabilize, supports page and locator baselines, and exposes masking and diff thresholds in assertion options.

```js
import { test, expect } from '@playwright/test';
// gotoLocal comes from the skill's assets/scripts/local-guard.js (createRequire, or a copy in the repo); see playwright-patterns.md § Local Navigation Guard.

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

Use `compare.js` below when the task is an ad hoc before/after review, when the repository does not use Playwright Test, or when the user needs a standalone HTML comparison artifact.

## Comparison Script

The standard path for before/after work. It pairs PNG files by their path relative to the two directories, so it reads the `<dir>/<route>/<breakpoint>.png` layout `capture.js` writes as well as a flat directory.

```bash
node "<skill-dir>/assets/scripts/compare.js" --before _screenshots/before --after _screenshots/after --out _screenshots/diff
```

| Option | Meaning |
|---|---|
| `--before DIR`, `--after DIR` | The two capture directories. Required. Pass the top-level directories, not one route. When `capture.json` is present, only files listed as successful in that completed run are considered. A prior PNG left by a failed rerun cannot stand in for the current result. |
| `--out DIR` | Where the diff images and reports go. Required; must not be inside `--before` or `--after`. Nothing is written elsewhere |
| `--threshold N` | Per-pixel colour sensitivity, 0 to 1; smaller is stricter. Default `0.05` |
| `--max-diff-pixels N` | Differing pixels allowed in a pair before it counts as different. Default `0` |
| `--max-diff-percent P` | The same allowance as a percentage of the pair's pixels. Not with `--max-diff-pixels` |
| `--window-size N` | Count the densest N×N square of differing pixels instead of the whole image; use with `--max-diff-pixels` |
| `--include-aa` | Count anti-aliased pixels too (by default pixelmatch detects and skips them) |
| `--json` | Print the full report as JSON instead of text |

| Exit code | Meaning |
|---|---|
| 0 | Every expected pair was compared and is within the allowance |
| 1 | A complete comparison found visual differences or a size change. The CI example reports these as warnings. |
| 2 | The run is incomplete or could not run. This includes a failed capture, a missing or unreadable image, no readable pairs, a capture still in progress, invalid run metadata, bad arguments, or a missing dependency or directory. CI must fail this result. |

What it writes into `--out`:

- `report.json` — `totals` (`pairs`, `compared`, `same`, `different`, `sizeChanged`, `missing`, `unreadable`, `captureFailed`, `routeMismatches`), the options and pixelmatch version used, and one entry per pair with `status`, `diffPixels`, `diffPercent`, both sizes, and file paths. `capture-failed-before`, `capture-failed-after`, and `route-mismatch` identify incomplete capture sets.
- `report.html` — before, after, and diff image for every pair, differing pairs first and open, matching pairs collapsed. It is a single offline file: inline CSS, no scripts, no remote resources, and every file name HTML-escaped. Images are linked by relative path, so keep the three directories together.
- `<route>/diff-<breakpoint>.png` — one diff image for each pair with any differing pixel.

Per-pair statuses: `same`, `different`, `size-changed` (the two images have different dimensions; they are compared on a canvas padded to the larger size and always count as a difference), `missing-before`, `missing-after`, `unreadable`, `capture-failed-before`, `capture-failed-after`, `route-mismatch`.

When a directory has `capture.json`, the comparator validates that its declared routes, breakpoints, counts, and result records agree. It reads only each successful result's path relative to the capture directory and ignores any unlisted PNGs from older runs. A failed result never falls back to a stale file at the same path. Complete manifests can move with their capture directories. Legacy manifests that only contain invocation-relative or absolute `file` paths are mapped from their route and breakpoint fields, so moving the set does not make those old paths authoritative. Directories without manifests retain recursive PNG pairing. A comparison may mix a manifest-backed set with a standalone PNG directory, using relative PNG paths to pair them.

The comparison itself is one `pixelmatch` call per pair:

```js
const diffPixels = pixelmatch(before.data, after.data, diff.data, width, height, { threshold: 0.05 });
const status = sizeChanged ? 'size-changed' : diffPixels > allowed ? 'different' : 'same';
```

### Dependencies

```bash
npm install --save-dev --save-exact pixelmatch@8.0.0 pngjs@7.0.0
```

`compare.js` resolves both from the current project first, then from beside the script, and stops with exit 2 when it finds neither or only pixelmatch 7 or earlier. `pixelmatch@8.0.0` (2026-10-06) replaced the YIQ colour metric used since 2015 with OKLab/HyAB distance, so **diff counts differ from 7.x** and a threshold tuned on 7.x must be re-checked ([release notes](https://github.com/mapbox/pixelmatch/releases/tag/v8.0.0)). The call signature and the `threshold` scale are unchanged; 8.0.0 adds `windowSize` and `ignoreMask`.

### How the defaults were chosen

Measured on 2026-11-21, not carried over from 7.x. Method: one realistic fixture page (header, gradient hero, six cards with shadows and inline SVG, a table) served locally in several variants; each captured with `capture.js` (Playwright 1.65.1, headless Chrome 158, macOS) at 375, 1280, and 1920 px wide, full page; each variant compared with the unchanged baseline. Figures are differing pixels at 1280 px (1,524,480 pixels); the other two widths gave the same pattern, except that the status dot is not rendered at 375 px and scored 0 there.

| Variant against the baseline | pixelmatch 8.0.0 `threshold` 0.05 | 8.0.0 at 0.1 | 7.2.0 at 0.1 | Densest 16×16 square, 8.0.0 at 0.1 |
|---|---:|---:|---:|---:|
| Unchanged page, captured again (5 runs) | 0 | 0 | 0 | 0 |
| Font smoothing switched (`-webkit-font-smoothing: antialiased`) | 12,873 | 4,755 | 3,538 | 40 |
| All content shifted 0.4 px sideways | 14,835 | 11,925 | 11,524 | 95 |
| Status dot recoloured (10 px circle) | 60 | 60 | 60 | 60 |
| One word changed in a button label | 376 | 351 | 345 | 86 |
| Button background one palette step darker (`#2563eb` → `#1d4ed8`) | 4,513 | 0 | 0 | 0 |
| Card border one palette step darker (`#e2e8f0` → `#cbd5e1`) | 3,984 | 0 | 0 | 0 |
| Hero restyled (page 66 px taller) | 528,276 | 498,839 | 498,925 | 256 |

What the numbers decided:

- **Allowance 0 pixels.** Two captures of an unchanged page on the same machine and browser were pixel-identical in every run, down to `threshold` 0.01. Same-machine before/after work has no noise to forgive, so any differing pixel is reported.
- **`threshold` 0.05, not pixelmatch's 0.1.** At 0.1 a one-step colour change to a button or a border produced zero differing pixels; at 0.05 the whole button (4,513 px) and every border (3,984 px) registered. Smaller colour changes still fall below it: `#2563eb` → `#2a67ec` registered only at 0.01, and a one-to-two-unit-per-channel change (`#2462e9`) at no threshold tried. Lower `--threshold` when a change that subtle matters.
- **A percentage line does not separate noise from change.** Applied to the 0.05 counts, the earlier "under 0.5% of pixels is a pass" rule passes the changed word (0.02%), the recoloured dot (0.004%), and the darker button at 1280 px (0.30%), and fails the same button at 375 px (0.56%). `--max-diff-percent` exists for callers who want it; it is not the default.
- **Rendering-level differences are larger than small real changes.** A font-smoothing switch changed more pixels (4,755 at 0.1) than a changed word (351) or dot (60). No total count tells them apart. When the two captures come from different machines or browser builds, expect such differences and do not raise `--max-diff-pixels` blindly.
- **`--window-size` is the option for that case, with thin margins.** Counting the densest 16×16 square at `threshold` 0.1, font smoothing scored 40 while the recoloured dot scored 60 and the changed word 86, so `--threshold 0.1 --window-size 16 --max-diff-pixels 50` passed the first and flagged the others on this fixture. The 0.4 px shift scored 95 and is flagged too. These margins come from one page; measure on the project's own pages before relying on them. Note that a window count at 0.1 cannot see the one-step colour changes.
- **`ignoreMask` is not used.** It needs a per-image mask of regions to skip, which a directory comparison has no source for. Hide or freeze dynamic regions before capture instead, or use Playwright Test's `mask` option above.
- **7.x and 8.0.0 disagree most on low-contrast differences**: 3,538 against 4,755 pixels for font smoothing at 0.1, and within 4% of each other on the other rows.

## Workflow

1. Capture the baseline: `capture.js --base-url <url> --out _screenshots/before` ([options](playwright-patterns.md#systematic-capture-script)). If the change is already in the working tree, get the baseline from [Baseline when the change is already made](#baseline-when-the-change-is-already-made) instead.
2. User makes their changes
3. Capture again with the same routes and breakpoints: `--out _screenshots/after`
4. Run `compare.js --before _screenshots/before --after _screenshots/after --out _screenshots/diff`
5. Open or hand over `_screenshots/diff/report.html`

**Done when** all of these hold; otherwise report the comparison as failed or incomplete, not as "no differences":

- `compare.js` exited 0 or 1 and `_screenshots/diff/report.json` exists. Exit 1 means the comparison completed and found a visual difference. Exit 2 means the result is incomplete or comparison setup failed.
- `totals.pairs` and `totals.compared` both equal routes × breakpoints. If fewer pairs were compared, name each incomplete pair and its reported cause, including capture failures and route mismatches.
- `_screenshots/diff/report.html` exists.
- The reply states the `same`, `different`, `sizeChanged`, and `missing` counts, the threshold and allowance used, each differing or missing entry, where the baseline came from, and the paths of the report files. "No differences" may be reported only together with a non-zero `compared`.

### Baseline when the change is already made

The "before" state then exists only in version control or on the user's side. Never stash, reset, restore, check out over, or otherwise move the user's uncommitted work to recreate it.

1. **Ask first** whether a baseline already exists: earlier screenshots, a second checkout, or a running copy of the old version on another port. Use it if so.
2. **Otherwise use a separate worktree, with the user's agreement** (it creates a directory, installs dependencies, and starts a second server). `git worktree add --detach <path-outside-the-project> <base-ref>` checks the base out beside the working tree and leaves the working tree untouched. Use `HEAD` as `<base-ref>` when the change is uncommitted, or the commit before the change (for a branch, `git merge-base HEAD <default-branch>`) when it is committed. Install dependencies there, start that copy on a different port, and capture `before` from that port. Capture `after` from the user's running server. Stop the second server and run `git worktree remove <path>` afterwards; remove only the worktree this task created.
3. **If neither is possible** (no git history, the base no longer builds, the user declines), capture `after` only and say that no baseline exists. Do not diff a capture against itself or against an unrelated state.

The two captures differ in port. Keep routes, breakpoints, viewport sizes, and seed data identical, and say which base ref the baseline came from.

## GitHub Actions Visual Regression Workflow

Save as `.github/workflows/visual-regression.yml`. Do not write Playwright `storageState` files under `_screenshots/`; they contain plaintext cookies/localStorage and must not be uploaded as artifacts.

Copy the skill's whole `assets/scripts/` folder into the repository as `scripts/visual/` (the scripts require `local-guard.js` from their own folder), and add `playwright`, `pixelmatch`, and `pngjs` at the pinned versions to the project's dev dependencies. Both branches need them: on the pull request that introduces the setup the baseline steps have nothing to run, so merge the setup first. The compare step warns on visual differences (exit 1) and fails the job on incomplete comparisons or setup errors (exit 2). Action majors and the Node.js line were checked on 2026-11-21: `actions/checkout` v7, `actions/setup-node` v7, `actions/upload-artifact` v7, `actions/github-script` v9, and Node.js 24 (LTS; Node.js 20 reached end of life on 2026-04-30, and Playwright 1.65 lists 22, 24, or 26). Pin each action to a commit SHA where the repository's policy requires it.

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
        run: node scripts/visual/capture.js --base-url http://localhost:3000 --out _screenshots/before

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
        run: node scripts/visual/capture.js --base-url http://localhost:3000 --out _screenshots/after

      # ── Diff and report ──
      - name: Compare
        run: |
          set +e
          node scripts/visual/compare.js --before _screenshots/before --after _screenshots/after --out _screenshots/diff
          code=$?
          if [ "$code" -eq 1 ]; then
            echo "::warning::Visual differences found; see the visual-regression-report artifact"
            exit 0
          fi
          # Exit 2 means the capture/comparison was incomplete and must fail CI.
          exit "$code"

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
            const t = report.totals;
            const body = `### Visual Regression Results\n\n` +
              `**${t.same}** same · **${t.different + t.sizeChanged}** different · **${t.missing}** missing · ${t.compared} of ${t.pairs} compared\n\n` +
              `| Capture | Status | Changed |\n|---|---|---|\n` +
              report.results.map(r =>
                `| ${r.name} | ${r.status} | ${r.diffPercent ?? '–'}${r.diffPercent === undefined ? '' : '%'} |`
              ).join('\n') +
              `\n\nDownload the full report from the workflow artifacts.`;
            github.rest.issues.createComment({
              owner: context.repo.owner,
              repo: context.repo.repo,
              issue_number: context.issue.number,
              body,
            });
```
