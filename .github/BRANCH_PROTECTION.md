# Branch Protection Contract

Protect `main` and require pull requests to pass these **15 checks** before merge:

- `Validate Skills / validate (22)`
- `Validate Skills / validate (24)`
- `guardskills Scan / scan (agent-memory, 22)`
- `guardskills Scan / scan (agent-memory, 24)`
- `guardskills Scan / scan (discord-harvest, 22)`
- `guardskills Scan / scan (discord-harvest, 24)`
- `guardskills Scan / scan (eleventy-nunjucks, 22)`
- `guardskills Scan / scan (eleventy-nunjucks, 24)`
- `guardskills Scan / scan (localhost-screenshots, 22)`
- `guardskills Scan / scan (localhost-screenshots, 24)`
- `Release Guards / bin/ matches tag for current package.json version`
- `CodeQL / Analyze (actions)`
- `CodeQL / Analyze (javascript-typescript)`
- `Dependency review / dependency-review`
- `Branch Protection Drift / assert protection matches .github/branch-protection.expected.json`

The validate job includes installer tests, drift checks, content-hash checks, and the npm package payload guard. The release guard includes the bin/tag parity check and npm pack smoke test. The branch-protection-drift check asserts that the live config on `refs/heads/main` matches the checked-in snapshot at `.github/branch-protection.expected.json` — making the required-checks list itself self-verifying.

Additional policies enforced on `refs/heads/main`:

- **Signed commits required** (`required_signatures: true`) — every commit pushed to main must be GitHub-verified (SSH or GPG).
- **Linear history required** (`required_linear_history: true`) — no merge commits.
- **Conversation resolution required** before merge.
- **No force pushes, no deletions, no fork-syncing.**
- **Admin bypass disabled** (`enforce_admins: true` since v0.4.6) — administrators are also subject to all configured branch protection rules. No admin escape hatch for force-push, deletion, or check-bypass. **Practical consequence: direct push to `main` from admin is rejected** with `protected branch hook declined` because the pushed commit hasn't satisfied the 15 required status checks yet (chicken-and-egg with direct push). Use PR flow.

The full snapshot lives at `.github/branch-protection.expected.json` and is the source of truth.

## Recovery — if branch protection locks you out

If a future change breaks a required check workflow (renames a check, introduces a fatal CI bug, or otherwise creates a state where no PR can merge), the maintainer can't fix it via direct push because `enforce_admins: true`. The escape hatch:

```bash
# Temporarily disable admin enforcement (admin-only, no other gate)
gh api -X DELETE /repos/t4sh/skills4sh/branches/main/protection/enforce_admins

# Push the fix directly
git push origin main

# Re-enable
gh api -X POST  /repos/t4sh/skills4sh/branches/main/protection/enforce_admins \
  -H "Accept: application/vnd.github+json"

# Verify
gh api /repos/t4sh/skills4sh/branches/main/protection/enforce_admins --jq '.enabled'  # → true
```

Each toggle is one API call and visible in the repo audit log. The window of admin bypass should be measured in seconds, not minutes. If recovery requires multiple rounds, that itself is a signal that the broken check needs more careful work via a PR (in which case, leave enforce_admins disabled until the PR is verified to be the actual fix).

Same pattern applies if you ever need to retire / replace a required check entirely:
1. Disable `enforce_admins` temporarily
2. Update the required-checks list via UI or `gh api PATCH .../protection/required_status_checks`
3. Update `.github/branch-protection.expected.json` snapshot to match
4. Commit and push the snapshot via direct push (now allowed)
5. Re-enable `enforce_admins`

Publishing is allowed only from an annotated signed `vX.Y.Z` tag that points at the workflow checkout commit. `npm-publish.yml` verifies the tag before publish and verifies npm registry metadata after publish, including `_hasShrinkwrap`, `gitHead`, and provenance attestation.
