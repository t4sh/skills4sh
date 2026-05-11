#!/usr/bin/env node
// Run pinned guardskills local scans and verify findings match manifests.

import { readFile, readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const GUARDSKILLS_VERSION = "1.2.1";
const root = process.cwd();
const requested = process.argv.slice(2);
const skills = requested.length > 0
  ? requested
  : (await readdir(join(root, "skills"), { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

let ok = true;

for (const skill of skills) {
  const expected = await expectedFindings(skill);
  const result = spawnSync("npx", [`guardskills@${GUARDSKILLS_VERSION}`, "scan-local", `skills/${skill}`, "--json"], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  let scan;
  try {
    scan = JSON.parse(result.stdout);
  } catch (err) {
    console.error(`✗ ${skill}: guardskills did not emit JSON (${err.message})`);
    console.error(result.stderr || result.stdout);
    ok = false;
    continue;
  }

  const actual = (scan.decision?.findings ?? []).map((finding) => ({
    id: String(finding.id).split(":")[0],
    file: finding.file,
  }));

  const unexpected = actual.filter((finding) => !expected.some((item) => sameFinding(item, finding)));
  const missing = expected.filter((item) => !actual.some((finding) => sameFinding(item, finding)));

  if (unexpected.length || missing.length) {
    ok = false;
    console.error(`✗ ${skill}: guardskills findings do not match .security/${skill}.yaml`);
    for (const finding of unexpected) console.error(`  unexpected: ${finding.id} ${finding.file}`);
    for (const finding of missing) console.error(`  missing: ${finding.id} ${finding.file}`);
    continue;
  }

  if (scan.decision?.level !== "SAFE" && actual.length === 0) {
    ok = false;
    console.error(`✗ ${skill}: guardskills level is ${scan.decision?.level} without documented findings`);
    continue;
  }

  const suffix = scan.decision?.level === "SAFE" ? "SAFE" : `${scan.decision?.level} with documented findings`;
  console.log(`✓ ${skill}: guardskills ${suffix}`);
}

if (!ok) process.exit(1);

function sameFinding(a, b) {
  return a.id === b.id && a.file === b.file;
}

async function expectedFindings(skill) {
  const text = await readFile(join(root, ".security", `${skill}.yaml`), "utf8");
  const out = [];
  let current = null;
  for (const line of text.split("\n")) {
    const id = line.match(/^\s+- id:\s*(\S+)\s*$/);
    if (id) {
      current = { id: id[1] };
      out.push(current);
      continue;
    }
    const file = current && line.match(/^\s+file:\s*(\S+)\s*$/);
    if (file) current.file = file[1];
  }
  return out.filter((finding) => finding.id && finding.file);
}
