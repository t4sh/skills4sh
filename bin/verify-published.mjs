#!/usr/bin/env node
// Verify registry metadata for the version that was just published.

import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";

const pkg = JSON.parse(await readFile("package.json", "utf8"));
const version = pkg.version;
const expectedGitHead = process.env.GITHUB_SHA || run("git", ["rev-parse", "HEAD"]).stdout.trim();

const view = JSON.parse(run("npm", ["view", `skills4sh@${version}`, "--json"]).stdout);

if (view._hasShrinkwrap !== true) {
  throw new Error(`skills4sh@${version} registry metadata must have _hasShrinkwrap: true`);
}

if (view.gitHead && view.gitHead !== expectedGitHead) {
  throw new Error(`skills4sh@${version} gitHead mismatch: expected ${expectedGitHead}, got ${view.gitHead}`);
}

if (!view.dist?.attestations?.provenance) {
  throw new Error(`skills4sh@${version} is missing npm provenance attestation metadata`);
}

console.log(`✓ skills4sh@${version} has _hasShrinkwrap, gitHead, and provenance metadata`);

function run(command, args) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed\n${result.stderr || result.stdout}`);
  }
  return result;
}
