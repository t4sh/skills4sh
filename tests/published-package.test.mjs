import test from "node:test";
import assert from "node:assert/strict";
import { validatePublishedMetadata } from "../bin/lib/published-package.mjs";

const pkg = { name: "skills4sh", version: "0.5.1", optionalDependencies: { undici: "6.28.0" } };
const gitHead = "a".repeat(40);
const view = {
  ...pkg,
  bundleDependencies: ["undici"],
  gitHead,
  dist: { attestations: { provenance: { url: "https://registry.example.invalid/provenance" } } },
};

test("published metadata accepts npm 12 arrays and npm 11 objects", () => {
  assert.doesNotThrow(() => validatePublishedMetadata([view], pkg, gitHead));
  assert.doesNotThrow(() => validatePublishedMetadata(view, pkg, gitHead));
});

test("published metadata rejects missing, ambiguous, or wrong package results", () => {
  for (const data of [null, [], [view, view], {}, { ...view, name: "other" }, { ...view, version: "0.5.0" }]) {
    assert.throws(() => validatePublishedMetadata(data, pkg, gitHead), /must return exactly/);
  }
});

test("published metadata requires the exact bundled dependency", () => {
  for (const data of [
    { ...view, bundleDependencies: undefined },
    { ...view, bundleDependencies: [] },
    { ...view, optionalDependencies: { undici: "6.27.0" } },
  ]) {
    assert.throws(() => validatePublishedMetadata([data], pkg, gitHead), /must declare the pinned undici bundle/);
  }
});

test("published metadata still requires matching gitHead and provenance", () => {
  for (const head of [undefined, "b".repeat(40)]) {
    assert.throws(() => validatePublishedMetadata([{ ...view, gitHead: head }], pkg, gitHead), /gitHead mismatch/);
  }
  assert.throws(() => validatePublishedMetadata([{ ...view, dist: {} }], pkg, gitHead), /missing npm provenance/);
});
