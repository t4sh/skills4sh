// Integration tests for bin/clean-package-for-publish.mjs.
//
// This is the prepack/postpack helper that strips dev-only scripts from the
// published package.json so consumers aren't exposed to scripts referencing
// files not in the tarball.
//
// Run: node --test tests/clean-package-for-publish.test.mjs

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT = join(
  dirname(fileURLToPath(import.meta.url)),
  "..", "bin", "clean-package-for-publish.mjs",
);

function setupTmp() {
  const dir = mkdtempSync(join(tmpdir(), "skills4sh-cleanpkg-"));
  const pkgPath = join(dir, "package.json");
  const bakPath = join(dir, "package.json.prepack.bak");
  const original = {
    name: "skills4sh",
    version: "1.2.3",
    scripts: { test: "node --test", "check:drift": "node bin/drift.mjs" },
    files: ["bin/install.mjs"],
  };
  writeFileSync(pkgPath, JSON.stringify(original, null, 2) + "\n");
  return { dir, pkgPath, bakPath, original };
}

function runScript(cwd, mode) {
  return spawnSync("node", [SCRIPT, mode], { cwd, encoding: "utf8" });
}

describe("clean-package-for-publish prepack", () => {
  test("strips scripts and creates .bak", () => {
    const { dir, pkgPath, bakPath, original } = setupTmp();
    try {
      const r = runScript(dir, "prepack");
      assert.equal(r.status, 0, `prepack failed: ${r.stderr || r.stdout}`);
      const cleaned = JSON.parse(readFileSync(pkgPath, "utf8"));
      assert.equal(cleaned.scripts, undefined, "scripts should be absent");
      assert.equal(cleaned.name, "skills4sh", "other fields preserved");
      assert.equal(cleaned.version, "1.2.3");
      assert.deepEqual(cleaned.files, original.files);
      assert.equal(existsSync(bakPath), true, ".bak should exist");
      const bak = JSON.parse(readFileSync(bakPath, "utf8"));
      assert.deepEqual(bak.scripts, original.scripts, ".bak preserves original scripts");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("logs progress to stderr, not stdout (so npm pack --json output isn't polluted)", () => {
    const { dir } = setupTmp();
    try {
      const r = runScript(dir, "prepack");
      assert.equal(r.stdout.trim(), "", "stdout must be empty");
      assert.match(r.stderr, /prepack: stripped scripts/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("idempotent — running prepack twice still strips scripts correctly", () => {
    const { dir, pkgPath, bakPath, original } = setupTmp();
    try {
      const r1 = runScript(dir, "prepack");
      assert.equal(r1.status, 0);

      // Simulate a stale .bak from an interrupted run — first re-run should
      // recover from .bak, then re-strip.
      const r2 = runScript(dir, "prepack");
      assert.equal(r2.status, 0, `second prepack failed: ${r2.stderr || r2.stdout}`);

      const cleaned = JSON.parse(readFileSync(pkgPath, "utf8"));
      assert.equal(cleaned.scripts, undefined);
      const bak = JSON.parse(readFileSync(bakPath, "utf8"));
      assert.deepEqual(bak.scripts, original.scripts, ".bak still preserves original scripts");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("clean-package-for-publish postpack", () => {
  test("restores package.json from .bak and removes .bak", () => {
    const { dir, pkgPath, bakPath, original } = setupTmp();
    try {
      runScript(dir, "prepack");
      assert.equal(existsSync(bakPath), true);
      const r = runScript(dir, "postpack");
      assert.equal(r.status, 0, `postpack failed: ${r.stderr || r.stdout}`);
      const restored = JSON.parse(readFileSync(pkgPath, "utf8"));
      assert.deepEqual(restored.scripts, original.scripts, "scripts restored");
      assert.equal(existsSync(bakPath), false, ".bak removed after restore");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("postpack without prepack is a no-op (no .bak exists)", () => {
    const { dir, pkgPath, original } = setupTmp();
    try {
      const r = runScript(dir, "postpack");
      assert.equal(r.status, 0);
      const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
      assert.deepEqual(pkg.scripts, original.scripts, "untouched");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("clean-package-for-publish full prepack/postpack cycle", () => {
  test("scripts present → prepack strips → postpack restores", () => {
    const { dir, pkgPath, bakPath, original } = setupTmp();
    try {
      // pre
      const pre = JSON.parse(readFileSync(pkgPath, "utf8"));
      assert.deepEqual(pre.scripts, original.scripts);

      // prepack
      assert.equal(runScript(dir, "prepack").status, 0);
      const between = JSON.parse(readFileSync(pkgPath, "utf8"));
      assert.equal(between.scripts, undefined);

      // postpack
      assert.equal(runScript(dir, "postpack").status, 0);
      const after = JSON.parse(readFileSync(pkgPath, "utf8"));
      assert.deepEqual(after.scripts, original.scripts);
      assert.equal(existsSync(bakPath), false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("clean-package-for-publish error handling", () => {
  test("invalid mode argument exits non-zero with usage", () => {
    const { dir } = setupTmp();
    try {
      const r = runScript(dir, "nonsense-mode");
      assert.equal(r.status, 1);
      assert.match(r.stderr, /usage:/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("no mode argument exits non-zero", () => {
    const { dir } = setupTmp();
    try {
      const r = spawnSync("node", [SCRIPT], { cwd: dir, encoding: "utf8" });
      assert.equal(r.status, 1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
