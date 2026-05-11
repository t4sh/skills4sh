#!/usr/bin/env node
// Pre-publish release invariant checks.

import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";

const pkg = JSON.parse(await readFile("package.json", "utf8"));
const version = pkg.version;
const expectedTag = `v${version}`;
const head = run("git", ["rev-parse", "HEAD"]).stdout.trim();
const tag = process.env.RELEASE_TAG || process.env.GITHUB_REF_NAME || exactTag();

if (tag !== expectedTag) {
  throw new Error(`release tag must be ${expectedTag}; got ${tag || "(none)"}`);
}

const taggedCommit = run("git", ["rev-list", "-n", "1", expectedTag]).stdout.trim();
if (taggedCommit !== head) {
  throw new Error(`HEAD must match ${expectedTag}; tag points to ${taggedCommit}, HEAD is ${head}`);
}

const tagType = run("git", ["cat-file", "-t", expectedTag]).stdout.trim();
if (tagType !== "tag") {
  throw new Error(`${expectedTag} must be an annotated signed tag, not a lightweight tag`);
}

if (process.env.GITHUB_REPOSITORY && process.env.GITHUB_TOKEN) {
  await verifyGitHubTag(expectedTag, head);
} else {
  const verify = spawnSync("git", ["tag", "-v", expectedTag], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (verify.status !== 0) {
    throw new Error(`${expectedTag} must have a locally verifiable GPG signature\n${verify.stderr || verify.stdout}`);
  }
}

console.log(`✓ release tag ${expectedTag} is signed and points at HEAD ${head}`);

function exactTag() {
  const result = spawnSync("git", ["describe", "--exact-match", "--tags", "HEAD"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  return result.status === 0 ? result.stdout.trim() : "";
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

async function verifyGitHubTag(tagName, expectedHead) {
  const ref = await githubJson(`/repos/${process.env.GITHUB_REPOSITORY}/git/ref/tags/${tagName}`);
  if (ref.object?.type !== "tag") {
    throw new Error(`${tagName} must be an annotated signed tag; GitHub ref type is ${ref.object?.type}`);
  }

  const tagObject = await githubJson(`/repos/${process.env.GITHUB_REPOSITORY}/git/tags/${ref.object.sha}`);
  if (tagObject.object?.sha !== expectedHead) {
    throw new Error(`${tagName} tag object points to ${tagObject.object?.sha}, not HEAD ${expectedHead}`);
  }
  if (tagObject.verification?.verified !== true) {
    throw new Error(`${tagName} is not GitHub-verified: ${tagObject.verification?.reason ?? "unknown reason"}`);
  }
}

async function githubJson(path) {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "skills4sh-release-check",
    },
  });
  if (!res.ok) {
    throw new Error(`GitHub API ${path} failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
}
