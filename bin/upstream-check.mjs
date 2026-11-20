#!/usr/bin/env node
// Compare the versions and links the skills pin with upstream.
//
// Usage:
//   upstream-check [--json] [--strict] [--no-links] [--report <file>] [--root <dir>]
//
// Reads .github/upstream-pins.json. For each pin it checks that the pinned
// version string still appears in every listed file (so the registry cannot
// drift from the skill text), then compares it with the package registry.
// It also checks that external links in skill prose and docs still resolve.
//
// Exit codes: 0 = ran (drift is reported, not failed), 1 = drift found and
// --strict was passed, 2 = usage or configuration error.
//
// Network failures never count as drift; they are listed as unverified. Links under a
// prefix listed in the pins file's "unverifiableLinks" are not requested at all: those
// hosts refuse automated clients, so a request could only ever report "unverified".
// This check is informational and is not part of the PR gates.

import { readFile, readdir, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const PINS_PATH = ".github/upstream-pins.json";
const LINK_ROOTS = ["skills", "docs"];
const REQUEST_TIMEOUT_MS = 15_000;
const LINK_CONCURRENCY = 6;
const USER_AGENT = "skills4sh-upstream-check";
const REGISTRIES = new Set(["npm", "pypi"]);

// Hosts that only ever appear as examples or local targets.
const SKIPPED_HOST_PATTERNS = [
  /^localhost$/,
  /^127\.0\.0\.1$/,
  /^0\.0\.0\.0$/,
  /^\[::1\]$/,
  /(^|\.)example\.(com|org|net)$/,
  /\.(test|localhost|example|invalid|local)$/,
];

// Full SemVer 2 precedence, including prerelease identifiers. Returns -1, 0
// or 1. Build metadata is ignored.
export function compareVersions(a, b) {
  const parse = (value) => {
    const [core, ...rest] = String(value).trim().replace(/^v/, "").split("+")[0].split("-");
    const numbers = core.split(".").map((part) => Number.parseInt(part, 10) || 0);
    const prerelease = rest.length > 0 ? rest.join("-").split(".") : [];
    return { numbers, prerelease };
  };
  const left = parse(a);
  const right = parse(b);
  for (let index = 0; index < Math.max(left.numbers.length, right.numbers.length, 3); index += 1) {
    const l = left.numbers[index] ?? 0;
    const r = right.numbers[index] ?? 0;
    if (l !== r) return l < r ? -1 : 1;
  }
  if (left.prerelease.length === 0 && right.prerelease.length === 0) return 0;
  if (left.prerelease.length === 0) return 1;
  if (right.prerelease.length === 0) return -1;
  for (let index = 0; index < Math.max(left.prerelease.length, right.prerelease.length); index += 1) {
    const l = left.prerelease[index];
    const r = right.prerelease[index];
    if (l === undefined) return -1;
    if (r === undefined) return 1;
    const lNumeric = /^\d+$/.test(l);
    const rNumeric = /^\d+$/.test(r);
    if (lNumeric && rNumeric) {
      const difference = Number(l) - Number(r);
      if (difference !== 0) return difference < 0 ? -1 : 1;
    } else if (lNumeric !== rNumeric) {
      return lNumeric ? -1 : 1;
    } else if (l !== r) {
      return l < r ? -1 : 1;
    }
  }
  return 0;
}

// Validates the parsed pins file. Returns { pins, errors }.
export function validatePins(document) {
  const errors = [];
  const pins = Array.isArray(document?.pins) ? document.pins : null;
  if (!pins) return { pins: [], errors: [`${PINS_PATH}: "pins" must be an array`] };
  const seen = new Set();
  pins.forEach((pin, index) => {
    const label = `${PINS_PATH}: pins[${index}]`;
    if (typeof pin?.name !== "string" || pin.name === "") errors.push(`${label}: "name" is required`);
    if (!REGISTRIES.has(pin?.registry)) errors.push(`${label}: "registry" must be one of ${[...REGISTRIES].join(", ")}`);
    if (typeof pin?.pinned !== "string" || pin.pinned === "") errors.push(`${label}: "pinned" is required`);
    if (pin?.tag !== undefined && typeof pin.tag !== "string") errors.push(`${label}: "tag" must be a string`);
    if (!Array.isArray(pin?.files) || pin.files.length === 0 || pin.files.some((file) => typeof file !== "string")) {
      errors.push(`${label}: "files" must list at least one path`);
    }
    const key = `${pin?.registry}:${pin?.name}:${pin?.tag ?? "latest"}`;
    if (seen.has(key)) errors.push(`${label}: duplicate pin for ${key}`);
    seen.add(key);
  });
  const unverifiable = document.unverifiableLinks ?? [];
  if (!Array.isArray(unverifiable)) {
    errors.push(`${PINS_PATH}: "unverifiableLinks" must be an array`);
  } else {
    unverifiable.forEach((entry, index) => {
      const label = `${PINS_PATH}: unverifiableLinks[${index}]`;
      if (typeof entry?.url !== "string" || !/^https?:\/\/[^/]+\/./.test(entry.url)) errors.push(`${label}: "url" must be an http(s) URL prefix with a path`);
      if (typeof entry?.reason !== "string" || entry.reason === "") errors.push(`${label}: "reason" is required`);
    });
  }
  return { pins, unverifiable: Array.isArray(unverifiable) ? unverifiable : [], errors };
}

// Returns the listed files that no longer contain the pinned version string.
export async function findFilesMissingPin(root, pin) {
  const missing = [];
  for (const file of pin.files) {
    let text;
    try {
      text = await readFile(join(root, file), "utf8");
    } catch {
      missing.push(`${file} (file not found)`);
      continue;
    }
    if (!text.includes(pin.pinned)) missing.push(file);
  }
  return missing;
}

function registryUrl(pin) {
  if (pin.registry === "npm") {
    return `https://registry.npmjs.org/-/package/${pin.name.replaceAll("/", "%2f")}/dist-tags`;
  }
  return `https://pypi.org/pypi/${encodeURIComponent(pin.name)}/json`;
}

async function fetchWithTimeout(fetchImpl, url, options = {}) {
  return fetchImpl(url, {
    ...options,
    headers: { "user-agent": USER_AGENT, ...(options.headers ?? {}) },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
}

// Resolves the upstream version a pin tracks. Returns { version } or { error }.
export async function fetchUpstreamVersion(pin, fetchImpl) {
  const tag = pin.tag ?? "latest";
  try {
    const response = await fetchWithTimeout(fetchImpl, registryUrl(pin), { headers: { accept: "application/json" } });
    if (!response.ok) return { error: `registry answered HTTP ${response.status}` };
    const body = await response.json();
    const version = pin.registry === "npm" ? body?.[tag] : body?.info?.version;
    if (typeof version !== "string" || version === "") {
      return { error: pin.registry === "npm" ? `no "${tag}" dist-tag` : "no version in registry response" };
    }
    return { version };
  } catch (error) {
    return { error: error?.name === "TimeoutError" ? "registry request timed out" : `registry request failed (${error?.message ?? error})` };
  }
}

// Classifies one pin as current, behind, ahead, out-of-sync or unverified.
export async function checkPin(root, pin, fetchImpl) {
  const base = { name: pin.name, registry: pin.registry, tag: pin.tag ?? "latest", pinned: pin.pinned, files: pin.files };
  const missing = await findFilesMissingPin(root, pin);
  if (missing.length > 0) return { ...base, status: "out-of-sync", missing };
  const upstream = await fetchUpstreamVersion(pin, fetchImpl);
  if (upstream.error) return { ...base, status: "unverified", reason: upstream.error };
  const order = compareVersions(pin.pinned, upstream.version);
  const status = order === 0 ? "current" : order < 0 ? "behind" : "ahead";
  return { ...base, status, upstream: upstream.version };
}

// Extracts external links from markdown prose. Fenced code blocks and inline
// code are skipped: URLs there are examples, not sources. So are bare origins
// such as `https://fonts.gstatic.com`, which name a host rather than a page.
export function extractLinks(markdown) {
  const prose = String(markdown)
    .replace(/^(```|~~~)[\s\S]*?^\1.*$/gm, "")
    .replace(/`[^`\n]*`/g, "");
  const links = new Set();
  for (const match of prose.matchAll(/https?:\/\/[^\s<>"'\]]+/g)) {
    let url = match[0];
    // A markdown link target ends at the first unbalanced ")".
    let depth = 0;
    for (let index = 0; index < url.length; index += 1) {
      if (url[index] === "(") depth += 1;
      else if (url[index] === ")") {
        if (depth === 0) {
          url = url.slice(0, index);
          break;
        }
        depth -= 1;
      }
    }
    url = url.replace(/[.,;:!?*_]+$/, "");
    if (isCheckableLink(url)) links.add(url);
  }
  return [...links];
}

function isCheckableLink(url) {
  if (/[{}$|\\^…]/.test(url)) return false;
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  // An origin with no path names a host (a CSP source, a service), not a document.
  if (parsed.pathname === "/" && parsed.search === "") return false;
  return !SKIPPED_HOST_PATTERNS.some((pattern) => pattern.test(parsed.hostname));
}

async function markdownFiles(directory) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    return [];
  }
  const files = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await markdownFiles(path)));
    else if (entry.isFile() && entry.name.endsWith(".md")) files.push(path);
  }
  return files;
}

// Maps each external link to the repo-relative files that cite it.
export async function collectLinks(root) {
  const sources = new Map();
  for (const linkRoot of LINK_ROOTS) {
    for (const file of await markdownFiles(join(root, linkRoot))) {
      for (const url of extractLinks(await readFile(file, "utf8"))) {
        if (!sources.has(url)) sources.set(url, []);
        sources.get(url).push(relative(root, file));
      }
    }
  }
  return sources;
}

// Classifies one link as ok, broken (404 or 410) or unverified.
export async function checkLink(url, fetchImpl) {
  const target = url.split("#")[0];
  const attempt = async (method) => {
    const response = await fetchWithTimeout(fetchImpl, target, { method, redirect: "follow" });
    // Only the status is needed; release the connection without reading the body.
    await response.body?.cancel?.();
    return response.status;
  };
  try {
    let status = await attempt("HEAD");
    // Many hosts reject or mis-answer HEAD; confirm anything unsuccessful with GET.
    if (status < 200 || status >= 300) status = await attempt("GET");
    if (status >= 200 && status < 300) return { status: "ok" };
    if (status === 404 || status === 410) return { status: "broken", reason: `HTTP ${status}` };
    return { status: "unverified", reason: `HTTP ${status}` };
  } catch (error) {
    return { status: "unverified", reason: error?.name === "TimeoutError" ? "timed out" : `request failed (${error?.cause?.code ?? error?.message ?? error})` };
  }
}

async function mapWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const index = next;
        next += 1;
        results[index] = await worker(items[index]);
      }
    }),
  );
  return results;
}

// Runs every check. Returns { pins, links, drift, errors }.
export async function runUpstreamCheck({ root, fetchImpl = fetch, links = true }) {
  let document;
  try {
    document = JSON.parse(await readFile(join(root, PINS_PATH), "utf8"));
  } catch (error) {
    return { pins: [], links: [], drift: false, errors: [`${PINS_PATH}: ${error.message}`] };
  }
  const { pins, unverifiable, errors } = validatePins(document);
  if (errors.length > 0) return { pins: [], links: [], drift: false, errors };

  const pinResults = [];
  for (const pin of pins) pinResults.push(await checkPin(root, pin, fetchImpl));

  let linkResults = [];
  if (links) {
    const sources = await collectLinks(root);
    const urls = [...sources.keys()].sort();
    const skipReason = (url) => unverifiable.find((entry) => url.startsWith(entry.url))?.reason;
    const outcomes = await mapWithConcurrency(urls, LINK_CONCURRENCY, (url) => {
      const reason = skipReason(url);
      return reason ? { status: "skipped", reason } : checkLink(url, fetchImpl);
    });
    linkResults = urls.map((url, index) => ({ url, files: sources.get(url), ...outcomes[index] }));
  }

  const drift =
    pinResults.some((pin) => pin.status === "behind" || pin.status === "out-of-sync") ||
    linkResults.some((link) => link.status === "broken");
  return { pins: pinResults, links: linkResults, drift, errors: [] };
}

// Renders the result as markdown, for the terminal and for the tracking issue.
export function formatReport(result, date = new Date().toISOString().slice(0, 10)) {
  const lines = [`Checked ${date} by \`bin/upstream-check.mjs\`.`, ""];
  const behind = result.pins.filter((pin) => pin.status === "behind");
  const outOfSync = result.pins.filter((pin) => pin.status === "out-of-sync");
  const broken = result.links.filter((link) => link.status === "broken");
  const unverified = [
    ...result.pins.filter((pin) => pin.status === "unverified").map((pin) => `\`${pin.name}\` — ${pin.reason}`),
    ...result.links.filter((link) => link.status === "unverified").map((link) => `${link.url} — ${link.reason}`),
  ];

  if (!result.drift) lines.push("No drift: every pinned version matches upstream and every checked link resolves.", "");

  if (behind.length > 0) {
    lines.push("## Pinned versions behind upstream", "", "| Package | Tracks | Pinned | Upstream | Files |", "|---|---|---|---|---|");
    for (const pin of behind) {
      lines.push(`| \`${pin.name}\` | ${pin.registry} \`${pin.tag}\` | ${pin.pinned} | ${pin.upstream} | ${pin.files.map((file) => `\`${file}\``).join(", ")} |`);
    }
    lines.push("");
  }
  if (outOfSync.length > 0) {
    lines.push(`## Pins that no longer match the files`, "", `Update \`${PINS_PATH}\` or the files so they agree.`, "", "| Package | Pinned | Not found in |", "|---|---|---|");
    for (const pin of outOfSync) {
      lines.push(`| \`${pin.name}\` | ${pin.pinned} | ${pin.missing.map((file) => `\`${file}\``).join(", ")} |`);
    }
    lines.push("");
  }
  if (broken.length > 0) {
    lines.push("## Broken links", "", "| Link | Result | Cited in |", "|---|---|---|");
    for (const link of broken) {
      lines.push(`| ${link.url} | ${link.reason} | ${link.files.map((file) => `\`${file}\``).join(", ")} |`);
    }
    lines.push("");
  }
  if (unverified.length > 0) {
    lines.push("## Could not verify", "", "Not counted as drift.", "", ...unverified.map((entry) => `- ${entry}`), "");
  }

  const current = result.pins.filter((pin) => pin.status === "current" || pin.status === "ahead").length;
  const ok = result.links.filter((link) => link.status === "ok").length;
  const skipped = result.links.filter((link) => link.status === "skipped").length;
  const checked = result.links.length - skipped;
  const skippedNote = skipped > 0 ? `; ${skipped} not checked (host refuses automated clients)` : "";
  lines.push(`${current} of ${result.pins.length} pins current; ${ok} of ${checked} links resolve${skippedNote}.`);
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  const options = { json: false, strict: false, links: true, report: null, root: process.cwd() };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--json") options.json = true;
    else if (arg === "--strict") options.strict = true;
    else if (arg === "--no-links") options.links = false;
    else if (arg === "--report" || arg === "--root") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) return { error: `${arg} requires a path` };
      options[arg.slice(2)] = value;
      index += 1;
    } else if (arg === "--help" || arg === "-h") options.help = true;
    else return { error: `unknown argument: ${arg}` };
  }
  return { options };
}

const USAGE = "Usage: upstream-check [--json] [--strict] [--no-links] [--report <file>] [--root <dir>]";

async function main() {
  const { options, error } = parseArgs(process.argv.slice(2));
  if (error) {
    console.error(`✗ ${error}\n${USAGE}`);
    return 2;
  }
  if (options.help) {
    console.log(USAGE);
    return 0;
  }
  const result = await runUpstreamCheck({ root: options.root, links: options.links });
  if (result.errors.length > 0) {
    for (const message of result.errors) console.error(`✗ ${message}`);
    return 2;
  }
  const report = formatReport(result);
  if (options.report) await writeFile(options.report, report);
  process.stdout.write(options.json ? `${JSON.stringify(result, null, 2)}\n` : report);
  return result.drift && options.strict ? 1 : 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = await main();
}
