import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import test from 'node:test';

// Fixture portability only: these checks do not grade agent behavior.
for (const skill of ['agent-memory', 'discord-harvest', 'eleventy-nunjucks', 'localhost-screenshots']) {
  test(`${skill} eval inputs materialize in an isolated directory`, () => {
    const catalog = JSON.parse(readFileSync(`skills/${skill}/assets/evals/scenarios.json`, 'utf8'));
    const root = mkdtempSync(join(tmpdir(), 'skill-eval-inputs-'));
    try {
      assert.equal(catalog.schema_version, 1);
      assert.ok(catalog.execution);
      assert.ok(catalog.cases.length);
      assert.equal(new Set(catalog.cases.map(c => c.id)).size, catalog.cases.length);
      for (const c of catalog.cases) {
        assert.match(c.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
        assert.ok(c.prompt && c.assertions.length);
        if (c.prompts) {
          assert.ok(c.prompts.some(p => p.load === true));
          assert.ok(c.prompts.some(p => p.load === false));
          for (const p of c.prompts) {
            assert.equal(typeof p.text, 'string');
            assert.equal(typeof p.load, 'boolean');
          }
          continue;
        }
        assert.ok(c.files && Object.keys(c.files).length, c.id);
        const caseDir = join(root, c.id);
        for (const [path, contents] of Object.entries(c.files)) {
          assert.ok(!path.startsWith('/') && !path.includes('\\') && !path.includes(':') && !path.split('/').some(p => p === '..' || p === ''), path);
          assert.equal(typeof contents, 'string');
          const target = join(caseDir, path);
          mkdirSync(dirname(target), { recursive: true });
          writeFileSync(target, contents);
          assert.equal(readFileSync(target, 'utf8'), contents);
          if (path.endsWith('.json')) JSON.parse(contents);
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
