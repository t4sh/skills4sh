#!/usr/bin/env node
// Preflight for `npm test`. The suite needs dependencies a fresh clone does not
// have: Python with PyYAML and separately locked rendering/comparison fixtures.
//
// Without this guard, a missing dependency surfaces as ~25 unrelated assertion
// failures whose real cause is buried in captured stderr. Fail once, up front,
// with the exact commands to fix it.
//
// CI does not run this: validate.yml and npm-publish.yml provision both
// fixture groups explicitly and invoke `node --test` directly.

import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const root = process.cwd();
const python = process.env.SKILL_TEST_PYTHON || "python3";
const problems = [];

// --- Python + PyYAML -------------------------------------------------------
const probe = spawnSync(
  python,
  ["-c", "import sys, yaml; print(sys.version_info[0], sys.version_info[1], yaml.__version__)"],
  { encoding: "utf8" },
);

if (probe.error) {
  problems.push({
    what: `Python interpreter not runnable: ${python}`,
    why: probe.error.message,
    fix: [
      "Install Python 3.10+ and make it available as `python3`, or point at an existing one:",
      "  export SKILL_TEST_PYTHON=/path/to/python3",
    ],
  });
} else if (probe.status !== 0) {
  const missingYaml = /No module named 'yaml'/.test(probe.stderr || "");
  problems.push({
    what: missingYaml
      ? `PyYAML is not installed for ${python}`
      : `Python probe failed for ${python}`,
    why: (probe.stderr || probe.stdout || "").trim().split("\n").slice(-1)[0] || "unknown error",
    fix: [
      "Create the isolated environment the helpers expect:",
      "  python3 -m venv /tmp/skills4sh-python",
      "  /tmp/skills4sh-python/bin/python -m pip install --only-binary=:all: -r skills/skill-architect/assets/scripts/requirements.txt",
      "  export SKILL_TEST_PYTHON=/tmp/skills4sh-python/bin/python",
      "On Windows use the venv's Scripts/python.exe for both the install and the export.",
    ],
  });
} else {
  const [major, minor] = probe.stdout.trim().split(/\s+/).map(Number);
  if (major < 3 || (major === 3 && minor < 10)) {
    problems.push({
      what: `Python ${major}.${minor} is too old for the helper scripts`,
      why: "skills/skill-architect/assets/scripts requires Python >= 3.10",
      fix: ["Install Python 3.10+ and re-run, or set SKILL_TEST_PYTHON to a newer interpreter."],
    });
  }
}

// --- Rendering/comparison fixture installs --------------------------------
for (const fixture of ['eleventy', 'visual']) {
  const fixtureModules = join(root, 'tests', 'fixtures', fixture, 'node_modules');
  if (!existsSync(fixtureModules)) {
    problems.push({
      what: `${fixture} fixture dependencies are not installed`,
      why: `missing ${fixtureModules}`,
      fix: [
        'Install the separately locked fixture:',
        `  npm ci --prefix tests/fixtures/${fixture} --ignore-scripts --no-audit --no-fund`,
      ],
    });
  }
}

// --- Report ----------------------------------------------------------------
if (problems.length === 0) {
  process.exit(0);
}

console.error("\n✗ Test environment is not ready.\n");
for (const { what, why, fix } of problems) {
  console.error(`  ${what}`);
  console.error(`    cause: ${why}`);
  for (const line of fix) console.error(`    ${line}`);
  console.error("");
}
console.error("See CONTRIBUTING.md § Changing scripts (bin/) for the full setup.\n");
process.exit(1);
