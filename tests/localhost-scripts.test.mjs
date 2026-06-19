import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
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
}
