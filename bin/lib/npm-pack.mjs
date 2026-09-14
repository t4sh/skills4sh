// Normalize npm pack --json output for the package gate and install smoke test.
export function parsePackJson(stdout, label) {
  let parsed;
  try {
    parsed = JSON.parse(stdout);
  } catch (err) {
    throw new Error(`${label} did not emit JSON: ${err.message}`);
  }
  const entries = parsed && typeof parsed === "object" ? Object.entries(parsed) : [];
  const record = entries.length === 1 ? entries[0][1] : null;
  // npm <=11 emits [record]; npm 12 emits { [packageName]: record }.
  if (!record || typeof record !== "object" || Array.isArray(record)
    || typeof record.name !== "string" || !record.name
    || (!Array.isArray(parsed) && entries[0][0] !== record.name)
    || typeof record.filename !== "string" || !record.filename
    || !Array.isArray(record.files)
    || record.files.some((file) => !file || typeof file.path !== "string" || !file.path)) {
    throw new Error(`${label} returned unexpected JSON shape`);
  }
  return record;
}
