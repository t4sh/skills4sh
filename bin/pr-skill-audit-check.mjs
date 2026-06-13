#!/usr/bin/env node
// Enforce the PR-body evidence packet required for skill or skill-standard changes.
// Push events pass. Pull requests that touch skills or skill authoring automation
// must show an evidence table, mechanical checks, and checklist-before-patch attestation.

import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { realpathSync } from "node:fs";

const RELEVANT_PATHS = [
  /^skills\//,
  /^\.security\//,
  /^skills-lock\.json$/,
  /^docs\/SKILL_AUTHORING_STANDARD\.md$/,
  /^bin\/skill-standard-check\.mjs$/,
  /^bin\/pr-skill-audit-check\.mjs$/,
  /^tests\/skill-standard-check\.test\.mjs$/,
  /^tests\/pr-skill-audit-check\.test\.mjs$/,
  /^\.github\/PULL_REQUEST_TEMPLATE\.md$/,
  /^\.github\/workflows\/validate\.yml$/,
];

const REQUIRED_CHECKS = [
  {
    label: "standard-derived checklist before patch",
    regex: /- \[[xX]\]\s+Standard-derived checklist was completed before patching\./,
  },
  {
    label: "evidence table before edits",
    regex: /- \[[xX]\]\s+Evidence table was prepared before edits\./,
  },
  {
    label: "mechanical grep/checks for objective rules",
    regex: /- \[[xX]\]\s+Mechanical grep\/checks were run for every objective rule touched\./,
  },
];

export function runPrSkillAuditCheck({ body, changedFiles, eventName = "pull_request" }) {
  const files = Array.isArray(changedFiles) ? changedFiles : [];
  const relevant = files.some((file) => RELEVANT_PATHS.some((pattern) => pattern.test(file)));
  const errors = [];

  if (eventName !== "pull_request" || !relevant) {
    return { required: false, errors };
  }

  const text = String(body ?? "");
  if (!/##\s+Skill authoring audit/i.test(text)) {
    errors.push("missing '## Skill authoring audit' section");
  }

  for (const check of REQUIRED_CHECKS) {
    if (!check.regex.test(text)) {
      errors.push(`missing checked attestation: ${check.label}`);
    }
  }

  if (!hasFilledEvidenceTable(text)) {
    errors.push("missing filled evidence table row with standard-derived check, evidence, mechanical check, result, and patch/decision cells");
  }

  return { required: true, errors };
}

function hasFilledEvidenceTable(body) {
  const lines = String(body ?? "").split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const header = normalizeRow(lines[i]);
    if (!header) continue;
    const lower = header.map((cell) => cell.toLowerCase());
    const expected = ["standard-derived check", "evidence gathered before edits", "mechanical command or grep", "result", "patch/decision"];
    if (!expected.every((name, index) => lower[index] === name)) continue;

    for (let j = i + 2; j < lines.length; j += 1) {
      const row = normalizeRow(lines[j]);
      if (!row) break;
      if (row.length < expected.length) continue;
      const firstFive = row.slice(0, expected.length).map((cell) => cell.trim());
      if (firstFive.every((cell) => cell && !isHtmlPlaceholder(cell) && cell !== "—" && cell !== "TBD")) {
        return true;
      }
    }
  }
  return false;
}

function isHtmlPlaceholder(cell) {
  const value = String(cell ?? "").trim();
  return value.startsWith("<!--") && value.endsWith("-->");
}

function normalizeRow(line) {
  const trimmed = String(line ?? "").trim();
  if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) return null;
  const cells = trimmed.slice(1, -1).split("|").map((cell) => cell.trim());
  if (cells.every((cell) => /^:?-{3,}:?$/.test(cell))) return null;
  return cells;
}

function changedFilesFromEnv() {
  if (process.env.PR_CHANGED_FILES) {
    return process.env.PR_CHANGED_FILES.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  }
  if (process.env.PR_CHANGED_FILES_PATH) {
    return readFileSync(process.env.PR_CHANGED_FILES_PATH, "utf8").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  }
  return [];
}

if (process.argv[1]) {
  let invokedFile;
  try { invokedFile = realpathSync(process.argv[1]); }
  catch { invokedFile = process.argv[1]; }
  if (import.meta.url === pathToFileURL(invokedFile).href) {
    const result = runPrSkillAuditCheck({
      body: process.env.PR_BODY ?? "",
      changedFiles: changedFilesFromEnv(),
      eventName: process.env.GITHUB_EVENT_NAME ?? "pull_request",
    });
    if (result.errors.length > 0) {
      console.error("PR skill authoring audit check failed:");
      for (const error of result.errors) console.error(`  - ${error}`);
      process.exit(1);
    }
    if (result.required) console.log("✓ PR skill authoring audit packet present");
    else console.log("✓ PR skill authoring audit packet not required for this event/change set");
  }
}
