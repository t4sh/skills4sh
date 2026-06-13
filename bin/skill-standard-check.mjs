#!/usr/bin/env node
// Enforce the objective, machine-checkable parts of docs/SKILL_AUTHORING_STANDARD.md.
// Importable for tests; CLI invocation runs against process.cwd().

import { readdir, readFile, stat } from "node:fs/promises";
import { realpathSync } from "node:fs";
import { join, relative, basename } from "node:path";
import { pathToFileURL } from "node:url";

const ALLOWED_TOP_FIELDS = new Set(["name", "description", "license", "compatibility", "metadata"]);
const REQUIRED_TOP_FIELDS = ["name", "description", "license", "compatibility", "metadata"];
const ALLOWED_METADATA_FIELDS = new Set(["author", "version", "tags"]);
const REQUIRED_METADATA_FIELDS = ["author", "version", "tags"];
const MAX_SKILL_BODY_WORDS = 3500;

export async function runSkillStandardChecks(rootDir) {
  const root = rootDir;
  const errors = [];
  const skillsDir = join(root, "skills");
  const skills = await skillInventory(root);

  for (const skill of skills) {
    const skillRoot = join(skillsDir, skill);
    const skillMdPath = join(skillRoot, "SKILL.md");
    let skillMd;
    try {
      skillMd = await readFile(skillMdPath, "utf8");
    } catch {
      errors.push(`${skill}: missing SKILL.md`);
      continue;
    }

    const fm = parseFrontmatter(skillMd);
    if (!fm.ok) {
      errors.push(`${skill}: ${fm.error}`);
      continue;
    }

    for (const field of fm.topFields.keys()) {
      if (!ALLOWED_TOP_FIELDS.has(field)) {
        errors.push(`${skill}: SKILL.md frontmatter has disallowed top-level field '${field}'`);
      }
    }
    for (const field of REQUIRED_TOP_FIELDS) {
      const present = fm.topFields.has(field) && (field === "metadata" || nonEmpty(fm.topFields.get(field)));
      if (!present) {
        errors.push(`${skill}: SKILL.md frontmatter missing required field '${field}'`);
      }
    }

    if (fm.topFields.get("name") !== skill) {
      errors.push(`${skill}: SKILL.md frontmatter name must match directory`);
    }
    if (fm.topFields.get("license") !== "MIT") {
      errors.push(`${skill}: SKILL.md frontmatter license must be MIT`);
    }
    const description = fm.topFields.get("description") ?? "";
    if (description && !description.startsWith("This skill should be used when")) {
      errors.push(`${skill}: SKILL.md description must use third-person trigger form: "This skill should be used when ..."`);
    }

    for (const field of fm.metadataFields.keys()) {
      if (!ALLOWED_METADATA_FIELDS.has(field)) {
        errors.push(`${skill}: SKILL.md metadata has disallowed field '${field}'`);
      }
    }
    for (const field of REQUIRED_METADATA_FIELDS) {
      if (!nonEmpty(fm.metadataFields.get(field))) {
        errors.push(`${skill}: SKILL.md metadata missing required field '${field}'`);
      }
    }
    const tags = fm.metadataFields.get("tags") ?? "";
    if (tags && tags.split(",").map((tag) => tag.trim()).filter(Boolean).length === 0) {
      errors.push(`${skill}: SKILL.md metadata.tags must contain comma-separated keywords`);
    }

    const body = skillMd.slice(fm.endIndex).trim();
    const bodyWords = countWords(body);
    if (bodyWords > MAX_SKILL_BODY_WORDS) {
      errors.push(`${skill}: SKILL.md body has ${bodyWords} words; max machine-checkable threshold is ${MAX_SKILL_BODY_WORDS}`);
    }
    if (/^##\s+Installation\s*$/im.test(body)) {
      errors.push(`${skill}: SKILL.md must not contain an install-this-skill section (## Installation)`);
    }
    if (/\bnpx\s+skills\s+add\b/.test(skillMd)) {
      errors.push(`${skill}: SKILL.md must not embed 'npx skills add' install commands`);
    }

    const files = await listFiles(skillRoot);
    for (const abs of files) {
      const rel = relative(skillRoot, abs).split("\\").join("/");
      const base = basename(rel).toLowerCase();
      if (["readme.md", "changelog.md", "install.md", "installation.md"].includes(base)) {
        errors.push(`${skill}: disallowed auxiliary skill doc '${rel}' (use root README or references linked from SKILL.md)`);
      }
      if (rel.endsWith(".md")) {
        const content = abs === skillMdPath ? skillMd : await readFile(abs, "utf8");
        if (/\bnpx\s+skills\s+add\b/.test(content)) {
          errors.push(`${skill}: ${rel} must not embed 'npx skills add' install commands`);
        }
      }
    }
  }

  return { errors, skills };
}

async function skillInventory(root) {
  const skillsPath = join(root, "skills");
  const entries = await readdir(skillsPath, { withFileTypes: true });
  return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
}

async function listFiles(dir) {
  const out = [];
  await walk(dir, out);
  return out.sort();
}

async function walk(dir, out) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === ".git" || entry.name === "node_modules") continue;
      await walk(path, out);
    } else if (entry.isFile()) {
      if (entry.name === ".DS_Store") continue;
      out.push(path);
    }
  }
}

function parseFrontmatter(markdown) {
  const match = markdown.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) return { ok: false, error: "missing YAML frontmatter" };

  const topFields = new Map();
  const metadataFields = new Map();
  let inMetadata = false;

  for (const rawLine of match[1].split("\n")) {
    const line = rawLine.replace(/\s+$/, "");
    if (!line.trim() || line.trim().startsWith("#")) continue;

    const top = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (top) {
      const [, key, value] = top;
      topFields.set(key, stripQuotes(value));
      inMetadata = key === "metadata";
      continue;
    }

    const nested = line.match(/^\s+([A-Za-z0-9_-]+):\s*(.*)$/);
    if (nested && inMetadata) {
      metadataFields.set(nested[1], stripQuotes(nested[2]));
      continue;
    }

    if (/^\S/.test(line)) inMetadata = false;
  }

  return { ok: true, topFields, metadataFields, endIndex: match[0].length };
}

function stripQuotes(value) {
  const trimmed = String(value ?? "").trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1).replace(/\\"/g, '"').replace(/\\'/g, "'");
  }
  return trimmed;
}

function nonEmpty(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function countWords(text) {
  return (text.match(/\b\S+\b/g) ?? []).length;
}

function stripCodeFences(content) {
  let out = content.replace(/^```[\s\S]*?^```/gm, "").replace(/^~~~[\s\S]*?^~~~/gm, "");
  out = out.replace(/`[^`\n]*`/g, "");
  return out;
}

if (process.argv[1]) {
  let invokedFile;
  try { invokedFile = realpathSync(process.argv[1]); }
  catch { invokedFile = process.argv[1]; }
  if (import.meta.url === pathToFileURL(invokedFile).href) {
    const { errors, skills } = await runSkillStandardChecks(process.cwd());
    if (errors.length > 0) {
      console.error("Skill standard check failed:");
      for (const error of errors) console.error(`  - ${error}`);
      process.exit(1);
    }
    console.log(`✓ skill standard check passed for ${skills.length} skills`);
  }
}
