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
const scripts = ['quick.js', 'multi-breakpoint.js', 'screenshot-a11y.js'];

function envWithoutNodePath() {
  const env = { ...process.env };
  delete env.NODE_PATH;
  return env;
}

// Minimal chromium double: records which copy was loaded by writing its label
// into the screenshot file. It is a marker, never a rendered image.
function writeStub(root, label) {
  const moduleDir = join(root, 'node_modules', 'playwright');
  mkdirSync(moduleDir, { recursive: true });
  writeFileSync(join(moduleDir, 'package.json'), JSON.stringify({ name: 'playwright', main: 'index.js' }));
  writeFileSync(join(moduleDir, 'index.js'), `
    const fs = require('fs');
    const page = {
      frame: {}, handler: null, current: '',
      setViewportSize: async () => {},
      route: async (_pattern, handler) => { page.handler = handler; },
      mainFrame: () => page.frame,
      goto: async (url) => {
        await page.handler({
          request: () => ({ isNavigationRequest: () => true, frame: () => page.frame, url: () => url }),
          abort: async () => { throw new Error('blocked'); },
          continue: async () => {},
        });
        page.current = url;
      },
      url: () => page.current,
      screenshot: async ({ path }) => fs.writeFileSync(path, ${JSON.stringify(label)}),
      locator: () => ({ ariaSnapshot: async () => 'snapshot' }),
      close: async () => {},
    };
    module.exports = { chromium: { launch: async () => ({ newPage: async () => page, close: async () => {} }) } };
  `);
}

// Relative output paths prove captures land in the invoking project's _screenshots/.
function argsFor(script) {
  if (script === 'multi-breakpoint.js') return ['http://localhost:3000', '_screenshots/home', 'mobile:375x812'];
  if (script === 'screenshot-a11y.js') return ['http://localhost:3000', '_screenshots/page', '375x812'];
  return ['http://localhost:3000', '375x812', '_screenshots/quick.png'];
}

function outputFor(project, script) {
  if (script === 'multi-breakpoint.js') return join(project, '_screenshots', 'home', 'mobile-375x812.png');
  if (script === 'screenshot-a11y.js') return join(project, '_screenshots', 'page.png');
  return join(project, '_screenshots', 'quick.png');
}

// Copies a helper into an isolated "installed skill" folder so script-dir
// resolution never sees this repository's tree.
function installHelper(root, script) {
  const dir = join(root, 'installed-skill', 'assets', 'scripts');
  mkdirSync(dir, { recursive: true });
  copyFileSync(join(scriptsDir, script), join(dir, script));
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

  test(`${script} reports a project-scoped install hint when Playwright is missing`, () => {
    const root = mkdtempSync(join(tmpdir(), 'localhost-resolve-missing-'));
    try {
      const project = join(root, 'project');
      mkdirSync(project, { recursive: true });
      const helperDir = installHelper(root, script);
      const result = spawnSync(process.execPath, [join(helperDir, script), ...argsFor(script)], {
        cwd: project, encoding: 'utf8', env: envWithoutNodePath(),
      });
      assert.equal(result.status, 1);
      assert.match(result.stderr, /Missing dependency: playwright\. Install it in the project you run this command from/);
      assert.doesNotMatch(result.stderr, /Require stack/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
}
