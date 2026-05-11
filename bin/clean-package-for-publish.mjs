#!/usr/bin/env node
// Strips dev-only fields from package.json before `npm pack` includes it in
// the tarball, then restores them in `postpack`. Wired via the `prepack` and
// `postpack` npm script lifecycle hooks.
//
// Why: every script in package.json#scripts (check:drift, check:guardskills,
// check:pack, check:release, setup:hooks, test, prepublishOnly) references
// files that live OUTSIDE package.json#files — bin/*-check.mjs, .github/
// scripts/*, tests/*. A consumer who installed skills4sh and ran any of
// these would hit "module not found." They're dev-only by design; this
// script keeps them out of the published tarball without sacrificing the
// developer ergonomics of `npm run check:drift` etc.
//
// Idempotency: if a .bak exists at prepack time, we assume a previous run
// was interrupted and restore from .bak before re-modifying. postpack is
// always safe to re-run (it restores from .bak and removes the .bak).

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

function postpack() {
  if (!existsSync(BAK)) {
    // prepack didn't run (or its backup was already restored). Nothing to do.
    console.error("✓ postpack: no .bak to restore (already clean)");
    return;
  }
  copyFileSync(BAK, PKG);
  unlinkSync(BAK);
  console.error("✓ postpack: restored package.json");
}

const mode = process.argv[2];
if (mode === "prepack") prepack();
else if (mode === "postpack") postpack();
else {
  console.error("usage: clean-package-for-publish.mjs prepack|postpack");
  process.exit(1);
}
