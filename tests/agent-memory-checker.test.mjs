import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';

// Runs the real script as a child process against real fixture trees.
const SCRIPT = resolve('skills/agent-memory/assets/scripts/check-memory.mjs');
const TODAY = '2026-11-21';

function run(args) {
  const result = spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8' });
  assert.equal(result.error, undefined);
  return result;
}

function runJson(root, extra = []) {
  const result = run([root, '--json', '--today', TODAY, ...extra]);
  return { status: result.status, stderr: result.stderr, report: JSON.parse(result.stdout) };
}

function memoryFile(id, fields = {}) {
  const [dir] = id.split('/');
  const type = { decisions: 'decision', conventions: 'convention', references: 'reference', sessions: 'session' }[dir] ?? dir;
  const merged = {
    id,
    type,
    title: `"Title of ${id}"`,
    description: 'Fixture fact.',
    tags: '[fixture]',
    source: 'other',
    created: '2026-08-01',
    updated: '2026-08-02',
    status: 'active',
    ...fields,
  };
  const lines = Object.entries(merged).filter(([, value]) => value !== undefined).map(([key, value]) => `${key}: ${value}`);
  return `---\n${lines.join('\n')}\n---\n\nBody text. A colon: here, and a --- rule, must not matter.\n`;
}

function indexEntry(id, fields = {}) {
  const [dir] = id.split('/');
  const type = { decisions: 'decision', conventions: 'convention', references: 'reference', sessions: 'session' }[dir] ?? dir;
  const merged = { id, type, title: `"Title of ${id}"`, status: 'active', ...fields };
  const lines = Object.entries(merged).filter(([, value]) => value !== undefined).map(([key, value]) => `${key}: ${value}`);
  return `- ${lines.join('\n  ')}\n`;
}

// files: { 'relative/path': 'contents' } below a fresh temp project root.
function withProject(files, fn) {
  const root = mkdtempSync(join(tmpdir(), 'agent-memory-checker-'));
  try {
    for (const [path, contents] of Object.entries(files)) {
      const target = join(root, path);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, contents);
    }
    return fn(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function cleanProject(overrides = {}) {
  return {
    '.agent-memory/README.md': '# Agent memory\nNot a memory entry.\n',
    '.agent-memory/index.yaml': `# registry\n\n${indexEntry('decisions/storage')}\n${indexEntry('context/sprint')}`,
    '.agent-memory/decisions/storage.md': memoryFile('decisions/storage'),
    '.agent-memory/context/sprint.md': memoryFile('context/sprint'),
    ...overrides,
  };
}

function snapshot(dir) {
  const hash = createHash('sha256');
  const walk = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const path = join(current, entry.name);
      hash.update(`${path}\0${entry.isDirectory() ? 'dir' : 'file'}\0`);
      if (entry.isDirectory()) walk(path);
      else if (entry.isFile()) hash.update(readFileSync(path)).update(String(statSync(path).mtimeMs));
    }
  };
  walk(dir);
  return hash.digest('hex');
}

const codes = (report) => report.errors.map((error) => error.code).sort();

test('clean tree passes with exit 0 and counts files and entries', () => {
  withProject(cleanProject(), (root) => {
    const { status, report } = runJson(root);
    assert.equal(status, 0);
    assert.equal(report.ok, true);
    assert.deepEqual(report.errors, []);
    assert.deepEqual(report.review, []);
    assert.equal(report.summary.files, 2);
    assert.equal(report.summary.indexEntries, 2);
    assert.equal(report.summary.byType.decision, 1);
    assert.equal(report.summary.byType.context, 1);
    assert.deepEqual(report.summary.byStatus, { active: 2, archived: 0, unknown: 0 });
    assert.equal(report.summary.unindexedFiles, 0);
    assert.equal(report.summary.orphanEntries, 0);
    assert.equal(report.summary.mismatchedFiles, 0);
  });
});

test('accepts the .agent-memory path itself and prints text by default', () => {
  withProject(cleanProject(), (root) => {
    const result = run([join(root, '.agent-memory'), '--today', TODAY]);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /Memory files: 2 {3}Index entries: 2/);
    assert.match(result.stdout, /Result: no errors, 0 review item\(s\)\. Nothing was changed\./);
  });
});

test('empty [] index with no memory files is clean', () => {
  withProject({ '.agent-memory/index.yaml': '[]\n' }, (root) => {
    const { status, report } = runJson(root);
    assert.equal(status, 0);
    assert.equal(report.summary.indexEntries, 0);
  });
});

test('reads the YAML forms the templates use, plus CRLF line endings', () => {
  const file = [
    '---',
    'id: decisions/storage',
    'type: decision',
    'title: "Storage: the choice"   # quoted because of the colon',
    'description: >-',
    '  Folded text on',
    '  two lines: with a colon.',
    'tags:',
    '  - storage',
    "  - 'data base'",
    'source: claude-code',
    'created: 2026-08-01',
    'updated: 2026-08-02',
    'status: active',
    '---',
    'Body',
    '',
  ].join('\r\n');
  const index = [
    '---',
    '# registry',
    '- id: decisions/storage',
    '  type: decision',
    "  title: 'Storage: the choice'",
    '  status: active   # trailing comment',
    '  tags: [storage, "data base"]',
    '  description: |',
    '    Literal block',
    '    # not a comment',
    '',
  ].join('\r\n');
  withProject({ '.agent-memory/index.yaml': index, '.agent-memory/decisions/storage.md': file }, (root) => {
    const { status, report } = runJson(root);
    assert.deepEqual(report.errors, []);
    assert.equal(status, 0);
  });
});

test('memory file without an index entry is an error', () => {
  withProject(cleanProject({ '.agent-memory/conventions/format.md': memoryFile('conventions/format') }), (root) => {
    const { status, report } = runJson(root);
    assert.equal(status, 1);
    assert.deepEqual(codes(report), ['unindexed-file']);
    assert.equal(report.errors[0].id, 'conventions/format');
    assert.equal(report.summary.unindexedFiles, 1);
  });
});

test('index entry without a file is an error', () => {
  const index = `${indexEntry('decisions/storage')}${indexEntry('context/sprint')}${indexEntry('context/missing')}`;
  withProject(cleanProject({ '.agent-memory/index.yaml': index }), (root) => {
    const { status, report } = runJson(root);
    assert.equal(status, 1);
    assert.deepEqual(codes(report), ['orphan-entry']);
    assert.equal(report.errors[0].id, 'context/missing');
    assert.equal(report.summary.orphanEntries, 1);
  });
});

test('index type, title, or status that differs from the frontmatter is an error per field, counted once per file', () => {
  const files = cleanProject({
    '.agent-memory/decisions/storage.md': memoryFile('decisions/storage', { status: 'archived', title: '"Storage, revised"' }),
  });
  withProject(files, (root) => {
    const { status, report } = runJson(root);
    assert.equal(status, 1);
    assert.deepEqual(codes(report), ['index-mismatch', 'index-mismatch']);
    const byField = Object.fromEntries(report.errors.map((error) => [error.field, error]));
    assert.equal(byField.status.index, 'active');
    assert.equal(byField.status.file, 'archived');
    assert.equal(byField.title.file, 'Storage, revised');
    assert.equal(report.summary.mismatchedFiles, 1);
  });
});

test('quoting differences alone are not a mismatch', () => {
  const files = cleanProject({
    '.agent-memory/index.yaml': `${indexEntry('decisions/storage', { title: 'Plain title' })}${indexEntry('context/sprint')}`,
    '.agent-memory/decisions/storage.md': memoryFile('decisions/storage', { title: "'Plain title'" }),
  });
  withProject(files, (root) => {
    const { status, report } = runJson(root);
    assert.deepEqual(report.errors, []);
    assert.equal(status, 0);
  });
});

test('frontmatter id that does not match the path is an error', () => {
  withProject(cleanProject({ '.agent-memory/decisions/storage.md': memoryFile('decisions/storage', { id: 'decisions/database' }) }), (root) => {
    const { status, report } = runJson(root);
    assert.equal(status, 1);
    const error = report.errors.find((item) => item.code === 'id-mismatch');
    assert.equal(error.expected, 'decisions/storage');
    assert.equal(error.found, 'decisions/database');
    assert.equal(error.path, '.agent-memory/decisions/storage.md');
  });
});

test('type/directory, status, date, and required-field problems are errors', () => {
  const files = cleanProject({
    '.agent-memory/index.yaml': [
      indexEntry('decisions/storage', { type: 'context' }),
      indexEntry('context/sprint', { status: 'done' }),
      indexEntry('sessions/first'),
      indexEntry('project/overview'),
    ].join(''),
    '.agent-memory/decisions/storage.md': memoryFile('decisions/storage', { type: 'context' }),
    '.agent-memory/context/sprint.md': memoryFile('context/sprint', { status: 'done' }),
    '.agent-memory/sessions/first.md': memoryFile('sessions/first', { created: '2026-02-30', updated: '26-08-02', expires: '2026-13-01' }),
    '.agent-memory/project/overview.md': memoryFile('project/overview', { source: undefined, description: '', type: 'note' }),
  });
  withProject(files, (root) => {
    const { status, report } = runJson(root);
    assert.equal(status, 1);
    assert.deepEqual(codes(report), [
      'index-mismatch', // index says project, file says note
      'invalid-date', 'invalid-date', 'invalid-date',
      'invalid-status',
      'invalid-type',
      'missing-field', 'missing-field',
      'type-directory-mismatch',
    ]);
    assert.deepEqual(report.errors.filter((e) => e.code === 'invalid-date').map((e) => e.field).sort(), ['created', 'expires', 'updated']);
    assert.deepEqual(report.errors.filter((e) => e.code === 'missing-field').map((e) => e.field).sort(), ['description', 'source']);
    assert.equal(report.summary.byStatus.unknown, 1);
  });
});

test('index entries need id, type, title, and status, and ids must be unique', () => {
  const index = `- id: decisions/storage\n  type: decision\n${indexEntry('context/sprint')}${indexEntry('context/sprint')}`;
  withProject(cleanProject({ '.agent-memory/index.yaml': index }), (root) => {
    const { status, report } = runJson(root);
    assert.equal(status, 1);
    assert.deepEqual(codes(report), ['index-duplicate-id', 'index-missing-field', 'index-missing-field']);
    assert.deepEqual(report.errors.filter((e) => e.code === 'index-missing-field').map((e) => e.field).sort(), ['status', 'title']);
  });
});

for (const [name, index, reason] of [
  ['a top-level mapping', 'entries:\n  - id: decisions/storage\n', /must be a YAML sequence/],
  ['an anchor', '- id: &a decisions/storage\n  type: decision\n  title: T\n  status: active\n', /unsupported YAML syntax/],
  ['an unquoted colon in a value', '- id: decisions/storage\n  type: decision\n  title: Storage: choice\n  status: active\n', /quote it/],
  ['a tab indent', '- id: decisions/storage\n\ttype: decision\n', /tab used for indentation/],
  ['a flow mapping', '- {id: decisions/storage, type: decision}\n', /expected "key: value"/],
  ['a scalar entry', '- decisions/storage\n', /expected "key: value"/],
  ['an unclosed quote', '- id: decisions/storage\n  title: "open\n', /not closed/],
  ['a duplicate key', '- id: decisions/storage\n  id: context/sprint\n', /duplicate key/],
  ['an empty file', '# nothing here\n', /index is empty/],
]) {
  test(`index with ${name} fails closed instead of guessing`, () => {
    withProject(cleanProject({ '.agent-memory/index.yaml': index }), (root) => {
      const { status, report } = runJson(root);
      assert.equal(status, 1);
      assert.deepEqual(codes(report), ['index-unparsed']);
      assert.match(report.errors[0].message, reason);
      assert.match(report.errors[0].message, /nothing was assumed/);
      // Parity is unknown, not zero, and the files are still checked.
      assert.equal(report.summary.indexEntries, null);
      assert.equal(report.summary.unindexedFiles, null);
      assert.equal(report.summary.files, 2);
    });
  });
}

test('malformed or missing frontmatter is reported per file without guessing', () => {
  const files = cleanProject({
    '.agent-memory/decisions/storage.md': '---\nid: decisions/storage\ntitle: Storage: choice\n---\nBody\n',
    '.agent-memory/context/sprint.md': 'No frontmatter here.\n',
    '.agent-memory/index.yaml': `${indexEntry('decisions/storage')}${indexEntry('context/sprint')}${indexEntry('sessions/open')}`,
    '.agent-memory/sessions/open.md': '---\nid: sessions/open\ntype: session\n\nNever closed.\n',
  });
  withProject(files, (root) => {
    const { status, report } = runJson(root);
    assert.equal(status, 1);
    assert.deepEqual(codes(report), ['frontmatter-missing', 'frontmatter-unparsed', 'frontmatter-unparsed']);
    const unparsed = report.errors.filter((e) => e.code === 'frontmatter-unparsed');
    assert.match(unparsed.find((e) => e.id === 'decisions/storage').message, /line 3: .*quote it/);
    assert.match(unparsed.find((e) => e.id === 'sessions/open').message, /not closed/);
    // Unreadable files are not compared with the index.
    assert.equal(report.summary.mismatchedFiles, 0);
  });
});

test('missing .agent-memory is an error with exit 1, not a usage error', () => {
  withProject({ 'README.md': '# Project\n' }, (root) => {
    const { status, report } = runJson(root);
    assert.equal(status, 1);
    assert.deepEqual(codes(report), ['memory-dir-missing']);
    assert.equal(report.summary, null);
    assert.equal(existsSync(join(root, '.agent-memory')), false);

    const text = run([root]);
    assert.equal(text.status, 1);
    assert.match(text.stdout, /\[memory-dir-missing\]/);
  });
});

test('missing index.yaml is an error and names a legacy INDEX.yaml', () => {
  const files = cleanProject();
  const index = files['.agent-memory/index.yaml'];
  delete files['.agent-memory/index.yaml'];
  withProject(files, (root) => {
    assert.deepEqual(codes(runJson(root).report), ['index-missing']);
  });
  withProject({ ...files, '.agent-memory/INDEX.yaml': index }, (root) => {
    const { status, report } = runJson(root);
    assert.equal(status, 1);
    assert.deepEqual(codes(report), ['index-missing']);
    assert.match(report.errors[0].message, /INDEX\.yaml is the legacy name/);
  });
});

test('past expires and a superseded file that is still active are review items, not errors', () => {
  const files = cleanProject({
    '.agent-memory/index.yaml': [
      indexEntry('decisions/storage'),
      indexEntry('context/sprint'),
      indexEntry('decisions/storage-v2'),
      indexEntry('context/old', { status: 'archived' }),
    ].join(''),
    '.agent-memory/context/sprint.md': memoryFile('context/sprint', { expires: '2026-09-01' }),
    '.agent-memory/decisions/storage-v2.md': memoryFile('decisions/storage-v2', { supersedes: 'decisions/storage' }),
    '.agent-memory/context/old.md': memoryFile('context/old', { status: 'archived', expires: '2026-01-01' }),
  });
  withProject(files, (root) => {
    const { status, report } = runJson(root);
    assert.equal(status, 0);
    assert.deepEqual(report.errors, []);
    assert.deepEqual(report.review.map((item) => [item.code, item.id]).sort(), [
      ['expired', 'context/sprint'],
      ['superseded-still-active', 'decisions/storage'],
    ]);
    assert.equal(report.review.find((item) => item.code === 'superseded-still-active').supersededBy, 'decisions/storage-v2');

    const earlier = JSON.parse(run([root, '--json', '--today=2026-08-15']).stdout);
    assert.deepEqual(earlier.review.map((item) => item.code), ['superseded-still-active']);
  });
});

test('files outside the type directories are review items and README.md is ignored', () => {
  const files = cleanProject({
    '.agent-memory/project--overview.md': '---\nsummary: Legacy flat file\n---\nBody\n',
    '.agent-memory/notes/idea.md': 'Loose note.\n',
    '.agent-memory/decisions/.gitkeep': '',
  });
  withProject(files, (root) => {
    const { status, report } = runJson(root);
    assert.equal(status, 0);
    assert.deepEqual(report.review.map((item) => [item.code, item.path]).sort(), [
      ['outside-type-directory', '.agent-memory/notes/'],
      ['outside-type-directory', '.agent-memory/project--overview.md'],
    ]);
  });
});

test('symbolic links are reported and never followed', (t) => {
  withProject(cleanProject({ 'outside/secret.md': memoryFile('decisions/secret') }), (root) => {
    try {
      symlinkSync(join(root, 'outside', 'secret.md'), join(root, '.agent-memory', 'decisions', 'secret.md'));
      symlinkSync(join(root, 'outside'), join(root, '.agent-memory', 'references'));
    } catch {
      t.skip('symbolic links are not available on this platform');
      return;
    }
    const { status, report } = runJson(root);
    assert.equal(status, 0);
    assert.equal(report.summary.files, 2);
    assert.deepEqual(report.review.map((item) => [item.code, item.path]).sort(), [
      ['symlink-skipped', '.agent-memory/decisions/secret.md'],
      ['symlink-skipped', '.agent-memory/references'],
    ]);

    // A link given as the path argument is the caller's choice and is followed;
    // a linked .agent-memory below a project root is not.
    symlinkSync(root, `${root}-link`);
    try {
      assert.equal(runJson(`${root}-link`).status, 0);
    } finally {
      rmSync(`${root}-link`);
    }
    mkdirSync(join(root, 'elsewhere'));
    symlinkSync(join(root, '.agent-memory'), join(root, 'elsewhere', '.agent-memory'));
    const linked = runJson(join(root, 'elsewhere'));
    assert.equal(linked.status, 1);
    assert.deepEqual(codes(linked.report), ['memory-dir-missing']);
    assert.match(linked.report.errors[0].message, /symbolic link, which is not followed/);
  });
});

test('usage errors exit 2 with a message on stderr and nothing on stdout', () => {
  withProject(cleanProject(), (root) => {
    for (const [args, message] of [
      [['--bogus'], /unknown option: --bogus/],
      [[join(root, 'does-not-exist')], /not a directory/],
      [[join(root, '.agent-memory', 'index.yaml')], /not a directory/],
      [[root, root], /only one path/],
      [[root, '--today', '2026-02-30'], /--today needs a valid YYYY-MM-DD date/],
      [[root, '--today'], /--today needs a valid YYYY-MM-DD date/],
    ]) {
      const result = run(args);
      assert.equal(result.status, 2, args.join(' '));
      assert.match(result.stderr, message);
      assert.equal(result.stdout, '');
    }
  });
});

test('--help exits 0 and documents arguments and exit codes', () => {
  for (const flag of ['--help', '-h']) {
    const result = run([flag]);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /^Usage: node check-memory\.mjs \[path\] \[--json\] \[--today YYYY-MM-DD\]/);
    assert.match(result.stdout, /Exit codes: 0 no errors, 1 errors found, 2 usage error\./);
    assert.equal(result.stderr, '');
  }
});

test('never changes the tree it checks, clean or broken', () => {
  const broken = cleanProject({
    '.agent-memory/index.yaml': `${indexEntry('decisions/storage', { status: 'archived' })}${indexEntry('context/missing')}`,
    '.agent-memory/conventions/format.md': memoryFile('conventions/format', { id: 'conventions/other' }),
    '.agent-memory/sessions/bad.md': '---\ntitle: Bad: yaml\n---\n',
  });
  for (const files of [cleanProject(), broken]) {
    withProject(files, (root) => {
      const before = snapshot(root);
      run([root, '--today', TODAY]);
      run([root, '--json', '--today', TODAY]);
      run([join(root, '.agent-memory')]);
      assert.equal(snapshot(root), before);
    });
  }
});

test("runs against this repository's own .agent-memory without changing it", (t) => {
  if (!existsSync('.agent-memory')) {
    t.skip('no .agent-memory in this checkout');
    return;
  }
  const before = snapshot('.agent-memory');
  const result = run(['.', '--json']);
  // The content of project memory is not this test's to assert; the checker must
  // read it, report in the documented shape, and leave it alone.
  assert.ok([0, 1].includes(result.status), result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, result.status === 0);
  assert.equal(typeof report.summary.files, 'number');
  assert.ok(Array.isArray(report.errors) && Array.isArray(report.review));
  assert.equal(snapshot('.agent-memory'), before);
});
