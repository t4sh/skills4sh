# Branch Protection Contract

Protect `main` and require pull requests to pass these checks before merge:

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

The validate job includes installer tests, drift checks, content-hash checks, and the npm package payload guard. The release guard includes the bin/tag parity check and npm pack smoke test.

Publishing is allowed only from an annotated signed `vX.Y.Z` tag that points at the workflow checkout commit. `npm-publish.yml` verifies the tag before publish and verifies npm registry metadata after publish, including `_hasShrinkwrap`, `gitHead`, and provenance attestation.
