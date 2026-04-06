#!/usr/bin/env bash
# Verify that file hashes in skills-lock.json match files on disk.
# Used by CI (validate.yml) to enforce AST01/AST02 integrity.
set -euo pipefail

LOCK_FILE="skills-lock.json"
errors=0

for dir in skills/*/; do
  name=$(basename "$dir")
  echo "Verifying hashes for $name..."

  # Check skills-lock.json has this skill
  if ! python3 -c "import json,sys; d=json.load(open('$LOCK_FILE')); sys.exit(0 if '$name' in d['skills'] else 1)" 2>/dev/null; then
    echo "  ERROR: $name not found in $LOCK_FILE"
    errors=$((errors + 1))
    continue
  fi

  # Extract file list and expected hashes, then verify each
  python3 << PYEOF
import json, hashlib, sys, os

with open("$LOCK_FILE") as f:
    lock = json.load(f)

skill = lock["skills"]["$name"]
skill_dir = "skills/$name"
ok = True

for relpath, expected_hash in skill.get("files", {}).items():
    filepath = os.path.join(skill_dir, relpath)
    if not os.path.exists(filepath):
        print(f"  ERROR: {relpath} listed in lock but missing from disk")
        ok = False
        continue
    with open(filepath, "rb") as fh:
        actual = hashlib.sha256(fh.read()).hexdigest()
    if actual != expected_hash:
        print(f"  ERROR: {relpath} hash mismatch")
        print(f"    expected: {expected_hash}")
        print(f"    actual:   {actual}")
        ok = False

if ok:
    print("  OK")
else:
    sys.exit(1)
PYEOF

  if [ $? -ne 0 ]; then
    errors=$((errors + 1))
  fi
done

if [ "$errors" -gt 0 ]; then
  echo ""
  echo "Hash verification failed for $errors skill(s)"
  echo "Run: shasum -a 256 skills/<skill>/<file> to get current hashes"
  echo "Then update skills-lock.json and .security/<name>.yaml"
  exit 1
fi
