import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const env = { ...process.env, PYTHONDONTWRITEBYTECODE: '1' };
const scripts = 'skills/skill-architect/assets/scripts';
const python = process.env.SKILL_TEST_PYTHON || 'python3';
const requirements = resolve(scripts, 'requirements.txt');
const inspectScript = resolve(scripts, 'inspect_skill.py');
const validateScript = resolve(scripts, 'validate_skill.py');
const runUvScript = resolve(scripts, 'run_uv.py');
const uvFlags = [
  '--isolated',
  '--no-project',
  '--no-build',
  '--no-config',
  '--with-requirements',
  requirements,
];

function venvPython(venvDir) {
  return process.platform === 'win32'
    ? join(venvDir, 'Scripts', 'python.exe')
    : join(venvDir, 'bin', 'python');
}

function spawn(command, args, options = {}) {
  const { env: extraEnv, ...rest } = options;
  return spawnSync(command, args, {
    encoding: 'utf8',
    env: { ...env, ...extraEnv },
    ...rest,
  });
}

function runCommand(command, args, options = {}) {
  const result = spawn(command, args, options);
  assert.equal(
    result.status,
    0,
    `${command} ${args.join(' ')}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
  );
  return result;
}

function writeSkill(dir, name, description) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, 'SKILL.md'),
    `---\nname: ${name}\ndescription: "${description}"\n---\n\n# ${name}\n`,
  );
}

function writePoisonYaml(parent) {
  const poison = join(parent, 'poison');
  mkdirSync(join(poison, 'yaml'), { recursive: true });
  writeFileSync(join(poison, 'yaml', '__init__.py'), '__version__ = "9.9.9-poison"\n');
  return poison;
}

function provisionVenv(parent) {
  const venvDir = join(parent, 'venv');
  runCommand(python, ['-E', '-m', 'venv', venvDir]);
  const venvPy = venvPython(venvDir);
  runCommand(venvPy, ['-E', '-m', 'pip', '--isolated', 'install', '--require-hashes', '--only-binary=:all:', '-r', requirements], {
    env: { PIP_NO_INDEX: '1' },
  });
  return venvPy;
}

function assertAvailableFindings(result, command) {
  assert.notEqual(result.status, 0, `${command} unexpectedly passed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
  assert.match(result.stdout, /frontmatter name 'wrong-name' does not match directory 'bad-skill'/);
  assert.doesNotMatch(
    `${result.stdout}\n${result.stderr}`,
    /Required uv version|No matching distribution found|ModuleNotFoundError: No module named 'yaml'|PyYAML is required/,
  );
}

test('skill-architect documents the portable isolated validation runner ladder', () => {
  const skill = readFileSync('skills/skill-architect/SKILL.md', 'utf8');
  const evals = JSON.parse(readFileSync('skills/skill-architect/assets/evals/scenarios.json', 'utf8'));
  const documentedUv = 'run_uv.py" run --isolated --no-project --no-build --no-config --with-requirements';

  for (const helper of ['inspect_skill.py', 'validate_skill.py']) {
    assert.match(
      skill,
      new RegExp(`${documentedUv.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]{0,80}python -E[\\s\\S]{0,180}${helper.replace('.', '\\.')}`),
      `missing isolated uv command for ${helper}`,
    );
  }
  assert.match(skill, /python3 -E -m venv "\$VALIDATION_VENV"/);
  assert.match(skill, /pip --isolated install --require-hashes --only-binary=:all:/);
  assert.match(readFileSync(requirements, 'utf8'), /PyYAML==6\.0\.3[\s\\]+--hash=sha256:/i);
  assert.match(skill, /\$ValidationVenv\\Scripts\\python\.exe" -E/);
  assert.match(skill, /never install validation dependencies into the global Python environment/i);
  assert.match(skill, /only after both isolated runner paths are unavailable or fail/i);
  assert.match(skill, /Do not use `python -I`/);
  assert.match(evals.execution, /run_uv\.py with run --isolated --no-project --no-build --no-config --with-requirements python -E/);
  assert.match(evals.execution, /pip --isolated/);
  assert.match(evals.execution, /Never install validation dependencies into global Python/);
  assert.match(evals.execution, /only after both supported isolated runners/);
  assert.match(evals.cases[0].files['AGENTS.md'], /Isolated helper-requirement installs for validation\/inspection are allowed/);
  assert.match(
    evals.cases.find((c) => c.id === 'create').prompt,
    /Do not install project or global dependencies/,
  );
});

test('skill-architect temporary venv runner ignores host pip and PYTHONPATH config', () => {
  const parent = mkdtempSync(join(tmpdir(), 'skill-architect-venv-runner-'));
  const skillDir = join(parent, 'fixture-skill');
  writeSkill(skillDir, 'fixture-skill', 'Review runner isolation. Use when editing SKILL.md files.');
  const poison = writePoisonYaml(parent);
  const venvPy = provisionVenv(parent);

  const inspect = runCommand(venvPy, ['-E', inspectScript, skillDir], { env: { PYTHONPATH: poison } });
  assert.equal(JSON.parse(inspect.stdout).name, 'fixture-skill');
  const poisoned = spawn(venvPy, ['-c', 'import yaml; print(yaml.__version__)'], { env: { PYTHONPATH: poison } });
  assert.equal(poisoned.status, 0, poisoned.stderr);
  assert.match(poisoned.stdout, /9\.9\.9-poison/);
  const isolated = runCommand(venvPy, ['-E', '-c', 'import yaml; print(yaml.__version__)'], { env: { PYTHONPATH: poison } });
  assert.match(isolated.stdout, /^6\.0\.3$/m);
});

test('skill-architect uv isolated runner ignores host uv.toml, PYTHONPATH, and surrounding projects', () => {
  assert.equal(spawn('uv', ['--version']).status, 0, 'uv must be installed; CI pins 0.12.16');
  const project = mkdtempSync(join(tmpdir(), 'skill-architect-uv-project-'));
  mkdirSync(join(project, 'probe_project'));
  writeFileSync(join(project, 'probe_project', '__init__.py'), 'x = 1\n');
  writeFileSync(
    join(project, 'pyproject.toml'),
    `[build-system]\nrequires = ["setuptools>=61"]\nbuild-backend = "setuptools.build_meta"\n[project]\nname = "probe-project"\nversion = "0.0.1"\nrequires-python = ">=3.10"\ndependencies = ["rich==13.9.4"]\n[tool.setuptools.packages.find]\nwhere = ["."]\n`,
  );
  writeFileSync(join(project, 'uv.toml'), 'required-version = "==0.0.0"\n');
  const poison = writePoisonYaml(project);
  const skillDir = join(project, 'fixture-skill');
  writeSkill(skillDir, 'fixture-skill', 'Review runner isolation. Use when editing SKILL.md files.');

  const blocked = spawn('uv', ['run', '--isolated', '--no-project', '--no-build', '--with-requirements', requirements, 'python', '-c', 'print("ran")'], {
    cwd: project,
  });
  assert.notEqual(blocked.status, 0, blocked.stdout + blocked.stderr);
  assert.match(blocked.stderr + blocked.stdout, /Required uv version/);

  const hostileUvEnv = {
    PYTHONPATH: poison,
    UV_INDEX_URL: 'http://127.0.0.1:9/simple',
    UV_INSECURE_HOST: '127.0.0.1',
    UV_NO_BINARY: 'true',
    UV_NO_VERIFY_HASHES: 'true',
  };
  const hostile = spawn('uv', ['run', ...uvFlags, 'python', '-E', '-c', 'import yaml'], {
    cwd: project,
    env: hostileUvEnv,
  });
  assert.notEqual(hostile.status, 0, 'direct uv unexpectedly ignored hostile UV_* settings');

  const probe = runCommand(python, [
    '-E',
    runUvScript,
    'run',
    ...uvFlags,
    'python',
    '-E',
    '-c',
    'mods=[]\nfor n in ("yaml","rich"):\n    try:\n        m=__import__(n); mods.append(n+"="+getattr(m,"__version__","yes"))\n    except Exception as e:\n        mods.append(n+"="+type(e).__name__)\nprint(",".join(mods))\n',
  ], { cwd: project, env: hostileUvEnv });
  assert.match(probe.stdout, /yaml=6\.0\.3/);
  assert.match(probe.stdout, /rich=ModuleNotFoundError/);
  assert.doesNotMatch(probe.stderr + probe.stdout, /Building probe-project|Built probe-project|Required uv version/);

  const inspect = runCommand(python, ['-E', runUvScript, 'run', ...uvFlags, 'python', '-E', inspectScript, skillDir], {
    cwd: project,
    env: hostileUvEnv,
  });
  assert.equal(JSON.parse(inspect.stdout).name, 'fixture-skill');
});

test('skill-architect runners treat validator non-zero output as available findings', () => {
  assert.equal(spawn('uv', ['--version']).status, 0, 'uv must be installed; CI pins 0.12.16');
  const parent = mkdtempSync(join(tmpdir(), 'skill-architect-findings-'));
  const skillDir = join(parent, 'bad-skill');
  writeSkill(skillDir, 'wrong-name', 'Loose summary only.');
  const venvPy = provisionVenv(parent);

  const venvResult = spawn(venvPy, ['-E', validateScript, skillDir]);
  assertAvailableFindings(venvResult, 'venv validate');

  const uvResult = spawn(python, ['-E', runUvScript, 'run', ...uvFlags, 'python', '-E', validateScript, skillDir], { cwd: parent });
  assertAvailableFindings(uvResult, 'uv validate');
});

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
