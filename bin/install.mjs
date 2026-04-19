#!/usr/bin/env node
// Install skills from a GitHub repo — no git required.
// Discovery via GitHub Trees API (1 request), download via raw.githubusercontent.com.
// Hash scheme matches vercel-labs/skills `computedHash` exactly.
//
// Usage:
//   skills4sh --list | skills4sh add <owner/repo> | skills4sh list [<owner/repo>]
//   skills4sh --skill <name> [--dest <dir>] [--ref <sha|branch|tag>] [--repo <owner/repo>]
//   skills4sh --all          [--dest <dir>] [--ref <sha|branch|tag>] [--repo <owner/repo>]

// Runtime guard: global fetch is Node 18+. `engines` in package.json only warns
// during `npm install`; a direct `node bin/install.mjs` on older Node must fail loud.
if (typeof fetch !== "function") {
  console.error(`✗ Node 18+ required (current: ${process.version}). fetch() is not available.`);
  process.exit(1);
}

import { mkdir, writeFile, rm, readdir, rename, readFile } from "node:fs/promises";
import { join, dirname, isAbsolute, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";
import { createHash } from "node:crypto";

// Self-identify on stderr so users can tell which installer ran. This matters
// because the `skills` bin name collides with Vercel's agent-skills CLI on npm,
// and Node resolves symlinks on argv[1] so we can't reliably detect invocation name.
let pkgVersion = "?";
try {
  const here = dirname(fileURLToPath(import.meta.url));
  const pkg = JSON.parse(await readFile(join(here, "..", "package.json"), "utf8"));
  pkgVersion = pkg.version;
} catch { /* best effort */ }
console.error(`skills4sh v${pkgVersion}`);

const DEFAULT_REPO = "t4sh/skills4sh";
const DEFAULT_REF = "main";
// Windows maps homedir() to %USERPROFILE%, so this becomes e.g. C:\Users\x\.claude\skills.
const DEFAULT_DEST = join(homedir(), ".claude", "skills");
const API = "https://api.github.com";
const RAW = "https://raw.githubusercontent.com";
const DOWNLOAD_CONCURRENCY = 8;
const FETCH_RETRIES = 1;
const FETCH_RETRY_DELAY_MS = 500;

// Optional proxy support: Node's native fetch does not honor HTTPS_PROXY env on its own.
const proxy = process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy;
if (proxy) {
  try {
    const { ProxyAgent, setGlobalDispatcher } = await import("undici");
    setGlobalDispatcher(new ProxyAgent(proxy));
  } catch {
    console.error(`⚠ HTTPS_PROXY set but 'undici' unavailable — proxy not applied.`);
  }
}

let args;
try {
  args = parseArgs(process.argv.slice(2));
} catch (err) {
  console.error(`✗ ${err.message}`);
  printHelp();
  process.exit(1);
}
if (args.help || (!args.list && !args.all && !args.skill)) {
  printHelp();
  process.exit(args.help ? 0 : 1);
}

const repoArg = args.repo ?? DEFAULT_REPO;
if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repoArg)) {
  console.error(`✗ invalid --repo value: ${repoArg} (expected owner/repo)`);
  process.exit(1);
}
const [owner, repo] = repoArg.split("/");
const ref = args.ref ?? DEFAULT_REF;
const dest = args.dest ?? DEFAULT_DEST;
const token = process.env.GITHUB_TOKEN;
const headers = {
  Accept: "application/vnd.github+json",
  "User-Agent": "skills4sh-installer",
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
};

if (args.noVerify) {
  console.error("⚠ --no-verify: skipping hash verification (INSECURE — use only for testing)");
}

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

async function ghTree() {
  const url = `${API}/repos/${owner}/${repo}/git/trees/${encodeURI(ref)}?recursive=1`;
  const res = await fetch(url, { headers });
  if (res.status === 403 || res.status === 429) {
    const remaining = res.headers.get("x-ratelimit-remaining");
    const retryAfter = res.headers.get("retry-after");
    if (remaining === "0" || retryAfter) {
      throw new Error(
        `GitHub rate limit hit${retryAfter ? ` (retry-after: ${retryAfter}s)` : ""}. Set GITHUB_TOKEN to raise the cap.`,
      );
    }
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
    assertSafePathComponent(name, "skill name");
    assertSafeRelPath(rel, node.path);
    (skills[name] ??= []).push({ path: node.path, rel });
  }
  return skills;
}

// Reject any path segment that could escape the install directory.
function assertSafePathComponent(name, label) {
  if (!name || name === "." || name === ".." || name.includes("/") || name.includes("\\") || name.includes("\0")) {
    throw new Error(`unsafe ${label}: ${JSON.stringify(name)}`);
  }
}

function assertSafeRelPath(rel, fullPath) {
  if (rel.includes("\0")) throw new Error(`NUL byte in path: ${fullPath}`);
  if (isAbsolute(rel) || rel.startsWith("/")) throw new Error(`absolute path rejected: ${fullPath}`);
  const normalized = normalize(rel);
  if (normalized.startsWith("..") || normalized.includes(`${"/"}..${"/"}`) || normalized === "..") {
    throw new Error(`path traversal rejected: ${fullPath}`);
  }
  for (const seg of rel.split("/")) {
    if (seg === "..") throw new Error(`path traversal rejected: ${fullPath}`);
  }
}

async function installSkill(name, files) {
  console.log(`→ Installing ${name} from ${owner}/${repo}@${ref}`);

  const skillDir = join(dest, name);
  if (!args.force && await hasContent(skillDir)) {
    throw new Error(
      `${skillDir} is not empty. Re-run with --force to overwrite (existing files will be deleted).`,
    );
  }

  // Stage in memory first, verify, then commit to disk.
  // AbortController cancels in-flight requests as soon as one fails.
  const ac = new AbortController();
  const downloaded = await mapConcurrent(files, DOWNLOAD_CONCURRENCY, async (f) => ({
    rel: f.rel,
    content: await fetchRaw(f.path, ac),
  }), ac);

  const hash = computeSkillFolderHash(downloaded);
  if (!args.noVerify) await verifyAgainstLock(name, hash);

  // Atomic swap: write everything into a sibling tmp dir first, then rename over skillDir.
  // On crash/failure mid-write, the original skillDir is untouched and the .tmp-<pid> dir
  // is removed. rename() is atomic on POSIX and near-atomic on Windows for same-volume moves.
  const stagingDir = `${skillDir}.tmp-${process.pid}`;
  await rm(stagingDir, { recursive: true, force: true });
  try {
    for (const f of downloaded) {
      const out = join(stagingDir, f.rel);
      await mkdir(dirname(out), { recursive: true });
      await writeFile(out, f.content);
    }
    await rm(skillDir, { recursive: true, force: true });
    await mkdir(dirname(skillDir), { recursive: true });
    await rename(stagingDir, skillDir);
  } catch (err) {
    await rm(stagingDir, { recursive: true, force: true }).catch(() => {});
    throw err;
  }
  for (const f of downloaded) console.log(`  ✓ ${join(skillDir, f.rel)}`);
  console.log(`✓ Installed ${name} (${files.length} files) — ${hash.slice(0, 12)}…`);
}

async function hasContent(dir) {
  try {
    const entries = await readdir(dir);
    return entries.length > 0;
  } catch {
    return false;
  }
}

async function mapConcurrent(items, limit, fn, ac) {
  const out = new Array(items.length);
  let next = 0;
  async function worker() {
    while (!ac?.signal.aborted) {
      const i = next++;
      if (i >= items.length) return;
      try {
        out[i] = await fn(items[i]);
      } catch (err) {
        ac?.abort();
        throw err;
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

async function fetchRaw(repoPath, ac) {
  // encodeURI preserves path separators; ref may legitimately contain slashes (e.g. feat/x).
  const url = `${RAW}/${owner}/${repo}/${encodeURI(ref)}/${encodeURI(repoPath)}`;
  let lastErr;
  for (let attempt = 0; attempt <= FETCH_RETRIES; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": headers["User-Agent"],
          ...(headers.Authorization ? { Authorization: headers.Authorization } : {}),
        },
        signal: ac?.signal,
      });
      if (res.ok) return Buffer.from(await res.arrayBuffer());
      if (res.status >= 500 && attempt < FETCH_RETRIES) {
        lastErr = new Error(`GET ${url} → ${res.status}`);
        await new Promise((r) => setTimeout(r, FETCH_RETRY_DELAY_MS));
        continue;
      }
      const err = new Error(`GET ${url} → ${res.status}`);
      err.status = res.status;
      throw err;
    } catch (err) {
      if (err.name === "AbortError") throw err;
      if (err.status !== undefined) throw err; // non-retryable HTTP error
      if (attempt < FETCH_RETRIES) {
        lastErr = err;
        await new Promise((r) => setTimeout(r, FETCH_RETRY_DELAY_MS));
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

// Mirrors vercel-labs/skills src/local-lock.ts `computeSkillFolderHash`.
function computeSkillFolderHash(files) {
  const sorted = [...files].sort((a, b) => a.rel.localeCompare(b.rel));
  const h = createHash("sha256");
  for (const f of sorted) {
    h.update(f.rel);
    h.update(f.content);
  }
  return h.digest("hex");
}

async function verifyAgainstLock(name, got) {
  let raw;
  try {
    raw = await fetchRaw("skills-lock.json");
  } catch (err) {
    if (err.status === 404) {
      console.error(`  ⚠ skills-lock.json not present in ${owner}/${repo}@${ref} — skipping verification`);
      return;
    }
    throw new Error(`failed to fetch skills-lock.json: ${err.message}`);
  }

  let lock;
  try {
    lock = JSON.parse(raw.toString("utf8"));
  } catch (err) {
    throw new Error(`skills-lock.json is not valid JSON: ${err.message}`);
  }

  // Strict: once a lock file is present in the repo, every installed skill must have an
  // entry with a computedHash. A missing entry is how a supply-chain attacker would slip
  // in a new skill without invalidating existing hashes — refuse to install.
  const expected = lock?.skills?.[name]?.computedHash;
  if (!expected) {
    throw new Error(
      `skills-lock.json has no hash for ${name} — refusing to install.\n` +
      `    The repo publishes a lockfile, but this skill is missing from it.\n` +
      `    Pass --no-verify to bypass (INSECURE).`,
    );
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
  // Subcommand-style: `skills4sh add <owner/repo> [flags]` / `skills4sh list [<owner/repo>]`.
  // Same argv when the `skills` bin from *this* package is on PATH (e.g. after `npm i -g skills4sh`).
  let i = 0;
  if (argv[0] === "add" || argv[0] === "list") {
    const sub = argv[0];
    if (argv[0] === "list") out.list = true;
    i = 1;
    if (argv[i] && !argv[i].startsWith("-") && argv[i].includes("/")) {
      out.repo = argv[i];
      i++;
    } else if (argv[i] && !argv[i].startsWith("-")) {
      throw new Error(
        `invalid ${sub} target: ${JSON.stringify(argv[i])} (expected owner/repo, e.g. t4sh/skills4sh)`,
      );
    }
    // `add <repo>` with no --skill/--all defaults to installing all skills.
    if (argv[0] === "add") out._subcommandAdd = true;
  }
  for (; i < argv.length; i++) {
    const a = argv[i];
    const needsValue = (flag) => {
      const v = argv[++i];
      if (v === undefined || v.startsWith("--")) {
        throw new Error(`${flag} requires a value`);
      }
      return v;
    };
    if (a === "--list") out.list = true;
    else if (a === "--all") out.all = true;
    else if (a === "--skill") out.skill = needsValue("--skill");
    else if (a === "--dest") out.dest = needsValue("--dest");
    else if (a === "--ref") out.ref = needsValue("--ref");
    else if (a === "--repo") out.repo = needsValue("--repo");
    else if (a === "--no-verify") out.noVerify = true;
    else if (a === "--force" || a === "-f") out.force = true;
    else if (a === "-h" || a === "--help") out.help = true;
    // Users often confuse npm's `--yes` (must be before the package name) with a trailing flag.
    else if (a === "-y" || a === "--yes") {
      /* no-op */
    } else throw new Error(`unknown argument: ${a}`);
  }
  if (out._subcommandAdd && !out.skill && !out.all && !out.list) out.all = true;
  delete out._subcommandAdd;
  return out;
}

function printHelp() {
  console.log(`skills4sh — install agent skills from GitHub (no git required)

Usage:
  skills       add <owner/repo> [options]   # installs all skills from the repo
  skills       list [<owner/repo>]
  skills4sh    --list
  skills4sh    --skill <name> [options]
  skills4sh    --all          [options]

Options:
  --repo  <owner/repo>   default: ${DEFAULT_REPO}
  --ref   <sha|branch>   default: ${DEFAULT_REF}
  --dest  <dir>          default: ${DEFAULT_DEST}
  --force, -f            overwrite a non-empty destination
  --no-verify            skip skills-lock.json hash verification (INSECURE)
  -y, --yes              ignored (use npx --yes <pkg> ... so npm skips the install prompt)

Env:
  GITHUB_TOKEN           raises the 60 req/hr anonymous rate limit

Hash scheme:
  sha256(hex) matching vercel-labs/skills computedHash
  (sorted relPath + content, no separators, forward slashes).
`);
}
