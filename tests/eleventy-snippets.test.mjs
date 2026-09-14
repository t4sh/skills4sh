import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';

// Dependencies are locked separately from the published installer package.
const require = createRequire(new URL('./fixtures/eleventy/package.json', import.meta.url));
const nunjucks = require('nunjucks');
import { Eleventy, compile, eleventyUrl } from './fixtures/eleventy/runtime.mjs';
const skillRoot = new URL('../skills/eleventy-nunjucks/', import.meta.url);
const doc = name => readFileSync(new URL(name, skillRoot), 'utf8');
const blocks = (text, lang) => [...text.matchAll(new RegExp('```' + lang + '\\n([\\s\\S]*?)```', 'g'))].map(x => x[1]);
const firstAfter = (text, heading, lang) => blocks(text.slice(text.indexOf(heading)), lang)[0];
function file(root, name, text) {
  const dest = join(root, name);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, text);
  return dest;
}
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'skills4sh-eleventy-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}
async function render(t, files, config = '') {
  const root = fixture(t);
  for (const [name, text] of Object.entries(files)) file(root, `src/${name}`, text);
  const configPath = file(root, 'eleventy.config.cjs', `module.exports = c => {
    c.setLibrary('md', require(${JSON.stringify(require.resolve('markdown-it'))})({html:false}));
    ${config}
    return {markdownTemplateEngine:'njk',htmlTemplateEngine:'njk'};
  };`);
  return new Eleventy(join(root, 'src'), join(root, 'out'), { configPath, quietMode: true }).toJSON();
}
function recipes() {
  const filters = new Map();
  const config = { setLibrary() {}, addFilter(name, fn) { filters.set(name, fn); }, getFilter(name) { return filters.get(name); } };
  const text = doc('references/filters.md');
  const context = { require, module: { exports: null }, eleventyConfig: config };
  vm.runInNewContext(blocks(text, 'js')[0], context);
  context.module.exports(config);
  vm.runInNewContext(firstAfter(text, '## Security filter', 'js'), context);
  vm.runInNewContext(firstAfter(text, '### Companion', 'js'), context);
  return filters;
}

test('actual minimal page and chained layout snippets render frontmatter as data', async t => {
  const [page, layout] = blocks(doc('SKILL.md').split('## Minimal layout reminder')[1], 'nunjucks');
  const [output] = await render(t, {
    'index.njk': page,
    '_includes/layouts/page.njk': layout,
    '_includes/layouts/base.njk': '<html><title>{{ title }}</title><body>{{ content | safe }}</body></html>',
  });
  assert.match(output.content, /<title>Example<\/title>/);
  assert.match(output.content, /<main><section>Page body<\/section>/);
  assert.doesNotMatch(output.content, /layout:|---/);
});

test('canonical CJS and ESM config snippets build the documented directory profile', async t => {
  const source = doc('references/eleventy-config-api.md');
  for (const [heading, extension] of [['### CJS', 'cjs'], ['### ESM', 'mjs']]) {
    const root = fixture(t);
    let code = firstAfter(source, heading, 'js');
    // Relocate dependencies into the fixture installation without changing config logic.
    code = code.replace('require("markdown-it")', `require(${JSON.stringify(require.resolve('markdown-it'))})`)
      .replace('from "markdown-it"', `from ${JSON.stringify(pathToFileURL(require.resolve('markdown-it')).href)}`)
      .replace('import("@11ty/eleventy")', `import(${JSON.stringify(eleventyUrl)})`);
    const configPath = file(root, `eleventy.config.${extension}`, code);
    file(root, 'src/pages/index.njk', '---\nlayout: layouts/base.njk\n---\n{{ site.name }}');
    file(root, 'src/_includes/layouts/base.njk', '<main>{{ content | safe }}</main>');
    file(root, 'src/_data/site.json', '{"name":"Fixture"}');
    const outputs = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e',
      `import Eleventy from ${JSON.stringify(eleventyUrl)};
       const output = await new Eleventy('src/pages', 'out', {configPath:${JSON.stringify(configPath)},quietMode:true}).toJSON();
       process.stdout.write(JSON.stringify(output));`], { cwd: root, encoding: 'utf8' }));
    assert.match(outputs[0].content, /<main>Fixture<\/main>/);
  }
});

test('template preprocessing and untrusted Markdown data have distinct trust boundaries', async t => {
  const filters = recipes();
  const untrusted = '{{ 7 * 7 }} <img src=x onerror=alert(1)>';
  assert.match(filters.get('md')(untrusted), /\{\{ 7 \* 7 \}\}/);
  assert.doesNotMatch(filters.get('md')(untrusted), /<img/);
  const outputs = await render(t, { 'index.md': '{{ 7 * 7 }}' });
  assert.equal(outputs[0].content.trim(), '<p>49</p>');
});

test('cascade preserves documented precedence and computed values', async t => {
  const [output] = await render(t, {
    '_data/site.json': '{"label":"global"}',
    'src.11tydata.cjs': 'module.exports={site:{label:"directory"}}',
    'index.11tydata.cjs': 'module.exports={site:{label:"template"},eleventyComputed:{final:d=>d.site.label+"-computed"}}',
    'index.njk': '---\nsite:\n  label: frontmatter\n---\n{{ final }}',
  });
  assert.equal(output.content.trim(), 'frontmatter-computed');
});

test('explicit macro arguments work without inherited context', t => {
  const root = fixture(t);
  const text = doc('references/nunjucks-syntax.md');
  const [macro, call] = blocks(text.slice(text.indexOf('### The `with context` trap')), 'nunjucks');
  file(root, 'macros/page-link.njk', macro);
  const env = new nunjucks.Environment(new nunjucks.FileSystemLoader(root));
  assert.match(env.renderString(call, { page: { url: '/pricing/' } }), /href="\/pricing\/"/);
});

test('documented escaping snippet uses stock Nunjucks and escapes untrusted values', () => {
  const code = firstAfter(doc('references/nunjucks-syntax.md'), '## Autoescaping', 'nunjucks');
  const env = new nunjucks.Environment(null, { autoescape: true });
  const output = env.renderString(code, { trusted_html: '<p>Authored</p>' });
  assert.match(output, /&lt;b&gt;x&lt;\/b&gt;/);
  assert.match(output, /<p>Authored<\/p>/);
});

test('async callback rendering completes with asyncEach', async () => {
  const env = new nunjucks.Environment();
  env.addFilter('titleFor', (url, titles, callback) => setImmediate(() => callback(null, titles[url])), true);
  const template = firstAfter(doc('references/nunjucks-syntax.md'), '### Async iteration', 'nunjucks');
  const html = await new Promise((resolve, reject) => env.renderString(template,
    { items: [{url:'a'}, {url:'b'}], titleCache: {a:'Alpha', b:'Beta'} },
    (error, result) => error ? reject(error) : resolve(result)));
  assert.match(html, /Alpha[\s\S]*Beta/);
});

test('filter recipes retain equal-key order, handle null members, and preserve input', () => {
  const filters = recipes(), input = [{ k:1,id:'a' }, null, { k:1,id:'b' }, { k:0,id:'c' }];
  assert.equal(JSON.stringify(filters.get('sort_by')(input,'k').map(x=>x?.id)), '["c","a","b",null]');
  assert.equal(input[0].id,'a');
  assert.equal(JSON.stringify(filters.get('where')(input,'k','1').map(x=>x.id)), '["a","b"]');
});

test('script JSON recipes prevent HTML breakout and preserve data', () => {
  const filters = recipes(), value = {text:'</script><script>alert(1)</script>&\u2028\u2029'};
  for (const name of ['jsonScript','jsonCompact']) {
    const serialized = filters.get(name)(value);
    assert.doesNotMatch(serialized, /[<>&\u2028\u2029]/);
    assert.deepEqual(JSON.parse(serialized),value);
    assert.equal(filters.get(name)(undefined),'null');
    assert.throws(()=>filters.get(name)(1n));
  }
});

test('Tailwind dark selector recipe compiles to class-driven utilities', async () => {
  const code = firstAfter(doc('references/production-patterns.md'), '### Tailwind v4', 'css')
    .replace('@import "tailwindcss";', '@theme { --color-black: #000; }\n@tailwind utilities;');
  const result = await compile(code);
  const css = result.build(['dark:bg-black']);
  assert.match(css, /:where\(\.dark, \.dark \*\)/);
  assert.doesNotMatch(css, /prefers-color-scheme/);
});
