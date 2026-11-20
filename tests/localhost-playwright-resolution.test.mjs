import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

// Exercises how the bundled helpers locate Playwright when the skill is installed
// outside the project (for example ~/.agents/skills). NODE_PATH is removed so
// only the helper's own resolution logic can find the module.
const scriptsDir = resolve('skills/localhost-screenshots/assets/scripts');
const scripts = ['quick.js', 'multi-breakpoint.js', 'screenshot-a11y.js', 'capture.js'];

function envWithoutNodePath() {
  const env = { ...process.env };
  delete env.NODE_PATH;
  return env;
}

// Minimal chromium double: records which copy was loaded by returning its label
// as the screenshot bytes. It is a marker, never a rendered image. Navigation and
// redirect behaviour are covered in localhost-scripts.test.mjs; this double only
// answers the calls the helpers make on a plain local page.
function writeStub(root, label, name = 'playwright') {
  const moduleDir = join(root, 'node_modules', ...name.split('/'));
  mkdirSync(moduleDir, { recursive: true });
  writeFileSync(join(moduleDir, 'package.json'), JSON.stringify({ name, main: 'index.js' }));
  writeFileSync(join(moduleDir, 'index.js'), `
    const page = {
      current: '',
      context: () => ({ newCDPSession: async () => ({
        on: () => {},
        send: async (method) => (method === 'Page.getFrameTree' ? { frameTree: { frame: { id: 'main-frame' } } } : {}),
      }) }),
      setViewportSize: async () => {},
      goto: async (url) => {
        page.current = url;
        return { request: () => ({ url: () => url, redirectedFrom: () => null }) };
      },
      url: () => page.current,
      screenshot: async () => Buffer.from(${JSON.stringify(label)}),
      locator: () => ({ ariaSnapshot: async () => 'snapshot' }),
      close: async () => {},
    };
    module.exports = { chromium: { launch: async () => ({ newPage: async () => page, close: async () => {} }) } };
  `);
}

// Relative output paths prove captures land in the invoking project's _screenshots/.
function argsFor(script) {
  if (script === 'capture.js') return ['--base-url', 'http://localhost:3000', '--out', '_screenshots/set', '--breakpoints', 'mobile:375x812'];
  if (script === 'multi-breakpoint.js') return ['http://localhost:3000', '_screenshots/home', 'mobile:375x812'];
  if (script === 'screenshot-a11y.js') return ['http://localhost:3000', '_screenshots/page', '375x812'];
  return ['http://localhost:3000', '375x812', '_screenshots/quick.png'];
}

function outputFor(project, script) {
  if (script === 'capture.js') return join(project, '_screenshots', 'set', 'home', 'mobile-375x812.png');
  if (script === 'multi-breakpoint.js') return join(project, '_screenshots', 'home', 'mobile-375x812.png');
  if (script === 'screenshot-a11y.js') return join(project, '_screenshots', 'page.png');
  return join(project, '_screenshots', 'quick.png');
}

// Copies a helper, with the shared module it requires, into an isolated "installed
// skill" folder so script-dir resolution never sees this repository's tree.
function installHelper(root, script) {
  const dir = join(root, 'installed-skill', 'assets', 'scripts');
  mkdirSync(dir, { recursive: true });
  copyFileSync(join(scriptsDir, script), join(dir, script));
  copyFileSync(join(scriptsDir, 'local-guard.js'), join(dir, 'local-guard.js'));
  copyFileSync(join(scriptsDir, 'package.json'), join(dir, 'package.json'));
  return dir;
}

for (const script of scripts) {
  test(`${script} resolves Playwright from the invoking project without NODE_PATH`, () => {
    const root = mkdtempSync(join(tmpdir(), 'localhost-resolve-project-'));
    try {
      const project = join(root, 'project');
      writeStub(project, 'PROJECT PLAYWRIGHT');
      const helperDir = installHelper(root, script);
      writeStub(join(root, 'installed-skill', 'assets', 'scripts'), 'SCRIPT-DIR PLAYWRIGHT');
      const result = spawnSync(process.execPath, [join(helperDir, script), ...argsFor(script)], {
        cwd: project, encoding: 'utf8', env: envWithoutNodePath(),
      });
      assert.equal(result.status, 0, result.stderr);
      assert.equal(readFileSync(outputFor(project, script), 'utf8'), 'PROJECT PLAYWRIGHT');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test(`${script} falls back to Playwright beside the script when the project has none`, () => {
    const root = mkdtempSync(join(tmpdir(), 'localhost-resolve-fallback-'));
    try {
      const project = join(root, 'project');
      mkdirSync(project, { recursive: true });
      const helperDir = installHelper(root, script);
      writeStub(helperDir, 'SCRIPT-DIR PLAYWRIGHT');
      const result = spawnSync(process.execPath, [join(helperDir, script), ...argsFor(script)], {
        cwd: project, encoding: 'utf8', env: envWithoutNodePath(),
      });
      assert.equal(result.status, 0, result.stderr);
      assert.equal(readFileSync(outputFor(project, script), 'utf8'), 'SCRIPT-DIR PLAYWRIGHT');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  // pnpm and other strict layouts expose only the declared package: a project that
  // depends on @playwright/test cannot resolve playwright from its root.
  test(`${script} uses a project that has only @playwright/test`, () => {
    const root = mkdtempSync(join(tmpdir(), 'localhost-resolve-test-runner-'));
    try {
      const project = join(root, 'project');
      writeStub(project, 'PROJECT TEST RUNNER', '@playwright/test');
      const helperDir = installHelper(root, script);
      const result = spawnSync(process.execPath, [join(helperDir, script), ...argsFor(script)], {
        cwd: project, encoding: 'utf8', env: envWithoutNodePath(),
      });
      assert.equal(result.status, 0, result.stderr);
      assert.equal(readFileSync(outputFor(project, script), 'utf8'), 'PROJECT TEST RUNNER');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test(`${script} prefers the project's @playwright/test over a copy beside the script`, () => {
    const root = mkdtempSync(join(tmpdir(), 'localhost-resolve-test-runner-first-'));
    try {
      const project = join(root, 'project');
      writeStub(project, 'PROJECT TEST RUNNER', '@playwright/test');
      const helperDir = installHelper(root, script);
      writeStub(helperDir, 'SCRIPT-DIR PLAYWRIGHT');
      const result = spawnSync(process.execPath, [join(helperDir, script), ...argsFor(script)], {
        cwd: project, encoding: 'utf8', env: envWithoutNodePath(),
      });
      assert.equal(result.status, 0, result.stderr);
      assert.equal(readFileSync(outputFor(project, script), 'utf8'), 'PROJECT TEST RUNNER');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test(`${script} reports a project-scoped install hint when Playwright is missing`, () => {
    const root = mkdtempSync(join(tmpdir(), 'localhost-resolve-missing-'));
    try {
      const project = join(root, 'project');
      mkdirSync(project, { recursive: true });
      const helperDir = installHelper(root, script);
      const result = spawnSync(process.execPath, [join(helperDir, script), ...argsFor(script)], {
        cwd: project, encoding: 'utf8', env: envWithoutNodePath(),
      });
      assert.equal(result.status, script === 'capture.js' ? 2 : 1);
      assert.match(result.stderr, /Missing dependency: playwright\. Install it in the project you run this command from/);
      assert.match(result.stderr, /neither playwright nor @playwright\/test resolved/);
      assert.doesNotMatch(result.stderr, /Require stack/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
}
