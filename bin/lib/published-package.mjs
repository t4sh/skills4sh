// npm 12 view --json returns an array; npm 11 returns a single object here.
export function validatePublishedMetadata(data, pkg, expectedGitHead) {
  const view = Array.isArray(data) && data.length === 1 ? data[0] : data;
  if (!view || Array.isArray(view) || view.name !== pkg.name || view.version !== pkg.version) {
    throw new Error(`npm view must return exactly ${pkg.name}@${pkg.version}`);
  }
  const bundled = view.bundleDependencies ?? view.bundledDependencies;
  if (!Array.isArray(bundled) || !bundled.includes("undici")
    || view.optionalDependencies?.undici !== pkg.optionalDependencies.undici) {
    throw new Error(`${pkg.name}@${pkg.version} registry metadata must declare the pinned undici bundle`);
  }
  if (view.gitHead !== expectedGitHead) {
    throw new Error(`${pkg.name}@${pkg.version} gitHead mismatch: expected ${expectedGitHead}, got ${view.gitHead}`);
  }
  if (!view.dist?.attestations?.provenance) {
    throw new Error(`${pkg.name}@${pkg.version} is missing npm provenance attestation metadata`);
  }
}
