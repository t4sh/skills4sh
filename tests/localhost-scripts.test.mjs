import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const scripts = [
  'skills/localhost-screenshots/assets/scripts/quick.js',
  'skills/localhost-screenshots/assets/scripts/multi-breakpoint.js',
  'skills/localhost-screenshots/assets/scripts/screenshot-a11y.js',
];

for (const script of scripts) {
  test(`${script} rejects external URLs before loading Playwright`, () => {
    const result = spawnSync('node', [script, 'https://example.com'], { encoding: 'utf8' });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Refusing non-localhost URL/);
    assert.doesNotMatch(result.stderr, /Cannot find module 'playwright'/);
  });

  test(`${script} rejects malformed URLs before loading Playwright`, () => {
    const result = spawnSync('node', [script, 'not-a-url'], { encoding: 'utf8' });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Invalid URL: not-a-url/);
    assert.doesNotMatch(result.stderr, /Cannot find module 'playwright'/);
  });

  test(`${script} blocks a localhost main-frame redirect to an external host`, () => {
    const fixture = mkdtempSync(join(tmpdir(), 'localhost-redirect-'));
    const moduleDir = join(fixture, 'node_modules', 'playwright');
    mkdirSync(moduleDir, { recursive: true });
    writeFileSync(join(moduleDir, 'index.js'), `
      const page = {
        handler: null,
        frame: {},
        setViewportSize: async () => {},
        route: async (_pattern, handler) => { page.handler = handler; },
        mainFrame: () => page.frame,
        goto: async () => {
          let aborted = false;
          await page.handler({
            request: () => ({
              isNavigationRequest: () => true,
              frame: () => page.frame,
              url: () => 'https://example.com/escaped',
            }),
            abort: async () => { aborted = true; },
            continue: async () => {},
          });
          if (aborted) throw new Error('navigation aborted');
        },
        url: () => 'https://example.com/escaped',
        waitForSelector: async () => {},
        screenshot: async () => {},
        locator: () => ({ ariaSnapshot: async () => 'snapshot' }),
        close: async () => {},
      };
      module.exports = {
        chromium: {
          launch: async () => ({
            newPage: async () => page,
            close: async () => {},
          }),
        },
      };
    `);

    try {
      const args = script.endsWith('multi-breakpoint.js')
        ? [script, 'http://localhost:3000', join(fixture, 'shots'), 'mobile:375x812']
        : script.endsWith('screenshot-a11y.js')
          ? [script, 'http://localhost:3000', join(fixture, 'page'), '375x812']
          : [script, 'http://localhost:3000', '375x812', join(fixture, 'quick.png')];
      const result = spawnSync('node', args, {
        encoding: 'utf8',
        env: { ...process.env, NODE_PATH: join(fixture, 'node_modules') },
      });
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /Refusing non-localhost main-frame redirect: https:\/\/example\.com\/escaped/);
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  });
}
