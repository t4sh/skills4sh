// Raised when the registry has accepted a publish but is not serving the
// version yet. Distinct from a metadata defect so the caller can retry one
// and fail fast on the other.
export class VersionNotVisibleError extends Error {
  constructor(message) {
    super(message);
    this.name = "VersionNotVisibleError";
  }
}

// npm surfaces a version that is still being processed as E404
// "No match found for version X". Only that class is retryable; network,
// package-name, and metadata failures must fail immediately instead of burning
// the propagation budget and masking the real problem.
//
// npm answers E404 both for "this version is not being served yet" and for
// "you may not see this package", and the two are not distinguishable from the
// message alone, so a permission problem retries and then fails with the real
// error rather than failing fast.
const NOT_VISIBLE_PATTERNS = [
  /\bE404\b/,
  /No match found for version/i,
];

export function isVersionNotVisible(error) {
  if (error instanceof VersionNotVisibleError) return true;
  const text = String(error?.message ?? error ?? "");
  return NOT_VISIBLE_PATTERNS.some((pattern) => pattern.test(text));
}

// The packument is served with `cache-control: public, max-age=300`, so it can
// lag a publish by minutes. npm's per-package dist-tags endpoint is the
// authoritative, cache-independent read for "did `latest` move to the version
// we just published?".
export function distTagsUrl(name) {
  return `https://registry.npmjs.org/-/package/${encodeURIComponent(name)}/dist-tags`;
}

export async function fetchDistTags(name, fetchImpl = fetch) {
  const response = await fetchImpl(distTagsUrl(name), {
    cache: "no-store",
    headers: { "cache-control": "no-cache", pragma: "no-cache" },
  });
  if (!response.ok) {
    throw new Error(`dist-tags request for ${name} failed: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

// A dist-tag that has not caught up is a visibility lag, not a defect.
export function assertLatestDistTag(distTags, version) {
  if (distTags?.latest !== version) {
    throw new VersionNotVisibleError(
      `npm dist-tags latest is ${distTags?.latest ?? "(none)"}, expected ${version}`,
    );
  }
}

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
