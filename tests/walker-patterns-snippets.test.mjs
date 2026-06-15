import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const markdown = readFileSync('skills/code-to-figma/references/walker-patterns.md', 'utf8');

function jsBlockAfter(heading) {
  const start = markdown.indexOf(heading);
  assert.notEqual(start, -1, `missing heading: ${heading}`);
  const match = markdown.slice(start).match(/```js\n([\s\S]*?)\n```/);
  assert.ok(match, `missing js block after heading: ${heading}`);
  return match[1];
}

function snippetBetween(block, startMarker, endMarker) {
  const start = block.indexOf(startMarker);
  const end = block.indexOf(endMarker);
  assert.notEqual(start, -1, `missing snippet start: ${startMarker}`);
  assert.notEqual(end, -1, `missing snippet end: ${endMarker}`);
  return block.slice(start, end);
}

function loadWalkerHelpers() {
  const block = jsBlockAfter('## `scripts/figma-export/walk-<site>.mjs`');
  const helpers = snippetBetween(block, 'function tokenPath', '// ── Main');
  return Function(`${helpers}; return { tokenPath, parseClassVarMap, extractThemeVars, buildUtilityMap, resolveTokens, walkNodes };`)();
}

function loadConvertHelpers() {
  const block = jsBlockAfter('## `scripts/tokens-to-figma/convert-to-w3c.mjs`');
  const helpers = snippetBetween(block, 'function tokenPath', 'const tokens = parseCustomProperties');
  return Function(`${helpers}; return { tokenPath, parseCustomProperties, buildW3c };`)();
}

function loadPushHelpers() {
  const block = jsBlockAfter('## `scripts/tokens-to-figma/push-to-figma.mjs`');
  const helpers = snippetBetween(block, 'function gistUpdatedUrl', 'const GIST_TOKEN');
  return Function(`${helpers}; return { gistUpdatedUrl };`)();
}

function element(tagName, attrs = {}, children = [], text = '') {
  return {
    tagName,
    nodeType: 1,
    childNodes: children,
    text,
    getAttribute(name) {
      return attrs[name] ?? '';
    },
  };
}

test('walker snippet maps comma-grouped class selectors', () => {
  const { parseClassVarMap } = loadWalkerHelpers();
  const map = parseClassVarMap(`
    .hero, .banner { color: var(--ink); background-color: var(--surface); }
  `);

  assert.equal(map.hero.color, 'ink');
  assert.equal(map.hero['background-color'], 'surface');
  assert.equal(map.banner.color, 'ink');
  assert.equal(map.banner['background-color'], 'surface');
});

test('walker snippet maps CSS var fallbacks to the primary token', () => {
  const { parseClassVarMap } = loadWalkerHelpers();
  const map = parseClassVarMap(`
    .hero { color: var(--ink , #111); background-color: var(--surface, rgb(255 255 255)); }
  `);

  assert.equal(map.hero.color, 'ink');
  assert.equal(map.hero['background-color'], 'surface');
});

test('walker snippet does not let conditional at-rules clobber base bindings', () => {
  const { parseClassVarMap } = loadWalkerHelpers();
  const map = parseClassVarMap(`
    @charset "UTF-8";
    .hero { color: var(--base); }
    @media (min-width: 768px) {
      .hero { color: var(--wide); background-color: var(--wide-bg); }
    }
    @layer components {
      .card, .panel:hover { color: var(--component); }
    }
  `);

  assert.equal(map.hero.color, 'base');
  assert.equal(map.hero['background-color'], 'wide-bg');
  assert.equal(map.card.color, 'component');
  assert.equal(map.panel.color, 'component');
});

test('walker snippet extracts Tailwind theme vars with root fallback', () => {
  const { extractThemeVars } = loadWalkerHelpers();

  assert.deepEqual(
    Object.keys(extractThemeVars(`
      @layer theme { :root { --color-background: var(--background); --text-xl: 1.25rem; } }
    `)).sort(),
    ['color-background', 'text-xl'],
  );

  assert.deepEqual(
    Object.keys(extractThemeVars(`
      :root, :host { --font-display: Inter; --tracking-tight: -0.02em; }
    `)).sort(),
    ['font-display', 'tracking-tight'],
  );
});

test('walker and W3C converter snippets keep tokenPath mappings in parity', () => {
  const walker = loadWalkerHelpers();
  const converter = loadConvertHelpers();
  const samples = [
    'beige-50',
    'ink-900',
    'space-4',
    'text-xl',
    'tracking-tight',
    'font-display',
    'fs-sm',
    'background',
  ];

  for (const sample of samples) {
    assert.equal(converter.tokenPath(sample), walker.tokenPath(sample), `tokenPath mismatch for ${sample}`);
  }
});

test('walker snippet produces figma-export contract shape for a fixture section', () => {
  const { parseClassVarMap, extractThemeVars, buildUtilityMap, resolveTokens, walkNodes } = loadWalkerHelpers();
  const twCss = `
    @layer theme {
      :root {
        --color-background: var(--background);
        --font-display: Inter;
        --text-xl: 1.25rem;
        --tracking-tight: -0.02em;
      }
    }
  `;
  const componentCss = `
    .hero, .banner { background-color: var(--beige-50); border-color: var(--ink-900); }
    .eyebrow { color: var(--ink-900); }
  `;
  const themeVars = extractThemeVars(twCss);
  const utilityMap = buildUtilityMap(themeVars);
  const componentMap = parseClassVarMap(componentCss);
  const hero = element('header', { class: 'hero' }, [
    element('span', { class: 'eyebrow tracking-tight' }, [], 'Launch notes'),
    element('h1', { class: 'text-xl text-background font-display' }, [], 'Ship faster'),
  ]);

  const section = {
    id: 'hero',
    tag: 'header',
    name: 'Hero',
    ...resolveTokens(['hero'], utilityMap, componentMap, twCss),
    nodes: walkNodes(hero, utilityMap, componentMap, twCss),
  };

  assert.deepEqual(Object.keys(section).sort(), ['bgToken', 'borderToken', 'id', 'name', 'nodes', 'tag']);
  assert.equal(section.bgToken, 'palette/beige/50');
  assert.equal(section.borderToken, 'palette/ink/900');
  assert.equal(section.nodes.length, 2);
  assert.deepEqual(section.nodes[0], {
    tag: 'span',
    text: 'Launch notes',
    letterSpacingToken: 'typography/tracking/tight',
    colorToken: 'palette/ink/900',
  });
  assert.deepEqual(section.nodes[1], {
    tag: 'h1',
    text: 'Ship faster',
    fontSizeToken: 'typography/scale/xl',
    colorToken: 'semantic/background',
    fontFamilyToken: 'typography/family/display',
  });
});

test('convert-to-w3c snippet parses CSS and skips explicit path conflicts instead of overwriting', () => {
  const { parseCustomProperties, buildW3c } = loadConvertHelpers();
  const parsed = parseCustomProperties(`
    :root {
      --ink-900: #000;
      --space-4: 1rem;
      --tw-internal: ignored;
    }
  `);
  assert.deepEqual(parsed.map((token) => token.path).sort(), ['palette/ink/900', 'spacing/4']);

  const warnings = [];
  const originalWarn = console.warn;
  console.warn = (message) => warnings.push(message);
  try {
    const w3c = buildW3c([
      { path: 'palette/ink', name: 'ink', value: '#111' },
      { path: 'palette/ink/900', name: 'ink-900', value: '#000' },
      { path: 'spacing/4', name: 'space-4', value: '1rem' },
    ]);
    assert.equal(w3c.palette.ink.$value, '#111');
    assert.equal(w3c.spacing['4'].$value, '1rem');
    assert.deepEqual(warnings, ['SKIP token path conflict: palette/ink/900 extends existing leaf palette/ink']);
  } finally {
    console.warn = originalWarn;
  }
});

test('push-to-figma snippet formats anonymous gist success URLs', () => {
  const { gistUpdatedUrl } = loadPushHelpers();

  assert.equal(
    gistUpdatedUrl({ owner: null, id: 'abc123', html_url: 'https://gist.github.com/abc123' }, 'fallback'),
    'https://gist.github.com/abc123',
  );
  assert.equal(
    gistUpdatedUrl({ owner: null, id: 'abc123' }, 'fallback'),
    'https://gist.github.com/abc123',
  );
  assert.equal(
    gistUpdatedUrl({ owner: { login: 'octo' }, id: 'abc123' }, 'fallback'),
    'https://gist.github.com/octo/abc123',
  );
});
