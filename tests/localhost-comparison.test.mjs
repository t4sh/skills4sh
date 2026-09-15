import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
const require = createRequire(new URL('./fixtures/visual/package.json', import.meta.url));
const { PNG } = require('pngjs');
const blocks = [...readFileSync('skills/localhost-screenshots/references/visual-regression.md', 'utf8').matchAll(/```js\n([\s\S]*?)```/g)].map(m => m[1]);

test('comparison examples execute against real PNGs: equal, changed, resized and missing', async () => {
  const root = mkdtempSync(join(tmpdir(), 'visual-comparison-'));
  try {
    async function load(source, exports, name) {
      for (const dep of ['pixelmatch', 'pngjs']) source = source.replaceAll(`'${dep}'`, `'${pathToFileURL(require.resolve(dep)).href}'`);
      const file = join(root, name + '.mjs');
      writeFileSync(file, source + `\nexport { ${exports} };\n`);
      return import(pathToFileURL(file).href);
    }
    const pixel = await load(blocks.find(s => s.includes('function diffScreenshots')), 'diffScreenshots, diffAllBreakpoints', 'pixel');
    const html = await load(blocks.find(s => s.includes('function escapeHtml')) + blocks.find(s => s.includes('function generateComparison(')), 'generateSideBySideComparison, generateComparison', 'html');
    const before = join(root, 'before'); const after = join(root, 'after'); const diff = join(root, 'diff');
    mkdirSync(before); mkdirSync(after);
    const png = (dir, name, width, black = false) => {
      const p = new PNG({ width, height: 20 });
      for (let i = 0; i < p.data.length; i += 4) {
        p.data[i] = p.data[i + 1] = p.data[i + 2] = black ? 0 : 255; p.data[i + 3] = 255;
      }
      writeFileSync(join(dir, name + '.png'), PNG.sync.write(p));
    };
    for (const dir of [before, after]) png(dir, 'equal', 20);
    png(before, 'changed', 20); png(after, 'changed', 20, true);
    png(before, 'resized', 20, true); png(after, 'resized', 30, true);
    png(before, 'missing-after', 20); png(after, 'missing-before', 20);
    png(before, 'quoted"<name>', 20);
    const report = pixel.diffAllBreakpoints(before, after, diff);
    assert.equal(report.totalBreakpoints, 6); assert.equal(report.passed, 1); assert.equal(report.failed, 5);
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
