// Unit tests for bin/lib/parsers.mjs — the pure helpers shared by
// bin/drift-check.mjs and bin/guardskills-check.mjs.
//
// Run: node --test tests/parsers.test.mjs
//
// These tests cover the "verifiers": every regression here would otherwise
// land in drift-check or guardskills-check undetected.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  compareSemver,
  stripQuotes,
  listEqual,
  parseSkillFrontmatter,
  parseSecurityManifest,
  validateSecurityManifest,
  parseExpectedFindings,
  findUnacknowledgedBlocking,
  BLOCKING_SEVERITIES,
} from "../bin/lib/parsers.mjs";

describe("compareSemver", () => {
  test("equal versions return 0", () => {
    assert.equal(compareSemver("1.2.3", "1.2.3"), 0);
  });

  test("major bump is detected", () => {
    assert.equal(compareSemver("2.0.0", "1.99.99"), 1);
    assert.equal(compareSemver("1.99.99", "2.0.0"), -1);
  });

  test("minor bump is detected when major equal", () => {
    assert.equal(compareSemver("1.5.0", "1.4.99"), 1);
    assert.equal(compareSemver("1.4.99", "1.5.0"), -1);
  });

  test("patch bump is detected when major+minor equal", () => {
    assert.equal(compareSemver("1.0.5", "1.0.4"), 1);
    assert.equal(compareSemver("1.0.4", "1.0.5"), -1);
  });

  test("pre-release suffix is stripped", () => {
    assert.equal(compareSemver("1.2.3-rc.1", "1.2.3"), 0);
    assert.equal(compareSemver("1.2.3-beta", "1.2.3-alpha"), 0);
  });

  test("handles malformed segments by treating non-numeric as 0", () => {
    assert.equal(compareSemver("1.x.0", "1.0.0"), 0);
    assert.equal(compareSemver("1.0.0", "abc.def.ghi"), 1);
  });

  test("typical downgrade detection scenarios", () => {
    // The exact scenarios drift-check.mjs cares about: any backwards step.
    assert.equal(compareSemver("0.1.0", "0.2.0") < 0, true, "minor downgrade");
    assert.equal(compareSemver("0.9.9", "1.0.0") < 0, true, "major downgrade");
    assert.equal(compareSemver("1.0.0", "1.0.0"), 0, "no change");
    assert.equal(compareSemver("1.0.1", "1.0.0") > 0, true, "patch upgrade");
  });
});

describe("stripQuotes", () => {
  test("removes surrounding double quotes", () => {
    assert.equal(stripQuotes('"hello"'), "hello");
  });

  test("removes surrounding single quotes", () => {
    assert.equal(stripQuotes("'world'"), "world");
  });

  test("trims whitespace", () => {
    assert.equal(stripQuotes('   "padded"   '), "padded");
  });

  test("leaves unquoted values alone", () => {
    assert.equal(stripQuotes("plain"), "plain");
  });

  test("coerces non-string input", () => {
    assert.equal(stripQuotes(42), "42");
  });
});

describe("listEqual", () => {
  test("equal arrays return true", () => {
    assert.equal(listEqual([1, 2, 3], [1, 2, 3]), true);
  });

  test("different length returns false", () => {
    assert.equal(listEqual([1, 2], [1, 2, 3]), false);
  });

  test("different content returns false", () => {
    assert.equal(listEqual([1, 2, 3], [1, 2, 4]), false);
  });

  test("empty arrays are equal", () => {
    assert.equal(listEqual([], []), true);
  });

  test("order matters", () => {
    assert.equal(listEqual([1, 2, 3], [3, 2, 1]), false);
  });
});

describe("parseSkillFrontmatter", () => {
  test("extracts top-level keys", () => {
    const md = '---\nname: foo\ndescription: "a skill"\n---\nbody';
    const fm = parseSkillFrontmatter(md);
    assert.equal(fm.name, "foo");
    assert.equal(fm.description, "a skill");
  });

  test("extracts metadata.version specifically", () => {
    const md = '---\nname: foo\nmetadata:\n  author: alice\n  version: "1.2.3"\n---';
    const fm = parseSkillFrontmatter(md);
    assert.equal(fm.version, "1.2.3");
  });

  test("returns {} when no frontmatter block", () => {
    assert.deepEqual(parseSkillFrontmatter("# Just a body"), {});
  });

  test("metadata block ends when next top-level key begins", () => {
    const md = '---\nmetadata:\n  version: "1.0.0"\nname: foo\n---';
    const fm = parseSkillFrontmatter(md);
    assert.equal(fm.name, "foo");
    assert.equal(fm.version, "1.0.0");
  });

  test("handles unquoted versions", () => {
    const md = '---\nmetadata:\n  version: 2.7.0\n---';
    assert.equal(parseSkillFrontmatter(md).version, "2.7.0");
  });
});

describe("parseSecurityManifest", () => {
  test("extracts skill name + version + file hashes", () => {
    const yaml = `skill:
  name: foo
  version: "1.0.0"
integrity:
  files:
    SKILL.md: abc123def
    references/x.md: deadbeef0123456789abcdef0123456789abcdef0123456789abcdef01234567
`;
    const m = parseSecurityManifest(yaml);
    assert.equal(m.name, "foo");
    assert.equal(m.version, "1.0.0");
    assert.equal(typeof m.files, "object");
  });

  test("ignores hashes that are not 64-char hex (only SHA-256 accepted)", () => {
    const yaml = `skill:
  name: foo
  version: "1.0.0"
integrity:
  files:
    SKILL.md: not-a-hash
    bad.md: 12abc
`;
    const m = parseSecurityManifest(yaml);
    assert.equal(m.files["SKILL.md"], undefined);
    assert.equal(m.files["bad.md"], undefined);
  });

  test("stops parsing files block at next top-level key", () => {
    const yaml = `skill:
  name: foo
  version: "1.0.0"
integrity:
  files:
    SKILL.md: deadbeef0123456789abcdef0123456789abcdef0123456789abcdef01234567
permissions:
  alwaysAllow: []
`;
    const m = parseSecurityManifest(yaml);
    assert.equal(Object.keys(m.files).length, 1);
  });
});

describe("validateSecurityManifest", () => {
  const VALID = `skill:
  name: foo
  version: "1.0.0"
  license: MIT
  author: alice
  repository: https://example.com/foo
  path: skills/foo
integrity:
  hash_algorithm: sha256
  files:
    SKILL.md: deadbeef0123456789abcdef0123456789abcdef0123456789abcdef01234567
permissions:
  alwaysAllow: []
  rationale: "none"
execution_context:
  sandbox: host-agent
  network: none
  filesystem: read-write
  shell: none
  risk_tier: low
`;

  test("a complete valid manifest passes", () => {
    assert.deepEqual(validateSecurityManifest(VALID, "foo"), []);
  });

  test("missing skill.name flags an error", () => {
    const text = VALID.replace("  name: foo\n", "");
    const errors = validateSecurityManifest(text, "foo");
    assert.equal(errors.length > 0, true);
    assert.equal(errors.some((e) => e.includes("skill.name")), true);
  });

  test("invalid risk_tier value flags an error", () => {
    const text = VALID.replace("risk_tier: low", "risk_tier: nonsense");
    const errors = validateSecurityManifest(text, "foo");
    assert.equal(errors.some((e) => e.includes("risk_tier")), true);
  });

  test("invalid network value flags an error", () => {
    const text = VALID.replace("network: none", "network: unrestricted-internet");
    const errors = validateSecurityManifest(text, "foo");
    assert.equal(errors.some((e) => e.includes("network")), true);
  });

  test("missing SKILL.md in integrity.files flags an error", () => {
    const text = VALID.replace(
      "    SKILL.md: deadbeef0123456789abcdef0123456789abcdef0123456789abcdef01234567\n",
      "    README.md: deadbeef0123456789abcdef0123456789abcdef0123456789abcdef01234567\n",
    );
    const errors = validateSecurityManifest(text, "foo");
    assert.equal(errors.some((e) => e.includes("SKILL.md")), true);
  });

  test("wrong hash_algorithm flags an error", () => {
    const text = VALID.replace("hash_algorithm: sha256", "hash_algorithm: md5");
    const errors = validateSecurityManifest(text, "foo");
    assert.equal(errors.some((e) => e.includes("hash_algorithm")), true);
  });
});

describe("parseExpectedFindings", () => {
  const YAML = `scanning:
  expected_findings:
    - id: R005_SECRET_READ
      severity: high
      acknowledged: true
      file: references/build-pipeline.md
      reason: "false positive"
    - id: R008_ENV_ACCESS
      severity: low
      file: references/data.md
      reason: "documented usage"
`;

  test("extracts id + file + severity + acknowledged", () => {
    const out = parseExpectedFindings(YAML);
    assert.equal(out.length, 2);
    assert.equal(out[0].id, "R005_SECRET_READ");
    assert.equal(out[0].file, "references/build-pipeline.md");
    assert.equal(out[0].severity, "HIGH");
    assert.equal(out[0].acknowledged, true);
  });

  test("severity is normalized to uppercase", () => {
    const out = parseExpectedFindings(YAML);
    assert.equal(out[1].severity, "LOW");
  });

  test("acknowledged absent → undefined (not false)", () => {
    const out = parseExpectedFindings(YAML);
    assert.equal(out[1].acknowledged, undefined);
  });

  test("entries without file are dropped", () => {
    const yaml = `expected_findings:
    - id: R001_FOO
      severity: low
`;
    assert.deepEqual(parseExpectedFindings(yaml), []);
  });
});

describe("findUnacknowledgedBlocking", () => {
  test("returns [] when only LOW/MEDIUM findings", () => {
    const actual = [{ id: "R008", file: "x.md", severity: "LOW" }];
    const expected = [{ id: "R008", file: "x.md", severity: "LOW" }];
    assert.deepEqual(findUnacknowledgedBlocking(actual, expected), []);
  });

  test("returns [] when HIGH finding has acknowledged: true match", () => {
    const actual = [{ id: "R005", file: "x.md", severity: "HIGH" }];
    const expected = [{ id: "R005", file: "x.md", acknowledged: true }];
    assert.deepEqual(findUnacknowledgedBlocking(actual, expected), []);
  });

  test("flags HIGH finding with no matching expected entry", () => {
    const actual = [{ id: "R005", file: "x.md", severity: "HIGH" }];
    const out = findUnacknowledgedBlocking(actual, []);
    assert.equal(out.length, 1);
    assert.equal(out[0].id, "R005");
  });

  test("flags HIGH finding whose expected match lacks acknowledged: true", () => {
    const actual = [{ id: "R005", file: "x.md", severity: "HIGH" }];
    const expected = [{ id: "R005", file: "x.md" }];
    const out = findUnacknowledgedBlocking(actual, expected);
    assert.equal(out.length, 1);
  });

  test("flags HIGH finding whose expected match has acknowledged: false", () => {
    const actual = [{ id: "R005", file: "x.md", severity: "HIGH" }];
    const expected = [{ id: "R005", file: "x.md", acknowledged: false }];
    const out = findUnacknowledgedBlocking(actual, expected);
    assert.equal(out.length, 1);
  });

  test("flags CRITICAL findings the same as HIGH", () => {
    const actual = [{ id: "R001", file: "x.md", severity: "CRITICAL" }];
    assert.equal(findUnacknowledgedBlocking(actual, []).length, 1);
  });

  test("BLOCKING_SEVERITIES contains exactly HIGH and CRITICAL", () => {
    assert.equal(BLOCKING_SEVERITIES.has("HIGH"), true);
    assert.equal(BLOCKING_SEVERITIES.has("CRITICAL"), true);
    assert.equal(BLOCKING_SEVERITIES.has("MEDIUM"), false);
    assert.equal(BLOCKING_SEVERITIES.has("LOW"), false);
    assert.equal(BLOCKING_SEVERITIES.size, 2);
  });
});
