// End-to-end tests for bin/drift-check.mjs.
//
// Builds a complete fixture "repo" (skills/, .security/, lockfile, README,
// AGENTS, SECURITY, plugin manifests) in a tmpdir, runs runDriftChecks()
// against it, and asserts on the resulting errors array.
//
// Scenarios covered:
//   - clean fixture passes
//   - hash mismatch in security manifest
//   - version mismatch between SKILL.md and skills-lock.json
//   - missing skill row in README
//   - schema-invalid security manifest (bad enum value)
//   - file inventory drift (file on disk not in manifest)
//   - markdown-link validation (broken link, anchored link, external URL)
//
// Run: node --test tests/drift-check.test.mjs

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runDriftChecks } from "../bin/drift-check.mjs";

const sha256 = (s) => createHash("sha256").update(s).digest("hex");

// Builds a complete, drift-check-passing fixture in `dir`. Returns the file
// contents map so tests can mutate one piece.
async function buildFixture(dir, files = {}) {
  // Defaults for a single skill named "demo" v1.0.0
  const SKILL_MD = files["skills/demo/SKILL.md"] ?? `---
name: demo
description: "A demo skill for tests"
license: MIT
compatibility: any
metadata:
  author: test
  version: "1.0.0"
  tags: demo, test
---

# Demo

See [references/foo.md](references/foo.md) and [icon](assets/icon.svg).
`;
  const FOO_MD = files["skills/demo/references/foo.md"] ?? "# foo reference\n\nSee [back to SKILL](../SKILL.md).\n";
  const ICON = files["skills/demo/assets/icon.svg"] ?? "<svg/>\n";

  const skillFiles = {
    "SKILL.md": SKILL_MD,
    "references/foo.md": FOO_MD,
    "assets/icon.svg": ICON,
  };
  const fileHashes = Object.fromEntries(
    Object.entries(skillFiles).map(([rel, content]) => [rel, sha256(content)]),
  );

  // Compute folder hash (matches install.mjs computeSkillFolderHash)
  const sorted = Object.entries(skillFiles).sort(([a], [b]) => a.localeCompare(b));
  const folderHasher = createHash("sha256");
  for (const [rel, content] of sorted) {
    folderHasher.update(rel);
    folderHasher.update(content);
  }
  const folderHash = folderHasher.digest("hex");

  const SECURITY_YAML = files[".security/demo.yaml"] ?? `# AST10 manifest
skill:
  name: demo
  version: "1.0.0"
  license: MIT
  author: test
  repository: https://example.com/demo
  path: skills/demo

integrity:
  hash_algorithm: sha256
  files:
    SKILL.md: ${fileHashes["SKILL.md"]}
    references/foo.md: ${fileHashes["references/foo.md"]}
    assets/icon.svg: ${fileHashes["assets/icon.svg"]}

permissions:
  alwaysAllow: []
  rationale: "test"

execution_context:
  sandbox: host-agent
  network: none
  filesystem: read-write
  shell: none
  risk_tier: low
`;

  const SKILLS_LOCK = files["skills-lock.json"] ?? JSON.stringify({
    version: 1,
    skills: {
      demo: {
        source: "test/test",
        sourceType: "github",
        version: "1.0.0",
        computedHash: folderHash,
      },
    },
  }, null, 2);

  const README = files["README.md"] ?? `# fixture

| Skill | Description | Version |
|-------|-------------|---------|
| [demo](skills/demo/) | A demo skill | 1.0.0 |

Each skill ships SKILL.md plus optional references/ and assets/ directories.
`;
  const AGENTS = files["AGENTS.md"] ?? `# AGENTS

| demo | \`skills/demo/\` |

Each skill bundle includes SKILL.md, references/, and assets/.
`;
  const SECURITY_DOC = files["SECURITY.md"] ?? `# Security

| Skill | Version | Supported |
|-------|---------|-----------|
| demo | 1.0.0 | Yes |

.security/demo.yaml
`;
  const CURSOR_PLUGIN = files[".cursor-plugin/plugin.json"] ?? JSON.stringify({
    name: "fixture",
    skills: [{ name: "demo", path: "skills/demo" }],
  }, null, 2);
  const CLAUDE_PLUGIN = files[".claude-plugin/marketplace.json"] ?? JSON.stringify({
    name: "fixture",
    plugins: [{ name: "fixture", description: "Includes demo skill" }],
  }, null, 2);

  // Write everything to disk.
  await mkdir(join(dir, "skills/demo/references"), { recursive: true });
  await mkdir(join(dir, "skills/demo/assets"), { recursive: true });
  await mkdir(join(dir, ".security"), { recursive: true });
  await mkdir(join(dir, ".cursor-plugin"), { recursive: true });
  await mkdir(join(dir, ".claude-plugin"), { recursive: true });

  for (const [rel, content] of Object.entries(skillFiles)) {
    await writeFile(join(dir, "skills/demo", rel), content);
  }
  await writeFile(join(dir, ".security/demo.yaml"), SECURITY_YAML);
  await writeFile(join(dir, "skills-lock.json"), SKILLS_LOCK);
  await writeFile(join(dir, "README.md"), README);
  await writeFile(join(dir, "AGENTS.md"), AGENTS);
  await writeFile(join(dir, "SECURITY.md"), SECURITY_DOC);
  await writeFile(join(dir, ".cursor-plugin/plugin.json"), CURSOR_PLUGIN);
  await writeFile(join(dir, ".claude-plugin/marketplace.json"), CLAUDE_PLUGIN);

  return { folderHash, fileHashes };
}

function setupTmp() {
  return mkdtempSync(join(tmpdir(), "skills4sh-drift-"));
}

describe("drift-check — clean baseline", () => {
  test("a complete valid fixture passes with zero errors", async () => {
    const dir = setupTmp();
    try {
      await buildFixture(dir);
      const { errors, skills } = await runDriftChecks(dir);
      assert.deepEqual(errors, [], `expected no errors, got:\n${errors.join("\n")}`);
      assert.deepEqual(skills, ["demo"]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("ignored macOS metadata files do not create manifest drift", async () => {
    const dir = setupTmp();
    try {
      await buildFixture(dir);
      await writeFile(join(dir, "skills/demo/.DS_Store"), "local metadata");
      const { errors } = await runDriftChecks(dir);
      assert.deepEqual(errors, [], `expected no errors, got:\n${errors.join("\n")}`);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("drift-check — content integrity failures", () => {
  test("file hash mismatch in security manifest is flagged", async () => {
    const dir = setupTmp();
    try {
      // Build fixture with deliberately-wrong hash for SKILL.md.
      await buildFixture(dir, {
        ".security/demo.yaml": `skill:
  name: demo
  version: "1.0.0"
  license: MIT
  author: t
  repository: https://x
  path: skills/demo
integrity:
  hash_algorithm: sha256
  files:
    SKILL.md: ${sha256("wrong-content")}
    references/foo.md: ${sha256("# foo reference\n\nSee [back to SKILL](../SKILL.md).\n")}
    assets/icon.svg: ${sha256("<svg/>\n")}
permissions:
  alwaysAllow: []
  rationale: "test"
execution_context:
  sandbox: host-agent
  network: none
  filesystem: read-write
  shell: none
  risk_tier: low
`,
      });
      const { errors } = await runDriftChecks(dir);
      assert.equal(
        errors.some((e) => e.includes("hash mismatch") && e.includes("SKILL.md")),
        true,
        `expected hash mismatch error, got:\n${errors.join("\n")}`,
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("version mismatch between SKILL.md and skills-lock.json is flagged", async () => {
    const dir = setupTmp();
    try {
      await buildFixture(dir, {
        "skills-lock.json": JSON.stringify({
          version: 1,
          skills: { demo: { source: "x", sourceType: "github", version: "9.9.9", computedHash: "deadbeef" } },
        }, null, 2),
      });
      const { errors } = await runDriftChecks(dir);
      assert.equal(
        errors.some((e) => e.includes("skills-lock version must match SKILL.md")),
        true,
        `expected version mismatch error, got:\n${errors.join("\n")}`,
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("drift-check — doc-sync failures", () => {
  test("README missing skill row is flagged", async () => {
    const dir = setupTmp();
    try {
      await buildFixture(dir, { "README.md": "# README without the skill\n" });
      const { errors } = await runDriftChecks(dir);
      assert.equal(
        errors.some((e) => e.includes("README skills table missing skill")),
        true,
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("AGENTS.md missing skill row is flagged", async () => {
    const dir = setupTmp();
    try {
      await buildFixture(dir, { "AGENTS.md": "# AGENTS without the skill\n" });
      const { errors } = await runDriftChecks(dir);
      assert.equal(
        errors.some((e) => e.includes("AGENTS.md table missing skill")),
        true,
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("drift-check — manifest schema failures", () => {
  test("invalid risk_tier value is flagged by validateSecurityManifest", async () => {
    const dir = setupTmp();
    try {
      // Use a hand-crafted YAML with risk_tier: super-duper-high (invalid enum).
      await buildFixture(dir);
      // Overwrite with a schema-invalid manifest.
      await writeFile(join(dir, ".security/demo.yaml"), `skill:
  name: demo
  version: "1.0.0"
  license: MIT
  author: t
  repository: https://x
  path: skills/demo
integrity:
  hash_algorithm: sha256
  files:
    SKILL.md: deadbeef
permissions:
  alwaysAllow: []
  rationale: "x"
execution_context:
  sandbox: host
  network: none
  filesystem: read-write
  shell: none
  risk_tier: super-duper-high
`);
      const { errors } = await runDriftChecks(dir);
      assert.equal(
        errors.some((e) => e.includes("risk_tier")),
        true,
        `expected risk_tier validation error, got:\n${errors.join("\n")}`,
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("drift-check — markdown-link validation (item 6)", () => {
  test("link to existing file passes", async () => {
    const dir = setupTmp();
    try {
      await buildFixture(dir);
      const { errors } = await runDriftChecks(dir);
      // Default SKILL.md has [references/foo.md] which exists; should be clean.
      assert.equal(
        errors.some((e) => e.includes("broken markdown link")),
        false,
        `unexpected link error in clean fixture:\n${errors.join("\n")}`,
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("broken link to non-existent file is flagged", async () => {
    const dir = setupTmp();
    try {
      // Build fixture with SKILL.md pointing at a non-existent reference.
      const skillMd = `---
name: demo
description: "A demo skill for tests"
license: MIT
compatibility: any
metadata:
  author: test
  version: "1.0.0"
  tags: demo, test
---

# Demo

See [missing](references/does-not-exist.md).
`;
      // First build a valid fixture, then re-write SKILL.md and patch its hash
      // in the security manifest so the link check is the only failure.
      await buildFixture(dir);
      await writeFile(join(dir, "skills/demo/SKILL.md"), skillMd);
      const newHash = sha256(skillMd);
      const fooHash = sha256("# foo reference\n\nSee [back to SKILL](../SKILL.md).\n");
      const iconHash = sha256("<svg/>\n");
      // Compute folder hash with new SKILL.md
      const sorted = [
        ["SKILL.md", skillMd],
        ["assets/icon.svg", "<svg/>\n"],
        ["references/foo.md", "# foo reference\n\nSee [back to SKILL](../SKILL.md).\n"],
      ].sort(([a], [b]) => a.localeCompare(b));
      const folderHasher = createHash("sha256");
      for (const [rel, content] of sorted) {
        folderHasher.update(rel);
        folderHasher.update(content);
      }
      const folderHash = folderHasher.digest("hex");
      await writeFile(join(dir, ".security/demo.yaml"), `skill:
  name: demo
  version: "1.0.0"
  license: MIT
  author: t
  repository: https://x
  path: skills/demo
integrity:
  hash_algorithm: sha256
  files:
    SKILL.md: ${newHash}
    references/foo.md: ${fooHash}
    assets/icon.svg: ${iconHash}
permissions:
  alwaysAllow: []
  rationale: "x"
execution_context:
  sandbox: host
  network: none
  filesystem: read-write
  shell: none
  risk_tier: low
`);
      await writeFile(join(dir, "skills-lock.json"), JSON.stringify({
        version: 1,
        skills: { demo: { source: "x", sourceType: "github", version: "1.0.0", computedHash: folderHash } },
      }, null, 2));

      const { errors } = await runDriftChecks(dir);
      assert.equal(
        errors.some((e) => e.includes("broken markdown link to references/does-not-exist.md")),
        true,
        `expected broken-link error, got:\n${errors.join("\n")}`,
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("external URLs are not flagged", async () => {
    const dir = setupTmp();
    try {
      const skillMd = `---
name: demo
description: "A demo"
license: MIT
metadata:
  author: t
  version: "1.0.0"
---

# Demo

See [docs](https://example.com/docs) and [refs](references/foo.md).
`;
      await buildFixture(dir);
      await writeFile(join(dir, "skills/demo/SKILL.md"), skillMd);
      // Patch hashes so the link check is the only relevant signal.
      const newHash = sha256(skillMd);
      const fooHash = sha256("# foo reference\n\nSee [back to SKILL](../SKILL.md).\n");
      const iconHash = sha256("<svg/>\n");
      const sorted = [
        ["SKILL.md", skillMd],
        ["assets/icon.svg", "<svg/>\n"],
        ["references/foo.md", "# foo reference\n\nSee [back to SKILL](../SKILL.md).\n"],
      ].sort(([a], [b]) => a.localeCompare(b));
      const fHash = createHash("sha256");
      for (const [r, c] of sorted) { fHash.update(r); fHash.update(c); }
      const folderHash = fHash.digest("hex");
      await writeFile(join(dir, ".security/demo.yaml"), `skill:
  name: demo
  version: "1.0.0"
  license: MIT
  author: t
  repository: https://x
  path: skills/demo
integrity:
  hash_algorithm: sha256
  files:
    SKILL.md: ${newHash}
    references/foo.md: ${fooHash}
    assets/icon.svg: ${iconHash}
permissions:
  alwaysAllow: []
  rationale: "x"
execution_context:
  sandbox: host
  network: none
  filesystem: read-write
  shell: none
  risk_tier: low
`);
      await writeFile(join(dir, "skills-lock.json"), JSON.stringify({
        version: 1,
        skills: { demo: { source: "x", sourceType: "github", version: "1.0.0", computedHash: folderHash } },
      }, null, 2));

      const { errors } = await runDriftChecks(dir);
      const linkErrors = errors.filter((e) => e.includes("markdown link"));
      assert.deepEqual(linkErrors, [], `external URL should not produce link error:\n${linkErrors.join("\n")}`);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("anchor in link target is stripped before validation", async () => {
    const dir = setupTmp();
    try {
      const skillMd = `---
name: demo
description: "A demo"
license: MIT
metadata:
  author: t
  version: "1.0.0"
---

# Demo

See [foo section](references/foo.md#some-anchor).
`;
      await buildFixture(dir);
      await writeFile(join(dir, "skills/demo/SKILL.md"), skillMd);
      const newHash = sha256(skillMd);
      const fooHash = sha256("# foo reference\n\nSee [back to SKILL](../SKILL.md).\n");
      const iconHash = sha256("<svg/>\n");
      const sorted = [
        ["SKILL.md", skillMd],
        ["assets/icon.svg", "<svg/>\n"],
        ["references/foo.md", "# foo reference\n\nSee [back to SKILL](../SKILL.md).\n"],
      ].sort(([a], [b]) => a.localeCompare(b));
      const fHash = createHash("sha256");
      for (const [r, c] of sorted) { fHash.update(r); fHash.update(c); }
      const folderHash = fHash.digest("hex");
      await writeFile(join(dir, ".security/demo.yaml"), `skill:
  name: demo
  version: "1.0.0"
  license: MIT
  author: t
  repository: https://x
  path: skills/demo
integrity:
  hash_algorithm: sha256
  files:
    SKILL.md: ${newHash}
    references/foo.md: ${fooHash}
    assets/icon.svg: ${iconHash}
permissions:
  alwaysAllow: []
  rationale: "x"
execution_context:
  sandbox: host
  network: none
  filesystem: read-write
  shell: none
  risk_tier: low
`);
      await writeFile(join(dir, "skills-lock.json"), JSON.stringify({
        version: 1,
        skills: { demo: { source: "x", sourceType: "github", version: "1.0.0", computedHash: folderHash } },
      }, null, 2));

      const { errors } = await runDriftChecks(dir);
      assert.equal(
        errors.some((e) => e.includes("markdown link")),
        false,
        `anchored link should not error:\n${errors.join("\n")}`,
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("link escaping skill directory is flagged", async () => {
    const dir = setupTmp();
    try {
      const skillMd = `---
name: demo
description: "A demo"
license: MIT
metadata:
  author: t
  version: "1.0.0"
---

# Demo

[escape](../../etc/passwd)
`;
      await buildFixture(dir);
      await writeFile(join(dir, "skills/demo/SKILL.md"), skillMd);
      const newHash = sha256(skillMd);
      const fooHash = sha256("# foo reference\n\nSee [back to SKILL](../SKILL.md).\n");
      const iconHash = sha256("<svg/>\n");
      const sorted = [
        ["SKILL.md", skillMd],
        ["assets/icon.svg", "<svg/>\n"],
        ["references/foo.md", "# foo reference\n\nSee [back to SKILL](../SKILL.md).\n"],
      ].sort(([a], [b]) => a.localeCompare(b));
      const fHash = createHash("sha256");
      for (const [r, c] of sorted) { fHash.update(r); fHash.update(c); }
      const folderHash = fHash.digest("hex");
      await writeFile(join(dir, ".security/demo.yaml"), `skill:
  name: demo
  version: "1.0.0"
  license: MIT
  author: t
  repository: https://x
  path: skills/demo
integrity:
  hash_algorithm: sha256
  files:
    SKILL.md: ${newHash}
    references/foo.md: ${fooHash}
    assets/icon.svg: ${iconHash}
permissions:
  alwaysAllow: []
  rationale: "x"
execution_context:
  sandbox: host
  network: none
  filesystem: read-write
  shell: none
  risk_tier: low
`);
      await writeFile(join(dir, "skills-lock.json"), JSON.stringify({
        version: 1,
        skills: { demo: { source: "x", sourceType: "github", version: "1.0.0", computedHash: folderHash } },
      }, null, 2));

      const { errors } = await runDriftChecks(dir);
      assert.equal(
        errors.some((e) => e.includes("escaping skill dir")),
        true,
        `expected escape error, got:\n${errors.join("\n")}`,
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("links inside code fences are NOT validated (false-positive prevention)", async () => {
    const dir = setupTmp();
    try {
      const skillMd = `---
name: demo
description: "A demo"
license: MIT
metadata:
  author: t
  version: "1.0.0"
---

# Demo

\`\`\`markdown
[broken link inside code](references/nope.md)
\`\`\`

See [refs](references/foo.md).
`;
      await buildFixture(dir);
      await writeFile(join(dir, "skills/demo/SKILL.md"), skillMd);
      const newHash = sha256(skillMd);
      const fooHash = sha256("# foo reference\n\nSee [back to SKILL](../SKILL.md).\n");
      const iconHash = sha256("<svg/>\n");
      const sorted = [
        ["SKILL.md", skillMd],
        ["assets/icon.svg", "<svg/>\n"],
        ["references/foo.md", "# foo reference\n\nSee [back to SKILL](../SKILL.md).\n"],
      ].sort(([a], [b]) => a.localeCompare(b));
      const fHash = createHash("sha256");
      for (const [r, c] of sorted) { fHash.update(r); fHash.update(c); }
      const folderHash = fHash.digest("hex");
      await writeFile(join(dir, ".security/demo.yaml"), `skill:
  name: demo
  version: "1.0.0"
  license: MIT
  author: t
  repository: https://x
  path: skills/demo
integrity:
  hash_algorithm: sha256
  files:
    SKILL.md: ${newHash}
    references/foo.md: ${fooHash}
    assets/icon.svg: ${iconHash}
permissions:
  alwaysAllow: []
  rationale: "x"
execution_context:
  sandbox: host
  network: none
  filesystem: read-write
  shell: none
  risk_tier: low
`);
      await writeFile(join(dir, "skills-lock.json"), JSON.stringify({
        version: 1,
        skills: { demo: { source: "x", sourceType: "github", version: "1.0.0", computedHash: folderHash } },
      }, null, 2));

      const { errors } = await runDriftChecks(dir);
      const linkErrors = errors.filter((e) => e.includes("markdown link"));
      assert.deepEqual(
        linkErrors, [],
        `code-fenced link should not produce error:\n${linkErrors.join("\n")}`,
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("drift-check — orphan reference detection (item 6, reverse direction)", () => {
  test("a reference file not linked from SKILL.md is flagged as orphan", async () => {
    const dir = setupTmp();
    try {
      // SKILL.md links the asset but NOT references/foo.md. buildFixture
      // recomputes the manifest/hashes from this override, so foo.md stays a
      // valid inventory entry and the orphan error is the only failure.
      await buildFixture(dir, {
        "skills/demo/SKILL.md": `---
name: demo
description: "A demo skill for tests"
license: MIT
compatibility: any
metadata:
  author: test
  version: "1.0.0"
  tags: demo, test
---

# Demo

This entry point links no references, only an [icon](assets/icon.svg).
`,
      });
      const { errors } = await runDriftChecks(dir);
      assert.ok(
        errors.some((e) => e.includes("references/foo.md exists but is not linked from SKILL.md (orphan reference file)")),
        `expected orphan-reference error, got:\n${errors.join("\n")}`,
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("a reference linked only via an anchored link is not an orphan", async () => {
    const dir = setupTmp();
    try {
      await buildFixture(dir, {
        "skills/demo/SKILL.md": `---
name: demo
description: "A demo skill for tests"
license: MIT
compatibility: any
metadata:
  author: test
  version: "1.0.0"
  tags: demo, test
---

# Demo

See [foo](references/foo.md#a-section) and [icon](assets/icon.svg).
`,
      });
      const { errors } = await runDriftChecks(dir);
      const orphanErrors = errors.filter((e) => e.includes("orphan reference file"));
      assert.deepEqual(
        orphanErrors, [],
        `anchored link should count as linked:\n${orphanErrors.join("\n")}`,
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
