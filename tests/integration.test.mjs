import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { computeSkillFolderHash } from "../bin/install.mjs";

const root = resolve(".");
const bin = join(root, "bin", "install.mjs");

test("fixture GitHub API installs a skill and cleans staging dirs", async () => {
  const fixture = await startFixture();
  const dest = await tempDir();
  try {
    const result = await runSkills4sh(["--repo", "owner/repo", "--ref", "main", "--dest", dest, "--skill", "demo"], fixture.env);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Installed demo/);
    assert.match(await readFile(join(dest, "demo", "SKILL.md"), "utf8"), /name: demo/);
    assert.equal(await readFile(join(dest, "demo", "references", "guide.md"), "utf8"), "# Guide\n");
    assert.deepEqual((await readdir(dest)).filter((name) => name.includes(".tmp-")), []);
  } finally {
    await fixture.close();
    await rm(dest, { recursive: true, force: true });
  }
});

test("dry-run install prints versioned envelope with computed hash, writes no files", async () => {
  const fixture = await startFixture();
  const dest = await tempDir();
  try {
    const result = await runSkills4sh([
      "--repo", "owner/repo",
      "--ref", "main",
      "--dest", dest,
      "--skill", "demo",
      "--dry-run",
    ], fixture.env);
    assert.equal(result.status, 0, result.stderr);
    const body = JSON.parse(result.stdout);
    // Versioned envelope (v0.4.5+): downstream tooling can rely on schemaVersion/command.
    assert.equal(body.schemaVersion, 1);
    assert.equal(body.command, "install");
    assert.equal(body.dryRun, true);
    assert.equal(body.skill, "demo");
    assert.equal(body.computedHash, fixture.hash);
    assert.deepEqual(body.source, { owner: "owner", repo: "repo", ref: "main" });
    assert.equal(existsSync(join(dest, "demo")), false);
  } finally {
    await fixture.close();
    await rm(dest, { recursive: true, force: true });
  }
});

test("remove --all requires --yes", async () => {
  const dest = await tempDir();
  try {
    // Create a fake installed skill so we exercise the gate (not the "nothing to do" path).
    await mkdir(join(dest, "demo"));
    await writeFile(join(dest, "demo", "SKILL.md"), "---\nname: demo\n---\n");

    // Without --yes: must refuse.
    const refused = await runSkills4sh(["remove", "--all", "--dest", dest]);
    assert.notEqual(refused.status, 0, "remove --all without --yes should fail");
    assert.match(refused.stderr, /remove --all requires explicit confirmation/);
    assert.match(refused.stderr, /--yes/);
    assert.equal(existsSync(join(dest, "demo")), true, "skill must still be on disk");

    // With --yes: proceeds.
    const ok = await runSkills4sh(["remove", "--all", "--yes", "--dest", dest]);
    assert.equal(ok.status, 0, ok.stderr);
    assert.equal(existsSync(join(dest, "demo")), false);
  } finally {
    await rm(dest, { recursive: true, force: true });
  }
});

test("remove refuses to follow symlinks by default; --force unlinks the symlink only", async () => {
  const dest = await tempDir();
  const elsewhere = await tempDir();
  try {
    // Set up real content at `elsewhere`; symlink `dest/foo` → `elsewhere/data`.
    const target = join(elsewhere, "data");
    await mkdir(target);
    await writeFile(join(target, "important.txt"), "DO NOT DELETE\n");
    const { symlinkSync } = await import("node:fs");
    symlinkSync(target, join(dest, "foo"));

    // Default: refuse.
    const refused = await runSkills4sh(["remove", "foo", "--dest", dest]);
    assert.notEqual(refused.status, 0, "remove should refuse symlink without --force");
    assert.match(refused.stderr, /path is a symlink/);
    assert.match(refused.stderr, /target directory is left intact/);
    assert.equal(existsSync(join(target, "important.txt")), true, "target file must still exist");
    assert.equal(existsSync(join(dest, "foo")), true, "symlink must still exist");

    // With --force: unlink the symlink, leave the target alone.
    const ok = await runSkills4sh(["remove", "foo", "--force", "--dest", dest]);
    assert.equal(ok.status, 0, ok.stderr);
    assert.equal(existsSync(join(dest, "foo")), false, "symlink should be gone");
    assert.equal(
      existsSync(join(target, "important.txt")), true,
      "INVARIANT: --force unlinks the symlink only; the target's contents must survive",
    );
  } finally {
    await rm(dest, { recursive: true, force: true });
    await rm(elsewhere, { recursive: true, force: true });
  }
});

test("remove --force lets you clean up a half-installed dir without SKILL.md", async () => {
  const dest = await tempDir();
  try {
    // Half-installed: directory exists but SKILL.md is missing.
    await mkdir(join(dest, "broken"));
    await writeFile(join(dest, "broken", "leftover.txt"), "stale content\n");

    // Default: refuse.
    const refused = await runSkills4sh(["remove", "broken", "--dest", dest]);
    assert.notEqual(refused.status, 0);
    assert.match(refused.stderr, /no SKILL.md inside/);
    assert.match(refused.stderr, /--force/);

    // With --force: remove anyway.
    const ok = await runSkills4sh(["remove", "broken", "--force", "--dest", dest]);
    assert.equal(ok.status, 0, ok.stderr);
    assert.equal(existsSync(join(dest, "broken")), false);
  } finally {
    await rm(dest, { recursive: true, force: true });
  }
});

test("remove --force --all is rejected (bulk + force is too dangerous)", async () => {
  const dest = await tempDir();
  try {
    await mkdir(join(dest, "demo"));
    await writeFile(join(dest, "demo", "SKILL.md"), "---\nname: demo\n---\n");
    // Add a dir without SKILL.md to make --force "meaningful" — should still be rejected.
    await mkdir(join(dest, "stray"));

    const result = await runSkills4sh(["remove", "--all", "--yes", "--force", "--dest", dest]);
    assert.notEqual(result.status, 0, "--force + --all should fail");
    assert.match(result.stderr, /--force cannot be combined with --all/);
    // Importantly: nothing should have been touched yet.
    assert.equal(existsSync(join(dest, "stray")), true);
  } finally {
    await rm(dest, { recursive: true, force: true });
  }
});

test("missing lockfile is a hard error since v0.4.6 (was silent skip)", async () => {
  // Fixture omits the lockfile from the served files but still announces
  // skills/demo/SKILL.md in the tree. v0.4.5 would have silently skipped
  // verification and installed. v0.4.6 fails hard.
  const fixture = await startFixture({ omitLockfile: true });
  const dest = await tempDir();
  try {
    const result = await runSkills4sh([
      "--repo", "owner/repo",
      "--ref", "main",
      "--dest", dest,
      "--skill", "demo",
    ], fixture.env);
    assert.notEqual(result.status, 0, "install with missing lockfile should fail");
    assert.match(result.stderr, /skills-lock\.json not present/);
    assert.match(result.stderr, /downgrade-attack vector/);
    assert.match(result.stderr, /--no-verify/);
  } finally {
    await fixture.close();
    await rm(dest, { recursive: true, force: true });
  }
});

test("missing lockfile + --no-verify allows install (explicit opt-in only)", async () => {
  const fixture = await startFixture({ omitLockfile: true });
  const dest = await tempDir();
  try {
    const result = await runSkills4sh([
      "--repo", "owner/repo",
      "--ref", "main",
      "--dest", dest,
      "--skill", "demo",
      "--no-verify",
    ], fixture.env);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(existsSync(join(dest, "demo", "SKILL.md")), true);
  } finally {
    await fixture.close();
    await rm(dest, { recursive: true, force: true });
  }
});

test("--version prints version on stdout and exits 0", async () => {
  const r = await runSkills4sh(["--version"]);
  assert.equal(r.status, 0);
  // Should be a clean version string with no other output.
  assert.match(r.stdout.trim(), /^\d+\.\d+\.\d+/);
  assert.equal(r.stderr.trim(), "", "stderr should be empty for --version");
});

test("-v alias also prints version", async () => {
  const r = await runSkills4sh(["-v"]);
  assert.equal(r.status, 0);
  assert.match(r.stdout.trim(), /^\d+\.\d+\.\d+/);
});

test("--version combined with other args is rejected (v0.4.7 — strict)", async () => {
  // Prior to v0.4.7, --version anywhere in argv would print and exit 0.
  // That surprised users running `skills4sh --skill foo --version` who
  // expected -v / --version to be an operation-specific flag. Strict
  // form: --version must be the only argument.
  const r = await runSkills4sh(["--skill", "foo", "--version"]);
  assert.notEqual(r.status, 0, "--version with other args should be rejected");
  assert.match(r.stderr, /unknown argument: --version/);
});

test("-v combined with other args is rejected (v0.4.7 — strict)", async () => {
  const r = await runSkills4sh(["add", "t4sh/skills4sh", "-v"]);
  assert.notEqual(r.status, 0, "-v with other args should be rejected");
  assert.match(r.stderr, /unknown argument/);
});

test("parse-error doesn't dump full help (just one-line hint)", async () => {
  const r = await runSkills4sh(["--nonsense-flag"]);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /unknown argument/);
  assert.match(r.stderr, /skills4sh --help/);
  // Full help is ~40 lines; error output should be much shorter.
  const lines = r.stderr.split("\n").filter((l) => l.length > 0);
  assert.ok(lines.length < 10, `parse-error output should be short, got ${lines.length} lines:\n${r.stderr}`);
});

test("dry-run error path emits JSON envelope on stdout", async () => {
  const fixture = await startFixture({ omitLockfile: true });
  const dest = await tempDir();
  try {
    // Force an error in dry-run mode. Missing lockfile throws.
    const r = await runSkills4sh([
      "--repo", "owner/repo",
      "--ref", "main",
      "--dest", dest,
      "--skill", "demo",
      "--dry-run",
    ], fixture.env);
    assert.notEqual(r.status, 0);
    // The error message also goes to stderr (human readable).
    assert.match(r.stderr, /skills-lock\.json not present/);
    // The dry-run envelope goes to stdout for tooling.
    const envelope = JSON.parse(r.stdout);
    assert.equal(envelope.schemaVersion, 1);
    assert.equal(envelope.command, "install");
    assert.equal(envelope.dryRun, true);
    assert.ok(envelope.error, "envelope should contain error block");
    assert.match(envelope.error.message, /skills-lock\.json not present/);
  } finally {
    await fixture.close();
    await rm(dest, { recursive: true, force: true });
  }
});

test("size cap streaming-aborts when Content-Length is absent and body exceeds cap", async () => {
  // v0.4.7 critical fix: previously the cap could be bypassed by an
  // attacker-controlled server that omitted Content-Length and streamed an
  // unbounded body — the bare `await res.arrayBuffer()` would buffer the
  // whole thing into memory before any check fired. The streaming reader
  // must catch the overrun BEFORE memory exhaustion.
  const fixture = await startFixture({ oversizedStreamingNoContentLength: true });
  const dest = await tempDir();
  try {
    const r = await runSkills4sh([
      "--repo", "owner/repo",
      "--ref", "main",
      "--dest", dest,
      "--skill", "demo",
      "--no-verify",
    ], fixture.env);
    assert.notEqual(r.status, 0, "oversized streaming body should be rejected");
    assert.match(r.stderr, /size cap/i, "error should mention size cap");
    assert.match(r.stderr, /streamed/i, "error should indicate streaming abort path");
    // The skill must NOT have been installed.
    assert.equal(existsSync(join(dest, "demo")), false);
  } finally {
    await fixture.close();
    await rm(dest, { recursive: true, force: true });
  }
});

test("per-file size cap rejects oversized downloads", async () => {
  // Build a fixture that announces a file in the tree but serves an
  // oversized body. The cap is 50 MiB; we serve a body just over that
  // limit via Content-Length so the early-reject branch fires.
  const fixture = await startFixture({ oversizedFile: true });
  const dest = await tempDir();
  try {
    const r = await runSkills4sh([
      "--repo", "owner/repo",
      "--ref", "main",
      "--dest", dest,
      "--skill", "demo",
      "--no-verify",
    ], fixture.env);
    assert.notEqual(r.status, 0, "oversized file should be rejected");
    assert.match(r.stderr, /size cap|Content-Length/i);
  } finally {
    await fixture.close();
    await rm(dest, { recursive: true, force: true });
  }
});

test("dry-run remove prints versioned envelope", async () => {
  const dest = await tempDir();
  try {
    await mkdir(join(dest, "demo"));
    await writeFile(join(dest, "demo", "SKILL.md"), "---\nname: demo\n---\n");

    const r = await runSkills4sh(["remove", "demo", "--dry-run", "--dest", dest]);
    assert.equal(r.status, 0, r.stderr);
    const body = JSON.parse(r.stdout);
    assert.equal(body.schemaVersion, 1);
    assert.equal(body.command, "remove");
    assert.equal(body.dryRun, true);
    assert.equal(body.skill, "demo");
    assert.equal(body.kind, "skill");
    assert.equal(existsSync(join(dest, "demo")), true, "dry-run must not delete");
  } finally {
    await rm(dest, { recursive: true, force: true });
  }
});

test("hash mismatch refuses install before writing destination", async () => {
  const fixture = await startFixture({ lockHash: "0".repeat(64) });
  const dest = await tempDir();
  try {
    const result = await runSkills4sh(["--repo", "owner/repo", "--ref", "main", "--dest", dest, "--skill", "demo"], fixture.env);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /hash mismatch for demo/);
    assert.equal(existsSync(join(dest, "demo")), false);
  } finally {
    await fixture.close();
    await rm(dest, { recursive: true, force: true });
  }
});

test("raw download failure preserves the existing install", async () => {
  const fixture = await startFixture({ failRawPath: "skills/demo/references/guide.md" });
  const dest = await tempDir();
  const existing = join(dest, "demo");
  await mkdir(existing, { recursive: true });
  await writeFile(join(existing, "SKILL.md"), "old install\n");

  try {
    const result = await runSkills4sh(["--repo", "owner/repo", "--ref", "main", "--dest", dest, "--skill", "demo"], fixture.env);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /GET .*guide\.md/);
    assert.equal(await readFile(join(existing, "SKILL.md"), "utf8"), "old install\n");
  } finally {
    await fixture.close();
    await rm(dest, { recursive: true, force: true });
  }
});

test("GitHub API rate-limit response points users at GITHUB_TOKEN", async () => {
  const fixture = await startFixture({ rateLimited: true });
  const dest = await tempDir();
  try {
    const result = await runSkills4sh(["--repo", "owner/repo", "--ref", "main", "--dest", dest, "--skill", "demo"], fixture.env);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /GitHub rate limit hit/);
    assert.match(result.stderr, /GITHUB_TOKEN/);
  } finally {
    await fixture.close();
    await rm(dest, { recursive: true, force: true });
  }
});

test("packed tarball installs a working skills4sh binary", async () => {
  const dir = await tempDir();
  const app = join(dir, "app");
  await mkdir(app);
  try {
    const packed = spawnSync("npm", ["pack", "--json", "--pack-destination", dir], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    assert.equal(packed.status, 0, packed.stderr);
    const [{ filename, files }] = JSON.parse(packed.stdout);
    assert.ok(files.some((file) => file.path === "npm-shrinkwrap.json"));

    const install = spawnSync("npm", ["install", "--prefix", app, join(dir, filename)], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    assert.equal(install.status, 0, install.stderr);

    const help = spawnSync(join(app, "node_modules", ".bin", "skills4sh"), ["--help"], {
      cwd: app,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    assert.equal(help.status, 0, help.stderr);
    assert.match(help.stdout, /skills4sh .* install agent skills/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

async function startFixture(options = {}) {
  const files = {
    "skills/demo/SKILL.md": "---\nname: demo\ndescription: Demo skill\nmetadata:\n  version: \"1.0.0\"\n---\n# Demo\n",
    "skills/demo/references/guide.md": "# Guide\n",
  };
  const hash = computeSkillFolderHash(Object.entries(files).map(([path, content]) => ({
    rel: path.replace("skills/demo/", ""),
    content: Buffer.from(content),
  })));
  const lock = JSON.stringify({
    version: 1,
    skills: {
      demo: {
        source: "owner/repo",
        sourceType: "github",
        version: "1.0.0",
        computedHash: options.lockHash ?? hash,
      },
    },
  });

  const server = createServer((req, res) => {
    const url = new URL(req.url, "http://127.0.0.1");
    if (options.rateLimited && url.pathname === "/repos/owner/repo/git/trees/main") {
      res.writeHead(403, { "content-type": "application/json", "x-ratelimit-remaining": "0" });
      res.end(JSON.stringify({ message: "rate limit" }));
      return;
    }
    if (url.pathname === "/repos/owner/repo/git/trees/main") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({
        truncated: false,
        tree: [
          ...Object.keys(files).map((path) => ({ path, type: "blob" })),
          { path: "skills-lock.json", type: "blob" },
        ],
      }));
      return;
    }

    const rawPrefix = "/owner/repo/main/";
    if (url.pathname.startsWith(rawPrefix)) {
      const repoPath = decodeURI(url.pathname.slice(rawPrefix.length));
      if (repoPath === options.failRawPath) {
        res.writeHead(500, { "content-type": "text/plain" });
        res.end("boom");
        return;
      }
      if (repoPath === "skills-lock.json" && options.omitLockfile) {
        // Simulate a repo that has no lockfile (v0.4.6: hard error).
        res.writeHead(404);
        res.end("not found");
        return;
      }
      if (options.oversizedFile && repoPath === "skills/demo/SKILL.md") {
        // Advertise a huge Content-Length to trigger the per-file size cap.
        // The actual body doesn't need to be that large — the early-reject
        // branch fires from the header alone.
        res.writeHead(200, {
          "content-type": "text/plain",
          "content-length": String(100 * 1024 * 1024), // 100 MiB > 50 MiB cap
        });
        res.end(""); // body intentionally smaller; the cap rejects before reading
        return;
      }
      if (options.oversizedStreamingNoContentLength && repoPath === "skills/demo/SKILL.md") {
        // No Content-Length header (chunked transfer encoding implicit via
        // res.write before res.end). Streams chunks totaling > 50 MiB so the
        // streaming reader must abort, not the header check. Sends 1 MiB
        // chunks until either 60 MiB total or the client cancels the stream.
        res.writeHead(200, { "content-type": "text/plain" });
        const chunk = Buffer.alloc(1024 * 1024, "A");
        let sent = 0;
        const TOTAL_TARGET = 60 * 1024 * 1024;
        const writeChunk = () => {
          if (res.destroyed || res.writableEnded) return;
          if (sent >= TOTAL_TARGET) { res.end(); return; }
          sent += chunk.byteLength;
          if (!res.write(chunk)) {
            res.once("drain", writeChunk);
          } else {
            setImmediate(writeChunk);
          }
        };
        writeChunk();
        return;
      }
      const body = repoPath === "skills-lock.json" ? lock : files[repoPath];
      if (body === undefined) {
        res.writeHead(404);
        res.end("not found");
        return;
      }
      res.writeHead(200, { "content-type": "text/plain" });
      res.end(body);
      return;
    }

    res.writeHead(404);
    res.end("not found");
  });

  await new Promise((resolvePromise) => server.listen(0, "127.0.0.1", resolvePromise));
  const { port } = server.address();
  const origin = `http://127.0.0.1:${port}`;
  return {
    hash,
    env: {
      SKILLS4SH_API_BASE: origin,
      SKILLS4SH_RAW_BASE: origin,
    },
    close: () => new Promise((resolvePromise) => server.close(resolvePromise)),
  };
}

function runSkills4sh(args, env) {
  const childEnv = { ...process.env, ...env };
  delete childEnv.HTTPS_PROXY;
  delete childEnv.https_proxy;
  delete childEnv.HTTP_PROXY;
  delete childEnv.http_proxy;
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, [bin, ...args], {
      cwd: root,
      env: childEnv,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      resolvePromise({ status: null, stdout, stderr, signal: "SIGKILL" });
    }, 10_000);
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (status, signal) => {
      clearTimeout(timer);
      resolvePromise({ status, signal, stdout, stderr });
    });
  });
}

async function tempDir() {
  return mkdtemp(join(tmpdir(), "skills4sh-test-"));
}
