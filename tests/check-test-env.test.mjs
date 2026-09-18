import assert from 'node:assert/strict';
import { chmodSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const python = process.env.SKILL_TEST_PYTHON || 'python3';

function fakeUv(version) {
  const dir = mkdtempSync(join(tmpdir(), 'skills4sh-fake-uv-'));
  if (process.platform === 'win32') {
    writeFileSync(join(dir, 'uv.cmd'), `@echo off\r\necho uv ${version}\r\n`);
  } else {
    const executable = join(dir, 'uv');
    writeFileSync(executable, `#!/bin/sh\nprintf 'uv ${version}\\n'\n`);
    chmodSync(executable, 0o755);
  }
  return dir;
}

function runPreflight(version) {
  const path = `${fakeUv(version)}${delimiter}${process.env.PATH || ''}`;
  return spawnSync(process.execPath, ['bin/check-test-env.mjs'], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: { ...process.env, PATH: path, SKILL_TEST_PYTHON: python },
  });
}

test('test-environment preflight rejects uv below the documented minimum', () => {
  const result = runPreflight('0.12.15');
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stderr, /uv 0\.12\.15 is too old/);
  assert.match(result.stderr, /uv 0\.12\.16\+/);
});

test('test-environment preflight accepts the documented minimum uv version', () => {
  const result = runPreflight('0.12.16');
  assert.equal(result.status, 0, result.stdout + result.stderr);
});

test('test-environment preflight rejects a prerelease at the stable minimum', () => {
  const result = runPreflight('0.12.16-rc.1');
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stderr, /uv version could not be determined/);
});
