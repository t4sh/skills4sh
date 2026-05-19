# Walker patterns

Annotated reference implementations for the three core scripts. Adapt to the target project — do not copy blindly.

---

## `scripts/figma-export/walk-<site>.mjs`

### Full annotated template

```js
import { readFileSync }        from 'node:fs';
import { resolve, dirname }    from 'node:path';
import { fileURLToPath }       from 'node:url';
import { parse as parseHtml }  from 'node-html-parser';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = resolve(__dirname, '../../');

// ── Project-specific paths ────────────────────────────────────────────────────
// Adapt to the actual build output directory and CSS file names.
const OUT_DIR   = resolve(ROOT, 'apps/site/out');       // ← adapt
const ASSETS    = resolve(OUT_DIR, 'assets/css');           // ← adapt if different

// ── CSS var name → W3C DTCG slash path ───────────────────────────────────────
// MUST match tokenPath() in convert-to-w3c.mjs exactly.
// Derive from the project's CSS custom property naming convention.
// Every prefix the project uses must be listed. Use `semantic/${name}` as catch-all.
function tokenPath(name) {
  // Examples — replace with actual prefixes from the project:
  if (/^beige-/.test(name))        return `palette/beige/${name.replace('beige-', '')}`;
  if (/^ink-/.test(name))          return `palette/ink/${name.replace('ink-', '')}`;
  if (/^space-/.test(name))        return `spacing/${name.replace('space-', '')}`;
  if (/^text-/.test(name))         return `typography/scale/${name.replace('text-', '')}`;
  if (/^tracking-/.test(name))     return `typography/tracking/${name.replace('tracking-', '')}`;
  if (/^font-/.test(name))         return `typography/family/${name.replace('font-', '')}`;
  if (/^fs-/.test(name))           return `typography/scale/${name.replace('fs-', '')}`;
  return `semantic/${name}`;
}

// ── Parse compiled CSS for .class { property: var(--name) } rules ────────────
// Framework-agnostic — copy verbatim. Works for any project.
function parseClassVarMap(css) {
  const map      = {};
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const ruleRe   = /(?:^|[{}])\s*\.([a-zA-Z][a-zA-Z0-9_-]*)\s*\{([^{}]+)\}/gm;
  const varRe    = /([a-z][a-zA-Z-]*):\s*var\(--([a-zA-Z0-9_-]+)\)/g;
  let m;
  while ((m = ruleRe.exec(stripped)) !== null) {
    const props = {};
    let vm;
    varRe.lastIndex = 0;
    while ((vm = varRe.exec(m[2])) !== null) props[vm[1]] = vm[2];
    if (Object.keys(props).length > 0) {
      if (!map[m[1]]) map[m[1]] = {};
      Object.assign(map[m[1]], props);
    }
  }
  return map;
}

// ── Tailwind v4 only: build utility → {property, var} map from @theme ────────
// Skip this function for projects without Tailwind v4 compiled output.
// Tailwind v4 @theme emits: --font-display, --text-xl, --tracking-tight, --color-background
function buildUtilityMap(themeVars) {
  const map = {};
  for (const name of Object.keys(themeVars)) {
    if (name.startsWith('font-'))
      map[`font-${name.slice(5)}`] = { property: 'font-family', var: name };
    else if (name.startsWith('text-'))
      map[`text-${name.slice(5)}`] = { property: 'font-size', var: name };
    else if (name.startsWith('tracking-'))
      map[`tracking-${name.slice(9)}`] = { property: 'letter-spacing', var: name };
  }
  for (const name of Object.keys(themeVars)) {
    if (name.startsWith('color-')) {
      const s = name.slice(6);
      map[`bg-${s}`]   = { property: 'background-color', var: name };
      map[`text-${s}`] = { property: 'color',            var: name };
    }
  }
  return map;
}

// ── Tailwind v4 only: extract @theme var names from compiled CSS ──────────────
function extractThemeVars(css) {
  const themeIdx = css.indexOf('@layer theme');
  if (themeIdx === -1) return {};
  const open  = css.indexOf('{', themeIdx);
  const props = {};
  const re    = /--([a-zA-Z0-9_-]+):/g;
  re.lastIndex = open;
  // 8000 = heuristic window over the @theme block. Raise it if the project's
  // @theme declares more vars than fit in ~8 KB, or scan to the matching `}`.
  const chunk = css.slice(open, open + 8000);
  let m;
  while ((m = re.exec(chunk)) !== null) props[m[1]] = true;
  return props;
}

// ── Tailwind v4 only: unwrap --color-{name}: var(--{name}) alias ─────────────
function resolveColorAlias(varName, themeText) {
  const re = new RegExp(`--${varName}:\\s*var\\(--([a-zA-Z0-9_-]+)\\)`);
  const m  = re.exec(themeText);
  return m ? m[1] : varName;
}

// ── CSS property → figma-export slot name ────────────────────────────────────
const PROP_SLOT = {
  'background-color': 'bgToken',
  'background':       'bgToken',
  'color':            'colorToken',
  'font-size':        'fontSizeToken',
  'font-family':      'fontFamilyToken',
  'letter-spacing':   'letterSpacingToken',
  'border-color':     'borderToken',
  'border-top-color': 'borderToken',
};

// ── Resolve element classes → token bindings ──────────────────────────────────
// utilityMap: Tailwind v4 utility classes (or empty {} if not Tailwind v4)
// componentMap: all .class { prop: var(--x) } rules from compiled CSS
// themeText: raw tailwind.css for alias resolution (or '' if not Tailwind v4)
function resolveTokens(classes, utilityMap, componentMap, themeText) {
  const tokens = {};
  for (const cls of classes) {
    if (utilityMap[cls]) {
      const { property, var: varName } = utilityMap[cls];
      const slot = PROP_SLOT[property];
      if (slot) tokens[slot] = tokenPath(themeText ? resolveColorAlias(varName, themeText) : varName);
    }
    if (componentMap[cls]) {
      for (const [prop, varName] of Object.entries(componentMap[cls])) {
        const slot = PROP_SLOT[prop];
        if (slot) tokens[slot] = tokenPath(themeText ? resolveColorAlias(varName, themeText) : varName);
      }
    }
  }
  return tokens;
}

// ── Walk section children for significant text nodes ──────────────────────────
// Adapt TEXT_TAGS and depth to project conventions.
function walkNodes(parent, utilityMap, componentMap, themeText) {
  const TEXT_TAGS = new Set(['h1','h2','h3','h4','h5','h6','p','span','a','button','strong','em','code']);
  const results   = [];
  function walk(el, depth) {
    if (depth > 8) return;
    const tag = el.tagName?.toLowerCase();
    if (!tag) return;
    if (TEXT_TAGS.has(tag)) {
      const text = el.text.replace(/\s+/g, ' ').trim();
      if (text.length < 2) return;
      const classes = (el.getAttribute('class') || '').split(/\s+/).filter(Boolean);
      const tokens  = resolveTokens(classes, utilityMap, componentMap, themeText);
      results.push({ tag, text: text.slice(0, 200), ...tokens });
      return;
    }
    for (const child of el.childNodes)
      if (child.nodeType === 1) walk(child, depth + 1);
  }
  for (const child of parent.childNodes)
    if (child.nodeType === 1) walk(child, 0);
  return results;
}

// ── Main ──────────────────────────────────────────────────────────────────────
// Adapt file paths and section detection to the actual project.

// For Tailwind v4 projects:
const twCss        = readFileSync(resolve(ASSETS, 'tailwind.css'),   'utf8');
const componentCss = readFileSync(resolve(ASSETS, 'components.css'), 'utf8');
const themeVars    = extractThemeVars(twCss);
const utilityMap   = buildUtilityMap(themeVars);
const componentMap = parseClassVarMap(componentCss);
const themeText    = twCss;

// For non-Tailwind projects:
// const tokensCss    = readFileSync(resolve(ROOT, 'dist/tokens.css'), 'utf8');
// const componentCss = readFileSync(resolve(ROOT, 'dist/styles.css'), 'utf8');
// const utilityMap   = {};   // no Tailwind utility resolution
// const componentMap = parseClassVarMap(componentCss + tokensCss);
// const themeText    = '';   // no alias resolution needed

const html     = readFileSync(resolve(OUT_DIR, 'index.html'), 'utf8');
const root     = parseHtml(html);
const sections = [];

// ── Section detection ─────────────────────────────────────────────────────────
// Adapt selectors to the project's actual HTML structure.

// Pattern A: named header landmark
const heroEl = root.querySelector('header.site-hero') || root.querySelector('[class*=hero]');
if (heroEl) {
  const classes = (heroEl.getAttribute('class') || '').split(/\s+/).filter(Boolean);
  sections.push({
    id: 'hero', tag: 'header', name: 'Hero',
    ...resolveTokens(classes, utilityMap, componentMap, themeText),
    nodes: walkNodes(heroEl, utilityMap, componentMap, themeText),
  });
}

// Pattern B: <section id="..."> — most common for marketing/docs pages
for (const el of root.querySelectorAll('section[id]')) {
  const id      = el.getAttribute('id');
  const label   = el.querySelector('.section-label, .section-opener__label, [data-label]');
  const name    = label ? label.text.replace(/\s+/g, ' ').trim() : id;
  const classes = (el.getAttribute('class') || '').split(/\s+/).filter(Boolean);
  sections.push({
    id, tag: 'section', name,
    ...resolveTokens(classes, utilityMap, componentMap, themeText),
    nodes: walkNodes(el, utilityMap, componentMap, themeText),
  });
}

// Pattern C: [data-section] attribute
// for (const el of root.querySelectorAll('[data-section]')) { ... }

// Pattern D: React/Next.js — sections are divs with a data-testid or aria-label
// for (const el of root.querySelectorAll('[data-testid]')) { ... }

const output = {
  meta: {
    generated: new Date().toISOString(),
    source: 'apps/site/out/index.html',  // ← adapt
  },
  sections,
};

process.stdout.write(JSON.stringify(output, null, 2) + '\n');
process.stderr.write(`\nexported ${sections.length} sections, `
  + `${sections.reduce((n, s) => n + s.nodes.length, 0)} nodes\n`);
```

### `node-html-parser` dependency

The walker requires `node-html-parser`. Add it if not present:

```bash
pnpm add -D node-html-parser   # or npm/yarn/bun equivalent
```

---

## `scripts/tokens-to-figma/convert-to-w3c.mjs`

Reads CSS custom properties and emits W3C DTCG JSON. The `tokenPath()` here must be identical to the one in the walker.

```js
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Adapt: point to the compiled CSS with custom property declarations ─────────
const css = readFileSync(resolve(__dirname, '../../apps/site/out/assets/css/tailwind.css'), 'utf8');

// ── MUST match tokenPath() in the walker exactly ──────────────────────────────
function tokenPath(name) {
  if (/^beige-/.test(name))    return `palette/beige/${name.replace('beige-', '')}`;
  if (/^text-/.test(name))     return `typography/scale/${name.replace('text-', '')}`;
  // ... same full mapping as walker
  return `semantic/${name}`;
}

// ── Extract --name: value pairs from CSS ──────────────────────────────────────
function parseCustomProperties(css) {
  const tokens = [];
  const re = /--([a-zA-Z0-9_-]+):\s*([^;]+);/g;
  let m;
  while ((m = re.exec(css)) !== null) {
    const name  = m[1];
    const value = m[2].trim();
    if (name.startsWith('tw-') || name.startsWith('_')) continue; // skip internals
    tokens.push({ name, value, path: tokenPath(name) });
  }
  return tokens;
}

// ── Build W3C DTCG tree ───────────────────────────────────────────────────────
function buildW3c(tokens) {
  const tree = {};
  for (const { path, name, value } of tokens) {
    const parts = path.split('/');
    let cur = tree;
    for (let i = 0; i < parts.length - 1; i++) {
      cur[parts[i]] ??= {};
      cur = cur[parts[i]];
    }
    // Infer $type from value
    const isColor = /^#|^rgb|^hsl|^oklch/.test(value);
    const isDim   = /^\d+(\.\d+)?(px|rem|em)$/.test(value);
    const type    = isColor ? 'color' : isDim ? 'dimension' : 'string';
    cur[parts.at(-1)] = { $value: value, $type: type };
  }
  return tree;
}

const tokens = parseCustomProperties(css);
const w3c    = buildW3c(tokens);
const out    = resolve(__dirname, 'project-tokens.w3c.json');  // ← adapt name
writeFileSync(out, JSON.stringify(w3c, null, 2) + '\n');
console.error(`wrote ${tokens.length} tokens → ${out}`);
```

---

## `scripts/tokens-to-figma/push-to-figma.mjs`

Generic — project-agnostic. Reads walker JSON from `stdin` (or `--file <path>`) and PATCHes the Gist.

```js
#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const GIST_TOKEN = process.env.GIST_TOKEN;
const GIST_ID    = process.env.GIST_ID || process.env.FIGMA_EXPORT_GIST_ID;

if (!GIST_TOKEN || !GIST_ID) {
  console.error('GIST_TOKEN and GIST_ID (or FIGMA_EXPORT_GIST_ID) must be set');
  process.exit(1);
}

const fileArg = process.argv.indexOf('--file');
const json    = fileArg !== -1
  ? readFileSync(process.argv[fileArg + 1], 'utf8')
  : readFileSync('/dev/stdin', 'utf8');

// Validate before pushing
let parsed;
try {
  parsed = JSON.parse(json);
} catch (e) {
  console.error('Invalid JSON:', e.message);
  process.exit(1);
}
if (!Array.isArray(parsed.sections)) {
  console.error('Missing sections array — aborting push');
  process.exit(1);
}

const res = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
  method: 'PATCH',
  headers: {
    Authorization: `token ${GIST_TOKEN}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ files: { 'figma-export.json': { content: json } } }),
});

if (!res.ok) {
  console.error(`Gist PATCH failed: ${res.status} ${res.statusText}`);
  process.exit(1);
}

const data = await res.json();
console.log(`Gist updated: https://gist.github.com/${data.owner.login}/${data.id}`);
console.error(`  sections: ${parsed.sections.length}  nodes: ${parsed.sections.reduce((n, s) => n + s.nodes.length, 0)}`);
```

---

## Stack-specific notes

### Tailwind v4

Use `buildUtilityMap` + `extractThemeVars` from the template. The `@layer theme` block in the compiled CSS contains all custom property names. Color utilities are double-aliased (`--color-background: var(--background)`) — use `resolveColorAlias` to unwrap.

### Custom CSS only (no Tailwind)

Set `utilityMap = {}` and `themeText = ''`. All binding comes from `parseClassVarMap` against your token CSS. Point it at the file with `--token-name: value` declarations.

### Style Dictionary output

Point `parseClassVarMap` at the generated `variables.css`. The `tokenPath()` function may be simpler if Style Dictionary already emits slash-separated groups.

### Next.js / React

A default Next.js build (App **or** Pages router) does **not** emit a single walkable HTML file — pages are server-rendered/streamed. The walker needs static HTML, so one of these is required:

- **Static export (recommended):** set `output: 'export'` in `next.config` and build. This emits `out/index.html` (and `out/<route>/index.html`) — point `OUT_DIR` at `out/`, exactly like the default template. State this `next.config` change to the user; it is a behaviour-changing prerequisite, not optional.
- **Per-route prerender:** for a statically-prerenderable route, the prerendered markup is under `.next/server/app/<route>.html` (App Router) or `.next/server/pages/<route>.html` (Pages Router) **only when that route is fully static**. Dynamic/streamed routes produce no such file — do not assume `page.html` exists.

Next.js CSS is content-hashed under `.next/static/css/*.css` (not a predictable `tailwind.css`/`components.css` pair). With static export the hashed CSS is copied into `out/...`. Resolve the CSS file by globbing the hashed name rather than hard-coding it, and feed all matched CSS into `parseClassVarMap` (there may be a single combined file, not the two-file split the Tailwind v4 template assumes). Sections identified by `data-testid` or `aria-label` are more reliable than element selectors in framework output.

### Eleventy / Nunjucks

Sections are usually `<section id="...">` with a class for theming. The `parseClassVarMap` against `components.css` is the primary binding source.
