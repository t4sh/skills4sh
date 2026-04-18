#!/usr/bin/env node
// Verify (default) or regenerate (`--write`) computedHash values in skills-lock.json.
// Algorithm mirrors vercel-labs/skills src/local-lock.ts `computeSkillFolderHash`.

import { readFile, readdir, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const root = join(fileURLToPath(import.meta.url), "../..");
const skillsDir = join(root, "skills");
const lockPath = join(root, "skills-lock.json");
const write = process.argv.includes("--write");

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
  const sorted = { ...next, skills: Object.fromEntries(Object.keys(next.skills).sort().map((k) => [k, next.skills[k]])) };
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
