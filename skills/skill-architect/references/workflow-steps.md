# Workflow step detail

Use this reference from the procedure step in `SKILL.md` that links here. [`SKILL.md`](../SKILL.md#procedure) owns the step order, the steps each mode runs, and each step's done condition; this file holds the detail a step needs while it runs. Step 1 (classify) has no detail beyond the mode table.

## Step 2: Read the local standard

Start with the current working context, not an upstream rubric. Check the CWD, project files, installed skill location, or repository convention first. Use the Agent Skills specification for portable baseline syntax; external rubrics inform content quality, while local rules win on accepted frontmatter fields, manifests, lockfiles, CI, and release gates. Do not add experimental `allowed-tools` unless the target runtime and repository schema both accept and enforce it.

Find the CWD/project/repository authoring standard, agent instructions, check commands, and target skill before editing. The full order of authority is the [precedence list](house-rubric.md#precedence).

## Step 3: Gather use cases and pick the lens

Capture only the details that determine structure:

- exact request phrases that should trigger the skill
- file paths, tools, APIs, or error messages that imply the skill
- repeated task shape: quick reference, workflow, router, review rubric, or deterministic helper
- target runtime capabilities: check required tools, permissions, and instruction loading; use [vendor-adapters.md](vendor-adapters.md) when host-specific execution or packaging details matter
- whether the skill needs references, assets, examples, or helper scripts

Ask one focused question if a structural choice is ambiguous. Otherwise infer from the CWD/project/repository pattern and state the assumption.

Then select the lens for the work: structure, quality/evals, vendor compatibility, distribution governance, or predictability.

## Step 4: Plan the artifact

Decide the portable core, references, optional assets/scripts, vendor metadata, and validation path.

The portable core lives in `SKILL.md` and linked references. Vendor details live in adapter sections or metadata files.

Use this split:

| Layer | Contains | Avoid |
|---|---|---|
| Portable core | trigger intent, workflow, checks, references, scripts/assets | one vendor's CLI assumptions as universal truth |
| Local convention | required frontmatter, versions, hashes, security files, README/plugin registry updates, or platform conventions | upstream defaults that fail local checks |
| Vendor adapter | OpenAI YAML, Claude plugin notes, Antigravity/Azure conventions, installation constraints | changing the portable workflow to fit one agent |
| Quality harness | eval prompts, baseline comparisons, review packets, pressure tests | claiming quality from prose review alone |

## Step 5: Review before patching

For Create, record the applicable checks, their source in the requirements or standard, and the fixtures that will exercise them before writing the first file. Leave draft-specific evidence pending until step 7.

For existing skills, prepare the audit packet below before making non-trivial edits:

| Check | Evidence | Decision |
|---|---|---|
| Trigger description is concrete | `SKILL.md` frontmatter line | keep / patch |
| Invocation fit is justified | description, expected caller, context/cognitive load tradeoff | keep model-invoked / make user-invoked / add router |
| Branches are unique | description, command table, mode rules | keep / collapse synonym-only trigger branches |
| Information hierarchy is clean | section inventory | keep in `SKILL.md` / move to reference / split sequence |
| Completion criteria are checkable | every ordered step or command workflow | keep / sharpen / add done criteria |
| Leading words carry repeated concepts | repeated behavior terms and trigger language | keep prose / collapse to leading word |
| Pruning pass finds no sediment | duplicated, stale, no-op, or sprawling lines | keep / delete / disclose |
| `SKILL.md` is lean enough | word count | keep / split |
| References are linked | link check | keep / patch |
| Vendor assumptions are isolated | relevant section/file | keep / patch |
| Mechanical gates are available | repository scripts, CI, evals, or fixtures | run / note skipped |

Run the [predictability and pruning pass](house-rubric.md#predictability-and-pruning-checks) before judging style or patching content. When the packet goes into a pull request, use the [review packet template](eval-methodology.md#review-packet-template).

For behavior-shaping skills, add at least one forward test or prompt scenario. For any shipped CI, shell, or code — helper scripts, snippets, or workflow examples — execute it against a fixture rather than vouching for it by reading; reading and security scans miss logic defects such as a wrong regex. An audit is incomplete until each embedded-code finding or pass includes a fixture command plus observed output, or an explicit skipped-risk note.

Run the bounded executable-surface triage and calibrate eval, adapter, and weak-description findings with the [review rubric](house-rubric.md#review-rubric); route algorithmic correctness, exploitability, performance, and large refactors to a dedicated code-review skill.

For test vectors, harness setup, enumeration consistency, and severity calibration, use [Eval methodology](eval-methodology.md) and the [portable rubric](house-rubric.md).

## Step 6: Draft or patch narrowly

Avoid churn-only rewrites; improve only the requested surface and directly related standard violations.

Keep `SKILL.md` focused on routing and immediate behavior. Move long comparisons, advanced examples, vendor matrices, and eval details to `references/`.

Minimum portable skill shape:

```text
skills/<skill-name>/
├── SKILL.md
├── LICENSE
└── references/          # only when detail would bloat SKILL.md
```

Add `assets/` or helper scripts only when they materially improve repeatability. Treat scripts as inert skill assets unless the local project or runtime explicitly allows executable helpers; document, link, hash, and security-scan them according to local conventions when available.

## Step 7: Verify mechanically

For a new skill, compare the draft against the step 5 checklist, fill in its file and line evidence, and execute its fixtures. Record the observed results and correct failed checks before handoff.

Run repo checks or the closest local equivalent before handing back. Run the narrowest meaningful checks for the current working context. Prefer documented validation commands, CI gates, evals, fixture tests, hash checks, and security scans when present. In `skills4sh`, run the [packaging check list](naming-and-packaging.md#packaging-checklist).

Run a focused or full security scan when new files contain scripts, shell examples, credentials guidance, network examples, or other security-sensitive patterns.

Report exactly what passed, failed, or was skipped. Do not claim an eval, scan, or fixture test that was not run.

### Deterministic checks vs judgment

Skill work splits across four layers — keep them separate and route each check to the layer that can decide it:

| Layer | Owns | Examples |
|---|---|---|
| Portable validator (`validate_skill.py`) | Minimal deterministic checks that hold inside one skill folder, no repo metadata or network | valid YAML and typed, non-empty fields; specification length limits + `name`/directory match + kebab-case, description has concrete trigger detail and no angle brackets, body within the hard size cap, `references/*.md` linked from `SKILL.md`, in-skill relative Markdown link targets, and same/cross-file Markdown heading anchors |
| Portable fixer (`fix_skill.py`) | Safe mechanical edits that require no taste or domain judgment; dry-run unless `--write` is explicit | frontmatter `name` normalization and insertion of missing `references/*.md` links in `SKILL.md` |
| Local binding gate (project CI) | Deterministic checks that depend on repo conventions; **binding and a superset** | file hashes, `skills-lock.json`, security manifests, doc-sync, semver — in `skills4sh`, the [packaging check list](naming-and-packaging.md#packaging-checklist) |
| This skill's rubric (judgment) | What no script can decide | trigger *quality*, executable-surface triage, embedded-code *correctness* (review + fixture run), body altitude beyond the cap, vendor-isolation, narrative bloat |

The litmus test: **if a script can decide it, automate it; if it needs reasoning or taste, it stays in the rubric.** When a local binding gate exists, it wins over the portable validator on any overlap. Codifying a rule (for example a numeric size band) moves it from judgment toward the validator; treat that as the goal, not a loss.

Run the helpers as described in the [helper runtime](helper-runtime.md).

## Step 8: Hand off

When producing a plan, proposal, audit packet, or distilled skill spec for another agent or a future session, write for the weakest plausible executor. Reference accessible authoritative artifacts with exact paths or URLs; include essential excerpts only when the executor needs them. Preserve local conventions, scope boundaries, verification commands with expected results, drift checks, and STOP conditions. For dependent tasks, specify consumed/produced interfaces and requirement coverage using the [handoff plan rubric](house-rubric.md#handoff-plan-rubric).

Record rejected findings or non-adopted patterns with one-line rationales so they do not return in the next audit or reconciliation pass.
