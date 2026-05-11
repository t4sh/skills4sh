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
- **Admin bypass enabled** (`enforce_admins: false`) — accepted residual risk for single-maintainer governance; flagged in `SECURITY.md`.

The full snapshot lives at `.github/branch-protection.expected.json` and is the source of truth.

Publishing is allowed only from an annotated signed `vX.Y.Z` tag that points at the workflow checkout commit. `npm-publish.yml` verifies the tag before publish and verifies npm registry metadata after publish, including `_hasShrinkwrap`, `gitHead`, and provenance attestation.
