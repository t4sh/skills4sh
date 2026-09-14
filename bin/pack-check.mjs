#!/usr/bin/env node
// Verify the npm package payload before publishing.
//
// The dry-run check validates the file list npm will publish. The real pack
// check validates the produced tarball and the pinned dependency bundled in it.
// npm 12 no longer supports shrinkwrap; package-lock.json controls npm ci,
// and bundleDependencies carries the installed dependency into the tarball.

import { mkdtemp, readFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { parsePackJson } from "./lib/npm-pack.mjs";

const root = process.cwd();
const tmp = await mkdtemp(join(tmpdir(), "skills4sh-pack-"));

try {
  const source = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
  const lock = JSON.parse(await readFile(join(root, "package-lock.json"), "utf8"));
  const expectedUndici = source.optionalDependencies?.undici;
  if (!source.bundleDependencies?.includes("undici") || !expectedUndici
    || lock.packages?.["node_modules/undici"]?.version !== expectedUndici
    || lock.packages?.[""]?.version !== source.version) {
    throw new Error("package-lock.json and the bundled undici declaration must match package.json; run npm install --package-lock-only");
  }
  const dryRun = run("npm", ["pack", "--json", "--dry-run"], { cwd: root });
  const dry = parsePackJson(dryRun.stdout, "npm pack --dry-run");
  const dryFiles = new Set(dry.files.map((f) => f.path));
  requireFile(dryFiles, "node_modules/undici/package.json", "dry-run package file list (run npm ci --ignore-scripts --no-audit --no-fund before packing)");
  requireFile(dryFiles, "node_modules/undici/index.js", "dry-run package file list");
  requireFile(dryFiles, "node_modules/undici/LICENSE", "dry-run package file list");
  requireFile(dryFiles, "skills-lock.json", "dry-run package file list");
  requireFile(dryFiles, "bin/install.mjs", "dry-run package file list");
  for (const path of dryFiles) {
    if (path.split("/").includes("__pycache__") || path.endsWith(".pyc")) {
      throw new Error(`dry-run package file list includes Python bytecode: ${path}`);
    }
  }

  const packed = run("npm", ["pack", "--json", "--pack-destination", tmp], { cwd: root });
  const pack = parsePackJson(packed.stdout, "npm pack");
  const tgz = join(tmp, pack.filename);
  const packageDir = join(tmp, "package");

  run("tar", ["-xzf", tgz, "-C", tmp], { cwd: root });
  const pkg = JSON.parse(await readFile(join(packageDir, "package.json"), "utf8"));
  if (pkg.name !== "skills4sh") throw new Error(`packed package has unexpected name: ${pkg.name}`);
  // Dev scripts (check:*, test, setup:hooks, prepublishOnly, prepack, postpack)
  // reference files outside package.json#files; they're stripped from the
  // published package.json by bin/clean-package-for-publish.mjs at prepack time.
  // Assert here so a misconfigured prepack hook can't silently ship a broken
  // scripts dict.
  if (pkg.scripts && Object.keys(pkg.scripts).length > 0) {
    throw new Error(
      `published package.json carries scripts (${Object.keys(pkg.scripts).join(", ")}) — ` +
      `the prepack hook (bin/clean-package-for-publish.mjs) should have stripped them.`,
    );
  }
  const undici = JSON.parse(await readFile(join(packageDir, "node_modules/undici/package.json"), "utf8"));
  if (!pkg.bundleDependencies?.includes("undici")
    || pkg.optionalDependencies?.undici !== expectedUndici
    || undici.name !== "undici" || undici.version !== expectedUndici) {
    throw new Error(`packed undici must match the locked version ${expectedUndici}`);
  }

  console.log(`✓ npm pack bundles undici@${expectedUndici}, excludes Python bytecode, and strips published scripts`);
} finally {
  restorePackageJsonBackup();
  await rm(tmp, { recursive: true, force: true });
}

function requireFile(files, path, label) {
  if (!files.has(path)) {
    throw new Error(`${label} is missing ${path}`);
  }
}

function run(command, args, options) {
  const result = spawnSync(command, args, {
    ...options,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed\n${result.stderr || result.stdout}`);
  }
  return result;
}

function restorePackageJsonBackup() {
  if (!existsSync(join(root, "package.json.prepack.bak"))) return;
  const result = spawnSync(process.execPath, ["bin/clean-package-for-publish.mjs", "postpack"], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.status !== 0) {
    console.error(result.stderr || result.stdout);
  }
}
