## Summary

<!-- 1-3 bullet points describing the change -->

## OWASP AST10 Security Checklist

Complete this checklist for any PR that modifies files under `skills/`:

### Permissions (AST03)
- [ ] `alwaysAllow` in SKILL.md lists only the minimum required permissions
- [ ] Every permission has a rationale in `metadata.permissions_rationale`
- [ ] No new `Bash` or `Write` permissions added without justification

### Integrity (AST01/AST02)
- [ ] `skills-lock.json` updated with new SHA-256 hashes for all changed files
- [ ] Content hashes in `.security/<name>.yaml` updated to match
- [ ] `.security/<name>.yaml` updated with new hashes
- [ ] Version bumped in SKILL.md, skills-lock.json, and `.security/<name>.yaml` if behavior changed

### Metadata (AST04)
- [ ] SKILL.md `name` matches directory name
- [ ] `metadata.repository` points to this repo
- [ ] No misleading descriptions or impersonation of other tools

### Isolation (AST06)
- [ ] `metadata.execution_context` accurately reflects network and filesystem needs
- [ ] No new network access beyond what's documented
- [ ] Install scripts restricted to `.claude/skills/` destination paths

### Scanning (AST08)
- [ ] `npx guardskills add t4sh/skills4sh --skill <name> --dry-run` passes
- [ ] Any new expected findings documented in SECURITY.md

### Governance (AST09)
- [ ] SECURITY.md updated if supported versions changed
- [ ] Breaking changes noted in PR description

## Test Plan

<!-- How was this tested? -->
