#!/usr/bin/env bash
# Verify that versions in SKILL.md match skills-lock.json, README.md, and SECURITY.md.
# Used by CI (validate.yml) to enforce AST07 update drift controls.
set -euo pipefail

LOCK_FILE="skills-lock.json"
README="README.md"
SECURITY="SECURITY.md"
errors=0

for dir in skills/*/; do
  name=$(basename "$dir")
  echo "Checking version consistency for $name..."
  skill_errors=0

  # Extract version from SKILL.md frontmatter (source of truth)
  skill_version=$(sed -n '/^---$/,/^---$/p' "$dir/SKILL.md" | grep 'version:' | head -1 | sed 's/.*version: *"\{0,1\}//' | sed 's/"\{0,1\} *$//')

  if [ -z "$skill_version" ]; then
    echo "  ERROR: No version found in SKILL.md frontmatter"
    skill_errors=$((skill_errors + 1))
  else
    # Check skills-lock.json
    lock_version=$(python3 -c "import json; d=json.load(open('$LOCK_FILE')); print(d['skills']['$name'].get('version',''))" 2>/dev/null)
    if [ -z "$lock_version" ]; then
      echo "  ERROR: No version field in $LOCK_FILE for $name"
      skill_errors=$((skill_errors + 1))
    elif [ "$skill_version" != "$lock_version" ]; then
      echo "  ERROR: $LOCK_FILE version mismatch — SKILL.md=$skill_version, $LOCK_FILE=$lock_version"
      skill_errors=$((skill_errors + 1))
    fi

    # Check .security/<name>.yaml
    security_file=".security/$name.yaml"
    if [ -f "$security_file" ]; then
      sec_version=$(grep '  version:' "$security_file" | head -1 | sed 's/.*version: *"\{0,1\}//' | sed 's/"\{0,1\} *$//')
      if [ -n "$sec_version" ] && [ "$skill_version" != "$sec_version" ]; then
        echo "  ERROR: $security_file version mismatch — SKILL.md=$skill_version, security=$sec_version"
        skill_errors=$((skill_errors + 1))
      fi
    fi

    # Check README.md version table (format: "| ... | version |")
    if [ -f "$README" ]; then
      readme_version=$(grep "$name" "$README" | grep '|' | sed 's/.*| *\([0-9][0-9.]*\) *|.*/\1/' | head -1)
      if [ -n "$readme_version" ] && [ "$skill_version" != "$readme_version" ]; then
        echo "  ERROR: $README version mismatch — SKILL.md=$skill_version, README=$readme_version"
        skill_errors=$((skill_errors + 1))
      fi
    fi

    # Check SECURITY.md version table (format: "| skill | version | Supported |")
    if [ -f "$SECURITY" ]; then
      sec_doc_version=$(grep "$name" "$SECURITY" | grep '|' | head -1 | sed 's/.*| *\([0-9][0-9.]*\) *|.*/\1/')
      if [ -n "$sec_doc_version" ] && [ "$skill_version" != "$sec_doc_version" ]; then
        echo "  ERROR: $SECURITY version mismatch — SKILL.md=$skill_version, SECURITY.md=$sec_doc_version"
        skill_errors=$((skill_errors + 1))
      fi
    fi
  fi

  errors=$((errors + skill_errors))
  if [ "$skill_errors" -eq 0 ]; then
    echo "  OK ($skill_version)"
  fi
done

if [ "$errors" -gt 0 ]; then
  echo ""
  echo "Version mismatch in $errors location(s). SKILL.md frontmatter is the source of truth."
  echo "Update skills-lock.json, .security/<name>.yaml, README.md, and SECURITY.md to match."
  exit 1
fi
