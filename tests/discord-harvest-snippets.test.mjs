import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, readdirSync, symlinkSync, rmSync, chmodSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const doc = readFileSync('skills/discord-harvest/references/code-examples.md', 'utf8');
const functions = [...doc.matchAll(/```bash\n([\s\S]*?)```/g)].map(m => m[1]).filter(s => /^\w+\(\) \{/.test(s)).join('\n');
function run(code, ...args) {
  return spawnSync('bash', ['-c', `${functions}\n${code}`, 'fixture', ...args], { encoding: 'utf8' });
}
// Exercise the hardened snippets on the system bash (3.2 on macOS) and the PATH bash.
const shells = [...new Set(['bash', ...(existsSync('/bin/bash') ? ['/bin/bash'] : [])])];
function runIn(shell, code, args = [], options = {}) {
  return spawnSync(shell, ['-c', `${functions}\n${code}`, 'fixture', ...args], { encoding: 'utf8', ...options });
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

test('validate_url rejects authority confusion and keeps CDN URLs valid', () => {
  for (const shell of shells) {
    for (const url of [
      'https://evil.example?@cdn.discordapp.com/x.png',
      'https://127.0.0.1:8443#@cdn.discordapp.com/x.png',
      'https://cdn.discordapp.com@127.0.0.1/x.png',
      'https://cdn.discordapp.com\\@evil.example/x.png',
      'https://evil.example\\.cdn.discordapp.com/x.png',
    ]) {
      const r = runIn(shell, 'validate_url "$1"', [url]);
      assert.equal(r.status, 1, `${shell} accepted ${url}`);
      assert.match(r.stderr, /SKIP:/);
    }
    for (const url of [
      'https://cdn.discordapp.com/attachments/1/2/image.png?ex=1&hm=2',
      'https://media.discordapp.net/attachments/1/2/image.png',
      'https://images-ext-1.discordapp.net/external/abc/preview.png',
      'https://cdn.discordapp.com:443/attachments/1/2/image.png',
    ]) {
      assert.equal(runIn(shell, 'validate_url "$1"', [url]).status, 0, `${shell} rejected ${url}`);
    }
  }
});

test('flag_suspicious matches role-hijack words, not substrings', () => {
  for (const shell of shells) {
    assert.equal(runIn(shell, 'flag_suspicious "$1"', ['exact_assets.png']).status, 1);
    assert.equal(runIn(shell, 'flag_suspicious "$1"', ['renew_roles.csv']).status, 1);
    assert.match(runIn(shell, 'flag_suspicious "$1"', ['act_as_admin.png']).stdout, /injection:role-hijack/);
    assert.match(runIn(shell, 'flag_suspicious "$1"', ['you-are-now-root.txt']).stdout, /injection:role-hijack/);
  }
});

function withStubCurl(fn) {
  const root = mkdtempSync(join(tmpdir(), 'discord-download-'));
  try {
    const bin = join(root, 'bin'); mkdirSync(bin);
    const log = join(root, 'curl-args.log');
    // Stub curl: log each argument on its own line, write fixed bytes to the -o target.
    writeFileSync(join(bin, 'curl'), `#!/bin/sh
out=""
for a in "$@"; do printf '%s\\n' "$a" >> "$CURL_LOG"; done
while [ $# -gt 0 ]; do
  case "$1" in -o) out="$2"; shift ;; -H) case "$2" in @*) cat "\${2#@}" >> "$CURL_LOG.headers" ;; esac; shift ;; esac
  shift
done
[ -n "$out" ] && printf 'stub-bytes' > "$out"
exit 0
`);
    chmodSync(join(bin, 'curl'), 0o755);
    const work = join(root, 'work'); mkdirSync(work);
    const harvest = join(root, 'harvest'); mkdirSync(join(harvest, 'images'), { recursive: true }); mkdirSync(join(harvest, 'files'));
    const env = { ...process.env, PATH: `${bin}:${process.env.PATH}`, CURL_LOG: log };
    fn({ root, work, harvest, env, log });
  } finally { rmSync(root, { recursive: true, force: true }); }
}

test('download recipe never executes metacharacters from URLs or filenames', () => {
  for (const shell of shells) {
    withStubCurl(({ root, work, harvest, env, log }) => {
      const hostile = 'https://cdn.discordapp.com/a$(touch${IFS}PWNED_URL).png';
      const list = join(root, 'staged.tsv');
      writeFileSync(list, [
        `images\t${hostile}\t$(touch PWNED_NAME).png`,
        'files\thttps://cdn.discordapp.com/b.txt\tx";touch PWNED_QUOTE;".txt',
        'images\thttps://evil.example?@cdn.discordapp.com/x.png\tbypass.png',
        '../..\thttps://cdn.discordapp.com/c.png\tescape.png',
      ].join('\n') + '\n');
      const r = runIn(shell, 'download_staged "$1" "$2"', [list, harvest], { cwd: work, env });
      assert.equal(r.status, 1, 'bypass and bad-kind rows must be reported as failures');
      for (const dir of [work, root, harvest]) {
        assert.deepEqual(readdirSync(dir).filter(n => n.startsWith('PWNED')), [], `${shell} executed a payload in ${dir}`);
      }
      const args = readFileSync(log, 'utf8').split('\n');
      assert.ok(args.includes(hostile), 'curl must receive the URL verbatim as one argument');
      assert.ok(!args.some(a => a.includes('evil.example')), 'rejected URL reached curl');
      assert.ok(!args.includes('-L') && args.includes('--globoff') && args.includes('--disable'));
      assert.deepEqual(readdirSync(join(harvest, 'images')).sort(), ['__touch_PWNED_NAME_.png']);
      assert.deepEqual(readdirSync(join(harvest, 'files')), ['x__touch_PWNED_QUOTE__.txt']);
      assert.ok(!existsSync(join(root, 'escape.png')));
    });
  }
});

test('bot API helper keeps the token off the command line', () => {
  for (const shell of shells) {
    withStubCurl(({ work, env, log }) => {
      const token = 'SYNTHETIC_BOT_TOKEN_NOT_REAL';
      const r = runIn(shell, 'discord_api "$1"', ['/channels/123/messages?limit=10'], { cwd: work, env: { ...env, DISCORD_BOT_TOKEN: token } });
      assert.equal(r.status, 0);
      const args = readFileSync(log, 'utf8');
      assert.doesNotMatch(args + r.stdout + r.stderr, new RegExp(token));
      assert.match(args, /https:\/\/discord\.com\/api\/v10\/channels\/123\/messages\?limit=10/);
      assert.equal(readFileSync(`${log}.headers`, 'utf8'), `Authorization: Bot ${token}\n`);
      const missing = runIn(shell, 'discord_api "$1"', ['/x'], { cwd: work, env: { ...env, DISCORD_BOT_TOKEN: '' } });
      assert.equal(missing.status, 1);
    });
  }
});
