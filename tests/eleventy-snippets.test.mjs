import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, delimiter } from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import vm from 'node:vm';
import { execFileSync, spawnSync } from 'node:child_process';

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

test('async callback rendering completes in a plain for loop and with asyncEach', async () => {
  const env = new nunjucks.Environment();
  env.addFilter('titleFor', (url, titles, callback) => setImmediate(() => callback(null, titles[url])), true);
  const text = doc('references/nunjucks-syntax.md');
  const [plainLoop, asyncLoop] = blocks(text.slice(text.indexOf('### Async iteration')), 'nunjucks');
  assert.match(plainLoop, /\{% for item in items %\}/);
  assert.match(asyncLoop, /\{% asyncEach item in items %\}/);
  for (const template of [plainLoop, asyncLoop]) {
    const html = await new Promise((resolve, reject) => env.renderString(template,
      { items: [{url:'a'}, {url:'b'}], titleCache: {a:'Alpha', b:'Beta'} },
      (error, result) => error ? reject(error) : resolve(result)));
    assert.match(html, /Alpha[\s\S]*Beta/);
  }
});

test('Eleventy renders async filters in a plain loop and captures them with setAsync', async t => {
  const text = doc('references/nunjucks-syntax.md');
  const loop = firstAfter(text, '### Async iteration', 'nunjucks');
  const capture = firstAfter(text, '### Async capture', 'nunjucks');
  assert.match(capture, /\{% setAsync "/);
  const [output] = await render(t, {
    'index.njk': `---\nitems: [{url: a}, {url: b}]\ntitleCache: {a: Alpha, b: Beta}\n---\n${loop}\n${capture}`,
  }, `c.addAsyncFilter('titleFor', async (url, titles = {}) => { await new Promise(done => setImmediate(done)); return titles[url] ?? url; });`);
  assert.match(output.content, /<li>Alpha<\/li>\s*<li>Beta<\/li>/);
  assert.match(output.content, /<h1>Alpha<\/h1>/);
  assert.doesNotMatch(output.content, /\[object/);
});

test('block set and macro bodies do not render async filter output on Nunjucks 3', () => {
  // Child processes: the block-set case also raises an uncaught TypeError after rendering.
  const run = template => spawnSync(process.execPath, ['-e', `
    const nunjucks = require(${JSON.stringify(require.resolve('nunjucks'))});
    const env = new nunjucks.Environment();
    env.addFilter('titleFor', (url, titles, callback) => setImmediate(() => callback(null, titles[url])), true);
    env.renderString(${JSON.stringify(template)}, { titleCache: { a: 'Alpha' } },
      (error, result) => process.stdout.write(error ? 'ERROR' : result));
  `], { encoding: 'utf8' });
  const inline = run('{% set t = "a" | titleFor(titleCache) %}[{{ t }}]');
  assert.equal(inline.status, 0, inline.stderr);
  assert.equal(inline.stdout, '[Alpha]');
  const block = run('{% set t %}{{ "a" | titleFor(titleCache) }}{% endset %}[{{ t }}]');
  assert.doesNotMatch(block.stdout, /Alpha/);
  assert.notEqual(block.status, 0);
  const macro = run('{% macro m(u) %}{{ u | titleFor(titleCache) }}{% endmacro %}[{{ m("a") }}]');
  assert.equal(macro.stdout, '[]');
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

test('formatFullDate accepts Date, YYYY-MM-DD, and ISO datetime input without a time-zone day shift', t => {
  const filters = new Map();
  // Share the host Date so `instanceof Date` inside the snippet sees host-realm dates.
  vm.runInNewContext(firstAfter(doc('references/filters.md'), '### `formatFullDate`', 'js'),
    { Date, eleventyConfig: { addFilter(name, fn) { filters.set(name, fn); } } });
  const format = filters.get('formatFullDate');
  const originalZone = process.env.TZ;
  t.after(() => { if (originalZone === undefined) delete process.env.TZ; else process.env.TZ = originalZone; });
  for (const zone of ['UTC', 'America/Los_Angeles', 'Pacific/Kiritimati']) {
    process.env.TZ = zone;
    // Guard: the zone switch must be live, or the loop proves nothing.
    assert.equal(new Date('2026-05-11T00:00:00.000Z').getDate(), zone === 'America/Los_Angeles' ? 10 : 11, zone);
    assert.equal(format(new Date('2026-05-11T00:00:00.000Z')), 'May 11, 2026', zone); // Eleventy front-matter date
    assert.equal(format('2026-05-11'), 'May 11, 2026', zone);
    assert.equal(format('2026-05-11T00:00:00.000Z'), 'May 11, 2026', zone);
    assert.equal(format('2026-12-31T23:59:59-08:00'), 'December 31, 2026', zone);
  }
  for (const invalid of [null, undefined, '', 'not a date', '2026-13-01', new Date(NaN)]) assert.equal(format(invalid), '');
});

test('paired shortcode recipe escapes arguments interpolated into markup', () => {
  const shortcodes = new Map();
  const add = (name, fn) => shortcodes.set(name, fn);
  vm.runInNewContext(firstAfter(doc('references/filters.md'), '## Shortcodes vs filters', 'js'),
    { eleventyConfig: { addFilter() {}, addShortcode: add, addPairedShortcode: add } });
  const callout = shortcodes.get('callout');
  assert.equal(callout('Heads up', 'warn'), '<aside class="callout callout-warn">Heads up</aside>');
  assert.equal(callout('Heads up', { type: 'warn' }), '<aside class="callout callout-warn">Heads up</aside>');
  const injected = callout('text', 'x" onclick="alert(1)');
  assert.doesNotMatch(injected, /" onclick="/);
  assert.match(injected, /^<aside class="[^"]*">text<\/aside>$/);
});

test('fan-out pagination sample writes one distinct page per collection item', async t => {
  const outputs = await render(t, {
    'fan.njk': firstAfter(doc('references/data-cascade.md'), '### One template per item', 'yaml'),
    'posts/first.md': '---\ntitle: First Post\ntags: post\n---\nBody one\n',
    'posts/second.md': '---\ntitle: Second Post\ntags: post\n---\nBody two\n',
  });
  const pages = outputs.filter(output => output.inputPath.endsWith('fan.njk'));
  assert.deepEqual(pages.map(page => page.url).sort(), ['/blog/first/', '/blog/second/']);
  assert.match(pages.find(page => page.url === '/blog/first/').content, /<h1>First Post<\/h1>[\s\S]*Body one/);
});

test('sitemap sample skips permalink:false items instead of repeating the root URL', async t => {
  const filters = doc('references/filters.md');
  const outputs = await render(t, {
    'sitemap.xml.njk': firstAfter(doc('references/production-patterns.md'), '### sitemap.xml', 'nunjucks'),
    '_data/site.json': '{"baseUrl":"https://example.com"}',
    'index.njk': '---\ndate: 2026-05-11\n---\nHome',
    'about.njk': '---\ndate: 2026-05-12\n---\nAbout',
    'hidden.njk': '---\npermalink: false\ndate: 2026-05-13\n---\nData only',
  }, `const eleventyConfig = c;
    ${firstAfter(filters, '## Path filter', 'js')}
    ${firstAfter(filters, '### \`sitemapDate\`', 'js')}`);
  const sitemap = outputs.find(output => output.url === '/sitemap.xml').content;
  assert.deepEqual([...sitemap.matchAll(/<loc>([^<]*)<\/loc>/g)].map(match => match[1]).sort(),
    ['https://example.com/', 'https://example.com/about']);
  assert.match(sitemap, /<lastmod>2026-05-11<\/lastmod>/);
});

test('agent-facing Markdown recipe writes Markdown, not layout-wrapped HTML', async t => {
  const outputs = await render(t, {
    'products.md': firstAfter(doc('references/review-shipping.md'), '### Agent-facing `.md` page', 'markdown'),
    '_includes/layouts/base.njk': '<html><body>{{ content | safe }}</body></html>',
  }, `c.addShortcode('year', () => '2026');`);
  const page = outputs.find(output => output.url === '/products.md');
  assert.match(page.content, /^# Products$/m);
  assert.match(page.content, /2026/);
  assert.doesNotMatch(page.content, /<h1|<html|<p>/);
});

test('template XSS triage greps flag unquoted attributes, URL attributes, and inline handlers only', t => {
  const text = doc('references/security-checklist.md');
  const unquoted = firstAfter(text, 'No unquoted attribute values', 'bash');
  const urls = firstAfter(text, 'URL attributes carry only vetted schemes', 'bash');
  const handlers = firstAfter(text, 'No template output inside inline event handlers', 'bash');
  const environments = firstAfter(text, '**Autoescape is on.**', 'bash').replace('.eleventy.js eleventy.config.*', 'eleventy.config.mjs');
  const root = fixture(t);
  file(root, 'src/attr-loose.njk', '<div class={{ kind }}>x</div>\n<span class=badge-{{ kind }}>y</span>\n');
  file(root, 'src/attr-quoted.njk', '<div class="{{ kind }}">x</div>\n<p>{{ a }} = {{ b }}</p>\n{{ ui.button("Go", variant="ghost") }}\n');
  file(root, 'src/url-dynamic.njk', '<a href="{{ link.href }}">x</a>\n<img src=\'{{ photo }}\' alt="">\n');
  file(root, 'src/url-static.njk', '<a href="/pricing/">{{ label }}</a>\n');
  file(root, 'src/handler.njk', '<button type="button" onclick="go(\'{{ slug }}\')">Go</button>\n');
  file(root, 'eleventy.config.mjs', 'export default c => { c.setLibrary("njk", new nunjucks.Environment(loader, { autoescape: false })); };\n');
  const run = block => spawnSync('bash', ['-c', block], { cwd: root, encoding: 'utf8' });
  const loose = run(unquoted);
  assert.equal(loose.stderr, '');
  assert.match(loose.stdout, /attr-loose\.njk:1:/);
  assert.match(loose.stdout, /attr-loose\.njk:2:/);
  assert.doesNotMatch(loose.stdout, /attr-quoted\.njk|url-dynamic\.njk|url-static\.njk|handler\.njk/);
  const dynamic = run(urls);
  assert.equal(dynamic.stderr, '');
  assert.match(dynamic.stdout, /url-dynamic\.njk:1:/);
  assert.match(dynamic.stdout, /url-dynamic\.njk:2:/);
  assert.doesNotMatch(dynamic.stdout, /url-static\.njk|attr-quoted\.njk|attr-loose\.njk|handler\.njk/);
  const inline = run(handlers);
  assert.equal(inline.stderr, '');
  assert.match(inline.stdout, /handler\.njk:1:/);
  assert.doesNotMatch(inline.stdout, /url-|attr-/);
  const custom = run(environments);
  assert.equal(custom.stderr, '');
  assert.match(custom.stdout, /^1:.*setLibrary\("njk"/);
});

test('example deployment profile is bannered and not routed from the core table or rules', () => {
  const skill = doc('SKILL.md');
  const core = skill.slice(skill.indexOf('### Core references'), skill.indexOf('### Example deployment profile'));
  const profile = skill.slice(skill.indexOf('### Example deployment profile'), skill.indexOf('## Behavioral evaluations'));
  const rules = skill.slice(skill.indexOf('## Non-negotiable rules'), skill.indexOf('## Data cascade'));
  const procedure = skill.slice(skill.indexOf('## Operating procedure'), skill.indexOf('## Mental model'));
  for (const name of ['build-pipeline.md', 'production-patterns.md']) {
    assert.ok(!core.includes(name) && !procedure.includes(name), `${name} routed by default`);
    assert.ok(profile.includes(`(references/${name})`), `${name} missing from profile table`);
    assert.match(doc(`references/${name}`), /^# [^\n]+\n\n> \*\*Example deployment profile\.\*\* This file /);
  }
  assert.doesNotMatch(rules + procedure + skill.slice(skill.indexOf('## Mental model'), skill.indexOf('## Non-negotiable rules')),
    /nginx|\*\*CSP:\*\*|Tailwind|`out\/`|profile/i);
  assert.match(profile, /only when the user asks for this kind of deployment work or the project already uses the pattern/);
  assert.match(profile, /\*\*Flat permalinks \+ nginx/);
  assert.match(profile, /\*\*CSP:\*\*/);
  const banner = /^> \*\*Example deployment profile\.\*\* This (file|section) describes one project's deployment setup, not Eleventy or Nunjucks guidance\. Load it only when the user asks for this kind of deployment work or the project already uses this pattern\.$/;
  const sections = {
    'references/conventions.md': ['## Project layout — full anatomy', '## Two example `dir` configurations', '## Opinionated production-profile patterns', '## Scripts shape', '## File-naming conventions'],
    'references/review-shipping.md': ['### Hardcoded hex / px in templates', '### Missing `permalink` where flat-HTML convention applies', '### Pipeline', '### Marketing `.njk` page'],
    'references/troubleshooting.md': ['## Tailwind / asset issues', '### Pages 404 in production despite being in `out/`', '### Soft-nav swap breaks page-specific scripts', '### `version-banner.js` fires constantly', '### Tailwind dev rebuild is slow'],
    'references/eleventy-config-api.md': ['## Permalinks and `normalize_path`'],
    'references/filters.md': ['## Path filter — `normalize_path`'],
    'references/security-checklist.md': ['## 5. Custom soft-navigation / DOM swap'],
  };
  for (const [name, headings] of Object.entries(sections)) {
    const lines = doc(name).split('\n');
    for (const heading of headings) {
      const at = lines.indexOf(heading);
      assert.notEqual(at, -1, `${name}: ${heading}`);
      assert.match(lines[at + 2], banner, `${name}: ${heading}`);
    }
  }
  const checklist = doc('references/security-checklist.md');
  const scoped = [...checklist.matchAll(/^## (\d+)\. [^\n]+\n\n(\*\*Scope:\*\* [^\n]+|> \*\*Example deployment profile\.\*\*)/gm)].map(match => Number(match[1]));
  assert.deepEqual(scoped, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
});

test('Tailwind dark selector recipe compiles to class-driven utilities', async () => {
  const code = firstAfter(doc('references/production-patterns.md'), '### Tailwind v4', 'css')
    .replace('@import "tailwindcss";', '@theme { --color-black: #000; }\n@tailwind utilities;');
  const result = await compile(code);
  const css = result.build(['dark:bg-black']);
  assert.match(css, /:where\(\.dark, \.dark \*\)/);
  assert.doesNotMatch(css, /prefers-color-scheme/);
});

test('inline-script audit flags | safe in any <script> tag but exempts jsonScript/jsonCompact', t => {
  const text = doc('references/security-checklist.md');
  const gate = firstAfter(text, 'No `| safe` expression inside `<script>`', 'bash');
  const info = firstAfter(text, 'Informational: review unfiltered', 'bash');
  const root = fixture(t);
  file(root, 'src/dump.njk', '<script>window.d = {{ data | dump | safe }};</script>\n');
  file(root, 'src/module.njk', '<script type="module">init({{ config | safe }})</script>\n');
  file(root, 'src/ok.njk', '<script type="application/json">{{ data | jsonScript | safe }}</script>\n<script>{{ data | jsonCompact | safe }}</script>\n');
  file(root, 'src/raw.njk', '<script>const id = "{{ page.url }}";</script>\n');
  file(root, 'src/body.njk', '<main>{{ content | safe }}</main>\n');
  const run = block => spawnSync('bash', ['-c', block], { cwd: root, encoding: 'utf8' });
  const flagged = run(gate);
  assert.equal(flagged.stderr, '');
  assert.match(flagged.stdout, /dump\.njk:1:/);
  assert.match(flagged.stdout, /module\.njk:1:/);
  assert.doesNotMatch(flagged.stdout, /ok\.njk|raw\.njk|body\.njk/);
  const review = run(info);
  assert.match(review.stdout, /raw\.njk:1:/);
  assert.doesNotMatch(review.stdout, /dump\.njk|module\.njk|ok\.njk|body\.njk/);
  // The quick audit script must enforce the same gate pattern.
  const pattern = gate.match(/grep -rnE '([^']+)'/)[1];
  assert.ok(text.slice(text.indexOf('## Quick audit script')).includes(pattern));
});

test('quick audit uses configured Eleventy directories and fails clearly on missing paths', t => {
  const root = fixture(t);
  const script = file(root, 'security-audit.sh', firstAfter(doc('references/security-checklist.md'), '## Quick audit script', 'bash'));
  const curl = file(root, 'bin/curl', '#!/bin/sh\nprintf "content-security-policy: default-src self\\nx-frame-options: DENY\\nstrict-transport-security: max-age=31536000\\n"\n');
  chmodSync(curl, 0o755);
  file(root, 'content/index.njk', '<h1>Home</h1>\n');
  file(root, '_site/index.html', '<h1>Home</h1>\n');
  const run = (input, output) => spawnSync('bash', [script, 'https://example.com', input, output], {
    cwd: root, encoding: 'utf8', env: { ...process.env, PATH: `${join(root, 'bin')}${delimiter}${process.env.PATH}` },
  });
  const ok = run('content', '_site');
  assert.equal(ok.status, 0, ok.stderr);
  assert.match(ok.stdout, /Audit complete/);
  const missing = run('src', 'out');
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /Missing directory: src.*check Eleventy config/);
  file(root, 'content/unsafe.njk', '<script>window.d = {{ data | dump | safe }};</script>\n');
  const blocked = run('content', '_site');
  assert.equal(blocked.status, 1);
  assert.match(blocked.stdout, /content\/unsafe\.njk:1:/);
});
