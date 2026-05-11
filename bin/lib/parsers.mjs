// Pure parsers + validators used by bin/drift-check.mjs and
// bin/guardskills-check.mjs. Kept dependency-free and side-effect-free so
// tests can import them without triggering the CLI scripts.
//
// The .security/<name>.yaml schema is small and stable; rather than pull in
// js-yaml + ajv (two additional supply-chain surfaces), we hand-roll the
// parsers and validators. Each function takes the raw text and returns a
// plain object plus, where useful, an array of validation errors.

// Strips surrounding quotes (single or double) from a YAML scalar value.
export function stripQuotes(value) {
  return String(value).trim().replace(/^["']|["']$/g, "");
}

// Returns true iff two ordered arrays have equal length and element-wise
// equal contents. Used for inventory comparisons.
export function listEqual(a, b) {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

// Returns -1, 0, or 1 for major.minor.patch comparison. Pre-release suffixes
// (e.g. "1.2.0-rc.1") are stripped — we only care about backwards numeric
// drift, not full SemVer 2 ordering.
export function compareSemver(a, b) {
  const parse = (v) => String(v).split("-")[0].split(".").map((n) => Number.parseInt(n, 10) || 0);
  const [aMa, aMi, aPa] = parse(a);
  const [bMa, bMi, bPa] = parse(b);
  if (aMa !== bMa) return aMa < bMa ? -1 : 1;
  if (aMi !== bMi) return aMi < bMi ? -1 : 1;
  if (aPa !== bPa) return aPa < bPa ? -1 : 1;
  return 0;
}

// Parses SKILL.md YAML frontmatter into a flat object. Looks for top-level
// keys and the nested `metadata.version` key, which is the only nested key
// drift-check needs. Returns {} if no frontmatter block is found.
export function parseSkillFrontmatter(markdown) {
  const block = markdown.match(/^---\n([\s\S]*?)\n---/);
  if (!block) return {};
  const out = {};
  let inMetadata = false;
  for (const line of block[1].split("\n")) {
    if (/^metadata:\s*$/.test(line)) {
      inMetadata = true;
      continue;
    }
    if (/^\S/.test(line)) inMetadata = false;
    const top = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (top) out[top[1]] = stripQuotes(top[2]);
    const version = inMetadata && line.match(/^\s+version:\s*(.*)$/);
    if (version) out.version = stripQuotes(version[1]);
  }
  return out;
}

// Parses .security/<name>.yaml into { name, version, files }. Permissive
// extraction — validation is in validateSecurityManifest() below.
export function parseSecurityManifest(text) {
  const out = { files: {} };
  const name = text.match(/^  name:\s*(.+)$/m);
  const version = text.match(/^  version:\s*"?([^"\n]+)"?$/m);
  if (name) out.name = stripQuotes(name[1]);
  if (version) out.version = stripQuotes(version[1]);

  const lines = text.split("\n");
  let inFiles = false;
  for (const line of lines) {
    if (/^  files:\s*$/.test(line)) {
      inFiles = true;
      continue;
    }
    if (inFiles && /^\S/.test(line)) break;
    if (!inFiles) continue;
    const match = line.match(/^    ([^:]+):\s*([a-f0-9]{64})\s*$/);
    if (match) out.files[match[1]] = match[2];
  }
  return out;
}

// Hand-rolled schema validator for .security/<name>.yaml. Returns an array
// of error strings; empty array means the manifest passes. Validates required
// keys (skill.{name,version,license,author,repository,path},
// integrity.{hash_algorithm,files}, permissions.{alwaysAllow,rationale},
// execution_context.{sandbox,network,filesystem,shell,risk_tier}), enum
// constraints (risk_tier in {low,medium,high,critical}; network in known
// values), and that integrity.files has at least one entry including SKILL.md.
const VALID_RISK_TIERS = new Set(["low", "medium", "high", "critical"]);
const VALID_NETWORK = new Set(["none", "outbound-only", "localhost-only", "inbound-only", "bidirectional"]);
const VALID_FS = new Set(["none", "read-only", "read-write"]);
const VALID_SHELL = new Set(["none", "limited", "unrestricted"]);

export function validateSecurityManifest(text, skillName) {
  const errors = [];
  const has = (re, name) => {
    if (!re.test(text)) errors.push(`${skillName}: .security manifest missing required field ${name}`);
  };
  const match = (re, name, validSet) => {
    const m = text.match(re);
    if (!m) {
      errors.push(`${skillName}: .security manifest missing required field ${name}`);
      return;
    }
    const value = stripQuotes(m[1]);
    if (validSet && !validSet.has(value)) {
      errors.push(`${skillName}: .security manifest ${name}=${JSON.stringify(value)} not in {${[...validSet].join(", ")}}`);
    }
  };

  has(/^skill:\s*$/m, "skill block");
  has(/^  name:\s*\S/m, "skill.name");
  has(/^  version:\s*\S/m, "skill.version");
  has(/^  license:\s*\S/m, "skill.license");
  has(/^  author:\s*\S/m, "skill.author");
  has(/^  repository:\s*\S/m, "skill.repository");
  has(/^  path:\s*\S/m, "skill.path");

  has(/^integrity:\s*$/m, "integrity block");
  has(/^  hash_algorithm:\s*sha256\s*$/m, "integrity.hash_algorithm: sha256");
  has(/^  files:\s*$/m, "integrity.files block");

  has(/^permissions:\s*$/m, "permissions block");
  has(/^  alwaysAllow:\s*\[/m, "permissions.alwaysAllow (must be an array)");
  has(/^  rationale:\s*\S/m, "permissions.rationale");

  has(/^execution_context:\s*$/m, "execution_context block");
  match(/^  sandbox:\s*(\S+)$/m, "execution_context.sandbox");
  match(/^  network:\s*(\S+)$/m, "execution_context.network", VALID_NETWORK);
  match(/^  filesystem:\s*(\S+)$/m, "execution_context.filesystem", VALID_FS);
  match(/^  shell:\s*(\S+)$/m, "execution_context.shell", VALID_SHELL);
  match(/^  risk_tier:\s*(\S+)$/m, "execution_context.risk_tier", VALID_RISK_TIERS);

  // integrity.files must contain at least SKILL.md.
  const m = parseSecurityManifest(text);
  if (!m.files["SKILL.md"]) {
    errors.push(`${skillName}: .security manifest integrity.files missing SKILL.md hash`);
  }

  return errors;
}

// Parses expected_findings from a .security/<name>.yaml. Returns array of
// { id, file, severity, acknowledged }. Severity is normalized to uppercase.
export function parseExpectedFindings(text) {
  const out = [];
  let current = null;
  for (const line of text.split("\n")) {
    const id = line.match(/^\s+- id:\s*(\S+)\s*$/);
    if (id) {
      current = { id: id[1] };
      out.push(current);
      continue;
    }
    if (!current) continue;
    const file = line.match(/^\s+file:\s*(\S+)\s*$/);
    if (file) current.file = file[1];
    const severity = line.match(/^\s+severity:\s*(\S+)\s*$/);
    if (severity) current.severity = severity[1].toUpperCase();
    const acknowledged = line.match(/^\s+acknowledged:\s*(true|false)\s*$/);
    if (acknowledged) current.acknowledged = acknowledged[1] === "true";
  }
  return out.filter((finding) => finding.id && finding.file);
}

// guardskills' BLOCKING_SEVERITIES policy — any actual finding at this
// level requires acknowledged: true on the matching expected entry.
export const BLOCKING_SEVERITIES = new Set(["HIGH", "CRITICAL"]);

// Returns array of findings that violate the severity floor: actual finding
// is HIGH/CRITICAL, but the matching expected entry is missing or lacks
// acknowledged: true. Returns [] when policy is satisfied.
export function findUnacknowledgedBlocking(actualFindings, expectedFindings) {
  return actualFindings.filter((finding) => {
    if (!BLOCKING_SEVERITIES.has(finding.severity)) return false;
    const match = expectedFindings.find((item) => item.id === finding.id && item.file === finding.file);
    return !match || match.acknowledged !== true;
  });
}
