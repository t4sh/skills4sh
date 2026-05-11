#!/usr/bin/env node
// Verify the npm package payload before publishing.
//
// The dry-run check validates the file list npm will publish. The real pack
// check validates the produced tarball. npm only adds the registry-level
// _hasShrinkwrap flag during publish, so bin/verify-published.mjs checks that
// after the package is live.

import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const tmp = await mkdtemp(join(tmpdir(), "skills4sh-pack-"));

try {
  const dryRun = run("npm", ["pack", "--json", "--dry-run"], { cwd: root });
  const dry = parsePackJson(dryRun.stdout, "npm pack --dry-run");
  const dryFiles = new Set((dry.files ?? []).map((f) => f.path));
  requireFile(dryFiles, "npm-shrinkwrap.json", "dry-run package file list");
  requireFile(dryFiles, "skills-lock.json", "dry-run package file list");
  requireFile(dryFiles, "bin/install.mjs", "dry-run package file list");

  const packed = run("npm", ["pack", "--json", "--pack-destination", tmp], { cwd: root });
  const pack = parsePackJson(packed.stdout, "npm pack");
  const tgz = join(tmp, pack.filename);
  const extractDir = join(tmp, "extract");

  run("tar", ["-xzf", tgz, "-C", tmp], { cwd: root });
  const pkg = JSON.parse(await readFile(join(extractDir, "..", "package", "package.json"), "utf8"));
  if (pkg.name !== "skills4sh") throw new Error(`packed package has unexpected name: ${pkg.name}`);
  await readFile(join(extractDir, "..", "package", "npm-shrinkwrap.json"));

  console.log("✓ npm pack includes npm-shrinkwrap.json");
} finally {
  await rm(tmp, { recursive: true, force: true });
}

function parsePackJson(stdout, label) {
  let parsed;
  try {
    parsed = JSON.parse(stdout);
  } catch (err) {
    throw new Error(`${label} did not emit JSON: ${err.message}`);
  }
  if (!Array.isArray(parsed) || parsed.length !== 1) {
    throw new Error(`${label} returned unexpected JSON shape`);
  }
  return parsed[0];
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
