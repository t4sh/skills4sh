#!/usr/bin/env node
// Verify registry metadata for the version that was just published.
//
// npm 12 publishes asynchronously. `npm publish` prints "Your package is being
// processed and may take a few minutes to become available" and returns
// `+ skills4sh@X.Y.Z` before the version is readable from the registry.
// Measured lag after that line: 126s for v0.5.2, 158s for v0.5.3. The budget
// below (~5 minutes) covers the observed worst case with roughly 2x headroom.
//
// Only a version the registry is not serving yet is retried. Auth, network, and
// package-name failures fail immediately, so the budget can never mask a real
// defect as a propagation lag.

import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import {
  validatePublishedMetadata,
  isVersionNotVisible,
  fetchDistTags,
  assertLatestDistTag,
} from "./lib/published-package.mjs";

const pkg = JSON.parse(await readFile("package.json", "utf8"));
const version = pkg.version;
const expectedGitHead = run("git", ["rev-parse", "HEAD"]).stdout.trim();
const MAX_ATTEMPTS = 60; // 59 waits x 5s ~= 5 minutes
const RETRY_DELAY_MS = 5_000;

const view = await waitForPublishedVersion();
validatePublishedMetadata(view, pkg, expectedGitHead);
console.log(`✓ ${pkg.name}@${version} has the pinned undici bundle, gitHead, and provenance metadata, and latest points at it`);

async function waitForPublishedVersion() {
  let lastErr;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const view = JSON.parse(npmView(version).stdout);
      assertLatestDistTag(await fetchDistTags(pkg.name), version);
      return view;
    } catch (err) {
      if (!isVersionNotVisible(err)) throw err;
      lastErr = err;
      if (attempt === MAX_ATTEMPTS) break;
      console.error(`npm registry metadata not ready for ${pkg.name}@${version}; retrying (${attempt}/${MAX_ATTEMPTS})...`);
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    }
  }
  throw lastErr;
}

// --prefer-online forces revalidation rather than trusting a cached packument.
// The registry serves packuments with `cache-control: public, max-age=300`, and
// a cached copy from before the publish would report the version as missing.
function npmView(version) {
  return run("npm", ["view", `${pkg.name}@${version}`, "--json", "--prefer-online"]);
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
