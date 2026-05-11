#!/usr/bin/env bash
# Wire git hooks for skills4sh contributors.
#
# Run once after `git clone`:
#   bash bin/setup-hooks.sh
#
# Points git at the repo's .githooks/ directory so pre-commit runs the
# hash-check guard on every commit. Idempotent — safe to re-run.
#
# Why this is opt-in (not an npm `prepare` script):
#   `prepare` runs in every consumer install of skills4sh, including
#   downstream installs where setting core.hooksPath would be incorrect.
#   This is a contributor-only convenience; consumers should never
#   touch it.

set -euo pipefail

repo_root="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [ -z "$repo_root" ]; then
  echo "✗ Not inside a git repository — skipping hook wiring." >&2
  exit 1
fi

hooks_dir="$repo_root/.githooks"
if [ ! -d "$hooks_dir" ]; then
  echo "✗ Expected $hooks_dir to exist. Are you in the skills4sh repo?" >&2
  exit 1
fi

current="$(git -C "$repo_root" config --local --get core.hooksPath || true)"
if [ "$current" = ".githooks" ]; then
  echo "✓ core.hooksPath already set to .githooks — nothing to do."
  exit 0
fi

git -C "$repo_root" config --local core.hooksPath .githooks
echo "✓ Wired core.hooksPath → .githooks"
echo "  pre-commit will now run bin/hash-check.mjs on every commit."
