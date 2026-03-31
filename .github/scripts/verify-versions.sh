#!/usr/bin/env bash
# Verify that versions in SKILL.md match skills-lock.json.
# Used by CI (validate.yml) to enforce AST07 update drift controls.
set -euo pipefail

LOCK_FILE="skills-lock.json"
errors=0

for dir in skills/*/; do
  name=$(basename "$dir")
  echo "Checking version consistency for $name..."

  # Extract version from SKILL.md frontmatter
  skill_version=$(sed -n '/^---$/,/^---$/p' "$dir/SKILL.md" | grep 'version:' | head -1 | sed 's/.*version: *"\{0,1\}//' | sed 's/"\{0,1\} *$//')

  # Extract version from skills-lock.json
  lock_version=$(python3 -c "import json; d=json.load(open('$LOCK_FILE')); print(d['skills']['$name'].get('version',''))" 2>/dev/null)

  if [ -n "$lock_version" ] && [ "$skill_version" != "$lock_version" ]; then
    echo "  ERROR: Version mismatch — SKILL.md=$skill_version, skills-lock.json=$lock_version"
    errors=$((errors + 1))
  else
    echo "  OK ($skill_version)"
  fi
done

if [ "$errors" -gt 0 ]; then
  echo ""
  echo "Version mismatch in $errors skill(s). Update skills-lock.json to match SKILL.md versions."
  exit 1
fi
