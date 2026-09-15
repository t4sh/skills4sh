import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, mkdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import test from 'node:test';

const contract = JSON.parse(readFileSync('skills/eval-catalog-strict-schema.json', 'utf8'));
const typeOf = value => Array.isArray(value) ? 'array' : value === null ? 'null' : typeof value;
function validateCatalog(catalog) {
  for (const key of contract.catalog_required_keys) assert.ok(Object.hasOwn(catalog, key), key);
  assert.equal(catalog.schema_version, contract.schema_version);
  for (const key of ['purpose', 'execution']) assert.ok(typeof catalog[key] === 'string' && catalog[key].trim(), key);
  assert.ok(Array.isArray(catalog.cases) && catalog.cases.length);
  assert.equal(new Set(catalog.cases.map(c => c.id)).size, catalog.cases.length, 'duplicate IDs');
  for (const c of catalog.cases) {
    for (const key of contract.required_keys) assert.ok(Object.hasOwn(c, key), key);
    for (const [key, value] of Object.entries(c)) {
      assert.ok(Object.hasOwn(contract.types, key), `unknown field: ${key}`);
      assert.equal(typeOf(value), contract.types[key], key);
    }
    assert.match(c.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.ok(c.prompt.trim());
    assert.ok(c.assertions.length);
    for (const assertion of c.assertions) {
      assert.equal(typeof assertion, contract.constraints.assertions_items_type);
      assert.ok(assertion.trim());
    }
    if (c.kind) assert.ok(contract.constraints.kinds.includes(c.kind), 'kind');
    const routing = c.kind === 'description-only-routing' || (!c.kind && c.prompts);
    if (!routing) {
      assert.ok(!c.prompts, 'workflow cannot contain routing prompts');
      assert.ok(c.files && Object.keys(c.files).length, 'workflow requires files');
    } else {
      assert.ok(!c.files || Object.keys(c.files).length === 0, 'routing cannot contain fixture files');
    }
    if (c.prompts) {
      assert.ok(c.prompts.length);
      for (const p of c.prompts) {
        assert.equal(typeof p.text, 'string');
        assert.ok(p.text.trim());
        assert.equal(typeof p.load, 'boolean');
      }
    }
    for (const [path, contents] of Object.entries(c.files ?? {})) {
      assert.ok(!path.startsWith('/') && !path.includes('\\') && !path.includes(':') && !path.split('/').some(p => ['..', '.', ''].includes(p)), path);
      assert.equal(typeof contents, contract.constraints.files_values_type);
      if (path.endsWith('.json')) JSON.parse(contents);
    }
  }
}

// Fixture portability only: these checks do not grade agent behavior.
const skills = readdirSync('skills', { withFileTypes: true })
  .filter(d => d.isDirectory() && existsSync(`skills/${d.name}/assets/evals/scenarios.json`))
  .map(d => d.name).sort();
assert.ok(skills.length, 'no eval catalogs discovered');
for (const skill of skills) {
  test(`${skill} eval inputs satisfy the shared contract and materialize`, () => {
    const catalog = JSON.parse(readFileSync(`skills/${skill}/assets/evals/scenarios.json`, 'utf8'));
    validateCatalog(catalog);
    const root = mkdtempSync(join(tmpdir(), 'skill-eval-inputs-'));
    try {
      for (const c of catalog.cases) {
        const caseDir = join(root, c.id);
        mkdirSync(caseDir);
        for (const [path, contents] of Object.entries(c.files ?? {})) {
          const target = join(caseDir, path);
          mkdirSync(dirname(target), { recursive: true });
          writeFileSync(target, contents);
          assert.equal(readFileSync(target, 'utf8'), contents);
        }
        const prompt = c.prompt.replaceAll('OUTPUT', join(caseDir, 'output'));
        writeFileSync(join(caseDir, 'CASE.txt'), prompt);
        assert.equal(readFileSync(join(caseDir, 'CASE.txt'), 'utf8'), prompt);
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
}

const valid = () => ({ schema_version: 1, purpose: 'Fixture', execution: 'Isolated', cases: [{ id: 'sample', prompt: 'Inspect', files: { 'input.md': 'data' }, assertions: ['Preserves input'] }] });
for (const [name, mutate] of Object.entries({
  'object assertion': d => { d.cases[0].assertions = [{}]; },
  'array file content': d => { d.cases[0].files['input.md'] = []; },
  'path traversal': d => { d.cases[0].files = { '../outside': '' }; },
  'duplicate IDs': d => { d.cases.push(structuredClone(d.cases[0])); },
  'unknown kind': d => { d.cases[0].kind = 'other'; },
  'workflow without files': d => { d.cases[0].files = {}; },
  'mislabeled workflow': d => { d.cases[0].kind = 'workflow'; d.cases[0].prompts = [{ text: 'Route', load: true }]; },
  'nonboolean label': d => { d.cases[0].files = {}; d.cases[0].prompts = [{ text: 'Route', load: 'true' }]; },
})) {
  test(`eval contract rejects ${name}`, () => {
    const d = valid(); mutate(d); assert.throws(() => validateCatalog(d));
  });
}
