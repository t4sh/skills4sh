import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, mkdtempSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const catalog = JSON.parse(readFileSync('skills/skill-architect/assets/evals/scenarios.json', 'utf8'));
const modes = ['plan', 'create', 'audit', 'fix', 'refactor', 'compare', 'distill', 'reconcile', 'teach'];

test('all nine architect modes materialize with their task inputs, without external report files', () => {
  const root = mkdtempSync(join(tmpdir(), 'architect-catalog-'));
  try {
    assert.equal(new Set(catalog.cases.map(c => c.id)).size, catalog.cases.length);
    for (const mode of modes) {
      const c = catalog.cases.find(c => c.id === mode);
      assert.equal(c.kind, 'workflow');
      assert.ok(c.prompt && c.assertions.length);
      assert.ok(c.files['AGENTS.md']);
      for (const [path, contents] of Object.entries(c.files)) {
        assert.ok(!path.startsWith('/') && !path.includes('\\') && !path.split('/').includes('..'), path);
        assert.equal(typeof contents, 'string');
        const target = join(root, mode, path);
        mkdirSync(resolve(target, '..'), { recursive: true });
        writeFileSync(target, contents);
      }
      for (const path of ['requirements.md', 'invoice.csv', 'skills/report-helper/SKILL.md', 'skills/report-helper/LICENSE']) {
        assert.ok(existsSync(join(root, mode, path)), `${mode}: ${path}`);
      }
    }
    for (const [mode, paths] of Object.entries({
      distill: ['session-a.md', 'session-b.md'],
      reconcile: ['prior-audit.md'],
      compare: ['vendor-proposal.md'],
      fix: ['skills/report-helper/references/columns.md'],
    })) {
      for (const path of paths) assert.ok(existsSync(join(root, mode, path)), `${mode}: ${path}`);
    }
    // These missing files are intentional defects, not incomplete materialization.
    for (const mode of ['audit', 'reconcile']) {
      assert.ok(!existsSync(join(root, mode, 'skills/report-helper/references/columns.md')));
      assert.match(readFileSync(join(root, mode, 'skills/report-helper/SKILL.md'), 'utf8'), /\(references\/columns\.md\)/);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('catalog fix case produces a real dry-run repair without modifying its inputs', () => {
  const root = mkdtempSync(join(tmpdir(), 'architect-fix-catalog-'));
  const c = catalog.cases.find(c => c.id === 'fix');
  try {
    for (const [path, contents] of Object.entries(c.files)) {
      const target = join(root, path);
      mkdirSync(resolve(target, '..'), { recursive: true });
      writeFileSync(target, contents);
    }
    const result = spawnSync(process.env.SKILL_TEST_PYTHON || 'python3', [
      '-S', 'skills/skill-architect/assets/scripts/fix_skill.py', join(root, 'skills/report-helper'),
    ], { encoding: 'utf8', env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' } });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /normalize frontmatter name/);
    assert.match(result.stdout, /link missing references/);
    assert.match(result.stdout, /dry-run only/);
    for (const [path, contents] of Object.entries(c.files)) assert.equal(readFileSync(join(root, path), 'utf8'), contents);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
