# Build Awesome v4 prerelease

Use this reference only when a project explicitly opts into Eleventy/Build Awesome v4, uses `@awesome.me/buildawesome`, installs `@11ty/eleventy@canary`, has a `buildawesome.config.*` file, or configures the v4 generic `.data.*` / `.server.*` suffixes. Filenames alone are only a cue to inspect package metadata.

## Version gate

This guidance was verified on **November 21, 2026** (npm dist-tags, release notes, and the tagged source, checked 2026-11-21) against:

| Track | Verified version | Status |
|---|---|---|
| Eleventy | `3.1.8` (released 2026-11-03) | Stable production baseline; depends on Mozilla `nunjucks@^3.2.4`. Only `3.1.7` (2026-10-15) aliased `nunjucks` to `@11ty/nunjucks@3.3.0`; 3.1.8 reverted the alias because it caused regressions for projects that modify the Nunjucks engine through `setLibrary` |
| Build Awesome / Eleventy | `4.0.0-alpha.12` (released 2026-11-19) | Prerelease |
| Build Awesome Nunjucks fork | `@11ty/nunjucks@^4.0.0-alpha.4` (`4.0.0-alpha.4` is the newest alpha on 2026-11-21) | Prerelease and behavior-changing |

Before changing dependencies:

1. Inspect `package.json`, its lockfile, the Node engine, the active config filename, and current Eleventy/Build Awesome package versions.
2. Check the current [Build Awesome releases](https://github.com/11ty/buildawesome/releases) and package dist-tags.
3. **STOP if the current canary/alpha is newer than `4.0.0-alpha.12`.** Read every intervening release note and update the migration plan before editing. Do not generalize alpha behavior into stable guidance.
   **Stable drift recheck:** if `npm view @11ty/eleventy dist-tags.latest` is newer than `3.1.8`, read those stable release notes before comparing v3 and v4 behavior; the v3 column below describes `3.1.8`.
4. Pin the selected prerelease exactly. Adapt the official install command to the repository’s existing package manager; do not introduce a second lockfile.

The official alpha packages are:

```text
@11ty/eleventy@canary
@awesome.me/buildawesome@alpha
```

Existing Eleventy commands remain compatible. When adopting the renamed package, run the locally installed `buildawesome` bin (for example `npx --no-install buildawesome` or a `package.json` script). Never run an untagged `npx @awesome.me/buildawesome` or `npm install @awesome.me/buildawesome`, even though the v4 documentation prints those commands: the `latest` dist-tag is the `0.0.3` placeholder, not v4 (checked 2026-11-21). For a one-off run, pin the exact version: `npx @awesome.me/buildawesome@4.0.0-alpha.12`. Installing both packages is supported but usually unnecessary.

## Migration delta

| Surface | Stable v3 behavior | v4 prerelease handling |
|---|---|---|
| Node.js | Package engine floor `>=18`; use a supported LTS operationally | Requires Node `22.15+` |
| Package/repository | Package remains `@11ty/eleventy`; canonical repository is now `11ty/buildawesome` | `@awesome.me/buildawesome` is the renamed package alternative |
| Config filename | `.eleventy.js`, then `eleventy.config.js`, `.mjs`, `.cjs` | Checks `buildawesome.config.js`, `.mjs`, `.cjs` first (since alpha.8), then `.eleventy.js`, then `eleventy.config.js`, `.mjs`, `.cjs`; `.ts`, `.mts`, `.cts` variants of both names are eligible when the runtime supports TypeScript. The first existing file wins, so an `eleventy.config.js` left beside a `buildawesome.config.js` is not loaded |
| Directory/template data suffix | `.11tydata.js` | Also recognizes `.data.js`; audit collisions before upgrading |
| JavaScript template suffix | `.11ty.js` | Also recognizes `.server.js`; audit collisions before upgrading |
| TypeScript | Project-specific transpilation or experimental canary support | Zero-config TypeScript remains prerelease behavior; config API types are published |
| Incremental builds | Established single-change workflow | Supports batched incremental files |
| Nunjucks | `3.1.8` depends on Mozilla `nunjucks@^3.2.4` | Uses the `@11ty/nunjucks` 4.x prerelease with a large async refactor |
| Async template syntax | Plain `{% for %}` and inline `{% set %}` already handle async filters; block `{% set %}…{% endset %}` capture needs `setAsync`, and macro bodies are not async-safe (`nunjucks-syntax.md` § Async capture) | Ordinary `{% for %}` and `{% set %}` support the new async paths; macros may contain async child content |
| Event emitter | Parallel behavior was the prior default | Default event mode is sequential; review listeners that assumed parallel execution |
| Data aliases | `eleventyComputed`, `eleventyExcludeFromCollections`, `eleventyImport`, `eleventyDataSchema` | `buildawesomeComputed`, `buildawesomeExcludeFromCollections`, `buildawesomeImport`, `buildawesomeDataSchema` (all-lowercase `buildawesome` prefix) merge with their `eleventy*` counterparts |
| Deep merge | Older versions allowed a global opt-out | `setDataDeepMerge(false)` throws; deep merge is always enabled and `override:<key>` opts out per property |
| Bundle plugin | v3 line | v4 alpha upgrades to Bundle Plugin v4; read its release notes separately |
| Matching-folder permalinks (alpha.11) | A file named like its parent folder collapses: `2025/08/08.md` writes `/2025/08/` | Writes `/2025/08/08/` and warns for each affected page; `setPermalinkCollapseMatchingFolder(true)` restores the old URLs |
| Case sensitivity (alpha.11) | Follows the operating system's file system | Layouts, includes, data files, and passthrough paths must match the on-disk case on every OS; file extensions and data-file names match case-insensitively; input files or output paths that differ only by case throw |
| Dev server (alpha.11) | Dev Server 2: live reload over WebSocket | Dev Server 3 alpha: serves only `localhost` by default (`host: "0.0.0.0"` to reach it from another device), URLs are case-sensitive, dotfiles outside `.well-known` are not served, live reload uses Server-Sent Events instead of WebSocket, and the server starts before the first build |
| Computed data (alpha.11) | Evaluated eagerly; cannot set `pagination` or other special keys | Lazy: evaluated when read, with warnings for early reads; may set `pagination`, `date`, `eleventyImport` / `buildawesomeImport`, `dynamicPermalink`, and `permalinkBypassOutputDir` |
| Front matter and Markdown (alpha.11) | markdown-it 14 | `@11ty/gray-matter` 3: YAML timestamp values other than the content `date` arrive as strings, not `Date` objects; markdown-it 15 |
| Rendering and tags (alpha.11) | Render concurrency `1` | Render concurrency defaults to `4` (`setConcurrency(1)` restores it); `tags` entries are trimmed and converted to strings before de-duplication |
| Output containment (alpha.12) | — | A `permalink` or passthrough-copy target outside the output directory throws unless `permalinkBypassOutputDir` is set |
| Global data (alpha.12) | — | Frozen by default; `setFreezeGlobalData(false)` opts out |

Do not document `page.inputPathDir` or `page.dir`: those canary-only values were introduced and then removed before alpha.8.

## Alpha.11 and alpha.12 upgrade review

Run the alpha build once, then work through its errors and warnings before changing templates:

1. **Case errors.** Fix each layout, include, data, or passthrough reference whose case differs from the file on disk, and rename files that collide by case. Silencing them with `configureErrorReporting({ caseCollisions: "allow" })` is the user's decision, not a default.
2. **Collapsed-folder warnings.** For each page named like its parent folder, choose the new URL (add redirects if the old one was public) or restore the old behavior with `setPermalinkCollapseMatchingFolder(true)`.
3. **Output containment.** Find `permalink` values and passthrough targets that leave the output directory; move them inside or opt in per template with `permalinkBypassOutputDir`.
4. **Dev server.** Device testing needs `host: "0.0.0.0"`; a development CSP must allow the Server-Sent Events connection instead of a WebSocket endpoint.
5. **Dates and global data.** Review templates that call date methods on YAML values other than `date`, and code that mutates global data.

Done when the alpha build finishes without errors and every remaining warning is either resolved or accepted by the user.

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
6. Confirm rejected async filters fail the build: alpha.12 makes a rejected async Nunjucks filter throw instead of hanging.

## Data migration review

1. Find `setDataDeepMerge(false)` and remove it only as part of the v4 migration; it throws in v4.
2. For arrays or objects that must replace rather than merge, use the documented `override:<key>` form and add a rendered-data fixture.
3. Check both `eleventy*` and `buildawesome*` data aliases for accidental double declarations. From alpha.12 the `override:` prefix also works in directory data files.
4. Re-run collection, pagination, layout-frontmatter, and directory-data fixtures after the change.

## Completion gate

A v4 migration is complete only when:

- The prerelease is pinned exactly and the lockfile contains only the project’s established package manager.
- The runtime is Node `22.15+` and CI/deploy use a supported Node line.
- Generic suffix collisions were audited and resolved.
- Nunjucks async fixtures, data-cascade fixtures, watch-mode layout invalidation, and the production build pass.
- Event listeners and Bundle Plugin usage were reviewed against their v4 behavior.
- The alpha.11 and alpha.12 upgrade review above reached its done-condition.
- The installed alpha still matches the version reviewed here; otherwise the version gate is repeated.

## Primary sources

- [Eleventy is now Build Awesome](https://www.11ty.dev/blog/build-awesome/)
- [Build Awesome releases and migration notes](https://github.com/11ty/buildawesome/releases)
- [Eleventy configuration filenames](https://www.11ty.dev/docs/config/)
- [Build Awesome v4 configuration filenames](https://build.awesome.me/docs/config/)
- [Eleventy data cascade and `override:` prefix](https://www.11ty.dev/docs/data-cascade/)
- [Eleventy Nunjucks integration](https://www.11ty.dev/docs/languages/nunjucks/)
