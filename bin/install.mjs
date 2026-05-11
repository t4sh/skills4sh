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

import { mkdir, writeFile, rm, readdir, rename, readFile, stat, lstat } from "node:fs/promises";
import { realpathSync, rmSync, renameSync } from "node:fs";
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
// Per-file size cap. Skills are markdown bundles plus small assets; a
// single file exceeding 50 MiB is almost certainly malicious or
// misconfigured. Hash-pinned skills can't grow silently (computedHash
// changes), but a `--repo` install pointed at an attacker-controlled repo
// has no other defense. The cap is enforced via Content-Length when
// available and at body-read time as a backstop.
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

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
  if (args.all) {
    // --force semantics is "skip the safety gate for a specific named skill."
    // Combining --force with --all defeats the per-skill safety net — reject
    // unconditionally before iterating anything, so we never partially-delete.
    if (args.force) {
      throw new Error(
        `--force cannot be combined with --all. Force-removing only makes sense\n` +
        `    for a specific named skill where you've verified the path is correct.\n` +
        `    For bulk removal, drop --force and let the SKILL.md safety gate apply.`,
      );
    }
    // remove --all is destructive — wipes every installed skill in <dest>.
    // Require explicit --yes to prevent typo accidents (e.g. running
    // `remove --all` when you meant `remove <one-skill>`). Equivalent of
    // the "are you sure?" prompt without needing stdin interactivity.
    if (!args.yes) {
      throw new Error(
        `remove --all requires explicit confirmation. Re-run with --yes:\n` +
        `    skills4sh remove --all --yes --dest ${dest}\n` +
        `    (the --yes is required because --all wipes every installed skill in <dest>)`,
      );
    }
    const installed = await discoverInstalledSkills();
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

  // lstat (not stat) so we can detect a symlink BEFORE following it. If a
  // user has e.g. `~/.claude/skills/foo` symlinked to `/some/external/dir`,
  // `rm({ recursive: true })` on the symlink would follow it and delete the
  // target's contents. Refuse outright unless --force, in which case unlink
  // ONLY the symlink itself, never the target.
  let lst;
  try {
    lst = await lstat(skillDir);
  } catch (err) {
    if (err.code === "ENOENT") {
      console.log(`  - ${name} not installed at ${dest}`);
      return;
    }
    throw err;
  }
  if (lst.isSymbolicLink()) {
    if (args.force) {
      if (args.dryRun) {
        console.error(`→ Dry-run remove (symlink) ${name} from ${dest} (no delete)`);
        console.log(JSON.stringify({
          schemaVersion: 1, command: "remove", dryRun: true,
          skill: name, path: skillDir, kind: "symlink",
        }, null, 2));
        return;
      }
      console.log(`→ Unlinking symlink ${name} from ${dest} (target left intact)`);
      await rm(skillDir);
      console.log(`✓ Unlinked symlink ${name}`);
      return;
    }
    throw new Error(
      `refusing to remove ${skillDir}: path is a symlink.\n` +
      `    Pass --force to unlink the symlink itself (the target directory is left intact).\n` +
      `    Without --force, this CLI refuses to follow symlinks under <dest> to avoid\n` +
      `    accidentally deleting unrelated content the symlink points at.`,
    );
  }
  if (!lst.isDirectory()) {
    throw new Error(`refusing to remove: ${skillDir} is not a directory`);
  }

  // Only remove dirs that look like installed skills. Catches typos (rm of an
  // unrelated dir under dest) and prevents removing dirs that were never
  // created by this CLI — the SKILL.md is the proof-of-managed signal.
  // --force bypasses this check (e.g., clean up a half-installed skill where
  // SKILL.md is missing). --force is NOT compatible with --all to keep the
  // bulk-destructive op constrained.
  let hasSkillMd = false;
  try {
    const s = await stat(join(skillDir, "SKILL.md"));
    hasSkillMd = s.isFile();
  } catch { /* hasSkillMd stays false */ }

  if (!hasSkillMd && !args.force) {
    throw new Error(
      `refusing to remove ${skillDir}: no SKILL.md inside (not a skill directory).\n` +
      `    Pass --force to override and remove the directory anyway.`,
    );
  }
  // The --force + --all guard lives in removeMain so we reject before iterating.

  if (args.dryRun) {
    console.error(`→ Dry-run remove ${name} from ${dest} (no delete)`);
    console.log(JSON.stringify({
      schemaVersion: 1, command: "remove", dryRun: true,
      skill: name, path: skillDir,
      kind: hasSkillMd ? "skill" : "force-other-dir",
    }, null, 2));
    return;
  }

  console.log(`→ Removing ${name} from ${dest}${hasSkillMd ? "" : " (--force, no SKILL.md)"}`);
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

// Decides what an interrupt cleanup should do based on the install state at
// the moment SIGINT/SIGTERM arrives. Pure — exported for unit tests.
//
// State transitions during installSkill():
//   "writing"   files being written into stagingDir; backupDir doesn't exist
//   "backed-up" old skillDir has been moved aside to backupDir; new content
//               not yet promoted — the backup is the only intact copy of the
//               user's old skill, MUST NOT be deleted on interrupt
//   "promoted"  new content is at skillDir; backupDir is redundant; safe to rm
//
// Invariant: rmBackup is true ONLY when state === "promoted". The audit-flagged
// regression (where SIGTERM during a "backed-up" window would delete the user's
// only intact copy) is closed by this function.
export function interruptCleanupPlan(state) {
  if (state === "backed-up") {
    return { restoreFromBackup: true, rmStaging: true, rmBackup: false };
  }
  if (state === "promoted") {
    return { restoreFromBackup: false, rmStaging: true, rmBackup: true };
  }
  // "writing" or any other state — backup doesn't exist yet; never touch it.
  return { restoreFromBackup: false, rmStaging: true, rmBackup: false };
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
  // Run verification BEFORE the dry-run early return so that "would this
  // install succeed?" gives the right answer. Dry-run that silently skips
  // verification is misleading — it would say "yes" even when a real install
  // would fail. (Pre-v0.4.6 had this bug; missing lockfile passed dry-run
  // silently but failed real install.)
  if (!args.noVerify) await verifyAgainstLock(name, hash);
  if (args.dryRun) {
    console.log(JSON.stringify({
      schemaVersion: 1, command: "install", dryRun: true,
      skill: name, computedHash: hash,
      source: { owner, repo, ref },
    }, null, 2));
    return;
  }

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
  // container, two shells racing on the same dest) never collide.
  //
  // SIGTERM / SIGINT cleanup is STATE-AWARE — it will never delete the backup
  // while the old skill is the only intact copy. State transitions:
  //   "writing"   → staging is being written; old skillDir intact.
  //   "backed-up" → skillDir has been moved aside to backupDir; new content
  //                 not yet promoted. Interrupting here MUST restore from
  //                 backup, NOT delete it (that would destroy the user's
  //                 installation).
  //   "promoted"  → new content is at skillDir; backup is redundant. Safe
  //                 to delete on interrupt.
  const suffix = randomBytes(6).toString("hex");
  const stagingDir = `${skillDir}.tmp-${suffix}`;
  const backupDir = `${skillDir}.backup-${suffix}`;
  let installState = "writing";
  const cleanupOnSignal = () => {
    const plan = interruptCleanupPlan(installState);
    if (plan.restoreFromBackup) {
      try { rmSync(skillDir, { recursive: true, force: true }); } catch { /* best effort */ }
      try { renameSync(backupDir, skillDir); } catch { /* leave backup for manual recovery */ }
    }
    if (plan.rmStaging) {
      try { rmSync(stagingDir, { recursive: true, force: true }); } catch { /* best effort */ }
    }
    if (plan.rmBackup) {
      try { rmSync(backupDir, { recursive: true, force: true }); } catch { /* best effort */ }
    }
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
      installState = "backed-up";
    }
    await rename(stagingDir, skillDir);
    installState = "promoted";
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
      if (res.ok) {
        // Per-file size cap. Check Content-Length first (cheap; rejects before
        // body read), then check actual buffer length (backstop for missing
        // or lying headers — server could advertise small but send large).
        const contentLength = Number(res.headers.get("content-length"));
        if (Number.isFinite(contentLength) && contentLength > MAX_FILE_SIZE_BYTES) {
          const err = new Error(
            `${repoPath} exceeds ${MAX_FILE_SIZE_BYTES} byte size cap ` +
            `(Content-Length: ${contentLength}). Refusing to download.`,
          );
          err.status = 413;
          throw err;
        }
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length > MAX_FILE_SIZE_BYTES) {
          const err = new Error(
            `${repoPath} exceeds ${MAX_FILE_SIZE_BYTES} byte size cap ` +
            `(actual: ${buf.length} bytes). Refusing.`,
          );
          err.status = 413;
          throw err;
        }
        return buf;
      }
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
      // Lockfile is not present in this ref. Used to silently skip verification
      // ("⚠ skipping" warning) but that was a downgrade-attack vector: an
      // attacker who could remove the lockfile in a malicious commit would
      // bypass hash verification on that commit. v0.4.6 hardens this — a
      // missing lockfile is now a hard error. Users who genuinely have no
      // lockfile (or want to skip verification for testing) must pass
      // --no-verify explicitly.
      throw new Error(
        `skills-lock.json not present in ${owner}/${repo}@${ref}.\n` +
        `    Without a lockfile, hash verification cannot proceed. Either:\n` +
        `      (a) the source repo needs a skills-lock.json checked in, or\n` +
        `      (b) you can pass --no-verify to skip verification (INSECURE — only for\n` +
        `          local testing or repos you fully trust without integrity checks).\n` +
        `    Skipping silently on missing lockfile would be a downgrade-attack vector\n` +
        `    (an attacker removing the lockfile would silently disable verification).`,
      );
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
  // Use stderr — status message, not output. Critical for dry-run where
  // stdout must contain only the JSON envelope.
  console.error(`  ✓ hash verified`);
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
    // `--yes`/`-y` is now meaningful: it's the explicit confirmation required
    // for `remove --all`. It's also still tolerated as a silent no-op for
    // install/list operations (where it was historically used to swallow
    // npm's --yes prompt).
    else if (a === "-y" || a === "--yes") out.yes = true;
    // npm's --global must appear before the package name; if a user passes
    // it trailing we tolerate it as a no-op so `npx skills add <repo> -g`
    // doesn't error.
    else if (a === "-g" || a === "--global") {
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
  skills4sh    remove <name> [options]      # uninstall a single skill from <dest>
  skills4sh    remove --all --yes           # uninstall all installed skills from <dest>
  skills4sh    --list
  skills4sh    --skill <name> [options]
  skills4sh    --all          [options]

Options:
  --repo  <owner/repo>   default: ${DEFAULT_REPO}                            (install only)
  --ref   <sha|branch>   default: ${DEFAULT_REF}                                          (install only)
  --dest  <dir>          default: ${DEFAULT_DEST}
  --force, -f            install: deprecated no-op (re-runs are idempotent)
                         remove:  override the SKILL.md safety gate (removes a directory
                                  that's missing SKILL.md). Not compatible with --all.
                                  For symlink paths, --force unlinks the symlink itself
                                  WITHOUT following it.
  --no-verify            skip skills-lock.json hash verification (INSECURE)  (install only)
  --dry-run              install: download and hash only, no disk write
                         remove:  print what would be deleted, no disk delete
                         Output is JSON with { schemaVersion: 1, command, dryRun, ... }
  -y, --yes              REQUIRED for \`remove --all\` (explicit confirmation for the
                         destructive bulk op). No-op for install/list operations.
  -g, --global           ignored (npm's global-install flag must come before the package name)

Remove semantics:
  - By default, only directories containing a SKILL.md are eligible for removal.
  - Symlinks under <dest> are refused by default; --force unlinks the symlink only
    (never follows it).
  - --force lets you clean up a half-installed directory missing its SKILL.md.
  - --all wipes every installed skill in <dest>; requires --yes as confirmation.

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

  // --version / -v: print only the version to stdout and exit 0. Standard
  // CLI affordance for scripted tooling that wants to query the version
  // without parsing stderr or running a full operation.
  const rawArgs = process.argv.slice(2);
  if (rawArgs.includes("--version") || rawArgs.includes("-v")) {
    console.log(pkgVersion);
    process.exit(0);
  }

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
    // Don't dump the full help text on every arg-parse error — it's verbose
    // and pollutes CI logs. Just print the error and a one-line hint.
    console.error(`✗ ${err.message}`);
    console.error(`    Run \`skills4sh --help\` for usage.`);
    process.exit(1);
  }
  if (args.help || (!args.list && !args.all && !args.skill && !args.remove)) {
    printHelp();
    process.exit(args.help ? 0 : 1);
  }
  if (args.remove && !args.skill && !args.all) {
    console.error("✗ remove: requires a skill name or --all");
    console.error("    Run `skills4sh --help` for usage.");
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
// Tests import these without triggering runMain(). (interruptCleanupPlan is
// already exported inline above.)
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
      // If we're in dry-run mode, emit a JSON error envelope on stdout so
      // downstream tooling that expects dry-run JSON still gets parseable
      // output. The human-facing error always goes to stderr regardless.
      if (args?.dryRun) {
        const command = args.remove ? "remove" : (args.list ? "list" : "install");
        const envelope = {
          schemaVersion: 1, command, dryRun: true,
          error: { message: err.message, code: err.code, status: err.status },
        };
        try { console.log(JSON.stringify(envelope, null, 2)); }
        catch { /* malformed envelope; fall through to stderr */ }
      }
      console.error(`✗ ${err.message}`);
      process.exit(1);
    });
  }
}
