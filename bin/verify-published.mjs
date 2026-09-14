#!/usr/bin/env node
// Verify registry metadata for the version that was just published.

import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { validatePublishedMetadata } from "./lib/published-package.mjs";

const pkg = JSON.parse(await readFile("package.json", "utf8"));
const version = pkg.version;
const expectedGitHead = run("git", ["rev-parse", "HEAD"]).stdout.trim();
const MAX_ATTEMPTS = 12;
const RETRY_DELAY_MS = 5_000;

const view = await npmViewWithRetry(version);
validatePublishedMetadata(view, pkg, expectedGitHead);
console.log(`✓ skills4sh@${version} has the pinned undici bundle, gitHead, and provenance metadata`);

async function npmViewWithRetry(version) {
  let lastErr;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return JSON.parse(run("npm", ["view", `skills4sh@${version}`, "--json"]).stdout);
    } catch (err) {
      lastErr = err;
      if (attempt === MAX_ATTEMPTS) break;
      console.error(`npm registry metadata not ready for skills4sh@${version}; retrying (${attempt}/${MAX_ATTEMPTS})...`);
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    }
  }
  throw lastErr;
}

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
