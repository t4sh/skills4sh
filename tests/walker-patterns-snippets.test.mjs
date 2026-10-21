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
  const block = jsBlockAfter('## `scripts/tokens-to-figma/convert-to-dtcg.mjs`');
  const helpers = snippetBetween(block, 'function tokenPath', 'const tokens = parseCustomProperties');
  return Function(`${helpers}; return { tokenPath, tokenType, dtcgValue, parseCustomProperties, buildDtcg };`)();
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

test('walker and DTCG converter snippets keep tokenPath mappings in parity', () => {
  const walker = loadWalkerHelpers();
  const converter = loadConvertHelpers();
  const samples = [
    'beige-50',
    'ink-900',
    'space-4',
    'text-xl',
    'tracking-tight',
    'font-display',
    'font-weight-bold',
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

test('convert-to-dtcg snippet emits structured DTCG values and fails closed', () => {
  const { parseCustomProperties, buildDtcg } = loadConvertHelpers();
  const parsed = parseCustomProperties(`
    :root {
      --ink-900: #000;
      --space-4: 1rem;
      --font-display: Inter, sans-serif;
      --tw-internal: ignored;
    }
  `);
  assert.deepEqual(parsed.map((token) => token.path).sort(), [
    'palette/ink/900',
    'spacing/4',
    'typography/family/display',
  ]);

  const dtcg = buildDtcg(parsed);
  assert.deepEqual(dtcg.palette.ink['900'], {
    $value: { colorSpace: 'srgb', components: [0, 0, 0] },
    $type: 'color',
  });
  assert.deepEqual(dtcg.spacing['4'], {
    $value: { value: 1, unit: 'rem' },
    $type: 'dimension',
  });
  assert.deepEqual(dtcg.typography.family.display, {
    $value: ['Inter', 'sans-serif'],
    $type: 'fontFamily',
  });

  assert.throws(
    () => parseCustomProperties(':root { --mystery-token: 12qu; }'),
    /No explicit DTCG type mapping/,
  );
  assert.throws(
    () => parseCustomProperties(':root { --space-fluid: 10vw; }'),
    /Unsupported dimension value/,
  );
  assert.throws(
    () => buildDtcg([
      { path: 'palette/ink', type: 'color', value: { colorSpace: 'srgb', components: [0, 0, 0] } },
      { path: 'palette/ink/900', type: 'color', value: { colorSpace: 'srgb', components: [0, 0, 0] } },
    ]),
    /Token path conflict/,
  );
});

test('convert-to-dtcg snippet keeps light values when .dark or media queries redefine tokens', () => {
  const { parseCustomProperties, buildDtcg } = loadConvertHelpers();
  const css = `
    @layer theme, base;
    @layer base {
      :root { --background: #fff; --foreground: #111; }
      .dark { --background: #000; --foreground: #eee; }
    }
    :root.dark { --background: #010101; }
    [data-theme="dark"] { --background: #020202; }
    @media (prefers-color-scheme: dark) {
      :root { --background: #030303; }
    }
    @supports (color: oklch(0 0 0)) {
      :root { --foreground: #040404; }
    }
  `;
  const parsed = parseCustomProperties(css);
  assert.deepEqual(parsed.map((token) => token.name).sort(), ['background', 'foreground']);

  const dtcg = buildDtcg(parsed);
  assert.deepEqual(dtcg.semantic.background.$value, { colorSpace: 'srgb', components: [1, 1, 1] });
  assert.deepEqual(
    dtcg.semantic.foreground.$value,
    { colorSpace: 'srgb', components: [0x11 / 255, 0x11 / 255, 0x11 / 255] },
  );
});

test('convert-to-dtcg snippet reads @theme and @layer theme blocks', () => {
  const { parseCustomProperties } = loadConvertHelpers();
  const parsed = parseCustomProperties(`
    @theme { --space-4: 1rem; }
    @layer theme { :root, :host { --ink-900: #000; } }
  `);
  assert.deepEqual(parsed.map((token) => token.path).sort(), ['palette/ink/900', 'spacing/4']);
});

test('convert-to-dtcg snippet fails closed on conflicting base definitions and duplicate leaves', () => {
  const { parseCustomProperties, buildDtcg } = loadConvertHelpers();
  assert.throws(
    () => parseCustomProperties(':root { --background: #fff; } :root { --background: #000; }'),
    /Conflicting base definitions for --background/,
  );
  assert.equal(parseCustomProperties(':root { --background: #fff; } :root { --background: #fff; }').length, 1);
  assert.throws(
    () => buildDtcg(parseCustomProperties(':root { --text-xl: 1.25rem; --fs-xl: 1.5rem; }')),
    /typography\/scale\/xl is defined twice/,
  );
});

test('convert-to-dtcg snippet types font weights as fontWeight, not fontFamily', () => {
  const { parseCustomProperties, buildDtcg, tokenType } = loadConvertHelpers();
  assert.equal(tokenType('font-weight-bold'), 'fontWeight');
  assert.equal(tokenType('font-display'), 'fontFamily');

  const dtcg = buildDtcg(parseCustomProperties(`
    :root { --font-weight-bold: 700; --font-weight-body: normal; --font-display: Inter; }
  `));
  assert.deepEqual(dtcg.typography.weight.bold, { $value: 700, $type: 'fontWeight' });
  assert.deepEqual(dtcg.typography.weight.body, { $value: 'normal', $type: 'fontWeight' });
  assert.deepEqual(dtcg.typography.family.display, { $value: 'Inter', $type: 'fontFamily' });

  assert.throws(
    () => parseCustomProperties(':root { --font-weight-huge: 1200; }'),
    /Unsupported fontWeight value/,
  );
});

test('walker snippet does not map font-weight theme vars to font-family utilities', () => {
  const { buildUtilityMap } = loadWalkerHelpers();
  const map = buildUtilityMap({ 'font-weight-bold': true, 'font-display': true });
  assert.equal(map['font-weight-bold'], undefined);
  assert.deepEqual(map['font-display'], { property: 'font-family', var: 'font-display' });
});

test('DTCG converter rejects dangling, circular, and incompatible alias chains', () => {
  const { parseCustomProperties, buildDtcg } = loadConvertHelpers();
  for (const [css, error] of [
    [':root { --background: var(--missing); }', /Unknown token alias/],
    [':root { --background: var(--foreground); --foreground: var(--background); }', /Circular token alias/],
    [':root { --background: var(--space-4); --space-4: 1rem; }', /Token alias type mismatch/],
    [':root { --background: var(--foreground); --foreground: var(--space-4); --space-4: 1rem; }', /Token alias type mismatch/],
    [':root { --background: var(--background); }', /Circular token alias/],
  ]) {
    assert.throws(() => buildDtcg(parseCustomProperties(css)), error, css);
  }
});

test('DTCG converter preserves valid forward and chained aliases without flattening', () => {
  const { parseCustomProperties, buildDtcg } = loadConvertHelpers();
  const dtcg = buildDtcg(parseCustomProperties(`:root {
    --background: var(--foreground); --foreground: var(--ink-900); --ink-900: #111;
  }`));
  assert.deepEqual(dtcg.semantic.background, { $type: 'color', $value: '{semantic.foreground}' });
  assert.deepEqual(dtcg.semantic.foreground, { $type: 'color', $value: '{palette.ink.900}' });
  assert.equal(dtcg.palette.ink['900'].$type, 'color');
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
