import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const env = { ...process.env, PYTHONDONTWRITEBYTECODE: '1' };
const scripts = 'skills/skill-architect/assets/scripts';

function runPython(args, options = {}) {
  const result = spawnSync('python3', args, {
    encoding: 'utf8',
    env,
    ...options,
  });
  assert.equal(result.status, 0, `${args.join(' ')}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
  return result;
}

function runPythonFail(args, options = {}) {
  const result = spawnSync('python3', args, {
    encoding: 'utf8',
    env,
    ...options,
  });
  assert.notEqual(result.status, 0, `${args.join(' ')} unexpectedly passed`);
  return result;
}

test('skill-architect scaffold, inspect, and validate helpers work against a fixture skill', () => {
  const root = mkdtempSync(join(tmpdir(), 'skill-architect-helper-'));

  const scaffold = runPython([
    `${scripts}/scaffold_skill.py`,
    'Fixture Skill',
    '--path', root,
    '--phrase', 'review fixture workflows',
    '--tags', 'fixture, test',
  ]);
  assert.match(scaffold.stdout, /created .*fixture-skill/);

  const skillDir = join(root, 'fixture-skill');
  const skillText = readFileSync(join(skillDir, 'SKILL.md'), 'utf8');
  assert.match(skillText, /^name: fixture-skill$/m);
  assert.match(skillText, /Use when the user asks to "review fixture workflows"/);

  mkdirSync(join(skillDir, 'assets', 'scripts', '__pycache__'), { recursive: true });
  writeFileSync(join(skillDir, 'assets', 'scripts', '__pycache__', 'helper.cpython-314.pyc'), 'bytecode');

  const inspect = runPython([`${scripts}/inspect_skill.py`, skillDir]);
  const summary = JSON.parse(inspect.stdout);
  assert.equal(summary.name, 'fixture-skill');
  assert.equal(summary.version, '0.1.0');
  assert.ok(summary.body_words > 50);
  assert.deepEqual(summary.references, []);
  assert.ok(!summary.files.some((file) => file.includes('__pycache__') || file.endsWith('.pyc')));

  const validate = runPython([`${scripts}/validate_skill.py`, skillDir]);
  assert.match(validate.stdout, /✓ skill validation passed/);
});

test('skill-architect validate helper fails when pointed at a non-skill directory', () => {
  const root = mkdtempSync(join(tmpdir(), 'skill-architect-nonskill-'));
  mkdirSync(join(root, 'skills', 'skill-architect'), { recursive: true });
  writeFileSync(join(root, 'skills', 'skill-architect', 'SKILL.md'), `---\nname: skill-architect\ndescription: "Use when testing fallback behavior."\n---\n\n# Skill Architect\n`);

  const result = runPythonFail([`${scripts}/validate_skill.py`, root]);
  assert.match(result.stdout, /missing SKILL\.md/);
});

test('skill-architect validate helper fails closed on broken portable skill structure', () => {
  const root = mkdtempSync(join(tmpdir(), 'skill-architect-invalid-'));
  const skillDir = join(root, 'bad-skill');
  mkdirSync(skillDir, { recursive: true });
  writeFileSync(join(skillDir, 'SKILL.md'), `---\nname: wrong-name\ndescription: Loose summary only.\n---\n\n# Bad Skill\n`);

  const result = runPythonFail([`${scripts}/validate_skill.py`, skillDir]);
  assert.match(result.stdout, /frontmatter name 'wrong-name' does not match directory 'bad-skill'/);
  assert.match(result.stdout, /description should include concrete trigger\/use conditions/);
});

test('skill-architect fix helper dry-runs and applies only mechanical fixes', () => {
  const root = mkdtempSync(join(tmpdir(), 'skill-architect-fix-'));
  const skillDir = join(root, 'fix-me');
  mkdirSync(join(skillDir, 'references'), { recursive: true });
  writeFileSync(join(skillDir, 'SKILL.md'), `---\nname: Fix Me\ndescription: "Fix-me workflow support. Use when the user asks to \\\"fix me\\\"."\n---\n\n# Fix Me\n\n## Operating procedure\n\n1. Do the thing.\n`);
  writeFileSync(join(skillDir, 'references', 'details.md'), '# Details\n');

  const dryRun = runPython([`${scripts}/fix_skill.py`, skillDir]);
  assert.match(dryRun.stdout, /normalize frontmatter name 'Fix Me' -> 'fix-me'/);
  assert.match(dryRun.stdout, /link missing references: references\/details.md/);
  assert.match(dryRun.stdout, /dry-run only/);
  assert.match(readFileSync(join(skillDir, 'SKILL.md'), 'utf8'), /^name: Fix Me$/m);

  const write = runPython([`${scripts}/fix_skill.py`, skillDir, '--write']);
  assert.match(write.stdout, /✓ wrote/);
  const fixed = readFileSync(join(skillDir, 'SKILL.md'), 'utf8');
  assert.match(fixed, /^name: fix-me$/m);
  assert.match(fixed, /\[references\/details\.md\]\(references\/details\.md\)/);

  const validate = runPython([`${scripts}/validate_skill.py`, skillDir]);
  assert.match(validate.stdout, /✓ skill validation passed/);
});
