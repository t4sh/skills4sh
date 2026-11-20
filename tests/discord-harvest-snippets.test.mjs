import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, readdirSync, symlinkSync, rmSync, chmodSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn, spawnSync } from 'node:child_process';
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
test('sanitizer returns names that look like echo options', () => {
  for (const shell of shells) {
    for (const name of ['-n', '-e', '-E', '-neE']) {
      const r = runIn(shell, 'sanitize_filename "$1"', [name]);
      assert.equal(r.stdout, `${name}\n`, `${shell} lost ${name}`);
    }
    assert.equal(runIn(shell, 'sanitize_filename "$1"', ['../../-n']).stdout, '-n\n');
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

test('flag_suspicious flags every filename SKILL.md says it detects', () => {
  const skill = readFileSync('skills/discord-harvest/SKILL.md', 'utf8');
  const claim = skill.split('\n').find(line => line.includes('Social-engineering filenames'));
  assert.ok(claim && /flag_suspicious\(\)/.test(claim), 'SKILL.md no longer states the detection claim');
  const examples = [...claim.split('`flag_suspicious()`')[0].matchAll(/`([^`]+)`/g)].map(m => m[1]);
  assert.deepEqual(examples, ['override-claude.exe', 'system-prompt.txt', 'ignore-previous-instructions.png']);
  for (const shell of shells) {
    for (const name of examples) {
      const r = runIn(shell, 'flag_suspicious "$1"', [name]);
      assert.equal(r.status, 0, `${shell} did not flag ${name}`);
      assert.match(r.stdout, /^(injection|suspicious):[a-z-]+\n$/);
    }
  }
});

test('flag_suspicious flags executable extensions by final extension only', () => {
  for (const shell of shells) {
    for (const name of ['override-claude.exe', 'photo.png.EXE', 'setup.msi. ', 'invoice.pdf.scr', 'install.sh', 'update.ps1']) {
      assert.equal(runIn(shell, 'flag_suspicious "$1"', [name]).stdout, 'suspicious:executable\n', `${shell}: ${name}`);
    }
    // Final extension decides; link-preview titles ending in .com/.js/.app stay unflagged.
    for (const name of ['notes.exe.txt', 'report.pdf', 'example.com', 'Node.js', 'photo.png', 'shell-tips.md']) {
      assert.equal(runIn(shell, 'flag_suspicious "$1"', [name]).status, 1, `${shell} flagged ${name}`);
    }
    // An earlier, more specific flag keeps priority over the extension flag.
    assert.equal(runIn(shell, 'flag_suspicious "$1"', ['IMPORTANT_run_this.exe']).stdout, 'suspicious:attention-hijack\n');
  }
});

function withStubCurl(fn) {
  const root = mkdtempSync(join(tmpdir(), 'discord-download-'));
  try {
    const bin = join(root, 'bin'); mkdirSync(bin);
    const log = join(root, 'curl-args.log');
    // Stub curl: log each argument on its own line, write fixed bytes to the -o target, and
    // answer -w as an HTTP 200 with no redirect. It is a stand-in for argument-handling tests
    // only; status handling is tested against real curl in the local-HTTPS tests below.
    writeFileSync(join(bin, 'curl'), `#!/bin/sh
out=""
fmt=""
for a in "$@"; do printf '%s\\n' "$a" >> "$CURL_LOG"; done
while [ $# -gt 0 ]; do
  case "$1" in -o) out="$2"; shift ;; -w) fmt="$2"; shift ;; -D|--dump-header) shift ;; -H) case "$2" in @*) cat "\${2#@}" >> "$CURL_LOG.headers" ;; esac; shift ;; esac
  shift
done
[ -n "$out" ] && printf 'stub-bytes' > "$out"
[ -n "$fmt" ] && printf '%s' "$fmt" | sed -e 's/%{http_code}/200/' -e 's/%{redirect_url}//'
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

// --- Status handling against real curl -------------------------------------------------
// A throwaway local HTTPS server answers with fixed statuses. A PATH shim runs the real curl
// binary with every connection pinned to that server and its one-off certificate, so the
// helpers see genuine curl exit codes, -w output, and redirect reporting. Nothing here
// contacts Discord, and it proves nothing about Discord's own responses.
const stubServerSource = `
import https from 'node:https';
import { readFileSync, appendFileSync } from 'node:fs';
const [,, keyPath, certPath, logPath] = process.argv;
const routes = {
  '/ok.png': [200, {}, 'REAL-BYTES'],
  '/to-media': [302, { location: 'https://media.discordapp.net/ok.png?ex=aa&hm=SIGNED' }, ''],
  '/to-relative': [307, { location: '/ok.png' }, ''],
  '/to-evil': [302, { location: 'https://evil.example/ok.png' }, ''],
  '/to-evil-with-body': [302, { location: 'https://evil.example/ok.png' }, 'REDIRECT-BODY'],
  '/to-http': [301, { location: 'http://cdn.discordapp.com/ok.png' }, ''],
  '/to-private': [302, { location: 'https://127.0.0.1/ok.png' }, ''],
  '/to-redirect': [302, { location: 'https://cdn.discordapp.com/to-media' }, ''],
  '/missing.png': [404, {}, 'not found'],
  '/limited.png': [429, { 'retry-after': '2' }, 'slow down'],
  '/no-content': [204, {}, ''],
  '/api/v10/ok': [200, {}, '[{"id":"1"}]'],
  '/api/v10/unauthorized': [401, {}, '{"message":"401: Unauthorized","code":0}'],
  '/api/v10/forbidden': [403, {}, '{"message":"Missing Access","code":50001}'],
  '/api/v10/unknown': [404, {}, '{"message":"Unknown Channel","code":10003}'],
  '/api/v10/limited': [429, { 'Retry-After': '7' }, '{"message":"You are being rate limited.","retry_after":6.57,"global":false}'],
  '/api/v10/moved': [302, { location: 'https://discord.com/api/v10/ok' }, ''],
};
const server = https.createServer({ key: readFileSync(keyPath), cert: readFileSync(certPath) }, (req, res) => {
  const path = req.url.split('?')[0];
  const scheme = (req.headers.authorization || '').split(' ')[0];
  appendFileSync(logPath, JSON.stringify({ host: req.headers.host, path, scheme }) + '\\n');
  const [status, headers, body] = routes[path] || [404, {}, 'no route'];
  res.writeHead(status, headers);
  res.end(body);
});
server.listen(0, '127.0.0.1', () => console.log(server.address().port));
`;

function which(command) {
  const r = spawnSync('sh', ['-c', 'command -v "$1"', 'sh', command], { encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : null;
}

async function withLocalHttps(t, fn) {
  const realCurl = which('curl');
  const openssl = which('openssl');
  if (!realCurl || !openssl) return t.skip('needs curl and openssl on PATH');
  const root = mkdtempSync(join(tmpdir(), 'discord-https-'));
  let server;
  try {
    const key = join(root, 'key.pem'); const cert = join(root, 'cert.pem'); const config = join(root, 'openssl.cnf');
    writeFileSync(config, '[req]\ndistinguished_name=dn\nx509_extensions=ext\nprompt=no\n[dn]\nCN=discord-harvest-test-stub\n[ext]\nbasicConstraints=CA:TRUE\nsubjectAltName=DNS:cdn.discordapp.com,DNS:media.discordapp.net,DNS:discord.com\n');
    const made = spawnSync(openssl, ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '2', '-config', config, '-keyout', key, '-out', cert], { encoding: 'utf8' });
    if (made.status !== 0) return t.skip('openssl could not create a test certificate');
    const requests = join(root, 'requests.log'); writeFileSync(requests, '');
    writeFileSync(join(root, 'server.mjs'), stubServerSource);
    server = spawn(process.execPath, [join(root, 'server.mjs'), key, cert, requests], { stdio: ['ignore', 'pipe', 'inherit'] });
    const port = await new Promise((resolve, reject) => {
      server.stdout.once('data', chunk => resolve(String(chunk).trim()));
      server.once('exit', code => reject(new Error(`stub server exited early (${code})`)));
    });
    const bin = join(root, 'bin'); mkdirSync(bin);
    const argv = join(root, 'curl-args.log'); writeFileSync(argv, '');
    // Shim: the real curl, pinned to the stub. The helpers always pass --disable first.
    writeFileSync(join(bin, 'curl'), `#!/bin/sh
first="$1"; shift
for a in "$first" "$@"; do printf '%s\\n' "$a" >> "$CURL_LOG"; done
exec "$REAL_CURL" "$first" --noproxy '*' --connect-to "::127.0.0.1:$STUB_PORT" --cacert "$STUB_CA" "$@"
`);
    chmodSync(join(bin, 'curl'), 0o755);
    const env = { ...process.env, PATH: `${bin}:${process.env.PATH}`, REAL_CURL: realCurl, STUB_PORT: port, STUB_CA: cert, CURL_LOG: argv };
    for (const name of ['HTTPS_PROXY', 'https_proxy', 'ALL_PROXY', 'all_proxy']) delete env[name];
    const seen = () => readFileSync(requests, 'utf8').split('\n').filter(Boolean).map(line => JSON.parse(line));
    await fn({ root, env, argv, seen });
  } finally {
    if (server) server.kill();
    rmSync(root, { recursive: true, force: true });
  }
}

test('download_asset archives only an HTTP 200 body (real curl, local HTTPS stub)', async (t) => {
  await withLocalHttps(t, async ({ root, env, seen }) => {
    for (const [index, shell] of shells.entries()) {
      const out = join(root, `images-${index}`); mkdirSync(out);
      const download = (path, name) => runIn(shell, 'download_asset "$1" "$2" "$3"', [`https://cdn.discordapp.com${path}`, out, name], { cwd: root, env });
      const before = seen().length;

      const ok = download('/ok.png', 'ok.png');
      assert.equal(ok.status, 0, ok.stderr);
      assert.equal(readFileSync(join(out, 'ok.png'), 'utf8'), 'REAL-BYTES');

      // Non-200 responses, including bodiless and bodied redirects, archive nothing.
      for (const [path, name, reason] of [
        ['/to-evil', 'evil.png', /SKIP: untrusted URL domain/],
        ['/to-evil-with-body', 'evil-body.png', /SKIP: untrusted URL domain/],
        ['/to-http', 'http.png', /SKIP: non-HTTPS URL blocked/],
        ['/to-private', 'private.png', /SKIP: private\/local URL blocked/],
        ['/to-redirect', 'twice.png', /HTTP 302, not 200/],
        ['/missing.png', 'missing.png', /HTTP 404, not 200/],
        ['/limited.png', 'limited.png', /HTTP 429, not 200/],
        ['/no-content', 'empty.png', /HTTP 204, not 200/],
      ]) {
        const r = download(path, name);
        assert.equal(r.status, 1, `${shell} treated ${path} as a successful download`);
        assert.match(r.stderr, reason, `${shell} ${path}`);
        assert.equal(r.stdout, '', `${shell} reported a copy for ${path}`);
      }

      // A redirect to an allowlisted host is re-validated, then fetched once.
      const media = download('/to-media', 'media.png');
      assert.equal(media.status, 0, media.stderr);
      assert.equal(readFileSync(join(out, 'media.png'), 'utf8'), 'REAL-BYTES');
      assert.doesNotMatch(media.stdout + media.stderr, /SIGNED|hm=/, 'redirect target query leaked');
      const relative = download('/to-relative', 'relative.png');
      assert.equal(relative.status, 0, relative.stderr);

      assert.deepEqual(readdirSync(out).sort(), ['media.png', 'ok.png', 'relative.png']);
      const requests = seen().slice(before);
      // Rejected redirect targets are never requested; a second redirect is never followed.
      assert.deepEqual(requests.filter(r => !['cdn.discordapp.com', 'media.discordapp.net'].includes(r.host)), []);
      assert.equal(requests.filter(r => r.path === '/ok.png' && r.host === 'media.discordapp.net').length, 1);
      assert.equal(requests.filter(r => r.path === '/to-media').length, 2, 'one direct hit and one as the unfollowed second hop');
    }
  });
});

test('download_staged reports non-200 assets as failures without leaking signed queries', async (t) => {
  await withLocalHttps(t, async ({ root, env }) => {
    for (const [index, shell] of shells.entries()) {
      const harvest = join(root, `harvest-${index}`); mkdirSync(join(harvest, 'images'), { recursive: true });
      const list = join(root, `staged-${index}.tsv`);
      writeFileSync(list, [
        'images\thttps://cdn.discordapp.com/ok.png?ex=aa&hm=SIGNED\tgood.png',
        'images\thttps://cdn.discordapp.com/to-evil?ex=aa&hm=SIGNED\tredirected.png',
        'images\thttps://cdn.discordapp.com/missing.png?ex=aa&hm=SIGNED\tgone.png',
      ].join('\n') + '\n');
      const r = runIn(shell, 'download_staged "$1" "$2"', [list, harvest], { cwd: root, env });
      assert.equal(r.status, 1);
      assert.deepEqual(readdirSync(join(harvest, 'images')), ['good.png']);
      assert.match(r.stderr, /FAILED: https:\/\/cdn\.discordapp\.com\/to-evil\n/);
      assert.match(r.stderr, /FAILED: https:\/\/cdn\.discordapp\.com\/missing\.png\n/);
      assert.doesNotMatch(r.stdout + r.stderr, /SIGNED|hm=|ex=/);
    }
  });
});

test('discord_api reports status and Retry-After, and always sends the Bot scheme (real curl, local HTTPS stub)', async (t) => {
  await withLocalHttps(t, async ({ root, env, argv, seen }) => {
    const token = 'SYNTHETIC_BOT_TOKEN_NOT_REAL';
    for (const shell of shells) {
      const api = route => runIn(shell, 'discord_api "$1"', [route], { cwd: root, env: { ...env, DISCORD_BOT_TOKEN: token } });
      const ok = api('/ok');
      assert.equal(ok.status, 0, ok.stderr);
      assert.equal(ok.stdout, '[{"id":"1"}]');
      for (const [route, status] of [['/unauthorized', 401], ['/forbidden', 403], ['/unknown', 404], ['/moved', 302]]) {
        const r = api(route);
        assert.equal(r.status, 1, `${shell} ${route}`);
        assert.equal(r.stdout, '', `${shell} printed a non-200 body for ${route}`);
        assert.match(r.stderr, new RegExp(`discord_api: HTTP ${status}\\n`));
        assert.doesNotMatch(r.stderr, /retry after/);
      }
      const limited = api('/limited');
      assert.equal(limited.status, 1);
      assert.equal(limited.stdout, '');
      assert.match(limited.stderr, /discord_api: HTTP 429\ndiscord_api: retry after 7 seconds\n/);
      assert.doesNotMatch([ok, limited].map(r => r.stdout + r.stderr).join(''), new RegExp(token));
    }
    assert.doesNotMatch(readFileSync(argv, 'utf8'), new RegExp(token), 'token reached the curl command line');
    const requests = seen();
    assert.equal(requests.length, shells.length * 6);
    assert.ok(requests.every(r => r.host === 'discord.com' && r.scheme === 'Bot'), 'a request left the Bot scheme or host');
    assert.equal(requests.filter(r => r.path === '/api/v10/ok').length, shells.length, 'an API redirect was followed');
  });
});
