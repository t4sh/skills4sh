import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

// Runs the bundled compare.js for real against PNG files written with pngjs. The script
// resolves pixelmatch and pngjs from its working directory first, so every run uses the
// pinned copies installed in tests/fixtures/visual.
const fixtureProject = resolve('tests/fixtures/visual');
const require = createRequire(join(fixtureProject, 'package.json'));
const { PNG } = require('pngjs');
const scriptsDir = resolve('skills/localhost-screenshots/assets/scripts');
const compareScript = join(scriptsDir, 'compare.js');
const reference = readFileSync('skills/localhost-screenshots/references/visual-regression.md', 'utf8');

const WHITE = [255, 255, 255]; const BLACK = [0, 0, 0];

// A width x height image filled with one colour, with optional [x, y, w, h, colour] blocks.
function png(dir, name, { width = 40, height = 40, fill = WHITE, blocks = [] } = {}) {
  const image = new PNG({ width, height });
  const paint = (x0, y0, w, h, [r, g, b]) => {
    for (let y = y0; y < y0 + h; y += 1) {
      for (let x = x0; x < x0 + w; x += 1) {
        const i = (y * width + x) * 4;
        image.data[i] = r; image.data[i + 1] = g; image.data[i + 2] = b; image.data[i + 3] = 255;
      }
    }
  };
  paint(0, 0, width, height, fill);
  for (const block of blocks) paint(...block);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${name}.png`), PNG.sync.write(image));
}

function tree(dir) {
  return existsSync(dir) ? readdirSync(dir, { recursive: true }).map(f => String(f).split('\\').join('/')).sort() : [];
}

function compare(args, { cwd = fixtureProject, script = compareScript } = {}) {
  const env = { ...process.env }; delete env.NODE_PATH;
  return spawnSync(process.execPath, [script, ...args], { cwd, encoding: 'utf8', env });
}

function workspace(prefix) {
  const root = mkdtempSync(join(tmpdir(), prefix));
  return { root, before: join(root, 'shots', 'before'), after: join(root, 'shots', 'after'), out: join(root, 'shots', 'diff') };
}

function captureManifest(dir, { ok = true, file = 'home/desktop-800x600.png', out = dir } = {}) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'capture.json'), JSON.stringify({
    out,
    routes: ['/'],
    breakpoints: ['desktop:800x600'],
    expected: 1,
    saved: ok ? 1 : 0,
    failed: ok ? 0 : 1,
    results: [{ route: '/', breakpoint: 'desktop', width: 800, height: 600, file, ok, error: ok ? undefined : 'route failed' }],
  }));
}

test('compare.js uses the pinned pixelmatch 8 from the fixture project', () => {
  assert.equal(require('pixelmatch/package.json').version, '8.0.0');
  assert.equal(require('pngjs/package.json').version, '7.0.0');
  assert.match(reference, /npm install --save-dev --save-exact pixelmatch@8\.0\.0 pngjs@7\.0\.0/);
  assert.match(readFileSync(compareScript, 'utf8'), /const PINNED = 'pixelmatch@8\.0\.0 pngjs@7\.0\.0';/);
});

test('compare.js reports same, different, resized, missing and unreadable pairs and exits 2', () => {
  const { root, before, after, out } = workspace('compare-mixed-');
  try {
    for (const dir of [before, after]) png(dir, 'equal');
    png(before, 'changed'); png(after, 'changed', { fill: BLACK });
    png(before, 'resized', { fill: BLACK }); png(after, 'resized', { fill: BLACK, width: 60 });
    png(before, 'only-before'); png(after, 'only-after');
    png(before, 'quoted"<name>&'); png(after, 'quoted"<name>&', { fill: BLACK });
    png(before, 'broken'); writeFileSync(join(after, 'broken.png'), 'not a png');
    const untouched = [tree(before), tree(after)];

    const result = compare(['--before', before, '--after', after, '--out', out, '--json']);
    assert.equal(result.status, 2, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.deepEqual(report.totals, { pairs: 7, compared: 4, same: 1, different: 2, sizeChanged: 1, missing: 2, unreadable: 1, captureFailed: 0, routeMismatches: 0 });
    assert.equal(report.pixelmatch, '8.0.0');
    assert.deepEqual(report.options, { threshold: 0.05, allowance: '0 px', includeAA: false });
    const by = Object.fromEntries(report.results.map(r => [r.name, r]));
    assert.equal(by.equal.status, 'same'); assert.equal(by.equal.diffPixels, 0); assert.equal(by.equal.diffFile, null);
    assert.equal(by.changed.status, 'different'); assert.equal(by.changed.diffPixels, 1600); assert.equal(by.changed.diffPercent, 100);
    assert.equal(by.resized.status, 'size-changed');
    assert.deepEqual([by.resized.before, by.resized.after], [{ width: 40, height: 40 }, { width: 60, height: 40 }]);
    assert.equal(by.resized.diffPixels, 800);
    assert.equal(by['only-before'].status, 'missing-after'); assert.equal(by['only-after'].status, 'missing-before');
    assert.equal(by.broken.status, 'unreadable'); assert.match(by.broken.error, /^not a readable PNG/);
    assert.deepEqual(JSON.parse(readFileSync(join(out, 'report.json'), 'utf8')).totals, report.totals);

    // Writes land in --out only; the inputs and their parent are otherwise untouched.
    assert.deepEqual([tree(before), tree(after)], untouched);
    assert.deepEqual(readdirSync(join(root, 'shots')).sort(), ['after', 'before', 'diff']);
    assert.deepEqual(readdirSync(root), ['shots']);
    assert.deepEqual(tree(out), ['diff-changed.png', 'diff-quoted"<name>&.png', 'diff-resized.png', 'report.html', 'report.json']);
    const diff = PNG.sync.read(readFileSync(join(out, 'diff-resized.png')));
    assert.deepEqual([diff.width, diff.height], [60, 40]);

    // The HTML report is one offline file: nothing remote, nothing executable, names escaped.
    const html = readFileSync(join(out, 'report.html'), 'utf8');
    assert.doesNotMatch(html, /https?:|\/\/[a-z]|<script|<link|<iframe|@import|url\(|\son[a-z]+=/i);
    assert.match(html, /quoted&quot;&lt;name&gt;&amp;/);
    assert.doesNotMatch(html, /quoted"<name>/);
    assert.match(html, /src="\.\.\/before\/quoted%22%3Cname%3E%26\.png"/);
    assert.match(html, /src="\.\.\/before\/equal\.png"/); assert.match(html, /src="\.\.\/after\/changed\.png"/);
    assert.match(html, /src="diff-changed\.png"/);
    assert.match(html, /6 of 7 incomplete or different/);
    assert.equal((html.match(/<details open>/g) ?? []).length, 6);
    assert.equal((html.match(/<details>/g) ?? []).length, 1);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

// capture.js writes <out>/<route>/<breakpoint>.png. The 3.5.0 comparison read only the top
// level of each directory and reported 0 compared, 0 failed for this layout.
test('compare.js pairs the nested route/breakpoint layout and prints a text summary', () => {
  const { root, before, after, out } = workspace('compare-nested-');
  try {
    for (const dir of [before, after]) {
      png(join(dir, 'home'), 'mobile-375x812');
      png(join(dir, 'about'), 'mobile-375x812');
    }
    png(join(before, 'home'), 'desktop-1280x800'); png(join(after, 'home'), 'desktop-1280x800', { blocks: [[5, 5, 10, 10, BLACK]] });
    png(join(before, 'about'), 'desktop-1280x800');
    const result = compare(['--before', before, '--after', after, '--out', out]);
    assert.equal(result.status, 2, result.stderr);
    assert.match(result.stdout, /^only in before +about\/desktop-1280x800 {2}only in before$/m);
    assert.match(result.stdout, /^same +about\/mobile-375x812 {2}0 px \(0%\)$/m);
    assert.match(result.stdout, /^different +home\/desktop-1280x800 {2}100 px \(6\.25%\)$/m);
    assert.match(result.stdout, /^1 of 4 differ \(3 compared: 2 same, 1 different, 0 size changed; 1 on one side only; 0 unreadable; 0 capture failed; 0 route mismatch\)$/m);
    assert.deepEqual(tree(out), ['home', 'home/diff-desktop-1280x800.png', 'report.html', 'report.json']);
    const html = readFileSync(join(out, 'report.html'), 'utf8');
    assert.match(html, /src="\.\.\/before\/home\/desktop-1280x800\.png"/);
    assert.match(html, /src="home\/diff-desktop-1280x800\.png"/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('compare.js exits 0 only when every pair was compared and matches', () => {
  const { root, before, after, out } = workspace('compare-same-');
  try {
    for (const dir of [before, after]) { png(join(dir, 'home'), 'a'); png(join(dir, 'home'), 'b', { fill: BLACK }); }
    const result = compare(['--before', before, '--after', after, '--out', out]);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /^0 of 2 differ \(2 compared: 2 same/m);
    assert.deepEqual(tree(out), ['report.html', 'report.json']);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('compare.js exits 2 with a clear message when no image exists on both sides', () => {
  const { root, before, after, out } = workspace('compare-empty-');
  try {
    mkdirSync(before, { recursive: true }); mkdirSync(after, { recursive: true });
    const empty = compare(['--before', before, '--after', after, '--out', out]);
    assert.equal(empty.status, 2);
    assert.match(empty.stderr, /^Nothing to compare: 0 PNG file\(s\) found/);
    // Directories at different depths share no relative path: every file is unpaired.
    png(join(before, 'home'), 'mobile-375x812'); png(after, 'mobile-375x812');
    const unpaired = compare(['--before', before, '--after', after, '--out', out, '--json']);
    assert.equal(unpaired.status, 2);
    assert.match(unpaired.stderr, /^Nothing to compare: 2 PNG file\(s\) found, none present under both/);
    assert.equal(unpaired.stdout, '');
    assert.equal(existsSync(out), false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('unreadable PNGs on both sides produce an incomplete report with no compared pairs', () => {
  const { root, before, after, out } = workspace('compare-corrupt-');
  try {
    for (const dir of [before, after]) {
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, 'page.png'), 'truncated image');
    }
    const result = compare(['--before', before, '--after', after, '--out', out, '--json']);
    assert.equal(result.status, 2, result.stderr);
    const { totals } = JSON.parse(result.stdout);
    assert.equal(totals.compared, 0);
    assert.equal(totals.unreadable, 1);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('capture manifests ignore stale PNGs and resolve moved runs by relative capture path', () => {
  const { root, before, after, out } = workspace('compare-manifest-moved-');
  try {
    png(join(before, 'home'), 'desktop-800x600');
    png(join(after, 'home'), 'desktop-800x600');
    png(join(after, 'stale'), 'desktop-800x600', { fill: BLACK });
    captureManifest(after);
    const mixed = compare(['--before', before, '--after', after, '--out', out, '--json']);
    assert.equal(mixed.status, 0, mixed.stderr);
    assert.equal(JSON.parse(mixed.stdout).totals.same, 1);
    captureManifest(before);
    const moved = join(root, 'moved');
    mkdirSync(moved);
    symlinkSync(join(fixtureProject, 'node_modules'), join(moved, 'node_modules'));
    const result = compare(['--before', before, '--after', after, '--out', out, '--json'], { cwd: moved });
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.totals.pairs, 1);
    assert.equal(report.totals.same, 1);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('different requested routes that sanitize to one directory are incomplete', () => {
  const { root, before, after, out } = workspace('compare-manifest-route-mismatch-');
  try {
    png(join(before, 'home'), 'desktop-800x600');
    png(join(after, 'home'), 'desktop-800x600');
    writeFileSync(join(before, 'capture.json'), JSON.stringify({
      routes: ['/'], breakpoints: ['desktop:800x600'], expected: 1,
      results: [{ route: '/', breakpoint: 'desktop', width: 800, height: 600, file: 'old/home/desktop-800x600.png', relativeFile: 'home/desktop-800x600.png', ok: true }],
    }));
    writeFileSync(join(after, 'capture.json'), JSON.stringify({
      routes: ['/home'], breakpoints: ['desktop:800x600'], expected: 1,
      results: [{ route: '/home', breakpoint: 'desktop', width: 800, height: 600, file: 'new/home/desktop-800x600.png', relativeFile: 'home/desktop-800x600.png', ok: true }],
    }));
    const result = compare(['--before', before, '--after', after, '--out', out, '--json']);
    assert.equal(result.status, 2, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.totals.routeMismatches, 1);
    assert.equal(report.results[0].status, 'route-mismatch');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('a failed rerun never compares its stale screenshot and makes the run incomplete', () => {
  const { root, before, after, out } = workspace('compare-manifest-stale-');
  try {
    png(join(before, 'home'), 'desktop-800x600');
    png(join(after, 'home'), 'desktop-800x600');
    captureManifest(before);
    captureManifest(after, { ok: false });
    const result = compare(['--before', before, '--after', after, '--out', out, '--json']);
    assert.equal(result.status, 2, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.totals.compared, 0);
    assert.equal(report.totals.captureFailed, 1);
    assert.equal(report.results[0].status, 'capture-failed-after');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('incomplete or unreadable manifests cannot produce a successful comparison', () => {
  const { root, before, after, out } = workspace('compare-manifest-incomplete-');
  try {
    captureManifest(before);
    captureManifest(after);
    const missing = compare(['--before', before, '--after', after, '--out', out, '--json']);
    assert.equal(missing.status, 2, missing.stderr);
    assert.equal(JSON.parse(missing.stdout).totals.unreadable, 1);

    writeFileSync(join(before, 'capture.json'), '{');
    const malformed = compare(['--before', before, '--after', after, '--out', join(root, 'bad')]);
    assert.equal(malformed.status, 2);
    assert.match(malformed.stderr, /Invalid capture manifest/);

    writeFileSync(join(before, 'capture.json'), JSON.stringify({ routes: ['/'], breakpoints: ['desktop:800x600'], expected: 1, results: [] }));
    const countMismatch = compare(['--before', before, '--after', after, '--out', join(root, 'bad-count')]);
    assert.equal(countMismatch.status, 2);
    assert.match(countMismatch.stderr, /result count does not match/);

    writeFileSync(join(before, 'capture.json'), 'null');
    const nullManifest = compare(['--before', before, '--after', after, '--out', join(root, 'null')]);
    assert.equal(nullManifest.status, 2);
    assert.match(nullManifest.stderr, /Invalid capture manifest/);

    writeFileSync(join(before, 'capture.json'), JSON.stringify({
      routes: ['/foo?x', '/foo-x'], breakpoints: ['desktop:800x600'], expected: 2,
      results: [
        { route: '/foo?x', breakpoint: 'desktop', width: 800, height: 600, file: 'foo-x/desktop-800x600.png', relativeFile: 'foo-x/desktop-800x600.png', ok: true },
        { route: '/foo-x', breakpoint: 'desktop', width: 800, height: 600, file: 'foo-x/desktop-800x600.png', relativeFile: 'foo-x/desktop-800x600.png', ok: true },
      ],
    }));
    const duplicateFile = compare(['--before', before, '--after', after, '--out', join(root, 'duplicate')]);
    assert.equal(duplicateFile.status, 2);
    assert.match(duplicateFile.stderr, /multiple results name the same output file/);

    writeFileSync(join(after, 'capture.json'), JSON.stringify({ state: 'in-progress' }));
    const inProgress = compare(['--before', after, '--after', before, '--out', join(root, 'running')]);
    assert.equal(inProgress.status, 2);
    assert.match(inProgress.stderr, /Capture is still in progress or incomplete/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('legacy absolute and cwd-relative manifest file paths remain portable after moving sets', () => {
  for (const fileMode of ['absolute', 'relative']) {
    const { root, before, after, out } = workspace(`compare-manifest-${fileMode}-`);
    try {
      for (const dir of [before, after]) png(join(dir, 'home'), 'desktop-800x600');
      const source = fileMode === 'absolute' ? '/old/worktree/shots/current/home/desktop-800x600.png'
        : 'shots/current/home/desktop-800x600.png';
      for (const dir of [before, after]) captureManifest(dir, { file: source, out: fileMode === 'absolute' ? '/old/worktree/shots/current' : 'shots/current' });
      const moved = join(root, 'new-checkout'); mkdirSync(moved);
      symlinkSync(join(fixtureProject, 'node_modules'), join(moved, 'node_modules'));
      const result = compare(['--before', before, '--after', after, '--out', out, '--json'], { cwd: moved });
      assert.equal(result.status, 0, result.stderr);
      assert.equal(JSON.parse(result.stdout).totals.same, 1);
    } finally { rmSync(root, { recursive: true, force: true }); }
  }
});

test('compare.js rejects bad arguments with exit 2 and writes nothing', () => {
  const { root, before, after, out } = workspace('compare-usage-');
  try {
    png(before, 'a'); png(after, 'a');
    for (const [args, message] of [
      [[], /Missing --before/],
      [['--before', before, '--after', after], /Missing --out/],
      [['--before', before, '--after', join(root, 'nope'), '--out', out], /--after is not a directory/],
      [['--before', before, '--after', before, '--out', out], /same directory/],
      [['--before', before, '--after', after, '--out', join(before, 'diff')], /--out must not be inside/],
      [['--before', before, '--after', after, '--out', after], /--out must not be inside/],
      [['--before', before, '--after', after, '--out', out, '--threshold', '2'], /--threshold must be a number from 0 to 1/],
      [['--before', before, '--after', after, '--out', out, '--max-diff-pixels', '1.5'], /--max-diff-pixels must be a whole number/],
      [['--before', before, '--after', after, '--out', out, '--max-diff-pixels', '5', '--max-diff-percent', '1'], /not both/],
      [['--before', before, '--after', after, '--out', out, '--window-size', '16', '--max-diff-percent', '1'], /use it with --max-diff-pixels/],
      [['--before', before, '--after', after, '--out', out, '--fuzz', '1'], /Unknown option: --fuzz/],
    ]) {
      const result = compare(args);
      assert.equal(result.status, 2, `${args.join(' ')}\n${result.stderr}`);
      assert.match(result.stderr, message);
    }
    assert.equal(existsSync(out), false);
    assert.deepEqual([tree(before), tree(after)], [['a.png'], ['a.png']]);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('compare.js --help documents every option and exit code', () => {
  const result = compare(['--help']);
  assert.equal(result.status, 0);
  for (const text of ['--before', '--after', '--out', '--threshold', '--max-diff-pixels', '--max-diff-percent', '--window-size', '--include-aa', '--json', 'Default: 0.05', 'Exit codes:', '  0  ', '  1  ', '  2  ']) {
    assert.ok(result.stdout.includes(text), text);
  }
  // The reference documents the same options and exit codes.
  for (const option of ['--threshold N', '--max-diff-pixels N', '--max-diff-percent P', '--window-size N', '--include-aa', '--json']) assert.ok(reference.includes(option), option);
});

// The default per-pixel threshold was chosen from measurements recorded in the reference:
// a one-palette-step colour change registers at 0.05 and vanishes at pixelmatch's own 0.1.
test('compare.js default threshold registers a one-step colour change that 0.1 misses', () => {
  const { root, before, after, out } = workspace('compare-threshold-');
  try {
    png(before, 'button', { blocks: [[10, 10, 20, 10, [0x25, 0x63, 0xeb]]] });
    png(after, 'button', { blocks: [[10, 10, 20, 10, [0x1d, 0x4e, 0xd8]]] });
    const strict = compare(['--before', before, '--after', after, '--out', out, '--json']);
    assert.equal(strict.status, 1, strict.stderr);
    assert.equal(JSON.parse(strict.stdout).results[0].diffPixels, 200);
    const loose = compare(['--before', before, '--after', after, '--out', out, '--json', '--threshold', '0.1']);
    assert.equal(loose.status, 0, loose.stderr);
    assert.equal(JSON.parse(loose.stdout).results[0].diffPixels, 0);
    assert.match(reference, /`#2563eb` → `#1d4ed8`\) \| 4,513 \| 0 \| 0 \| 0 \|/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('compare.js allowances: pixels, percent, and the densest window', () => {
  const { root, before, after, out } = workspace('compare-allowance-');
  try {
    png(before, 'page', { width: 100, height: 100 });
    // 100 differing pixels: one solid 8x8 block (64) plus 36 scattered single pixels.
    const scattered = Array.from({ length: 36 }, (_, i) => [40 + (i % 6) * 9, 40 + Math.floor(i / 6) * 9, 1, 1, BLACK]);
    png(after, 'page', { width: 100, height: 100, blocks: [[4, 4, 8, 8, BLACK], ...scattered] });
    const run = (...extra) => {
      const result = compare(['--before', before, '--after', after, '--out', out, '--json', '--include-aa', ...extra]);
      return { status: result.status, pair: result.status === 2 ? null : JSON.parse(result.stdout).results[0], stderr: result.stderr };
    };
    assert.deepEqual([run().status, run().pair.diffPixels], [1, 100]);
    assert.equal(run('--max-diff-pixels', '99').status, 1);
    assert.equal(run('--max-diff-pixels', '100').status, 0);
    assert.equal(run('--max-diff-percent', '0.99').status, 1);
    assert.equal(run('--max-diff-percent', '1').status, 0);
    const windowed = run('--window-size', '8', '--max-diff-pixels', '63');
    assert.deepEqual([windowed.status, windowed.pair.diffPixels, windowed.pair.windowSize], [1, 64, 8]);
    assert.equal(run('--window-size', '8', '--max-diff-pixels', '64').status, 0);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('compare.js names the fix when pixelmatch is missing or older than 8', () => {
  const root = mkdtempSync(join(tmpdir(), 'compare-deps-'));
  try {
    const copied = join(root, 'copied-scripts'); const project = join(root, 'project');
    mkdirSync(copied); mkdirSync(project);
    for (const file of ['compare.js', 'package.json']) copyFileSync(join(scriptsDir, file), join(copied, file));
    png(join(root, 'before'), 'a'); png(join(root, 'after'), 'a');
    const args = ['--before', join(root, 'before'), '--after', join(root, 'after'), '--out', join(root, 'diff')];
    const missing = compare(args, { cwd: project, script: join(copied, 'compare.js') });
    assert.equal(missing.status, 2);
    assert.match(missing.stderr, /^Missing dependency: compare\.js needs pixelmatch 8 and pngjs\. Install them/);
    assert.match(missing.stderr, /pixelmatch@8\.0\.0 pngjs@7\.0\.0/);

    const old = join(project, 'node_modules', 'pixelmatch');
    mkdirSync(old, { recursive: true });
    writeFileSync(join(old, 'package.json'), JSON.stringify({ name: 'pixelmatch', version: '7.2.0', type: 'module', main: 'index.js' }));
    writeFileSync(join(old, 'index.js'), 'export default () => { throw new Error("pixelmatch 7 must not be used"); };\n');
    const outdated = compare(args, { cwd: project, script: join(copied, 'compare.js') });
    assert.equal(outdated.status, 2);
    assert.match(outdated.stderr, /Found only pixelmatch 7\.2\.0 at /);
    assert.equal(existsSync(join(root, 'diff')), false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

// compare.js stays runnable on its own, so it carries a copy of the function capture.js uses
// to turn a route into a directory name. compare.js rejects a manifest whose file paths it
// cannot reproduce, so the two copies must never drift apart.
test('capture.js and compare.js name a route directory identically', () => {
  const source = (file) => readFileSync(join(scriptsDir, file), 'utf8').match(/function routeDirectory\(route\) \{[\s\S]*?\n\}/)[0];
  assert.equal(source('compare.js'), source('capture.js'), 'the routeDirectory copies in capture.js and compare.js differ');
  const routeDirectory = new Function(`${source('capture.js')}; return routeDirectory;`)();
  for (const [route, directory] of [['/', 'home'], ['/about', 'about'], ['/docs/intro?tab=api', 'docs-intro-tab-api'],
    ['/../../etc', 'etc'], ['/.hidden/', 'hidden'], ['///', 'home']]) {
    assert.equal(routeDirectory(route), directory, route);
  }
});
