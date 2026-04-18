#!/usr/bin/env node
// Install skills from a GitHub repo — no git required.
// Discovery via GitHub Trees API (1 request), download via raw.githubusercontent.com.
// Hash scheme matches vercel-labs/skills `computedHash` exactly.
//
// Usage:
//   skills4sh --list
//   skills4sh --skill <name> [--dest <dir>] [--ref <sha|branch|tag>] [--repo <owner/repo>]
//   skills4sh --all          [--dest <dir>] [--ref <sha|branch|tag>] [--repo <owner/repo>]

import { mkdir, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import { createHash } from "node:crypto";

const DEFAULT_REPO = "t4sh/skills4sh";
const DEFAULT_REF = "main";
const DEFAULT_DEST = join(homedir(), ".claude", "skills");
const API = "https://api.github.com";
const RAW = "https://raw.githubusercontent.com";

const args = parseArgs(process.argv.slice(2));
if (args.help || (!args.list && !args.all && !args.skill)) {
  printHelp();
  process.exit(args.help ? 0 : 1);
}

const [owner, repo] = (args.repo ?? DEFAULT_REPO).split("/");
const ref = args.ref ?? DEFAULT_REF;
const dest = args.dest ?? DEFAULT_DEST;
const token = process.env.GITHUB_TOKEN;
const headers = {
  Accept: "application/vnd.github+json",
  "User-Agent": "skills4sh-installer",
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
};

main().catch((err) => {
  console.error(`✗ ${err.message}`);
  process.exit(1);
});

async function main() {
  const tree = await ghTree();
  const skills = discoverSkills(tree);

  if (args.list) {
    console.log(`Available skills in ${owner}/${repo}@${ref}:\n`);
    for (const name of Object.keys(skills).sort()) {
      console.log(`  • ${name} (${skills[name].length} files)`);
    }
    return;
  }

  const targets = args.all ? Object.keys(skills) : [args.skill];
  for (const name of targets) {
    if (!skills[name]) throw new Error(`skill not found: ${name}`);
    await installSkill(name, skills[name]);
  }
}

// Single request: recursive tree of the entire repo at `ref`.
async function ghTree() {
  const url = `${API}/repos/${owner}/${repo}/git/trees/${encodeURIComponent(ref)}?recursive=1`;
  const res = await fetch(url, { headers });
  if (res.status === 403 && res.headers.get("x-ratelimit-remaining") === "0") {
    throw new Error("GitHub rate limit hit. Set GITHUB_TOKEN to raise the cap.");
  }
  if (!res.ok) throw new Error(`GET trees/${ref} → ${res.status} ${res.statusText}`);
  const body = await res.json();
  if (body.truncated) {
    throw new Error("Repo tree truncated by GitHub API (too large). Use tarball strategy instead.");
  }
  return body.tree.filter((n) => n.type === "blob");
}

function discoverSkills(tree) {
  const skills = {};
  for (const node of tree) {
    const m = node.path.match(/^skills\/([^/]+)\/(.+)$/);
    if (!m) continue;
    const [, name, rel] = m;
    if (rel.startsWith(".git/") || rel.startsWith("node_modules/")) continue;
    (skills[name] ??= []).push({ path: node.path, rel, sha: node.sha });
  }
  return skills;
}

async function installSkill(name, files) {
  console.log(`→ Installing ${name} from ${owner}/${repo}@${ref}`);
  const skillDir = join(dest, name);
  const downloaded = [];

  for (const f of files) {
    const bytes = await fetchRaw(f.path);
    const out = join(skillDir, f.rel);
    await mkdir(dirname(out), { recursive: true });
    await writeFile(out, bytes);
    downloaded.push({ rel: f.rel, content: bytes });
    console.log(`  ✓ ${out}`);
  }

  const hash = computeSkillFolderHash(downloaded);
  if (!args.noVerify) await verifyAgainstLock(name, hash);
  console.log(`✓ Installed ${name} (${files.length} files) — ${hash.slice(0, 12)}…`);
}

async function fetchRaw(repoPath) {
  const url = `${RAW}/${owner}/${repo}/${ref}/${repoPath}`;
  const res = await fetch(url, { headers: { "User-Agent": headers["User-Agent"] } });
  if (!res.ok) throw new Error(`GET ${url} → ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

// Mirrors vercel-labs/skills src/local-lock.ts `computeSkillFolderHash`.
//   - sha256, hex, lowercase
//   - files sorted by relativePath.localeCompare
//   - for each file: update(relPath as utf-8 string); update(content bytes)
//   - NO separator between path/content or between files
//   - forward-slash paths; exclude .git/ and node_modules/ (done in discovery)
function computeSkillFolderHash(files) {
  const sorted = [...files].sort((a, b) => a.rel.localeCompare(b.rel));
  const h = createHash("sha256");
  for (const f of sorted) {
    h.update(f.rel.split("\\").join("/"));
    h.update(f.content);
  }
  return h.digest("hex");
}

async function verifyAgainstLock(name, got) {
  let lock;
  try {
    const raw = await fetchRaw("skills-lock.json");
    lock = JSON.parse(raw.toString("utf8"));
  } catch {
    console.log(`  ⚠ skills-lock.json unavailable — skipping verification`);
    return;
  }
  const expected = lock?.skills?.[name]?.computedHash;
  if (!expected) {
    console.log(`  ⚠ no hash for ${name} in skills-lock.json — skipping verification`);
    return;
  }
  if (got !== expected) {
    throw new Error(
      `hash mismatch for ${name}\n    expected ${expected}\n    got      ${got}`,
    );
  }
  console.log(`  ✓ hash verified`);
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--list") out.list = true;
    else if (a === "--all") out.all = true;
    else if (a === "--skill") out.skill = argv[++i];
    else if (a === "--dest") out.dest = argv[++i];
    else if (a === "--ref") out.ref = argv[++i];
    else if (a === "--repo") out.repo = argv[++i];
    else if (a === "--no-verify") out.noVerify = true;
    else if (a === "-h" || a === "--help") out.help = true;
  }
  return out;
}

function printHelp() {
  console.log(`skills4sh — install agent skills from GitHub (no git required)

Usage:
  skills4sh --list
  skills4sh --skill <name> [options]
  skills4sh --all          [options]

Options:
  --repo  <owner/repo>   default: ${DEFAULT_REPO}
  --ref   <sha|branch>   default: ${DEFAULT_REF}
  --dest  <dir>          default: ${DEFAULT_DEST}
  --no-verify            skip skills-lock.json hash verification

Env:
  GITHUB_TOKEN           raises the 60 req/hr anonymous rate limit

Hash scheme:
  sha256(hex) matching vercel-labs/skills computedHash
  (sorted relPath + content, no separators, forward slashes).
`);
}
