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

test('catalog audit-helper case ships a helper whose seeded defect reproduces on a fixture', () => {
  const root = mkdtempSync(join(tmpdir(), 'architect-audit-helper-'));
  const c = catalog.cases.find(c => c.id === 'audit-helper');
  try {
    assert.equal(c.kind, 'workflow');
    for (const [path, contents] of Object.entries(c.files)) {
      const target = join(root, path);
      mkdirSync(resolve(target, '..'), { recursive: true });
      writeFileSync(target, contents);
    }
    const helper = join(root, 'skills/report-helper/assets/scripts/total.py');
    const run = csv => spawnSync(process.env.SKILL_TEST_PYTHON || 'python3', ['-E', '-B', helper, csv], { encoding: 'utf8' });
    const good = run(join(root, 'invoice.csv'));
    assert.equal(good.status, 0, good.stderr);
    assert.equal(good.stdout.trim(), 'count=2 total=30.50');
    const malformed = join(root, 'malformed.csv');
    writeFileSync(malformed, 'id,amount\na,10.25x\nb,20.25\n');
    const bad = run(malformed);
    // Seeded defect: the unanchored regex accepts malformed input. If this ever
    // fails closed, the audit case no longer tests fixture-run discipline.
    assert.equal(bad.status, 0, bad.stderr);
    assert.equal(bad.stdout.trim(), 'count=2 total=30.50');
    assert.ok(c.assertions.some(a => /command plus observed output/.test(a)));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('catalog description-characters case seeds a description the validator rejects only for angle brackets', () => {
  const root = mkdtempSync(join(tmpdir(), 'architect-description-characters-'));
  const c = catalog.cases.find(c => c.id === 'audit-description-characters');
  try {
    assert.equal(c.kind, 'workflow');
    for (const [path, contents] of Object.entries(c.files)) {
      const target = join(root, path);
      mkdirSync(resolve(target, '..'), { recursive: true });
      writeFileSync(target, contents);
    }
    const result = spawnSync(process.env.SKILL_TEST_PYTHON || 'python3', [
      '-E', '-B', 'skills/skill-architect/assets/scripts/validate_skill.py', join(root, 'skills/report-helper'),
    ], { encoding: 'utf8' });
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.equal(
      result.stdout.trim(),
      '✗ description must not contain angle brackets (< or >); first-party skill validators reject them and some runtimes escape them',
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('routing catalog covers every mode phrase in the description, the dropped cues, and the skip clause', () => {
  const skill = readFileSync('skills/skill-architect/SKILL.md', 'utf8');
  const description = skill.match(/^description: "(.*)"$/m)[1].replaceAll('\\"', '"');
  const [load, skip] = description.split(' Not for ');
  assert.ok(skip, 'description needs a skip clause');
  assert.doesNotMatch(description, /[<>]/);
  assert.match(load, /`skills\/\*\/SKILL\.md`/);

  const phrases = [...load.matchAll(/"([^"]+)"/g)].map(m => m[1]);
  assert.equal(phrases.length, modes.length, `one quoted phrase per mode, got: ${phrases.join(' | ')}`);
  const prompts = id => catalog.cases.find(c => c.id === id).prompts;
  for (const phrase of phrases) {
    assert.ok(
      prompts('mode-phrases').some(p => p.load === true && p.text.toLowerCase().includes(phrase)),
      `no positive routing prompt for "${phrase}"`,
    );
  }

  for (const cue of ['references/*.md', 'helper scripts', 'lockfiles', 'security manifests', 'vendor adapters', 'completion criteria', 'repository gates', 'progressive disclosure']) {
    assert.ok(!load.includes(cue), `dropped cue is back in the description: ${cue}`);
  }
  assert.ok(prompts('dropped-cues').length >= 8 && prompts('dropped-cues').every(p => p.load === false));
  assert.ok(prompts('skip-clause').some(p => p.load === false) && prompts('skip-clause').some(p => p.load === true));
});

test('catalog keeps a named-skill routing near-miss for skill-creator', () => {
  const c = catalog.cases.find(c => c.id === 'named-skill-near-miss');
  assert.equal(c.kind, 'description-only-routing');
  assert.ok(c.prompts.some(p => /skill-creator/.test(p.text) && p.load === false));
  assert.ok(c.prompts.some(p => /skill-creator/.test(p.text) && p.load === true));
});
