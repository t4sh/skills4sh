#!/usr/bin/env bash
# Refuse `npm publish` when bin/ disagrees with the git tag for the
# current package.json version.
#
# Catches: edited bin/install.mjs (e.g. added a new flag) without bumping
# package.json — publish would silently replace the tagged 0.X.Y artifact
# with code that doesn't match git tag vX.Y.Z. Reproducer: bug fixed in
# skills4sh v0.3.0 where local 0.2.0 had --dry-run but registry 0.2.0
# did not.
#
# Invariants (in order):
#   1. No uncommitted (working tree or staged) changes under bin/.
#   2. If a tag matching vX.Y.Z exists, bin/ must equal that tag's bin/.
#      If no such tag exists yet, this is the first publish for that
#      version — allow.
#
# Wired in via package.json:
#   "scripts": { "prepublishOnly": "bash .github/scripts/check-bin-tag-parity.sh" }
#
# Bypass (use ONLY for hotfix / republish-after-unpublish scenarios):
#   SKIP_BIN_TAG_PARITY=1 npm publish
set -euo pipefail

if [ "${SKIP_BIN_TAG_PARITY:-}" = "1" ]; then
  echo "⚠ SKIP_BIN_TAG_PARITY=1 — bypassing bin/ tag-parity check (INSECURE)"
  exit 0
fi

pkg_version=$(python3 -c "import json; print(json.load(open('package.json'))['version'])")
tag="v$pkg_version"

# 1. No uncommitted changes under bin/ — the publish artifact must match
#    what's in git history.
if ! git diff --quiet -- bin/ 2>/dev/null; then
  echo "✗ Uncommitted changes in bin/ — commit before publishing."
  git status --short bin/
  exit 1
fi
if ! git diff --quiet --cached -- bin/ 2>/dev/null; then
  echo "✗ Staged but uncommitted changes in bin/ — commit before publishing."
  git status --short bin/
  exit 1
fi

# 2. If the tag already exists, bin/ must match it.
if git rev-parse --verify --quiet "refs/tags/$tag" >/dev/null 2>&1; then
  if ! git diff --quiet "$tag" -- bin/; then
    echo "✗ bin/ differs from tag $tag — bump package.json version before publishing."
    echo "  This version was already tagged; publishing now would replace the"
    echo "  registry artifact with code that doesn't match the git tag."
    echo ""
    echo "  Changed since $tag:"
    git diff --stat "$tag" -- bin/
    exit 1
  fi
  echo "✓ bin/ matches tag $tag"
else
  echo "✓ No tag $tag yet — first publish of $pkg_version"
fi
