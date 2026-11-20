import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
const require = createRequire(new URL('./fixtures/visual/package.json', import.meta.url));
const { PNG } = require('pngjs');
const blocks = [...readFileSync('skills/localhost-screenshots/references/visual-regression.md', 'utf8').matchAll(/```js\n([\s\S]*?)```/g)].map(m => m[1]);

// Loads the documented snippets as modules, exactly as written apart from dependency paths.
async function loadSnippets(root) {
  async function load(source, exports, name) {
    for (const dep of ['pixelmatch', 'pngjs']) source = source.replaceAll(`'${dep}'`, `'${pathToFileURL(require.resolve(dep)).href}'`);
    const file = join(root, name + '.mjs');
    writeFileSync(file, source + `\nexport { ${exports} };\n`);
    return import(pathToFileURL(file).href);
  }
  const pixel = await load(blocks.find(s => s.includes('function diffScreenshots')), 'diffScreenshots, diffAllBreakpoints', 'pixel');
  const html = await load(blocks.find(s => s.includes('function escapeHtml')) + blocks.find(s => s.includes('function generateComparison(')), 'generateSideBySideComparison, generateComparison', 'html');
  return { pixel, html };
}

function png(dir, name, width, black = false) {
  const p = new PNG({ width, height: 20 });
  for (let i = 0; i < p.data.length; i += 4) {
    p.data[i] = p.data[i + 1] = p.data[i + 2] = black ? 0 : 255; p.data[i + 3] = 255;
  }
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, name + '.png'), PNG.sync.write(p));
}

test('comparison examples execute against real PNGs: equal, changed, resized and missing', async () => {
  const root = mkdtempSync(join(tmpdir(), 'visual-comparison-'));
  try {
    const { pixel, html } = await loadSnippets(root);
    const before = join(root, 'before'); const after = join(root, 'after'); const diff = join(root, 'diff');
    mkdirSync(before); mkdirSync(after);
    for (const dir of [before, after]) png(dir, 'equal', 20);
    png(before, 'changed', 20); png(after, 'changed', 20, true);
    png(before, 'resized', 20, true); png(after, 'resized', 30, true);
    png(before, 'missing-after', 20); png(after, 'missing-before', 20);
    png(before, 'quoted"<name>', 20);
    const report = pixel.diffAllBreakpoints(before, after, diff);
    assert.equal(report.totalBreakpoints, 6); assert.equal(report.passed, 1); assert.equal(report.failed, 5);
    assert.equal(report.compared, 3);
    assert.equal(report.results.find(r => r.breakpoint === 'equal').diffPercent, 0);
    assert.equal(report.results.find(r => r.breakpoint === 'changed').diffPercent, 100);
    assert.deepEqual(report.results.find(r => r.breakpoint === 'resized').dimensions, { width: 30, height: 20 });
    assert.equal(report.results.find(r => r.breakpoint === 'missing-before').missing, 'before');
    assert.equal(report.results.find(r => r.breakpoint === 'missing-after').missing, 'after');
    html.generateSideBySideComparison(before, after, join(root, 'side.html'));
    html.generateComparison(before, after, diff, join(root, 'report.html'));
    for (const name of ['side.html', 'report.html']) {
      const body = readFileSync(join(root, name), 'utf8');
      assert.match(body, /quoted&quot;&lt;name&gt;/); assert.doesNotMatch(body, /quoted"<name>/);
      assert.match(body, /Missing before screenshot/); assert.match(body, /Missing after screenshot/);
      assert.match(body, /src="before\/equal.png"/);
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
});

// The canonical capture script writes <outDir>/<route>/<breakpoint>.png. The 3.5.0 comparison
// read only the top level of each directory and reported 0 compared, 0 failed for this layout.
test('comparison examples pair the nested route/breakpoint layout the capture script writes', async () => {
  const root = mkdtempSync(join(tmpdir(), 'visual-comparison-nested-'));
  try {
    const { pixel, html } = await loadSnippets(root);
    const before = join(root, '_screenshots', 'before'); const after = join(root, '_screenshots', 'after');
    const diff = join(root, '_screenshots', 'diff');
    for (const dir of [before, after]) {
      png(join(dir, 'home'), 'mobile-375x812', 20);
      png(join(dir, 'about'), 'mobile-375x812', 20);
    }
    png(join(before, 'home'), 'desktop-1280x800', 20); png(join(after, 'home'), 'desktop-1280x800', 20, true);
    png(join(before, 'about'), 'desktop-1280x800', 20);
    const report = pixel.diffAllBreakpoints(before, after, diff);
    assert.equal(report.totalBreakpoints, 4); assert.equal(report.compared, 3);
    assert.equal(report.passed, 2); assert.equal(report.failed, 2);
    assert.deepEqual(report.results.map(r => r.breakpoint), ['about/desktop-1280x800', 'about/mobile-375x812', 'home/desktop-1280x800', 'home/mobile-375x812']);
    assert.equal(report.results.find(r => r.breakpoint === 'home/desktop-1280x800').diffPercent, 100);
    assert.equal(report.results.find(r => r.breakpoint === 'about/desktop-1280x800').missing, 'after');
    assert.ok(existsSync(join(diff, 'home', 'diff-desktop-1280x800.png')));
    assert.deepEqual(JSON.parse(readFileSync(join(diff, 'report.json'), 'utf8')).compared, 3);
    html.generateComparison(before, after, diff, join(root, '_screenshots', 'comparison.html'));
    html.generateSideBySideComparison(before, after, join(root, '_screenshots', 'side.html'));
    const body = readFileSync(join(root, '_screenshots', 'comparison.html'), 'utf8');
    assert.match(body, /src="before\/home\/desktop-1280x800.png"/);
    assert.match(body, /src="after\/home\/desktop-1280x800.png"/);
    assert.match(body, /src="diff\/home\/diff-desktop-1280x800.png"/);
    assert.match(body, /home\/desktop-1280x800 <span class="diff-stat fail">100% changed/);
    assert.match(body, /about\/desktop-1280x800 <span class="diff-stat fail">missing after/);
    assert.equal((body.match(/<div class="triple">/g) ?? []).length, 4);
    assert.match(readFileSync(join(root, '_screenshots', 'side.html'), 'utf8'), /src="after\/about\/mobile-375x812.png"/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('comparison examples treat "nothing compared" as an error, not a pass', async () => {
  const root = mkdtempSync(join(tmpdir(), 'visual-comparison-empty-'));
  try {
    const { pixel, html } = await loadSnippets(root);
    const before = join(root, 'before'); const after = join(root, 'after'); const diff = join(root, 'diff');
    mkdirSync(before); mkdirSync(after);
    assert.throws(() => pixel.diffAllBreakpoints(before, after, diff), /Nothing to compare: 0 PNG file\(s\) found/);
    assert.throws(() => html.generateSideBySideComparison(before, after, join(root, 'side.html')), /No PNG screenshots under/);
    assert.throws(() => html.generateComparison(before, after, diff, join(root, 'report.html')), /No PNG screenshots under/);
    // Directories at different depths share no relative path: every file is unpaired.
    png(join(before, 'home'), 'mobile-375x812', 20); png(after, 'mobile-375x812', 20);
    assert.throws(() => pixel.diffAllBreakpoints(before, after, diff), /Nothing to compare: 2 PNG file\(s\) found, none present under both/);
    assert.equal(existsSync(join(diff, 'report.json')), false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
