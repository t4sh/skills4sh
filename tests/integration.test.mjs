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

test("dry-run install prints the computed hash and writes no files", async () => {
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
    assert.equal(body.skill, "demo");
    assert.equal(body.computedHash, fixture.hash);
    assert.equal(existsSync(join(dest, "demo")), false);
  } finally {
    await fixture.close();
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
