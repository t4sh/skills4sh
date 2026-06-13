import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { runPrSkillAuditCheck } from "../bin/pr-skill-audit-check.mjs";

const VALID_BODY = `## Skill authoring audit

- [x] Standard-derived checklist was completed before patching.
- [x] Evidence table was prepared before edits.
- [x] Mechanical grep/checks were run for every objective rule touched.

| Standard-derived check | Evidence gathered before edits | Mechanical command or grep | Result | Patch/decision |
|---|---|---|---|---|
| Frontmatter contract | bin/skill-standard-check.mjs:10-14 | npm run check:skill-standard | pass | no patch |
`;

describe("pr-skill-audit-check", () => {
  test("push events do not require a PR audit packet", () => {
    const result = runPrSkillAuditCheck({ body: "", changedFiles: ["skills/demo/SKILL.md"], eventName: "push" });
    assert.equal(result.required, false);
    assert.deepEqual(result.errors, []);
  });

  test("unrelated PRs do not require a PR audit packet", () => {
    const result = runPrSkillAuditCheck({ body: "", changedFiles: ["README.md"], eventName: "pull_request" });
    assert.equal(result.required, false);
    assert.deepEqual(result.errors, []);
  });

  test("skill PRs require checked attestations and a filled evidence table", () => {
    const result = runPrSkillAuditCheck({ body: VALID_BODY, changedFiles: ["skills/demo/SKILL.md"], eventName: "pull_request" });
    assert.equal(result.required, true);
    assert.deepEqual(result.errors, []);
  });

  test("skill PRs reject missing checked attestations", () => {
    const result = runPrSkillAuditCheck({
      body: VALID_BODY.replace("- [x] Evidence table was prepared before edits.\n", ""),
      changedFiles: ["skills/demo/SKILL.md"],
      eventName: "pull_request",
    });
    assert.ok(result.errors.some((error) => error.includes("evidence table before edits")), result.errors.join("\n"));
  });

  test("skill PRs reject placeholder-only evidence tables", () => {
    const body = VALID_BODY.replace(
      "| Frontmatter contract | bin/skill-standard-check.mjs:10-14 | npm run check:skill-standard | pass | no patch |",
      "| <!-- required --> | <!-- required --> | <!-- required --> | <!-- required --> | <!-- required --> |",
    );
    const result = runPrSkillAuditCheck({ body, changedFiles: ["docs/SKILL_AUTHORING_STANDARD.md"], eventName: "pull_request" });
    assert.ok(result.errors.some((error) => error.includes("missing filled evidence table row")), result.errors.join("\n"));
  });
});
