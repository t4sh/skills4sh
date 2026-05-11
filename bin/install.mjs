#!/usr/bin/env node
// Install skills from a GitHub repo — no git required.
// Discovery via GitHub Trees API (1 request), download via raw.githubusercontent.com.
// Hash scheme matches vercel-labs/skills `computedHash` exactly.
//
// Usage:
//   skills4sh --list | skills4sh add <owner/repo> | skills4sh list [<owner/repo>]
//   skills4sh --skill <name> [--dest <dir>] [--ref <sha|branch|tag>] [--repo <owner/repo>]
//   skills4sh --all          [--dest <dir>] [--ref <sha|branch|tag>] [--repo <owner/repo>]

// Runtime guard: we require Node 22+ (oldest non-EOL LTS). `engines` in
// package.json only warns during `npm install`; a direct `node bin/install.mjs`
// on older Node must fail loud. fetch() is the proxy check — it's been global
// since Node 18, so its absence proves we're on something even older.
const major = Number(process.versions.node.split(".")[0]);
if (typeof fetch !== "function" || major < 22) {
  console.error(`✗ Node 22+ required (current: ${process.version}).`);
  process.exit(1);
}

import { mkdir, writeFile, rm, readdir, rename, readFile, stat } from "node:fs/promises";
import { realpathSync, rmSync } from "node:fs";
import { join, dirname, isAbsolute, normalize } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { homedir } from "node:os";
import { createHash, randomBytes } from "node:crypto";

const DEFAULT_REPO = "t4sh/skills4sh";
const DEFAULT_REF = "main";
// Windows maps homedir() to %USERPROFILE%, so this becomes e.g. C:\Users\x\.claude\skills.
const DEFAULT_DEST = join(homedir(), ".claude", "skills");
const API = process.env.SKILLS4SH_API_BASE ?? "https://api.github.com";
const RAW = process.env.SKILLS4SH_RAW_BASE ?? "https://raw.githubusercontent.com";
const DOWNLOAD_CONCURRENCY = 8;
const FETCH_RETRIES = 1;
const FETCH_RETRY_DELAY_MS = 500;

// Module-scoped runtime state. Populated by runMain() when invoked as CLI;
// remains undefined when the module is imported (e.g. by tests). Functions
// like ghTree() and installSkill() reference these — tests must only call
// the pure exports below, which don't touch this state.
let args, owner, repo, ref, dest, headers, token;

async function main() {
  // Uninstall path: pure-local, no GitHub fetch needed. Bail before any
  // network call so `remove` works offline and never needs GITHUB_TOKEN.
  if (args.remove) return removeMain();

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

async function removeMain() {
  const installed = await discoverInstalledSkills();
  if (args.all) {
    if (installed.length === 0) {
      console.log(`No skills installed at ${dest}.`);
      return;
    }
    for (const name of installed) await removeSkill(name);
    return;
  }
  await removeSkill(args.skill);
}

// Walk dest and find subdirs that contain a SKILL.md. Anything else under dest
// (sibling files, unrelated dirs) is left alone — this CLI manages only skills.
async function discoverInstalledSkills() {
  let entries;
  try {
    entries = await readdir(dest, { withFileTypes: true });
  } catch (err) {
    if (err.code === "ENOENT") return [];
    throw err;
  }
  const found = [];
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    assertSafePathComponent(e.name, "installed skill name");
    try {
      const s = await stat(join(dest, e.name, "SKILL.md"));
      if (s.isFile()) found.push(e.name);
    } catch {
      // No SKILL.md — not a managed skill, skip silently.
    }
  }
  return found.sort();
}

async function removeSkill(name) {
  assertSafePathComponent(name, "skill name");
  const skillDir = join(dest, name);

  let dirStat;
  try {
    dirStat = await stat(skillDir);
  } catch (err) {
    if (err.code === "ENOENT") {
      console.log(`  - ${name} not installed at ${dest}`);
      return;
    }
    throw err;
  }
  if (!dirStat.isDirectory()) {
    throw new Error(`refusing to remove: ${skillDir} is not a directory`);
  }

  // Only remove dirs that look like installed skills. Catches typos (rm of an
  // unrelated dir under dest) and prevents removing dirs that were never
  // created by this CLI — the SKILL.md is the proof-of-managed signal.
  try {
    const s = await stat(join(skillDir, "SKILL.md"));
    if (!s.isFile()) throw new Error("SKILL.md is not a file");
  } catch {
    throw new Error(
      `refusing to remove ${skillDir}: no SKILL.md inside (not a skill directory).\n` +
      `    Pass --force to override (NOT IMPLEMENTED in this version — remove manually if needed).`,
    );
  }

  if (args.dryRun) {
    console.error(`→ Dry-run remove ${name} from ${dest} (no delete)`);
    console.log(JSON.stringify({ skill: name, action: "remove", path: skillDir }, null, 2));
    return;
  }

  console.log(`→ Removing ${name} from ${dest}`);
  await rm(skillDir, { recursive: true });
  console.log(`✓ Removed ${name}`);
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
  if (args.dryRun) console.error(`→ Dry-run ${name} from ${owner}/${repo}@${ref} (no write)`);
  else console.log(`→ Installing ${name} from ${owner}/${repo}@${ref}`);

  const skillDir = join(dest, name);

  // Stage in memory first, verify, then commit to disk.
  // AbortController cancels in-flight requests as soon as one fails.
  const ac = new AbortController();
  const downloaded = await mapConcurrent(files, DOWNLOAD_CONCURRENCY, async (f) => ({
    rel: f.rel,
    content: await fetchRaw(f.path, ac),
  }), ac);

  const hash = computeSkillFolderHash(downloaded);
  if (args.dryRun) {
    console.log(JSON.stringify({ skill: name, computedHash: hash }, null, 2));
    return;
  }
  if (!args.noVerify) await verifyAgainstLock(name, hash);

  // Idempotent: if what's on disk matches what we just verified, skip the write.
  // This is the common case for `add` when the user re-runs and nothing changed.
  const existingHash = await hashExistingSkill(skillDir);
  if (existingHash === hash) {
    console.log(`  = ${name} already up to date — ${hash.slice(0, 12)}…`);
    return;
  }

  // Atomic swap with backup-and-restore:
  //   1. Write all files into a sibling staging dir (.tmp-<random>).
  //   2. If skillDir exists, rename it aside to .backup-<random> (cheap, atomic).
  //   3. Rename staging into place.
  //   4. On success, remove the backup. On any failure, restore the backup and rethrow.
  //
  // The suffix uses crypto.randomBytes so two concurrent invocations (same PID in a
  // container, two shells racing on the same dest) never collide. SIGTERM / SIGINT
  // trigger best-effort cleanup so an interrupt mid-download doesn't leak staging dirs.
  const suffix = randomBytes(6).toString("hex");
  const stagingDir = `${skillDir}.tmp-${suffix}`;
  const backupDir = `${skillDir}.backup-${suffix}`;
  const cleanupOnSignal = () => {
    try { rmSync(stagingDir, { recursive: true, force: true }); } catch { /* best effort */ }
    try { rmSync(backupDir, { recursive: true, force: true }); } catch { /* best effort */ }
  };
  process.once("SIGINT", cleanupOnSignal);
  process.once("SIGTERM", cleanupOnSignal);

  let backupExists = false;
  try {
    for (const f of downloaded) {
      const out = join(stagingDir, f.rel);
      await mkdir(dirname(out), { recursive: true });
      await writeFile(out, f.content);
    }
    await mkdir(dirname(skillDir), { recursive: true });
    // Move old skill aside (rename is cheap and atomic on same volume); we only
    // delete it once the new content is safely in place.
    if (existingHash !== null) {
      await rename(skillDir, backupDir);
      backupExists = true;
    }
    await rename(stagingDir, skillDir);
    if (backupExists) {
      await rm(backupDir, { recursive: true, force: true });
      backupExists = false;
    }
  } catch (err) {
    // Restore the old skill from backup if the new content didn't land cleanly.
    if (backupExists) {
      try {
        await rm(skillDir, { recursive: true, force: true });
        await rename(backupDir, skillDir);
      } catch (restoreErr) {
        // Both the new install AND the restore failed. Surface both — the user
        // may need to manually inspect skillDir and backupDir.
        err.message = `${err.message}\n    restore also failed: ${restoreErr.message}\n    inspect ${backupDir} for the prior version`;
        throw err;
      }
    }
    await rm(stagingDir, { recursive: true, force: true }).catch(() => {});
    throw err;
  } finally {
    process.removeListener("SIGINT", cleanupOnSignal);
    process.removeListener("SIGTERM", cleanupOnSignal);
  }
  const verb = existingHash ? "Updated" : "Installed";
  for (const f of downloaded) console.log(`  ✓ ${join(skillDir, f.rel)}`);
  console.log(`✓ ${verb} ${name} (${files.length} files) — ${hash.slice(0, 12)}…`);
}

// Walk skillDir and compute the same hash scheme the installer uses, so we can
// compare against the just-downloaded content and short-circuit idempotent re-runs.
// Returns null if skillDir doesn't exist or is empty.
async function hashExistingSkill(skillDir) {
  const files = [];
  async function walk(rel) {
    let entries;
    try {
      entries = await readdir(join(skillDir, rel), { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const childRel = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) await walk(childRel);
      else if (e.isFile()) {
        files.push({ rel: childRel, content: await readFile(join(skillDir, childRel)) });
      }
    }
  }
  await walk("");
  if (files.length === 0) return null;
  return computeSkillFolderHash(files);
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
  // Subcommand-style: `skills4sh add <owner/repo>` / `skills4sh list [<owner/repo>]` /
  // `skills4sh remove <skill>`. Same argv when the `skills` bin from *this*
  // package is on PATH (e.g. after `npm i -g skills4sh`).
  let i = 0;
  if (argv[0] === "add" || argv[0] === "list" || argv[0] === "remove") {
    const sub = argv[0];
    if (sub === "list") out.list = true;
    if (sub === "remove") out.remove = true;
    i = 1;
    if (argv[i] && !argv[i].startsWith("-")) {
      if (sub === "remove") {
        // `remove` positional is a skill name (no slash). Reject owner/repo by
        // accident — that would be misleading at best, destructive at worst.
        if (argv[i].includes("/")) {
          throw new Error(
            `remove: expected skill name, got ${JSON.stringify(argv[i])} (no slash; use --skill <name> if you must)`,
          );
        }
        out.skill = argv[i];
        i++;
      } else if (argv[i].includes("/")) {
        out.repo = argv[i];
        i++;
      } else {
        throw new Error(
          `invalid ${sub} target: ${JSON.stringify(argv[i])} (expected owner/repo, e.g. t4sh/skills4sh)`,
        );
      }
    }
    // `add <repo>` with no --skill/--all defaults to installing all skills.
    if (sub === "add") out._subcommandAdd = true;
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
    else if (a === "--dry-run") out.dryRun = true;
    else if (a === "--force" || a === "-f") out.force = true;
    else if (a === "-h" || a === "--help") out.help = true;
    // Users often confuse npm's `--yes` / `--global` (which must appear before
    // the package name) with trailing CLI flags. Accept both as silent no-ops
    // so e.g. `npx skills add <repo> -g -y` never errors if we shadow npx.
    else if (a === "-y" || a === "--yes" || a === "-g" || a === "--global") {
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
  skills4sh    add <owner/repo> [options]   # installs all skills from the repo
  skills4sh    list [<owner/repo>]
  skills4sh    remove <name>                # uninstall a single skill from <dest>
  skills4sh    remove --all                 # uninstall all installed skills from <dest>
  skills4sh    --list
  skills4sh    --skill <name> [options]
  skills4sh    --all          [options]

Options:
  --repo  <owner/repo>   default: ${DEFAULT_REPO}                            (install only)
  --ref   <sha|branch>   default: ${DEFAULT_REF}                                          (install only)
  --dest  <dir>          default: ${DEFAULT_DEST}
  --force, -f            (deprecated no-op — re-runs are now idempotent)
  --no-verify            skip skills-lock.json hash verification (INSECURE)  (install only)
  --dry-run              install: download and hash only, no disk write
                         remove:  print what would be deleted, no disk delete
  -y, --yes              ignored (use npx --yes <pkg> ... so npm skips the install prompt)
  -g, --global           ignored (npm's global-install flag must come before the package name)

Remove semantics:
  Only directories under <dest> that contain a SKILL.md are eligible for removal.
  Anything else (unrelated files, dirs without SKILL.md) is left untouched. Refuses
  destructive ops on misconfigured paths; rm manually if you need to override.

Env:
  GITHUB_TOKEN           raises the 60 req/hr anonymous rate limit

Hash scheme:
  sha256(hex) matching vercel-labs/skills computedHash
  (sorted relPath + content, no separators, forward slashes).
`);
}

// CLI entry point. Wraps everything that has runtime side effects so tests
// can import the pure functions above without triggering version-print,
// proxy setup, arg parsing, or main().
async function runMain() {
  // Self-identify on stderr so users can tell which installer ran. The published
  // `skills` bin (Vercel's agent-skills CLI) is a near-namesake; printing the
  // version makes it unambiguous which one executed.
  let pkgVersion = "?";
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    const pkg = JSON.parse(await readFile(join(here, "..", "package.json"), "utf8"));
    pkgVersion = pkg.version;
  } catch { /* best effort */ }
  console.error(`skills4sh v${pkgVersion}`);

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

  try {
    args = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(`✗ ${err.message}`);
    printHelp();
    process.exit(1);
  }
  if (args.help || (!args.list && !args.all && !args.skill && !args.remove)) {
    printHelp();
    process.exit(args.help ? 0 : 1);
  }
  if (args.remove && !args.skill && !args.all) {
    console.error("✗ remove: requires a skill name or --all");
    printHelp();
    process.exit(1);
  }

  const repoArg = args.repo ?? DEFAULT_REPO;
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repoArg)) {
    console.error(`✗ invalid --repo value: ${repoArg} (expected owner/repo)`);
    process.exit(1);
  }
  [owner, repo] = repoArg.split("/");
  ref = args.ref ?? DEFAULT_REF;
  dest = args.dest ?? DEFAULT_DEST;
  token = process.env.GITHUB_TOKEN;
  headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "skills4sh-installer",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  if (args.noVerify) {
    console.error("⚠ --no-verify: skipping hash verification (INSECURE — use only for testing)");
  }
  if (args.force) {
    console.error("⚠ --force is deprecated and will be removed in v1.0 — re-runs are idempotent (skipped by content hash).");
  }

  await main();
}

// Test-only exports: pure functions with no module-state dependency.
// Tests import these without triggering runMain().
export {
  parseArgs,
  assertSafePathComponent,
  assertSafeRelPath,
  computeSkillFolderHash,
  discoverSkills,
};

// CLI guard: runMain only fires when invoked as the entry script
// (`node bin/install.mjs ...` or via the `skills4sh` bin symlink npm
// creates at `node_modules/.bin/skills4sh`), not when imported.
//
// realpathSync resolves the symlink: when invoked via npm's `.bin/`
// symlink, process.argv[1] is the symlink path while import.meta.url
// is the resolved target. A direct equality check fails and the CLI
// stays silent — that bug shipped in v0.3.1 (#TODO post-mortem link).
if (process.argv[1]) {
  let invokedFile;
  try {
    invokedFile = realpathSync(process.argv[1]);
  } catch {
    invokedFile = process.argv[1];
  }
  if (import.meta.url === pathToFileURL(invokedFile).href) {
    runMain().catch((err) => {
      console.error(`✗ ${err.message}`);
      process.exit(1);
    });
  }
}
