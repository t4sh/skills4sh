# Build Awesome v4 prerelease

Use this reference only when a project explicitly opts into Eleventy/Build Awesome v4, uses `@awesome.me/buildawesome`, installs `@11ty/eleventy@canary`, or contains the generic `.data.*` / `.server.*` suffixes.

## Version gate

This guidance was verified on **August 6, 2026** against:

| Track | Verified version | Status |
|---|---|---|
| Eleventy | `3.1.6` | Stable production baseline |
| Build Awesome / Eleventy | `4.0.0-alpha.10` | Prerelease |
| Build Awesome Nunjucks fork | `@11ty/nunjucks@4.0.0-alpha.3` | Prerelease and behavior-changing |

Before changing dependencies:

1. Inspect `package.json`, its lockfile, the Node engine, the active config filename, and current Eleventy/Build Awesome package versions.
2. Check the current [Build Awesome releases](https://github.com/11ty/buildawesome/releases) and package dist-tags.
3. **STOP if the current canary/alpha is newer than `4.0.0-alpha.10`.** Read every intervening release note and update the migration plan before editing. Do not generalize alpha behavior into stable guidance.
4. Pin the selected prerelease exactly. Adapt the official install command to the repository’s existing package manager; do not introduce a second lockfile.

The official alpha packages are:

```text
@11ty/eleventy@canary
@awesome.me/buildawesome@alpha
```

Existing Eleventy commands remain compatible. When adopting the renamed package, the equivalent CLI entry is `npx @awesome.me/buildawesome`; installing both packages is supported but usually unnecessary.

## Migration delta

| Surface | Stable v3 behavior | v4 prerelease handling |
|---|---|---|
| Node.js | Package engine floor `>=18`; use a supported LTS operationally | Requires Node `22.15+` |
| Package/repository | Package remains `@11ty/eleventy`; canonical repository is now `11ty/buildawesome` | `@awesome.me/buildawesome` is the renamed package alternative |
| Directory/template data suffix | `.11tydata.js` | Also recognizes `.data.js`; audit collisions before upgrading |
| JavaScript template suffix | `.11ty.js` | Also recognizes `.server.js`; audit collisions before upgrading |
| TypeScript | Project-specific transpilation or experimental canary support | Zero-config TypeScript remains prerelease behavior; config API types are published |
| Incremental builds | Established single-change workflow | Supports batched incremental files |
| Nunjucks | Mozilla Nunjucks 3.x | Uses the `@11ty/nunjucks` fork with a large async refactor |
| Async template syntax | Async filters inside loops require `asyncEach` / `asyncAll`; async `set` is constrained | Ordinary `{% for %}` and `{% set %}` support the new async paths; macros may contain async child content |
| Event emitter | Parallel behavior was the prior default | Default event mode is sequential; review listeners that assumed parallel execution |
| Data aliases | `eleventyComputed`, `eleventyExcludeFromCollections`, `eleventyImport` | `buildAwesome*` aliases merge with their `eleventy*` counterparts |
| Deep merge | Older versions allowed a global opt-out | `setDataDeepMerge(false)` throws; deep merge is always enabled and `override:<key>` opts out per property |
| Bundle plugin | v3 line | v4 alpha upgrades to Bundle Plugin v4; read its release notes separately |

Do not document `page.inputPathDir` or `page.dir`: those canary-only values were introduced and then removed before alpha.8.

## Collision audit

Before installing v4, search the full project—including hidden and ignored build inputs when the audit must prove absence—for existing files that match:

```text
*.data.js
*.data.cjs
*.data.mjs
*.server.js
*.server.cjs
*.server.mjs
```

Classify each result before migration. A pre-existing application module with one of these names may become an Eleventy data file or JavaScript template under v4.

## Nunjucks migration review

Treat alpha.9+ as a deliberate template-runtime migration, not a dependency-only update:

1. Inventory `asyncEach`, `asyncAll`, async filters, async shortcodes, captured `{% set %}` blocks, and macros with caller content.
2. Preserve stable-v3 syntax until the project is actually running the v4 fork.
3. Add focused render fixtures for every changed async template path.
4. Verify ordering and failure behavior; a successful build alone does not prove identical async output.
5. Recheck layout invalidation in watch/serve mode. Alpha.10 was a hotfix for a layout-cache regression in alpha.9.

## Data migration review

1. Find `setDataDeepMerge(false)` and remove it only as part of the v4 migration; it throws in v4.
2. For arrays or objects that must replace rather than merge, use the documented `override:<key>` form and add a rendered-data fixture.
3. Check both `eleventy*` and `buildAwesome*` data aliases for accidental double declarations.
4. Re-run collection, pagination, layout-frontmatter, and directory-data fixtures after the change.

## Completion gate

A v4 migration is complete only when:

- The prerelease is pinned exactly and the lockfile contains only the project’s established package manager.
- The runtime is Node `22.15+` and CI/deploy use a supported Node line.
- Generic suffix collisions were audited and resolved.
- Nunjucks async fixtures, data-cascade fixtures, watch-mode layout invalidation, and the production build pass.
- Event listeners and Bundle Plugin usage were reviewed against their v4 behavior.
- The installed alpha still matches the version reviewed here; otherwise the version gate is repeated.

## Primary sources

- [Eleventy is now Build Awesome](https://www.11ty.dev/blog/build-awesome/)
- [Build Awesome releases and migration notes](https://github.com/11ty/buildawesome/releases)
- [Eleventy configuration filenames](https://www.11ty.dev/docs/config/)
- [Eleventy data cascade and `override:` prefix](https://www.11ty.dev/docs/data-cascade/)
- [Eleventy Nunjucks integration](https://www.11ty.dev/docs/languages/nunjucks/)
