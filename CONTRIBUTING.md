# Contributing to skills4sh

Thanks for your interest. This repo ships agent skills (markdown bundles) over a small Node CLI, plus supporting tooling and standalone plugins. Most contributions fall into one of these shapes:

1. **Adding or updating a skill** — covered in detail below.
2. **Changing the installer / tooling / CI** — see [SECURITY.md](SECURITY.md) for the supply-chain posture and [.github/BRANCH_PROTECTION.md](.github/BRANCH_PROTECTION.md) for the required-checks matrix.
3. **Adding or updating a plugin or script** — see [Plugins and scripts](#plugins-and-scripts) below. Unlike skills, these contain executable code and are documented per-folder rather than through the skill version-sync surface.

If you are unsure whether a change fits, open a draft PR or an issue first.

---

## Repository layout

```text
skills/<name>/              # the skill itself (SKILL.md + references/ + optional assets/)
.security/<name>.yaml       # OWASP AST10 manifest mirroring the skill
skills-lock.json            # canonical version + computed folder hash per skill
bin/                        # CLI + check scripts (Node 22+, ESM)
plugins/<name>/             # standalone plugins (executable code + per-folder README)
.github/workflows/          # 7 workflows: validate, guardskills, release, npm-publish, codeql, dependency-review, branch-protection-drift
tests/                      # installer + integration tests (node:test)
```

A skill is **pure documentation**: SKILL.md instructions plus optional reference markdown and static assets. No shell scripts, no executable code, no install hooks. The installer (`bin/install.mjs`) only copies files to a destination directory; it never executes anything from the skill.

Code that *is* executable lives in two places: `bin/` (the installer and check scripts) and `plugins/` (standalone plugins that run in their own host, e.g. Figma). Neither is delivered by `bin/install.mjs` and neither participates in the skill version-sync surface — they are documented in their own folders and reviewed as code.

---

## Adding a new skill

Follow the repository [Skill Authoring Standard](docs/SKILL_AUTHORING_STANDARD.md) for structure, frontmatter, body-size targets, progressive disclosure, and validation expectations. In short: `Skill Development` is the primary structural standard for this repo, `writing-skills` contributes validation discipline, and Codex's system `skill-creator` is treated as compatibility guidance.

### 1. Create the skill directory

```text
skills/<your-skill>/
├── SKILL.md             # required
├── references/          # optional, recommended for anything beyond a one-liner
│   └── *.md
└── assets/              # optional — icons, snippet files, etc.
```

### 2. Required SKILL.md frontmatter

```yaml
---
name: <your-skill>                # MUST match the directory name
description: "..."                # one-paragraph trigger description; aim for retrieval, not marketing
license: MIT
compatibility: macOS, Linux, or Windows
metadata:
  author: <you>
  version: "0.1.0"                # semver; start at 0.1.0 for pre-1.0 skills
  tags: comma, separated, list
---
```

The `description` is what an LLM agent matches against to decide whether to load the skill. Be specific about the *kinds of user requests* and *file paths* it covers. Avoid generic adjectives.

### 3. Create the `.security/<name>.yaml` manifest

Copy an existing manifest as a template (the `agent-memory.yaml` is the simplest, `eleventy-nunjucks.yaml` is the fullest). The schema is the OWASP **Agentic Skills Top 10 (AST10)** manifest format.

Required top-level keys:

| Key | Purpose |
|---|---|
| `skill.name`, `skill.version`, `skill.license`, `skill.author`, `skill.repository`, `skill.path` | Identity — must match SKILL.md |
| `integrity.hash_algorithm: sha256` | Always sha256 |
| `integrity.files` | Map of every file in the skill → its SHA-256 hash |
| `permissions.alwaysAllow` | Pre-approved tool permissions (usually `[]`) |
| `permissions.rationale` | One-line explanation |
| `execution_context` | `sandbox`, `network`, `filesystem`, `shell`, `risk_tier` |
| `dependencies` | npm/system packages the skill instructs the agent to invoke |
| `scanning.guardskills` | `SAFE` after a clean local scan |
| `scanning.expected_findings` | Documented false positives — see "Expected findings" below |

### 4. Wire the skill into the seven-place version-sync surface

[`bin/drift-check.mjs`](bin/drift-check.mjs) reconciles the same skill's identity across **seven places**. Every place must agree or `npm run check:drift` fails:

1. `skills/<name>/SKILL.md` — `metadata.version` in frontmatter
2. `skills-lock.json` — `skills.<name>.version` + `computedHash`
3. `README.md` — the skill table row (description + version cell)
4. `AGENTS.md` — the skill table row
5. `SECURITY.md` — the supported-versions table + the security manifest table
6. `.cursor-plugin/plugin.json` — the `skills[]` entry
7. `.security/<name>.yaml` — manifest version + every file's SHA-256 hash

`.claude-plugin/marketplace.json` description must also reference the skill by name (drift-check enforces this too).

Run `npm run check:drift` locally before pushing. The script prints actionable errors for each mismatch.

### 5. Compute hashes

Two hashes need updating whenever a skill's content changes:

- **Per-file SHA-256s** in `.security/<name>.yaml#integrity.files` — one line per file.
- **Folder-level computedHash** in `skills-lock.json#skills.<name>.computedHash` — sha256 of sorted `relPath + content` for the whole folder. Matches `vercel-labs/skills` exactly. See [bin/install.mjs:249](bin/install.mjs:249) (`computeSkillFolderHash`).

Easiest way to regenerate both: run `node bin/hash-check.mjs` — it prints expected vs. actual and tells you what to paste back.

### 6. Test the skill in a host

Skills are prompts. The only meaningful way to test them is to install into a real Claude Code / Cursor / Copilot session and exercise the trigger:

```bash
node bin/install.mjs --skill <your-skill> --dest /tmp/skills4sh-test
# or install into your real config:
node bin/install.mjs --skill <your-skill>
```

Then open Claude Code or Cursor and invoke a request that should match the skill's trigger phrasing. There is no automated test for skill *behavior* — only for the installer that delivers it.

---

## Updating an existing skill

1. Edit files under `skills/<name>/`.
2. Bump `metadata.version` in `skills/<name>/SKILL.md` (semver — patch for typos, minor for additive content, major for breaking changes to triggers or scope).
3. Regenerate hashes (see step 5 above).
4. Update the version in **all seven places** (drift-check will tell you which).
5. Add a CHANGELOG entry under `[Unreleased]` describing the change.
6. Run the full local check suite (next section) and open a PR.

**Semver monotonicity is enforced.** `npm run check:drift` compares the current SKILL.md version against the previous commit's version (`HEAD^`) and fails if it went backwards. If you genuinely need to roll back a version, do it in a separate commit with an explicit `BREAKING:` note.

---

## Plugins and scripts

`plugins/<name>/` and `bin/` hold **executable code**, not documentation bundles. They do not have a `.security/<name>.yaml` manifest, do not appear in `skills-lock.json`, and are not part of the seven-place version-sync surface. They are reviewed as code and documented in-folder.

### Adding a plugin

```text
plugins/<your-plugin>/
├── README.md            # required — what it does, the data/flow, setup, and any access scopes
├── <entry files>        # the plugin's own runtime files (e.g. manifest.json, code.js, ui.html)
└── ...
```

Requirements:

1. **Folder name is kebab-case** and matches the plugin's stable id (e.g. `tokens-sync-to-figma`). The host-facing *display* name may differ and is set in the plugin's own manifest.
2. **A per-folder `README.md`** that explains: what the plugin does, the data flow / contract (document any JSON or message schema it consumes), setup steps, and every external access scope it requests (network domains, document/filesystem access) with the reason.
3. **No private or project-internal identifiers.** No customer names, internal collection/page names, internal hostnames, or org jargon hardcoded in source. Use generic, configurable names. This repo is public.
4. **No secrets.** No tokens, gist URLs tied to a private account, or credentials committed. User-supplied URLs/keys belong in plugin UI inputs, not source.
5. **Least-privilege access.** Declare the narrowest host/permission scope the plugin needs (e.g. an explicit `networkAccess.allowedDomains` allowlist rather than allow-all) and justify it in the README.
6. **License.** State MIT in the README and point at the repository [LICENSE](LICENSE).

Plugins are not delivered by `npx skills add`; they are imported directly into their host per the plugin README.

### Changing scripts (`bin/`)

`bin/` is the installer and the check scripts (Node 22+, ESM). Changes here are tooling changes — keep them covered by `tests/`, run the full local check suite, and follow the supply-chain posture in [SECURITY.md](SECURITY.md).

---

## Local check suite

Run these before pushing. CI runs the same set.

```bash
npm run check:drift          # cross-file metadata + semver monotonicity
npm run check:guardskills    # security scan vs. .security/*.yaml expected findings
node bin/hash-check.mjs      # skills-lock.json hash verification
npm test                     # installer unit + integration tests
```

The pre-commit hook runs `bin/hash-check.mjs` automatically once wired:

```bash
bash bin/setup-hooks.sh
```

**Why opt-in.** The `prepare` script in `package.json` runs for downstream consumers when they `npm install skills4sh`. Wiring hooks there would mutate their `.git/config` — unacceptable. Contributors run `setup-hooks.sh` once per clone.

---

## Expected security findings

When `guardskills@1.2.1 scan-local` flags something that is **definitively not a vulnerability** (e.g., a `grep` pattern in a documentation snippet, or an env-var read used as a teaching example), declare it as an expected finding in `.security/<name>.yaml#scanning.expected_findings`.

Schema per finding:

```yaml
- id: R005_SECRET_READ              # the guardskills rule id
  severity: high                    # low | medium | high | critical
  confidence: medium                # optional
  acknowledged: true                # REQUIRED if severity is high or critical
  file: references/build-pipeline.md
  reason: "False positive — security-hardening grep examples; no secret material."
```

### Severity floor (HIGH/CRITICAL require acknowledgement)

`bin/guardskills-check.mjs` enforces a **default-deny** policy on HIGH/CRITICAL findings:

- If the scan reports a HIGH or CRITICAL finding and no matching `expected_findings` entry exists → **fail**.
- If a matching entry exists but **lacks `acknowledged: true`** → **fail**.
- LOW/MEDIUM findings only need to match by `id` + `file`.

`acknowledged: true` is a deliberate review surface. A reviewer should ask: "why is this acknowledged HIGH?" The `reason:` field must answer it.

Never declare a real security issue as `acknowledged: true`. If the underlying issue is real, fix the code instead.

---

## Pull request expectations

1. Use the [PR template](.github/PULL_REQUEST_TEMPLATE.md) — the OWASP AST10 checklist is the bar for skill changes.
2. Required CI checks (configured in [.github/BRANCH_PROTECTION.md](.github/BRANCH_PROTECTION.md)) — all must pass:
   - `validate` (Node 22 + 24)
   - `guardskills` (each of the 5 skills × Node 22 + 24)
   - `release-guards` (bin-tag-parity)
   - `codeql`
   - `dependency-review`
3. Branch must be up to date with `main` before merge.
4. **No commit attribution trailers.** No `Co-Authored-By`, no `Signed-off-by`, no `Generated-by` lines. The git `author` field is the complete record.

## Reporting vulnerabilities

Do not open a public issue for security problems. See [SECURITY.md](SECURITY.md) for the disclosure process — 48h acknowledgement, 7d fix for critical.

## License

By contributing, you agree your contribution is licensed under the [MIT License](LICENSE).
