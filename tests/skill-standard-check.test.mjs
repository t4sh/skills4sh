// End-to-end tests for bin/skill-standard-check.mjs.
// Builds small fixture repos and verifies objective Skill Authoring Standard gates.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { runSkillStandardChecks } from "../bin/skill-standard-check.mjs";

const VALID_SKILL = `---
name: demo
description: "Demo workflow support. Use when the user asks to \"demo a workflow\" or mentions demo fixtures."
license: MIT
compatibility: macOS, Linux, or Windows
metadata:
  author: t4sh
  version: "1.0.0"
  tags: demo, fixture
---

# Demo

Inspect the project and follow the demo workflow. See [foo](references/foo.md).
`;

function setupTmp() {
  return mkdtempSync(join(tmpdir(), "skills4sh-standard-"));
}

async function buildFixture(dir, skillMd = VALID_SKILL, extraFiles = {}) {
  await mkdir(join(dir, "skills/demo/references"), { recursive: true });
  await writeFile(join(dir, "skills/demo/SKILL.md"), skillMd);
  await writeFile(join(dir, "skills/demo/LICENSE"), "MIT\n");
  await writeFile(join(dir, "skills/demo/references/foo.md"), "# Foo\n");
  for (const [rel, content] of Object.entries(extraFiles)) {
    await mkdir(dirname(join(dir, "skills/demo", rel)), { recursive: true });
    await writeFile(join(dir, "skills/demo", rel), content);
  }
}

describe("skill-standard-check — clean baseline", () => {
  test("a minimal valid skill passes", async () => {
    const dir = setupTmp();
    try {
      await buildFixture(dir);
      const { errors, skills } = await runSkillStandardChecks(dir);
      assert.deepEqual(errors, [], `expected no errors, got:\n${errors.join("\n")}`);
      assert.deepEqual(skills, ["demo"]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("skill-standard-check — frontmatter contract", () => {
  test("disallowed top-level and metadata fields are rejected", async () => {
    const dir = setupTmp();
    try {
      await buildFixture(dir, VALID_SKILL.replace("license: MIT", "license: MIT\nowner: nobody").replace("tags: demo, fixture", "tags: demo, fixture\n  homepage: https://example.com"));
      const { errors } = await runSkillStandardChecks(dir);
      assert.ok(errors.some((e) => e.includes("disallowed top-level field 'owner'")), errors.join("\n"));
      assert.ok(errors.some((e) => e.includes("disallowed field 'homepage'")), errors.join("\n"));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("required repo frontmatter fields are enforced", async () => {
    const dir = setupTmp();
    try {
      const skill = VALID_SKILL.replace("compatibility: macOS, Linux, or Windows\n", "").replace("  tags: demo, fixture\n", "");
      await buildFixture(dir, skill);
      const { errors } = await runSkillStandardChecks(dir);
      assert.ok(errors.some((e) => e.includes("missing required field 'compatibility'")), errors.join("\n"));
      assert.ok(errors.some((e) => e.includes("metadata missing required field 'tags'")), errors.join("\n"));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("description accepts capability-plus-trigger and trigger-first forms", async () => {
    const dir = setupTmp();
    try {
      await buildFixture(dir, VALID_SKILL);
      let result = await runSkillStandardChecks(dir);
      assert.deepEqual(result.errors, [], result.errors.join("\n"));

      await buildFixture(dir, VALID_SKILL.replace("Demo workflow support. Use when", "Use when"));
      result = await runSkillStandardChecks(dir);
      assert.deepEqual(result.errors, [], result.errors.join("\n"));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("description rejects loose summaries without trigger/use conditions", async () => {
    const dir = setupTmp();
    try {
      await buildFixture(dir, VALID_SKILL.replace("Demo workflow support. Use when the user asks to \"demo a workflow\" or mentions demo fixtures.", "Demo workflow support for sample repositories."));
      const { errors } = await runSkillStandardChecks(dir);
      assert.ok(errors.some((e) => e.includes("description must include concrete trigger/use conditions")), errors.join("\n"));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("skill-standard-check — body and install-command gates", () => {
  test("install-this-skill sections and npx skills add commands are rejected", async () => {
    const dir = setupTmp();
    try {
      await buildFixture(dir, `${VALID_SKILL}\n## Installation\n\n\`\`\`bash\nnpx skills add t4sh/skills4sh --skill demo\n\`\`\`\n`);
      const { errors } = await runSkillStandardChecks(dir);
      assert.ok(errors.some((e) => e.includes("must not contain an install-this-skill section")), errors.join("\n"));
      assert.ok(errors.some((e) => e.includes("must not embed 'npx skills add' install commands")), errors.join("\n"));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("embedded npx skills add commands in references are rejected", async () => {
    const dir = setupTmp();
    try {
      await buildFixture(dir, VALID_SKILL, { "references/install-copy.md": "Run `npx skills add owner/repo --skill demo`.\n" });
      const { errors } = await runSkillStandardChecks(dir);
      assert.ok(errors.some((e) => e.includes("references/install-copy.md must not embed 'npx skills add'")), errors.join("\n"));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("oversized SKILL.md bodies are rejected", async () => {
    const dir = setupTmp();
    try {
      const longBody = `${VALID_SKILL}\n${Array.from({ length: 3501 }, () => "word").join(" ")}\n`;
      await buildFixture(dir, longBody);
      const { errors } = await runSkillStandardChecks(dir);
      assert.ok(errors.some((e) => e.includes("max machine-checkable threshold is 3500")), errors.join("\n"));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("skill-standard-check — disallowed auxiliary docs", () => {
  test("per-skill README/changelog/install docs are rejected", async () => {
    const dir = setupTmp();
    try {
      await buildFixture(dir, VALID_SKILL, {
        "README.md": "# per-skill readme\n",
        "references/INSTALL.md": "# install docs\n",
      });
      const { errors } = await runSkillStandardChecks(dir);
      assert.ok(errors.some((e) => e.includes("disallowed auxiliary skill doc 'README.md'")), errors.join("\n"));
      assert.ok(errors.some((e) => e.includes("disallowed auxiliary skill doc 'references/INSTALL.md'")), errors.join("\n"));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
