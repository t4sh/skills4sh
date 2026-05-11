#!/usr/bin/env node
// Strips dev-only fields from package.json before `npm pack` includes it in
// the tarball, then restores them. Wired via the `prepack`, `postpack`, and
// `postpublish` npm script lifecycle hooks.
//
// Why: every script in package.json#scripts (check:drift, check:guardskills,
// check:pack, check:release, setup:hooks, test, prepublishOnly) references
// files that live OUTSIDE package.json#files — bin/*-check.mjs, .github/
// scripts/*, tests/*. A consumer who installed skills4sh and ran any of
// these would hit "module not found." They're dev-only by design; this
// script keeps them out of both the published tarball AND the npm registry
// metadata, without sacrificing the developer ergonomics of `npm run
// check:drift` etc.
//
// The publish-vs-pack distinction (since v0.4.4):
//   npm publish reads package.json TWICE — once for the tarball (which
//   honors prepack stripping), and once for the registry metadata it POSTs
//   (which happens AFTER postpack). If postpack restored scripts before
//   step 2, the tarball would be clean but the registry metadata wouldn't.
//   v0.4.3 had exactly this hole.
//
//   The fix: postpack skips restore when running under `npm publish`
//   (detected via process.env.npm_command === "publish"), and a separate
//   `postpublish` hook restores after publish completes. For plain
//   `npm pack`, postpack restores as before (no publish follows).
//
// Idempotency: if a .bak exists at prepack time, we assume a previous run
// was interrupted and restore from .bak before re-modifying.

import { readFileSync, writeFileSync, copyFileSync, existsSync, unlinkSync } from "node:fs";

const PKG = "package.json";
const BAK = "package.json.prepack.bak";

function prepack() {
  if (existsSync(BAK)) {
    // Recover from a previous interrupted run before applying our changes.
    copyFileSync(BAK, PKG);
    unlinkSync(BAK);
  }
  copyFileSync(PKG, BAK);
  const pkg = JSON.parse(readFileSync(PKG, "utf8"));
  delete pkg.scripts;
  writeFileSync(PKG, JSON.stringify(pkg, null, 2) + "\n");
  console.error("✓ prepack: stripped scripts from package.json for publish");
}

function restore(label) {
  if (!existsSync(BAK)) {
    console.error(`✓ ${label}: no .bak to restore (already clean)`);
    return;
  }
  copyFileSync(BAK, PKG);
  unlinkSync(BAK);
  console.error(`✓ ${label}: restored package.json`);
}

function postpack() {
  // npm runs postpack between (a) building the tarball and (b) reading
  // package.json again to construct the registry metadata. Restoring here
  // during `npm publish` would leak the dev scripts into the registry
  // metadata even though the tarball is clean — defer to postpublish.
  if (process.env.npm_command === "publish") {
    console.error("✓ postpack: deferring restore to postpublish (publish context)");
    return;
  }
  restore("postpack");
}

function postpublish() {
  restore("postpublish");
}

const mode = process.argv[2];
if (mode === "prepack") prepack();
else if (mode === "postpack") postpack();
else if (mode === "postpublish") postpublish();
else {
  console.error("usage: clean-package-for-publish.mjs prepack|postpack|postpublish");
  process.exit(1);
}
