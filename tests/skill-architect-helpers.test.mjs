import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const env = { ...process.env, PYTHONDONTWRITEBYTECODE: '1' };
const scripts = 'skills/skill-architect/assets/scripts';
const python = process.env.SKILL_TEST_PYTHON || 'python3';

function runPython(args, options = {}) {
  const result = spawnSync(python, args, {
    encoding: 'utf8',
    env,
    ...options,
  });
  assert.equal(result.status, 0, `${args.join(' ')}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
  return result;
}

function runPythonFail(args, options = {}) {
  const result = spawnSync(python, args, {
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
  assert.match(skillText, /Use when asked to \\"review fixture workflows\\"/);

  mkdirSync(join(skillDir, 'assets', 'scripts', '__pycache__'), { recursive: true });
  writeFileSync(join(skillDir, 'assets', 'scripts', '__pycache__', 'helper.cpython-314.pyc'), 'bytecode');

  const inspect = runPython([`${scripts}/inspect_skill.py`, skillDir]);
  const summary = JSON.parse(inspect.stdout);
  assert.equal(summary.name, 'fixture-skill');
  assert.equal(summary.version, '0.1.0');
  assert.match(summary.description, /Use when asked to "review fixture workflows"/);
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

test('skill-architect validate helper rejects generic trigger-only descriptions', () => {
  const root = mkdtempSync(join(tmpdir(), 'skill-architect-generic-description-'));
  const skillDir = join(root, 'weak-skill');
  mkdirSync(skillDir, { recursive: true });
  writeFileSync(join(skillDir, 'SKILL.md'), `---\nname: weak-skill\ndescription: "Use when creating skills."\n---\n\n# Weak Skill\n`);

  const result = runPythonFail([`${scripts}/validate_skill.py`, skillDir]);
  assert.match(result.stdout, /description trigger\/use conditions are too generic/);
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

const validDescription = 'description: \'Use when reviewing "SKILL.md" files.\'';
for (const [label, slug, frontmatter, expected] of [
  ['blank description', 'fixture', 'name: fixture\ndescription:', /description must be a non-empty string/],
  ['blank name', 'fixture', `name:\n${validDescription}`, /name must be a non-empty string/],
  ['consecutive hyphens', 'bad--name', `name: bad--name\n${validDescription}`, /consecutive hyphens/],
  ['leading hyphen', '-bad', `name: -bad\n${validDescription}`, /leading, trailing/],
  ['long name', 'a'.repeat(65), `name: ${'a'.repeat(65)}\n${validDescription}`, /1-64/],
  ['malformed YAML', 'fixture', `name: fixture\n${validDescription}\nmetadata: [unclosed`, /invalid YAML/],
  ['duplicate key', 'fixture', `name: fixture\n${validDescription}\nname: fixture`, /duplicate YAML key/],
  ['typed description', 'fixture', 'name: fixture\ndescription: [review, files]', /description must be a non-empty string/],
  ['long description', 'fixture', `name: fixture\ndescription: ${'a'.repeat(1025)}`, /at most 1024/],
  ['long compatibility', 'fixture', `name: fixture\n${validDescription}\ncompatibility: ${'x'.repeat(501)}`, /at most 500/],
  ['typed metadata', 'fixture', `name: fixture\n${validDescription}\nmetadata:\n  version: 1`, /metadata must map/],
  ['unsafe YAML tag', 'fixture', `name: fixture\n${validDescription}\nmetadata: !!python/object:os.PathLike {}`, /invalid YAML/],
]) {
  test(`portable validator rejects ${label}`, () => {
    const dir = join(mkdtempSync(join(tmpdir(), 'skill-invalid-')), slug);
    mkdirSync(dir);
    writeFileSync(join(dir, 'SKILL.md'), `---\n${frontmatter}\n---\n\n# Fixture\n`);
    const result = runPythonFail([`${scripts}/validate_skill.py`, dir]);
    assert.match(result.stdout, expected);
  });
}

test('portable validator and inspector accept folded YAML and quoted metadata', () => {
  const dir = join(mkdtempSync(join(tmpdir(), 'skill-yaml-')), 'fixture');
  mkdirSync(dir);
  writeFileSync(join(dir, 'SKILL.md'), `---\nname: fixture\ndescription: >-\n  Review skill structure.\n  Use when editing "SKILL.md" files.\nmetadata:\n  version: "1.0.0"\n---\n\n# Fixture\n`);
  runPython([`${scripts}/validate_skill.py`, dir]);
  const result = JSON.parse(runPython([`${scripts}/inspect_skill.py`, dir]).stdout);
  assert.equal(result.version, '1.0.0');
  assert.equal(result.description, 'Review skill structure. Use when editing "SKILL.md" files.');
});

test('portable validator recognizes a concrete CSV cue without formatting workarounds', () => {
  const dir = join(mkdtempSync(join(tmpdir(), 'skill-csv-')), 'fixture');
  mkdirSync(dir);
  writeFileSync(join(dir, 'SKILL.md'), '---\nname: fixture\ndescription: "Create monthly reports. Use when asked to review sales.csv or summarize monthly revenue."\n---\n\n# Fixture\n');
  runPython([`${scripts}/validate_skill.py`, dir]);
});


test('validation and inspection fail explicitly when their YAML dependency is unavailable', () => {
  const dir = join(mkdtempSync(join(tmpdir(), 'skill-no-yaml-')), 'fixture');
  mkdirSync(dir);
  writeFileSync(join(dir, 'SKILL.md'), '---\nname: fixture\ndescription: Use when reviewing "SKILL.md" files.\n---\n\n# Fixture\n');
  for (const helper of ['validate_skill.py', 'inspect_skill.py']) {
    const result = runPythonFail(['-S', `${scripts}/${helper}`, dir]);
    assert.match(result.stdout + result.stderr, /PyYAML is required/);
    assert.doesNotMatch(result.stdout, /skill validation passed/);
  }
});


for (const [label, name, metadata] of [
  ['folded', '>-\n  fixture', ''],
  ['anchored', '&slug fixture', 'metadata:\n  author: *slug\n'],
  ['tagged', '!!str fixture', ''],
]) {
  test(`fixer refuses ${label} YAML names without corrupting valid input`, () => {
    const dir = join(mkdtempSync(join(tmpdir(), 'skill-fix-yaml-')), 'fixture');
    mkdirSync(dir);
    const original = `---\nname: ${name}\ndescription: Use when reviewing "SKILL.md" files.\n${metadata}---\n\n# Fixture\n`;
    writeFileSync(join(dir, 'SKILL.md'), original);
    runPython([`${scripts}/validate_skill.py`, dir]);
    for (const flags of [[], ['--write']]) {
      const result = runPythonFail([`${scripts}/fix_skill.py`, dir, ...flags]);
      assert.match(result.stderr, /unsupported YAML name shape/);
      assert.equal(readFileSync(join(dir, 'SKILL.md'), 'utf8'), original);
    }
    runPython([`${scripts}/validate_skill.py`, dir]);
  });
}

for (const [label, frontmatter] of [
  ['indented mapping', '  name: fixture\n  description: Use when reviewing "SKILL.md" files.'],
  ['escaped name key', '"na\\u006de": fixture\ndescription: Use when reviewing "SKILL.md" files.'],
  ['explicit name key', '? name\n: fixture\ndescription: Use when reviewing "SKILL.md" files.'],
]) {
  test(`fixer refuses ${label} before any name or reference edits`, () => {
    const dir = join(mkdtempSync(join(tmpdir(), 'skill-key-shape-')), 'fixture');
    mkdirSync(join(dir, 'references'), { recursive: true });
    const original = `---\n${frontmatter}\n---\n\n# Fixture\n`;
    writeFileSync(join(dir, 'SKILL.md'), original);
    // The unrelated missing link must not cause a partial write after refusal.
    writeFileSync(join(dir, 'references', 'details.md'), '# Details\n');
    const parsed = JSON.parse(runPython([`${scripts}/inspect_skill.py`, dir]).stdout);
    assert.equal(parsed.name, 'fixture');
    for (const flags of [[], ['--write']]) {
      const result = runPythonFail(['-S', `${scripts}/fix_skill.py`, dir, ...flags]);
      assert.match(result.stderr, /unsupported YAML mapping key shape/);
      assert.equal(readFileSync(join(dir, 'SKILL.md'), 'utf8'), original);
    }
    assert.equal(JSON.parse(runPython([`${scripts}/inspect_skill.py`, dir]).stdout).name, 'fixture');
  });
}

test('fixer retains missing-name insertion for a supported mapping without PyYAML', () => {
  const dir = join(mkdtempSync(join(tmpdir(), 'skill-missing-name-')), 'fixture');
  mkdirSync(dir);
  const original = '---\n# Leading comment\ndescription: Use when reviewing "SKILL.md" files.\nmetadata:\n  version: "1.0.0"\n---\n\n# Fixture\n';
  writeFileSync(join(dir, 'SKILL.md'), original);
  runPython(['-S', `${scripts}/fix_skill.py`, dir]);
  assert.equal(readFileSync(join(dir, 'SKILL.md'), 'utf8'), original);
  runPython(['-S', `${scripts}/fix_skill.py`, dir, '--write']);
  runPython([`${scripts}/validate_skill.py`, dir]);
  assert.match(readFileSync(join(dir, 'SKILL.md'), 'utf8'), /^name: fixture$/m);
});
