import test from "node:test";
import assert from "node:assert/strict";
import {
  validatePublishedMetadata,
  VersionNotVisibleError,
  isVersionNotVisible,
  distTagsUrl,
  fetchDistTags,
  assertLatestDistTag,
} from "../bin/lib/published-package.mjs";

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

test("only a not-yet-visible version is retried", () => {
  const npmMissingVersion = new Error(
    "npm view skills4sh@0.5.3 --json failed\n"
    + "npm error code E404\nnpm error 404 No match found for version 0.5.3",
  );
  assert.equal(isVersionNotVisible(npmMissingVersion), true);
  assert.equal(isVersionNotVisible(new VersionNotVisibleError("latest is 0.5.2")), true);

  for (const err of [
    new Error("npm error code E401 Unauthorized"),
    new Error("getaddrinfo ENOTFOUND registry.npmjs.org"),
    new Error("npm view must return exactly skills4sh@0.5.4"),
    new Error("skills4sh@0.5.4 is missing npm provenance attestation metadata"),
    new Error("skills4sh@0.5.4 gitHead mismatch: expected aaa, got bbb"),
  ]) {
    assert.equal(isVersionNotVisible(err), false, err.message);
  }
});

test("dist-tags are read from the authoritative endpoint with cache bypass", async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    return { ok: true, status: 200, statusText: "OK", json: async () => ({ latest: "0.5.4" }) };
  };

  assert.deepEqual(await fetchDistTags("skills4sh", fetchImpl), { latest: "0.5.4" });
  assert.equal(calls[0].url, "https://registry.npmjs.org/-/package/skills4sh/dist-tags");
  assert.equal(calls[0].options.cache, "no-store");
  assert.equal(calls[0].options.headers["cache-control"], "no-cache");
});

test("package names are encoded in the dist-tags URL", () => {
  assert.equal(distTagsUrl("@scope/pkg"), "https://registry.npmjs.org/-/package/%40scope%2Fpkg/dist-tags");
});

test("dist-tag reading fails loudly on a bad response", async () => {
  const fetchImpl = async () => ({ ok: false, status: 503, statusText: "Service Unavailable" });
  await assert.rejects(
    () => fetchDistTags("skills4sh", fetchImpl),
    /dist-tags request for skills4sh failed: 503/,
  );
});

test("a stale dist-tag is a visibility lag, not a defect", () => {
  assert.doesNotThrow(() => assertLatestDistTag({ latest: "0.5.4" }, "0.5.4"));

  for (const distTags of [{ latest: "0.5.3" }, {}, undefined]) {
    assert.throws(
      () => assertLatestDistTag(distTags, "0.5.4"),
      (err) => isVersionNotVisible(err) && /expected 0\.5\.4/.test(err.message),
    );
  }
});
