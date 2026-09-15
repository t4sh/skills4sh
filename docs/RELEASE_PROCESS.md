# Release Process

This runbook is the canonical release procedure for publishing `skills4sh` to
npm. Use it whenever `package.json.version` changes or a GitHub release needs
to be created.

## Release Model

`skills4sh` publishes through GitHub Actions and npm Trusted Publishing.

- A GitHub release on a signed annotated `vX.Y.Z` tag triggers
  `.github/workflows/npm-publish.yml`.
- The workflow checks out exactly the release tag, not the current branch.
- `bin/release-check.mjs` verifies the release tag name, tag type, tag
  signature, tag target, and commit verification.
- `bin/verify-published.mjs` verifies npm registry metadata after publish.
- Local `npm publish` is not the normal path because it cannot create the
  GitHub Actions OIDC provenance attestation.

The main invariant is:

```text
merge version PR -> sync main -> create signed tag on main HEAD -> create release -> verify npm
```

Never create a `vX.Y.Z` tag or GitHub release before the PR containing
`package.json` version `X.Y.Z` has merged to `main`.

## Prerequisites

- Use npm 12.0.2, selected by `package.json#packageManager`, with Node 22.23.1
  or a compatible newer release. CI installs the pinned npm version explicitly.
- Run `npm ci --ignore-scripts --no-audit --no-fund` before packing. The root
  `package-lock.json` controls the build dependency tree; `bundleDependencies`
  carries `undici` into the tarball. npm 12 removed shrinkwrap support, so
  consumers receive the bundled dependency instead of a published lockfile.
- Local git can push tags to `origin`.
- Local tag signing is enabled and verifiable.
- `gh` is authenticated for `t4sh/skills4sh`.
- npm Trusted Publisher is configured for:
  - package: `skills4sh`
  - repository: `t4sh/skills4sh`
  - workflow: `npm-publish.yml`
  - environment: blank
- `package.json`, `.claude-plugin/marketplace.json`, and
  `.cursor-plugin/plugin.json` use the same package version.

## Version-Bump PR Checklist

Before merging a PR that changes `package.json.version`:

1. Confirm the package version was bumped intentionally.
2. Confirm matching plugin manifest versions were updated.
3. Confirm no `vX.Y.Z` tag was created for the new version.
4. Confirm no GitHub release was created for the new version.
5. Wait for all required PR checks to pass.
6. Merge the PR to `main`.

Do not publish from the feature branch. The release tag must point at the
merged `main` commit.

### Registry visibility lag after publish

npm 12 publishes asynchronously. `npm publish` prints `Your package is being
processed and may take a few minutes to become available` and returns
`+ skills4sh@X.Y.Z` before the registry serves that version. Measured lag from
that line to the version being visible: **126s for v0.5.2** and **158s for
v0.5.3**. Under npm 11 (v0.5.1 and earlier) the lag was under a second, which is
why only v0.5.2 and v0.5.3 failed `Verify published registry metadata`.

`bin/verify-published.mjs` budgets ~5 minutes (60 attempts × 5s) for this, and
retries only while the registry is not serving the version yet (`E404` /
`No match found for version`). Every other failure fails immediately, so the
budget cannot mask a real defect as a propagation lag. The step also confirms
`latest` points at the published version by reading npm's authoritative
per-package dist-tags endpoint, because the packument itself is served with
`cache-control: public, max-age=300`.

A verify failure after `+ skills4sh@X.Y.Z` is a false negative on a release that
already succeeded. Do not re-publish or move the tag for it; see Failed Release
Recovery.

## Preflight Before Tagging

Start from a clean checkout. Then sync `main` and derive the expected tag from
`package.json`.

```bash
git fetch origin main --tags --prune-tags
git checkout main
git pull --ff-only origin main

version=$(node -p "require('./package.json').version")
tag="v$version"
head=$(git rev-parse HEAD)
origin_head=$(git rev-parse origin/main)
```

Confirm local `main` is exactly `origin/main`.

```bash
test "$head" = "$origin_head"
```

Confirm the expected tag does not already exist locally or remotely.

```bash
if git rev-parse --verify --quiet "refs/tags/$tag"; then
  echo "local tag already exists: $tag"
  exit 1
fi

if git ls-remote --exit-code --tags origin "refs/tags/$tag"; then
  echo "remote tag already exists: $tag"
  exit 1
fi
```

Confirm npm does not already contain the version.

```bash
if npm view "skills4sh@$version" version >/dev/null 2>&1; then
  echo "npm version already exists: skills4sh@$version"
  exit 1
fi
```

If npm already has the version, stop and create a new version bump PR instead
of reusing the tag.

## Create and Push the Tag

Create an annotated signed tag on the merged `main` commit.

```bash
git tag -a "$tag" -m "$tag"
git tag -v "$tag"
test "$(git rev-list -n 1 "$tag")" = "$(git rev-parse HEAD)"
git push origin "$tag"
```

If `git tag -v` fails, stop and fix local signing before publishing.

## Create the GitHub Release

Create the release from the pushed tag. This triggers
`.github/workflows/npm-publish.yml`.

```bash
gh release create "$tag" \
  --title "$tag" \
  --notes "Release $tag."
```

The release event is the publish trigger. Do not run local `npm publish` for a
normal release.

## Watch Publish

Find and watch the release-triggered workflow run.

```bash
gh run list --workflow npm-publish.yml --limit 3
gh run watch <run-id> --exit-status
```

The publish run must pass:

- `Pre-publish guards (mirrors local prepublishOnly + validate)`
- `Run installer unit tests`
- `Publish to npm (OIDC Trusted Publisher + provenance)`
- `Verify published registry metadata`

## Verify npm

After the workflow passes, verify registry metadata and signatures directly.

```bash
npm view "skills4sh@$version" version gitHead dist.integrity --json
npm audit signatures "skills4sh@$version"
```

Expected results:

- npm version equals `package.json.version`.
- npm `gitHead` equals the merged `main` commit that was tagged.
- Registry metadata declares the exact pinned `undici` bundle. `check:pack`
  verifies the tarball contents before publish, and the installation test
  verifies that it installs with an empty cache in offline mode.
- npm reports a verified registry signature.
- npm reports a verified provenance attestation.

## Failed Release Recovery

Use this only when the GitHub release or npm publish failed.

First determine whether npm published the version:

```bash
npm view "skills4sh@$version" version gitHead --json
```

If the publish step logged `+ skills4sh@$version`, the publish itself
succeeded. Since v0.5.4 the verify step already waits ~5 minutes for the
registry lag, so a verify failure now means either the wait was exceeded or the
metadata is genuinely wrong. Check both before touching anything:

```bash
npm view "skills4sh@$version" version gitHead --json
curl -s "https://registry.npmjs.org/-/package/skills4sh/dist-tags"
```

Once the version is visible with the expected `gitHead` and `latest` points at
it, the release succeeded. Leave the failed Actions run; do not re-run
`npm-publish.yml` and do not recreate the tag.

If npm returns the version, do not reuse or move the tag. If a new publish is
still needed, bump to the next package version and release again.

If npm returns 404 or no version, the version was not published. It is
acceptable to repair the GitHub release/tag, but only after confirming the tag
target is wrong or the release was cut from the wrong commit.

Inspect the tag:

```bash
git fetch origin --tags --prune-tags
git rev-list -n 1 "$tag"
git tag -v "$tag"
gh release view "$tag" --json tagName,name,isDraft,isPrerelease,publishedAt,url,targetCommitish
```

If the tag points at the wrong commit and npm has no package for the version:

```bash
gh release delete "$tag" --cleanup-tag --yes
git tag -d "$tag" 2>/dev/null || true

git fetch origin main --tags --prune-tags
git checkout main
git pull --ff-only origin main

git tag -a "$tag" -m "$tag"
git tag -v "$tag"
git push origin "$tag"

gh release create "$tag" \
  --title "$tag" \
  --notes "Release $tag."
```

Then watch the new `npm-publish.yml` run and perform the npm verification
steps again.

## Stale Tag Rules

- If the expected tag already exists and npm already has the version, never
  reuse the tag. Bump the package version.
- If the expected tag already exists but npm does not have the version, inspect
  the failed release before changing anything.
- Only delete or recreate a tag when repairing an unpublished failed release.
- Never create a tag from a feature branch, draft PR branch, or unmerged PR.
- Never create a GitHub release from a tag until `package.json.version` is on
  `main`.

## Line-Ending Check

`.gitattributes` keeps repository text files on LF endings. Before committing
release docs or asset changes, check for CRLF drift:

```bash
find . -maxdepth 3 -type f \( -name '*.md' -o -name '*.mjs' -o -name '*.sh' -o -name '*.svg' -o -name '*.json' -o -name '*.yml' -o -name '*.yaml' \) -print0 | xargs -0 file | rg CRLF
```

Expected result: no output.

## Local Validation

For a release PR, run the relevant local checks before pushing:

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm run check:drift
npm run check:pack
npm test
git diff --check
```

For docs-only release-process edits, `npm run check:drift`, `git diff --check`,
and the CRLF scan are sufficient unless package or installer behavior changed.
