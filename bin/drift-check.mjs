#!/usr/bin/env node
// Validate repository metadata that tends to drift when skills are added.

import { createHash } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { join, relative } from "node:path";
import {
  parseSkillFrontmatter,
  parseSecurityManifest,
  validateSecurityManifest,
  compareSemver,
  listEqual,
} from "./lib/parsers.mjs";

const root = process.cwd();
const errors = [];

const skills = await skillInventory();
const lock = await readJson("skills-lock.json");
const readme = await readText("README.md");
const agents = await readText("AGENTS.md");
const securityDoc = await readText("SECURITY.md");
const cursorPlugin = await readJson(".cursor-plugin/plugin.json");
const claudePlugin = await readJson(".claude-plugin/marketplace.json");

for (const skill of skills) {
  const skillMd = await readText(`skills/${skill}/SKILL.md`);
  const fm = parseSkillFrontmatter(skillMd);
  expect(fm.name === skill, `${skill}: SKILL.md name must match directory`);
  expect(Boolean(fm.description), `${skill}: SKILL.md missing description`);
  expect(Boolean(fm.version), `${skill}: SKILL.md missing metadata.version`);

  const lockEntry = lock.skills?.[skill];
  expect(Boolean(lockEntry), `${skill}: missing skills-lock.json entry`);
  expect(lockEntry?.version === fm.version, `${skill}: skills-lock version must match SKILL.md`);

  // Semver monotonicity: SKILL.md version must not move backwards between commits.
  // Skips silently when HEAD^ is unavailable (initial commit, shallow CI clone) or
  // when the skill is new (no SKILL.md at HEAD^). Local + full-clone CI run this;
  // shallow clones get the check via the pre-commit hook on the contributor's machine.
  const previousVersion = readPreviousSkillVersion(skill);
  if (previousVersion && fm.version) {
    expect(
      compareSemver(fm.version, previousVersion) >= 0,
      `${skill}: SKILL.md version ${fm.version} is older than previous commit's ${previousVersion} (semver monotonicity)`,
    );
  }

  expect(readme.includes(`skills/${skill}/`), `${skill}: README skills table missing skill`);
  expect(readme.includes(`| ${fm.version} |`), `${skill}: README missing version ${fm.version}`);
  expect(agents.includes(`| ${skill} | \`skills/${skill}/\` |`), `${skill}: AGENTS.md table missing skill`);
  expect(securityDoc.includes(`| ${skill} | ${fm.version} | Yes |`), `${skill}: SECURITY supported-version table missing skill/version`);
  expect(securityDoc.includes(`.security/${skill}.yaml`), `${skill}: SECURITY manifest table missing skill`);

  const cursorEntry = cursorPlugin.skills?.find((entry) => entry.name === skill);
  expect(cursorEntry?.path === `skills/${skill}`, `${skill}: .cursor-plugin skill entry missing or wrong path`);

  const securityManifest = await readText(`.security/${skill}.yaml`);
  for (const schemaErr of validateSecurityManifest(securityManifest, skill)) errors.push(schemaErr);
  const manifest = parseSecurityManifest(securityManifest);
  expect(manifest.name === skill, `${skill}: security manifest name mismatch`);
  expect(manifest.version === fm.version, `${skill}: security manifest version mismatch`);

  const actualFiles = await listFiles(`skills/${skill}`);
  const actualRel = actualFiles.map((file) => relative(join(root, "skills", skill), file).split("\\").join("/")).sort();
  const manifestRel = Object.keys(manifest.files).sort();
  expect(listEqual(actualRel, manifestRel), `${skill}: security manifest file inventory does not match skill files`);

  for (const rel of actualRel) {
    const content = await readFile(join(root, "skills", skill, rel));
    const hash = createHash("sha256").update(content).digest("hex");
    expect(manifest.files[rel] === hash, `${skill}: security manifest hash mismatch for ${rel}`);
  }
}

const lockSkills = Object.keys(lock.skills ?? {}).sort();
expect(listEqual(lockSkills, skills), "skills-lock.json entries must match skills/ directories");

const cursorSkills = (cursorPlugin.skills ?? []).map((entry) => entry.name).sort();
expect(listEqual(cursorSkills, skills), ".cursor-plugin/plugin.json skills must match skills/ directories");

const claudeDescription = claudePlugin.plugins?.[0]?.description ?? "";
for (const skill of skills) {
  expect(claudeDescription.includes(skill), `${skill}: .claude-plugin description missing skill`);
}

if (skills.some((skill) => readme.includes(`skills/${skill}/assets/`) || false) === false) {
  const hasAssets = await anySkillHasDir("assets");
  if (hasAssets) {
    expect(readme.includes("assets/"), "README skill structure must document shipped assets/ directories");
    expect(agents.includes("assets/"), "AGENTS.md install instructions must include shipped assets/ directories");
  }
}

if (errors.length > 0) {
  console.error("Drift check failed:");
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}

console.log(`✓ drift check passed for ${skills.length} skills`);

async function skillInventory() {
  const entries = await readdir(join(root, "skills"), { withFileTypes: true });
  return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
}

async function listFiles(dir) {
  const base = join(root, dir);
  const out = [];
  await walk(base, out);
  return out.sort();
}

async function walk(dir, out) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === ".git" || entry.name === "node_modules") continue;
      await walk(path, out);
    } else if (entry.isFile()) {
      out.push(path);
    }
  }
}

async function anySkillHasDir(name) {
  for (const skill of skills) {
    try {
      if ((await stat(join(root, "skills", skill, name))).isDirectory()) return true;
    } catch {
      // Skill does not have this optional directory.
    }
  }
  return false;
}

function expect(condition, message) {
  if (!condition) errors.push(message);
}

async function readText(path) {
  return readFile(join(root, path), "utf8");
}

async function readJson(path) {
  return JSON.parse(await readText(path));
}

function readPreviousSkillVersion(skill) {
  const result = spawnSync("git", ["show", `HEAD^:skills/${skill}/SKILL.md`], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.status !== 0) return null;
  return parseSkillFrontmatter(result.stdout).version ?? null;
}
