// Tests for bin/upstream-check.mjs.
//
// Every test injects a fake fetch, so nothing here touches the network. The
// fixtures are small repos in a tmpdir with a pins file, one skill and one doc.
//
// Scenarios covered:
//   - SemVer precedence including prereleases
//   - pins file validation
//   - pin classification: current, behind, ahead, out-of-sync, unverified
//   - link extraction (prose only; code and example hosts skipped)
//   - link classification: ok, broken, unverified, HEAD-rejecting hosts
//   - drift decision and report rendering
//   - CLI exit codes
//
// Run: node --test tests/upstream-check.test.mjs

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import {
  checkLink,
  checkPin,
  compareVersions,
  extractLinks,
  formatReport,
  runUpstreamCheck,
  validatePins,
} from "../bin/upstream-check.mjs";

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), "..", "bin", "upstream-check.mjs");

function response(status, body = {}) {
  return { ok: status >= 200 && status < 300, status, json: async () => body, body: { cancel: async () => {} } };
}

// Builds a fetch stand-in from a URL → handler map. Unmapped URLs throw, so a
// test fails loudly if the code requests something unexpected.
function fakeFetch(routes) {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url, method: options.method ?? "GET" });
    const handler = routes[url];
    if (!handler) throw new Error(`unexpected request: ${url}`);
    return typeof handler === "function" ? handler(options) : handler;
  };
  fetchImpl.calls = calls;
  return fetchImpl;
}

async function buildFixture(files) {
  const root = mkdtempSync(join(tmpdir(), "upstream-check-"));
  for (const [path, content] of Object.entries(files)) {
    await mkdir(dirname(join(root, path)), { recursive: true });
    await writeFile(join(root, path), content);
  }
  return root;
}

const NPM_DEMO = "https://registry.npmjs.org/-/package/demo/dist-tags";
const NPM_SCOPED = "https://registry.npmjs.org/-/package/@scope%2fdemo/dist-tags";
const PYPI_DEMO = "https://pypi.org/pypi/Demo/json";

describe("compareVersions", () => {
  test("orders core versions numerically", () => {
    assert.equal(compareVersions("1.62.0", "1.65.1"), -1);
    assert.equal(compareVersions("8.0.0", "7.2.0"), 1);
    assert.equal(compareVersions("3.1.8", "3.1.8"), 0);
    assert.equal(compareVersions("1.10.0", "1.9.0"), 1);
  });

  test("orders prereleases below their release and numerically among themselves", () => {
    assert.equal(compareVersions("4.0.0-alpha.10", "4.0.0-alpha.12"), -1);
    assert.equal(compareVersions("4.0.0-alpha.12", "4.0.0"), -1);
    assert.equal(compareVersions("4.0.0-alpha.2", "4.0.0-alpha.10"), -1);
    assert.equal(compareVersions("4.0.0-beta.1", "4.0.0-alpha.12"), 1);
    assert.equal(compareVersions("4.0.0-alpha", "4.0.0-alpha.1"), -1);
  });
});

describe("validatePins", () => {
  test("accepts a well-formed pins file", () => {
    const { pins, errors } = validatePins({ pins: [{ name: "demo", registry: "npm", pinned: "1.0.0", files: ["a.md"] }] });
    assert.deepEqual(errors, []);
    assert.equal(pins.length, 1);
  });

  test("reports missing fields, unknown registries and duplicates", () => {
    const { errors } = validatePins({
      pins: [
        { name: "demo", registry: "cargo", pinned: "1.0.0", files: ["a.md"] },
        { name: "", registry: "npm", pinned: "", files: [] },
        { name: "twice", registry: "npm", pinned: "1.0.0", files: ["a.md"] },
        { name: "twice", registry: "npm", pinned: "1.0.1", files: ["b.md"] },
      ],
    });
    assert.ok(errors.some((error) => error.includes('"registry" must be one of')));
    assert.ok(errors.some((error) => error.includes('"name" is required')));
    assert.ok(errors.some((error) => error.includes('"pinned" is required')));
    assert.ok(errors.some((error) => error.includes('"files" must list at least one path')));
    assert.ok(errors.some((error) => error.includes("duplicate pin for npm:twice:latest")));
  });

  test("rejects a document without a pins array", () => {
    assert.equal(validatePins({}).errors.length, 1);
  });
});

describe("checkPin", () => {
  test("classifies current, behind and ahead against the tracked dist-tag", async (t) => {
    const root = await buildFixture({ "skills/demo/SKILL.md": "Install demo@1.2.0 and @scope/demo 4.0.0-alpha.10." });
    t.after(() => rmSync(root, { recursive: true, force: true }));
    const pin = { name: "demo", registry: "npm", pinned: "1.2.0", files: ["skills/demo/SKILL.md"] };

    const current = await checkPin(root, pin, fakeFetch({ [NPM_DEMO]: response(200, { latest: "1.2.0" }) }));
    assert.equal(current.status, "current");

    const behind = await checkPin(root, pin, fakeFetch({ [NPM_DEMO]: response(200, { latest: "1.3.0" }) }));
    assert.equal(behind.status, "behind");
    assert.equal(behind.upstream, "1.3.0");

    const ahead = await checkPin(root, pin, fakeFetch({ [NPM_DEMO]: response(200, { latest: "1.1.9" }) }));
    assert.equal(ahead.status, "ahead");

    const prerelease = await checkPin(
      root,
      { name: "@scope/demo", registry: "npm", tag: "alpha", pinned: "4.0.0-alpha.10", files: ["skills/demo/SKILL.md"] },
      fakeFetch({ [NPM_SCOPED]: response(200, { latest: "0.0.3", alpha: "4.0.0-alpha.12" }) }),
    );
    assert.equal(prerelease.status, "behind");
    assert.equal(prerelease.upstream, "4.0.0-alpha.12");
  });

  test("reads the PyPI release version", async (t) => {
    const root = await buildFixture({ "requirements.txt": "Demo==6.0.3" });
    t.after(() => rmSync(root, { recursive: true, force: true }));
    const result = await checkPin(
      root,
      { name: "Demo", registry: "pypi", pinned: "6.0.3", files: ["requirements.txt"] },
      fakeFetch({ [PYPI_DEMO]: response(200, { info: { version: "6.1.0" } }) }),
    );
    assert.equal(result.status, "behind");
  });

  test("is out-of-sync when a listed file no longer holds the pinned string, without asking the registry", async (t) => {
    const root = await buildFixture({ "skills/demo/SKILL.md": "Install demo@1.3.0." });
    t.after(() => rmSync(root, { recursive: true, force: true }));
    const fetchImpl = fakeFetch({});
    const result = await checkPin(
      root,
      { name: "demo", registry: "npm", pinned: "1.2.0", files: ["skills/demo/SKILL.md", "skills/demo/gone.md"] },
      fetchImpl,
    );
    assert.equal(result.status, "out-of-sync");
    assert.deepEqual(result.missing, ["skills/demo/SKILL.md", "skills/demo/gone.md (file not found)"]);
    assert.equal(fetchImpl.calls.length, 0);
  });

  test("is unverified, not drift, when the registry fails or lacks the tag", async (t) => {
    const root = await buildFixture({ "skills/demo/SKILL.md": "demo@1.2.0" });
    t.after(() => rmSync(root, { recursive: true, force: true }));
    const pin = { name: "demo", registry: "npm", pinned: "1.2.0", files: ["skills/demo/SKILL.md"] };

    const serverError = await checkPin(root, pin, fakeFetch({ [NPM_DEMO]: response(503) }));
    assert.equal(serverError.status, "unverified");
    assert.match(serverError.reason, /HTTP 503/);

    const noTag = await checkPin(root, { ...pin, tag: "next" }, fakeFetch({ [NPM_DEMO]: response(200, { latest: "1.2.0" }) }));
    assert.equal(noTag.status, "unverified");
    assert.match(noTag.reason, /no "next" dist-tag/);

    const offline = await checkPin(root, pin, async () => {
      throw new Error("getaddrinfo ENOTFOUND registry.npmjs.org");
    });
    assert.equal(offline.status, "unverified");
  });
});

describe("extractLinks", () => {
  test("returns prose links once each, trimmed of markdown and sentence punctuation", () => {
    const links = extractLinks(
      [
        "See the [docs](https://docs.vendor.dev/guide#install) and https://vendor.dev/changelog.",
        "A wiki page: [Foo](https://en.wikipedia.org/wiki/Foo_(bar)).",
        "Again: https://docs.vendor.dev/guide#install",
      ].join("\n"),
    );
    assert.deepEqual(links, [
      "https://docs.vendor.dev/guide#install",
      "https://vendor.dev/changelog",
      "https://en.wikipedia.org/wiki/Foo_(bar)",
    ]);
  });

  test("skips fenced code, inline code, templated URLs, bare origins and example or local hosts", () => {
    const links = extractLinks(
      [
        "Real: https://vendor.dev/real",
        "```bash",
        "curl https://api.vendor.dev/v10/in-a-code-block",
        "```",
        "Inline `https://api.vendor.dev/inline` is skipped.",
        "Template https://api.vendor.dev/channels/{id} and https://api.vendor.dev/$CHANNEL are skipped.",
        "Local http://localhost:3000/ and http://127.0.0.1:8080/ and https://myapp.localhost/ are skipped.",
        "Example https://example.com/page and https://shop.example.org/ are skipped.",
        "Bare origins https://fonts.vendor.dev and https://cdn.vendor.dev/ name hosts and are skipped.",
      ].join("\n"),
    );
    assert.deepEqual(links, ["https://vendor.dev/real"]);
  });
});

describe("checkLink", () => {
  test("is ok on a successful HEAD and drops the fragment from the request", async () => {
    const fetchImpl = fakeFetch({ "https://vendor.dev/guide": response(200) });
    assert.deepEqual(await checkLink("https://vendor.dev/guide#install", fetchImpl), { status: "ok" });
    assert.deepEqual(fetchImpl.calls, [{ url: "https://vendor.dev/guide", method: "HEAD" }]);
  });

  test("confirms an unsuccessful HEAD with GET before judging", async () => {
    const headRejected = fakeFetch({ "https://vendor.dev/a": (options) => response(options.method === "HEAD" ? 405 : 200) });
    assert.deepEqual(await checkLink("https://vendor.dev/a", headRejected), { status: "ok" });
    assert.deepEqual(headRejected.calls.map((call) => call.method), ["HEAD", "GET"]);

    const headLies = fakeFetch({ "https://vendor.dev/b": (options) => response(options.method === "HEAD" ? 404 : 200) });
    assert.deepEqual(await checkLink("https://vendor.dev/b", headLies), { status: "ok" });
  });

  test("is broken only for 404 and 410", async () => {
    assert.deepEqual(await checkLink("https://vendor.dev/gone", fakeFetch({ "https://vendor.dev/gone": response(404) })), {
      status: "broken",
      reason: "HTTP 404",
    });
    assert.equal((await checkLink("https://vendor.dev/x", fakeFetch({ "https://vendor.dev/x": response(410) }))).status, "broken");
  });

  test("is unverified for blocks, server errors and network failures", async () => {
    assert.equal((await checkLink("https://vendor.dev/x", fakeFetch({ "https://vendor.dev/x": response(403) }))).status, "unverified");
    assert.equal((await checkLink("https://vendor.dev/x", fakeFetch({ "https://vendor.dev/x": response(500) }))).status, "unverified");
    const offline = await checkLink("https://vendor.dev/x", async () => {
      throw new Error("fetch failed");
    });
    assert.equal(offline.status, "unverified");
  });
});

describe("runUpstreamCheck", () => {
  const pinsFile = (pins) => JSON.stringify({ pins });

  test("reports no drift when pins are current and links resolve", async (t) => {
    const root = await buildFixture({
      ".github/upstream-pins.json": pinsFile([{ name: "demo", registry: "npm", pinned: "1.2.0", files: ["skills/demo/SKILL.md"] }]),
      "skills/demo/SKILL.md": "Install demo@1.2.0. See https://vendor.dev/guide.",
      "docs/STANDARD.md": "Source: https://vendor.dev/guide",
    });
    t.after(() => rmSync(root, { recursive: true, force: true }));
    const result = await runUpstreamCheck({
      root,
      fetchImpl: fakeFetch({ [NPM_DEMO]: response(200, { latest: "1.2.0" }), "https://vendor.dev/guide": response(200) }),
    });
    assert.equal(result.drift, false);
    assert.deepEqual(result.errors, []);
    assert.deepEqual(result.links, [
      { url: "https://vendor.dev/guide", files: ["skills/demo/SKILL.md", "docs/STANDARD.md"], status: "ok" },
    ]);
    assert.match(formatReport(result, "2026-11-21"), /No drift/);
  });

  test("reports drift for a pin behind upstream and for a broken link, and renders both", async (t) => {
    const root = await buildFixture({
      ".github/upstream-pins.json": pinsFile([{ name: "demo", registry: "npm", pinned: "1.2.0", files: ["skills/demo/SKILL.md"] }]),
      "skills/demo/SKILL.md": "Install demo@1.2.0. See https://vendor.dev/moved.",
    });
    t.after(() => rmSync(root, { recursive: true, force: true }));
    const result = await runUpstreamCheck({
      root,
      fetchImpl: fakeFetch({ [NPM_DEMO]: response(200, { latest: "1.4.0" }), "https://vendor.dev/moved": response(404) }),
    });
    assert.equal(result.drift, true);
    const report = formatReport(result, "2026-11-21");
    assert.match(report, /\| `demo` \| npm `latest` \| 1\.2\.0 \| 1\.4\.0 \| `skills\/demo\/SKILL\.md` \|/);
    assert.match(report, /\| https:\/\/vendor\.dev\/moved \| HTTP 404 \| `skills\/demo\/SKILL\.md` \|/);
    assert.match(report, /0 of 1 pins current; 0 of 1 links resolve\./);
  });

  test("does not count unverified results as drift, and lists them", async (t) => {
    const root = await buildFixture({
      ".github/upstream-pins.json": pinsFile([{ name: "demo", registry: "npm", pinned: "1.2.0", files: ["skills/demo/SKILL.md"] }]),
      "skills/demo/SKILL.md": "Install demo@1.2.0. See https://vendor.dev/blocked.",
    });
    t.after(() => rmSync(root, { recursive: true, force: true }));
    const result = await runUpstreamCheck({
      root,
      fetchImpl: fakeFetch({ [NPM_DEMO]: response(502), "https://vendor.dev/blocked": response(403) }),
    });
    assert.equal(result.drift, false);
    const report = formatReport(result, "2026-11-21");
    assert.match(report, /## Could not verify/);
    assert.match(report, /`demo` — registry answered HTTP 502/);
    assert.match(report, /https:\/\/vendor\.dev\/blocked — HTTP 403/);
  });

  test("skips link requests when links are disabled", async (t) => {
    const root = await buildFixture({
      ".github/upstream-pins.json": pinsFile([{ name: "demo", registry: "npm", pinned: "1.2.0", files: ["skills/demo/SKILL.md"] }]),
      "skills/demo/SKILL.md": "Install demo@1.2.0. See https://vendor.dev/guide.",
    });
    t.after(() => rmSync(root, { recursive: true, force: true }));
    const fetchImpl = fakeFetch({ [NPM_DEMO]: response(200, { latest: "1.2.0" }) });
    const result = await runUpstreamCheck({ root, fetchImpl, links: false });
    assert.deepEqual(result.links, []);
    assert.equal(fetchImpl.calls.length, 1);
  });

  test("returns configuration errors for a missing or invalid pins file", async (t) => {
    const missing = await buildFixture({ "skills/demo/SKILL.md": "x" });
    const invalid = await buildFixture({ ".github/upstream-pins.json": pinsFile([{ name: "demo" }]) });
    t.after(() => {
      rmSync(missing, { recursive: true, force: true });
      rmSync(invalid, { recursive: true, force: true });
    });
    assert.equal((await runUpstreamCheck({ root: missing, fetchImpl: fakeFetch({}) })).errors.length, 1);
    assert.ok((await runUpstreamCheck({ root: invalid, fetchImpl: fakeFetch({}) })).errors.length >= 1);
  });
});

describe("CLI", () => {
  const run = (args) => spawnSync(process.execPath, [SCRIPT, ...args], { encoding: "utf8" });

  test("exits 2 on an unknown argument, a missing value, or a missing pins file", async (t) => {
    const root = await buildFixture({ "skills/demo/SKILL.md": "x" });
    t.after(() => rmSync(root, { recursive: true, force: true }));
    assert.equal(run(["--bogus"]).status, 2);
    assert.equal(run(["--root"]).status, 2);
    const missingPins = run(["--root", root, "--no-links"]);
    assert.equal(missingPins.status, 2);
    assert.match(missingPins.stderr, /upstream-pins\.json/);
  });

  test("with --strict exits 1 on drift that needs no network to detect", async (t) => {
    const root = await buildFixture({
      ".github/upstream-pins.json": JSON.stringify({
        pins: [{ name: "demo", registry: "npm", pinned: "1.2.0", files: ["skills/demo/SKILL.md"] }],
      }),
      "skills/demo/SKILL.md": "Install demo@1.3.0.",
    });
    t.after(() => rmSync(root, { recursive: true, force: true }));
    const reportPath = join(root, "report.md");
    const strict = run(["--root", root, "--no-links", "--strict", "--report", reportPath]);
    assert.equal(strict.status, 1);
    assert.match(strict.stdout, /Pins that no longer match the files/);
    const lenient = run(["--root", root, "--no-links", "--json"]);
    assert.equal(lenient.status, 0);
    assert.equal(JSON.parse(lenient.stdout).pins[0].status, "out-of-sync");
  });

  test("prints usage with --help", () => {
    const help = run(["--help"]);
    assert.equal(help.status, 0);
    assert.match(help.stdout, /^Usage: upstream-check/);
  });
});
