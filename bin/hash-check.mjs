#!/usr/bin/env node
// Verify (default) or regenerate (`--write`) computedHash values in skills-lock.json.
// Algorithm mirrors vercel-labs/skills src/local-lock.ts `computeSkillFolderHash`.
//
// Usage:
//   hash-check [--write] [--root <dir>]
//   --root defaults to process.cwd(); looks for <root>/skills/ and <root>/skills-lock.json

import { readFile, readdir, writeFile, stat } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { createHash } from "node:crypto";

const args = process.argv.slice(2);
const write = args.includes("--write");
const rootIdx = args.indexOf("--root");
let rootArg = process.cwd();
if (rootIdx !== -1) {
  const v = args[rootIdx + 1];
  if (!v || v.startsWith("--")) {
    console.error("✗ --root requires a directory path");
    process.exit(1);
  }
  rootArg = resolve(v);
}
const root = rootArg;
const skillsDir = join(root, "skills");
const lockPath = join(root, "skills-lock.json");

for (const [label, path, kind] of [["skills/", skillsDir, "dir"], ["skills-lock.json", lockPath, "file"]]) {
  try {
    const s = await stat(path);
    if (kind === "dir" && !s.isDirectory()) throw new Error("not a directory");
    if (kind === "file" && !s.isFile()) throw new Error("not a file");
  } catch (err) {
    console.error(`✗ ${label} not found at ${path} (${err.message})`);
    process.exit(1);
  }
}

const lock = JSON.parse(await readFile(lockPath, "utf8"));
const names = (await readdir(skillsDir, { withFileTypes: true }))
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort();

let ok = true;
const next = { ...lock, skills: {} };

for (const name of names) {
  const got = await computeHash(join(skillsDir, name));
  const expected = lock.skills?.[name]?.computedHash;
  const match = got === expected;
  if (!match) ok = false;
  console.log(`${match ? "✓" : "✗"} ${name}  ${got}${match ? "" : `  (was ${expected})`}`);
  next.skills[name] = { ...(lock.skills?.[name] ?? {}), computedHash: got };
}

if (write) {
  const sorted = {
    ...next,
    skills: Object.fromEntries(Object.keys(next.skills).sort().map((k) => [k, next.skills[k]])),
  };
  await writeFile(lockPath, JSON.stringify(sorted, null, 2) + "\n");
  console.log(`\n→ wrote ${lockPath}`);
  process.exit(0);
}
process.exit(ok ? 0 : 1);

async function computeHash(dir) {
  const files = [];
  await walk(dir, dir, files);
  files.sort((a, b) => a.rel.localeCompare(b.rel));
  const h = createHash("sha256");
  for (const f of files) {
    h.update(f.rel);
    h.update(f.content);
  }
  return h.digest("hex");
}

async function walk(base, cur, out) {
  for (const e of await readdir(cur, { withFileTypes: true })) {
    if (e.isDirectory()) {
      if (e.name === ".git" || e.name === "node_modules") continue;
      await walk(base, join(cur, e.name), out);
    } else if (e.isFile()) {
      out.push({
        rel: relative(base, join(cur, e.name)).split("\\").join("/"),
        content: await readFile(join(cur, e.name)),
      });
    }
  }
}
