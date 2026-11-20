#!/usr/bin/env node
// check-memory.mjs — read-only consistency check for an `.agent-memory/` directory.
//
// Zero dependencies, Node.js 22+. This script only reads: it never writes,
// renames, or deletes a file, never follows a symbolic link below the path it
// is given, and makes no network call. It reads `index.yaml` and the frontmatter of memory files with
// a parser for the small YAML subset the agent-memory templates use. YAML
// outside that subset is reported as unreadable instead of being guessed at.
//
// Exit codes: 0 = no errors (review items may be listed), 1 = errors found,
// 2 = usage error.

import { lstatSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import process from "node:process";

const MEMORY_DIR = ".agent-memory";
const INDEX_FILE = "index.yaml";
const TYPE_TO_DIR = {
  user: "user",
  feedback: "feedback",
  project: "project",
  decision: "decisions",
  context: "context",
  convention: "conventions",
  reference: "references",
  session: "sessions",
};
const DIR_TO_TYPE = Object.fromEntries(Object.entries(TYPE_TO_DIR).map(([type, dir]) => [dir, type]));
const STATUSES = ["active", "archived"];
const REQUIRED_FRONTMATTER = ["id", "type", "title", "description", "tags", "source", "created", "updated", "status"];
const REQUIRED_INDEX = ["id", "type", "title", "status"];
const COMPARED_FIELDS = ["type", "title", "status"];
const SINGLE_VALUE_FIELDS = ["id", "type", "title", "status", "source", "created", "updated", "expires", "supersedes"];
const DATE_FIELDS = ["created", "updated", "expires"];

const HELP = `Usage: node check-memory.mjs [path] [--json] [--today YYYY-MM-DD]

Read-only check of an agent-memory directory. It changes nothing.

Arguments:
  path                 Project root that contains ${MEMORY_DIR}/, or the
                       ${MEMORY_DIR}/ directory itself. Default: current directory.

Options:
  --json               Print one JSON object instead of text.
  --today YYYY-MM-DD   Date used to decide whether "expires" has passed.
                       Default: today's local date.
  -h, --help           Show this help.

Errors (exit 1):
  index.yaml missing or not the documented sequence; memory file without an
  index entry; index entry without a file; missing frontmatter or required
  field; id that does not match the path; type that does not match the
  directory; status other than active or archived; index type, title, or
  status that differs from the file; date that is not a valid YYYY-MM-DD.

Review items (do not change the exit code):
  "expires" in the past on an active file; a file that another file
  supersedes but that is still active; files outside the type directories;
  symbolic links, which are not followed.

Exit codes: 0 no errors, 1 errors found, 2 usage error.
`;

class YamlSubsetError extends Error {
  constructor(line, reason) {
    super(`line ${line}: ${reason}`);
    this.line = line;
  }
}

// ---------- YAML subset ----------

function toLines(text, firstLineNumber = 1) {
  return text.split("\n").map((raw, offset) => {
    const number = firstLineNumber + offset;
    const lead = /^[ \t]*/.exec(raw)[0];
    const text_ = raw.slice(lead.length).trimEnd();
    return {
      number,
      raw,
      indent: lead.length,
      tabIndent: lead.includes("\t"),
      text: text_,
      skip: text_ === "" || text_.startsWith("#"),
    };
  });
}

function normalize(text) {
  return text.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
}

function requireSpaces(line) {
  if (line.tabIndent) throw new YamlSubsetError(line.number, "tab used for indentation");
}

// Returns the text after a closing quote, which may only be blank or a comment.
function requireOnlyComment(rest, lineNumber) {
  const tail = rest.trim();
  if (tail !== "" && !/^#/.test(tail)) {
    throw new YamlSubsetError(lineNumber, `unexpected text after quoted value: ${tail}`);
  }
}

function parseDoubleQuoted(text, lineNumber) {
  let end = -1;
  for (let i = 1; i < text.length; i += 1) {
    if (text[i] === "\\") { i += 1; continue; }
    if (text[i] === '"') { end = i; break; }
  }
  if (end === -1) throw new YamlSubsetError(lineNumber, "double-quoted value is not closed on the same line");
  let value;
  try {
    value = JSON.parse(text.slice(0, end + 1));
  } catch {
    throw new YamlSubsetError(lineNumber, "double-quoted value uses an escape this checker does not support");
  }
  return { value, rest: text.slice(end + 1) };
}

function parseSingleQuoted(text, lineNumber) {
  let value = "";
  for (let i = 1; i < text.length; i += 1) {
    if (text[i] !== "'") { value += text[i]; continue; }
    if (text[i + 1] === "'") { value += "'"; i += 1; continue; }
    return { value, rest: text.slice(i + 1) };
  }
  throw new YamlSubsetError(lineNumber, "single-quoted value is not closed on the same line");
}

function parsePlain(text, lineNumber, { inFlow = false } = {}) {
  const commentAt = text.search(/\s#/);
  const value = (commentAt === -1 ? text : text.slice(0, commentAt)).trim();
  if (value === "") return null;
  if (/^[&*!|>%@`{}\[\]?,]/.test(value) || value === "-" || /^[-?:]\s/.test(value)) {
    throw new YamlSubsetError(lineNumber, `unsupported YAML syntax: ${value}`);
  }
  if (/:\s/.test(value) || value.endsWith(":")) {
    throw new YamlSubsetError(lineNumber, `unquoted value contains a colon followed by a space or line end; quote it: ${value}`);
  }
  if (inFlow && /[\[\]{}]/.test(value)) {
    throw new YamlSubsetError(lineNumber, `nested flow collections are not supported: ${value}`);
  }
  if (value === "~" || /^null$/i.test(value)) return null;
  return value;
}

// One scalar on one line: plain, "double-quoted", or 'single-quoted'.
function parseInlineScalar(text, lineNumber) {
  const trimmed = text.trim();
  if (trimmed.startsWith('"')) {
    const { value, rest } = parseDoubleQuoted(trimmed, lineNumber);
    requireOnlyComment(rest, lineNumber);
    return value;
  }
  if (trimmed.startsWith("'")) {
    const { value, rest } = parseSingleQuoted(trimmed, lineNumber);
    requireOnlyComment(rest, lineNumber);
    return value;
  }
  return parsePlain(trimmed, lineNumber);
}

// `[a, "b", 'c']` on one line. Items are scalars only.
function parseFlowSequence(text, lineNumber) {
  const items = [];
  let i = 1;
  let expectItem = true;
  for (;;) {
    while (text[i] === " ") i += 1;
    if (i >= text.length) throw new YamlSubsetError(lineNumber, "flow sequence is not closed on the same line");
    const ch = text[i];
    if (ch === "]") {
      requireOnlyComment(text.slice(i + 1), lineNumber);
      return items;
    }
    if (ch === ",") {
      if (expectItem) throw new YamlSubsetError(lineNumber, "empty item in flow sequence");
      expectItem = true;
      i += 1;
      continue;
    }
    if (!expectItem) throw new YamlSubsetError(lineNumber, "missing comma in flow sequence");
    if (ch === '"' || ch === "'") {
      const parsed = ch === '"' ? parseDoubleQuoted(text.slice(i), lineNumber) : parseSingleQuoted(text.slice(i), lineNumber);
      items.push(parsed.value);
      i = text.length - parsed.rest.length;
    } else {
      let end = i;
      while (end < text.length && text[end] !== "," && text[end] !== "]") end += 1;
      if (end >= text.length) throw new YamlSubsetError(lineNumber, "flow sequence is not closed on the same line");
      const value = parsePlain(text.slice(i, end), lineNumber, { inFlow: true });
      if (value === null) throw new YamlSubsetError(lineNumber, "empty item in flow sequence");
      items.push(value);
      i = end;
    }
    expectItem = false;
  }
}

function nextContentIndex(lines, from) {
  let i = from;
  while (i < lines.length && lines[i].skip) i += 1;
  return i;
}

// Block scalar body: every following line that is blank or indented deeper than the key.
function parseBlockScalar(lines, from, keyIndent, folded) {
  const body = [];
  let i = from;
  while (i < lines.length) {
    const line = lines[i];
    if (line.text !== "" && line.indent <= keyIndent) break;
    if (line.text !== "") requireSpaces(line);
    body.push(line);
    i += 1;
  }
  while (body.length > 0 && body[body.length - 1].text === "") body.pop();
  const first = body.find((line) => line.text !== "");
  if (!first) return { value: "", next: i };
  const parts = body.map((line) => {
    if (line.text === "") return "";
    if (line.indent < first.indent) {
      throw new YamlSubsetError(line.number, "block scalar line is indented less than its first line");
    }
    return line.raw.slice(first.indent).trimEnd();
  });
  let value;
  if (folded) {
    value = "";
    for (let p = 0; p < parts.length; p += 1) {
      if (p === 0) value = parts[p];
      else if (parts[p] === "" || parts[p - 1] === "") value += parts[p] === "" ? "\n" : parts[p];
      else value += ` ${parts[p]}`;
    }
  } else {
    value = parts.join("\n");
  }
  return { value: value.trim(), next: i };
}

// Block sequence of scalars under a key: `- item` lines indented at least as far as the key.
function parseBlockSequence(lines, from, itemIndent) {
  const items = [];
  let i = from;
  for (;;) {
    i = nextContentIndex(lines, i);
    if (i >= lines.length) break;
    const line = lines[i];
    if (line.indent !== itemIndent || !/^-(\s|$)/.test(line.text)) break;
    requireSpaces(line);
    const value = parseInlineScalar(line.text.slice(1), line.number);
    if (value === null) throw new YamlSubsetError(line.number, "empty or nested item in block sequence");
    items.push(value);
    i += 1;
  }
  return { value: items, next: i };
}

// Block mapping whose keys all sit at `indent`. Values: scalar, flow sequence,
// block scalar, block sequence of scalars, or empty.
function parseMapping(lines, from, indent) {
  const map = new Map();
  let i = from;
  for (;;) {
    i = nextContentIndex(lines, i);
    if (i >= lines.length) break;
    const line = lines[i];
    requireSpaces(line);
    if (line.indent < indent) break;
    if (line.indent > indent) throw new YamlSubsetError(line.number, "unexpected indentation");
    const match = /^([A-Za-z_][A-Za-z0-9_-]*):(?:\s+(.*))?$/.exec(line.text);
    if (!match) throw new YamlSubsetError(line.number, `expected "key: value", found: ${line.text}`);
    const key = match[1];
    const rest = (match[2] ?? "").trim();
    if (map.has(key)) throw new YamlSubsetError(line.number, `duplicate key: ${key}`);

    if (rest === "" || rest.startsWith("#")) {
      const peek = nextContentIndex(lines, i + 1);
      if (peek < lines.length && lines[peek].indent >= indent && /^-(\s|$)/.test(lines[peek].text)) {
        const parsed = parseBlockSequence(lines, peek, lines[peek].indent);
        map.set(key, parsed.value);
        i = parsed.next;
      } else {
        map.set(key, null);
        i += 1;
      }
    } else if (/^[|>]/.test(rest)) {
      if (!/^[|>][+-]?(\s+#.*)?$/.test(rest)) {
        throw new YamlSubsetError(line.number, `unsupported block scalar header: ${rest}`);
      }
      const parsed = parseBlockScalar(lines, i + 1, indent, rest[0] === ">");
      map.set(key, parsed.value);
      i = parsed.next;
    } else if (rest.startsWith("[")) {
      map.set(key, parseFlowSequence(rest, line.number));
      i += 1;
    } else {
      map.set(key, parseInlineScalar(rest, line.number));
      i += 1;
    }
  }
  return { map, next: i };
}

// index.yaml: `[]` or a block sequence of mappings.
function parseIndex(text) {
  const lines = toLines(normalize(text));
  let i = nextContentIndex(lines, 0);
  if (i < lines.length && lines[i].text === "---") i = nextContentIndex(lines, i + 1);
  if (i >= lines.length) throw new YamlSubsetError(lines.length, "index is empty; expected `[]` or a sequence of entries");

  if (/^\[\s*\](\s+#.*)?$/.test(lines[i].text)) {
    const after = nextContentIndex(lines, i + 1);
    if (after < lines.length) throw new YamlSubsetError(lines[after].number, "content after `[]`");
    return [];
  }

  const dashIndent = lines[i].indent;
  const entries = [];
  while (i < lines.length) {
    const line = lines[i];
    requireSpaces(line);
    if (line.indent !== dashIndent || !/^-(\s|$)/.test(line.text)) {
      throw new YamlSubsetError(line.number, "expected a sequence entry starting with `- `; the index must be a YAML sequence or `[]`");
    }
    const afterDash = line.text.slice(1);
    const inner = afterDash.trimStart();
    if (inner === "" || inner.startsWith("#")) {
      throw new YamlSubsetError(line.number, "index entry must start its first field on the `- ` line");
    }
    const keyIndent = dashIndent + 1 + (afterDash.length - inner.length);
    const view = lines.slice();
    view[i] = { ...line, indent: keyIndent, text: inner };
    const parsed = parseMapping(view, i, keyIndent);
    entries.push({ line: line.number, fields: parsed.map });
    i = nextContentIndex(lines, parsed.next);
  }
  return entries;
}

// Returns null when the file has no frontmatter block.
function parseFrontmatter(text) {
  const lines = toLines(normalize(text));
  if (lines.length === 0 || lines[0].raw.trimEnd() !== "---") return null;
  const end = lines.findIndex((line, idx) => idx > 0 && (line.raw.trimEnd() === "---" || line.raw.trimEnd() === "..."));
  if (end === -1) throw new YamlSubsetError(1, "frontmatter is not closed with a `---` line");
  return parseMapping(lines.slice(1, end), 0, 0).map;
}

// ---------- checks ----------

function isValidDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function localToday() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function isEmpty(value) {
  return value === null || value === undefined || value === "";
}

function listDir(dir) {
  return readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

function collectMemoryFiles(memoryDir, review) {
  const files = [];
  const skippedPaths = new Set();
  const walk = (dir, relParts) => {
    for (const entry of listDir(dir)) {
      const rel = [...relParts, entry.name];
      const shown = `${MEMORY_DIR}/${rel.join("/")}`;
      if (entry.isSymbolicLink()) {
        skippedPaths.add(rel.join("/"));
        review.push({ code: "symlink-skipped", path: shown, message: "symbolic link not followed; check it by hand" });
      } else if (entry.isDirectory()) {
        walk(join(dir, entry.name), rel);
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        files.push({ id: rel.join("/").slice(0, -3), dir: rel[0], path: shown, absolute: join(dir, entry.name) });
      }
    }
  };

  for (const entry of listDir(memoryDir)) {
    const shown = `${MEMORY_DIR}/${entry.name}`;
    if (entry.name === INDEX_FILE || entry.name === "README.md") continue;
    if (entry.isSymbolicLink()) {
      skippedPaths.add(entry.name);
      review.push({ code: "symlink-skipped", path: shown, message: "symbolic link not followed; check it by hand" });
    } else if (entry.isDirectory() && Object.hasOwn(DIR_TO_TYPE, entry.name)) {
      walk(join(memoryDir, entry.name), [entry.name]);
    } else if (entry.isDirectory()) {
      skippedPaths.add(entry.name);
      review.push({ code: "outside-type-directory", path: `${shown}/`, message: "directory is not a memory type directory; its contents were not checked" });
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      skippedPaths.add(entry.name);
      review.push({ code: "outside-type-directory", path: shown, message: "markdown file is not in a type directory; a legacy flat file needs Migrate" });
    }
  }
  return { files, skippedPaths };
}

function checkFile(file, errors) {
  const add = (code, message, extra = {}) => errors.push({ code, id: file.id, path: file.path, message, ...extra });
  let fields;
  try {
    fields = parseFrontmatter(readFileSync(file.absolute, "utf8"));
  } catch (error) {
    if (!(error instanceof YamlSubsetError)) throw error;
    add("frontmatter-unparsed", `frontmatter not understood (${error.message}); nothing was assumed, check this file by hand`);
    return null;
  }
  if (fields === null) {
    add("frontmatter-missing", "file does not start with a `---` frontmatter block");
    return null;
  }

  for (const field of REQUIRED_FRONTMATTER) {
    const value = fields.get(field);
    if (Array.isArray(value) ? false : isEmpty(value)) add("missing-field", `required frontmatter field is missing or empty: ${field}`, { field });
  }
  const scalars = {};
  for (const field of SINGLE_VALUE_FIELDS) {
    const value = fields.get(field);
    if (Array.isArray(value)) add("invalid-field", `frontmatter field must be a single value, not a list: ${field}`, { field });
    else if (!isEmpty(value)) scalars[field] = value;
  }

  if (scalars.id !== undefined && scalars.id !== file.id) {
    add("id-mismatch", `frontmatter id "${scalars.id}" does not match the path; expected "${file.id}"`, { expected: file.id, found: scalars.id });
  }
  if (scalars.type !== undefined) {
    if (!Object.hasOwn(TYPE_TO_DIR, scalars.type)) {
      add("invalid-type", `type "${scalars.type}" is not one of: ${Object.keys(TYPE_TO_DIR).join(", ")}`, { found: scalars.type });
    } else if (TYPE_TO_DIR[scalars.type] !== file.dir) {
      add("type-directory-mismatch", `type "${scalars.type}" belongs in ${TYPE_TO_DIR[scalars.type]}/, but the file is in ${file.dir}/`, { expected: DIR_TO_TYPE[file.dir], found: scalars.type });
    }
  }
  if (scalars.status !== undefined && !STATUSES.includes(scalars.status)) {
    add("invalid-status", `status "${scalars.status}" is not active or archived`, { found: scalars.status });
  }
  for (const field of DATE_FIELDS) {
    if (scalars[field] !== undefined && !isValidDate(scalars[field])) {
      add("invalid-date", `${field} "${scalars[field]}" is not a valid YYYY-MM-DD date`, { field, found: scalars[field] });
    }
  }
  return scalars;
}

function checkMemory(memoryDir, today) {
  const errors = [];
  const review = [];
  const names = listDir(memoryDir).map((entry) => entry.name);

  const { files, skippedPaths } = collectMemoryFiles(memoryDir, review);
  const parsed = new Map(); // id -> scalar frontmatter fields, or null when unreadable
  for (const file of files) parsed.set(file.id, checkFile(file, errors));

  // Index
  let entries = null;
  const indexPath = `${MEMORY_DIR}/${INDEX_FILE}`;
  if (!names.includes(INDEX_FILE)) {
    const legacy = names.find((name) => name.toLowerCase() === INDEX_FILE);
    errors.push({
      code: "index-missing",
      path: indexPath,
      message: legacy ? `${INDEX_FILE} not found; ${legacy} is the legacy name and needs Migrate` : `${INDEX_FILE} not found`,
    });
  } else if (!lstatSync(join(memoryDir, INDEX_FILE)).isFile()) {
    errors.push({ code: "index-missing", path: indexPath, message: `${INDEX_FILE} is not a regular file` });
  } else {
    try {
      entries = parseIndex(readFileSync(join(memoryDir, INDEX_FILE), "utf8"));
    } catch (error) {
      if (!(error instanceof YamlSubsetError)) throw error;
      errors.push({
        code: "index-unparsed",
        path: indexPath,
        message: `index not understood (${error.message}); nothing was assumed, so index and file parity was not checked`,
      });
    }
  }

  let unindexed = 0;
  let orphans = 0;
  const mismatchedFiles = new Set();
  if (entries !== null) {
    const fileIds = new Set(files.map((file) => file.id));
    const indexedIds = new Set();
    for (const entry of entries) {
      const where = { path: indexPath, line: entry.line };
      const values = {};
      for (const [field, value] of entry.fields) {
        if (!Array.isArray(value) && !isEmpty(value)) values[field] = value;
      }
      const label = values.id ?? `entry at line ${entry.line}`;
      for (const field of REQUIRED_INDEX) {
        if (values[field] === undefined) {
          errors.push({ code: "index-missing-field", id: values.id, ...where, field, message: `index entry ${label} is missing required field: ${field}` });
        }
      }
      if (values.id === undefined) continue;
      if (indexedIds.has(values.id)) {
        errors.push({ code: "index-duplicate-id", id: values.id, ...where, message: `index lists ${values.id} more than once` });
        continue;
      }
      indexedIds.add(values.id);
      if (!fileIds.has(values.id)) {
        const indexedPath = `${values.id}.md`;
        if ([...skippedPaths].some((path) => indexedPath === path || indexedPath.startsWith(`${path}/`))) continue;
        orphans += 1;
        errors.push({ code: "orphan-entry", id: values.id, ...where, message: `index entry has no file at ${MEMORY_DIR}/${values.id}.md` });
        continue;
      }
      const fileFields = parsed.get(values.id);
      if (!fileFields) continue;
      for (const field of COMPARED_FIELDS) {
        if (values[field] === undefined || fileFields[field] === undefined || values[field] === fileFields[field]) continue;
        mismatchedFiles.add(values.id);
        errors.push({
          code: "index-mismatch",
          id: values.id,
          ...where,
          field,
          index: values[field],
          file: fileFields[field],
          message: `index ${field} "${values[field]}" differs from the file's frontmatter "${fileFields[field]}"`,
        });
      }
    }
    for (const file of files) {
      if (indexedIds.has(file.id)) continue;
      unindexed += 1;
      errors.push({ code: "unindexed-file", id: file.id, path: file.path, message: "memory file has no index entry" });
    }
  }

  // Review items
  for (const file of files) {
    const fields = parsed.get(file.id);
    if (!fields) continue;
    if (fields.expires !== undefined && isValidDate(fields.expires) && fields.expires < today && fields.status !== "archived") {
      review.push({ code: "expired", id: file.id, path: file.path, expires: fields.expires, message: `expires ${fields.expires} is before ${today}; update, archive, or remove after asking` });
    }
    if (fields.supersedes !== undefined && parsed.get(fields.supersedes)?.status === "active") {
      review.push({
        code: "superseded-still-active",
        id: fields.supersedes,
        path: `${MEMORY_DIR}/${fields.supersedes}.md`,
        supersededBy: file.id,
        message: `superseded by ${file.id} but still active; flag for archival`,
      });
    }
  }

  const byType = Object.fromEntries(Object.keys(TYPE_TO_DIR).map((type) => [type, 0]));
  for (const file of files) byType[DIR_TO_TYPE[file.dir]] += 1;
  const byStatus = { active: 0, archived: 0, unknown: 0 };
  for (const file of files) {
    const status = parsed.get(file.id)?.status;
    byStatus[STATUSES.includes(status) ? status : "unknown"] += 1;
  }

  return {
    ok: errors.length === 0,
    memoryDir,
    today,
    summary: {
      files: files.length,
      indexEntries: entries === null ? null : entries.length,
      byType,
      byStatus,
      unindexedFiles: entries === null ? null : unindexed,
      orphanEntries: entries === null ? null : orphans,
      mismatchedFiles: entries === null ? null : mismatchedFiles.size,
    },
    errors,
    review,
  };
}

// ---------- command line ----------

function usageError(message) {
  process.stderr.write(`check-memory: ${message}\nRun with --help for usage.\n`);
  process.exit(2);
}

function parseArgs(argv) {
  const options = { json: false, today: null, path: null, help: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "-h" || arg === "--help") options.help = true;
    else if (arg === "--json") options.json = true;
    else if (arg === "--today" || arg.startsWith("--today=")) {
      const value = arg === "--today" ? argv[i += 1] : arg.slice("--today=".length);
      if (value === undefined || !isValidDate(value)) usageError("--today needs a valid YYYY-MM-DD date");
      options.today = value;
    } else if (arg.startsWith("-")) usageError(`unknown option: ${arg}`);
    else if (options.path !== null) usageError("only one path may be given");
    else options.path = arg;
  }
  return options;
}

// The path argument is the caller's choice, so a link there is followed.
// Everything below it is examined with lstat and links are skipped.
function isDirectory(path, { followLink = false } = {}) {
  try {
    return (followLink ? statSync(path) : lstatSync(path)).isDirectory();
  } catch {
    return false;
  }
}

function formatText(result) {
  const out = [`agent-memory check: ${result.memoryDir}`];
  if (result.summary) {
    const { summary } = result;
    const types = Object.entries(summary.byType).map(([type, count]) => `${type}(${count})`).join(" ");
    out.push(`Memory files: ${summary.files}   Index entries: ${summary.indexEntries ?? "unreadable"}`);
    out.push(`By type: ${types}`);
    out.push(`Active: ${summary.byStatus.active}   Archived: ${summary.byStatus.archived}   Unknown status: ${summary.byStatus.unknown}`);
    if (summary.indexEntries !== null) {
      out.push(`Unindexed files: ${summary.unindexedFiles}   Orphan entries: ${summary.orphanEntries}   Files whose index entry differs: ${summary.mismatchedFiles}`);
    }
  }
  const section = (title, items) => {
    out.push("", `${title} (${items.length}):`);
    for (const item of items) {
      const subject = item.id ?? item.path ?? "";
      const line = item.line ? ` (${item.path}:${item.line})` : "";
      out.push(`  [${item.code}] ${subject}${subject ? " — " : ""}${item.message}${line}`);
    }
  };
  if (result.errors.length > 0) section("Errors", result.errors);
  if (result.review.length > 0) section("Review", result.review);
  out.push("", result.ok
    ? `Result: no errors, ${result.review.length} review item(s). Nothing was changed.`
    : `Result: ${result.errors.length} error(s), ${result.review.length} review item(s). Nothing was changed.`);
  return `${out.join("\n")}\n`;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(HELP);
    return 0;
  }
  const target = resolve(options.path ?? ".");
  if (!isDirectory(target, { followLink: true })) usageError(`not a directory: ${options.path ?? "."}`);

  const today = options.today ?? localToday();
  let result;
  if (basename(target) === MEMORY_DIR) {
    result = checkMemory(target, today);
  } else if (isDirectory(join(target, MEMORY_DIR))) {
    result = checkMemory(join(target, MEMORY_DIR), today);
  } else {
    const linked = lstatSync(join(target, MEMORY_DIR), { throwIfNoEntry: false })?.isSymbolicLink() ?? false;
    result = {
      ok: false,
      memoryDir: null,
      today,
      summary: null,
      errors: [{
        code: "memory-dir-missing",
        path: `${MEMORY_DIR}/`,
        message: linked
          ? `${MEMORY_DIR} in ${target} is a symbolic link, which is not followed; pass the real directory`
          : `no ${MEMORY_DIR}/ directory in ${target}; Init creates it`,
      }],
      review: [],
    };
  }

  if (options.json) process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  else process.stdout.write(formatText({ ...result, memoryDir: result.memoryDir ?? target }));
  return result.ok ? 0 : 1;
}

process.exitCode = main();
