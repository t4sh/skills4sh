#!/usr/bin/env node
// Validate repository metadata that tends to drift when skills are added.
//
// Importable: tests can `import { runDriftChecks }` and run against a fixture
// repo without spawning a subprocess. CLI invocation runs main(process.cwd()).

import { createHash } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
import { realpathSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { join, relative, dirname, posix } from "node:path";
import {
  parseSkillFrontmatter,
  parseSecurityManifest,
  validateSecurityManifest,
  parseExpectedFindings,
  validateAcknowledgedReasons,
  compareSemver,
  listEqual,
} from "./lib/parsers.mjs";

// Runs all drift checks against the given repo root. Returns { errors, skills }.
// Used by both the CLI invocation and by tests (which pass a fixture tmpdir).
export async function runDriftChecks(rootDir) {
  const root = rootDir;
  const errors = [];

  const expect = (condition, message) => {
    if (!condition) errors.push(message);
  };
  const readText = (path) => readFile(join(root, path), "utf8");
  const readJson = async (path) => JSON.parse(await readText(path));

  const skills = await skillInventory(root);
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
    const previousVersion = readPreviousSkillVersion(root, skill);
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
    // Acknowledged-reason validation: any expected_finding with
    // acknowledged: true must carry a substantive reason. Closes the
    // "rubber-stamp" gap where the severity floor could be silenced
    // without explanation.
    const findings = parseExpectedFindings(securityManifest);
    for (const reasonErr of validateAcknowledgedReasons(findings, skill)) errors.push(reasonErr);
    const manifest = parseSecurityManifest(securityManifest);
    expect(manifest.name === skill, `${skill}: security manifest name mismatch`);
    expect(manifest.version === fm.version, `${skill}: security manifest version mismatch`);

    const actualFiles = await listFiles(root, `skills/${skill}`);
    const actualRel = actualFiles.map((file) => relative(join(root, "skills", skill), file).split("\\").join("/")).sort();
    const manifestRel = Object.keys(manifest.files).sort();
    expect(listEqual(actualRel, manifestRel), `${skill}: security manifest file inventory does not match skill files`);

    for (const rel of actualRel) {
      const content = await readFile(join(root, "skills", skill, rel));
      const hash = createHash("sha256").update(content).digest("hex");
      expect(manifest.files[rel] === hash, `${skill}: security manifest hash mismatch for ${rel}`);
    }

    // Markdown-link validation: every relative-path link in a *.md file under
    // the skill must resolve to a file that exists in the skill directory.
    // Markdown heading anchors are validated too, including same-file `#anchor`
    // links and cross-file `file.md#anchor` links. External URLs, mailto:, and
    // links to non-md asset files (icon.svg, .js scripts in assets/) are all
    // checked uniformly — anything referenced must be present in skills/<skill>/.
    for (const linkErr of await validateSkillLinks(root, skill, actualRel)) {
      errors.push(linkErr);
    }

    // Orphan-reference detection: the reverse of the link check above. Every
    // file under references/ must be linked from SKILL.md, per the authoring
    // standard's progressive-disclosure gate — a reference no one can reach
    // from the entry point is dead weight that never loads. assets/ are
    // exempt (only reference files must be linked).
    for (const orphanErr of findOrphanReferences(skill, actualRel, skillMd)) {
      errors.push(orphanErr);
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
    const hasAssets = await anySkillHasDir(root, skills, "assets");
    if (hasAssets) {
      expect(readme.includes("assets/"), "README skill structure must document shipped assets/ directories");
      expect(agents.includes("assets/"), "AGENTS.md install instructions must include shipped assets/ directories");
    }
  }

  return { errors, skills };
}

async function skillInventory(root) {
  const entries = await readdir(join(root, "skills"), { withFileTypes: true });
  return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
}

async function listFiles(root, dir) {
  const base = join(root, dir);
  const out = [];
  await walk(base, out);
  return out.sort();
}

async function walk(dir, out) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === ".git" || entry.name === "node_modules" || entry.name === "__pycache__") continue;
      await walk(path, out);
    } else if (entry.isFile()) {
      if (entry.name === ".DS_Store" || entry.name.endsWith(".pyc")) continue;
      out.push(path);
    }
  }
}

async function anySkillHasDir(root, skills, name) {
  for (const skill of skills) {
    try {
      if ((await stat(join(root, "skills", skill, name))).isDirectory()) return true;
    } catch {
      // Skill does not have this optional directory.
    }
  }
  return false;
}

function readPreviousSkillVersion(root, skill) {
  const result = spawnSync("git", ["show", `HEAD^:skills/${skill}/SKILL.md`], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.status !== 0) return null;
  return parseSkillFrontmatter(result.stdout).version ?? null;
}

// Walks every .md file in a skill and finds markdown links that point at
// relative paths. Returns array of error strings — empty when all links
// resolve to files that exist in the skill's file inventory.
//
// Matches:
//   [text](path/in/skill)                      ← validated
//   ![alt](assets/icon.svg)                    ← validated
//   [name](references/foo.md#anchor)           ← file and anchor validated
//   [name](#anchor)                            ← same-file anchor validated
//
// Skipped:
//   [text](https://example.com)                ← external URL
//   [text](mailto:foo@bar)                     ← mailto
//   `[text](path)` inside ``` code fences ``   ← code blocks excluded
async function validateSkillLinks(root, skill, skillFilesRel) {
  const errors = [];
  const skillRoot = join(root, "skills", skill);
  const validRel = new Set(skillFilesRel);
  const mdFiles = skillFilesRel.filter((p) => p.endsWith(".md"));

  for (const mdRel of mdFiles) {
    const content = await readFile(join(skillRoot, mdRel), "utf8");
    const stripped = stripCodeFences(content);
    // Markdown link regex: optional leading `!` for images, then [text](target).
    // The target is captured up to the first close-paren NOT preceded by an escape.
    const linkRe = /!?\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
    let match;
    while ((match = linkRe.exec(stripped)) !== null) {
      const target = match[1];
      // Skip external schemes and javascript: / mailto: etc.
      if (/^[a-z][a-z0-9+.-]*:/i.test(target)) continue;
      if (target.startsWith("//")) continue;

      const { pathOnly, anchor } = splitMarkdownTarget(target);
      const mdDir = dirname(mdRel);
      const resolved = pathOnly
        ? posix.normalize(mdDir === "." ? pathOnly : posix.join(mdDir, pathOnly))
        : mdRel;

      // Reject any escape attempts that go above the skill root.
      if (resolved.startsWith("..") || resolved.startsWith("/")) {
        errors.push(`${skill}: ${mdRel} contains markdown link escaping skill dir: ${target}`);
        continue;
      }

      if (!validRel.has(resolved)) {
        errors.push(`${skill}: ${mdRel} contains broken markdown link to ${target} (resolves to ${resolved}, not in skill files)`);
        continue;
      }

      if (anchor && resolved.endsWith(".md")) {
        const targetContent = resolved === mdRel
          ? content
          : await readFile(join(skillRoot, resolved), "utf8");
        const anchors = markdownHeadingAnchors(targetContent);
        const normalizedAnchor = normalizeMarkdownAnchor(anchor);
        if (!anchors.has(normalizedAnchor)) {
          errors.push(`${skill}: ${mdRel} contains broken markdown anchor ${target} (anchor #${normalizedAnchor} not found in ${resolved})`);
        }
      }
    }
  }
  return errors;
}

function splitMarkdownTarget(target) {
  const hashIdx = target.indexOf("#");
  const queryIdx = target.indexOf("?");
  const pathEnd = [hashIdx, queryIdx]
    .filter((idx) => idx !== -1)
    .sort((a, b) => a - b)[0];
  const pathOnly = pathEnd === undefined ? target : target.slice(0, pathEnd);
  const anchor = hashIdx === -1 ? "" : target.slice(hashIdx + 1).replace(/\?.*$/, "");
  return { pathOnly, anchor };
}

function normalizeMarkdownAnchor(anchor) {
  try {
    return decodeURIComponent(anchor);
  } catch {
    return anchor;
  }
}

function markdownHeadingAnchors(content) {
  const anchors = new Set();
  const seen = new Map();
  const stripped = stripCodeFences(content);
  const headingRe = /^(#{1,6})\s+(.+?)\s*#*\s*$/gm;
  let match;
  while ((match = headingRe.exec(stripped)) !== null) {
    const base = githubMarkdownSlug(match[2]);
    if (!base) continue;
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    anchors.add(count === 0 ? base : `${base}-${count}`);
  }
  return anchors;
}

function stripMarkdownInlineHtml(heading) {
  let output = "";
  let index = 0;

  while (index < heading.length) {
    if (heading[index] !== "<") {
      output += heading[index];
      index += 1;
      continue;
    }

    const tagStart = index + 1;
    const tagNameMatch = heading.slice(tagStart).match(/^\/?[A-Za-z][A-Za-z0-9:-]*/u);
    if (!tagNameMatch) {
      output += heading[index];
      index += 1;
      continue;
    }

    const closeIndex = heading.indexOf(">", tagStart);
    if (closeIndex !== -1) {
      index = closeIndex + 1;
      continue;
    }

    // Malformed/incomplete inline HTML such as "<script Heading" should not
    // leave the raw tag prefix in the generated slug, but any following heading
    // words still participate in anchor matching.
    index = tagStart + tagNameMatch[0].length;
  }

  return output;
}

function githubMarkdownSlug(heading) {
  return stripMarkdownInlineHtml(heading)
    .replace(/`([^`]*)`/g, "$1")
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, "")
    .replace(/\s/g, "-");
}

// Returns the set of skill-relative paths that SKILL.md links to via markdown
// links. SKILL.md lives at the skill root, so a normalized link target is
// already skill-relative. Mirrors validateSkillLinks's extraction: code fences
// excluded, external/in-page/scheme links ignored, anchors and queries stripped.
function skillMdLinkTargets(skillMdContent) {
  const targets = new Set();
  const stripped = stripCodeFences(skillMdContent);
  const linkRe = /!?\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
  let match;
  while ((match = linkRe.exec(stripped)) !== null) {
    const target = match[1];
    if (/^[a-z][a-z0-9+.-]*:/i.test(target)) continue; // external scheme / mailto
    if (target.startsWith("#")) continue; // in-page anchor
    if (target.startsWith("//")) continue; // protocol-relative
    const pathOnly = target.replace(/[#?].*$/, "");
    if (!pathOnly) continue;
    targets.add(posix.normalize(pathOnly));
  }
  return targets;
}

// Flags any file under references/ that SKILL.md does not link to. Returns an
// array of error strings — empty when every reference is reachable from the
// entry point. Pairs with validateSkillLinks (which checks the other direction:
// that links resolve to real files).
function findOrphanReferences(skill, skillFilesRel, skillMdContent) {
  const referenceFiles = skillFilesRel.filter((p) => p.startsWith("references/"));
  if (referenceFiles.length === 0) return [];

  const linked = skillMdLinkTargets(skillMdContent);
  const errors = [];
  for (const ref of referenceFiles) {
    if (!linked.has(ref)) {
      errors.push(`${skill}: ${ref} exists but is not linked from SKILL.md (orphan reference file)`);
    }
  }
  return errors;
}

// Removes fenced code blocks (``` ... ``` or ~~~ ... ~~~) and inline-code
// spans (`...`) from markdown so link-regex doesn't match code samples.
function stripCodeFences(content) {
  // Remove fenced blocks first.
  let out = content.replace(/^```[\s\S]*?^```/gm, "").replace(/^~~~[\s\S]*?^~~~/gm, "");
  // Remove inline code.
  out = out.replace(/`[^`\n]*`/g, "");
  return out;
}

// CLI guard — runs only when invoked directly as a script.
if (process.argv[1]) {
  let invokedFile;
  try { invokedFile = realpathSync(process.argv[1]); }
  catch { invokedFile = process.argv[1]; }
  if (import.meta.url === pathToFileURL(invokedFile).href) {
    const { errors, skills } = await runDriftChecks(process.cwd());
    if (errors.length > 0) {
      console.error("Drift check failed:");
      for (const error of errors) console.error(`  - ${error}`);
      process.exit(1);
    }
    console.log(`✓ drift check passed for ${skills.length} skills`);
  }
}
