import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, readdirSync, symlinkSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const doc = readFileSync('skills/discord-harvest/references/code-examples.md', 'utf8');
const functions = [...doc.matchAll(/```bash\n([\s\S]*?)```/g)].map(m => m[1]).filter(s => /^\w+\(\) \{/.test(s)).join('\n');
function run(code, ...args) {
  return spawnSync('bash', ['-c', `${functions}\n${code}`, 'fixture', ...args], { encoding: 'utf8' });
}
test('rejected URLs never disclose synthetic query tokens in diagnostics', () => {
  for (const host of ['http://cdn.discordapp.com', 'https://127.0.0.1', 'https://evil.example']) {
    const r = run('validate_url "$1"', `${host}/file.png?hm=SYNTHETIC_TOKEN`);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /SKIP:/);
    assert.doesNotMatch(r.stdout + r.stderr, /SYNTHETIC_TOKEN|file.png|hm=/);
  }
  assert.equal(run('validate_url "$1"', 'https://cdn.discordapp.com/file.png?hm=SYNTHETIC_TOKEN').status, 0);
});
test('redaction strips query and fragment without changing asset path', () => {
  assert.equal(run('redact_cdn_url "$1"', 'https://cdn.discordapp.com/file.png?hm=TOKEN#SECRET').stdout.trim(), 'https://cdn.discordapp.com/file.png');
  assert.equal(run('redact_cdn_url "$1"', 'https://cdn.discordapp.com/file.png#SECRET').stdout.trim(), 'https://cdn.discordapp.com/file.png');
});
test('sanitizer handles traversal, Windows names and truncation boundaries', () => {
  for (const [input, expected] of [['../../photo.png', 'photo.png'], ['C:\\dir\\CON.png', '_CON.png'], ['...','unnamed'], ['photo.png...', 'photo.png'], ['a'.repeat(199) + '.suffix', 'a'.repeat(199)]]) {
    assert.equal(run('sanitize_filename "$1"', input).stdout.trim(), expected);
  }
});
test('same-size different bytes survive collisions; reruns skip the suffixed asset', () => {
  const root = mkdtempSync(join(tmpdir(), 'discord-assets-'));
  try {
    const out = join(root, 'out'); mkdirSync(out);
    const a = join(root, 'a'); const b = join(root, 'b');
    writeFileSync(a, 'hello'); writeFileSync(b, 'other');
    const copy = file => run('copy_asset "$1" "$2" "$3"', file, out, '../../photo.png');
    assert.equal(copy(a).status, 0);
    assert.match(copy(b).stdout, /copied\t.*photo_2.png/);
    assert.match(copy(b).stdout, /skipped\t.*photo_2.png/);
    assert.equal(readFileSync(join(out, 'photo.png'), 'utf8'), 'hello');
    assert.equal(readFileSync(join(out, 'photo_2.png'), 'utf8'), 'other');
    assert.equal(readdirSync(out).length, 2);
    symlinkSync(a, join(out, 'linked.png'));
    const r = run('copy_asset "$1" "$2" linked.png', b, out);
    assert.equal(r.status, 0); assert.match(r.stdout, /linked_2.png/);
    assert.equal(readFileSync(a, 'utf8'), 'hello');
    assert.equal(run('copy_asset "$1" "$2" x.png', join(out, 'linked.png'), out).status, 1);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
